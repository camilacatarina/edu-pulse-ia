import {
  AIInsight,
  Assessment,
  AssessmentResult,
  AuditLog,
  Competency,
  ConsentRecord,
  Institution,
  Intervention,
  LearningActivity,
  LearningEvent,
  LearningPath,
  PedagogicalStatus,
  SchoolClass,
  Student,
  Subject,
} from '../types/domain';
import { formatStructuredExamReview } from '../utils/pedagogicalAnalytics';

export interface WorkspaceDataset {
  institution: Institution;
  classes: SchoolClass[];
  students: Student[];
  subjects: Subject[];
  competencies: Competency[];
  assessments: Assessment[];
  assessmentResults: AssessmentResult[];
  activities: LearningActivity[];
  learningPaths: LearningPath[];
  interventions: Intervention[];
  learningEvents: LearningEvent[];
  aiInsights: AIInsight[];
  auditLogs: AuditLog[];
  consentRecords: ConsentRecord[];
}

const DEMO_INSTITUTION_ID = 'demo_colegio_horizonte_em';
const DEMO_STAFF_UID = 'demo_teacher_uid';

// Perfis realistas do Ensino Médio com matérias fortes e fracas distintas
const STUDENT_PROFILES: Array<{
  name: string;
  scoresBySub: [number, number, number, number, number]; // MAT, FIS, QUI, PORT, BIO
}> = [
  { name: 'Lucas Martins', scoresBySub: [48, 42, 55, 86, 78] },       // Risco Máximo: ruim em Física/Mat, bom em Português
  { name: 'Sophia Ribeiro', scoresBySub: [93, 89, 71, 84, 79] },      // Excelente em Exatas
  { name: 'Mateus Carvalho', scoresBySub: [52, 49, 54, 68, 58] },     // Risco Máximo: 4 matérias < 6,0
  { name: 'Helena Ferreira', scoresBySub: [74, 68, 72, 92, 88] },     // Melhor em Português e Biologia
  { name: 'Gabriel Souza', scoresBySub: [82, 79, 56, 63, 74] },       // Atenção em Química
  { name: 'Isabella Costa', scoresBySub: [44, 51, 58, 76, 81] },      // Risco Máximo em Exatas, boa em Biologia
  { name: 'Rafael Almeida', scoresBySub: [86, 84, 81, 69, 75] },      // Regular, mais fraco em Português
  { name: 'Clara Mendes', scoresBySub: [78, 74, 88, 91, 94] },        // Excelente em Bio/Português
  { name: 'Enzo Oliveira', scoresBySub: [39, 45, 48, 61, 56] },       // Risco Máximo crítico
  { name: 'Valentina Rocha', scoresBySub: [66, 54, 72, 88, 83] },     // Atenção em Física, forte em Português
  { name: 'Pedro Henrique', scoresBySub: [90, 86, 83, 74, 79] },      // Forte em Matemática
  { name: 'Júlia Nascimento', scoresBySub: [57, 62, 53, 84, 76] },    // Risco Máximo (Mat + Qui < 6,0)
  { name: 'Arthur Lima', scoresBySub: [76, 81, 79, 55, 72] },         // Atenção em Português
  { name: 'Beatriz Santos', scoresBySub: [84, 77, 89, 90, 92] },      // Ótima em Biologia e Português
  { name: 'Caio Barbosa', scoresBySub: [46, 52, 64, 58, 71] },        // Risco Máximo (Mat, Fis, Port < 6,0)
  { name: 'Camila Pereira', scoresBySub: [79, 75, 82, 87, 84] },      // Regular em todas
  { name: 'Daniel Teixeira', scoresBySub: [68, 58, 63, 79, 85] },     // Atenção em Física, forte em Bio
  { name: 'Laura Gomes', scoresBySub: [88, 84, 80, 93, 91] },         // Alto desempenho geral
];

function deterministicOffset(seed: number, range: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  const frac = x - Math.floor(x);
  return Math.round((frac * 2 - 1) * range);
}

function statusFromScore(score: number): PedagogicalStatus {
  if (score >= 85) return 'Mastering';
  if (score >= 72) return 'Progressing';
  if (score >= 60) return 'Additional Practice Recommended';
  return 'Needs Reinforcement';
}

export function createDeterministicDemoDataset(): WorkspaceDataset {
  const baseDate = '2026-11-18T09:00:00.000Z';

  const institution: Institution = {
    id: DEMO_INSTITUTION_ID,
    name: 'Colégio Horizonte — Ensino Médio',
    joinCode: 'EM-HORIZON',
    ownerUid: DEMO_STAFF_UID,
    staffUids: [DEMO_STAFF_UID],
    retentionDays: 365,
    createdAt: baseDate,
  };

  const subjects: Subject[] = [
    { id: 'sub_mat', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: 'Matemática', code: 'MAT', createdAt: baseDate },
    { id: 'sub_fis', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: 'Física', code: 'FIS', createdAt: baseDate },
    { id: 'sub_qui', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: 'Química', code: 'QUI', createdAt: baseDate },
    { id: 'sub_por', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: 'Português e Redação', code: 'PORT', createdAt: baseDate },
    { id: 'sub_bio', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: 'Biologia', code: 'BIO', createdAt: baseDate },
  ];

  const competencies: Competency[] = [
    {
      id: 'comp_mat_fun',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_mat',
      code: 'MAT-FUN',
      name: 'Funções Afins e Quadráticas',
      description: 'Análise de gráficos, raízes, vértice da parábola e modelagem de problemas cotidianos (BNCC EM13MAT302).',
      gradeLevel: '1ª Série EM',
      createdAt: baseDate,
    },
    {
      id: 'comp_mat_prb',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_mat',
      code: 'MAT-PRB',
      name: 'Probabilidade e Análise Combinatória',
      description: 'Princípio multiplicativo, arranjos, combinações e cálculo de probabilidade condicional (ENEM).',
      gradeLevel: '2ª Série EM',
      createdAt: baseDate,
    },
    {
      id: 'comp_fis_cin',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_fis',
      code: 'FIS-CIN',
      name: 'Cinemática e Leis de Newton',
      description: 'Movimento uniformemente variado, leitura de gráficos v×t e aplicação das leis da dinâmica.',
      gradeLevel: '1ª Série EM',
      createdAt: baseDate,
    },
    {
      id: 'comp_fis_ele',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_fis',
      code: 'FIS-ELE',
      name: 'Eletrodinâmica e Circuitos',
      description: 'Leis de Ohm, associação de resistores e cálculo de potência elétrica.',
      gradeLevel: '3ª Série EM',
      createdAt: baseDate,
    },
    {
      id: 'comp_qui_est',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_qui',
      code: 'QUI-EST',
      name: 'Estequiometria e Cálculo de Mol',
      description: 'Balanceamento de equações químicas, massa molar e rendimento de reações.',
      gradeLevel: '2ª Série EM',
      createdAt: baseDate,
    },
    {
      id: 'comp_qui_org',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_qui',
      code: 'QUI-ORG',
      name: 'Funções Orgânicas e Isomeria',
      description: 'Identificação de cadeias carbônicas, grupos funcionais oxigenados e nomenclatura IUPAC.',
      gradeLevel: '3ª Série EM',
      createdAt: baseDate,
    },
    {
      id: 'comp_por_int',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_por',
      code: 'PORT-INT',
      name: 'Leitura Crítica e Intertextualidade',
      description: 'Inferência de sentidos, recursos estilísticos e análise de textos multimodais.',
      gradeLevel: '1ª Série EM',
      createdAt: baseDate,
    },
    {
      id: 'comp_por_arg',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_por',
      code: 'PORT-ARG',
      name: 'Redação Dissertativo-Argumentativa (ENEM)',
      description: 'Construção de tese, repertório sociocultural produtivo, coesão e proposta de intervenção.',
      gradeLevel: '3ª Série EM',
      createdAt: baseDate,
    },
    {
      id: 'comp_bio_eco',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_bio',
      code: 'BIO-ECO',
      name: 'Ecologia e Dinâmica de Ecossistemas',
      description: 'Ciclos biogeoquímicos, relações ecológicas e impactos ambientais contemporâneos.',
      gradeLevel: '2ª Série EM',
      createdAt: baseDate,
    },
    {
      id: 'comp_bio_gen',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_bio',
      code: 'BIO-GEN',
      name: 'Genética Mendeliana e Molecular',
      description: 'Herança genética, síntese proteica e interpretação de heredogramas.',
      gradeLevel: '3ª Série EM',
      createdAt: baseDate,
    },
  ];

  const classes: SchoolClass[] = [
    { id: 'cls_1a', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: '1ª Série A', gradeLevel: '1ª Série EM', academicYear: '2026', teacherUid: DEMO_STAFF_UID, teacherName: 'Prof. Marcus Silva', createdAt: baseDate },
    { id: 'cls_2a', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: '2ª Série A', gradeLevel: '2ª Série EM', academicYear: '2026', teacherUid: DEMO_STAFF_UID, teacherName: 'Profª. Clara Mendes', createdAt: baseDate },
    { id: 'cls_3a', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: '3ª Série A (ENEM)', gradeLevel: '3ª Série EM', academicYear: '2026', teacherUid: DEMO_STAFF_UID, teacherName: 'Prof. Rafael Duarte', createdAt: baseDate },
  ];

  const subjectIdsAll = subjects.map((s) => s.id);
  const students: Student[] = [];
  const assessments: Assessment[] = [];
  const assessmentResults: AssessmentResult[] = [];
  const activities: LearningActivity[] = [];
  const learningPaths: LearningPath[] = [];
  const interventions: Intervention[] = [];
  const learningEvents: LearningEvent[] = [];
  const aiInsights: AIInsight[] = [];
  const auditLogs: AuditLog[] = [];
  const consentRecords: ConsentRecord[] = [];

  subjects.forEach((sub, idx) => {
    const comp = competencies[idx * 2];
    const cls = classes[idx % classes.length];
    assessments.push({
      id: `asmt_em_${idx + 1}`,
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      classId: cls.id,
      subjectId: sub.id,
      competencyId: comp.id,
      title: `Prova Bimestral: ${sub.name} — ${comp.name}`,
      type: 'Diagnostic Assessment',
      difficulty: 'Intermediate',
      isHighImpact: true,
      createdByUid: DEMO_STAFF_UID,
      createdAt: baseDate,
      questions: [
        {
          id: `aq_${idx}_1`,
          prompt: `Em uma questão de ${sub.name} (${comp.name}), qual estratégia garante maior precisão na resolução?`,
          questionType: 'multiple_choice',
          options: [
            'Extrair os dados do enunciado, verificar unidades/condições e aplicar o modelo conceitual passo a passo',
            'Aplicar fórmulas de forma mecânica sem interpretar o contexto do problema',
            'Descartar gráficos e restrições de domínio antes de calcular',
            'Escolher o resultado aproximado sem conferir as etapas',
          ],
          correctAnswer: 'Extrair os dados do enunciado, verificar unidades/condições e aplicar o modelo conceitual passo a passo',
          explanation: `Interpretar os dados e validar condições de existência é essencial em ${comp.code}.`,
        },
        {
          id: `aq_${idx}_2`,
          prompt: `Verdadeiro ou Falso: Relacionar o conceito de ${comp.name} a situações-problema do ENEM facilita a transferência do conhecimento.`,
          questionType: 'true_false',
          options: ['Verdadeiro', 'Falso'],
          correctAnswer: 'Verdadeiro',
          explanation: 'A contextualização fortalece a compreensão profunda exigida no Ensino Médio.',
        },
      ],
    });
  });

  STUDENT_PROFILES.forEach((profile, i) => {
    const classIdx = Math.floor(i / 6);
    const cls = classes[classIdx];
    const num = String(i + 1).padStart(3, '0');
    const studentId = `stu_demo_${num}`;
    const pseudonymId = `EM-${num}`;

    const avgScore =
      Math.round(
        (profile.scoresBySub.reduce((a, b) => a + b, 0) / profile.scoresBySub.length) * 10
      ) / 10;
    const completionRate = Math.min(99, Math.max(58, Math.round(avgScore + 8 + deterministicOffset(i + 5, 6))));
    const pedStatus = statusFromScore(avgScore);

    students.push({
      id: studentId,
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      studentOwnerUid: i === 0 ? 'demo_student_active' : '',
      classId: cls.id,
      pseudonymId,
      displayName: profile.name,
      gradeLevel: cls.gradeLevel,
      pedagogicalStatus: pedStatus,
      averageScore: avgScore,
      completionRate,
      subjectIds: subjectIdsAll,
      createdAt: baseDate,
      updatedAt: '2026-11-25T16:30:00.000Z',
    });

    // Gerar 1 a 2 provas por matéria para os 5 componentes curriculares
    subjects.forEach((sub, sIdx) => {
      const baseSubScore = profile.scoresBySub[sIdx];
      const subComps = competencies.filter((c) => c.subjectId === sub.id);
      const primaryComp =
        subComps.find((c) => c.gradeLevel === cls.gradeLevel) || subComps[0];
      const asmt = assessments[sIdx];

      // Prova 1 (já revisada pela IA para histórico inicial)
      const p1 = Math.min(100, Math.max(25, baseSubScore + deterministicOffset(i * 11 + sIdx, 4)));
      const isPendingAiReview = i < 6 && (baseSubScore < 60 || sIdx === 0 || sIdx === 1);

      assessmentResults.push({
        id: `res_demo_${num}_${sub.code.toLowerCase()}_1`,
        institutionId: DEMO_INSTITUTION_ID,
        staffUids: [DEMO_STAFF_UID],
        studentOwnerUid: i === 0 ? 'demo_student_active' : '',
        assessmentId: asmt.id,
        studentId,
        subjectId: sub.id,
        competencyId: primaryComp.id,
        score: p1,
        maxScore: 100,
        percentage: p1,
        teacherReviewed: !isPendingAiReview && p1 >= 60,
        aiPreliminaryFeedback: isPendingAiReview
          ? ''
          : formatStructuredExamReview({
              verdict:
                p1 < 60
                  ? `Risco de reprovação em ${sub.name} (nota ${(p1 / 10).toFixed(1).replace('.', ',')}).`
                  : p1 >= 80
                    ? `Desempenho sólido em ${sub.name}.`
                    : `Desempenho regular em ${sub.name}, com espaço para consolidação.`,
              whatWentWell:
                p1 >= 70
                  ? `Domínio consistente dos conceitos introdutórios de ${primaryComp.name}.`
                  : `Compreensão parcial da leitura inicial do enunciado em ${primaryComp.code}.`,
              whereStruggled:
                p1 < 60
                  ? `Erros recorrentes na resolução intermediária e aplicação de regras em ${primaryComp.name}.`
                  : p1 < 80
                    ? `Pequenos deslizes em questões contextualizadas de maior interpretação.`
                    : `Sem lacunas críticas registradas nesta prova.`,
              recommendation:
                p1 < 60
                  ? `Plano automático de recuperação atribuído com foco em ${primaryComp.name}.`
                  : `Manter ritmo com revisão rápida antes do próximo simulado.`,
            }),
        submittedAt: `2026-11-${String(12 + sIdx * 2).padStart(2, '0')}T14:20:00.000Z`,
      });

      // Prova 2 mais recente nas 2 principais matérias críticas ou destaque
      if (sIdx < 2) {
        const p2 = Math.min(100, Math.max(22, baseSubScore + (baseSubScore < 60 ? -3 : 2)));
        const leaveUnreviewedForAutoAi = i === 0 || i === 2 || i === 5 || i === 8;
        assessmentResults.push({
          id: `res_demo_${num}_${sub.code.toLowerCase()}_2`,
          institutionId: DEMO_INSTITUTION_ID,
          staffUids: [DEMO_STAFF_UID],
          studentOwnerUid: i === 0 ? 'demo_student_active' : '',
          assessmentId: asmt.id,
          studentId,
          subjectId: sub.id,
          competencyId: (subComps[1] || primaryComp).id,
          score: p2,
          maxScore: 100,
          percentage: p2,
          teacherReviewed: false,
          aiPreliminaryFeedback: leaveUnreviewedForAutoAi
            ? ''
            : formatStructuredExamReview({
                verdict:
                  p2 < 60
                    ? `Alerta em ${sub.name}: nota ${(p2 / 10).toFixed(1).replace('.', ',')}.`
                    : `Evolução estável em ${sub.name}.`,
                whatWentWell: `Boa identificação das informações iniciais das questões de ${sub.name}.`,
                whereStruggled:
                  p2 < 60
                    ? `Dificuldade na etapa de equacionamento e interpretação em ${primaryComp.name}.`
                    : `Atenção pontual na conferência de resultados finais.`,
                recommendation:
                  p2 < 60
                    ? `IA preparou lista de recuperação automática para elevar a média acima de 6,0.`
                    : `Aprofundamento opcional estilo ENEM.`,
              }),
          submittedAt: `2026-11-${String(22 + sIdx).padStart(2, '0')}T10:45:00.000Z`,
        });
      }
    });

    consentRecords.push({
      id: `cons_demo_${num}`,
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      studentId,
      guardianConsentStatus: 'VERIFIED',
      dataMinimizationAccepted: true,
      retentionPolicyDays: 365,
      updatedByUid: DEMO_STAFF_UID,
      updatedAt: baseDate,
    });
  });

  // Gerar atividades e planos iniciais para os alunos com prioridade máxima ou atenção
  const spotlightStudents = students.filter((s) => s.averageScore < 72).slice(0, 7);

  spotlightStudents.forEach((stu, idx) => {
    const stuProfile = STUDENT_PROFILES.find((p) => p.name === stu.displayName);
    const worstSubIdx = stuProfile
      ? stuProfile.scoresBySub.indexOf(Math.min(...stuProfile.scoresBySub))
      : 0;
    const sub = subjects[worstSubIdx] || subjects[0];
    const comp =
      competencies.find((c) => c.subjectId === sub.id && c.gradeLevel === stu.gradeLevel) ||
      competencies.find((c) => c.subjectId === sub.id)!;

    const evtId = `evt_demo_${idx + 1}`;
    const actId = `act_demo_${idx + 1}`;
    const intId = `int_demo_${idx + 1}`;
    const ts = `2026-11-25T${String(9 + (idx % 9)).padStart(2, '0')}:15:00.000Z`;

    activities.push({
      id: actId,
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      studentOwnerUid: stu.studentOwnerUid,
      studentId: stu.id,
      classId: stu.classId,
      subjectId: sub.id,
      competencyId: comp.id,
      title: `Recuperação da Prova: ${comp.name}`,
      type: 'Practice Exercises',
      difficulty: 'Foundational',
      origin: 'AI_AUTONOMOUS',
      status: idx % 4 === 0 ? 'COMPLETED' : 'ASSIGNED',
      scorePercentage: idx % 4 === 0 ? Math.min(82, stu.averageScore + 16) : undefined,
      feedbackSummary:
        idx % 4 === 0
          ? `Concluída com recuperação de +16 pts em ${comp.code}.`
          : `Atividade criada automaticamente pela IA após baixa nota em ${sub.name}.`,
      questions: [
        {
          id: `dq_${idx}_1`,
          prompt: `Em ${sub.name} (${comp.name}), qual procedimento evita os erros mais comuns em provas do Ensino Médio e ENEM?`,
          questionType: 'multiple_choice',
          options: [
            'Organizar os dados iniciais, aplicar o conceito passo a passo e validar o resultado final',
            'Pular a leitura detalhada do enunciado para ganhar tempo',
            'Desconsiderar unidades de medida ou condições de contorno',
            'Assumir a resposta sem testar a coerência com a pergunta',
          ],
          correctAnswer: 'Organizar os dados iniciais, aplicar o conceito passo a passo e validar o resultado final',
          explanation: `A leitura atenta e a conferência das etapas reduzem erros recorrentes em ${comp.code}.`,
        },
        {
          id: `dq_${idx}_2`,
          prompt: `Verdadeiro ou Falso: Revisar os erros da prova anterior antes de refazer exercícios melhora o desempenho em ${comp.code}.`,
          questionType: 'true_false',
          options: ['Verdadeiro', 'Falso'],
          correctAnswer: 'Verdadeiro',
          explanation: 'Consolidar o conceito-chave corrige falhas de base rapidamente.',
        },
        {
          id: `dq_${idx}_3`,
          prompt: `Explique com suas palavras qual foi o principal ponto de atenção em ${comp.name}.`,
          questionType: 'short_answer',
          correctAnswer: `Identificar corretamente os dados e aplicar as propriedades de ${comp.name} conferindo o resultado.`,
          explanation: 'Justificar o próprio raciocínio ajuda a fixar o conteúdo.',
        },
      ],
      createdAt: ts,
      updatedAt: ts,
    });

    learningPaths.push({
      id: `path_demo_${idx + 1}`,
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      studentOwnerUid: stu.studentOwnerUid,
      studentId: stu.id,
      subjectId: sub.id,
      competencyId: comp.id,
      title: `Trilha de Recuperação: ${sub.name} — ${comp.name}`,
      educationalObjective: `Elevar o rendimento em ${sub.name} (${stu.gradeLevel}) para acima de 6,0 (60%) com revisão guiada.`,
      estimatedLevel: 'Developing',
      masteryCriterion: 'Atingir >= 70% nas atividades de recuperação',
      nextReviewDate: '2026-12-03',
      progressPercent: idx % 4 === 0 ? 75 : 35,
      updatedAt: ts,
      modules: [
        { order: 1, title: 'Revisão da Prova Anterior', shortLesson: `Correção comentada dos erros em ${comp.name}.`, exerciseFocus: '3 questões diagnósticas', status: 'COMPLETED', masteryScore: 80 },
        { order: 2, title: 'Base Conceitual Guiada', shortLesson: `Passo a passo para dominar ${sub.name}.`, exerciseFocus: '3 exercícios resolvidos', status: idx % 4 === 0 ? 'COMPLETED' : 'IN_PROGRESS', masteryScore: idx % 4 === 0 ? 78 : undefined },
        { order: 3, title: 'Simulado de Recuperação (ENEM)', shortLesson: 'Questões práticas focadas nos pontos críticos.', exerciseFocus: '3 questões comentadas', status: idx % 4 === 0 ? 'IN_PROGRESS' : 'UPCOMING' },
        { order: 4, title: 'Validação de Média', shortLesson: 'Reavaliação final da competência.', exerciseFocus: 'Quiz rápido de fechamento', status: 'UPCOMING' },
      ],
    });

    interventions.push({
      id: intId,
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      studentOwnerUid: stu.studentOwnerUid,
      studentId: stu.id,
      subjectId: sub.id,
      competencyId: comp.id,
      sourceEventId: evtId,
      evidence: `Média crítica em ${sub.name} com risco de reprovação identificado pela IA.`,
      strategy: 'Revisão Automática de Prova + Lista de Recuperação',
      priority: stu.averageScore < 60 ? 'HIGH' : 'MEDIUM',
      status: idx % 4 === 0 ? 'COMPLETED' : 'ASSIGNED',
      contentSummary: `Plano de recuperação criado pela IA para ${stu.displayName} em ${sub.name} (${comp.name}).`,
      activityIds: [actId],
      outcomeSummary: idx % 4 === 0 ? 'Recuperação concluída com avanço de +16 pts.' : undefined,
      createdAt: ts,
      updatedAt: ts,
    });

    learningEvents.push({
      id: evtId,
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      studentOwnerUid: stu.studentOwnerUid,
      eventType: 'AssessmentSubmitted',
      studentId: stu.id,
      subjectId: sub.id,
      competencyId: comp.id,
      referenceId: actId,
      idempotencyKey: `idem_demo_${evtId}`,
      status: 'PROCESSED',
      createdAt: ts,
      processedAt: ts,
    });

    aiInsights.push({
      id: `ins_demo_${idx + 1}`,
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      studentOwnerUid: stu.studentOwnerUid,
      eventId: evtId,
      studentId: stu.id,
      pseudonymId: stu.pseudonymId,
      subjectId: sub.id,
      competencyId: comp.id,
      evidence: `Nota crítica em ${sub.name} (${comp.name}) na ${stu.gradeLevel}.`,
      pedagogicalDiagnosis: `Risco de reprovação detectado automaticamente em ${sub.name}; revisão de prova e lista de recuperação aplicadas.`,
      priority: stu.averageScore < 60 ? 'HIGH' : 'MEDIUM',
      strategyChosen: `Revisão Automática de Prova (${sub.name})`,
      learningObjective: `Recuperar média em ${sub.name} para >= 60%.`,
      confidence: 0.89,
      engineSource: 'DEMO_RULES',
      observedOutcome:
        idx % 4 === 0
          ? 'Lista de recuperação concluída pelo estudante.'
          : 'Revisão de prova e lista de recuperação geradas sem ação manual.',
      generatedActivityId: actId,
      interventionId: intId,
      createdAt: ts,
    });

    auditLogs.push({
      id: `aud_demo_${idx + 1}`,
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      actorUid: 'autonomous_learning_engine',
      actorType: 'AI_ENGINE',
      action: 'REVISAO_PROVA_AUTONOMA',
      targetCollection: 'interventions',
      targetId: intId,
      summary: `Revisão de prova e alerta de risco gerados para ${stu.pseudonymId} em ${sub.code}.`,
      createdAt: ts,
    });
  });

  return {
    institution,
    classes,
    students,
    subjects,
    competencies,
    assessments,
    assessmentResults,
    activities,
    learningPaths,
    interventions,
    learningEvents,
    aiInsights,
    auditLogs,
    consentRecords,
  };
}
