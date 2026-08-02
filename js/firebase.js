// ==========================================================
// firebase.js — the ONLY file in this project allowed to talk to
// the Firebase SDK. Every Firestore/Storage call lives here as a
// small exported function; app.js and admin.js only ever import
// and call these, they never touch `db`/`storage` directly.
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgOiiFWeyIsRo8pYtupgx40vc7IPVd0Fk",
  authDomain: "gustiagus-1bcba.firebaseapp.com",
  databaseURL: "https://gustiagus-1bcba-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gustiagus-1bcba",
  storageBucket: "gustiagus-1bcba.firebasestorage.app",
  messagingSenderId: "506284820826",
  appId: "1:506284820826:web:8d4c9fb6dccb8f385bcb63"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

/** Reads a single document by collection/id. Returns its data, or
 * null if missing or on error — callers decide their own fallback
 * (e.g. loadConfig() in app.js falls back to default PINs). */
export async function getDocument(collectionName, id){
  try{
    const snap = await getDoc(doc(db, collectionName, id));
    return snap.exists() ? snap.data() : null;
  } catch(err){
    console.warn(`Couldn't read /${collectionName}/${id}:`, err);
    return null;
  }
}

/** Reads a whole collection, optionally ordered by a field. Never
 * throws — returns [] on error so callers can fall back to sample
 * content, same behaviour the old inline loaders relied on. */
export async function fetchAll(collectionName, orderByField){
  try{
    const q = orderByField
      ? query(collection(db, collectionName), orderBy(orderByField))
      : collection(db, collectionName);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(err){
    console.warn(`Couldn't fetch /${collectionName}:`, err);
    return [];
  }
}

export async function addItem(collectionName, data){ return addDoc(collection(db, collectionName), data); }
export async function updateItem(collectionName, id, data){ return updateDoc(doc(db, collectionName, id), data); }
export async function deleteItem(collectionName, id){ return deleteDoc(doc(db, collectionName, id)); }
export async function setSingleton(collectionName, id, data){ return setDoc(doc(db, collectionName, id), data, { merge:true }); }

export async function uploadFile(file, folder){
  const fileRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}
