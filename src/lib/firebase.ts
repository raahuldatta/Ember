import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

try {
  if (firebaseConfig?.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
    app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
  }
} catch (error) {
  console.warn('Firebase client failed to initialize; demo sign-in remains available.', error);
}

export const auth = authInstance;
export const googleAuthProvider = new GoogleAuthProvider();
export const firebaseEnabled = Boolean(authInstance);
