export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export type PedagogicalStatus =
  | 'Mastering'
  | 'Progressing'
  | 'Needs Reinforcement'
  | 'Additional Practice Recommended';

export type ActivityType =
  | 'Multiple Choice'
  | 'True or False'
  | 'Short Answer'
  | 'Practice Exercises'
  | 'Diagnostic Assessment'
  | 'Revision Quiz';

export type DifficultyLevel = 'Foundational' | 'Intermediate' | 'Advanced';

export type InterventionStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REASSESSMENT_REQUIRED';

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type LearningEventType =
  | 'AssessmentSubmitted'
  | 'ActivityCompleted'
  | 'LearningGoalUpdated'
  | 'CompetencyMasteryChanged'
  | 'StudentProgressUpdated';

export type EngineSource = 'GEMINI' | 'DEMO_RULES' | 'RULE_ENGINE_FALLBACK';

export type AppMode = 'DEMO' | 'LIVE';

export const VALIDATION_LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  JOIN_CODE_REGEX: /^[A-Z0-9_-]+$/,
  MAX_ID_LENGTH: 128,
  MAX_NAME_LENGTH: 120,
  MAX_INSTITUTION_NAME_LENGTH: 140,
  MAX_TITLE_LENGTH: 180,
  MAX_DESCRIPTION_LENGTH: 600,
  MAX_SUMMARY_LENGTH: 2000,
  MAX_STAFF_UIDS: 50,
  MAX_SUBJECT_IDS: 20,
  MAX_QUESTIONS: 30,
} as const;

export interface QuestionItem {
  id: string;
  prompt: string;
  questionType: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Institution {
  id: string;
  name: string;
  joinCode: string;
  ownerUid: string;
  staffUids: string[];
  retentionDays: number;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  institutionId: string;
  role: UserRole;
  displayName: string;
  linkedStudentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolClass {
  id: string;
  institutionId: string;
  staffUids: string[];
  name: string;
  gradeLevel: string;
  academicYear: string;
  teacherUid: string;
  teacherName?: string;
  createdAt: string;
}

export interface Student {
  id: string;
  institutionId: string;
  staffUids: string[];
  studentOwnerUid: string;
  classId: string;
  pseudonymId: string;
  displayName: string;
  gradeLevel: string;
  pedagogicalStatus: PedagogicalStatus;
  averageScore: number;
  completionRate: number;
  subjectIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  institutionId: string;
  staffUids: string[];
  name: string;
  code: string;
  createdAt: string;
}

export interface Competency {
  id: string;
  institutionId: string;
  staffUids: string[];
  subjectId: string;
  code: string;
  name: string;
  description: string;
  gradeLevel: string;
  createdAt: string;
}

export interface Assessment {
  id: string;
  institutionId: string;
  staffUids: string[];
  classId: string;
  subjectId: string;
  competencyId: string;
  title: string;
  type: 'Diagnostic Assessment' | 'Revision Quiz' | 'Multiple Choice' | 'Short Answer';
  difficulty: DifficultyLevel;
  isHighImpact: boolean;
  questions: QuestionItem[];
  createdByUid: string;
  createdAt: string;
}

export interface AssessmentResult {
  id: string;
  institutionId: string;
  staffUids: string[];
  studentOwnerUid: string;
  assessmentId: string;
  studentId: string;
  subjectId: string;
  competencyId: string;
  score: number;
  maxScore: number;
  percentage: number;
  teacherReviewed: boolean;
  aiPreliminaryFeedback?: string;
  submittedAt: string;
}

export interface SubmittedAnswer {
  questionId: string;
  answer: string;
  isCorrect: boolean;
  feedback?: string;
}

export interface LearningActivity {
  id: string;
  institutionId: string;
  staffUids: string[];
  studentOwnerUid: string;
  studentId: string;
  classId: string;
  subjectId: string;
  competencyId: string;
  title: string;
  type: ActivityType;
  difficulty: DifficultyLevel;
  origin: 'AI_AUTONOMOUS' | 'TEACHER_CREATED';
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
  questions: QuestionItem[];
  scorePercentage?: number;
  feedbackSummary?: string;
  submittedAnswers?: SubmittedAnswer[];
  createdAt: string;
  updatedAt: string;
}

export interface LearningPathModule {
  order: number;
  title: string;
  shortLesson: string;
  exerciseFocus: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING';
  masteryScore?: number;
}

export interface LearningPath {
  id: string;
  institutionId: string;
  staffUids: string[];
  studentOwnerUid: string;
  studentId: string;
  subjectId: string;
  competencyId: string;
  title: string;
  educationalObjective: string;
  estimatedLevel: 'Foundational' | 'Developing' | 'Proficient' | 'Mastering';
  masteryCriterion: string;
  nextReviewDate: string;
  progressPercent: number;
  modules: LearningPathModule[];
  updatedAt: string;
}

export interface Intervention {
  id: string;
  institutionId: string;
  staffUids: string[];
  studentOwnerUid: string;
  studentId: string;
  subjectId: string;
  competencyId: string;
  sourceEventId: string;
  evidence: string;
  strategy: string;
  priority: PriorityLevel;
  status: InterventionStatus;
  contentSummary: string;
  activityIds: string[];
  outcomeSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningEvent {
  id: string;
  institutionId: string;
  staffUids: string[];
  studentOwnerUid: string;
  eventType: LearningEventType;
  studentId: string;
  subjectId: string;
  competencyId: string;
  referenceId: string;
  idempotencyKey: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  createdAt: string;
  processedAt?: string;
}

export interface AIInsight {
  id: string;
  institutionId: string;
  staffUids: string[];
  studentOwnerUid: string;
  eventId: string;
  studentId: string;
  pseudonymId: string;
  subjectId: string;
  competencyId: string;
  evidence: string;
  pedagogicalDiagnosis: string;
  priority: PriorityLevel;
  strategyChosen: string;
  learningObjective: string;
  confidence: number;
  engineSource: EngineSource;
  observedOutcome: string;
  generatedActivityId?: string;
  interventionId?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  institutionId: string;
  staffUids: string[];
  actorUid: string;
  actorType: 'AI_ENGINE' | 'ADMIN' | 'TEACHER' | 'STUDENT';
  action: string;
  targetCollection: string;
  targetId: string;
  summary: string;
  createdAt: string;
}

export interface ConsentRecord {
  id: string;
  institutionId: string;
  staffUids: string[];
  studentId: string;
  guardianConsentStatus: 'VERIFIED' | 'PENDING' | 'REVOKED';
  dataMinimizationAccepted: boolean;
  retentionPolicyDays: number;
  updatedByUid: string;
  updatedAt: string;
}

export interface StructuredAutonomousAnalysis {
  studentId: string; // Always pseudonymId
  subject: string;
  competency: string;
  evidence: string;
  identifiedGap: string;
  confidence: number;
  uncertaintyNote: string;
  learningObjective: string;
  recommendedStrategy: string;
  difficultyLevel: DifficultyLevel;
  nextAction: 'ASSIGN_REINFORCEMENT' | 'ADVANCE_DIFFICULTY' | 'MONITOR_COLLECT_MORE_EVIDENCE' | 'SCHEDULE_REVISION';
  priority: PriorityLevel;
  pedagogicalStatusRecommendation: PedagogicalStatus;
  generatedActivity: {
    title: string;
    type: ActivityType;
    shortLessonSummary: string;
    questions: QuestionItem[];
  };
  learningPathPlan: {
    title: string;
    estimatedLevel: 'Foundational' | 'Developing' | 'Proficient' | 'Mastering';
    masteryCriterion: string;
    modules: LearningPathModule[];
  };
  interventionPlan?: {
    needed: boolean;
    strategy: string;
    contentSummary: string;
  };
  engineSource: EngineSource;
  guardrailAudit: {
    piiStripped: boolean;
    highImpactDecisionBlocked: boolean;
    schemaValidated: boolean;
  };
}
