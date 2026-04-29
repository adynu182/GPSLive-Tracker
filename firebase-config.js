import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-database.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJQIIpLbArzZjN-8kNrCn6grtuBWDKGdM",
  authDomain: "trip-planner-71a75.firebaseapp.com",
  databaseURL: "https://trip-planner-71a75-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "trip-planner-71a75",
  storageBucket: "trip-planner-71a75.firebasestorage.app",
  messagingSenderId: "785022107516",
  appId: "1:785022107516:web:14cbe0cd1d601cada36ef9"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const fs = getFirestore(app);

export { firebaseConfig, app, db, fs };