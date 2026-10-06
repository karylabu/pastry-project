import { getAdditionalUserInfo, getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
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
