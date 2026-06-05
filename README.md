# 🛡 HIMACHAL SURAKSHA
### Himachal Pradesh State Disaster Management System

A production-grade, mobile-first disaster management web application built with Firebase, MapMyIndia, and Open-Meteo.

---

## 📁 Project Structure

```
himachal-suraksha/
├── index.html              ← Landing / Auth page
├── pages/
│   ├── citizen.html        ← Citizen dashboard
│   ├── volunteer.html      ← Volunteer portal
│   └── admin.html          ← Admin command center
├── css/
│   └── main.css            ← All styles (dark theme)
├── js/
│   ├── firebase-config.js  ← Firebase + API keys
│   ├── core.js             ← Shared utilities
│   ├── auth.js             ← Authentication logic
│   ├── citizen.js          ← Citizen features
│   ├── volunteer.js        ← Volunteer features
│   └── admin.js            ← Admin features
├── assets/                 ← Icons, images
├── firestore.rules         ← Firestore security rules
├── storage.rules           ← Storage security rules
├── netlify.toml            ← Netlify deployment config
└── README.md
```

---

## 🚀 Setup Instructions

### Step 1 — Firebase Project Setup

1. Go to [firebase.google.com](https://firebase.google.com)
2. Create a new project: `himachal-suraksha`
3. Enable **Authentication** → Email/Password provider
4. Create **Firestore Database** → Start in production mode
5. Enable **Storage**
6. Copy your Firebase config from Project Settings

### Step 2 — Configure API Keys

Open `js/firebase-config.js` and replace:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const MAPMYINDIA_API_KEY = "YOUR_MAPMYINDIA_KEY";
```

**MapMyIndia API Key:** Register at [maps.mapmyindia.com](https://maps.mapmyindia.com/api)

### Step 3 — Apply Firestore Rules

1. Firebase Console → Firestore → Rules
2. Paste contents of `firestore.rules`
3. Click Publish

### Step 4 — Apply Storage Rules

1. Firebase Console → Storage → Rules
2. Paste contents of `storage.rules`
3. Click Publish

### Step 5 — Create First Admin Account

Since admin registration is not publicly available, create the first admin manually:

1. Register as a **Citizen** through the app
2. Go to Firebase Console → Firestore
3. Find your user document in the `users` collection
4. Open Firebase Console → Firestore → Create new collection: `admins`
5. Add a document with your UID as the document ID:
```json
{
  "name": "Your Name",
  "email": "your@email.com",
  "role": "admin",
  "status": "active",
  "createdAt": [server timestamp]
}
```
6. Log out and log back in — you'll now have admin access

---

## 🌐 Netlify Deployment (from Termux)

### Install Netlify CLI in Termux:
```bash
npm install -g netlify-cli
```

### Deploy:
```bash
cd himachal-suraksha
netlify login
netlify init
netlify deploy --prod
```

### Or drag-and-drop:
1. Go to [app.netlify.com](https://app.netlify.com)
2. Drag the `himachal-suraksha` folder onto the deploy zone
3. Your app is live!

---

## 🔥 Firebase Collections

| Collection | Description |
|---|---|
| `users` | Registered citizens |
| `volunteers` | Volunteer profiles (require admin approval) |
| `admins` | Admin accounts |
| `sos_requests` | Emergency SOS submissions |
| `incidents` | Incident reports |
| `missing_persons` | Missing person reports |
| `alerts` | Disaster alerts |
| `relief_camps` | Relief camp registrations |
| `safe_zones` | Safe zone markers |
| `blocked_roads` | Blocked road reports |
| `resources` | Emergency resources (ambulances, JCBs, etc.) |
| `public_updates` | Public information updates |

---

## 👤 User Roles

| Role | Registration | Access |
|---|---|---|
| **Citizen** | Self-register | SOS, report incidents, view all public info |
| **Volunteer** | Self-register (admin approval required) | Upload safe zones, camps, roads, updates |
| **Admin** | Manually added to Firestore | Full system access, manage all data |

---

## 🌤 Weather API

Uses **Open-Meteo** (free, no key needed):
- Current temperature, humidity, rain probability, wind speed
- 5-day forecast
- No API key required

---

## 🗺 MapMyIndia Integration

The map module is ready for MapMyIndia SDK. To enable:
1. Get API key from [maps.mapmyindia.com](https://maps.mapmyindia.com)
2. Set `MAPMYINDIA_API_KEY` in `firebase-config.js`
3. The map in citizen dashboard will auto-initialize

---

## 📱 Mobile (Termux) Development

This app was designed to be developed from **Termux on Android**:

```bash
# Serve locally for testing
cd himachal-suraksha
python3 -m http.server 8080
# Open: http://localhost:8080
```

Or use `npx serve`:
```bash
npx serve .
```

---

## 🚀 Advanced Modules (Future)

The following modules have UI placeholders ready for future development:

- 🧠 **AI Face Matching** — TensorFlow.js + Google Vision API
- 🛰 **AI Damage Assessment** — Satellite imagery analysis
- 🚁 **Drone Monitoring** — DJI SDK + WebRTC feed
- 📹 **Live Video Streaming** — WebRTC field feeds
- 📻 **Emergency Radio Integration** — AIR Broadcast API
- 👥 **Crowd Management** — CCTV + Computer Vision

---

## 🤖 AI Assistant

The AI Assistant page is **Gemini API ready**. To activate:

1. Get Gemini API key from [aistudio.google.com](https://aistudio.google.com)
2. In `admin.js`, replace the `getAIResponse()` function with:

```javascript
async function getAIResponse(msg) {
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_KEY',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `You are SURAKSHA AI, a disaster management assistant for Himachal Pradesh, India. Answer: ${msg}` }]
        }]
      })
    }
  );
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
```

---

## 📞 Emergency Contacts

Configure these in your admin dashboard:
- HP Emergency: **1077**
- Police: **100**
- Ambulance: **108**
- Fire: **101**
- NDRF: **011-24363260**

---

## 📄 License

Built for Himachal Pradesh State Disaster Management Authority (HPSDMA).
Government use — all rights reserved.
