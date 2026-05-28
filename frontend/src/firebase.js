// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCZA1umCv1VMz8UVvO55vu5A-G6sZE90E",
  authDomain: "mern-chat-app-8547b.firebaseapp.com",
  projectId: "mern-chat-app-8547b",
  storageBucket: "mern-chat-app-8547b.firebasestorage.app",
  messagingSenderId: "916764234045",
  appId: "1:916764234045:web:ea53a5cac3c9238fc7f554"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();