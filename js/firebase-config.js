// ============================================================
// HIMACHAL SURAKSHA - Firebase Configuration
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyDzo-WkbmUDhvoWWyZDWxZ0LmgF-RMGf_M",
  authDomain: "himachal-suraksha.firebaseapp.com",
  projectId: "himachal-suraksha",
  storageBucket: "himachal-suraksha.firebasestorage.app",
  messagingSenderId: "211103285406",
  appId: "1:211103285406:web:374abb05d62b23b4b3fb8f"
};

// Initialize Firebase (Compat SDK only)
firebase.initializeApp(firebaseConfig);

// Firebase services
const auth = firebase.auth();
const db   = firebase.firestore();

// ── Storage: DISABLED (not enabled in Firebase console) ──
// Safe fallback so any accidental call won't crash the app
const storage = {
  ref: () => { throw new Error('Firebase Storage is not enabled. File uploads are disabled.'); }
};

// MapMyIndia API Key
const MAPMYINDIA_API_KEY = "YOUR_MAPMYINDIA_KEY";

// Open-Meteo base URL (free, no key needed)
const WEATHER_API_BASE = "https://api.open-meteo.com/v1/forecast";

// Himachal Pradesh center coordinates
const HP_CENTER = { lat: 31.1048, lng: 77.1734 };

// Global namespace
window.HS = { auth, db, storage, MAPMYINDIA_API_KEY, WEATHER_API_BASE, HP_CENTER };
