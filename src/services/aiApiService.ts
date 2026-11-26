import {
  DifficultyLevel,
  LearningEventType,
  QuestionItem,
  StructuredAutonomousAnalysis,
} from '../types/domain';

export interface HealthStatus {
  status: string;
  service: string;
  geminiConfigured: boolean;
  timestamp: string;
}

export async function fetchEngineHealth(): Promise<HealthStatus> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error('Unable to verify backend engine health.');
  }
  return res.json();
}

export async function triggerAutonomousEngine(payload: {
  eventId: string;
  idempotencyKey: string;
  eventType: LearningEventType;
  institutionId: string;
  pseudonymId: string;
  gradeLevel: string;
  subjectName: string;
  competencyCode: string;
  competencyName: string;
  recentScores: number[];
  latestScore: number;
  completedActivitiesCount: number;
  missedTopics?: string[];
  demoMode: boolean;
}): Promise<{
  ok: boolean;
  analysis: StructuredAutonomousAnalysis;
  idempotentHit: boolean;
  geminiConfigured: boolean;
  processedAt: string;
}> {
  const res = await fetch('/api/autonomous-engine/process-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Autonomous Learning Engine failed to process event.');
  }
  return data;
}

export interface AutoStepCandidatePayload {
  pseudonymId: string;
  gradeLevel: string;
  subjectName: string;
  competencyCode: string;
  competencyName: string;
  recentScores: number[];
  latestScore: number;
  completedActivitiesCount: number;
  hasPendingActivity: boolean;
  hasOpenIntervention: boolean;
}

export async function triggerAutonomousAutoStep(payload: {
  institutionId: string;
  candidates: AutoStepCandidatePayload[];
  demoMode: boolean;
}): Promise<{
  ok: boolean;
  selectedCandidate: AutoStepCandidatePayload;
  selectionReason: string;
  eventId: string;
  idempotencyKey: string;
  analysis: StructuredAutonomousAnalysis;
  idempotentHit: boolean;
  geminiConfigured: boolean;
  processedAt: string;
}> {
  const res = await fetch('/api/autonomous-engine/auto-step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'O motor autônomo não conseguiu executar a etapa.');
  }
  return data;
}

export interface AutoExamCandidatePayload {
  resultId: string;
  pseudonymId: string;
  gradeLevel: string;
  subjectName: string;
  competencyCode: string;
  competencyName: string;
  score: number;
  maxScore: number;
  percentage: number;
  studentOverallAvg: number;
  bestSubjectName?: string;
  worstSubjectName?: string;
  recentScores: number[];
  alreadyReviewed: boolean;
}

export async function triggerAutonomousExamReview(payload: {
  institutionId: string;
  exams: AutoExamCandidatePayload[];
  demoMode: boolean;
}): Promise<{
  ok: boolean;
  selectedExam: AutoExamCandidatePayload;
  selectionReason: string;
  examReview: {
    verdict: string;
    whatWentWell: string;
    whereStruggled: string;
    recommendation: string;
    failureRiskAlert: 'PRIORIDADE_MAXIMA' | 'ATENCAO' | 'REGULAR';
    reviewText: string;
    engineSource: 'GEMINI' | 'DEMO_RULES' | 'RULE_ENGINE_FALLBACK';
  };
  eventId: string;
  idempotencyKey: string;
  analysis: StructuredAutonomousAnalysis;
  geminiConfigured: boolean;
  processedAt: string;
}> {
  const res = await fetch('/api/autonomous-engine/auto-review-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'A IA não conseguiu revisar a prova automaticamente.');
  }
  return data;
}

export async function runInternalLearningCycleBatch(events: Array<{
  eventId: string;
  idempotencyKey: string;
  eventType: LearningEventType;
  institutionId: string;
  pseudonymId: string;
  gradeLevel: string;
  subjectName: string;
  competencyCode: string;
  competencyName: string;
  recentScores: number[];
  latestScore: number;
  completedActivitiesCount: number;
  missedTopics?: string[];
  demoMode: boolean;
}>) {
  const res = await fetch('/api/internal/learning-cycle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Internal learning cycle batch failed.');
  }
  return data;
}

export async function generatePedagogicalMaterial(payload: {
  gradeLevel: string;
  subjectName: string;
  competencyCode: string;
  competencyName: string;
  difficulty: DifficultyLevel;
  materialType:
    | 'Simplified Explanation'
    | 'Worked Examples'
    | 'Practice Exercises'
    | 'Revision Quiz'
    | 'Summary'
    | 'Study Plan';
  pedagogicalObjective: string;
  demoMode: boolean;
}): Promise<{
  ok: boolean;
  origin: 'GEMINI' | 'DEMO_RULES';
  geminiConfigured: boolean;
  material: {
    title: string;
    summary: string;
    sections: { heading: string; body: string }[];
    questions: QuestionItem[];
  };
}> {
  const res = await fetch('/api/ai/generate-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Failed to generate pedagogical material.');
  }
  return data;
}

export async function evaluateOpenResponse(payload: {
  subjectName: string;
  competencyName: string;
  questionPrompt: string;
  referenceAnswer: string;
  studentResponse: string;
  isHighImpact?: boolean;
  demoMode: boolean;
}): Promise<{
  ok: boolean;
  origin: 'GEMINI' | 'DEMO_RULES';
  requiresTeacherReview: boolean;
  preliminaryScore: number;
  feedback: string;
}> {
  const res = await fetch('/api/ai/evaluate-open-response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Failed to evaluate open response.');
  }
  return data;
}
