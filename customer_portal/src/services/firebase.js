import { getAdditionalUserInfo, getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDgvJQtM-TmhYb8i1N2TutXYmekSVhRAeg",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "pastry-project-e864e.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "pastry-project-e864e",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "pastry-project-e864e.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "373071733489",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:373071733489:web:e3d78eebb63faf349c7f50",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.addScope("profile");
provider.setCustomParameters({ prompt: "select_account" });

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  const googleProvider = result.user.providerData.find(({ providerId }) => providerId === "google.com");
  const additionalProfile = getAdditionalUserInfo(result)?.profile;
  const googleCredential = GoogleAuthProvider.credentialFromResult(result);
  let googleProfilePhoto = "";

  if (googleCredential?.accessToken) {
    try {
      const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${googleCredential.accessToken}` },
      });
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        googleProfilePhoto = typeof profile.picture === "string" ? profile.picture : "";
      } else {
        console.warn("Google profile photo lookup failed:", profileResponse.status);
      }
    } catch (error) {
      console.warn("Google profile photo lookup failed:", error);
    }
  }

  const photoURL =
    googleProfilePhoto ||
    result.user.photoURL ||
    googleProvider?.photoURL ||
    (typeof additionalProfile?.picture === "string" ? additionalProfile.picture : "");

  return {
    idToken,
    user: result.user,
    email: result.user.email || "",
    name: result.user.displayName || "Google User",
    photoURL,
  };
}
