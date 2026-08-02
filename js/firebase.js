import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAovYyst3XWsqmR9ILRsiqTpqmW3mzyg-U",
  authDomain: "museumkecil.firebaseapp.com",
  projectId: "museumkecil",
  storageBucket: "museumkecil.firebasestorage.app",
  messagingSenderId: "846298029487",
  appId: "1:846298029487:web:ebdf4f6910adfcc6d0a35a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
