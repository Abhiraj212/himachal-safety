// ============================================================
// HIMACHAL SURAKSHA - Authentication System
// ============================================================

// ── Auth State Observer (call on every page) ──
function initAuthGuard(expectedRole, redirectTo = 'index.html') {
  HS.auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = redirectTo;
      return;
    }
    try {
      const profile = await getUserProfile(user.uid);
      if (!profile) { HS.auth.signOut(); window.location.href = redirectTo; return; }
      if (expectedRole && profile.role !== expectedRole) {
        window.location.href = getRoleDashboard(profile.role);
        return;
      }
      window.currentUser = { ...user, profile };
      renderUserInNav(user, profile);
      hideLoading();
    } catch (e) {
      console.error(e);
      hideLoading();
    }
  });
}

// ── Get user profile from Firestore ──
async function getUserProfile(uid) {
  // Check each collection
  for (const col of ['users', 'volunteers', 'admins']) {
    const snap = await HS.db.collection(col).doc(uid).get();
    if (snap.exists) return { id: snap.id, ...snap.data() };
  }
  return null;
}

// ── Role dashboard map ──
function getRoleDashboard(role) {
  const map = { citizen: 'citizen.html', volunteer: 'volunteer.html', admin: 'admin.html' };
  return 'pages/' + (map[role] || 'index.html');
}

// ── Render user in navbar ──
function renderUserInNav(user, profile) {
  const nameEl = document.getElementById('nav-user-name');
  const badgeEl = document.getElementById('nav-role-badge');
  if (nameEl) nameEl.textContent = profile.name || user.email?.split('@')[0] || 'User';
  if (badgeEl) { badgeEl.textContent = profile.role || 'user'; badgeEl.className = `role-badge ${profile.role}`; }
}

// ── Sign Out ──
async function signOut() {
  if (!confirmAction('Sign out?')) return;
  await HS.auth.signOut();
  window.location.href = '../index.html';
}

// ============================================================
// AUTH PAGE LOGIC (index.html)
// ============================================================
function initAuthPage() {
  // Redirect if already logged in
  HS.auth.onAuthStateChanged(async user => {
    if (user) {
      const profile = await getUserProfile(user.uid);
      if (profile) { window.location.href = getRoleDashboard(profile.role); return; }
    }
    hideLoading();
  });

  let selectedRole = 'citizen';

  // Role selector
  document.querySelectorAll('.role-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.role-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedRole = opt.dataset.role;
    });
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
    });
  });

  // ── LOGIN ──
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email    = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const btn = loginForm.querySelector('.btn');
      if (!email || !password) return showToast('Please fill all fields', 'warning');
      try {
        btn.disabled = true; btn.textContent = 'Signing in…';
        const cred = await HS.auth.signInWithEmailAndPassword(email, password);
        const profile = await getUserProfile(cred.user.uid);
        if (!profile) throw new Error('Profile not found. Contact admin.');
        showToast(`Welcome back, ${profile.name}!`, 'success');
        setTimeout(() => { window.location.href = getRoleDashboard(profile.role); }, 800);
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Sign In';
        showToast(friendlyAuthError(err.code || err.message), 'error');
      }
    });
  }

  // ── REGISTER ──
  const regForm = document.getElementById('register-form');
  if (regForm) {
    regForm.addEventListener('submit', async e => {
      e.preventDefault();
      const name     = document.getElementById('reg-name').value.trim();
      const email    = document.getElementById('reg-email').value.trim();
      const phone    = document.getElementById('reg-phone').value.trim();
      const district = document.getElementById('reg-district').value;
      const password = document.getElementById('reg-password').value;
      const confirm  = document.getElementById('reg-confirm').value;
      const btn = regForm.querySelector('.btn');

      if (!name || !email || !phone || !district || !password) return showToast('Fill all required fields', 'warning');
      if (password !== confirm) return showToast('Passwords do not match', 'error');
      if (password.length < 6) return showToast('Password must be at least 6 characters', 'warning');

      try {
        btn.disabled = true; btn.textContent = 'Creating account…';
        const cred = await HS.auth.createUserWithEmailAndPassword(email, password);
        const collection = selectedRole === 'volunteer' ? 'volunteers' : 'users';
        const profileData = {
          uid: cred.user.uid, name, email, phone, district,
          role: selectedRole === 'volunteer' ? 'volunteer' : 'citizen',
          status: selectedRole === 'volunteer' ? 'pending' : 'active',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await HS.db.collection(collection).doc(cred.user.uid).set(profileData);
        showToast(selectedRole === 'volunteer' ? 'Registration submitted! Await admin approval.' : 'Account created! Welcome!', 'success');
        setTimeout(() => { window.location.href = getRoleDashboard(profileData.role); }, 1000);
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Create Account';
        showToast(friendlyAuthError(err.code || err.message), 'error');
      }
    });
  }

  // ── FORGOT PASSWORD ──
  const forgotBtn = document.getElementById('forgot-btn');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', async () => {
      const email = document.getElementById('login-email').value.trim();
      if (!email) return showToast('Enter your email first', 'warning');
      try {
        await HS.auth.sendPasswordResetEmail(email);
        showToast('Password reset email sent!', 'success');
      } catch (err) { showToast(friendlyAuthError(err.code), 'error'); }
    });
  }
}

// ── Friendly error messages ──
function friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/email-already-in-use': 'Email already registered.',
    'auth/weak-password':        'Password is too weak.',
    'auth/invalid-email':        'Invalid email address.',
    'auth/too-many-requests':    'Too many attempts. Try later.',
    'auth/network-request-failed': 'Network error. Check connection.',
  };
  return map[code] || code || 'An error occurred.';
}
