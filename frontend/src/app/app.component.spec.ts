import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { FirebaseClientService } from './firebase-client.service';
import { PlatformApiService } from './platform-api.service';

describe('AppComponent demo learning flow', () => {
  let component: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: FirebaseClientService, useValue: { isConfigured: false } },
        { provide: PlatformApiService, useValue: {} }
      ]
    }).compileComponents();
    component = TestBed.createComponent(AppComponent).componentInstance;
  });

  it('opens the selected role workspace', () => {
    component.signIn('teacher');

    expect(component.authenticated).toBeTrue();
    expect(component.role).toBe('teacher');
  });

  it('refreshes a path, records lesson progress, and opens a benchmark report', async () => {
    component.signIn('student');
    await component.generatePath();
    await component.completeLesson(2);
    await component.openReport();

    expect(component.pathGenerated).toBeTrue();
    expect(component.completedLessons).toBe(2);
    expect(component.progressPercent).toBe(67);
    expect(component.reportOpen).toBeTrue();
  });

  it('scores a demo quiz and returns learning feedback', async () => {
    await component.startQuiz();
    component.selectAnswer(0, 1);
    component.selectAnswer(1, 0);
    component.selectAnswer(2, 0);
    await component.submitQuiz();

    expect(component.quizScore).toBe(100);
    expect(component.quizFeedback).toContain('Strong work');
  });
});