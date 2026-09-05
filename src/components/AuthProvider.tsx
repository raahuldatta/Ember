import { createContext, useContext, useEffect, useState } from 'react';
import { firebaseEnabled, auth, googleAuthProvider } from '../lib/firebase';

export type AppUser = {
  uid: string;
  email: string | null;
  displayName?: string | null;
  demo?: boolean;
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
  googleAvailable: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signInDemo: async () => {},
  signOut: async () => {},
  getToken: async () => null,
  googleAvailable: false,
});

export const useAuth = () => useContext(AuthContext);

const DEMO_USER: AppUser = {
  uid: 'demo',
  email: 'oncall@ember.dev',
  displayName: 'On-call Engineer',
  demo: true,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem('ember_demo') === '1') {
      setUser(DEMO_USER);
      setLoading(false);
      return;
    }

    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        const mapped: AppUser = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
        };
        setUser(mapped);
        try {
          const token = await currentUser.getIdToken();
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (e) {
          console.error('Auth sync failed', e);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    if (!auth) return;
    try {
      const { signInWithPopup } = await import('firebase/auth');
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error) {
      console.error('Sign-in failed:', error);
    }
  };

  const signInDemo = async () => {
    localStorage.setItem('ember_demo', '1');
    setUser(DEMO_USER);
    try {
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { Authorization: 'Bearer demo' },
      });
    } catch (e) {
      console.error('Demo sync failed', e);
    }
  };

  const signOut = async () => {
    localStorage.removeItem('ember_demo');
    if (auth) {
      const { signOut: firebaseSignOut } = await import('firebase/auth');
      await firebaseSignOut(auth);
    }
    setUser(null);
  };

  const getToken = async () => {
    if (user?.demo) return 'demo';
    if (!auth?.currentUser) return user ? 'demo' : null;
    return auth.currentUser.getIdToken();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signInDemo, signOut, getToken, googleAvailable: firebaseEnabled }}
    >
      {children}
    </AuthContext.Provider>
  );
}
