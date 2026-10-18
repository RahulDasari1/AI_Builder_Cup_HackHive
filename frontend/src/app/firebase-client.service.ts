import { Injectable } from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseClientService {
  readonly isConfigured = Boolean(environment.firebase.apiKey && environment.firebase.projectId);
  private app?: FirebaseApp;

  async signIn(providerName: 'google' | 'microsoft'): Promise<User> {
    if (!this.isConfigured) {
      throw new Error('Firebase credentials are not configured.');
    }

    const { GoogleAuthProvider, OAuthProvider, getAuth, signInWithPopup } = await import('firebase/auth');
    const provider = providerName === 'google'
      ? new GoogleAuthProvider()
      : new OAuthProvider('microsoft.com');

    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(getAuth(await this.firebaseApp()), provider);
    return result.user;
  }

  async signOut(): Promise<void> {
    if (this.isConfigured) {
      try {
        const { getAuth, signOut } = await import('firebase/auth');
        await signOut(getAuth(await this.firebaseApp()));
      } catch {
        // Silently handled
      }
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.isConfigured) return null;
    try {
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
    } catch {
      return null;
    }
  }

  async ensureUserProfile(user: User, role: 'student' | 'teacher' | 'admin' = 'student'): Promise<void> {
    if (!this.isConfigured) return;
    try {
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
            role,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
      await setDoc(profileRef, profile, { merge: true });
    } catch {
      // Offline/demo tolerance
    }
  }

  async getRole(user: User): Promise<'student' | 'teacher' | 'admin'> {
    try {
      const token = await user.getIdTokenResult();
      const role = token.claims['role'];
      if (role === 'teacher' || role === 'admin') return role;
    } catch {
      // Fallback to Firestore check below
    }

    try {
      if (this.isConfigured) {
        const { doc, getDoc, getFirestore } = await import('firebase/firestore');
        const profileRef = doc(getFirestore(await this.firebaseApp()), 'Users', user.uid);
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data && (data['role'] === 'teacher' || data['role'] === 'admin')) {
            return data['role'];
          }
        }
      }
    } catch {
      // Fallback
    }

    return 'student';
  }

  async saveInquiry(inquiry: {
    name: string;
    email: string;
    organization: string;
    cohortSize: string;
    message: string;
  }): Promise<boolean> {
    if (!this.isConfigured) return true;
    try {
      const { addDoc, collection, getFirestore, serverTimestamp } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      await addDoc(collection(db, 'Inquiries'), {
        ...inquiry,
        createdAt: serverTimestamp()
      });
      return true;
    } catch {
      return true;
    }
  }

  async saveCourseToFirestore(course: {
    id: string;
    title: string;
    description: string;
    category: string;
    published: boolean;
    durationHours: number;
    difficulty: string;
  }): Promise<void> {
    if (!this.isConfigured) return;
    try {
      const { doc, getFirestore, serverTimestamp, setDoc } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      await setDoc(doc(db, 'Courses', course.id), {
        ...course,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch {
      // Graceful offline tolerance
    }
  }

  async deleteCourseFromFirestore(courseId: string): Promise<void> {
    if (!this.isConfigured) return;
    try {
      const { deleteDoc, doc, getFirestore } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      await deleteDoc(doc(db, 'Courses', courseId));
    } catch {
      // Graceful offline tolerance
    }
  }

  async saveQuizResultToFirestore(quizAttempt: {
    quizId: string;
    uid: string;
    score: number;
    topic: string;
    answers: number[];
  }): Promise<void> {
    if (!this.isConfigured) return;
    try {
      const { addDoc, collection, getFirestore, serverTimestamp } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      await addDoc(collection(db, 'Assessments'), {
        ...quizAttempt,
        submittedAt: serverTimestamp()
      });
    } catch {
      // Graceful offline tolerance
    }
  }

  async updateUserRoleInFirestore(uid: string, role: 'student' | 'teacher' | 'admin'): Promise<void> {
    if (!this.isConfigured) return;
    try {
      const { doc, getFirestore, serverTimestamp, setDoc } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      await setDoc(doc(db, 'Users', uid), {
        role,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch {
      // Graceful offline tolerance
    }
  }

  async saveProgressToFirestore(uid: string, courseId: string, completedLessonIds: string[]): Promise<void> {
    if (!this.isConfigured) return;
    try {
      const { doc, getFirestore, serverTimestamp, setDoc } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      await setDoc(doc(db, 'Progress', `${uid}_${courseId}`), {
        uid,
        courseId,
        completedLessonIds,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch {
      // Graceful offline tolerance
    }
  }

  async watchProgress(
    uid: string,
    onValue: (progress: Record<string, unknown>[]) => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    if (!this.isConfigured) return () => {};
    try {
      const { collection, getFirestore, onSnapshot, query, where } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      return onSnapshot(
        query(collection(db, 'Progress'), where('uid', '==', uid)),
        (snapshot) => onValue(snapshot.docs.map((document) => document.data())),
        onError
      );
    } catch (err) {
      onError(err as Error);
      return () => {};
    }
  }

  async watchCourses(
    onValue: (courses: Record<string, unknown>[]) => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    if (!this.isConfigured) return () => {};
    try {
      const { collection, getFirestore, onSnapshot } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      return onSnapshot(
        collection(db, 'Courses'),
        (snapshot) => onValue(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))),
        onError
      );
    } catch (err) {
      onError(err as Error);
      return () => {};
    }
  }

  async saveAgentTraceToFirestore(trace: {
    agentName: string;
    goal: string;
    toolCalls: string[];
    status: string;
    result: string;
  }): Promise<void> {
    if (!this.isConfigured) return;
    try {
      const { addDoc, collection, getFirestore, serverTimestamp } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      await addDoc(collection(db, 'AgentTraces'), {
        ...trace,
        createdAt: serverTimestamp()
      });
    } catch {
      // Graceful offline tolerance
    }
  }

  async saveCuratedCourseToFirestore(course: Record<string, unknown>): Promise<void> {
    if (!this.isConfigured) return;
    try {
      const { doc, getFirestore, serverTimestamp, setDoc } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      await setDoc(doc(db, 'CuratedCourses', course['id'] as string), {
        ...course,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch {
      // Offline tolerance
    }
  }

  async watchCuratedCourses(
    onValue: (courses: Record<string, unknown>[]) => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    if (!this.isConfigured) return () => {};
    try {
      const { collection, getFirestore, onSnapshot } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      return onSnapshot(
        collection(db, 'CuratedCourses'),
        (snapshot) => onValue(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))),
        onError
      );
    } catch (err) {
      onError(err as Error);
      return () => {};
    }
  }

  async updateCuratedCourseStatus(courseId: string, status: string, approverName?: string): Promise<void> {
    if (!this.isConfigured) return;
    try {
      const { doc, getFirestore, serverTimestamp, updateDoc } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      await updateDoc(doc(db, 'CuratedCourses', courseId), {
        status,
        approvedBy: approverName || 'Faculty Lead',
        updatedAt: serverTimestamp()
      });
    } catch {
      // Offline tolerance
    }
  }

  async saveCuratedProgress(uid: string, courseId: string, completedLessonIds: string[]): Promise<void> {
    if (!this.isConfigured) return;
    try {
      const { doc, getFirestore, serverTimestamp, setDoc } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      await setDoc(doc(db, 'CuratedProgress', `${uid}_${courseId}`), {
        uid,
        courseId,
        completedLessonIds,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch {
      // Offline tolerance
    }
  }

  async watchCuratedProgress(
    uid: string,
    courseId: string,
    onValue: (completedIds: string[]) => void
  ): Promise<() => void> {
    if (!this.isConfigured) return () => {};
    try {
      const { doc, getFirestore, onSnapshot } = await import('firebase/firestore');
      const db = getFirestore(await this.firebaseApp());
      return onSnapshot(
        doc(db, 'CuratedProgress', `${uid}_${courseId}`),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            onValue((data?.['completedLessonIds'] as string[]) || []);
          } else {
            onValue([]);
          }
        },
        () => {}
      );
    } catch {
      return () => {};
    }
  }

  async getIdToken(): Promise<string | undefined> {
    if (!this.isConfigured) return undefined;
    try {
      const { getAuth } = await import('firebase/auth');
      return getAuth(await this.firebaseApp()).currentUser?.getIdToken();
    } catch {
      return undefined;
    }
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