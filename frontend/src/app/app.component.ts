import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { User } from 'firebase/auth';
import { FirebaseClientService } from './firebase-client.service';
import { LearnerReport, PlatformApiService, QuizQuestion } from './platform-api.service';

type UserRole = 'student' | 'teacher' | 'admin';

interface Lesson {
  id: number;
  key: string;
  title: string;
  detail: string;
  duration: string;
  complete: boolean;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule],
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
  pathTitle = 'Build a confident AI foundation';
  pathRationale = 'Picked for your goals, recent assessment, and the skills you want to grow.';
  reportSnapshot: LearnerReport | null = null;
  quizQuestions: QuizQuestion[] = [];
  quizId = '';
  selectedAnswers: number[] = [];
  quizScore: number | null = null;
  quizFeedback = '';
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

  signIn(role: UserRole): void {
    this.role = role;
    this.authenticated = true;
  }

  async signInWithProvider(provider: 'google' | 'microsoft'): Promise<void> {
    if (!this.firebaseClient.isConfigured) {
      this.signIn('student');
      return;
    }

    this.busy = true;
    this.authError = '';
    try {
      const user = await this.firebaseClient.signIn(provider);
      await this.activateUser(user);
    } catch {
      this.authError = 'Sign-in could not be completed. Check your Firebase provider setup and try again.';
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
      this.authError = 'Your saved session could not be restored. Sign in again to continue.';
    }
  }

  private async activateUser(user: User): Promise<void> {
    await this.firebaseClient.ensureUserProfile(user);
    this.role = await this.firebaseClient.getRole(user);
    this.stopWatchingProgress?.();
    this.stopWatchingProgress = await this.firebaseClient.watchProgress(user.uid, (records) => {
      const currentCourse = records.find((record) => record['courseId'] === 'ai-foundations');
      if (!currentCourse) {
        return;
      }
      const completedIds = new Set(Array.isArray(currentCourse['completedLessonIds'])
        ? currentCourse['completedLessonIds'] as string[]
        : []);
      this.completedLessonKeys = completedIds;
      this.lessons = this.lessons.map((lesson) => ({ ...lesson, complete: completedIds.has(lesson.key) }));
    }, () => {
      this.apiError = 'Live progress updates are unavailable. Refresh to reconnect.';
    });
    this.authenticated = true;
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
    } else {
      await this.generatePath();
    }
  }

  setRole(role: UserRole): void {
    this.role = role;
  }

  async generatePath(): Promise<void> {
    if (this.demoMode) {
      this.pathGenerated = true;
      this.activeTab = 'My learning';
      return;
    }

    this.busy = true;
    this.apiError = '';
    try {
      const path = await this.platformApi.generatePath('Build practical AI skills for real-world projects', ['AI fundamentals', 'data literacy'], this.benchmarkScore);
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
    if (!this.demoMode) {
      this.busy = true;
      this.apiError = '';
      try {
        await this.platformApi.updateProgress('ai-foundations', this.lessons.find((lesson) => lesson.id === id)!.key);
      } catch {
        this.apiError = 'Progress could not be saved. Your lesson is still available to try again.';
        this.busy = false;
        return;
      }
      this.busy = false;
    }
    this.lessons = this.lessons.map((lesson) => lesson.id === id ? { ...lesson, complete: true } : lesson);
  }

  async openReport(): Promise<void> {
    this.reportOpen = true;
    this.activeTab = 'Reports';
    if (this.demoMode) {
      return;
    }
    try {
      this.reportSnapshot = await this.platformApi.getMyReport();
    } catch {
      this.apiError = 'Your report could not be loaded. Check the reporting service.';
    }
  }

  async startQuiz(): Promise<void> {
    this.quizScore = null;
    this.quizFeedback = '';
    this.selectedAnswers = [];
    this.apiError = '';
    try {
      if (this.demoMode) {
        this.quizQuestions = [
          { id: 0, prompt: 'Which step helps you check whether a model generalizes?', options: ['Add more labels to the test set', 'Evaluate on unseen data', 'Train until accuracy reaches 100%'], correctOption: 1 },
          { id: 1, prompt: 'What is a useful first check for dataset bias?', options: ['Compare representation across relevant groups', 'Remove all missing values', 'Use a larger model'], correctOption: 0 },
          { id: 2, prompt: 'What does a validation set help estimate?', options: ['Performance during model selection', 'The number of training rows', 'The model deployment cost'], correctOption: 0 }
        ];
      } else {
        const quiz = await this.platformApi.createQuiz('AI fundamentals and responsible data use', this.benchmarkScore);
        this.quizId = quiz.quizId;
        this.quizQuestions = quiz.questions;
      }
    } catch {
      this.apiError = 'An adaptive quiz could not be created. Check the AI service and try again.';
    }
  }

  async submitQuiz(): Promise<void> {
    if (!this.allQuizAnswersSelected) {
      return;
    }
    try {
      if (this.demoMode) {
        const correct = this.quizQuestions.filter((question, index) => question.correctOption === this.selectedAnswers[index]).length;
        this.quizScore = Math.round(correct * 100 / this.quizQuestions.length);
        this.quizFeedback = this.quizScore >= 70
          ? 'Strong work. Keep building with short, practical lessons.'
          : 'Review the related lesson, then try another short practice session.';
      } else {
        const result = await this.platformApi.submitQuiz(this.quizId, this.selectedAnswers);
        this.quizScore = result.score;
        const feedback = await this.platformApi.getFeedback(this.quizId, 'AI fundamentals');
        this.quizFeedback = feedback.summary;
      }
    } catch {
      this.apiError = 'Your quiz could not be submitted. Your answers are still on this screen.';
    }
  }

  selectAnswer(questionIndex: number, answerIndex: number): void {
    this.selectedAnswers[questionIndex] = answerIndex;
    this.selectedAnswers = [...this.selectedAnswers];
  }
}
