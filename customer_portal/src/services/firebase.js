import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBDD0ypZvw3xPgRUTxEB49sz3tR_L8InII",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "capstone--development.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "capstone--development",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "capstone--development.firebasestorage.app",
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();

  return {
    idToken,
    user: result.user,
    email: result.user.email || "",
    name: result.user.displayName || "Google User",
    photoURL: result.user.photoURL || "",
  };
}
