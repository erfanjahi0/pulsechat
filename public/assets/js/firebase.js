// ============================================================
// firebase.js — Initialize Firebase & export services
// ============================================================
// ⚠️  Replace the config object below with your own Firebase
//     project config from Firebase Console > Project Settings
// ============================================================

import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage }     from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

// ── YOUR CONFIG ────────────────────────────────────────────
const firebaseConfig = {

  apiKey: "AIzaSyDiIpfl0ijYWFNASESCInuPFBMLP2TNUwI",

  authDomain: "pulsechat-7c26e.firebaseapp.com",

  projectId: "pulsechat-7c26e",

  storageBucket: "pulsechat-7c26e.firebasestorage.app",

  messagingSenderId: "376727797021",

  appId: "1:376727797021:web:56b1a16246b5b9c84af5f4",

  measurementId: "G-K7KPLMTZ0J"

};
// ───────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
export default app;
