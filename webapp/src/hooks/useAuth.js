import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db } from '../firebase';

const DEFAULT_CALIBRATION = {
  height_cm: 170,
  threshold_mm: 1000,
  sensitivity: 'MEDIUM',
  last_updated: Date.now(),
};

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email, password) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    // Initialize default calibration profile for new user
    await set(ref(db, `users/${credential.user.uid}`), {
      email: credential.user.email,
      calibration: DEFAULT_CALIBRATION,
    });
    return credential;
  };

  const signOut = () => {
    return firebaseSignOut(auth);
  };

  return { user, loading, signIn, signUp, signOut };
}
