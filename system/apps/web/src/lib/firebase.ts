// Loaded only in firebase mode, and only when needed, to keep the first download small.
import { initializeApp } from "@firebase/app";
import {
  browserLocalPersistence, createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged,
  sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signInWithPopup, signOut, type User,
} from "@firebase/auth";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
void setPersistence(auth, browserLocalPersistence);

export const watch = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb);
export const token = async () => (auth.currentUser ? auth.currentUser.getIdToken() : null);
export const signIn = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
// The email is confirmed with a code ProofPocket emails (POST /auth/email-code/*), not Firebase's link.
export const signUp = (email: string, password: string) => createUserWithEmailAndPassword(auth, email, password);

const googleProvider = () => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  return p;
};
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider());

/** After the email code is accepted: a fresh token that says the email is confirmed. Returns whether it is. */
export async function reload() {
  await auth.currentUser?.reload();
  await auth.currentUser?.getIdToken(true);
  return auth.currentUser?.emailVerified ?? false;
}

export const out = () => signOut(auth);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
