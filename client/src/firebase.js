// ====== firebase.js ======
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// ✅ Correct Firebase configuration (from Firebase console)
const firebaseConfig = {
  apiKey: "AIzaSyCLMwCfTtub72f8C7Gq0WOrXDHRaaCU7mI",
  authDomain: "grow-stocks.firebaseapp.com",
  projectId: "grow-stocks",
  storageBucket: "grow-stocks.appspot.com",
  messagingSenderId: "740309493461",
  appId: "1:740309493461:web:2646fcdd473a0777a5245c",
  measurementId: "G-ELT4WQD0E1"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
