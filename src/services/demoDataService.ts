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

const DEMO_INSTITUTION_ID = 'demo_horizon_academy';
const DEMO_STAFF_UID = 'demo_teacher_uid';

const FIRST_NAMES = [
  'Lucas', 'Sophia', 'Mateus', 'Elena', 'Gabriel', 'Isabella', 'Noah', 'Maya',
  'Rafael', 'Clara', 'Enzo', 'Valentina', 'Samuel', 'Alice', 'Daniel', 'Laura',
  'Benjamin', 'Helena', 'Arthur', 'Beatriz', 'Henrique', 'Olívia', 'Pedro', 'Júlia',
  'Caio', 'Camila', 'Miguel', 'Lívia', 'Theo', 'Ana',
];

const LAST_INITIALS = ['M.', 'S.', 'R.', 'C.', 'L.', 'F.', 'T.', 'A.', 'B.', 'P.', 'G.', 'N.'];

function deterministicScore(seed: number, min: number, max: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  const frac = x - Math.floor(x);
  return Math.round(min + frac * (max - min));
}

function statusFromScore(score: number): PedagogicalStatus {
  if (score >= 87) return 'Mastering';
  if (score >= 73) return 'Progressing';
  if (score >= 60) return 'Additional Practice Recommended';
  return 'Needs Reinforcement';
}

export function createDeterministicDemoDataset(): WorkspaceDataset {
  const baseDate = '2026-11-18T09:00:00.000Z';

  const institution: Institution = {
    id: DEMO_INSTITUTION_ID,
    name: 'Instituto Horizonte de Ensino (DADOS DEMO)',
    joinCode: 'DEMO-HORIZON',
    ownerUid: DEMO_STAFF_UID,
    staffUids: [DEMO_STAFF_UID],
    retentionDays: 365,
    createdAt: baseDate,
  };

  const subjects: Subject[] = [
    { id: 'sub_math', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: 'Matemática', code: 'MAT', createdAt: baseDate },
    { id: 'sub_phys', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: 'Ciências Físicas', code: 'FIS', createdAt: baseDate },
    { id: 'sub_lang', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: 'Língua Portuguesa', code: 'PORT', createdAt: baseDate },
    { id: 'sub_bio', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: 'Biologia e Vida', code: 'BIO', createdAt: baseDate },
    { id: 'sub_comp', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: 'Lógica Computacional', code: 'COMP', createdAt: baseDate },
  ];

  const competencies: Competency[] = [
    {
      id: 'comp_math_eq1',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_math',
      code: 'MAT-EQ1',
      name: 'Equações de Primeiro Grau',
      description: 'Resolução de equações lineares com uma incógnita usando operações inversas e distributiva.',
      gradeLevel: '8º Ano',
      createdAt: baseDate,
    },
    {
      id: 'comp_math_frac',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_math',
      code: 'MAT-FR2',
      name: 'Frações e Raciocínio Proporcional',
      description: 'Operações com frações racionais, razões equivalentes e proporcionalidade direta.',
      gradeLevel: '7º Ano',
      createdAt: baseDate,
    },
    {
      id: 'comp_phys_kin',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_phys',
      code: 'FIS-CIN1',
      name: 'Movimento Uniforme e Gráficos',
      description: 'Interpretação de gráficos de posição por tempo e cálculo de velocidade média.',
      gradeLevel: '9º Ano',
      createdAt: baseDate,
    },
    {
      id: 'comp_phys_energy',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_phys',
      code: 'FIS-EN2',
      name: 'Conservação de Energia Mecânica',
      description: 'Análise de transformações entre energia cinética e energia potencial gravitacional.',
      gradeLevel: '9º Ano',
      createdAt: baseDate,
    },
    {
      id: 'comp_lang_arg',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_lang',
      code: 'PORT-ARG1',
      name: 'Argumentação Baseada em Evidências',
      description: 'Avaliação de argumentos textuais e estruturação coerente de teses.',
      gradeLevel: '8º Ano',
      createdAt: baseDate,
    },
    {
      id: 'comp_lang_syn',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_lang',
      code: 'PORT-SIN2',
      name: 'Síntese Entre Múltiplos Textos',
      description: 'Comparação e síntese de informações em textos argumentativos e informativos.',
      gradeLevel: '9º Ano',
      createdAt: baseDate,
    },
    {
      id: 'comp_bio_cell',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_bio',
      code: 'BIO-CEL1',
      name: 'Respiração Celular e Transporte',
      description: 'Compreensão do transporte de membrana e produção celular de ATP.',
      gradeLevel: '8º Ano',
      createdAt: baseDate,
    },
    {
      id: 'comp_bio_eco',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_bio',
      code: 'BIO-ECO2',
      name: 'Dinâmica Trófica de Ecossistemas',
      description: 'Modelagem do fluxo de energia e equilíbrio populacional em cadeias tróficas.',
      gradeLevel: '7º Ano',
      createdAt: baseDate,
    },
    {
      id: 'comp_comp_alg',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_comp',
      code: 'COMP-ALG1',
      name: 'Decomposição Algorítmica e Laços',
      description: 'Construção de raciocínio lógico iterativo e verificação passo a passo.',
      gradeLevel: '8º Ano',
      createdAt: baseDate,
    },
    {
      id: 'comp_comp_data',
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      subjectId: 'sub_comp',
      code: 'COMP-DAD2',
      name: 'Modelagem Estruturada de Dados',
      description: 'Representação organizada de entidades e relacionamentos escolares.',
      gradeLevel: '9º Ano',
      createdAt: baseDate,
    },
  ];

  const classes: SchoolClass[] = [
    { id: 'cls_7a', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: '7º A — Turma Investigativa', gradeLevel: '7º Ano', academicYear: '2026', teacherUid: DEMO_STAFF_UID, teacherName: 'Profª. Helena Costa', createdAt: baseDate },
    { id: 'cls_8a', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: '8º A — Fundamentos STEM', gradeLevel: '8º Ano', academicYear: '2026', teacherUid: DEMO_STAFF_UID, teacherName: 'Prof. Marcus Silva', createdAt: baseDate },
    { id: 'cls_8b', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: '8º B — Análise Aplicada', gradeLevel: '8º Ano', academicYear: '2026', teacherUid: DEMO_STAFF_UID, teacherName: 'Profª. Clara Mendes', createdAt: baseDate },
    { id: 'cls_9a', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: '9º A — Aprofundamento Exatas', gradeLevel: '9º Ano', academicYear: '2026', teacherUid: DEMO_STAFF_UID, teacherName: 'Prof. Rafael Duarte', createdAt: baseDate },
    { id: 'cls_9b', institutionId: DEMO_INSTITUTION_ID, staffUids: [DEMO_STAFF_UID], name: '9º B — Ciências Integradas', gradeLevel: '9º Ano', academicYear: '2026', teacherUid: DEMO_STAFF_UID, teacherName: 'Profª. Beatriz Alves', createdAt: baseDate },
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
    const cls = classes[idx];
    assessments.push({
      id: `asmt_demo_${idx + 1}`,
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      classId: cls.id,
      subjectId: sub.id,
      competencyId: comp.id,
      title: `Avaliação Diagnóstica de ${sub.name} — ${comp.name}`,
      type: 'Diagnostic Assessment',
      difficulty: 'Intermediate',
      isHighImpact: false,
      createdByUid: DEMO_STAFF_UID,
      createdAt: baseDate,
      questions: [
        {
          id: `aq_${idx}_1`,
          prompt: `Qual princípio orienta a resolução de problemas em ${comp.name}?`,
          questionType: 'multiple_choice',
          options: [
            'Verificação sistemática passo a passo respeitando as regras da competência',
            'Pular etapas intermediárias sem conferir as restrições',
            'Ignorar unidades de medida e condições iniciais',
            'Estimar valores sem validar a igualdade',
          ],
          correctAnswer: 'Verificação sistemática passo a passo respeitando as regras da competência',
          explanation: `Conferir cada passo em ${comp.code} garante precisão conceitual.`,
        },
        {
          id: `aq_${idx}_2`,
          prompt: `Verdadeiro ou Falso: Revisar pré-requisitos acelera o domínio em ${comp.name}.`,
          questionType: 'true_false',
          options: ['Verdadeiro', 'Falso'],
          correctAnswer: 'Verdadeiro',
          explanation: 'O reforço de pré-requisitos fortalece a aprendizagem em tarefas complexas.',
        },
      ],
    });
  });

  for (let i = 0; i < 60; i++) {
    const classIdx = Math.floor(i / 12);
    const cls = classes[classIdx];
    const num = String(i + 1).padStart(3, '0');
    const studentId = `stu_demo_${num}`;
    const pseudonymId = `STU-D${num}`;
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastInit = LAST_INITIALS[(i * 3 + classIdx) % LAST_INITIALS.length];
    const displayName = `${firstName} ${lastInit} (DEMO)`;

    const basePerf = deterministicScore(i + 11, 52, 95);
    const recentTrend = deterministicScore(i + 47, -4, 9);
    const avgScore = Math.min(98, Math.max(48, basePerf + Math.round(recentTrend / 2)));
    const completionRate = Math.min(100, Math.max(58, deterministicScore(i + 91, 64, 99)));
    const pedStatus = statusFromScore(avgScore);

    students.push({
      id: studentId,
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      studentOwnerUid: i === 0 ? 'demo_student_active' : '',
      classId: cls.id,
      pseudonymId,
      displayName,
      gradeLevel: cls.gradeLevel,
      pedagogicalStatus: pedStatus,
      averageScore: avgScore,
      completionRate,
      subjectIds: subjectIdsAll,
      createdAt: baseDate,
      updatedAt: '2026-11-25T16:30:00.000Z',
    });

    for (let w = 0; w < 3; w++) {
      const compIdx = (i + w * 2) % competencies.length;
      const comp = competencies[compIdx];
      const asmt = assessments[Math.floor(compIdx / 2)];
      const pct = Math.min(100, Math.max(42, avgScore + (w - 1) * 4 + deterministicScore(i * 7 + w, -6, 6)));
      const day = 8 + w * 7;
      assessmentResults.push({
        id: `res_demo_${num}_${w + 1}`,
        institutionId: DEMO_INSTITUTION_ID,
        staffUids: [DEMO_STAFF_UID],
        studentOwnerUid: i === 0 ? 'demo_student_active' : '',
        assessmentId: asmt.id,
        studentId,
        subjectId: comp.subjectId,
        competencyId: comp.id,
        score: pct,
        maxScore: 100,
        percentage: pct,
        teacherReviewed: w < 2,
        aiPreliminaryFeedback:
          pct < 72
            ? `Prática guiada recomendada na competência ${comp.name}.`
            : `Bom raciocínio demonstrado em ${comp.code}.`,
        submittedAt: `2026-11-${String(day).padStart(2, '0')}T14:20:00.000Z`,
      });
    }

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
  }

  const spotlightStudents = students.filter((s, idx) => s.averageScore < 74 || idx < 8).slice(0, 14);

  spotlightStudents.forEach((stu, idx) => {
    const comp = competencies[idx % competencies.length];
    const sub = subjects.find((s) => s.id === comp.subjectId)!;
    const isNeedingSupport = stu.averageScore < 74;
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
      title: isNeedingSupport
        ? `Reforço Guiado: ${comp.name} (DEMO)`
        : `Consolidação de Domínio: ${comp.name} (DEMO)`,
      type: isNeedingSupport ? 'Practice Exercises' : 'Revision Quiz',
      difficulty: isNeedingSupport ? 'Foundational' : 'Intermediate',
      origin: 'AI_AUTONOMOUS',
      status: idx % 3 === 0 ? 'COMPLETED' : 'ASSIGNED',
      scorePercentage: idx % 3 === 0 ? Math.min(94, stu.averageScore + 11) : undefined,
      feedbackSummary:
        idx % 3 === 0
          ? `Concluída com evolução de +11 pts em ${comp.code}. O motor autônomo avançou o próximo módulo.`
          : undefined,
      questions: [
        {
          id: `dq_${idx}_1`,
          prompt: `Em ${sub.name} (${comp.name}), qual estratégia evita erros de procedimento?`,
          questionType: 'multiple_choice',
          options: [
            'Aplicar as operações passo a passo e conferir valores intermediários',
            'Pular a verificação das condições iniciais antes de substituir',
            'Estimar o resultado sem registrar etapas intermediárias',
            'Aplicar a operação inversa apenas em um dos lados',
          ],
          correctAnswer: 'Aplicar as operações passo a passo e conferir valores intermediários',
          explanation: `Manter o equilíbrio das etapas e conferir os passos reduz falhas recorrentes em ${comp.code}.`,
        },
        {
          id: `dq_${idx}_2`,
          prompt: `Verdadeiro ou Falso: Conferir o resultado final no enunciado original confirma a precisão em ${comp.code}.`,
          questionType: 'true_false',
          options: ['Verdadeiro', 'Falso'],
          correctAnswer: 'Verdadeiro',
          explanation: 'A substituição de prova real identifica rapidamente trocas de sinal ou razão.',
        },
        {
          id: `dq_${idx}_3`,
          prompt: `Explique em 1 ou 2 frases como você verifica sua solução em ${comp.name}.`,
          questionType: 'short_answer',
          correctAnswer: 'Substituir o resultado encontrado na expressão original para verificar a igualdade ou coerência.',
          explanation: 'A conferência por substituição valida o raciocínio conceitual.',
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
      title: `Trilha Adaptativa: ${comp.name} (DEMO)`,
      educationalObjective: `Construir domínio sólido em ${comp.name} por meio de microaulas sequenciais e prática guiada.`,
      estimatedLevel: stu.averageScore >= 85 ? 'Mastering' : stu.averageScore >= 72 ? 'Proficient' : 'Developing',
      masteryCriterion: 'Atingir >= 80% em duas verificações formativas consecutivas',
      nextReviewDate: '2026-12-03',
      progressPercent: idx % 3 === 0 ? 75 : isNeedingSupport ? 40 : 60,
      updatedAt: ts,
      modules: [
        { order: 1, title: 'Fundamentos e Conceitos-Chave', shortLesson: `Regras essenciais de ${comp.name}.`, exerciseFocus: '3 verificações iniciais', status: 'COMPLETED', masteryScore: 88 },
        { order: 2, title: 'Operações Inversas e Estruturais', shortLesson: 'Transformações passo a passo sem atalhos.', exerciseFocus: '3 exercícios guiados', status: idx % 3 === 0 ? 'COMPLETED' : 'IN_PROGRESS', masteryScore: idx % 3 === 0 ? 84 : undefined },
        { order: 3, title: 'Aplicação em Múltiplas Etapas', shortLesson: 'Resolução de problemas contextualizados.', exerciseFocus: '2 tarefas intermediárias', status: idx % 3 === 0 ? 'IN_PROGRESS' : 'UPCOMING' },
        { order: 4, title: 'Consolidação e Verificação de Domínio', shortLesson: 'Revisão sintética para consolidação.', exerciseFocus: 'Quiz curto de revisão', status: 'UPCOMING' },
      ],
    });

    if (isNeedingSupport || idx < 6) {
      interventions.push({
        id: intId,
        institutionId: DEMO_INSTITUTION_ID,
        staffUids: [DEMO_STAFF_UID],
        studentOwnerUid: stu.studentOwnerUid,
        studentId: stu.id,
        subjectId: sub.id,
        competencyId: comp.id,
        sourceEventId: evtId,
        evidence: `Média recente de ${stu.averageScore}% em 3 observações de ${comp.code} indicou oportunidade de reforço.`,
        strategy: 'Microaula de Revisão + 3 Exercícios Guiados + Quiz de Consolidação',
        priority: stu.averageScore < 62 ? 'HIGH' : 'MEDIUM',
        status: idx % 3 === 0 ? 'COMPLETED' : idx % 2 === 0 ? 'IN_PROGRESS' : 'ASSIGNED',
        contentSummary: `Sequência autônoma de reforço focada nos pré-requisitos de ${comp.name} e conferência de etapas.`,
        activityIds: [actId],
        outcomeSummary: idx % 3 === 0 ? 'Estudante evoluiu +11 pts na prática seguinte; avançou para o Módulo 3.' : undefined,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    learningEvents.push({
      id: evtId,
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      studentOwnerUid: stu.studentOwnerUid,
      eventType: idx % 2 === 0 ? 'AssessmentSubmitted' : 'ActivityCompleted',
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
      evidence: `3 observações longitudinais em ${comp.code} com média de ${stu.averageScore}% (${stu.completionRate}% de conclusão).`,
      pedagogicalDiagnosis: isNeedingSupport
        ? `Lacuna detectada na consistência procedimental em ${comp.name}; reforço básico atribuído.`
        : `Progresso consistente observado em ${comp.name}; consolidação adaptativa agendada.`,
      priority: stu.averageScore < 62 ? 'HIGH' : stu.averageScore < 74 ? 'MEDIUM' : 'LOW',
      strategyChosen: isNeedingSupport ? 'Microaula Guiada e Prática Estruturada' : 'Revisão Espaçada de Consolidação',
      learningObjective: `Atingir >=80% de precisão em exercícios de ${comp.name}.`,
      confidence: 0.84,
      engineSource: 'DEMO_RULES',
      observedOutcome:
        idx % 3 === 0
          ? 'Reforço concluído (+11 pts); trilha de aprendizagem atualizada.'
          : 'Atividade personalizada atribuída; aguardando realização pelo estudante.',
      generatedActivityId: actId,
      interventionId: isNeedingSupport || idx < 6 ? intId : undefined,
      createdAt: ts,
    });

    auditLogs.push({
      id: `aud_demo_${idx + 1}`,
      institutionId: DEMO_INSTITUTION_ID,
      staffUids: [DEMO_STAFF_UID],
      actorUid: 'autonomous_learning_engine',
      actorType: 'AI_ENGINE',
      action: isNeedingSupport ? 'INTERVENCAO_E_ATIVIDADE_ATRIBUIDAS' : 'TRILHA_ADAPTADA',
      targetCollection: 'interventions',
      targetId: intId,
      summary: `Evento ${evtId} de ${stu.pseudonymId} (${comp.code}) processado via DEMO_RULES; zero PII transmitida.`,
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
