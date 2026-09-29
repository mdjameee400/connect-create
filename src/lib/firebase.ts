import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut as fbSignOut,
  updateProfile,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { supabase } from "@/integrations/supabase/client";

// Firebase configuration provided by user
export const firebaseConfig = {
  apiKey: "AIzaSyAnle4BKmNQZUsY9rCzGW50rRS_9y8ygmE",
  authDomain: "connect-orbital-b098d.firebaseapp.com",
  projectId: "connect-orbital-b098d",
  storageBucket: "connect-orbital-b098d.firebasestorage.app",
  messagingSenderId: "680949553200",
  appId: "1:680949553200:web:12ff95678cc6905115b5f5",
  measurementId: "G-Q09XDDJM2D",
};

// Initialize Firebase (safely avoid duplicate apps)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Safe analytics init for SSR/browser environments
export const initAnalytics = async () => {
  if (typeof window !== "undefined") {
    const supported = await isSupported().catch(() => false);
    if (supported) {
      return getAnalytics(app);
    }
  }
  return null;
};

// Initialize analytics in browser
if (typeof window !== "undefined") {
  initAnalytics().catch(() => {});
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Helper to convert Firebase error codes to friendly messages
export function getFirebaseErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "An unexpected error occurred.";
  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message;

  switch (code) {
    case "auth/invalid-email":
      return "The email address is invalid.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Popup was blocked by your browser. Please allow popups for this site.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "auth/requires-recent-login":
      return "Please sign in again to continue.";
    default:
      return message || "Authentication failed. Please try again.";
  }
}

/**
 * Deterministically maps any Firebase UID to a valid RFC 4122 v4 UUID string
 * so PostgreSQL tables with UUID columns accept it without formatting errors.
 */
export function firebaseUidToUuid(uid: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < uid.length; i++) {
    const ch = uid.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = ((h1 ^ (h1 >>> 16)) >>> 0);
  h2 = ((h2 ^ (h2 >>> 16)) >>> 0);
  let h3 = 0x85ebca6b, h4 = 0xc2b2ae35;
  for (let i = uid.length - 1; i >= 0; i--) {
    const ch = uid.charCodeAt(i);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }
  h3 = ((h3 ^ (h3 >>> 16)) >>> 0);
  h4 = ((h4 ^ (h4 >>> 16)) >>> 0);
  const p1 = h1.toString(16).padStart(8, "0");
  const p2 = h2.toString(16).padStart(8, "0");
  const p3 = h3.toString(16).padStart(8, "0");
  const p4 = h4.toString(16).padStart(8, "0");
  const full = (p1 + p2 + p3 + p4).slice(0, 32);
  return `${full.slice(0, 8)}-${full.slice(8, 12)}-4${full.slice(13, 16)}-a${full.slice(17, 20)}-${full.slice(20, 32)}`;
}

/**
 * Sign in with Google via Firebase Popup.
 * Also retrieves the Google ID Token and transparently signs into Supabase
 * so database tables, RLS policies, and storage continue to work seamlessly.
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const idToken = credential?.idToken;

  // Sync to Supabase if ID token is present
  if (idToken) {
    try {
      await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });
    } catch (e) {
      console.warn("[Auth Sync] Supabase ID token sync skipped/failed:", e);
    }
  }

  return result.user;
}

/**
 * Register a new user with Email and Password using Firebase Auth.
 * Automatically sends an email verification link and updates display name.
 */
export async function registerWithEmail(
  email: string,
  pass: string,
  name?: string
): Promise<{ user: User; verificationSent: boolean }> {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);

  if (name?.trim()) {
    await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
  }

  let verificationSent = false;
  try {
    await sendEmailVerification(cred.user);
    verificationSent = true;
  } catch (err) {
    console.warn("[Auth] Failed to send email verification:", err);
  }

  // Attempt to sync user to Supabase
  try {
    await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { full_name: name } },
    });
  } catch (e) {
    console.warn("[Auth Sync] Supabase signup sync skipped/failed:", e);
  }

  return { user: cred.user, verificationSent };
}

/**
 * Sign in with Email and Password using Firebase Auth.
 */
export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);

  // Attempt to sync session with Supabase
  try {
    await supabase.auth.signInWithPassword({ email, password: pass });
  } catch (e) {
    console.warn("[Auth Sync] Supabase login sync skipped/failed:", e);
  }

  return cred.user;
}

/**
 * Re-send verification email to the current or given Firebase user.
 */
export async function resendVerificationEmail(user?: User | null): Promise<void> {
  const targetUser = user ?? auth.currentUser;
  if (!targetUser) throw new Error("No signed-in user to send verification to.");
  await sendEmailVerification(targetUser);
}

/**
 * Sign out from Firebase and Supabase.
 */
export async function logout(): Promise<void> {
  await Promise.allSettled([
    fbSignOut(auth),
    supabase.auth.signOut(),
  ]);
}

/**
 * Get current Firebase user, resolving after initial auth resolution.
 */
export function getCurrentUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Listen to Firebase Auth state changes.
 */
export function onAuthUserChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
