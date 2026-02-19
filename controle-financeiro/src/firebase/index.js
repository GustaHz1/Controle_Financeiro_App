import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBwQPYcI_xbimwCg3nw1tOFVyi-M4DEil4",
  authDomain: "controle-financeiro-app-65db7.firebaseapp.com",
  projectId: "controle-financeiro-app-65db7",
  storageBucket: "controle-financeiro-app-65db7.firebasestorage.app",
  messagingSenderId: "845848521181",
  appId: "1:845848521181:web:e2e726ff8ca944d762ee34",
  measurementId: "G-NZH3600BTD"
};

// Inicializar o App
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };