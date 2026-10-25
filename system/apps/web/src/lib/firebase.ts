// Loaded only in firebase mode, and only when needed, to keep the first download small.
import { initializeApp } from "@firebase/app";
import {
  browserLocalPersistence, createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged, sendEmailVerification,
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
export async function signUp(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(cred.user);
  return cred;
}

const googleProvider = () => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  return p;
};
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider());

/** After the person opens the email confirmation link: fetch a fresh token that says the email is confirmed. */
export async function reload() {
  await auth.currentUser?.reload();
  await auth.currentUser?.getIdToken(true);
}

export const out = () => signOut(auth);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
