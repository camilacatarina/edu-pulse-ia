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

  const isAlgebra = /equa|álgebra|algebra/i.test(input.competencyName);
  const modules = isAlgebra
    ? [
        { order: 1, title: 'Fundamentos da Igualdade e Equilíbrio', shortLesson: 'Visualizando equações como balanças em equilíbrio.', exerciseFocus: '3 verificações guiadas de igualdade', status: 'COMPLETED' as const },
        { order: 2, title: 'Domínio das Operações Inversas', shortLesson: 'Isolando incógnitas com operações opostas passo a passo.', exerciseFocus: '4 exercícios de operações inversas', status: needsSupport ? ('IN_PROGRESS' as const) : ('COMPLETED' as const) },
        { order: 3, title: 'Resolução de Equações Simples', shortLesson: 'Agrupando termos e preservando a igualdade.', exerciseFocus: '3 exercícios progressivos', status: needsSupport ? ('UPCOMING' as const) : ('IN_PROGRESS' as const) },
        { order: 4, title: 'Equações com Parênteses e Distributiva', shortLesson: 'Expandindo expressões agrupadas com atenção aos sinais.', exerciseFocus: '2 problemas intermediários', status: 'UPCOMING' as const },
        { order: 5, title: 'Exercícios de Consolidação', shortLesson: 'Resolução de situações-problema contextualizadas.', exerciseFocus: 'Quiz curto de consolidação', status: 'UPCOMING' as const },
      ]
    : [
        { order: 1, title: `Fundamentos de ${input.competencyName}`, shortLesson: `Explicação objetiva sobre ${focusTopic}.`, exerciseFocus: '3 exercícios introdutórios', status: 'COMPLETED' as const },
        { order: 2, title: `Raciocínio Guiado em ${input.subjectName}`, shortLesson: 'Exemplos resolvidos focando os pontos de maior dúvida.', exerciseFocus: '3 exercícios com apoio', status: needsSupport ? ('IN_PROGRESS' as const) : ('COMPLETED' as const) },
        { order: 3, title: `Prática Aplicada: ${focusTopic}`, shortLesson: 'Conexão dos conceitos com problemas estruturados.', exerciseFocus: '2 tarefas intermediárias', status: needsSupport ? ('UPCOMING' as const) : ('IN_PROGRESS' as const) },
        { order: 4, title: 'Consolidação e Verificação de Domínio', shortLesson: 'Revisão sintética antes da próxima etapa.', exerciseFocus: 'Quiz de revisão (3 itens)', status: 'UPCOMING' as const },
      ];

  return {
    studentId: input.pseudonymId,
    subject: input.subjectName,
    competency: `${input.competencyCode} — ${input.competencyName}`,
    evidence: evidenceText,
    identifiedGap: needsSupport
      ? `Fluência em desenvolvimento em ${focusTopic} (${input.competencyName}); a resolução em múltiplas etapas se beneficia de apoio estruturado.`
      : `Nenhuma lacuna crítica identificada em ${input.competencyName}; pronto para consolidação e aumento gradual de desafio.`,
    confidence,
    uncertaintyNote,
    learningObjective: `Fortalecer a precisão conceitual e a autonomia em ${input.competencyName} (${input.gradeLevel}) até atingir >=80% de domínio.`,
    recommendedStrategy: needsSupport
      ? 'Microaula Guiada + Sequência de Prática Estruturada'
      : isMastering
        ? 'Desafio de Aprofundamento e Transferência'
        : 'Revisão Espaçada e Consolidação',
    difficultyLevel,
    nextAction,
    priority,
    pedagogicalStatusRecommendation,
    generatedActivity: {
      title: `Reforço Adaptativo: ${input.competencyName}`,
      type: needsSupport ? 'Practice Exercises' : 'Revision Quiz',
      shortLessonSummary: `Revisão direcionada para ${input.competencyName} (${input.gradeLevel}): concentre-se em validar cada etapa e conectar ${focusTopic} aos princípios centrais antes de finalizar a questão.`,
      questions,
    },
    learningPathPlan: {
      title: `Trilha Adaptativa: ${input.competencyName}`,
      estimatedLevel,
      masteryCriterion: 'Atingir >= 80% em duas verificações formativas consecutivas',
      modules,
    },
    interventionPlan: needsSupport
      ? {
          needed: true,
          strategy: 'Microaula de Revisão + 3 Exercícios Guiados + Quiz de Consolidação',
          contentSummary: `Intervenção autônoma atribuída para ${input.pseudonymId} em ${input.subjectName} (${input.competencyCode}). Inclui revisão guiada, exercícios progressivos e nova verificação curta.`,
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

    const systemInstruction = `Você é o Motor Autônomo de Aprendizagem (Autonomous Learning Engine) da plataforma EduPulse AI.
Seu papel é realizar análises pedagógicas de apoio e criar materiais de ensino personalizados em português do Brasil (pt-BR).
REGRAS ESTRITAS DE SEGURANÇA E PRIVACIDADE:
1. Você recebe apenas o identificador pseudonimizado do estudante (nunca nome completo, e-mail ou documentos).
2. Nunca gere diagnósticos médicos, psicológicos ou clínicos.
3. Nunca rotule o estudante como incapaz, fraco ou problemático; utilize linguagem pedagógica acolhedora.
4. Nunca sugira ações punitivas, reprovação automática, exclusão ou alteração de permissões do sistema.
5. Não tire conclusões definitivas a partir de uma única nota baixa; indique a incerteza em confidence (0-1) e uncertaintyNote.
6. Todo o conteúdo gerado (títulos, explicações, perguntas, alternativas, gabaritos, módulos e estratégias) DEVE ser escrito em português do Brasil claro e adequado à faixa escolar.`;

    const prompt = `Analise este evento educacional pseudonimizado e retorne a recomendação pedagógica estruturada em português (pt-BR):
- ID Pseudonimizado do Estudante: ${input.pseudonymId}
- Faixa Escolar: ${input.gradeLevel}
- Disciplina: ${input.subjectName}
- Competência: ${input.competencyCode} — ${input.competencyName}
- Tipo de Evento: ${input.eventType}
- Evidências: ${evidenceText}
- Histórico Recente de Notas (%): ${JSON.stringify(input.recentScores)}
- Atividades Concluídas: ${input.completedActivitiesCount}
- Pontos de Atenção Observados: ${input.missedTopics.length > 0 ? input.missedTopics.join(', ') : 'Nenhum especificado'}

Produza em português (pt-BR):
1. Diagnóstico pedagógico da lacuna e calibração de confiança.
2. Atividade personalizada com 3 questões (1 multiple_choice com 4 opções, 1 true_false com ["Verdadeiro","Falso"], 1 short_answer).
3. Trilha de aprendizagem atualizada com 4 a 5 módulos sequenciais.
4. Definição de intervenção automática de baixo risco (interventionNeeded: true quando a nota ou média recente for < 72%).`;

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
}

export const autonomousLearningEngine = new AutonomousLearningEngine();
