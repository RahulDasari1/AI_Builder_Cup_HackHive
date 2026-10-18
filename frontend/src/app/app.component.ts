import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { User } from 'firebase/auth';
import { FirebaseClientService } from './firebase-client.service';
import {
  CohortStats,
  Course,
  LearnerReport,
  PlatformApiService,
  QuizQuestion,
  UserProfile
} from './platform-api.service';

export type UserRole = 'student' | 'teacher' | 'admin';

export interface Lesson {
  id: number;
  key: string;
  title: string;
  detail: string;
  duration: string;
  complete: boolean;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html'
})
export class AppComponent implements OnInit {
  constructor(
    readonly firebaseClient: FirebaseClientService,
    private readonly platformApi: PlatformApiService
  ) {}

  authenticated = false;
  authError = '';
  busy = false;
  role: UserRole = 'student';
  activeTab = 'Overview';
  reportOpen = false;
  pathGenerated = false;
  apiError = '';
  notificationMessage = '';

  pathTitle = 'Build a confident AI foundation';
  pathRationale = 'Picked for your goals, recent assessment, and the skills you want to grow.';
  reportSnapshot: LearnerReport | null = null;

  quizQuestions: QuizQuestion[] = [];
  quizId = '';
  selectedAnswers: number[] = [];
  quizScore: number | null = null;
  quizFeedback = '';

  // Enterprise Edutech Management Data
  courses: Course[] = [];
  users: UserProfile[] = [];
  cohortStats: CohortStats | null = null;

  // New course form
  newCourseTitle = '';
  newCourseCategory = 'AI & Machine Learning';
  newCourseDifficulty = 'Beginner';
  newCourseDuration = 4;

  private stopWatchingProgress?: () => void;
  private completedLessonKeys = new Set<string>();

  lessons: Lesson[] = [
    { id: 1, key: 'reading-data', title: 'Reading data with confidence', detail: 'Find the story inside a dataset', duration: '12 min', complete: true },
    { id: 2, key: 'classification-model', title: 'Your first classification model', detail: 'Train and evaluate a simple model', duration: '18 min', complete: false },
    { id: 3, key: 'bias-check', title: 'Spotting bias before it ships', detail: 'A practical fairness check', duration: '15 min', complete: false }
  ];

  get demoMode(): boolean {
    return !this.firebaseClient.isConfigured;
  }

  ngOnInit(): void {
    if (!this.demoMode) {
      void this.restoreSession();
    }
    void this.loadInitialData();
  }

  get completedLessons(): number {
    return this.lessons.filter((lesson) => lesson.complete).length;
  }

  get progressPercent(): number {
    return Math.round((this.completedLessons / this.lessons.length) * 100);
  }

  get benchmarkScore(): number {
    return this.reportSnapshot?.averageAssessmentScore || 72 + this.completedLessons * 4;
  }

  get allQuizAnswersSelected(): boolean {
    return this.quizQuestions.length > 0 &&
      this.selectedAnswers.filter((answer) => Number.isInteger(answer)).length === this.quizQuestions.length;
  }

  async loadInitialData(): Promise<void> {
    try {
      this.courses = await this.platformApi.getCourses();
      this.users = await this.platformApi.getUsers();
      this.cohortStats = await this.platformApi.getCohortReport('cohort-2026-japac');
    } catch {
      // Graceful fallback already provided by service
    }
  }

  signIn(role: UserRole): void {
    this.role = role;
    this.authenticated = true;
    this.authError = '';
    this.syncTabForRole(role);
  }

  async signInWithProvider(provider: 'google' | 'microsoft'): Promise<void> {
    this.busy = true;
    this.authError = '';
    this.notificationMessage = '';

    if (!this.firebaseClient.isConfigured) {
      this.notificationMessage = `Firebase credentials not detected. Continuing with demo workspace...`;
      this.signIn('student');
      this.busy = false;
      return;
    }

    try {
      const user = await this.firebaseClient.signIn(provider);
      await this.activateUser(user);
    } catch (err: unknown) {
      const errorMsg = (err instanceof Error) ? err.message : '';
      if (errorMsg.includes('popup-closed') || errorMsg.includes('cancelled') || errorMsg.includes('configuration-not-found')) {
        this.notificationMessage = 'OAuth provider window closed or pending configuration. Opening interactive workspace as Student...';
      } else {
        this.notificationMessage = 'Connected to workspace with local session fallback.';
      }
      this.signIn('student');
    } finally {
      this.busy = false;
    }
  }

  async signOut(): Promise<void> {
    this.busy = true;
    try {
      await this.firebaseClient.signOut();
    } finally {
      this.stopWatchingProgress?.();
      this.authenticated = false;
      this.role = 'student';
      this.activeTab = 'Overview';
      this.busy = false;
    }
  }

  setRole(role: UserRole): void {
    this.role = role;
    this.syncTabForRole(role);
  }

  syncTabForRole(role: UserRole): void {
    switch (role) {
      case 'student':
        if (!['Overview', 'My learning', 'Assessments', 'Reports'].includes(this.activeTab)) {
          this.activeTab = 'Overview';
        }
        break;
      case 'teacher':
        if (!['Cohort Pulse', 'Curriculum Manager', 'Assessment Review', 'Class Reports'].includes(this.activeTab)) {
          this.activeTab = 'Cohort Pulse';
        }
        break;
      case 'admin':
        if (!['Platform Health', 'Course Catalog', 'User Directory', 'AI Analytics'].includes(this.activeTab)) {
          this.activeTab = 'Platform Health';
        }
        break;
    }
  }

  selectTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'Reports' || tab === 'Class Reports') {
      void this.openReport();
    }
    if (tab === 'Assessments' && this.quizQuestions.length === 0) {
      void this.startQuiz();
    }
  }

  async generatePath(): Promise<void> {
    this.busy = true;
    this.apiError = '';
    try {
      const path = await this.platformApi.generatePath(
        'Build practical AI skills for real-world projects',
        ['AI fundamentals', 'data literacy'],
        this.benchmarkScore
      );
      this.pathTitle = path.title;
      this.pathRationale = path.rationale;
      this.lessons = path.lessons.map((lesson, index) => ({
        id: index + 1,
        key: lesson.id,
        title: lesson.title,
        detail: lesson.detail,
        duration: `${lesson.durationMinutes} min`,
        complete: this.completedLessonKeys.has(lesson.id)
      }));
      this.pathGenerated = true;
      this.activeTab = 'My learning';
    } catch {
      this.apiError = 'The AI learning path could not be refreshed. Check the AI service and try again.';
    } finally {
      this.busy = false;
    }
  }

  async completeLesson(id: number): Promise<void> {
    this.busy = true;
    this.apiError = '';
    const target = this.lessons.find((l) => l.id === id);
    if (!target) {
      this.busy = false;
      return;
    }

    try {
      await this.platformApi.updateProgress('ai-foundations', target.key);
      this.completedLessonKeys.add(target.key);
    } catch {
      // Local completion guaranteed below
    }

    this.lessons = this.lessons.map((lesson) =>
      lesson.id === id ? { ...lesson, complete: true } : lesson
    );
    this.busy = false;
  }

  async openReport(): Promise<void> {
    this.reportOpen = true;
    try {
      this.reportSnapshot = await this.platformApi.getMyReport();
    } catch {
      this.apiError = 'Your report could not be loaded. Showing latest local analytics.';
    }
  }

  async startQuiz(): Promise<void> {
    this.quizScore = null;
    this.quizFeedback = '';
    this.selectedAnswers = [];
    this.apiError = '';

    try {
      const quiz = await this.platformApi.createQuiz('AI fundamentals and responsible data use', this.benchmarkScore);
      this.quizId = quiz.quizId;
      this.quizQuestions = quiz.questions;
    } catch {
      this.apiError = 'An adaptive quiz could not be created. Please try again.';
    }
  }

  async submitQuiz(): Promise<void> {
    if (!this.allQuizAnswersSelected) {
      return;
    }
    this.busy = true;
    try {
      const result = await this.platformApi.submitQuiz(this.quizId, this.selectedAnswers);
      this.quizScore = result.score;
      const feedback = await this.platformApi.getFeedback(this.quizId, 'AI fundamentals');
      this.quizFeedback = feedback.summary;
    } catch {
      this.apiError = 'Your quiz could not be submitted. Please check connection and retry.';
    } finally {
      this.busy = false;
    }
  }

  selectAnswer(questionIndex: number, answerIndex: number): void {
    this.selectedAnswers[questionIndex] = answerIndex;
    this.selectedAnswers = [...this.selectedAnswers];
  }

  // Course Catalog Actions (Admin / Teacher)
  async addCourse(): Promise<void> {
    if (!this.newCourseTitle.trim()) return;
    this.busy = true;
    try {
      const created = await this.platformApi.createCourse({
        title: this.newCourseTitle.trim(),
        category: this.newCourseCategory,
        difficulty: this.newCourseDifficulty,
        durationHours: this.newCourseDuration,
        published: true,
        description: `Comprehensive module covering ${this.newCourseCategory}.`
      });
      this.courses = [created, ...this.courses];
      this.newCourseTitle = '';
    } finally {
      this.busy = false;
    }
  }

  async removeCourse(id: string): Promise<void> {
    this.busy = true;
    try {
      await this.platformApi.deleteCourse(id);
      this.courses = this.courses.filter((c) => c.id !== id);
    } finally {
      this.busy = false;
    }
  }

  // User Role Management (Admin)
  async changeUserRole(uid: string, newRole: 'student' | 'teacher' | 'admin'): Promise<void> {
    this.busy = true;
    try {
      await this.platformApi.updateUserRole(uid, newRole);
      this.users = this.users.map((u) => (u.uid === uid ? { ...u, role: newRole } : u));
    } finally {
      this.busy = false;
    }
  }

  private async restoreSession(): Promise<void> {
    try {
      const user = await this.firebaseClient.getCurrentUser();
      if (user) {
        await this.activateUser(user);
      }
    } catch {
      this.authError = 'Session expired. Sign in to continue.';
    }
  }

  private async activateUser(user: User): Promise<void> {
    await this.firebaseClient.ensureUserProfile(user);
    this.role = await this.firebaseClient.getRole(user);
    this.stopWatchingProgress?.();
    this.stopWatchingProgress = await this.firebaseClient.watchProgress(user.uid, (records) => {
      const currentCourse = records.find((record) => record['courseId'] === 'ai-foundations');
      if (!currentCourse) return;
      const completedIds = new Set(
        Array.isArray(currentCourse['completedLessonIds'])
          ? (currentCourse['completedLessonIds'] as string[])
          : []
      );
      this.completedLessonKeys = completedIds;
      this.lessons = this.lessons.map((lesson) => ({
        ...lesson,
        complete: completedIds.has(lesson.key)
      }));
    }, () => {
      this.apiError = 'Live progress updates are unavailable. Reconnecting...';
    });

    this.authenticated = true;
    this.syncTabForRole(this.role);
    const path = await this.platformApi.getMyLearningPath();
    if (path) {
      this.pathTitle = path.title;
      this.pathRationale = path.rationale;
      this.lessons = path.lessons.map((lesson, index) => ({
        id: index + 1,
        key: lesson.id,
        title: lesson.title,
        detail: lesson.detail,
        duration: `${lesson.durationMinutes} min`,
        complete: this.completedLessonKeys.has(lesson.id)
      }));
      this.pathGenerated = true;
    }
  }
}
