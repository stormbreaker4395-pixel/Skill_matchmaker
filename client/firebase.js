import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCwudqGW12vAeLXxdp8_7wtx6hr0wvY0_4",
  authDomain: "skill-bridge-8312e.firebaseapp.com",
  projectId: "skill-bridge-8312e",
  storageBucket: "skill-bridge-8312e.firebasestorage.app",
  messagingSenderId: "327995432988",
  appId: "1:327995432988:web:be96789548420a6507ffd9",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged };
