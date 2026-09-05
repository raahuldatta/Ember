import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

let app: App | null = null;

try {
  if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    app = initializeApp(
      serviceAccount
        ? { credential: cert(JSON.parse(serviceAccount)), projectId: firebaseConfig.projectId }
        : { projectId: firebaseConfig.projectId }
    );
  } else {
    app = getApps()[0];
  }
} catch (error) {
  console.warn('Firebase Admin failed to initialize; demo auth remains available.', error);
}

export const adminAuth = app ? getAuth(app) : (null as any);
