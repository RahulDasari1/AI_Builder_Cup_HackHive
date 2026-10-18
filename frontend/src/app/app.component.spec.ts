import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app.component';
import { FirebaseClientService } from './firebase-client.service';
import { PlatformApiService } from './platform-api.service';

describe('AppComponent Enterprise Edutech Platform Tests', () => {
  let component: AppComponent;
  let mockPlatformApi: jasmine.SpyObj<PlatformApiService>;
  let mockFirebaseClient: jasmine.SpyObj<FirebaseClientService>;

  beforeEach(async () => {
    mockPlatformApi = jasmine.createSpyObj<PlatformApiService>('PlatformApiService', [
      'generatePath',
      'getMyLearningPath',
      'updateProgress',
      'createQuiz',
      'submitQuiz',
      'getFeedback',
      'getMyReport',
      'getCourses',
      'createCourse',
      'deleteCourse',
      'getUsers',
      'updateUserRole',
      'getCohortReport',
      'getPresetCuratedCourses',
      'curateCourseWithGemini'
    ]);

    mockPlatformApi.getCourses.and.returnValue(Promise.resolve([
      { id: 'c1', title: 'AI Foundations', description: 'Basics of ML', category: 'AI & Machine Learning', published: true, durationHours: 4, difficulty: 'Beginner' }
    ]));
    mockPlatformApi.getUsers.and.returnValue(Promise.resolve([
      { uid: 'u1', displayName: 'Ari Morgan', email: 'ari@hackhive.edu', role: 'student' }
    ]));
    mockPlatformApi.getCohortReport.and.returnValue(Promise.resolve({
      cohortId: 'cohort-2026-japac',
      learnerCount: 25,
      activeLearners: 20,
      averageAssessmentScore: 82,
      courseProgressRecords: 95
    }));
    mockPlatformApi.getPresetCuratedCourses.and.returnValue([
      {
        id: 'curated-ai-fundamentals',
        title: 'AI Fundamentals & Deep Learning Systems',
        topic: 'AI Fundamentals',
        overview: 'Deep dive into neural networks',
        targetAudience: 'Learners',
        difficulty: 'Beginner to Intermediate',
        estimatedHours: 6,
        status: 'published',
        approvedBy: 'Dr. Elena Vance',
        createdAt: '2026-10-18T00:00:00Z',
        updatedAt: '2026-10-18T00:00:00Z',
        modules: [
          {
            id: 'mod-1',
            title: 'Neural Foundations',
            summary: 'Core perceptrons',
            lessons: [
              {
                id: 'les-1',
                title: 'Perceptrons to Multilayer Networks',
                description: 'Foundation lesson',
                objectives: ['Learn forward pass', 'Understand backpropagation'],
                suggestedAssessment: 'Explain gradient descent step.',
                durationMinutes: 20,
                videos: [
                  {
                    id: 'aircAruvnKk',
                    title: 'Neural Networks by 3Blue1Brown',
                    channel: '3Blue1Brown',
                    channelTitle: '3Blue1Brown',
                    duration: '19:13',
                    url: 'https://www.youtube.com/watch?v=aircAruvnKk',
                    embedUrl: 'https://www.youtube.com/embed/aircAruvnKk',
                    thumbnailUrl: 'https://img.youtube.com/vi/aircAruvnKk/hqdefault.jpg'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]);
    mockPlatformApi.curateCourseWithGemini.and.callFake((topic: string) => Promise.resolve({
      id: `curated-${topic.toLowerCase().replace(/\s+/g, '-')}`,
      title: `${topic} Masterclass`,
      topic,
      overview: `Gemini generated overview for ${topic}`,
      targetAudience: 'Students and engineers',
      difficulty: 'Intermediate',
      estimatedHours: 5,
      status: 'approved',
      approvedBy: 'Gemini Curriculum Architect',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      modules: [
        {
          id: 'gen-mod-1',
          title: `Core Foundations of ${topic}`,
          summary: 'Detailed fundamentals',
          lessons: [
            {
              id: 'gen-les-1',
              title: `Architectural Principles of ${topic}`,
              description: 'Generated lesson',
              objectives: ['Objective 1', 'Objective 2'],
              suggestedAssessment: 'Explain key mechanics.',
              durationMinutes: 25,
              videos: [
                {
                  id: 'aircAruvnKk',
                  title: 'Deep Learning Basics',
                  channel: '3Blue1Brown',
                  channelTitle: '3Blue1Brown',
                  duration: '19:13',
                  url: 'https://www.youtube.com/watch?v=aircAruvnKk',
                  embedUrl: 'https://www.youtube.com/embed/aircAruvnKk',
                  thumbnailUrl: 'https://img.youtube.com/vi/aircAruvnKk/hqdefault.jpg'
                }
              ]
            }
          ]
        }
      ]
    }));
    mockPlatformApi.generatePath.and.returnValue(Promise.resolve({
      title: 'Adaptive AI Foundations',
      rationale: 'Calibrated for your goals',
      lessons: [
        { id: '1-data', title: 'Data Prep', detail: 'Clean data', durationMinutes: 15 },
        { id: '2-model', title: 'Train Model', detail: 'Train classifier', durationMinutes: 20 }
      ]
    }));
    mockPlatformApi.createQuiz.and.returnValue(Promise.resolve({
      quizId: 'quiz-123',
      topic: 'AI Ethics',
      questions: [
        { id: 0, prompt: 'Q1', options: ['A', 'B', 'C', 'D'], correctOption: 1 },
        { id: 1, prompt: 'Q2', options: ['A', 'B', 'C', 'D'], correctOption: 0 }
      ]
    }));
    mockPlatformApi.submitQuiz.and.returnValue(Promise.resolve({
      score: 100,
      explanations: ['Explanation 1', 'Explanation 2']
    }));
    mockPlatformApi.getFeedback.and.returnValue(Promise.resolve({
      summary: 'Strong work on AI Ethics.',
      nextSteps: ['Continue to Advanced Topics']
    }));
    mockPlatformApi.createCourse.and.callFake((c) => Promise.resolve({
      id: 'c-new',
      title: c.title || 'New Course',
      description: 'Desc',
      category: c.category || 'AI',
      published: true,
      durationHours: c.durationHours || 4,
      difficulty: c.difficulty || 'Beginner'
    }));
    mockPlatformApi.deleteCourse.and.returnValue(Promise.resolve(true));
    mockPlatformApi.updateUserRole.and.returnValue(Promise.resolve(true));

    mockFirebaseClient = jasmine.createSpyObj<FirebaseClientService>('FirebaseClientService', [
      'signIn',
      'signOut',
      'getCurrentUser',
      'ensureUserProfile',
      'getRole',
      'watchProgress',
      'getIdToken',
      'saveCourseToFirestore',
      'deleteCourseFromFirestore',
      'saveQuizResultToFirestore',
      'updateUserRoleInFirestore',
      'saveProgressToFirestore',
      'saveInquiry',
      'saveAgentTraceToFirestore',
      'saveCuratedCourseToFirestore',
      'watchCuratedCourses',
      'updateCuratedCourseStatus',
      'saveCuratedProgress',
      'watchCuratedProgress'
    ], {
      isConfigured: true
    });

    mockFirebaseClient.signOut.and.returnValue(Promise.resolve());
    mockFirebaseClient.getCurrentUser.and.returnValue(Promise.resolve(null));
    mockFirebaseClient.saveCourseToFirestore.and.returnValue(Promise.resolve());
    mockFirebaseClient.deleteCourseFromFirestore.and.returnValue(Promise.resolve());
    mockFirebaseClient.saveQuizResultToFirestore.and.returnValue(Promise.resolve());
    mockFirebaseClient.updateUserRoleInFirestore.and.returnValue(Promise.resolve());
    mockFirebaseClient.saveProgressToFirestore.and.returnValue(Promise.resolve());
    mockFirebaseClient.saveInquiry.and.returnValue(Promise.resolve(true));
    mockFirebaseClient.saveCuratedCourseToFirestore.and.returnValue(Promise.resolve());
    mockFirebaseClient.watchCuratedCourses.and.returnValue(Promise.resolve(() => {}));
    mockFirebaseClient.updateCuratedCourseStatus.and.returnValue(Promise.resolve());
    mockFirebaseClient.saveCuratedProgress.and.returnValue(Promise.resolve());
    mockFirebaseClient.watchCuratedProgress.and.returnValue(Promise.resolve(() => {}));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        { provide: FirebaseClientService, useValue: mockFirebaseClient },
        { provide: PlatformApiService, useValue: mockPlatformApi }
      ]
    }).compileComponents();

    component = TestBed.createComponent(AppComponent).componentInstance;
  });

  it('initializes and loads workspace courses and cohort statistics', async () => {
    await component.loadInitialData();
    expect(component.courses.length).toBe(1);
    expect(component.users.length).toBe(1);
    expect(component.cohortStats?.activeLearners).toBe(20);
  });

  it('authenticates user and syncs tab for Teacher role', () => {
    component.signIn('teacher');
    expect(component.authenticated).toBeTrue();
    expect(component.role).toBe('teacher');
    expect(component.activeTab).toBe('Cohort Pulse');
  });

  it('authenticates user and syncs tab for Admin role', () => {
    component.signIn('admin');
    expect(component.authenticated).toBeTrue();
    expect(component.role).toBe('admin');
    expect(component.activeTab).toBe('Platform Health');
  });

  it('switches roles and preserves appropriate workspace tab', () => {
    component.signIn('student');
    expect(component.activeTab).toBe('Overview');

    component.setRole('teacher');
    expect(component.role).toBe('teacher');
    expect(component.activeTab).toBe('Cohort Pulse');

    component.setRole('admin');
    expect(component.role).toBe('admin');
    expect(component.activeTab).toBe('Platform Health');
  });

  it('generates a personalized Gemini learning path and records lesson progress', async () => {
    component.signIn('student');
    await component.generatePath();

    expect(component.pathGenerated).toBeTrue();
    expect(component.lessons.length).toBe(2);
    expect(component.activeTab).toBe('My learning');

    await component.completeLesson(1);
    expect(component.lessons[0].complete).toBeTrue();
    expect(component.completedLessons).toBe(1);
  });

  it('creates an adaptive quiz, selects answers, and evaluates verified score', async () => {
    component.signIn('student');
    await component.startQuiz();

    expect(component.quizQuestions.length).toBe(2);
    expect(component.allQuizAnswersSelected).toBeFalse();

    component.selectAnswer(0, 1);
    component.selectAnswer(1, 0);

    expect(component.allQuizAnswersSelected).toBeTrue();

    await component.submitQuiz();
    expect(component.quizScore).toBe(100);
    expect(component.quizFeedback).toContain('Strong work');
  });

  it('supports course creation and deletion in the admin catalog', async () => {
    component.signIn('admin');
    component.courses = [];
    component.newCourseTitle = 'Generative AI Masterclass';
    component.newCourseCategory = 'Generative AI';
    component.newCourseDifficulty = 'Advanced';
    component.newCourseDuration = 8;

    await component.addCourse();

    expect(component.courses.length).toBe(1);
    expect(component.courses[0].title).toBe('Generative AI Masterclass');

    await component.removeCourse(component.courses[0].id);
    expect(component.courses.length).toBe(0);
  });

  it('updates user role governance in user directory', async () => {
    component.signIn('admin');
    component.users = [{ uid: 'user-xyz', displayName: 'Alex Rivera', role: 'student' }];

    await component.changeUserRole('user-xyz', 'teacher');
    expect(component.users[0].role).toBe('teacher');
    expect(mockPlatformApi.updateUserRole).toHaveBeenCalledWith('user-xyz', 'teacher');
  });

  it('handles provider sign-in gracefully and opens Google account selector', async () => {
    mockFirebaseClient.signIn.and.rejectWith(new Error('auth/popup-closed-by-user'));

    await component.signInWithProvider('google');

    expect(component.showGoogleSignInScreen).toBeTrue();

    // Select account
    component.selectGoogleAccount(component.googleAccounts[0]);
    expect(component.authenticated).toBeTrue();
    expect(component.currentUserName).toBe('Alex Rivera');
    expect(component.role).toBe('student');
  });

  it('runs autonomous agentic AI workflow with ReAct trace and Firestore injection', async () => {
    component.signIn('student');
    const workflow = component.agentWorkflows[0];
    await component.runAutonomousAgentWorkflow(workflow.id, 'Bridge regularization gap');

    expect(component.agentExecutionSteps.length).toBe(4);
    expect(component.agentFinalOutput).toContain('Multi-Agent Autonomous Goal Completed');
    expect(component.lessons.some(l => l.key === 'regularization-dropout')).toBeTrue();
  });

  it('opens interactive lesson modal and marks complete', async () => {
    component.signIn('student');
    const lesson = component.lessons[0];
    component.openLesson(lesson);
    expect(component.activeLessonModal).toBe(lesson);

    await component.completeLessonAndAdvance(lesson);
    expect(component.activeLessonModal).toBeNull();
    expect(component.completedLessons).toBeGreaterThan(0);
  });

  it('submits enterprise contact form to Firestore', async () => {
    component.contactForm = {
      name: 'Dr. Jane Smith',
      email: 'jane.smith@mit.edu',
      organization: 'MIT EECS',
      cohortSize: '50-250 learners',
      message: 'Interested in Gemini-powered curriculum integration.'
    };

    await component.submitContactForm();
    expect(component.contactSubmitted).toBeTrue();
    expect(mockFirebaseClient.saveInquiry).toHaveBeenCalledWith(component.contactForm);
  });

  it('signs out and resets workspace state cleanly', async () => {
    component.signIn('teacher');
    expect(component.authenticated).toBeTrue();

    await component.signOut();

    expect(component.authenticated).toBeFalse();
    expect(component.role).toBe('student');
    expect(component.activeTab).toBe('Overview');
  });

  it('curates courses on initialization and sets selected course', async () => {
    await component.loadInitialData();
    expect(component.curatedCourses.length).toBeGreaterThan(0);
    expect(component.selectedCuratedCourse).toBeDefined();
    expect(component.selectedCuratedCourse?.modules[0].lessons[0].videos.length).toBeGreaterThan(0);
  });

  it('curates new course with Gemini AI and stores to Firestore', async () => {
    component.signIn('student');
    component.selectTab('Curated Courses');
    await component.curateNewCourse('Quantum Machine Learning');

    expect(component.selectedCuratedCourse?.title).toContain('Quantum Machine Learning Masterclass');
    expect(mockPlatformApi.curateCourseWithGemini).toHaveBeenCalledWith('Quantum Machine Learning', 'AI Fundamentals');
    expect(mockFirebaseClient.saveCuratedCourseToFirestore).toHaveBeenCalled();
  });

  it('opens and closes YouTube reference video player modal with sanitized URL', () => {
    const video = {
      id: 'aircAruvnKk',
      title: 'Neural Networks by 3Blue1Brown',
      channel: '3Blue1Brown',
      channelTitle: '3Blue1Brown',
      duration: '19:13',
      url: 'https://www.youtube.com/watch?v=aircAruvnKk',
      embedUrl: 'https://www.youtube.com/embed/aircAruvnKk',
      thumbnailUrl: 'https://img.youtube.com/vi/aircAruvnKk/hqdefault.jpg'
    };

    component.openVideoModal(video);
    expect(component.activeVideoModal).toBe(video);
    expect(component.safeVideoEmbedUrl).toBeDefined();

    component.closeVideoModal();
    expect(component.activeVideoModal).toBeNull();
    expect(component.safeVideoEmbedUrl).toBeNull();
  });

  it('allows student to toggle curated lesson completion and tracks progress percentage', async () => {
    await component.loadInitialData();
    const course = component.selectedCuratedCourse!;
    const lesson = course.modules[0].lessons[0];

    expect(component.isCuratedLessonComplete(lesson.id)).toBeFalse();
    expect(component.getCuratedCourseProgressPercent(course)).toBe(0);

    await component.toggleCuratedLessonComplete(lesson);
    expect(component.isCuratedLessonComplete(lesson.id)).toBeTrue();
    expect(component.getCuratedCourseProgressPercent(course)).toBe(100);
    expect(mockFirebaseClient.saveCuratedProgress).toHaveBeenCalled();

    await component.toggleCuratedLessonComplete(lesson);
    expect(component.isCuratedLessonComplete(lesson.id)).toBeFalse();
  });

  it('allows teacher to approve and publish course status to Cloud Firestore', async () => {
    component.signIn('teacher');
    await component.loadInitialData();
    const course = component.selectedCuratedCourse!;

    await component.updateCuratedCourseApproval(course, 'approved');
    expect(course.status).toBe('approved');
    expect(course.approvedBy).toContain('Dr. Elena Vance');
    expect(mockFirebaseClient.updateCuratedCourseStatus).toHaveBeenCalledWith(course.id, 'approved', jasmine.any(String));

    await component.updateCuratedCourseApproval(course, 'published');
    expect(course.status).toBe('published');
    expect(mockFirebaseClient.updateCuratedCourseStatus).toHaveBeenCalledWith(course.id, 'published', jasmine.any(String));
  });

  it('evaluates student assessment response using Gemini AI and records mastery', async () => {
    await component.loadInitialData();
    const course = component.selectedCuratedCourse!;
    const lesson = course.modules[0].lessons[0];

    component.openAssessmentModal(lesson);
    expect(component.activeAssessmentLesson).toBe(lesson);

    component.assessmentSubmissionText = 'Gradient descent iteratively updates network weights in the direction opposite to the gradient of the loss function.';
    await component.submitAssessmentResponse();

    expect(component.assessmentFeedbackText).toContain('Gemini 2.5 Psychometric Evaluation');
    expect(component.assessmentFeedbackText).toContain('94/100');
    expect(component.isCuratedLessonComplete(lesson.id)).toBeTrue();
    expect(mockFirebaseClient.saveCuratedProgress).toHaveBeenCalled();
  });
});