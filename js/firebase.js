// ==========================================================
// firebase.js — the ONLY file in this project allowed to talk to
// the Firebase SDK. (Storage removed for pure text sync)
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgOiiFWeyIsRo8pYtupgx40vc7IPVd0Fk",
  authDomain: "gustiagus-1bcba.firebaseapp.com",
  databaseURL: "https://gustiagus-1bcba-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gustiagus-1bcba",
  storageBucket: "gustiagus-1bcba.firebasestorage.app",
  messagingSenderId: "506284820826",
  appId: "1:506284820826:web:8d4c9fb6dccb8f385bcb63"
};

// Hanya inisialisasi App dan Firestore (Database Teks)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================================
// REALTIME LISTENERS (The Magic)
// ==========================================================

/** 
 * Mendengarkan perubahan pada SATU dokumen (Realtime).
 * Callback akan terpanggil otomatis setiap kali ada yang save teks.
 */
export function listenToDocument(collectionName, id, callback){
  const docRef = doc(db, collectionName, id);
  return onSnapshot(docRef, (snap) => {
    callback(snap.exists() ? snap.data() : null);
  }, (error) => {
    console.warn(`Gagal listen /${collectionName}/${id}:`, error);
    callback(null);
  });
}

/** 
 * Mendengarkan perubahan pada SATU KOLEKSI penuh (Realtime).
 * Dipakai untuk otomatis update Gallery, Playlist, Scrapbook.
 */
export function listenToCollection(collectionName, orderByField, callback){
  const colRef = collection(db, collectionName);
  const q = orderByField ? query(colRef, orderBy(orderByField)) : colRef;
  
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(data);
  }, (error) => {
    console.warn(`Gagal listen /${collectionName}:`, error);
    callback([]);
  });
}

// ==========================================================
// WRITERS (Simpan, Update, Hapus data ke Firebase)
// ==========================================================

export async function addItem(collectionName, data){ 
  return addDoc(collection(db, collectionName), data); 
}
export async function updateItem(collectionName, id, data){ 
  return updateDoc(doc(db, collectionName, id), data); 
}
export async function deleteItem(collectionName, id){ 
  return deleteDoc(doc(db, collectionName, id)); 
}
export async function setSingleton(collectionName, id, data){ 
  return setDoc(doc(db, collectionName, id), data, { merge:true }); 
}
