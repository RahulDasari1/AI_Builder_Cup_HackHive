import { Injectable } from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseClientService {
  readonly isConfigured = Boolean(environment.firebase.apiKey && environment.firebase.projectId);
  private app?: FirebaseApp;

  async signIn(providerName: 'google' | 'microsoft'): Promise<User> {
    const { GoogleAuthProvider, OAuthProvider, getAuth, signInWithPopup } = await import('firebase/auth');
    const provider = providerName === 'google'
      ? new GoogleAuthProvider()
      : new OAuthProvider('microsoft.com');
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(getAuth(await this.firebaseApp()), provider);
    return result.user;
  }

  async getCurrentUser(): Promise<User | null> {
    const { getAuth, onAuthStateChanged } = await import('firebase/auth');
    const auth = getAuth(await this.firebaseApp());
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      }, (error) => {
        unsubscribe();
        reject(error);
      });
    });
  }

  async ensureUserProfile(user: User): Promise<void> {
    const { doc, getDoc, getFirestore, serverTimestamp, setDoc } = await import('firebase/firestore');
    const profileRef = doc(getFirestore(await this.firebaseApp()), 'Users', user.uid);
    const existing = await getDoc(profileRef);
    const profile = existing.exists()
      ? { displayName: user.displayName, photoURL: user.photoURL, updatedAt: serverTimestamp() }
      : {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
    await setDoc(profileRef, profile, { merge: true });
  }

  async getRole(user: User): Promise<'student' | 'teacher' | 'admin'> {
    const token = await user.getIdTokenResult();
    const role = token.claims['role'];
    return role === 'teacher' || role === 'admin' ? role : 'student';
  }

  async watchProgress(
    uid: string,
    onValue: (progress: Record<string, unknown>[]) => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    const { collection, getFirestore, onSnapshot, query, where } = await import('firebase/firestore');
    const db = getFirestore(await this.firebaseApp());
    return onSnapshot(
      query(collection(db, 'Progress'), where('uid', '==', uid)),
      (snapshot) => onValue(snapshot.docs.map((document) => document.data())),
      onError
    );
  }

  async getIdToken(): Promise<string | undefined> {
    const { getAuth } = await import('firebase/auth');
    return getAuth(await this.firebaseApp()).currentUser?.getIdToken();
  }

  private async firebaseApp(): Promise<FirebaseApp> {
    if (!this.isConfigured) {
      throw new Error('Firebase is not configured.');
    }
    if (this.app) {
      return this.app;
    }
    const { getApp, getApps, initializeApp } = await import('firebase/app');
    this.app = getApps().some((app) => app.name === '[DEFAULT]')
      ? getApp()
      : initializeApp(environment.firebase);
    return this.app;
  }
}