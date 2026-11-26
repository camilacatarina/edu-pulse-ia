import {
  AssessmentResult,
  LearningActivity,
  Student,
  Subject,
} from '../types/domain';

export type FailureRiskLevel = 'MAXIMUM' | 'MODERATE' | 'LOW';

export interface SubjectPerformance {
  subject: Subject;
  average: number; // 0..100
  gradeTenScale: number; // 0..10
  examsCount: number;
  latestScore: number;
  trendDelta: number;
  isFailing: boolean; // < 60%
  isNearRisk: boolean; // 60% .. 69.9%
}

export interface StudentAcademicProfile {
  student: Student;
  overallAverage: number; // 0..100
  gradeTenScale: number; // 0..10
  riskLevel: FailureRiskLevel;
  riskScore: number; // 0..100 (higher = more urgent)
  riskReason: string;
  subjectPerformances: SubjectPerformance[]; // sorted worst -> best or subject order
  bestSubject: SubjectPerformance | null;
  worstSubject: SubjectPerformance | null;
  failingSubjects: SubjectPerformance[];
  reviewedExamsCount: number;
  pendingReviewExamsCount: number;
}

export interface ParsedExamReview {
  verdict: string;
  whatWentWell: string;
  whereStruggled: string;
  recommendation: string;
  rawText: string;
}

export function formatGradeTen(percentage: number): string {
  const ten = Math.round((percentage / 10) * 10) / 10;
  return ten.toFixed(1).replace('.', ',');
}

export function labelRiskLevel(level: FailureRiskLevel): string {
  switch (level) {
    case 'MAXIMUM':
      return 'Prioridade Máxima de Reprovação';
    case 'MODERATE':
      return 'Risco Moderado';
    case 'LOW':
      return 'Fora de Risco';
  }
}

export function labelRiskShort(level: FailureRiskLevel): string {
  switch (level) {
    case 'MAXIMUM':
      return 'Prioridade Máxima';
    case 'MODERATE':
      return 'Atenção';
    case 'LOW':
      return 'Regular';
  }
}

/**
 * Analisa automaticamente notas de provas e atividades para calcular:
 * - Média geral real
 * - Desempenho por matéria (onde se dá melhor e onde é mais ruim)
 * - Classificação automática de risco / prioridade máxima de reprovação
 */
export function buildStudentAcademicProfile(
  student: Student,
  subjects: Subject[],
  assessmentResults: AssessmentResult[],
  activities: LearningActivity[]
): StudentAcademicProfile {
  const stuResults = assessmentResults
    .filter((r) => r.studentId === student.id)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  const stuCompletedActivities = activities.filter(
    (a) => a.studentId === student.id && a.status === 'COMPLETED' && typeof a.scorePercentage === 'number'
  );

  const subjectPerformances: SubjectPerformance[] = subjects.map((sub) => {
    const subResults = stuResults.filter((r) => r.subjectId === sub.id);
    const subActs = stuCompletedActivities.filter((a) => a.subjectId === sub.id);

    const scores: number[] = [
      ...subResults.map((r) => r.percentage),
      ...subActs.map((a) => a.scorePercentage as number),
    ];

    const avg =
      scores.length > 0
        ? Math.round((scores.reduce((acc, v) => acc + v, 0) / scores.length) * 10) / 10
        : student.averageScore;

    const latestScore = scores.length > 0 ? scores[scores.length - 1] : student.averageScore;
    const trendDelta =
      scores.length >= 2 ? Math.round((latestScore - scores[0]) * 10) / 10 : 0;

    return {
      subject: sub,
      average: avg,
      gradeTenScale: Math.round((avg / 10) * 10) / 10,
      examsCount: subResults.length,
      latestScore,
      trendDelta,
      isFailing: avg < 60,
      isNearRisk: avg >= 60 && avg < 70,
    };
  });

  const overallAverage =
    stuResults.length > 0
      ? Math.round(
          (stuResults.reduce((acc, r) => acc + r.percentage, 0) / stuResults.length) * 10
        ) / 10
      : student.averageScore;

  const sortedByPerf = [...subjectPerformances].sort((a, b) => b.average - a.average);
  const bestSubject = sortedByPerf[0] || null;
  const worstSubject = sortedByPerf[sortedByPerf.length - 1] || null;
  const failingSubjects = subjectPerformances
    .filter((sp) => sp.isFailing)
    .sort((a, b) => a.average - b.average);
  const nearRiskSubjects = subjectPerformances.filter((sp) => sp.isNearRisk);

  const hasSharpDrop = subjectPerformances.some(
    (sp) => sp.average < 55 && sp.trendDelta <= -4
  );

  let riskLevel: FailureRiskLevel = 'LOW';
  if (overallAverage < 60 || failingSubjects.length >= 2 || (failingSubjects.length === 1 && hasSharpDrop)) {
    riskLevel = 'MAXIMUM';
  } else if (overallAverage < 70 || failingSubjects.length === 1 || nearRiskSubjects.length >= 2) {
    riskLevel = 'MODERATE';
  }

  let riskReason = 'Desempenho consistente acima da média mínima (6,0) nas disciplinas.';
  if (riskLevel === 'MAXIMUM') {
    if (failingSubjects.length >= 2) {
      const list = failingSubjects
        .slice(0, 3)
        .map((sp) => `${sp.subject.name} (${formatGradeTen(sp.average)})`)
        .join(', ');
      riskReason = `${failingSubjects.length} matérias abaixo da média 6,0: ${list}.`;
    } else if (overallAverage < 60) {
      riskReason = `Média geral crítica (${formatGradeTen(overallAverage)}) com risco imediato de reprovação.`;
    } else if (worstSubject) {
      riskReason = `Queda acentuada em ${worstSubject.subject.name} (${formatGradeTen(worstSubject.average)}) exige recuperação imediata.`;
    }
  } else if (riskLevel === 'MODERATE') {
    if (failingSubjects.length === 1) {
      riskReason = `Abaixo da média em ${failingSubjects[0].subject.name} (${formatGradeTen(failingSubjects[0].average)}); monitorando evolução.`;
    } else {
      riskReason = `Média geral próxima ao limite (${formatGradeTen(overallAverage)}); recomenda-se reforço preventivo.`;
    }
  }

  const riskScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (100 - overallAverage) * 0.7 +
          failingSubjects.length * 14 +
          (hasSharpDrop ? 10 : 0)
      )
    )
  );

  const reviewedExamsCount = stuResults.filter(
    (r) => Boolean(r.aiPreliminaryFeedback && r.aiPreliminaryFeedback.includes('Ponto Forte:'))
  ).length;
  const pendingReviewExamsCount = Math.max(0, stuResults.length - reviewedExamsCount);

  return {
    student,
    overallAverage,
    gradeTenScale: Math.round((overallAverage / 10) * 10) / 10,
    riskLevel,
    riskScore,
    riskReason,
    subjectPerformances,
    bestSubject,
    worstSubject,
    failingSubjects,
    reviewedExamsCount,
    pendingReviewExamsCount,
  };
}

export function formatStructuredExamReview(params: {
  verdict: string;
  whatWentWell: string;
  whereStruggled: string;
  recommendation: string;
}): string {
  return [
    `Diagnóstico: ${params.verdict}`,
    `Ponto Forte: ${params.whatWentWell}`,
    `Onde Errou: ${params.whereStruggled}`,
    `Ação da IA: ${params.recommendation}`,
  ]
    .join('\n')
    .slice(0, 1950);
}

export function parseStructuredExamReview(raw?: string): ParsedExamReview | null {
  if (!raw || !raw.trim()) return null;
  const lines = raw.split('\n').map((l) => l.trim());
  const pick = (prefix: string) => {
    const found = lines.find((l) => l.startsWith(prefix));
    return found ? found.slice(prefix.length).trim() : '';
  };

  const verdict = pick('Diagnóstico:');
  const whatWentWell = pick('Ponto Forte:');
  const whereStruggled = pick('Onde Errou:');
  const recommendation = pick('Ação da IA:');

  if (!whatWentWell && !whereStruggled) {
    return {
      verdict: 'Revisão Preliminar da IA',
      whatWentWell: 'Base conceitual avaliada na questão.',
      whereStruggled: raw,
      recommendation: 'Acompanhar próximas entregas.',
      rawText: raw,
    };
  }

  return {
    verdict: verdict || 'Revisão da Prova Concluída',
    whatWentWell,
    whereStruggled,
    recommendation,
    rawText: raw,
  };
}
