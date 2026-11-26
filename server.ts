import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import {
  autonomousLearningEngine,
  AutonomousEventInputSchema,
} from './src/server/autonomousEngine.ts';
import { generateStructuredJson, isGeminiConfigured, Type } from './src/server/geminiClient.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const GenerateContentSchema = z.object({
  gradeLevel: z.string().min(1).max(40),
  subjectName: z.string().min(1).max(100),
  competencyCode: z.string().min(1).max(32),
  competencyName: z.string().min(1).max(140),
  difficulty: z.enum(['Foundational', 'Intermediate', 'Advanced']),
  materialType: z.enum([
    'Simplified Explanation',
    'Worked Examples',
    'Practice Exercises',
    'Revision Quiz',
    'Summary',
    'Study Plan',
  ]),
  pedagogicalObjective: z.string().min(3).max(400),
  demoMode: z.boolean().optional().default(false),
});

const EvaluateOpenResponseSchema = z.object({
  subjectName: z.string().min(1).max(100),
  competencyName: z.string().min(1).max(140),
  questionPrompt: z.string().min(3).max(600),
  referenceAnswer: z.string().min(2).max(400),
  studentResponse: z.string().min(1).max(1500),
  isHighImpact: z.boolean().optional().default(false),
  demoMode: z.boolean().optional().default(false),
});

const LearningCycleBatchSchema = z.object({
  events: z.array(AutonomousEventInputSchema).max(25),
});

function buildDemoMaterial(input: z.infer<typeof GenerateContentSchema>) {
  const mapType: Record<string, string> = {
    'Simplified Explanation': 'Explicação Simplificada',
    'Worked Examples': 'Exemplos Resolvidos',
    'Practice Exercises': 'Exercícios Práticos',
    'Revision Quiz': 'Quiz de Revisão',
    Summary: 'Resumo',
    'Study Plan': 'Plano de Estudos',
  };
  const typePt = mapType[input.materialType] || input.materialType;
  return {
    title: `${typePt}: ${input.competencyName}`,
    summary: `Material estruturado para ${input.gradeLevel} alinhado à competência ${input.competencyCode} (${input.competencyName}). Objetivo pedagógico: ${input.pedagogicalObjective}`,
    sections: [
      {
        heading: 'Princípio Central',
        body: `Comece pela definição essencial de ${input.competencyName} em ${input.subjectName}. Valide cada transformação intermediária antes de avançar para a próxima etapa.`,
      },
      {
        heading: 'Roteiro Guiado',
        body: `Passo 1: Identifique os dados fornecidos. Passo 2: Aplique a regra correspondente a ${input.competencyCode}. Passo 3: Confira a coerência do resultado com o enunciado original.`,
      },
    ],
    questions: [
      {
        id: `gen_${Date.now()}_1`,
        prompt: `Aplicando ${input.competencyName}: qual primeira etapa mantém o raciocínio correto?`,
        questionType: 'multiple_choice' as const,
        options: [
          'Identificar o objetivo da questão e organizar as informações conhecidas',
          'Pular as etapas intermediárias e tentar adivinhar o valor final',
          'Desconsiderar unidades ou restrições do problema',
          'Aplicar uma fórmula sem verificar o contexto',
        ],
        correctAnswer: 'Identificar o objetivo da questão e organizar as informações conhecidas',
        explanation: 'Organizar as informações iniciais evita erros conceituais e de procedimento.',
      },
      {
        id: `gen_${Date.now()}_2`,
        prompt: `Verdadeiro ou Falso: Revisar casos particulares fortalece o domínio de ${input.competencyCode}.`,
        questionType: 'true_false' as const,
        options: ['Verdadeiro', 'Falso'],
        correctAnswer: 'Verdadeiro',
        explanation: 'A verificação de casos particulares consolida a compreensão da competência.',
      },
    ],
  };
}

function buildDemoOpenEvaluation(input: z.infer<typeof EvaluateOpenResponseSchema>) {
  const keywords = input.referenceAnswer
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 4);
  const respLower = input.studentResponse.toLowerCase();
  const matches = keywords.filter((kw) => respLower.includes(kw));
  const ratio = keywords.length > 0 ? matches.length / Math.min(keywords.length, 4) : 0.6;
  const preliminaryScore = Math.min(100, Math.max(45, Math.round(ratio * 100)));

  return {
    preliminaryScore,
    feedback:
      preliminaryScore >= 75
        ? `Boa explicação envolvendo conceitos centrais de ${input.competencyName}. O professor confirmará a avaliação oficial quando aplicável.`
        : `Bom ponto de partida em ${input.competencyName}. Tente conectar sua explicação de forma mais explícita a: ${input.referenceAnswer}.`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'edupulse-ai',
      geminiConfigured: isGeminiConfigured(),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/autonomous-engine/process-event', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await autonomousLearningEngine.processEvent(req.body);
      res.json({
        ok: true,
        ...result,
        processedAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/autonomous-engine/auto-step', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await autonomousLearningEngine.selectAndProcessAutonomousStep(req.body);
      res.json({
        ok: true,
        ...result,
        processedAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/autonomous-engine/auto-review-exam', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await autonomousLearningEngine.selectAndReviewExam(req.body);
      res.json({
        ok: true,
        ...result,
        processedAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/internal/learning-cycle', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const configuredSecret = process.env.INTERNAL_CRON_SECRET?.trim();
      if (configuredSecret) {
        const provided = req.headers['x-internal-secret'];
        if (provided !== configuredSecret) {
          res.status(401).json({ ok: false, error: 'Chamada não autorizada ao ciclo interno.' });
          return;
        }
      }

      const parsed = LearningCycleBatchSchema.parse(req.body);
      const results = [];
      for (const evt of parsed.events) {
        const out = await autonomousLearningEngine.processEvent(evt);
        results.push({
          eventId: evt.eventId,
          idempotencyKey: evt.idempotencyKey,
          idempotentHit: out.idempotentHit,
          engineSource: out.analysis.engineSource,
          nextAction: out.analysis.nextAction,
        });
      }

      res.json({
        ok: true,
        processedCount: results.length,
        results,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/ai/generate-content', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = GenerateContentSchema.parse(req.body);

      if (!isGeminiConfigured()) {
        if (!input.demoMode) {
          res.status(400).json({
            ok: false,
            error: 'GEMINI_API_KEY não está configurada. Configure a chave nos Segredos do servidor ou utilize o Modo DEMO.',
          });
          return;
        }

        res.json({
          ok: true,
          origin: 'DEMO_RULES',
          geminiConfigured: false,
          material: buildDemoMaterial(input),
        });
        return;
      }

      try {
        const material = await generateStructuredJson<{
          title: string;
          summary: string;
          sections: { heading: string; body: string }[];
          questions: {
            id: string;
            prompt: string;
            questionType: 'multiple_choice' | 'true_false' | 'short_answer';
            options?: string[];
            correctAnswer: string;
            explanation: string;
          }[];
        }>({
          systemInstruction:
            'Você é um especialista em currículo do Ensino Médio brasileiro (BNCC e ENEM) na plataforma EduPulse AI. Gere materiais didáticos claros e objetivos em português do Brasil (pt-BR).',
          prompt: `Crie um material do tipo "${input.materialType}" em português do Brasil (pt-BR) para o Ensino Médio:
Série: ${input.gradeLevel}
Disciplina: ${input.subjectName}
Competência: ${input.competencyCode} — ${input.competencyName}
Nível: ${input.difficulty}
Objetivo: ${input.pedagogicalObjective}
Inclua 2 seções explicativas curtas e 3 questões de Ensino Médio com gabarito e explicações.`,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    heading: { type: Type.STRING },
                    body: { type: Type.STRING },
                  },
                  required: ['heading', 'body'],
                },
              },
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
            required: ['title', 'summary', 'sections', 'questions'],
          },
        });

        res.json({
          ok: true,
          origin: 'GEMINI',
          geminiConfigured: true,
          material,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (input.demoMode && (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429'))) {
          res.json({
            ok: true,
            origin: 'DEMO_RULES',
            geminiConfigured: true,
            material: buildDemoMaterial(input),
          });
          return;
        }
        throw err;
      }
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/ai/evaluate-open-response', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = EvaluateOpenResponseSchema.parse(req.body);

      if (!isGeminiConfigured()) {
        const demoEval = buildDemoOpenEvaluation(input);
        res.json({
          ok: true,
          origin: 'DEMO_RULES',
          requiresTeacherReview: true,
          ...demoEval,
        });
        return;
      }

      try {
        const evaluation = await generateStructuredJson<{
          preliminaryScore: number;
          feedback: string;
        }>({
          systemInstruction:
            'Você fornece feedback formativo preliminar construtivo e acolhedor em português do Brasil (pt-BR) para respostas abertas de estudantes. Nunca atribua notas finais punitivas; os professores mantêm a autoridade de revisão.',
          prompt: `Disciplina: ${input.subjectName}
Competência: ${input.competencyName}
Pergunta: ${input.questionPrompt}
Gabarito de Referência: ${input.referenceAnswer}
Resposta do Estudante: ${input.studentResponse}
Retorne preliminaryScore (0-100) e um feedback educativo construtivo (2-3 frases em português).`,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              preliminaryScore: { type: Type.INTEGER },
              feedback: { type: Type.STRING },
            },
            required: ['preliminaryScore', 'feedback'],
          },
        });

        res.json({
          ok: true,
          origin: 'GEMINI',
          requiresTeacherReview: input.isHighImpact || true,
          preliminaryScore: Math.min(100, Math.max(0, evaluation.preliminaryScore)),
          feedback: evaluation.feedback,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (input.demoMode && (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429'))) {
          const demoEval = buildDemoOpenEvaluation(input);
          res.json({
            ok: true,
            origin: 'DEMO_RULES',
            requiresTeacherReview: true,
            ...demoEval,
          });
          return;
        }
        throw err;
      }
    } catch (error) {
      next(error);
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        ok: false,
        error: 'Dados da requisição inválidos',
        details: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
      return;
    }

    const message = err instanceof Error ? err.message : 'Erro interno do servidor';
    const status = message.includes('RESOURCE_EXHAUSTED') || message.includes('429')
      ? 429
      : message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID')
        ? 502
        : message.includes('não está configurada')
          ? 400
          : 500;

    res.status(status).json({
      ok: false,
      error: status === 429
        ? 'Cota diária da API Gemini atingida. Atualize a chave em Configurações > Segredos ou utilize o Modo DEMO.'
        : message,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor EduPulse AI em execução em http://0.0.0.0:${PORT}`);
  });
}

startServer();
