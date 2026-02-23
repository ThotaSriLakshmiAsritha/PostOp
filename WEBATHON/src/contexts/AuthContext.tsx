import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

interface UserData {
  uid: string;
  email: string;
  role: 'patient' | 'doctor';
  name?: string;
  hospital_id?: string;
  surgery_type?: string;
}

interface RegisterProfile {
  hospital_id?: string;
  surgery_type?: string;
}

interface AuthContextType {
  user: UserData | null;
  firebaseUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    role: 'patient' | 'doctor',
    name: string,
    profile?: RegisterProfile
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser({ uid: firebaseUser.uid, ...userDoc.data() } as UserData);
        }
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (
    email: string,
    password: string,
    role: 'patient' | 'doctor',
    name: string,
    profile?: RegisterProfile
  ) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    const hospital_id = profile?.hospital_id?.trim();
    const surgery_type = profile?.surgery_type?.trim();

    if (role === 'doctor' && (!hospital_id || !surgery_type)) {
      throw new Error('hospital_id and surgery_type are required for doctor registration');
    }

    const userData = {
      email,
      role,
      name,
      hospital_id: hospital_id || null,
      surgery_type: surgery_type || null,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', userCredential.user.uid), userData);

    if (role === 'doctor') {
      await setDoc(
        doc(db, 'doctors', userCredential.user.uid),
        {
          name,
          email,
          hospital_id,
          surgery_type,
          created_at: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
