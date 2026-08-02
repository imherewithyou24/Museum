import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ==========================================================
// CONFIG FIREBASE MILIKMU (Museum Kecil)
// ==========================================================
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

// ==========================================================
// 1. FUNGSI MENYIMPAN DATA (Hanya dipanggil di Mode Admin)
// ==========================================================
export async function saveData(key, value) {
  const docRef = doc(db, "museum_data", "content");
  // { merge: true } sangat penting agar teks yang lain tidak terhapus
  // saat kita hanya mengedit satu bagian teks saja.
  await setDoc(docRef, { [key]: value }, { merge: true });
}

// ==========================================================
// 2. FUNGSI REALTIME LISTENER (Dipanggil di semua mode)
// ==========================================================
export function listenToData(callback) {
  const docRef = doc(db, "museum_data", "content");
  onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data());
    }
  });
}
