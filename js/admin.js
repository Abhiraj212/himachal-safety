// ============================================================
// HIMACHAL SURAKSHA - Admin Dashboard Logic
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initAuthGuard('admin', '../index.html');

  HS.auth.onAuthStateChanged(async user => {
    if (!user) return;
    window.adminUID = user.uid;
    window.adminProfile = await getUserProfile(user.uid);

    refreshDashboard();
    wireForms();
  });
});

// ── Refresh Dashboard Stats ──
async function refreshDashboard() {
  const counts = [
    ['sos_requests',   [['where','status','==','open']],                'ds-sos'],
    ['alerts',         [['where','status','==','active']],              'ds-alerts'],
    ['incidents',      [],                                              'ds-incidents'],
    ['missing_persons',[],                                              'ds-missing'],
    ['relief_camps',   [['where','status','==','active']],              'ds-camps'],
    ['users',          [],                                              'ds-citizens'],
    ['volunteers',     [],                                              'ds-vols'],
    ['resources',      [],                                              'ds-resources'],
  ];

  for (const [col, constraints, elId] of counts) {
    try {
      let ref = HS.db.collection(col);
      constraints.forEach(c => { ref = ref[c[0]](...c.slice(1)); });
      const snap = await ref.get();
      const el = document.getElementById(elId);
      if (el) el.textContent = snap.size;
    } catch (e) {
      const el = document.getElementById(elId);
      if (el) el.textContent = '—';
    }
  }

  loadDashSOS();
  loadDashIncidents();
}

// ── Dashboard Quick Lists ──
async function loadDashSOS() {
  const el = document.getElementById('dash-sos-list');
  if (!el) return;
  try {
    const docs = await getDocs('sos_requests', [['where','status','==','open'],['orderBy','createdAt','desc'],['limit',4]]);
    if (!docs.length) { el.innerHTML = '<p class="text-muted" style="padding:10px;font-size:0.85rem;">No open SOS.</p>'; return; }
    el.innerHTML = docs.map(d => `
      <div class="list-item">
        <div class="item-icon" style="background:var(--sos-red-glow);">🆘</div>
        <div class="item-body">
          <div class="item-title">${d.name} — ${d.type}</div>
          <div class="item-sub">📍 ${d.district} • 📞 ${d.phone} • ${timeAgo(d.createdAt)}</div>
        </div>
        <button class="btn btn-success btn-sm" onclick="updateSOSStatus('${d.id}','resolved')">✔ Resolve</button>
      </div>`).join('');
  } catch (e) { el.innerHTML = '<p class="text-red" style="padding:10px;">Error loading</p>'; }
}

async function loadDashIncidents() {
  const el = document.getElementById('dash-inc-list');
  if (!el) return;
  try {
    const docs = await getDocs('incidents', [['where','status','==','pending'],['orderBy','createdAt','desc'],['limit',4]]);
    if (!docs.length) { el.innerHTML = '<p class="text-muted" style="padding:10px;font-size:0.85rem;">No pending incidents.</p>'; return; }
    el.innerHTML = docs.map(d => `
      <div class="list-item">
        <div class="item-icon">📋</div>
        <div class="item-body">
          <div class="item-title">${d.title}</div>
          <div class="item-sub">${d.type} • ${d.district} • ${timeAgo(d.createdAt)}</div>
        </div>
        <div class="flex gap-8" style="flex-shrink:0;">
          <button class="btn btn-success btn-sm" onclick="updateIncidentStatus('${d.id}','approved')">✔</button>
          <button class="btn btn-danger btn-sm" onclick="updateIncidentStatus('${d.id}','rejected')">✖</button>
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = '<p class="text-red" style="padding:10px;">Error loading</p>'; }
}

// ── Wire All Forms ──
function wireForms() {
  wireQuickAlertForm();
  wireAlertForm();
  wireResourceForm();
  wireCampAdminForm();
  wireAddAdminForm();
}

// ── Quick Alert Form (dashboard) ──
function wireQuickAlertForm() {
  const form = document.getElementById('quick-alert-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm([['qa-title','Title'],['qa-msg','Message']])) return;
    const btn = form.querySelector('.btn');
    try {
      btn.disabled = true; btn.textContent = 'Broadcasting…';
      await addDoc('alerts', {
        title: document.getElementById('qa-title').value.trim(),
        severity: document.getElementById('qa-severity').value,
        district: document.getElementById('qa-district').value,
        type: document.getElementById('qa-type').value,
        message: document.getElementById('qa-msg').value.trim(),
        createdBy: window.adminProfile?.name || 'Admin',
        createdByUID: window.adminUID,
        status: 'active'
      });
      showToast('🚨 Alert broadcasted!', 'success');
      form.reset();
      refreshDashboard();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '🚨 Broadcast Alert';
    }
  });
}

// ── Alert Modal Form ──
function wireAlertForm() {
  const form = document.getElementById('alert-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm([['al-title','Title'],['al-msg','Message']])) return;
    const btn = form.querySelector('.btn');
    try {
      btn.disabled = true;
      await addDoc('alerts', {
        title: document.getElementById('al-title').value.trim(),
        severity: document.getElementById('al-severity').value,
        district: document.getElementById('al-district').value,
        message: document.getElementById('al-msg').value.trim(),
        createdBy: window.adminProfile?.name || 'Admin',
        createdByUID: window.adminUID,
        status: 'active'
      });
      showToast('Alert created!', 'success');
      closeModal('alert-modal');
      form.reset();
      loadAdminAlerts();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    } finally { btn.disabled = false; }
  });
}

// ── Resource Form ──
function wireResourceForm() {
  const form = document.getElementById('resource-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm([['rs-name','Name'],['rs-type','Type'],['rs-contact','Contact'],['rs-location','Location']])) return;
    const btn = form.querySelector('.btn');
    try {
      btn.disabled = true;
      await addDoc('resources', {
        name: document.getElementById('rs-name').value.trim(),
        type: document.getElementById('rs-type').value,
        status: document.getElementById('rs-status').value,
        contact: document.getElementById('rs-contact').value.trim(),
        location: document.getElementById('rs-location').value.trim(),
        district: document.getElementById('rs-district').value,
        notes: document.getElementById('rs-notes').value.trim(),
        addedBy: window.adminProfile?.name || 'Admin',
        addedByUID: window.adminUID
      });
      showToast('Resource added!', 'success');
      closeModal('resource-modal');
      form.reset();
      loadAdminResources();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    } finally { btn.disabled = false; }
  });
}

// ── Camp Admin Form ──
function wireCampAdminForm() {
  const form = document.getElementById('camp-admin-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm([['ca-name','Name'],['ca-district','District'],['ca-location','Location']])) return;
    const btn = form.querySelector('.btn');
    try {
      btn.disabled = true;
      await addDoc('relief_camps', {
        name: document.getElementById('ca-name').value.trim(),
        district: document.getElementById('ca-district').value,
        capacity: parseInt(document.getElementById('ca-capacity').value) || 0,
        location: document.getElementById('ca-location').value.trim(),
        contact: document.getElementById('ca-contact').value.trim(),
        description: document.getElementById('ca-desc').value.trim(),
        uploadedBy: window.adminProfile?.name || 'Admin',
        uploadedByUID: window.adminUID,
        status: 'active'
      });
      showToast('Relief camp added!', 'success');
      closeModal('camp-admin-modal');
      form.reset();
      loadAdminCamps();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    } finally { btn.disabled = false; }
  });
}

// ── Add Admin Form ──
function wireAddAdminForm() {
  const form = document.getElementById('add-admin-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm([['adm-name','Name'],['adm-email','Email'],['adm-pass','Password']])) return;
    const pass = document.getElementById('adm-pass').value;
    if (pass.length < 8) return showToast('Password must be at least 8 characters', 'warning');

    const btn = form.querySelector('.btn');
    try {
      btn.disabled = true; btn.textContent = 'Creating…';
      // Create secondary auth user (Note: this logs out current admin in web SDK)
      // In production, use Firebase Admin SDK via Cloud Functions
      // For now, store admin data with a flag and show instructions
      const name  = document.getElementById('adm-name').value.trim();
      const email = document.getElementById('adm-email').value.trim();
      const phone = document.getElementById('adm-phone').value.trim();

      // Save admin record (creation via Cloud Function recommended in production)
      const docId = 'pending_' + Date.now();
      await HS.db.collection('admins').doc(docId).set({
        name, email, phone, role: 'admin',
        status: 'pending_creation',
        addedBy: window.adminProfile?.name || 'Admin',
        addedByUID: window.adminUID,
        note: 'Have this person register via the app and then promote them manually in Firestore.',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast(`Admin record saved. Have ${name} register via the app, then update their role in Firestore to "admin".`, 'success', 8000);
      closeModal('add-admin-modal');
      form.reset();
      loadAdminAdmins();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    } finally { btn.disabled = false; btn.textContent = '🔑 Create Admin Account'; }
  });
}

// ══════════════════════════════════════════════
// ── LOAD FUNCTIONS ──
// ══════════════════════════════════════════════

// ── SOS Management ──
async function loadAdminSOS() {
  const el = document.getElementById('admin-sos-list');
  if (!el) return;
  el.innerHTML = '<div class="loading-text" style="padding:20px;">Loading…</div>';
  try {
    const filter = document.getElementById('sos-filter')?.value;
    let constraints = [['orderBy','createdAt','desc'],['limit',30]];
    if (filter) constraints.unshift(['where','status','==',filter]);
    const docs = await getDocs('sos_requests', constraints);

    if (!docs.length) { el.innerHTML = '<div class="notice notice-success">No SOS requests found.</div>'; return; }
    el.innerHTML = docs.map(d => `
      <div class="card mb-12" style="border-left: 3px solid var(--sos-red);">
        <div class="flex items-center justify-between flex-wrap gap-12">
          <div>
            <div class="flex items-center gap-8 mb-4">
              <span style="font-weight:700;font-size:1rem;">🆘 ${d.name}</span>
              ${statusBadge(d.status)}
              <span class="badge badge-red">${d.type || 'Emergency'}</span>
            </div>
            <div style="font-size:0.82rem;color:var(--text-secondary);">
              📞 ${d.phone} &nbsp;|&nbsp; 📍 ${d.district} &nbsp;|&nbsp; 👥 ${d.people || 1} persons &nbsp;|&nbsp; 🕐 ${timeAgo(d.createdAt)}
            </div>
            ${d.location ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:3px;">🗺 ${d.location}</div>` : ''}
            ${d.description ? `<div style="font-size:0.85rem;color:var(--text-secondary);margin-top:6px;">${d.description}</div>` : ''}
          </div>
          <div class="flex gap-8 flex-wrap">
            <button class="btn btn-outline btn-sm" onclick="updateSOSStatus('${d.id}','in_progress')">⚡ In Progress</button>
            <button class="btn btn-success btn-sm" onclick="updateSOSStatus('${d.id}','resolved')">✔ Resolve</button>
            <button class="btn btn-danger btn-sm" onclick="adminDelete('sos_requests','${d.id}',loadAdminSOS)">🗑</button>
          </div>
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = `<div class="notice notice-error">Error: ${e.message}</div>`; }
}

async function updateSOSStatus(id, status) {
  try {
    await updateDoc('sos_requests', id, { status });
    showToast(`SOS marked as ${status}`, 'success');
    loadAdminSOS();
    loadDashSOS();
    refreshDashboard();
  } catch (e) { showToast('Update failed: ' + e.message, 'error'); }
}

// ── Alerts Management ──
async function loadAdminAlerts() {
  const el = document.getElementById('admin-alerts-list');
  if (!el) return;
  el.innerHTML = '<div class="loading-text" style="padding:20px;">Loading…</div>';
  try {
    const docs = await getDocs('alerts', [['orderBy','createdAt','desc'],['limit',30]]);
    if (!docs.length) { el.innerHTML = '<div class="notice notice-info">No alerts.</div>'; return; }
    el.innerHTML = docs.map(d => `
      <div class="alert-banner ${d.severity?.toLowerCase() || 'medium'}" style="margin-bottom:10px;">
        <span class="alert-icon">${severityIconAdmin(d.severity)}</span>
        <div class="alert-content">
          <div class="alert-title">${d.title}</div>
          <div class="alert-body">${d.message}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">
            📍 ${d.district || 'All Districts'} &nbsp;|&nbsp; By: ${d.createdBy || 'Admin'} &nbsp;|&nbsp; ${timeAgo(d.createdAt)}
          </div>
        </div>
        <div class="flex flex-col gap-8" style="flex-shrink:0;">
          ${statusBadge(d.status)}
          <button class="btn btn-sm ${d.status==='active' ? 'btn-ghost' : 'btn-success'}"
            onclick="toggleAlertStatus('${d.id}','${d.status}')">
            ${d.status === 'active' ? '⏸ Deactivate' : '▶ Activate'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="adminDelete('alerts','${d.id}',loadAdminAlerts)">🗑</button>
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = `<div class="notice notice-error">Error: ${e.message}</div>`; }
}

async function toggleAlertStatus(id, current) {
  const next = current === 'active' ? 'inactive' : 'active';
  try {
    await updateDoc('alerts', id, { status: next });
    showToast(`Alert ${next}`, 'success');
    loadAdminAlerts();
  } catch (e) { showToast('Failed: ' + e.message, 'error'); }
}

// ── Incidents Management ──
async function loadAdminIncidents() {
  const el = document.getElementById('admin-incidents-list');
  if (!el) return;
  el.innerHTML = '<div class="loading-text" style="padding:20px;">Loading…</div>';
  try {
    const filter = document.getElementById('inc-filter')?.value;
    let constraints = [['orderBy','createdAt','desc'],['limit',30]];
    if (filter) constraints.unshift(['where','status','==',filter]);
    const docs = await getDocs('incidents', constraints);

    if (!docs.length) { el.innerHTML = '<div class="notice notice-info">No incidents found.</div>'; return; }
    el.innerHTML = docs.map(d => `
      <div class="card mb-12">
        <div class="flex items-center justify-between flex-wrap gap-12">
          <div class="flex-1">
            <div class="flex items-center gap-8 mb-6">
              <span style="font-weight:700;">${d.title}</span>
              ${statusBadge(d.status)}
              <span class="badge badge-${severityColor(d.severity)}">${d.severity || ''}</span>
            </div>
            <div style="font-size:0.82rem;color:var(--text-secondary);">
              ${d.type} &nbsp;|&nbsp; 📍 ${d.district} &nbsp;|&nbsp; By: ${d.reporterName || 'Citizen'} &nbsp;|&nbsp; ${timeAgo(d.createdAt)}
            </div>
            ${d.location ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">🗺 ${d.location}</div>` : ''}
            <p style="font-size:0.85rem;margin-top:8px;">${d.description}</p>
            ${d.photoURL ? `<img src="${d.photoURL}" style="max-width:200px;border-radius:8px;margin-top:8px;cursor:pointer;" onclick="window.open('${d.photoURL}')">` : ''}
          </div>
          <div class="flex flex-col gap-8" style="flex-shrink:0;">
            <button class="btn btn-success btn-sm" onclick="updateIncidentStatus('${d.id}','approved')">✔ Approve</button>
            <button class="btn btn-danger btn-sm" onclick="updateIncidentStatus('${d.id}','rejected')">✖ Reject</button>
            <button class="btn btn-ghost btn-sm" onclick="adminDelete('incidents','${d.id}',loadAdminIncidents)">🗑 Delete</button>
          </div>
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = `<div class="notice notice-error">Error: ${e.message}</div>`; }
}

async function updateIncidentStatus(id, status) {
  try {
    await updateDoc('incidents', id, { status, reviewedBy: window.adminUID, reviewedAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast(`Incident ${status}`, 'success');
    loadAdminIncidents();
    loadDashIncidents();
  } catch (e) { showToast('Failed: ' + e.message, 'error'); }
}

// ── Missing Persons Management ──
async function loadAdminMissing() {
  const el = document.getElementById('admin-missing-list');
  if (!el) return;
  el.innerHTML = '<div class="loading-text" style="padding:20px;">Loading…</div>';
  try {
    const docs = await getDocs('missing_persons', [['orderBy','createdAt','desc'],['limit',30]]);
    if (!docs.length) { el.innerHTML = '<div class="notice notice-info">No missing person reports.</div>'; return; }
    el.innerHTML = docs.map(d => `
      <div class="card mb-12">
        <div class="flex gap-12 items-center flex-wrap">
          ${d.photoURL ? `<img src="${d.photoURL}" style="width:60px;height:60px;border-radius:10px;object-fit:cover;flex-shrink:0;" onclick="window.open('${d.photoURL}')">` : '<div style="width:60px;height:60px;border-radius:10px;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">👤</div>'}
          <div class="flex-1">
            <div style="font-weight:700;font-size:1.05rem;">${d.missingName} ${d.age ? `(Age: ${d.age})` : ''} ${d.gender ? `• ${d.gender}` : ''}</div>
            <div style="font-size:0.82rem;color:var(--text-muted);">Last seen: ${d.location || 'Unknown'} • ${d.district}</div>
            ${d.description ? `<p style="font-size:0.85rem;margin-top:4px;">${d.description}</p>` : ''}
            <div style="font-size:0.82rem;margin-top:4px;">📞 Reporter: ${d.reporterContact} (${d.reporterName || ''})</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Reported: ${timeAgo(d.createdAt)}</div>
          </div>
          <div class="flex flex-col gap-8" style="flex-shrink:0;">
            ${statusBadge(d.status)}
            <button class="btn btn-success btn-sm" onclick="updateMissingStatus('${d.id}','found')">✔ Found</button>
            <button class="btn btn-ghost btn-sm" onclick="updateMissingStatus('${d.id}','closed')">✖ Close</button>
            <button class="btn btn-danger btn-sm" onclick="adminDelete('missing_persons','${d.id}',loadAdminMissing)">🗑</button>
          </div>
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = `<div class="notice notice-error">Error: ${e.message}</div>`; }
}

async function updateMissingStatus(id, status) {
  try {
    await updateDoc('missing_persons', id, { status });
    showToast(`Status updated to ${status}`, 'success');
    loadAdminMissing();
  } catch (e) { showToast('Failed: ' + e.message, 'error'); }
}

// ── Camps Management ──
async function loadAdminCamps() {
  const el = document.getElementById('admin-camps-list');
  if (!el) return;
  el.innerHTML = '<div class="loading-text" style="padding:20px;">Loading…</div>';
  try {
    const docs = await getDocs('relief_camps', [['orderBy','createdAt','desc'],['limit',30]]);
    if (!docs.length) { el.innerHTML = '<div class="notice notice-info">No relief camps registered.</div>'; return; }
    el.innerHTML = `<div class="resource-grid">${docs.map(d => `
      <div class="resource-card">
        <div class="rc-type">Relief Camp</div>
        <div class="rc-name">⛺ ${d.name}</div>
        <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:8px;">📍 ${d.location}<br>🏔 ${d.district}</div>
        ${d.capacity ? `<div style="font-size:0.88rem;margin-bottom:4px;">👥 Capacity: <strong>${d.capacity}</strong></div>` : ''}
        ${d.contact ? `<div style="font-size:0.85rem;margin-bottom:4px;">📞 ${d.contact}</div>` : ''}
        ${d.description ? `<div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px;">${d.description}</div>` : ''}
        <div class="flex items-center justify-between mt-8">
          ${statusBadge(d.status)}
          <div class="flex gap-6">
            <button class="btn btn-ghost btn-sm" onclick="toggleCampStatus('${d.id}','${d.status}')">
              ${d.status === 'active' ? '⏸' : '▶'}
            </button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="adminDelete('relief_camps','${d.id}',loadAdminCamps)">🗑</button>
          </div>
        </div>
      </div>`).join('')}</div>`;
  } catch (e) { el.innerHTML = `<div class="notice notice-error">Error: ${e.message}</div>`; }
}

async function toggleCampStatus(id, current) {
  const next = current === 'active' ? 'inactive' : 'active';
  try {
    await updateDoc('relief_camps', id, { status: next });
    showToast(`Camp ${next}`, 'success');
    loadAdminCamps();
  } catch (e) { showToast('Failed', 'error'); }
}

// ── Resources Management ──
let allResources = [];

async function loadAdminResources() {
  const el = document.getElementById('admin-resources-list');
  if (!el) return;
  el.innerHTML = '<div class="loading-text" style="padding:20px;">Loading…</div>';
  try {
    allResources = await getDocs('resources', [['orderBy','createdAt','desc']]);
    renderResources(allResources);
  } catch (e) { el.innerHTML = `<div class="notice notice-error">Error: ${e.message}</div>`; }
}

function renderResources(docs) {
  const el = document.getElementById('admin-resources-list');
  if (!el) return;
  if (!docs.length) { el.innerHTML = '<div class="notice notice-info">No resources added.</div>'; return; }

  const statusColors = { Available: 'green', Busy: 'orange', Deployed: 'blue' };
  const typeIcons = {
    'Ambulance':'🚑','Fire Vehicle':'🚒','JCB':'🚜','Helicopter':'🚁',
    'Food Stock':'🥫','Medicine Stock':'💊','Rescue Boat':'⛵','Police Vehicle':'🚔','Other':'📦'
  };

  el.innerHTML = docs.map(d => `
    <div class="resource-card">
      <div class="rc-type">${typeIcons[d.type] || '📦'} ${d.type}</div>
      <div class="rc-name">${d.name}</div>
      <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:6px;">
        📍 ${d.location || '—'}<br>🏔 ${d.district || '—'}
      </div>
      <div style="font-size:0.85rem;margin-bottom:4px;">📞 ${d.contact || '—'}</div>
      ${d.notes ? `<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">${d.notes}</div>` : ''}
      <div class="flex items-center justify-between mt-8">
        <select class="form-control" style="width:auto;font-size:0.8rem;padding:4px 8px;"
          onchange="updateResourceStatus('${d.id}',this.value)">
          <option ${d.status==='Available'?'selected':''}>Available</option>
          <option ${d.status==='Busy'?'selected':''}>Busy</option>
          <option ${d.status==='Deployed'?'selected':''}>Deployed</option>
        </select>
        <button class="btn btn-danger btn-sm btn-icon" onclick="adminDelete('resources','${d.id}',loadAdminResources)">🗑</button>
      </div>
    </div>`).join('');
}

function filterResources(type, btn) {
  document.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const filtered = type ? allResources.filter(r => r.type === type) : allResources;
  renderResources(filtered);
}

async function updateResourceStatus(id, status) {
  try {
    await updateDoc('resources', id, { status });
    showToast(`Status → ${status}`, 'success');
    loadAdminResources();
  } catch (e) { showToast('Failed', 'error'); }
}

// ── Citizens Management ──
async function loadAdminCitizens() {
  const tbody = document.getElementById('citizens-tbody');
  const countEl = document.getElementById('citizens-count');
  if (!tbody) return;
  try {
    const docs = await getDocs('users', [['orderBy','createdAt','desc']]);
    if (countEl) countEl.textContent = `Total: ${docs.length}`;
    if (!docs.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">No citizens registered.</td></tr>'; return; }
    tbody.innerHTML = docs.map(d => `
      <tr>
        <td style="font-weight:600;">${d.name || '—'}</td>
        <td style="color:var(--text-muted);">${d.email || '—'}</td>
        <td>${d.phone || '—'}</td>
        <td>${d.district || '—'}</td>
        <td>${statusBadge(d.status || 'active')}</td>
        <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);">${formatDate(d.createdAt)}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="adminDeleteUser('users','${d.id}',loadAdminCitizens)">🗑</button>
        </td>
      </tr>`).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="7" style="color:var(--sos-red);padding:12px;">${e.message}</td></tr>`; }
}

// ── Volunteers Management ──
async function loadAdminVolunteers() {
  const tbody = document.getElementById('volunteers-tbody');
  if (!tbody) return;
  try {
    const filter = document.getElementById('vol-status-filter')?.value;
    let constraints = [['orderBy','createdAt','desc']];
    if (filter) constraints.unshift(['where','status','==',filter]);
    const docs = await getDocs('volunteers', constraints);

    if (!docs.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">No volunteers.</td></tr>'; return; }
    tbody.innerHTML = docs.map(d => `
      <tr>
        <td style="font-weight:600;">${d.name || '—'}</td>
        <td style="color:var(--text-muted);">${d.email || '—'}</td>
        <td>${d.phone || '—'}</td>
        <td>${d.district || '—'}</td>
        <td>${statusBadge(d.status)}</td>
        <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);">${formatDate(d.createdAt)}</td>
        <td class="flex gap-6">
          ${d.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="approveVolunteer('${d.id}')">✔ Approve</button>` : ''}
          ${d.status === 'active'  ? `<button class="btn btn-ghost btn-sm" onclick="suspendVolunteer('${d.id}')">⏸ Suspend</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="adminDeleteUser('volunteers','${d.id}',loadAdminVolunteers)">🗑</button>
        </td>
      </tr>`).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="7" style="color:var(--sos-red);padding:12px;">${e.message}</td></tr>`; }
}

async function approveVolunteer(id) {
  try {
    await updateDoc('volunteers', id, { status: 'active', approvedBy: window.adminUID, approvedAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('Volunteer approved!', 'success');
    loadAdminVolunteers();
    refreshDashboard();
  } catch (e) { showToast('Failed: ' + e.message, 'error'); }
}

async function suspendVolunteer(id) {
  if (!confirmAction('Suspend this volunteer?')) return;
  try {
    await updateDoc('volunteers', id, { status: 'suspended' });
    showToast('Volunteer suspended', 'warning');
    loadAdminVolunteers();
  } catch (e) { showToast('Failed: ' + e.message, 'error'); }
}

// ── Admin Accounts ──
async function loadAdminAdmins() {
  const tbody = document.getElementById('admins-tbody');
  if (!tbody) return;
  try {
    const docs = await getDocs('admins', [['orderBy','createdAt','desc']]);
    if (!docs.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted);">No admin records.</td></tr>'; return; }
    tbody.innerHTML = docs.map(d => `
      <tr>
        <td style="font-weight:600;">${d.name || '—'}</td>
        <td style="color:var(--text-muted);">${d.email || '—'}</td>
        <td>${d.addedBy || '—'}</td>
        <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);">${formatDate(d.createdAt)}</td>
        <td>
          ${d.id !== window.adminUID ?
            `<button class="btn btn-danger btn-sm" onclick="adminDelete('admins','${d.id}',loadAdminAdmins)">🗑</button>` :
            '<span class="badge badge-green">YOU</span>'}
        </td>
      </tr>`).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="5" style="color:var(--sos-red);padding:12px;">${e.message}</td></tr>`; }
}

// ── Delete helpers ──
async function adminDelete(collection, id, reloadFn) {
  if (!confirmAction('Delete this record permanently?')) return;
  try {
    await deleteDoc(collection, id);
    showToast('Deleted', 'success');
    if (reloadFn) reloadFn();
    refreshDashboard();
  } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
}

async function adminDeleteUser(collection, id, reloadFn) {
  if (!confirmAction('Delete this user record? Note: Firebase Auth account must be deleted separately from Firebase Console.')) return;
  try {
    await deleteDoc(collection, id);
    showToast('User record deleted', 'success');
    if (reloadFn) reloadFn();
    refreshDashboard();
  } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
}

// ══════════════════════════════════════════════
// ── AI ASSISTANT (Mock + Gemini-ready) ──
// ══════════════════════════════════════════════

const AI_MOCK_RESPONSES = {
  'flood': `🌊 **Flash Flood Response Protocol:**\n\n1. Issue immediate evacuation alerts for low-lying areas\n2. Deploy NDRF teams to affected zones\n3. Activate all relief camps — priority: women, children, elderly\n4. Contact BBMB and check dam release schedules\n5. Block all vulnerable road segments\n6. Coordinate with IAF for helicopter rescue if needed\n7. Open emergency control room: 1077`,
  'landslide': `⛰️ **Landslide Response Protocol:**\n\n1. Cordon off affected area immediately — 500m radius\n2. Deploy JCBs for debris clearance — ETA assessment\n3. Search & Rescue teams with thermal imaging\n4. Identify alternate routes for traffic diversion\n5. Check stability of adjacent slopes\n6. Restore utility lines: power, water, communications\n7. Contact HPSDMA for additional resources`,
  'camp': `⛺ **Relief Camp Capacity Formula:**\n\nFor 10,000 displaced persons:\n• Minimum 10 camps × 1,000 capacity each\n• Space per person: 3.5 sq meters minimum\n• Sanitation: 1 toilet per 20 persons\n• Medical: 1 doctor per 500 persons\n• Food: 3 meals + 2 snacks daily\n• Water: 15 liters per person per day\n• Blankets, tarpaulins, hygiene kits per family`,
  'earthquake': `🏔️ **Earthquake Response Protocol:**\n\n1. Activate EOC immediately — assess magnitude\n2. Deploy SDRF within 2 hours of event\n3. Check dams, bridges, critical infrastructure\n4. Issue aftershock warnings to public\n5. Identify collapsed structures — USAR teams\n6. Hospital surge capacity activation\n7. Coordinate with Army if M > 6.0\n8. Establish family reunification center`,
  'resources': `🚑 **Landslide Rescue Resource Requirements:**\n\n**Immediate (0-2 hrs):**\n• 2-3 JCBs with operators\n• 2 Ambulances + paramedics\n• Police force: min 20 personnel\n• Rescue team: 15-20 trained members\n\n**Secondary (2-6 hrs):**\n• Helicopter (if road blocked)\n• Food & water for 200 persons\n• Medical supplies — trauma kit\n• Generators + floodlights\n• Communication equipment`,
  'default': `🛡️ I am SURAKSHA AI, trained for Himachal Pradesh disaster management.\n\nI can help with:\n• **Disaster response protocols** (flood, landslide, earthquake)\n• **Resource calculation** (camps, supplies, personnel)\n• **Evacuation planning** and route optimization\n• **Relief camp management** best practices\n• **Inter-agency coordination** guidelines\n\nPlease ask a specific question about disaster management operations.`
};

function getAIResponse(msg) {
  const lower = msg.toLowerCase();
  if (lower.includes('flood') || lower.includes('flash')) return AI_MOCK_RESPONSES['flood'];
  if (lower.includes('landslide') || lower.includes('slide')) return AI_MOCK_RESPONSES['landslide'];
  if (lower.includes('camp') || lower.includes('10,000') || lower.includes('displaced')) return AI_MOCK_RESPONSES['camp'];
  if (lower.includes('earthquake') || lower.includes('seismic')) return AI_MOCK_RESPONSES['earthquake'];
  if (lower.includes('resource') || lower.includes('ambulance') || lower.includes('jcb')) return AI_MOCK_RESPONSES['resources'];
  return AI_MOCK_RESPONSES['default'];
}

function aiQuick(msg) {
  document.getElementById('ai-input').value = msg;
  sendAIMsg();
}

function sendAIMsg() {
  const input = document.getElementById('ai-input');
  const window_el = document.getElementById('ai-chat-window');
  if (!input || !window_el) return;
  const msg = input.value.trim();
  if (!msg) return;

  // User bubble
  window_el.innerHTML += `<div class="chat-bubble user">${msg}</div>`;
  input.value = '';

  // Typing indicator
  const typingId = 'typing-' + Date.now();
  window_el.innerHTML += `<div class="chat-bubble bot chat-typing" id="${typingId}">
    <div class="typing-dots"><span></span><span></span><span></span></div>
  </div>`;
  window_el.scrollTop = window_el.scrollHeight;

  // Simulate API delay then respond
  setTimeout(() => {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    const response = getAIResponse(msg);
    // Format markdown-style bold
    const formatted = response.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    window_el.innerHTML += `<div class="chat-bubble bot">${formatted}</div>`;
    window_el.scrollTop = window_el.scrollHeight;
  }, 1200 + Math.random() * 800);
}

// ── Helpers ──
function severityIconAdmin(s) {
  const m = { Critical:'🔴', High:'🟠', Medium:'🟡', Low:'🔵' };
  return m[s] || '⚪';
}

function updateAdminBN(btn) {
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
