// ============================================================
// HIMACHAL SURAKSHA - Citizen Dashboard Logic
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Guard: only citizens
  initAuthGuard('citizen', '../index.html');

  // Load public data
  loadAlerts();
  loadCamps();
  loadSafeZones();
  loadBlockedRoads();
  loadPublicUpdates();

  // Wire forms
  wireSOSForm();
  wireIncidentForm();
  wireMissingForm();

  // Prefill name/phone if available after auth
  HS.auth.onAuthStateChanged(async user => {
    if (!user) return;
    const profile = await getUserProfile(user.uid);
    if (!profile) return;
    const n = document.getElementById('sos-name');
    const p = document.getElementById('sos-phone');
    if (n && profile.name) n.value = profile.name;
    if (p && profile.phone) p.value = profile.phone;
    // Load my incidents
    loadMyIncidents(user.uid);
  });
});

// ── GPS Capture ──
async function captureGPS(textFieldId, hiddenFieldId) {
  const statusEl = document.getElementById(textFieldId + '-status') || document.getElementById('sos-gps-status');
  try {
    if (statusEl) statusEl.textContent = '📍 Getting location…';
    const pos = await getGPS();
    const text = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} (±${Math.round(pos.accuracy)}m)`;
    document.getElementById(textFieldId).value = text;
    if (hiddenFieldId) document.getElementById(hiddenFieldId).value = JSON.stringify({ lat: pos.lat, lng: pos.lng });
    if (statusEl) statusEl.textContent = '✅ Location captured';
    showToast('GPS location captured!', 'success');
  } catch (e) {
    if (statusEl) statusEl.textContent = '❌ GPS failed: ' + e;
    showToast('Could not get GPS: ' + e, 'error');
  }
}

// ── Quick SOS (one-tap) ──
async function handleQuickSOS() {
  const btn = document.getElementById('sos-quick-btn');
  if (!window.currentUser) return showToast('Please log in first', 'error');
  if (!confirmAction('🆘 Send emergency SOS with your current location?')) return;
  try {
    btn.style.opacity = '0.6';
    const pos = await getGPS();
    const profile = window.currentUser.profile;
    await addDoc('sos_requests', {
      uid: window.currentUser.uid,
      name: profile.name || 'Unknown',
      phone: profile.phone || '',
      type: 'Quick SOS',
      description: 'Quick SOS triggered from app',
      location: `${pos.lat}, ${pos.lng}`,
      gps: { lat: pos.lat, lng: pos.lng },
      district: profile.district || '',
      people: 1,
      status: 'open',
      priority: 'critical'
    });
    showToast('🆘 SOS sent! Emergency services alerted.', 'success', 6000);
  } catch (e) {
    showToast('SOS failed: ' + e, 'error');
  } finally {
    btn.style.opacity = '1';
  }
}

// ── SOS Form ──
function wireSOSForm() {
  const form = document.getElementById('sos-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('.btn');
    if (!validateForm([['sos-name','Name'],['sos-phone','Phone'],['sos-type','Emergency Type'],['sos-district','District']])) return;
    try {
      btn.disabled = true; btn.textContent = 'Sending SOS…';
      const gpsRaw = document.getElementById('sos-gps-data').value;
      const gps = gpsRaw ? JSON.parse(gpsRaw) : null;
      await addDoc('sos_requests', {
        uid: window.currentUser?.uid || 'anonymous',
        name: document.getElementById('sos-name').value.trim(),
        phone: document.getElementById('sos-phone').value.trim(),
        type: document.getElementById('sos-type').value,
        description: document.getElementById('sos-desc').value.trim(),
        people: parseInt(document.getElementById('sos-people').value) || 1,
        location: document.getElementById('sos-location-text').value.trim(),
        gps, district: document.getElementById('sos-district').value,
        status: 'open', priority: 'critical'
      });
      showToast('🆘 SOS sent! Help is on the way.', 'success', 6000);
      form.reset();
    } catch (err) {
      showToast('Failed to send SOS: ' + err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '🆘 SEND EMERGENCY SOS';
    }
  });
}

// ── Incident Form ──
function wireIncidentForm() {
  const form = document.getElementById('incident-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('.btn');
    if (!validateForm([['inc-title','Title'],['inc-type','Type'],['inc-severity','Severity'],['inc-district','District'],['inc-desc','Description']])) return;
    try {
      btn.disabled = true; btn.textContent = 'Submitting…';
      const photoFile = document.getElementById('inc-photo').files[0];
      let photoURL = '';
      if (photoFile) {
        showToast('Uploading photo…', 'info');
        photoURL = await uploadFile(photoFile, 'incidents');
      }
      const gpsRaw = document.getElementById('inc-gps').value;
      const gps = gpsRaw ? JSON.parse(gpsRaw) : null;
      await addDoc('incidents', {
        uid: window.currentUser?.uid || '',
        reporterName: window.currentUser?.profile?.name || '',
        title: document.getElementById('inc-title').value.trim(),
        type: document.getElementById('inc-type').value,
        severity: document.getElementById('inc-severity').value,
        description: document.getElementById('inc-desc').value.trim(),
        district: document.getElementById('inc-district').value,
        location: document.getElementById('inc-location').value.trim(),
        gps, photoURL, status: 'pending'
      });
      showToast('Incident report submitted!', 'success');
      form.reset();
      loadMyIncidents(window.currentUser?.uid);
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '📋 Submit Incident Report';
    }
  });
}

// ── Missing Person Form ──
function wireMissingForm() {
  const form = document.getElementById('missing-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('.btn');
    if (!validateForm([['mp-name','Name'],['mp-contact','Contact'],['mp-district','District']])) return;
    try {
      btn.disabled = true; btn.textContent = 'Submitting…';
      const photoFile = document.getElementById('mp-photo').files[0];
      let photoURL = '';
      if (photoFile) { photoURL = await uploadFile(photoFile, 'missing_persons'); }
      await addDoc('missing_persons', {
        uid: window.currentUser?.uid || '',
        reporterName: window.currentUser?.profile?.name || '',
        missingName: document.getElementById('mp-name').value.trim(),
        age: document.getElementById('mp-age').value,
        gender: document.getElementById('mp-gender').value,
        district: document.getElementById('mp-district').value,
        location: document.getElementById('mp-location').value.trim(),
        description: document.getElementById('mp-desc').value.trim(),
        reporterContact: document.getElementById('mp-contact').value.trim(),
        photoURL, status: 'active'
      });
      showToast('Missing person report submitted!', 'success');
      form.reset();
      loadMissingPersons();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '🔍 Submit Missing Person Report';
    }
  });
}

// ── Upload preview ──
function previewUpload(input, areaId) {
  const area = document.getElementById(areaId);
  if (!area || !input.files[0]) return;
  const file = input.files[0];
  area.innerHTML = `<div>✅ ${file.name} (${(file.size/1024).toFixed(0)}KB)</div>`;
  area.style.borderColor = 'var(--safe-green)';
}

// ── Load My Incidents ──
async function loadMyIncidents(uid) {
  const el = document.getElementById('my-incidents-list');
  if (!el || !uid) return;
  try {
    const docs = await getDocs('incidents', [['where','uid','==',uid],['orderBy','createdAt','desc'],['limit',5]]);
    if (!docs.length) { el.innerHTML = '<p style="color:var(--text-muted);padding:12px;font-size:0.85rem;">No reports submitted yet.</p>'; return; }
    el.innerHTML = docs.map(d => `
      <div class="list-item">
        <div class="item-icon">📋</div>
        <div class="item-body">
          <div class="item-title">${d.title}</div>
          <div class="item-sub">${d.type} • ${d.district} • ${timeAgo(d.createdAt)}</div>
        </div>
        <div>${statusBadge(d.status)}</div>
      </div>`).join('');
  } catch (e) { el.innerHTML = '<p class="text-red" style="padding:12px;">Error loading</p>'; }
}

// ── Load Alerts ──
async function loadAlerts() {
  const el = document.getElementById('alerts-list');
  if (!el) return;
  try {
    HS.db.collection('alerts').where('status','==','active').orderBy('createdAt','desc').limit(20)
      .onSnapshot(snap => {
        if (snap.empty) { el.innerHTML = '<div class="notice notice-info">No active alerts.</div>'; return; }
        el.innerHTML = snap.docs.map(d => {
          const a = d.data();
          return `<div class="alert-banner ${a.severity?.toLowerCase() || 'medium'}">
            <span class="alert-icon">${severityIcon(a.severity)}</span>
            <div class="alert-content">
              <div class="alert-title">${a.title}</div>
              <div class="alert-body">${a.message}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">📍 ${a.district || 'All Districts'}</div>
            </div>
            <div class="alert-time">${timeAgo(a.createdAt)}</div>
          </div>`;
        }).join('');
      });
  } catch (e) { el.innerHTML = '<p class="text-red">Error loading alerts</p>'; }
}

// ── Load Camps ──
async function loadCamps() {
  const el = document.getElementById('camps-list');
  if (!el) return;
  try {
    HS.db.collection('relief_camps').where('status','==','active').orderBy('createdAt','desc')
      .onSnapshot(snap => {
        if (snap.empty) { el.innerHTML = '<div class="notice notice-info">No relief camps registered.</div>'; return; }
        el.innerHTML = snap.docs.map(d => {
          const c = d.data();
          return `<div class="card mb-12">
            <div class="flex items-center justify-between">
              <div>
                <div style="font-weight:700;font-size:1rem;">⛺ ${c.name}</div>
                <div style="font-size:0.82rem;color:var(--text-muted);">📍 ${c.location} • ${c.district}</div>
                <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:4px;">${c.description || ''}</div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-family:var(--font-display);font-size:1.4rem;color:var(--safe-green);">${c.capacity || '—'}</div>
                <div style="font-size:0.7rem;color:var(--text-muted);">Capacity</div>
                ${c.contact ? `<div style="font-size:0.8rem;margin-top:4px;">📞 ${c.contact}</div>` : ''}
              </div>
            </div>
          </div>`;
        }).join('');
      });
  } catch (e) { el.innerHTML = '<p class="text-red">Error loading</p>'; }
}

// ── Load Safe Zones ──
async function loadSafeZones() {
  const el = document.getElementById('safezones-list');
  if (!el) return;
  try {
    HS.db.collection('safe_zones').orderBy('createdAt','desc')
      .onSnapshot(snap => {
        if (snap.empty) { el.innerHTML = '<div class="notice notice-info">No safe zones marked.</div>'; return; }
        el.innerHTML = snap.docs.map(d => {
          const z = d.data();
          return `<div class="list-item">
            <div class="item-icon" style="background:var(--safe-glow);">✅</div>
            <div class="item-body">
              <div class="item-title">${z.name}</div>
              <div class="item-sub">📍 ${z.location} • ${z.district}</div>
              ${z.notes ? `<div class="item-sub">${z.notes}</div>` : ''}
            </div>
          </div>`;
        }).join('');
      });
  } catch (e) { el.innerHTML = '<p class="text-red">Error loading</p>'; }
}

// ── Load Blocked Roads ──
async function loadBlockedRoads() {
  const el = document.getElementById('roads-list');
  if (!el) return;
  try {
    HS.db.collection('blocked_roads').where('status','==','active').orderBy('createdAt','desc')
      .onSnapshot(snap => {
        if (snap.empty) { el.innerHTML = '<div class="notice notice-success">No blocked roads reported.</div>'; return; }
        el.innerHTML = snap.docs.map(d => {
          const r = d.data();
          return `<div class="alert-banner high" style="margin-bottom:10px;">
            <span class="alert-icon">🚧</span>
            <div class="alert-content">
              <div class="alert-title">${r.roadName}</div>
              <div class="alert-body">${r.reason || 'Road blocked'}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">📍 ${r.district} • ${timeAgo(r.createdAt)}</div>
            </div>
          </div>`;
        }).join('');
      });
  } catch (e) { el.innerHTML = '<p class="text-red">Error loading</p>'; }
}

// ── Load Public Updates ──
async function loadPublicUpdates() {
  const el = document.getElementById('updates-list');
  if (!el) return;
  try {
    HS.db.collection('public_updates').orderBy('createdAt','desc').limit(20)
      .onSnapshot(snap => {
        if (snap.empty) { el.innerHTML = '<div class="notice notice-info">No updates.</div>'; return; }
        el.innerHTML = snap.docs.map(d => {
          const u = d.data();
          return `<div class="card mb-12">
            <div class="flex items-center gap-8 mb-8">
              <span class="badge badge-blue">${u.category || 'Update'}</span>
              <span style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);">${timeAgo(u.createdAt)}</span>
            </div>
            <div style="font-weight:600;margin-bottom:4px;">${u.title}</div>
            <p style="font-size:0.88rem;">${u.content}</p>
            ${u.postedBy ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">— ${u.postedBy}</div>` : ''}
          </div>`;
        }).join('');
      });
  } catch (e) { el.innerHTML = '<p class="text-red">Error loading</p>'; }
}

// ── Load Missing Persons ──
async function loadMissingPersons() {
  const el = document.getElementById('missing-list');
  if (!el) return;
  try {
    const docs = await getDocs('missing_persons', [['orderBy','createdAt','desc'],['limit',20]]);
    if (!docs.length) { el.innerHTML = '<div class="notice notice-info">No missing person reports.</div>'; return; }
    el.innerHTML = docs.map(d => `
      <div class="list-item">
        ${d.photoURL ? `<img src="${d.photoURL}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;">` : '<div class="item-icon">👤</div>'}
        <div class="item-body">
          <div class="item-title">${d.missingName} ${d.age ? `(${d.age})` : ''} ${d.gender ? `• ${d.gender}` : ''}</div>
          <div class="item-sub">Last seen: ${d.location || 'Unknown'} • ${d.district}</div>
          ${d.description ? `<div class="item-sub">${d.description}</div>` : ''}
          <div class="item-sub">📞 ${d.reporterContact}</div>
        </div>
        <div>${statusBadge(d.status)}</div>
      </div>`).join('');
  } catch (e) { el.innerHTML = '<p class="text-red">Error loading</p>'; }
}

// ── Weather ──
async function loadWeather() {
  const currentEl = document.getElementById('weather-current');
  const forecastEl = document.getElementById('forecast-content');
  try {
    const data = await fetchWeather(31.1048, 77.1734); // Shimla
    const c = data.current;
    const emoji = weatherCodeToEmoji(c.weather_code);
    currentEl.innerHTML = `
      <div class="card-header"><div class="card-title">🌤 Current Weather — Shimla</div></div>
      <div style="font-size:3rem;text-align:center;margin:8px 0;">${emoji}</div>
      <div class="weather-grid">
        <div class="weather-item">
          <div class="w-icon">🌡</div>
          <div class="w-value">${c.temperature_2m}°C</div>
          <div class="w-label">Temperature</div>
        </div>
        <div class="weather-item">
          <div class="w-icon">💧</div>
          <div class="w-value">${c.relative_humidity_2m}%</div>
          <div class="w-label">Humidity</div>
        </div>
        <div class="weather-item">
          <div class="w-icon">🌧</div>
          <div class="w-value">${c.precipitation_probability}%</div>
          <div class="w-label">Rain Prob.</div>
        </div>
        <div class="weather-item">
          <div class="w-icon">💨</div>
          <div class="w-value">${c.wind_speed_10m}</div>
          <div class="w-label">Wind km/h</div>
        </div>
      </div>`;

    const daily = data.daily;
    forecastEl.innerHTML = daily.time.map((day, i) => `
      <div class="flex items-center justify-between" style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="width:90px;font-size:0.85rem;color:var(--text-secondary);">${new Date(day).toLocaleDateString('en-IN',{weekday:'short',month:'short',day:'numeric'})}</div>
        <div style="font-size:1.4rem;">${weatherCodeToEmoji(0)}</div>
        <div style="font-size:0.85rem;color:var(--info-blue);">🌧 ${daily.precipitation_probability_max[i]}%</div>
        <div style="font-family:var(--font-display);font-size:0.95rem;">
          <span class="text-red">${daily.temperature_2m_max[i]}°</span>
          <span class="text-muted"> / ${daily.temperature_2m_min[i]}°</span>
        </div>
      </div>`).join('');
  } catch (e) {
    currentEl.innerHTML = `<div class="notice notice-error">Weather data unavailable: ${e.message}</div>`;
    if (forecastEl) forecastEl.innerHTML = '';
  }
}

// ── Map init (MapMyIndia stub) ──
function initMap() {
  if (window._mapInitialized) return;
  window._mapInitialized = true;
  // MapMyIndia SDK needs to be loaded with API key
  // Full integration: load https://apis.mapmyindia.com/advancedmaps/v1/{KEY}/map_load?v=1.5&plugins=cluster
  const container = document.getElementById('map-container');
  if (!container) return;
  if (HS.MAPMYINDIA_API_KEY === 'YOUR_MAPMYINDIA_KEY') {
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px;color:var(--text-muted);">
      <div style="font-size:2rem;">🗺</div>
      <div>Configure MAPMYINDIA_API_KEY to enable maps</div>
      <div style="font-size:0.78rem;">Get API key from: maps.mapmyindia.com</div>
    </div>`;
    return;
  }
  // Load MapMyIndia dynamically
  const script = document.createElement('script');
  script.src = `https://apis.mapmyindia.com/advancedmaps/v1/${HS.MAPMYINDIA_API_KEY}/map_load?v=1.5`;
  script.onload = () => {
    const map = new MapmyIndia.Map('map-container', { center: [HS.HP_CENTER.lat, HS.HP_CENTER.lng], zoom: 8 });
    // Plot camps, safe zones, etc.
    plotMapMarkers(map);
  };
  document.head.appendChild(script);
}

async function plotMapMarkers(map) {
  try {
    const camps = await getDocs('relief_camps');
    camps.forEach(c => {
      if (!c.gps) return;
      new MapmyIndia.Marker({ map, position: [c.gps.lat, c.gps.lng], title: c.name, icon: '⛺' });
    });
  } catch (e) { console.error('Map markers:', e); }
}

// ── Bottom nav helper ──
function updateBottomNav(btn) {
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Severity icon ──
function severityIcon(s) {
  const m = { critical:'🔴', high:'🟠', medium:'🟡', low:'🔵' };
  return m[s?.toLowerCase()] || '⚪';
}

// Auto-load weather on page nav
document.querySelectorAll('[onclick*="weather-page"]').forEach(el => {
  el.addEventListener('click', () => setTimeout(loadWeather, 100));
});
document.querySelectorAll('[onclick*="missing-page"]').forEach(el => {
  el.addEventListener('click', () => setTimeout(loadMissingPersons, 100));
});
