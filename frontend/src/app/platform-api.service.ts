import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { FirebaseClientService } from './firebase-client.service';

export interface LearningPathResponse {
  title: string;
  rationale: string;
  lessons: { id: string; title: string; detail: string; durationMinutes: number }[];
}

export interface QuizQuestion {
  id: number;
  prompt: string;
  options: string[];
  correctOption?: number;
}

export interface QuizResponse {
  quizId: string;
  topic: string;
  questions: QuizQuestion[];
}

export interface LearnerReport {
  courseCount: number;
  completedLessons: number;
  averageAssessmentScore: number;
}

@Injectable({ providedIn: 'root' })
export class PlatformApiService {
  constructor(private readonly http: HttpClient, private readonly firebase: FirebaseClientService) {}

  async generatePath(goal: string, skills: string[], recentScore: number): Promise<LearningPathResponse> {
    return firstValueFrom(this.http.post<LearningPathResponse>(
      `${environment.services.ai}/api/ai/learning-path`,
      { goal, skills, recentScore },
      { headers: await this.authHeaders() }
    ));
  }

  async getMyLearningPath(): Promise<LearningPathResponse | null> {
    return firstValueFrom(this.http.get<LearningPathResponse | null>(
      `${environment.services.ai}/api/ai/learning-paths/me`,
      { headers: await this.authHeaders() }
    ));
  }

  async updateProgress(courseId: string, lessonId: string): Promise<void> {
    await firstValueFrom(this.http.put<void>(
      `${environment.services.learning}/api/learning/progress/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
      {},
      { headers: await this.authHeaders() }
    ));
  }

  async createQuiz(topic: string, recentScore: number): Promise<QuizResponse> {
    return firstValueFrom(this.http.post<QuizResponse>(
      `${environment.services.ai}/api/ai/quizzes`,
      { topic, courseId: 'ai-foundations', recentScore, difficulty: 'adaptive', questionCount: 3 },
      { headers: await this.authHeaders() }
    ));
  }

  async submitQuiz(quizId: string, answers: number[]): Promise<{ score: number; explanations: string[] }> {
    return firstValueFrom(this.http.post<{ score: number; explanations: string[] }>(
      `${environment.services.ai}/api/ai/quizzes/${encodeURIComponent(quizId)}/submit`,
      { answers },
      { headers: await this.authHeaders() }
    ));
  }

  async getFeedback(quizId: string, skill: string): Promise<{ summary: string; nextSteps: string[] }> {
    return firstValueFrom(this.http.post<{ summary: string; nextSteps: string[] }>(
      `${environment.services.ai}/api/ai/feedback`,
      { skill, quizId },
      { headers: await this.authHeaders() }
    ));
  }

  async getMyReport(): Promise<LearnerReport> {
    return firstValueFrom(this.http.get<LearnerReport>(
      `${environment.services.reports}/api/reports/me`,
      { headers: await this.authHeaders() }
    ));
  }

  private async authHeaders(): Promise<HttpHeaders> {
    const token = await this.firebase.getIdToken();
    if (!token) {
      throw new Error('Sign in to access your learning data.');
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}