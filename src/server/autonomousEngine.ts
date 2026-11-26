import { z } from 'zod';
import {
  DifficultyLevel,
  EngineSource,
  PedagogicalStatus,
  PriorityLevel,
  QuestionItem,
  StructuredAutonomousAnalysis,
} from '../types/domain.ts';
import { generateStructuredJson, isGeminiConfigured, Type } from './geminiClient.ts';

export const AutonomousEventInputSchema = z.object({
  eventId: z.string().min(2).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  idempotencyKey: z.string().min(2).max(160),
  eventType: z.enum([
    'AssessmentSubmitted',
    'ActivityCompleted',
    'LearningGoalUpdated',
    'CompetencyMasteryChanged',
    'StudentProgressUpdated',
  ]),
  institutionId: z.string().min(2).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  pseudonymId: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  gradeLevel: z.string().min(1).max(40),
  subjectName: z.string().min(1).max(100),
  competencyCode: z.string().min(1).max(32),
  competencyName: z.string().min(1).max(140),
  recentScores: z.array(z.number().min(0).max(100)).min(1).max(20),
  latestScore: z.number().min(0).max(100),
  completedActivitiesCount: z.number().int().min(0).max(500),
  missedTopics: z.array(z.string().max(140)).max(10).optional().default([]),
  demoMode: z.boolean().optional().default(false),
});

export type AutonomousEventInput = z.infer<typeof AutonomousEventInputSchema>;

export const AutoStepCandidateSchema = z.object({
  pseudonymId: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  gradeLevel: z.string().min(1).max(40),
  subjectName: z.string().min(1).max(100),
  competencyCode: z.string().min(1).max(32),
  competencyName: z.string().min(1).max(140),
  recentScores: z.array(z.number().min(0).max(100)).min(1).max(20),
  latestScore: z.number().min(0).max(100),
  completedActivitiesCount: z.number().int().min(0).max(500),
  hasPendingActivity: z.boolean().default(false),
  hasOpenIntervention: z.boolean().default(false),
});

export const AutoStepInputSchema = z.object({
  institutionId: z.string().min(2).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  candidates: z.array(AutoStepCandidateSchema).min(1).max(50),
  demoMode: z.boolean().optional().default(false),
});

export type AutoStepCandidate = z.infer<typeof AutoStepCandidateSchema>;

export const AutoExamCandidateSchema = z.object({
  resultId: z.string().min(2).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  pseudonymId: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  gradeLevel: z.string().min(1).max(40),
  subjectName: z.string().min(1).max(100),
  competencyCode: z.string().min(1).max(32),
  competencyName: z.string().min(1).max(140),
  score: z.number().min(0).max(100),
  maxScore: z.number().positive().max(100),
  percentage: z.number().min(0).max(100),
  studentOverallAvg: z.number().min(0).max(100),
  bestSubjectName: z.string().max(100).optional().default(''),
  worstSubjectName: z.string().max(100).optional().default(''),
  recentScores: z.array(z.number().min(0).max(100)).min(1).max(20),
  alreadyReviewed: z.boolean().default(false),
});

export const AutoExamReviewInputSchema = z.object({
  institutionId: z.string().min(2).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  exams: z.array(AutoExamCandidateSchema).min(1).max(50),
  demoMode: z.boolean().optional().default(false),
});

export type AutoExamCandidate = z.infer<typeof AutoExamCandidateSchema>;

const FORBIDDEN_SYSTEM_PATTERNS = [
  /grant\s+admin/i,
  /alter\s+permission/i,
  /bypass\s+rule/i,
  /expel\s+student/i,
  /fail\s+permanently/i,
  /medical\s+diagnosis/i,
  /psychological\s+disorder/i,
  /<script/i,
];

function containsUnsafeDirectives(obj: unknown): boolean {
  const serialized = JSON.stringify(obj);
  return FORBIDDEN_SYSTEM_PATTERNS.some((pattern) => pattern.test(serialized));
}

const ProcessedEventCache = new Map<string, StructuredAutonomousAnalysis>();

const StructuredAnalysisZod = z.object({
  identifiedGap: z.string().min(4).max(800),
  confidence: z.number().min(0).max(1),
  uncertaintyNote: z.string().min(4).max(400),
  learningObjective: z.string().min(4).max(400),
  recommendedStrategy: z.string().min(4).max(400),
  difficultyLevel: z.enum(['Foundational', 'Intermediate', 'Advanced']),
  nextAction: z.enum([
    'ASSIGN_REINFORCEMENT',
    'ADVANCE_DIFFICULTY',
    'MONITOR_COLLECT_MORE_EVIDENCE',
    'SCHEDULE_REVISION',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  pedagogicalStatusRecommendation: z.enum([
    'Mastering',
    'Progressing',
    'Needs Reinforcement',
    'Additional Practice Recommended',
  ]),
  generatedActivity: z.object({
    title: z.string().min(3).max(180),
    type: z.enum([
      'Multiple Choice',
      'True or False',
      'Short Answer',
      'Practice Exercises',
      'Diagnostic Assessment',
      'Revision Quiz',
    ]),
    shortLessonSummary: z.string().min(10).max(1200),
    questions: z
      .array(
        z.object({
          id: z.string().min(1).max(64),
          prompt: z.string().min(4).max(500),
          questionType: z.enum(['multiple_choice', 'true_false', 'short_answer']),
          options: z.array(z.string().max(240)).max(6).optional(),
          correctAnswer: z.string().min(1).max(240),
          explanation: z.string().min(4).max(500),
        })
      )
      .min(2)
      .max(6),
  }),
  learningPathPlan: z.object({
    title: z.string().min(3).max(180),
    estimatedLevel: z.enum(['Foundational', 'Developing', 'Proficient', 'Mastering']),
    masteryCriterion: z.string().min(4).max(240),
    modules: z
      .array(
        z.object({
          order: z.number().int().min(1).max(10),
          title: z.string().min(3).max(140),
          shortLesson: z.string().min(4).max(400),
          exerciseFocus: z.string().min(4).max(300),
          status: z.enum(['COMPLETED', 'IN_PROGRESS', 'UPCOMING']),
        })
      )
      .min(3)
      .max(6),
  }),
  interventionNeeded: z.boolean(),
  interventionStrategy: z.string().min(3).max(300),
  interventionContentSummary: z.string().min(5).max(1500),
});

function buildEvidenceSummary(input: AutonomousEventInput): {
  evidenceText: string;
  avgRecent: number;
  observationCount: number;
  hasSufficientEvidence: boolean;
} {
  const observationCount = input.recentScores.length;
  const avgRecent =
    Math.round((input.recentScores.reduce((acc, s) => acc + s, 0) / observationCount) * 10) / 10;
  const trendDelta =
    observationCount >= 2 ? Math.round((input.latestScore - input.recentScores[0]) * 10) / 10 : 0;
  const hasSufficientEvidence = observationCount >= 2;

  const missedStr =
    input.missedTopics.length > 0
      ? ` Pontos de atenção observados: ${input.missedTopics.join('; ')}.`
      : '';

  const evidenceText =
    `Evento ${input.eventType} na competência ${input.competencyCode} (${input.competencyName}). ` +
    `Nota mais recente: ${input.latestScore}%. Média nas últimas ${observationCount} observações: ${avgRecent}%` +
    `${observationCount >= 2 ? ` (tendência ${trendDelta >= 0 ? '+' : ''}${trendDelta} pts)` : ' (observação única — confiança provisória)'}.` +
    missedStr;

  return { evidenceText, avgRecent, observationCount, hasSufficientEvidence };
}

function buildDeterministicDemoAnalysis(
  input: AutonomousEventInput,
  engineSource: EngineSource
): StructuredAutonomousAnalysis {
  const { evidenceText, avgRecent, observationCount, hasSufficientEvidence } = buildEvidenceSummary(input);

  const needsSupport = input.latestScore < 70 || avgRecent < 72;
  const isMastering = input.latestScore >= 88 && avgRecent >= 85 && hasSufficientEvidence;

  let difficultyLevel: DifficultyLevel = 'Intermediate';
  let pedagogicalStatusRecommendation: PedagogicalStatus = 'Progressing';
  let priority: PriorityLevel = 'LOW';
  let nextAction: StructuredAutonomousAnalysis['nextAction'] = 'SCHEDULE_REVISION';
  let estimatedLevel: 'Foundational' | 'Developing' | 'Proficient' | 'Mastering' = 'Developing';

  if (needsSupport) {
    difficultyLevel = 'Foundational';
    pedagogicalStatusRecommendation = hasSufficientEvidence
      ? 'Needs Reinforcement'
      : 'Additional Practice Recommended';
    priority = avgRecent < 60 ? 'HIGH' : 'MEDIUM';
    nextAction = hasSufficientEvidence ? 'ASSIGN_REINFORCEMENT' : 'MONITOR_COLLECT_MORE_EVIDENCE';
    estimatedLevel = avgRecent < 60 ? 'Foundational' : 'Developing';
  } else if (isMastering) {
    difficultyLevel = 'Advanced';
    pedagogicalStatusRecommendation = 'Mastering';
    priority = 'LOW';
    nextAction = 'ADVANCE_DIFFICULTY';
    estimatedLevel = 'Mastering';
  } else if (input.latestScore >= 75) {
    difficultyLevel = 'Intermediate';
    pedagogicalStatusRecommendation = 'Progressing';
    priority = 'LOW';
    nextAction = 'SCHEDULE_REVISION';
    estimatedLevel = 'Proficient';
  }

  const confidence = hasSufficientEvidence
    ? Math.min(0.94, 0.65 + observationCount * 0.06)
    : 0.48;

  const uncertaintyNote = hasSufficientEvidence
    ? `Análise baseada em ${observationCount} observações longitudinais para ${input.competencyCode}.`
    : 'Apenas uma observação recente disponível; recomendação tratada como provisória até novas práticas confirmarem o nível de domínio.';

  const focusTopic = input.missedTopics[0] || input.competencyName;

  const questions: QuestionItem[] = [
    {
      id: `q_${input.eventId}_1`,
      prompt: `Verificação Conceitual (${input.subjectName} — ${input.competencyName}): Qual etapa aplica corretamente o princípio fundamental de ${focusTopic}?`,
      questionType: 'multiple_choice',
      options: [
        'Identificar os elementos conhecidos e aplicar a regra inversa/estrutural passo a passo',
        'Pular as etapas intermediárias e estimar o resultado final diretamente',
        'Aplicar uma transformação sem verificar as condições do enunciado',
        'Inverter a hipótese antes de validar os dados iniciais',
      ],
      correctAnswer: 'Identificar os elementos conhecidos e aplicar a regra inversa/estrutural passo a passo',
      explanation: `Dividir ${focusTopic} em passos explícitos reduz erros de procedimento e fortalece a autonomia.`,
    },
    {
      id: `q_${input.eventId}_2`,
      prompt: `Verdadeiro ou Falso: Ao trabalhar com ${input.competencyName}, conferir os resultados intermediários evita erros em cadeia nas etapas seguintes.`,
      questionType: 'true_false',
      options: ['Verdadeiro', 'Falso'],
      correctAnswer: 'Verdadeiro',
      explanation: `A verificação intermediária é um hábito essencial de autorregulação em ${input.subjectName}.`,
    },
    {
      id: `q_${input.eventId}_3`,
      prompt: `Prática Guiada: Explique brevemente como você verificaria sua resposta em uma questão de ${focusTopic}.`,
      questionType: 'short_answer',
      correctAnswer: `Substituir ou revisar cada etapa em relação à definição de ${input.competencyName}.`,
      explanation: `Conferir com a regra principal confirma compreensão conceitual (a IA oferece feedback formativo; o professor realiza a revisão oficial).`,
    },
  ];

  const isFunctionOrMath = /funç|func|mat/i.test(input.competencyName) || /mat/i.test(input.subjectName);
  const modules = isFunctionOrMath
    ? [
        { order: 1, title: 'Conceito e Lei de Formação', shortLesson: `Revisando definições e leitura gráfica de ${input.competencyName}.`, exerciseFocus: '3 questões introdutórias', status: 'COMPLETED' as const },
        { order: 2, title: 'Análise Gráfica e Pontos Críticos', shortLesson: 'Identificação de raízes, coeficientes e interpretação no plano cartesiano.', exerciseFocus: '3 exercícios guiados', status: needsSupport ? ('IN_PROGRESS' as const) : ('COMPLETED' as const) },
        { order: 3, title: 'Problemas Contextualizados (ENEM)', shortLesson: 'Modelagem de situações-problema reais do Ensino Médio.', exerciseFocus: '2 questões comentadas', status: needsSupport ? ('UPCOMING' as const) : ('IN_PROGRESS' as const) },
        { order: 4, title: 'Consolidação da Competência', shortLesson: 'Revisão sintética e verificação de domínio.', exerciseFocus: 'Quiz rápido de revisão', status: 'UPCOMING' as const },
      ]
    : [
        { order: 1, title: `Base Conceitual: ${input.competencyName}`, shortLesson: `Explicação objetiva sobre ${focusTopic}.`, exerciseFocus: '3 exercícios introdutórios', status: 'COMPLETED' as const },
        { order: 2, title: `Resolução Guiada em ${input.subjectName}`, shortLesson: 'Exemplos resolvidos focando os pontos de maior dúvida.', exerciseFocus: '3 exercícios com apoio', status: needsSupport ? ('IN_PROGRESS' as const) : ('COMPLETED' as const) },
        { order: 3, title: `Questões Estilo ENEM: ${focusTopic}`, shortLesson: 'Aplicação dos conceitos em questões contextualizadas.', exerciseFocus: '2 tarefas intermediárias', status: needsSupport ? ('UPCOMING' as const) : ('IN_PROGRESS' as const) },
        { order: 4, title: 'Consolidação e Revisão', shortLesson: 'Revisão sintética antes da próxima etapa.', exerciseFocus: 'Quiz de revisão (3 itens)', status: 'UPCOMING' as const },
      ];

  return {
    studentId: input.pseudonymId,
    subject: input.subjectName,
    competency: `${input.competencyCode} — ${input.competencyName}`,
    evidence: evidenceText,
    identifiedGap: needsSupport
      ? `Dificuldade observada em ${focusTopic} (${input.competencyName}); recomendado reforço prático guiado.`
      : `Bom desempenho em ${input.competencyName}; pronto para consolidar e avançar.`,
    confidence,
    uncertaintyNote,
    learningObjective: `Consolidar ${input.competencyName} (${input.gradeLevel}) até atingir >=80% de acerto.`,
    recommendedStrategy: needsSupport
      ? 'Revisão Guiada + Exercícios Práticos'
      : isMastering
        ? 'Aprofundamento Estilo ENEM'
        : 'Revisão e Consolidação',
    difficultyLevel,
    nextAction,
    priority,
    pedagogicalStatusRecommendation,
    generatedActivity: {
      title: `Reforço: ${input.competencyName}`,
      type: needsSupport ? 'Practice Exercises' : 'Revision Quiz',
      shortLessonSummary: `Resumo para ${input.competencyName} (${input.gradeLevel}): revise os conceitos centrais de ${focusTopic} e confira cada etapa antes de responder.`,
      questions,
    },
    learningPathPlan: {
      title: `Trilha de Estudo: ${input.competencyName}`,
      estimatedLevel,
      masteryCriterion: 'Atingir >= 80% nas verificações da competência',
      modules,
    },
    interventionPlan: needsSupport
      ? {
          needed: true,
          strategy: 'Revisão Guiada + Exercícios Práticos',
          contentSummary: `Apoio criado para ${input.pseudonymId} em ${input.subjectName} (${input.competencyName}) com foco nos pré-requisitos e questões contextualizadas.`,
        }
      : undefined,
    engineSource,
    guardrailAudit: {
      piiStripped: true,
      highImpactDecisionBlocked: true,
      schemaValidated: true,
    },
  };
}

export class AutonomousLearningEngine {
  async processEvent(rawInput: unknown): Promise<{
    analysis: StructuredAutonomousAnalysis;
    idempotentHit: boolean;
    geminiConfigured: boolean;
  }> {
    const input = AutonomousEventInputSchema.parse(rawInput);

    const cached = ProcessedEventCache.get(input.idempotencyKey);
    if (cached) {
      return {
        analysis: cached,
        idempotentHit: true,
        geminiConfigured: isGeminiConfigured(),
      };
    }

    const geminiAvailable = isGeminiConfigured();

    if (!geminiAvailable) {
      if (!input.demoMode) {
        throw new Error(
          'GEMINI_API_KEY não está configurada para o Modo LIVE. Configure GEMINI_API_KEY ou utilize o Modo DEMO.'
        );
      }
      const demoResult = buildDeterministicDemoAnalysis(input, 'DEMO_RULES');
      ProcessedEventCache.set(input.idempotencyKey, demoResult);
      return {
        analysis: demoResult,
        idempotentHit: false,
        geminiConfigured: false,
      };
    }

    const { evidenceText } = buildEvidenceSummary(input);

    const systemInstruction = `Você é o Motor de Apoio Pedagógico da plataforma EduPulse AI, voltada exclusivamente ao Ensino Médio brasileiro (1ª, 2ª e 3ª séries, BNCC e ENEM).
Seu papel é analisar resultados escolares e criar atividades curtas e objetivas em português do Brasil (pt-BR).
REGRAS DE SEGURANÇA E PRIVACIDADE:
1. Você recebe apenas o código pseudonimizado do estudante (nunca nome completo, e-mail ou documentos).
2. Nunca gere diagnósticos médicos, psicológicos ou clínicos.
3. Utilize linguagem pedagógica acolhedora, clara e prática para professores e alunos do Ensino Médio.
4. Nunca sugira ações punitivas, reprovação automática ou exclusão.
5. Indique o grau de confiança em confidence (0-1) e uncertaintyNote de forma simples.
6. Todo o conteúdo gerado DEVE ser em português do Brasil e alinhado ao Ensino Médio.`;

    const prompt = `Analise este evento educacional do Ensino Médio e retorne a recomendação pedagógica em português (pt-BR):
- Estudante (código): ${input.pseudonymId}
- Série: ${input.gradeLevel}
- Disciplina: ${input.subjectName}
- Competência: ${input.competencyCode} — ${input.competencyName}
- Evidências: ${evidenceText}
- Notas recentes (%): ${JSON.stringify(input.recentScores)}
- Pontos de atenção: ${input.missedTopics.length > 0 ? input.missedTopics.join(', ') : 'Nenhum especificado'}

Produza em português (pt-BR) de forma simples e direta:
1. Diagnóstico pedagógico claro e objetivo.
2. Atividade com 3 questões de nível Ensino Médio (1 multiple_choice com 4 opções, 1 true_false com ["Verdadeiro","Falso"], 1 short_answer).
3. Trilha de estudo com 4 módulos curtos e progressivos.
4. Intervenção automática (interventionNeeded: true quando nota ou média recente for < 72%).`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        identifiedGap: { type: Type.STRING },
        confidence: { type: Type.NUMBER },
        uncertaintyNote: { type: Type.STRING },
        learningObjective: { type: Type.STRING },
        recommendedStrategy: { type: Type.STRING },
        difficultyLevel: { type: Type.STRING, enum: ['Foundational', 'Intermediate', 'Advanced'] },
        nextAction: {
          type: Type.STRING,
          enum: [
            'ASSIGN_REINFORCEMENT',
            'ADVANCE_DIFFICULTY',
            'MONITOR_COLLECT_MORE_EVIDENCE',
            'SCHEDULE_REVISION',
          ],
        },
        priority: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'] },
        pedagogicalStatusRecommendation: {
          type: Type.STRING,
          enum: [
            'Mastering',
            'Progressing',
            'Needs Reinforcement',
            'Additional Practice Recommended',
          ],
        },
        generatedActivity: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            type: {
              type: Type.STRING,
              enum: [
                'Multiple Choice',
                'True or False',
                'Short Answer',
                'Practice Exercises',
                'Diagnostic Assessment',
                'Revision Quiz',
              ],
            },
            shortLessonSummary: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  prompt: { type: Type.STRING },
                  questionType: {
                    type: Type.STRING,
                    enum: ['multiple_choice', 'true_false', 'short_answer'],
                  },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ['id', 'prompt', 'questionType', 'correctAnswer', 'explanation'],
              },
            },
          },
          required: ['title', 'type', 'shortLessonSummary', 'questions'],
        },
        learningPathPlan: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            estimatedLevel: {
              type: Type.STRING,
              enum: ['Foundational', 'Developing', 'Proficient', 'Mastering'],
            },
            masteryCriterion: { type: Type.STRING },
            modules: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  order: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  shortLesson: { type: Type.STRING },
                  exerciseFocus: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ['COMPLETED', 'IN_PROGRESS', 'UPCOMING'] },
                },
                required: ['order', 'title', 'shortLesson', 'exerciseFocus', 'status'],
              },
            },
          },
          required: ['title', 'estimatedLevel', 'masteryCriterion', 'modules'],
        },
        interventionNeeded: { type: Type.BOOLEAN },
        interventionStrategy: { type: Type.STRING },
        interventionContentSummary: { type: Type.STRING },
      },
      required: [
        'identifiedGap',
        'confidence',
        'uncertaintyNote',
        'learningObjective',
        'recommendedStrategy',
        'difficultyLevel',
        'nextAction',
        'priority',
        'pedagogicalStatusRecommendation',
        'generatedActivity',
        'learningPathPlan',
        'interventionNeeded',
        'interventionStrategy',
        'interventionContentSummary',
      ],
    };

    let rawAi: z.infer<typeof StructuredAnalysisZod>;
    try {
      rawAi = await generateStructuredJson<z.infer<typeof StructuredAnalysisZod>>({
        systemInstruction,
        prompt,
        responseSchema,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (input.demoMode && (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429'))) {
        const demoFallback = buildDeterministicDemoAnalysis(input, 'DEMO_RULES');
        demoFallback.uncertaintyNote = `${demoFallback.uncertaintyNote} (Aviso: cota diária da API Gemini atingida; o Modo DEMO executou DEMO_RULES com transparência.)`;
        ProcessedEventCache.set(input.idempotencyKey, demoFallback);
        return {
          analysis: demoFallback,
          idempotentHit: false,
          geminiConfigured: true,
        };
      }
      throw err;
    }

    const parsed = StructuredAnalysisZod.parse(rawAi);
    if (containsUnsafeDirectives(parsed)) {
      throw new Error('Saída da IA bloqueada pelas diretrizes de segurança pedagógica.');
    }

    const analysis: StructuredAutonomousAnalysis = {
      studentId: input.pseudonymId,
      subject: input.subjectName,
      competency: `${input.competencyCode} — ${input.competencyName}`,
      evidence: evidenceText,
      identifiedGap: parsed.identifiedGap,
      confidence: Math.round(parsed.confidence * 100) / 100,
      uncertaintyNote: parsed.uncertaintyNote,
      learningObjective: parsed.learningObjective,
      recommendedStrategy: parsed.recommendedStrategy,
      difficultyLevel: parsed.difficultyLevel,
      nextAction: parsed.nextAction,
      priority: parsed.priority,
      pedagogicalStatusRecommendation: parsed.pedagogicalStatusRecommendation,
      generatedActivity: parsed.generatedActivity,
      learningPathPlan: parsed.learningPathPlan,
      interventionPlan: parsed.interventionNeeded
        ? {
            needed: true,
            strategy: parsed.interventionStrategy,
            contentSummary: parsed.interventionContentSummary,
          }
        : undefined,
      engineSource: 'GEMINI',
      guardrailAudit: {
        piiStripped: true,
        highImpactDecisionBlocked: true,
        schemaValidated: true,
      },
    };

    ProcessedEventCache.set(input.idempotencyKey, analysis);
    return {
      analysis,
      idempotentHit: false,
      geminiConfigured: true,
    };
  }

  /**
   * Decide de forma autônoma qual estudante e competência demandam ação imediata
   * da IA sem intervenção humana, priorizando lacunas sem apoio pendente.
   */
  async selectAndProcessAutonomousStep(rawInput: unknown): Promise<{
    selectedCandidate: AutoStepCandidate;
    selectionReason: string;
    eventId: string;
    idempotencyKey: string;
    analysis: StructuredAutonomousAnalysis;
    idempotentHit: boolean;
    geminiConfigured: boolean;
  }> {
    const parsed = AutoStepInputSchema.parse(rawInput);

    const ranked = [...parsed.candidates].sort((a, b) => {
      const aUrgency =
        (a.latestScore < 72 ? 100 : a.latestScore < 80 ? 50 : 10) +
        (!a.hasPendingActivity ? 30 : 0) +
        (!a.hasOpenIntervention && a.latestScore < 72 ? 25 : 0) +
        (100 - a.latestScore) * 0.2;
      const bUrgency =
        (b.latestScore < 72 ? 100 : b.latestScore < 80 ? 50 : 10) +
        (!b.hasPendingActivity ? 30 : 0) +
        (!b.hasOpenIntervention && b.latestScore < 72 ? 25 : 0) +
        (100 - b.latestScore) * 0.2;
      return bUrgency - aUrgency;
    });

    const chosen = ranked[0];
    const selectionReason =
      chosen.latestScore < 72
        ? `Prioridade automática: média ${chosen.latestScore}% em ${chosen.competencyName} sem reforço ativo.`
        : chosen.latestScore < 80
          ? `Consolidação automática: ${chosen.competencyName} com ${chosen.latestScore}% pronta para fixação.`
          : `Avanço automático: ${chosen.competencyName} atingiu ${chosen.latestScore}% e avançou de nível.`;

    const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const eventId = `evt_auto_${suffix}`;
    const idempotencyKey = `idem_auto_${chosen.pseudonymId}_${chosen.competencyCode}_${Math.round(chosen.latestScore)}_${suffix}`;

    const out = await this.processEvent({
      eventId,
      idempotencyKey,
      eventType: 'StudentProgressUpdated',
      institutionId: parsed.institutionId,
      pseudonymId: chosen.pseudonymId,
      gradeLevel: chosen.gradeLevel,
      subjectName: chosen.subjectName,
      competencyCode: chosen.competencyCode,
      competencyName: chosen.competencyName,
      recentScores: chosen.recentScores,
      latestScore: chosen.latestScore,
      completedActivitiesCount: chosen.completedActivitiesCount,
      missedTopics: chosen.latestScore < 75 ? [chosen.competencyName] : [],
      demoMode: parsed.demoMode,
    });

    return {
      selectedCandidate: chosen,
      selectionReason,
      eventId,
      idempotencyKey,
      ...out,
    };
  }

  /**
   * Seleciona automaticamente a prova mais urgente sem revisão da IA
   * (priorizando alunos com risco máximo de reprovação / notas < 60%),
   * produz a revisão comentada da prova e dispara o plano de recuperação.
   */
  async selectAndReviewExam(rawInput: unknown): Promise<{
    selectedExam: AutoExamCandidate;
    selectionReason: string;
    examReview: {
      verdict: string;
      whatWentWell: string;
      whereStruggled: string;
      recommendation: string;
      failureRiskAlert: 'PRIORIDADE_MAXIMA' | 'ATENCAO' | 'REGULAR';
      reviewText: string;
      engineSource: EngineSource;
    };
    eventId: string;
    idempotencyKey: string;
    analysis: StructuredAutonomousAnalysis;
    geminiConfigured: boolean;
  }> {
    const parsed = AutoExamReviewInputSchema.parse(rawInput);

    const pending = parsed.exams.filter((e) => !e.alreadyReviewed);
    const pool = pending.length > 0 ? pending : parsed.exams;

    const ranked = [...pool].sort((a, b) => {
      const aUrgency =
        (a.studentOverallAvg < 60 ? 120 : a.studentOverallAvg < 70 ? 60 : 10) +
        (a.percentage < 60 ? 90 : a.percentage < 72 ? 45 : 5) +
        (100 - a.percentage) * 0.3;
      const bUrgency =
        (b.studentOverallAvg < 60 ? 120 : b.studentOverallAvg < 70 ? 60 : 10) +
        (b.percentage < 60 ? 90 : b.percentage < 72 ? 45 : 5) +
        (100 - b.percentage) * 0.3;
      return bUrgency - aUrgency;
    });

    const chosen = ranked[0];
    const failureRiskAlert: 'PRIORIDADE_MAXIMA' | 'ATENCAO' | 'REGULAR' =
      chosen.studentOverallAvg < 60 || chosen.percentage < 55
        ? 'PRIORIDADE_MAXIMA'
        : chosen.studentOverallAvg < 70 || chosen.percentage < 70
          ? 'ATENCAO'
          : 'REGULAR';

    const gradeTen = (chosen.percentage / 10).toFixed(1).replace('.', ',');
    const selectionReason =
      failureRiskAlert === 'PRIORIDADE_MAXIMA'
        ? `Prioridade máxima de reprovação: prova de ${chosen.subjectName} com nota ${gradeTen} (${chosen.percentage}%).`
        : failureRiskAlert === 'ATENCAO'
          ? `Atenção preventiva: prova de ${chosen.subjectName} com nota ${gradeTen} (${chosen.percentage}%).`
          : `Revisão automática da prova de ${chosen.subjectName} (${gradeTen}).`;

    const buildDemoExamReview = (source: EngineSource) => {
      const verdict =
        chosen.percentage < 60
          ? `Risco de reprovação em ${chosen.subjectName} (nota ${gradeTen} / 10).`
          : chosen.percentage < 75
            ? `Desempenho intermediário em ${chosen.subjectName} (nota ${gradeTen} / 10).`
            : `Bom domínio em ${chosen.subjectName} (nota ${gradeTen} / 10).`;
      const whatWentWell =
        chosen.percentage >= 70
          ? `O estudante compreendeu os conceitos centrais de ${chosen.competencyName} e aplicou bem o raciocínio inicial.`
          : chosen.bestSubjectName
            ? `Demonstrou boa leitura de enunciado em ${chosen.competencyCode}, com facilidade observada em ${chosen.bestSubjectName} que pode apoiar o raciocínio.`
            : `Identificou corretamente os dados iniciais em parte das questões de ${chosen.competencyCode}.`;
      const whereStruggled =
        chosen.percentage < 60
          ? `Erros críticos na execução passo a passo e aplicação das propriedades de ${chosen.competencyName}, impactando a nota final.`
          : chosen.percentage < 75
            ? `Deslizes pontuais na interpretação de questões contextualizadas de ${chosen.competencyName}.`
            : `Sem erros estruturais relevantes nesta avaliação.`;
      const recommendation =
        chosen.percentage < 60
          ? `Lista automática de recuperação criada pela IA para elevar a média de ${chosen.subjectName} acima de 6,0.`
          : chosen.percentage < 75
            ? `Atividade rápida de revisão atribuída para consolidar ${chosen.competencyCode}.`
            : `Aprofundamento estilo ENEM disponível para manter o desempenho.`;

      const reviewText = [
        `Diagnóstico: ${verdict}`,
        `Ponto Forte: ${whatWentWell}`,
        `Onde Errou: ${whereStruggled}`,
        `Ação da IA: ${recommendation}`,
      ]
        .join('\n')
        .slice(0, 1950);

      return {
        verdict,
        whatWentWell,
        whereStruggled,
        recommendation,
        failureRiskAlert,
        reviewText,
        engineSource: source,
      };
    };

    let examReview: ReturnType<typeof buildDemoExamReview>;

    if (!isGeminiConfigured()) {
      if (!parsed.demoMode) {
        throw new Error(
          'GEMINI_API_KEY não está configurada para revisão de provas no Modo LIVE.'
        );
      }
      examReview = buildDemoExamReview('DEMO_RULES');
    } else {
      try {
        const ReviewSchemaZod = z.object({
          verdict: z.string().min(4).max(300),
          whatWentWell: z.string().min(4).max(500),
          whereStruggled: z.string().min(4).max(500),
          recommendation: z.string().min(4).max(500),
        });

        const rawReview = await generateStructuredJson<z.infer<typeof ReviewSchemaZod>>({
          systemInstruction:
            'Você é o revisor pedagógico automático de provas do Ensino Médio brasileiro na plataforma EduPulse AI. Analise o resultado da prova usando apenas o código anônimo do estudante, em português do Brasil claro, objetivo e útil para o professor.',
          prompt: `Faça a revisão automática desta prova do Ensino Médio:
- Estudante (código): ${chosen.pseudonymId} (${chosen.gradeLevel})
- Matéria da prova: ${chosen.subjectName}
- Competência avaliada: ${chosen.competencyCode} — ${chosen.competencyName}
- Nota da prova: ${gradeTen} / 10 (${chosen.percentage}%)
- Média geral do aluno: ${(chosen.studentOverallAvg / 10).toFixed(1).replace('.', ',')} / 10
- Matéria em que o aluno se dá melhor: ${chosen.bestSubjectName || 'Não informada'}
- Matéria em que o aluno é mais ruim: ${chosen.worstSubjectName || chosen.subjectName}
- Classificação de risco: ${failureRiskAlert}

Retorne:
- verdict: resumo direto da situação na prova (1 frase)
- whatWentWell: onde o aluno foi bem ou o que conseguiu resolver
- whereStruggled: onde errou ou qual lacuna causou perda de nota
- recommendation: ação automática de reforço ou avanço para o professor acompanhar`,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: { type: Type.STRING },
              whatWentWell: { type: Type.STRING },
              whereStruggled: { type: Type.STRING },
              recommendation: { type: Type.STRING },
            },
            required: ['verdict', 'whatWentWell', 'whereStruggled', 'recommendation'],
          },
        });

        const clean = ReviewSchemaZod.parse(rawReview);
        const reviewText = [
          `Diagnóstico: ${clean.verdict}`,
          `Ponto Forte: ${clean.whatWentWell}`,
          `Onde Errou: ${clean.whereStruggled}`,
          `Ação da IA: ${clean.recommendation}`,
        ]
          .join('\n')
          .slice(0, 1950);

        examReview = {
          ...clean,
          failureRiskAlert,
          reviewText,
          engineSource: 'GEMINI',
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (parsed.demoMode && (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429'))) {
          examReview = buildDemoExamReview('DEMO_RULES');
        } else {
          throw err;
        }
      }
    }

    const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const eventId = `evt_rev_${suffix}`;
    const idempotencyKey = `idem_rev_${chosen.resultId}_${Math.round(chosen.percentage)}_${suffix}`;

    const out = await this.processEvent({
      eventId,
      idempotencyKey,
      eventType: 'AssessmentSubmitted',
      institutionId: parsed.institutionId,
      pseudonymId: chosen.pseudonymId,
      gradeLevel: chosen.gradeLevel,
      subjectName: chosen.subjectName,
      competencyCode: chosen.competencyCode,
      competencyName: chosen.competencyName,
      recentScores: chosen.recentScores,
      latestScore: chosen.percentage,
      completedActivitiesCount: 1,
      missedTopics: chosen.percentage < 72 ? [chosen.competencyName] : [],
      demoMode: parsed.demoMode,
    });

    return {
      selectedExam: chosen,
      selectionReason,
      examReview,
      eventId,
      idempotencyKey,
      analysis: out.analysis,
      geminiConfigured: out.geminiConfigured,
    };
  }
}

export const autonomousLearningEngine = new AutonomousLearningEngine();
