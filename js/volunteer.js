// ============================================================
// HIMACHAL SURAKSHA - Volunteer Dashboard Logic
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initAuthGuard('volunteer', '../index.html');

  // After auth, load data
  HS.auth.onAuthStateChanged(async user => {
    if (!user) return;
    const profile = await getUserProfile(user.uid);
    if (!profile) return;
    window.volUID = user.uid;
    window.volProfile = profile;

    // Show pending notice if not approved
    if (profile.status === 'pending') {
      document.getElementById('pending-notice')?.classList.remove('hidden');
    }

    // Load lists
    loadSafeZoneList();
    loadRoadList();
    loadUpdateList();
    loadVolMissingList();
    loadVolSOSList();
    loadVolStats(user.uid);
  });

  wireSafeZoneForm();
  wireRoadForm();
  wireCampForm();
  wireUpdateForm();
});

// ── GPS Capture ──
async function captureGPSVol(textId, hiddenId) {
  try {
    showToast('Getting GPS…', 'info', 2000);
    const pos = await getGPS();
    document.getElementById(textId).value = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    if (hiddenId) document.getElementById(hiddenId).value = JSON.stringify({ lat: pos.lat, lng: pos.lng });
    showToast('GPS captured!', 'success');
  } catch (e) { showToast('GPS failed: ' + e, 'error'); }
}

// ── Safe Zone Form ──
function wireSafeZoneForm() {
  const form = document.getElementById('safezone-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm([['sz-name','Name'],['sz-district','District'],['sz-location','Location']])) return;
    const btn = form.querySelector('.btn');
    try {
      btn.disabled = true; btn.textContent = 'Uploading…';
      const gpsRaw = document.getElementById('sz-gps').value;
      await addDoc('safe_zones', {
        name: document.getElementById('sz-name').value.trim(),
        district: document.getElementById('sz-district').value,
        location: document.getElementById('sz-location').value.trim(),
        capacity: document.getElementById('sz-capacity').value,
        notes: document.getElementById('sz-notes').value.trim(),
        gps: gpsRaw ? JSON.parse(gpsRaw) : null,
        uploadedBy: window.volProfile?.name || '',
        uploadedByUID: window.volUID,
        status: 'active'
      });
      showToast('Safe zone uploaded!', 'success');
      form.reset();
      loadSafeZoneList();
    } catch (e) { showToast('Failed: ' + e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '✅ Upload Safe Zone'; }
  });
}

// ── Road Form ──
function wireRoadForm() {
  const form = document.getElementById('road-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm([['rd-name','Road Name'],['rd-district','District'],['rd-reason','Reason'],['rd-location','Location']])) return;
    const btn = form.querySelector('.btn');
    try {
      btn.disabled = true; btn.textContent = 'Submitting…';
      const photoFile = document.getElementById('rd-photo').files[0];
      let photoURL = '';
      if (photoFile) photoURL = await uploadFile(photoFile, 'blocked_roads');
      const gpsRaw = document.getElementById('rd-gps').value;
      await addDoc('blocked_roads', {
        roadName: document.getElementById('rd-name').value.trim(),
        district: document.getElementById('rd-district').value,
        reason: document.getElementById('rd-reason').value,
        location: document.getElementById('rd-location').value.trim(),
        info: document.getElementById('rd-info').value.trim(),
        gps: gpsRaw ? JSON.parse(gpsRaw) : null,
        photoURL,
        uploadedBy: window.volProfile?.name || '',
        uploadedByUID: window.volUID,
        status: 'active'
      });
      showToast('Blocked road reported!', 'success');
      form.reset();
      loadRoadList();
    } catch (e) { showToast('Failed: ' + e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '🚧 Report Blocked Road'; }
  });
}

// ── Camp Form ──
function wireCampForm() {
  const form = document.getElementById('camp-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm([['cp-name','Camp Name'],['cp-district','District'],['cp-capacity','Capacity'],['cp-location','Location'],['cp-contact','Contact']])) return;
    const btn = form.querySelector('.btn');
    try {
      btn.disabled = true; btn.textContent = 'Registering…';
      const gpsRaw = document.getElementById('cp-gps').value;
      await addDoc('relief_camps', {
        name: document.getElementById('cp-name').value.trim(),
        district: document.getElementById('cp-district').value,
        capacity: parseInt(document.getElementById('cp-capacity').value),
        location: document.getElementById('cp-location').value.trim(),
        contact: document.getElementById('cp-contact').value.trim(),
        description: document.getElementById('cp-desc').value.trim(),
        gps: gpsRaw ? JSON.parse(gpsRaw) : null,
        uploadedBy: window.volProfile?.name || '',
        uploadedByUID: window.volUID,
        status: 'active'
      });
      showToast('Relief camp registered!', 'success');
      form.reset();
    } catch (e) { showToast('Failed: ' + e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '⛺ Register Relief Camp'; }
  });
}

// ── Update Form ──
function wireUpdateForm() {
  const form = document.getElementById('update-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm([['upd-title','Title'],['upd-content','Content']])) return;
    const btn = form.querySelector('.btn');
    try {
      btn.disabled = true; btn.textContent = 'Posting…';
      await addDoc('public_updates', {
        title: document.getElementById('upd-title').value.trim(),
        category: document.getElementById('upd-category').value,
        district: document.getElementById('upd-district').value,
        content: document.getElementById('upd-content').value.trim(),
        postedBy: window.volProfile?.name || 'Volunteer',
        postedByUID: window.volUID
      });
      showToast('Update posted!', 'success');
      form.reset();
      loadUpdateList();
    } catch (e) { showToast('Failed: ' + e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '📢 Post Update'; }
  });
}

// ── Load Safe Zones ──
function loadSafeZoneList() {
  const el = document.getElementById('sz-list');
  if (!el) return;
  HS.db.collection('safe_zones').orderBy('createdAt','desc').limit(15)
    .onSnapshot(snap => {
      if (snap.empty) { el.innerHTML = '<p class="text-muted" style="padding:12px;">None uploaded yet.</p>'; return; }
      el.innerHTML = snap.docs.map(d => {
        const z = d.data();
        return `<div class="list-item">
          <div class="item-icon" style="background:var(--safe-glow);">✅</div>
          <div class="item-body">
            <div class="item-title">${z.name}</div>
            <div class="item-sub">📍 ${z.location} • ${z.district} ${z.capacity ? '• Capacity: '+z.capacity : ''}</div>
            <div class="item-sub">By: ${z.uploadedBy} • ${timeAgo(z.createdAt)}</div>
          </div>
          ${z.uploadedByUID === window.volUID ?
            `<button class="btn btn-danger btn-sm btn-icon" onclick="volDeleteItem('safe_zones','${d.id}')">🗑</button>` : ''}
        </div>`;
      }).join('');
    });
}

// ── Load Roads ──
function loadRoadList() {
  const el = document.getElementById('rd-list');
  if (!el) return;
  HS.db.collection('blocked_roads').orderBy('createdAt','desc').limit(15)
    .onSnapshot(snap => {
      if (snap.empty) { el.innerHTML = '<p class="text-muted" style="padding:12px;">None reported.</p>'; return; }
      el.innerHTML = snap.docs.map(d => {
        const r = d.data();
        return `<div class="list-item">
          <div class="item-icon" style="background:var(--alert-glow);">🚧</div>
          <div class="item-body">
            <div class="item-title">${r.roadName}</div>
            <div class="item-sub">Reason: ${r.reason} • ${r.district}</div>
            <div class="item-sub">By: ${r.uploadedBy} • ${timeAgo(r.createdAt)}</div>
          </div>
          ${r.uploadedByUID === window.volUID ?
            `<button class="btn btn-danger btn-sm btn-icon" onclick="volDeleteItem('blocked_roads','${d.id}')">🗑</button>` : ''}
        </div>`;
      }).join('');
    });
}

// ── Load Updates ──
function loadUpdateList() {
  const el = document.getElementById('upd-list');
  if (!el) return;
  HS.db.collection('public_updates').orderBy('createdAt','desc').limit(15)
    .onSnapshot(snap => {
      if (snap.empty) { el.innerHTML = '<p class="text-muted" style="padding:12px;">No updates posted.</p>'; return; }
      el.innerHTML = snap.docs.map(d => {
        const u = d.data();
        return `<div class="list-item">
          <div class="item-icon">📢</div>
          <div class="item-body">
            <div class="item-title">${u.title}</div>
            <div class="item-sub"><span class="badge badge-blue">${u.category}</span> ${u.district || 'All Districts'} • ${timeAgo(u.createdAt)}</div>
            <div class="item-sub" style="margin-top:4px;">${u.content?.substring(0,80)}…</div>
          </div>
          ${u.postedByUID === window.volUID ?
            `<button class="btn btn-danger btn-sm btn-icon" onclick="volDeleteItem('public_updates','${d.id}')">🗑</button>` : ''}
        </div>`;
      }).join('');
    });
}

// ── Vol Missing Persons ──
async function loadVolMissingList() {
  const el = document.getElementById('vol-missing-list');
  if (!el) return;
  try {
    const docs = await getDocs('missing_persons', [['orderBy','createdAt','desc'],['limit',20]]);
    if (!docs.length) { el.innerHTML = '<div class="notice notice-info">No missing person reports.</div>'; return; }
    el.innerHTML = docs.map(d => `
      <div class="card mb-12">
        <div class="flex items-center gap-12">
          ${d.photoURL ? `<img src="${d.photoURL}" style="width:52px;height:52px;border-radius:8px;object-fit:cover;">` : '<div class="item-icon">👤</div>'}
          <div class="flex-1">
            <div style="font-weight:700;">${d.missingName} ${d.age ? `(${d.age})` : ''} ${d.gender ? `• ${d.gender}` : ''}</div>
            <div style="font-size:0.82rem;color:var(--text-muted);">📍 ${d.location || '—'} • ${d.district}</div>
            ${d.description ? `<div style="font-size:0.82rem;color:var(--text-secondary);margin-top:2px;">${d.description}</div>` : ''}
            <div style="font-size:0.8rem;margin-top:4px;">📞 ${d.reporterContact}</div>
          </div>
          ${statusBadge(d.status)}
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = '<p class="text-red">Error loading</p>'; }
}

// ── Vol SOS List ──
async function loadVolSOSList() {
  const el = document.getElementById('vol-sos-list');
  if (!el) return;
  try {
    const docs = await getDocs('sos_requests', [['where','status','==','open'],['orderBy','createdAt','desc'],['limit',20]]);
    if (!docs.length) { el.innerHTML = '<div class="notice notice-success">No open SOS requests.</div>'; return; }
    el.innerHTML = docs.map(d => `
      <div class="alert-banner critical" style="margin-bottom:10px;">
        <span class="alert-icon">🆘</span>
        <div class="alert-content">
          <div class="alert-title">${d.name} — ${d.type}</div>
          <div class="alert-body">${d.description || 'Emergency assistance needed'}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);">📍 ${d.district} • 👥 ${d.people || 1} persons • 📞 ${d.phone}</div>
          ${d.location ? `<div style="font-size:0.78rem;color:var(--text-muted);">🗺 ${d.location}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:0.7rem;color:var(--text-muted);">${timeAgo(d.createdAt)}</div>
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = '<p class="text-red">Error loading SOS</p>'; }
}

// ── Vol Stats ──
async function loadVolStats(uid) {
  const cols = ['safe_zones','blocked_roads','relief_camps','public_updates'];
  const ids = ['vs-safezones','vs-roads','vs-camps','vs-updates'];
  for (let i = 0; i < cols.length; i++) {
    try {
      const snap = await HS.db.collection(cols[i]).where('uploadedByUID','==',uid).get().catch(() =>
        HS.db.collection(cols[i]).where('postedByUID','==',uid).get()
      );
      const el = document.getElementById(ids[i]);
      if (el) el.textContent = snap?.size || 0;
    } catch (e) { /* silently fail */ }
  }
}

// ── Delete item ──
async function volDeleteItem(collection, id) {
  if (!confirmAction('Delete this record?')) return;
  try {
    await deleteDoc(collection, id);
    showToast('Deleted successfully', 'success');
  } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
}

function updateBN(btn) {
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
