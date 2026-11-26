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
