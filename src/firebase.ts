import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: Must pass firestoreDatabaseId to getFirestore
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

// Google Auth Provider for Google Calendar and Gmail
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');

// In-memory token cache for OAuth
let cachedGoogleAccessToken: string | null = null;

export interface GoogleAuthResult {
  email: string;
  name?: string;
  accessToken: string;
  method: 'gis' | 'firebase' | 'manual';
}

/**
 * Request Google Calendar OAuth authorization using Google Identity Services (GIS)
 * with automatic fallback to Firebase Auth signInWithPopup.
 */
export const requestGoogleOAuth = async (hintEmail?: string): Promise<GoogleAuthResult> => {
  const oAuthClientId = (firebaseConfig as any).oAuthClientId;

  // Strategy 1: Modern Google Identity Services (GIS Token Client)
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2 && oAuthClientId) {
    try {
      const gisResult = await new Promise<GoogleAuthResult>((resolve, reject) => {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: oAuthClientId,
          scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid',
          hint: hintEmail || undefined,
          callback: async (resp: any) => {
            if (resp.error) {
              return reject(new Error(resp.error_description || resp.error));
            }
            if (!resp.access_token) {
              return reject(new Error('No access token returned from Google'));
            }

            try {
              const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${resp.access_token}` },
              });
              const uData = await uRes.json();
              cachedGoogleAccessToken = resp.access_token;
              resolve({
                email: uData.email || hintEmail || '',
                name: uData.name || '',
                accessToken: resp.access_token,
                method: 'gis',
              });
            } catch {
              cachedGoogleAccessToken = resp.access_token;
              resolve({
                email: hintEmail || '',
                accessToken: resp.access_token,
                method: 'gis',
              });
            }
          },
          error_callback: (err: any) => {
            reject(err);
          },
        });

        tokenClient.requestAccessToken({ prompt: 'consent' });
      });

      return gisResult;
    } catch (gisErr: any) {
      console.warn('GIS token request failed, trying Firebase Auth popup:', gisErr);
    }
  }

  // Strategy 2: Firebase Auth signInWithPopup
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google OAuth access token');
    }
    cachedGoogleAccessToken = credential.accessToken;
    return {
      email: result.user.email || '',
      name: result.user.displayName || '',
      accessToken: cachedGoogleAccessToken,
      method: 'firebase',
    };
  } catch (error: any) {
    console.warn('Firebase Google Sign-in status:', error);
    if (error.code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
      const projectId = (firebaseConfig as any).projectId || 'gen-lang-client-0350677154';
      const customErr = new Error(
        `Firebase: Error (auth/unauthorized-domain). Domain "${currentHost}" is not in the Authorized Domains list for Firebase project "${projectId}".`
      );
      (customErr as any).code = 'auth/unauthorized-domain';
      (customErr as any).domain = currentHost;
      (customErr as any).projectId = projectId;
      throw customErr;
    }
    throw error;
  }
};

export const signInWithGoogleOAuth = async (): Promise<{ user: User; accessToken: string }> => {
  const authRes = await requestGoogleOAuth();
  return {
    user: { email: authRes.email, displayName: authRes.name } as any,
    accessToken: authRes.accessToken,
  };
};

export const getCachedGoogleAccessToken = (): string | null => {
  return cachedGoogleAccessToken;
};

export const setCachedGoogleAccessToken = (token: string | null) => {
  cachedGoogleAccessToken = token;
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot per Firebase skill guidelines
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline. Please verify network configuration.');
    }
    return false;
  }
}
