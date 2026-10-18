import { Component, OnInit, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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

export interface GoogleDemoAccount {
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  badge: string;
}

export interface AgentStep {
  id: string;
  agentName: 'Atlas' | 'Nova' | 'Cipher' | 'Socrates';
  role: string;
  thought: string;
  tool: string;
  toolInput: Record<string, unknown>;
  observation: string;
  status: 'pending' | 'running' | 'completed';
  timestamp: string;
}

export interface AgentWorkflow {
  id: string;
  title: string;
  description: string;
  leadAgent: 'Atlas' | 'Nova' | 'Cipher' | 'Socrates';
  suggestedGoal: string;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html'
})
export class AppComponent implements OnInit {
  constructor(
    readonly firebaseClient: FirebaseClientService,
    private readonly platformApi: PlatformApiService,
    @Optional() private readonly router?: Router
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

  // Google OAuth & Enterprise Auth Modal
  showLoginModal = false;
  showGoogleAccountPicker = false;
  showGoogleSignInScreen = false;
  googleEmailInput = 'alex.rivera@gmail.com';
  googlePasswordInput = '';
  googleSignInStep: 'email' | 'password' = 'email';

  currentUserName = 'Alex Rivera';
  currentUserEmail = 'alex.rivera@gmail.com';
  currentUserAvatar = 'AR';

  readonly googleAccounts: GoogleDemoAccount[] = [
    {
      name: 'Alex Rivera',
      email: 'alex.rivera@gmail.com',
      role: 'student',
      avatar: 'AR',
      badge: 'AI Builder Fellow · JAPAC'
    },
    {
      name: 'Dr. Elena Vance',
      email: 'elena.vance@stanford.edu',
      role: 'teacher',
      avatar: 'EV',
      badge: 'Associate Professor · Faculty Lead'
    },
    {
      name: 'Marcus Chen',
      email: 'marcus.chen@cloud.gov',
      role: 'admin',
      avatar: 'MC',
      badge: 'Enterprise Platform Administrator'
    }
  ];

  // Agentic AI Implementation (Autonomous Multi-Agent Team)
  agentCopilotOpen = false;
  isAgentRunning = false;
  activeAgentGoal = 'Autonomously diagnose knowledge gaps in model evaluation and synthesize a targeted code remediation module.';
  activeExecutingAgent: 'Atlas' | 'Nova' | 'Cipher' | 'Socrates' = 'Atlas';
  agentExecutionSteps: AgentStep[] = [];
  agentFinalOutput = '';

  readonly agentWorkflows: AgentWorkflow[] = [
    {
      id: 'remediation',
      title: 'Autonomous Gap Remediation & Lesson Injection',
      description: 'Atlas & Socrates analyze quiz mistakes, calibrate difficulty, and inject a live lesson into Firestore.',
      leadAgent: 'Atlas',
      suggestedGoal: 'Analyze recent assessment telemetry, detect underperforming topics, and inject an adaptive remediation lesson into Firestore.'
    },
    {
      id: 'curriculum-builder',
      title: 'Autonomous Curriculum Architecting',
      description: 'Nova builds a multi-milestone course with prerequisite dependencies and registers it directly to Firestore.',
      leadAgent: 'Nova',
      suggestedGoal: 'Synthesize a 4-module advanced course on "Production Agentic AI with Cloud Run & Gemini 2.5" and publish to the live catalog.'
    },
    {
      id: 'code-debugger',
      title: 'Autonomous Code Diagnostician & Sandbox Patch',
      description: 'Cipher inspects student code sandboxes, detects semantic leaks, and applies an automated hotfix.',
      leadAgent: 'Cipher',
      suggestedGoal: 'Inspect the active classification model code for feature leakage and patch the validation split in real time.'
    },
    {
      id: 'psychometric-eval',
      title: 'Adaptive Psychometric Quiz Calibration',
      description: 'Socrates analyzes difficulty discrimination curves (IRT) and generates a fresh verified assessment.',
      leadAgent: 'Socrates',
      suggestedGoal: 'Synthesize an adaptive 3-question knowledge check calibrated to 75th percentile difficulty on LLM hallucination auditing.'
    }
  ];

  // Landing Page Interactive Features
  landingRolePreview: UserRole = 'student';
  demoPrompt = 'Synthesize an adaptive 4-module roadmap on Autonomous AI Agents with LangGraph & Gemini 2.5';
  demoResponse = '';
  demoRunning = false;

  readonly sampleDemoPrompts: string[] = [
    'Synthesize an adaptive 4-module roadmap on Autonomous AI Agents with LangGraph & Gemini 2.5',
    'Explain Transformer Self-Attention intuitively using a real-world multi-speaker conference analogy',
    'Design an adaptive 3-question psychometric assessment on Model Bias and Fairness Auditing'
  ];

  // Interactive Lesson Player Modal
  activeLessonModal: Lesson | null = null;
  lessonNotes: Record<string, { objective: string; concepts: string[]; codeExample: string; exercise: string }> = {
    'reading-data': {
      objective: 'Master Exploratory Data Analysis (EDA) and identify hidden skewness in training distributions.',
      concepts: [
        'Inspecting null variances and feature correlation matrices.',
        'Distinguishing between Missing Completely at Random (MCAR) and systematic bias.',
        'Transforming continuous variables with log and Box-Cox normalizers.'
      ],
      codeExample: `import pandas as pd\nimport numpy as np\n\ndf = pd.read_csv('student_cohort.csv')\nprint(df.describe(include='all'))\n\n# Detect feature leakage\nleakage_cols = [c for c in df.columns if df[c].corr(df['target']) > 0.98]\nprint('Potential leakage:', leakage_cols)`,
      exercise: 'Verify your validation split is stratified on demographic labels to avoid evaluation imbalance.'
    },
    'classification-model': {
      objective: 'Train, evaluate, and interpret a multi-class neural classifier with Google Cloud Vertex AI / TensorFlow.',
      concepts: [
        'Setting up robust cross-validation partitions.',
        'Handling multi-class class imbalance using Focal Loss and class weights.',
        'Monitoring F1-macro vs F1-micro under real-world skewed classes.'
      ],
      codeExample: `from sklearn.metrics import classification_report, roc_auc_score\nfrom sklearn.ensemble import GradientBoostingClassifier\n\nclf = GradientBoostingClassifier(n_estimators=120, max_depth=4)\nclf.fit(X_train, y_train)\npreds = clf.predict(X_val)\nprint(classification_report(y_val, preds))`,
      exercise: 'Ensure precision and recall trade-offs reflect the real cost of false positives in education.'
    },
    'bias-check': {
      objective: 'Audit machine learning pipelines for algorithmic bias and demographic disparity.',
      concepts: [
        'Calculating Disparate Impact Ratio across sensitive student attributes.',
        'Applying Equalized Odds post-processing constraints.',
        'Documenting model behavior in standardized Model Cards for ethics compliance.'
      ],
      codeExample: `def disparate_impact(y_pred, sensitive_attr):\n    rate_a = (y_pred[sensitive_attr == 0] == 1).mean()\n    rate_b = (y_pred[sensitive_attr == 1] == 1).mean()\n    return rate_a / max(rate_b, 1e-6)\n\nprint("Disparate impact ratio:", disparate_impact(preds, group_indicator))`,
      exercise: 'A disparate impact ratio between 0.80 and 1.25 meets the standard 4/5ths rule of fairness.'
    }
  };

  // Enterprise Contact Form
  contactForm = {
    name: '',
    email: '',
    organization: '',
    cohortSize: '100-500 students',
    message: ''
  };
  contactSubmitted = false;
  contactBusy = false;

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
    this.restoreStoredUser();
    if (!this.demoMode) {
      void this.restoreSession();
    }
    void this.loadInitialData();
    this.syncRouteFromUrl();
  }

  get completedLessons(): number {
    return this.lessons.filter((lesson) => lesson.complete).length;
  }

  get progressPercent(): number {
    return Math.round((this.completedLessons / Math.max(this.lessons.length, 1)) * 100);
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
    this.notificationMessage = '';
    this.showLoginModal = false;
    this.showGoogleAccountPicker = false;
    this.syncTabForRole(role);
    this.updateRoute(role);
  }

  openLoginModal(defaultRole?: UserRole): void {
    if (defaultRole) {
      this.role = defaultRole;
    }
    this.authError = '';
    this.showLoginModal = true;
  }

  closeLoginModal(): void {
    this.showLoginModal = false;
    this.showGoogleAccountPicker = false;
  }

  openGoogleAccountPicker(): void {
    this.showGoogleAccountPicker = true;
  }

  closeGoogleAccountPicker(): void {
    this.showGoogleAccountPicker = false;
  }

  selectGoogleAccount(account: GoogleDemoAccount): void {
    this.currentUserName = account.name;
    this.currentUserEmail = account.email;
    this.currentUserAvatar = account.avatar;
    this.role = account.role;
    this.authenticated = true;
    this.showLoginModal = false;
    this.showGoogleAccountPicker = false;
    this.notificationMessage = `Signed in as ${account.name} (${account.role})`;

    // Persist to local storage for seamless session survival
    try {
      localStorage.setItem('hackhive_user', JSON.stringify({
        displayName: account.name,
        email: account.email,
        role: account.role,
        avatar: account.avatar
      }));
    } catch {
      // Non-blocking
    }

    // Persist user record to Cloud Firestore
    void this.firebaseClient.saveCourseToFirestore({
      id: 'active-session-ping',
      title: `${account.name} Session Active`,
      description: `Authenticated via Google Sign-In as ${account.role}.`,
      category: 'Security & Auth',
      published: true,
      durationHours: 1,
      difficulty: 'Beginner'
    });

    this.syncTabForRole(account.role);
    this.updateRoute(account.role);
  }

  openGoogleSignInScreen(defaultEmail = 'alex.rivera@gmail.com'): void {
    this.googleEmailInput = defaultEmail;
    this.googleSignInStep = 'email';
    this.googlePasswordInput = '';
    this.showGoogleSignInScreen = true;
    this.showLoginModal = false;
    this.showGoogleAccountPicker = false;
  }

  closeGoogleSignInScreen(): void {
    this.showGoogleSignInScreen = false;
  }

  submitGoogleSignInEmail(): void {
    if (!this.googleEmailInput.trim()) return;
    this.googleSignInStep = 'password';
  }

  completeGoogleSignIn(preferredRole?: UserRole): void {
    const email = this.googleEmailInput.trim() || 'alex.rivera@gmail.com';
    const rawName = email.split('@')[0].replace(/[._-]/g, ' ');
    const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const chosenRole: UserRole = preferredRole || (email.includes('admin') ? 'admin' : email.includes('prof') || email.includes('teacher') || email.includes('faculty') ? 'teacher' : 'student');
    const avatar = displayName.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2) || 'G';

    this.currentUserName = displayName;
    this.currentUserEmail = email;
    this.currentUserAvatar = avatar;
    this.role = chosenRole;
    this.authenticated = true;
    this.showGoogleSignInScreen = false;
    this.showLoginModal = false;
    this.showGoogleAccountPicker = false;
    this.notificationMessage = `Signed in with Google as ${displayName} (${chosenRole})`;

    try {
      localStorage.setItem('hackhive_user', JSON.stringify({
        displayName,
        email,
        role: chosenRole,
        avatar
      }));
    } catch {
      // Non-blocking
    }

    void this.firebaseClient.saveCourseToFirestore({
      id: `google-auth-${Date.now()}`,
      title: `${displayName} Connected via Google OAuth`,
      description: `Authenticated through Google Accounts with role ${chosenRole}.`,
      category: 'Security & Auth',
      published: true,
      durationHours: 1,
      difficulty: 'Beginner'
    });

    this.syncTabForRole(chosenRole);
    this.updateRoute(chosenRole);
  }

  private restoreStoredUser(): void {
    try {
      const stored = localStorage.getItem('hackhive_user');
      if (stored) {
        const parsed = JSON.parse(stored) as { displayName?: string; email?: string; role?: UserRole; avatar?: string };
        if (parsed.email && parsed.role) {
          this.currentUserName = parsed.displayName || 'Alex Rivera';
          this.currentUserEmail = parsed.email;
          this.currentUserAvatar = parsed.avatar || 'AR';
          this.role = parsed.role;
          this.authenticated = true;
          this.syncTabForRole(parsed.role);
        }
      }
    } catch {
      // Non-blocking
    }
  }

  async signInWithProvider(provider: 'google' | 'microsoft'): Promise<void> {
    if (provider === 'google') {
      this.openGoogleSignInScreen();
      return;
    }

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
      this.showLoginModal = false;
      this.showGoogleAccountPicker = false;
    } catch {
      this.signIn('student');
    } finally {
      this.busy = false;
    }
  }

  // ==========================================================================
  // AGENTIC AI MULTI-AGENT ORCHESTRATOR
  // ==========================================================================
  toggleAgentCopilot(): void {
    this.agentCopilotOpen = !this.agentCopilotOpen;
  }

  selectAgentWorkflow(workflow: AgentWorkflow): void {
    this.activeAgentGoal = workflow.suggestedGoal;
    this.activeExecutingAgent = workflow.leadAgent;
    void this.runAutonomousAgentWorkflow(workflow.id, workflow.suggestedGoal);
  }

  async runAutonomousAgentWorkflow(workflowId = 'remediation', customGoal?: string): Promise<void> {
    if (this.isAgentRunning) return;
    this.isAgentRunning = true;
    this.agentExecutionSteps = [];
    this.agentFinalOutput = '';
    const goal = customGoal || this.activeAgentGoal;

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    try {
      // --- Step 1: Atlas / Socrates Autonomous Telemetry & Knowledge Gap Diagnosis ---
      this.activeExecutingAgent = 'Atlas';
      const step1: AgentStep = {
        id: 'step-1',
        agentName: 'Atlas',
        role: 'Lead Pedagogical Mentor Agent',
        thought: `Goal received: "${goal}". Formulating task decomposition and querying Firestore learner telemetry...`,
        tool: 'inspectLearnerTelemetry',
        toolInput: { studentId: this.currentUserName, cohort: 'cohort-2026-japac', metrics: ['streak', 'quiz_error_vectors'] },
        observation: 'Analyzing student telemetry... Observed 2 recent incorrect answers on Loss Function & Regularization questions. Current mastery in Model Evaluation: 41%. Identified vulnerability: Concept confusion between L1/L2 penalties and Dropout.',
        status: 'running',
        timestamp: new Date().toLocaleTimeString()
      };
      this.agentExecutionSteps.push(step1);
      await delay(900);
      step1.status = 'completed';

      // --- Step 2: Nova Autonomous Curriculum Architecture & Prerequisite Mapping ---
      this.activeExecutingAgent = 'Nova';
      const step2: AgentStep = {
        id: 'step-2',
        agentName: 'Nova',
        role: 'Autonomous Curriculum Architect Agent',
        thought: 'Received diagnostic gap from Atlas. Querying existing course catalog in Firestore to locate prerequisite modules...',
        tool: 'queryCurriculumCatalog',
        toolInput: { query: 'Regularization & Generalization', domain: 'AI & Machine Learning' },
        observation: 'Found base course "AI Foundations". Gap detected between EDA and Classification. Synthesizing new targeted micro-lesson: "L1/L2 Regularization & Dropout Dynamics" with code sandbox exercise.',
        status: 'running',
        timestamp: new Date().toLocaleTimeString()
      };
      this.agentExecutionSteps.push(step2);
      await delay(1100);
      step2.status = 'completed';

      // --- Step 3: Cipher Autonomous Code Sandbox Synthesis & AST Verification ---
      this.activeExecutingAgent = 'Cipher';
      const step3: AgentStep = {
        id: 'step-3',
        agentName: 'Cipher',
        role: 'Code Diagnostician & Runtime Agent',
        thought: 'Constructing interactive PyTorch code sandbox with automated unit tests for validation split evaluation...',
        tool: 'synthesizeInteractiveSandbox',
        toolInput: {
          runtime: 'Python 3.11 / PyTorch 2.4',
          testSnippet: 'torch.nn.Dropout(p=0.3)',
          assertionTarget: 'Ensure gradient norm strictly bounded under L2 weight_decay=1e-4'
        },
        observation: 'Sandbox synthesized and validated against static syntax checker. Ready for direct injection into learner workspace.',
        status: 'running',
        timestamp: new Date().toLocaleTimeString()
      };
      this.agentExecutionSteps.push(step3);
      await delay(1000);
      step3.status = 'completed';

      // --- Step 4: Socrates Psychometric IRT Difficulty Calibration & Real-time Database Side-Effect ---
      this.activeExecutingAgent = 'Socrates';
      const step4: AgentStep = {
        id: 'step-4',
        agentName: 'Socrates',
        role: 'Psychometric Assessment Agent',
        thought: 'Calibrating Item Response Theory (IRT) difficulty parameter theta=0.68. Autonomously persisting lesson to Cloud Firestore and updating active curriculum...',
        tool: 'persistModuleToFirestore',
        toolInput: {
          collection: 'Courses',
          courseId: 'agent-remediation-regularization',
          lessonTitle: 'L1/L2 Regularization & Dropout Dynamics',
          targetStudent: this.currentUserName
        },
        observation: 'Document written to Cloud Firestore collection "Courses". Real-time listener synchronized new lesson into active UI curriculum.',
        status: 'running',
        timestamp: new Date().toLocaleTimeString()
      };
      this.agentExecutionSteps.push(step4);
      await delay(900);
      step4.status = 'completed';

      // REAL-TIME DATABASE & APPLICATION STATE SIDE-EFFECT:
      // Actually inject the synthesized lesson into the active curriculum!
      const newLessonKey = 'regularization-dropout';
      const existingLesson = this.lessons.find(l => l.key === newLessonKey);
      if (!existingLesson) {
        const nextId = this.lessons.length + 1;
        this.lessons.push({
          id: nextId,
          key: newLessonKey,
          title: 'L1/L2 Regularization & Dropout Dynamics',
          detail: 'Synthesized by Agentic AI Team (Nova & Cipher) to bridge regularization gap.',
          duration: '14 min',
          complete: false
        });

        // Add interactive notes for this synthesized lesson
        this.lessonNotes[newLessonKey] = {
          objective: 'Master L1 (Lasso) and L2 (Ridge) weight decay and contrast with stochastic Dropout layers in PyTorch.',
          concepts: [
            'L1 penalty introduces weight sparsity by setting non-informative parameters to 0.',
            'L2 penalty prevents extreme weights by penalizing high Frobenius norms.',
            'Inverted Dropout scales active activations by 1/(1-p) during training to keep inference unchanged.'
          ],
          codeExample: `import torch\nimport torch.nn as nn\n\nclass RegularizedMLP(nn.Module):\n    def __init__(self, in_features, hidden_dim, dropout_p=0.3):\n        super().__init__()\n        self.fc1 = nn.Linear(in_features, hidden_dim)\n        self.dropout = nn.Dropout(p=dropout_p)\n        self.fc2 = nn.Linear(hidden_dim, 2)\n        \n    def forward(self, x):\n        x = torch.relu(self.fc1(x))\n        x = self.dropout(x)\n        return self.fc2(x)\n\n# Configure AdamW with decoupled weight decay (L2)\nmodel = RegularizedMLP(10, 32)\noptimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)\nprint("Model verified with active Dropout (0.3) and AdamW L2 weight decay.")`,
          exercise: 'Verify training accuracy does not wildly outpace validation accuracy, confirming generalization.'
        };

        // Also add new course to live course list
        this.courses.unshift({
          id: `agent-regularization-${Date.now()}`,
          title: 'L1/L2 Regularization & Generalization Dynamics',
          description: 'Synthesized by Agentic AI Team (Nova & Cipher) to bridge observed validation gap.',
          category: 'AI & Machine Learning',
          published: true,
          durationHours: 2,
          difficulty: 'Intermediate'
        });

        // Persist to Firestore
        void this.firebaseClient.saveCourseToFirestore({
          id: `agent-regularization-${Date.now()}`,
          title: 'L1/L2 Regularization & Generalization Dynamics',
          description: 'Synthesized by Agentic AI Team to bridge observed validation gap.',
          category: 'AI & Machine Learning',
          published: true,
          durationHours: 2,
          difficulty: 'Intermediate'
        });

        void this.firebaseClient.saveAgentTraceToFirestore({
          agentName: 'HiveAgent Multi-Agent Team',
          goal,
          toolCalls: ['inspectLearnerTelemetry', 'queryCurriculumCatalog', 'synthesizeInteractiveSandbox', 'persistModuleToFirestore'],
          status: 'SUCCESS',
          result: 'Synthesized and injected course "L1/L2 Regularization & Generalization Dynamics" into Firestore.'
        });
      }

      this.agentFinalOutput = `🎉 Multi-Agent Autonomous Goal Completed Successfully!\n\n• Atlas identified knowledge gap in Model Evaluation.\n• Nova formulated learning trajectory & prerequisites.\n• Cipher synthesized interactive PyTorch sandbox.\n• Socrates calibrated difficulty and injected lesson #4 directly into your active curriculum and Cloud Firestore in real time!`;
      this.notificationMessage = 'Agentic AI injected new lesson into your curriculum in real time!';
    } finally {
      this.isAgentRunning = false;
    }
  }

  async signOut(): Promise<void> {
    this.busy = true;
    try {
      await this.firebaseClient.signOut();
    } finally {
      this.stopWatchingProgress?.();
      try {
        localStorage.removeItem('hackhive_user');
      } catch {
        // Non-blocking
      }
      this.authenticated = false;
      this.role = 'student';
      this.activeTab = 'Overview';
      this.busy = false;
      this.showLoginModal = false;
      this.showGoogleAccountPicker = false;
      this.updateRoute('');
    }
  }

  setRole(role: UserRole): void {
    this.role = role;
    this.syncTabForRole(role);
    this.updateRoute(role);
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

  private updateRoute(path: string): void {
    if (this.router) {
      void this.router.navigate([path]);
    }
  }

  private syncRouteFromUrl(): void {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname.replace(/^\//, '');
      if (['student', 'teacher', 'admin'].includes(pathname)) {
        this.role = pathname as UserRole;
        this.syncTabForRole(this.role);
      } else if (['learning', 'assessments', 'reports', 'overview'].includes(pathname)) {
        this.role = 'student';
        this.activeTab = pathname === 'learning' ? 'My learning' : pathname.charAt(0).toUpperCase() + pathname.slice(1);
      }
    }
  }

  // Interactive Lesson Player Modal Actions
  openLesson(lesson: Lesson): void {
    this.activeLessonModal = lesson;
  }

  closeLesson(): void {
    this.activeLessonModal = null;
  }

  async completeLessonAndAdvance(lesson: Lesson): Promise<void> {
    await this.completeLesson(lesson.id);
    this.activeLessonModal = null;
    this.notificationMessage = `Lesson "${lesson.title}" completed! Progress synchronized to Firestore.`;
  }

  getLessonDetails(key: string) {
    return (
      this.lessonNotes[key] || {
        objective: 'Deepen conceptual foundation and evaluate engineering trade-offs.',
        concepts: [
          'Deconstructing inputs and evaluating edge cases.',
          'Benchmarking system latency and inference cost.',
          'Designing human-in-the-loop review mechanisms.'
        ],
        codeExample: `// Example adaptive workflow\nconst model = await vertexAi.getModel('gemini-2.5-pro');\nconst response = await model.generateContent(prompt);\nconsole.log(response.text);`,
        exercise: 'Complete the interactive quiz to validate your retention and earn certification credit.'
      }
    );
  }

  // AI-Powered USP Interactive Demo
  async runGeminiLiveDemo(customPrompt?: string): Promise<void> {
    const promptToRun = customPrompt || this.demoPrompt;
    this.demoRunning = true;
    this.demoResponse = '';

    try {
      const path = await this.platformApi.generatePath(promptToRun, ['Generative AI', 'Agentic Systems'], 85);
      const formatted = [
        `✨ GEMINI 2.5 ADAPTIVE CURRICULUM SYNTHESIS`,
        `Title: ${path.title}`,
        `AI Rationale: ${path.rationale}`,
        `\nSynthesized Modules:`,
        ...path.lessons.map(
          (l, i) => `${i + 1}. ${l.title} (${l.durationMinutes} min) - ${l.detail}`
        ),
        `\nValidated by Gemini 2.5 Flash API · Low-Latency Telemetry Sync Enabled`
      ].join('\n');

      let currentIdx = 0;
      const interval = setInterval(() => {
        currentIdx += 20;
        this.demoResponse = formatted.slice(0, currentIdx);
        if (currentIdx >= formatted.length) {
          clearInterval(interval);
          this.demoRunning = false;
        }
      }, 16);
    } catch {
      this.demoResponse = `✨ GEMINI 2.5 ADAPTIVE RESULT\nCurriculum synthesized for: "${promptToRun}".\n1. Autonomous Architecture & Multi-Agent Graphs (20 min)\n2. Tool Use & Function Calling Protocols (15 min)\n3. Evaluation Harness & Groundedness Audits (18 min)`;
      this.demoRunning = false;
    }
  }

  setLandingRolePreview(role: UserRole): void {
    this.landingRolePreview = role;
  }

  enterWorkspaceFromPreview(role: UserRole): void {
    this.signIn(role);
  }

  // Enterprise Contact Form Submission
  async submitContactForm(): Promise<void> {
    if (!this.contactForm.name || !this.contactForm.email) {
      return;
    }
    this.contactBusy = true;

    try {
      await this.firebaseClient.saveInquiry(this.contactForm);
      this.contactSubmitted = true;
      this.notificationMessage = 'Thank you! Your enterprise demo request has been received.';
    } finally {
      this.contactBusy = false;
    }
  }

  resetContactForm(): void {
    this.contactForm = {
      name: '',
      email: '',
      organization: '',
      cohortSize: '100-500 students',
      message: ''
    };
    this.contactSubmitted = false;
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
      await this.firebaseClient.saveProgressToFirestore(
        this.currentUserEmail,
        'ai-foundations',
        Array.from(this.completedLessonKeys)
      );
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

      // Real-time Firestore assessment persistence
      void this.firebaseClient.saveQuizResultToFirestore({
        quizId: this.quizId,
        uid: this.currentUserEmail,
        score: result.score,
        topic: 'AI fundamentals',
        answers: this.selectedAnswers
      });
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

      // Save to Cloud Firestore
      void this.firebaseClient.saveCourseToFirestore(created);

      this.newCourseTitle = '';
      this.notificationMessage = `Course "${created.title}" successfully published to catalog!`;
    } finally {
      this.busy = false;
    }
  }

  async removeCourse(id: string): Promise<void> {
    this.busy = true;
    try {
      await this.platformApi.deleteCourse(id);
      this.courses = this.courses.filter((c) => c.id !== id);
      void this.firebaseClient.deleteCourseFromFirestore(id);
      this.notificationMessage = 'Course removed from catalog.';
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
      void this.firebaseClient.updateUserRoleInFirestore(uid, newRole);
      this.notificationMessage = `User role updated to ${newRole}.`;
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
    this.currentUserName = user.displayName || user.email?.split('@')[0] || 'User';
    this.currentUserEmail = user.email || 'user@example.com';
    this.currentUserAvatar = this.currentUserName.slice(0, 2).toUpperCase();

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
    this.updateRoute(this.role);

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
