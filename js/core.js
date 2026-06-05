// ============================================================
// HIMACHAL SURAKSHA - Core Utilities
// ============================================================

// ── Toast Notifications ──
function showToast(msg, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; toast.style.transition = 'all 0.3s ease'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ── Loading Screen ──
function hideLoading() {
  const ls = document.getElementById('loading-screen');
  if (ls) { ls.classList.add('hidden'); setTimeout(() => ls.remove(), 600); }
}

// ── Format Timestamp ──
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Get GPS ──
function getGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject('GPS not supported');
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => reject(err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ── Sidebar toggle ──
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const burger  = document.getElementById('hamburger-btn');
  if (!sidebar) return;
  function open()  { sidebar.classList.add('open'); if (overlay) overlay.classList.add('active'); }
  function close() { sidebar.classList.remove('open'); if (overlay) overlay.classList.remove('active'); }
  if (burger) burger.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
  if (overlay) overlay.addEventListener('click', close);
}

// ── Modal ──
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}
function initModals() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });
  });
}

// ── Page navigation ──
function showPage(pageId, linksSelector = '.sidebar-link') {
  document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) target.classList.add('active');
  document.querySelectorAll(linksSelector).forEach(l => {
    l.classList.toggle('active', l.dataset.page === pageId);
  });
}

// ── Firestore Helpers ──
async function addDoc(collection, data) {
  try {
    const ref = await HS.db.collection(collection).add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    return ref.id;
  } catch (e) { throw e; }
}
async function updateDoc(collection, id, data) {
  return HS.db.collection(collection).doc(id).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
}
async function deleteDoc(collection, id) {
  return HS.db.collection(collection).doc(id).delete();
}
async function getDoc(collection, id) {
  const snap = await HS.db.collection(collection).doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}
async function getDocs(collection, constraints = []) {
  let ref = HS.db.collection(collection);
  constraints.forEach(c => { ref = ref[c[0]](...c.slice(1)); });
  const snap = await ref.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Upload file to Firebase Storage ──
// NOTE: Storage is currently disabled. Returns null safely.
async function uploadFile(file, path) {
  try {
    const ref = HS.storage.ref(path + '/' + Date.now() + '_' + file.name);
    const snap = await ref.put(file);
    return snap.ref.getDownloadURL();
  } catch (e) {
    showToast('File upload unavailable (Storage not enabled)', 'warning');
    return null;
  }
}

// ── Severity color ──
function severityColor(s) {
  const m = { critical:'red', high:'orange', medium:'yellow', low:'blue' };
  return m[s?.toLowerCase()] || 'gray';
}

// ── Status badge HTML ──
function statusBadge(status) {
  const m = {
    pending:    ['orange','⏳'],
    approved:   ['green','✅'],
    resolved:   ['green','✔'],
    rejected:   ['red','✖'],
    active:     ['green','●'],
    available:  ['green','●'],
    busy:       ['orange','●'],
    deployed:   ['blue','●'],
    inactive:   ['gray','●'],
    open:       ['red','🔴'],
    closed:     ['gray','■'],
  };
  const [color, icon] = m[status?.toLowerCase()] || ['gray','?'];
  return `<span class="badge badge-${color}">${icon} ${status || 'Unknown'}</span>`;
}

// ── Confirm dialog ──
function confirmAction(msg) { return window.confirm(msg); }

// ── Form validation helper ──
function validateForm(fields) {
  for (const [id, label] of fields) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) { showToast(`${label} is required`, 'warning'); if (el) el.focus(); return false; }
  }
  return true;
}

// ── Weather: Open-Meteo ──
async function fetchWeather(lat = HS.HP_CENTER.lat, lng = HS.HP_CENTER.lng) {
  const url = `${HS.WEATHER_API_BASE}?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia/Kolkata&forecast_days=5`;
  const res = await fetch(url);
  return res.json();
}
function weatherCodeToEmoji(code) {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

// ── Disaster Types ──
const DISASTER_TYPES = [
  'Flood','Landslide','Earthquake','Flash Flood','Cloud Burst','Snow Storm',
  'Forest Fire','Road Accident','Building Collapse','Medical Emergency',
  'Drought','Cold Wave','Heat Wave','Other'
];

// ── HP Districts ──
const HP_DISTRICTS = [
  'Bilaspur','Chamba','Hamirpur','Kangra','Kinnaur','Kullu','Lahaul & Spiti',
  'Mandi','Shimla','Sirmaur','Solan','Una'
];

// ── Resource Types ──
const RESOURCE_TYPES = ['Ambulance','Fire Vehicle','JCB','Helicopter','Food Stock','Medicine Stock','Rescue Boat','Police Vehicle','Other'];

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initModals();
});
