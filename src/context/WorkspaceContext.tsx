import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import {
  AIInsight,
  AppMode,
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
  SchoolClass,
  Student,
  Subject,
  SubmittedAnswer,
  UserProfile,
  UserRole,
} from '../types/domain';
import { createDeterministicDemoDataset, WorkspaceDataset } from '../services/demoDataService';
import {
  createActivityInFirestore,
  createAssessmentInFirestore,
  createClassInFirestore,
  createInstitutionWorkspace,
  createSubjectInFirestore,
  deleteStudentInFirestore,
  getInstitution,
  getUserProfile,
  joinInstitutionByCode,
  persistAutonomousCycleOutputs,
  saveActivitySubmissionInFirestore,
  subscribeInstitutionWorkspace,
  updateAssessmentReviewInFirestore,
  updateConsentRecordInFirestore,
  updateInterventionStatusInFirestore,
  updateStudentInFirestore,
  upsertStudentInFirestore,
} from '../services/firestoreRepository';
import {
  evaluateOpenResponse,
  fetchEngineHealth,
  triggerAutonomousEngine,
} from '../services/aiApiService';

interface EngineRunSummary {
  id: string;
  pseudonymId: string;
  subjectName: string;
  competencyCode: string;
  engineSource: 'GEMINI' | 'DEMO_RULES' | 'RULE_ENGINE_FALLBACK';
  strategy: string;
  nextAction: string;
  timestamp: string;
}

interface WorkspaceContextValue {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  firebaseUser: User | null;
  authReady: boolean;
  userProfile: UserProfile | null;
  effectiveRole: UserRole;
  setDemoRole: (r: UserRole) => void;
  activeStudentId: string | null;
  setActiveStudentId: (id: string | null) => void;
  geminiConfigured: boolean;
  dataset: WorkspaceDataset;
  needsOnboarding: boolean;
  loadingLive: boolean;
  engineProcessing: boolean;
  lastEngineRun: EngineRunSummary | null;
  bannerNotice: { type: 'info' | 'success' | 'error'; message: string } | null;
  clearBanner: () => void;

  // Auth & Workspace setup
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  createWorkspace: (institutionName: string, role: 'ADMIN' | 'TEACHER') => Promise<void>;
  joinWorkspaceByCode: (joinCode: string) => Promise<void>;

  // Core Autonomous Engine Actions
  runAutonomousLearningDemo: (targetStudentId?: string) => Promise<void>;
  submitActivityAttempt: (
    activityId: string,
    answersByQuestionId: Record<string, string>
  ) => Promise<{ scorePercentage: number; feedback: string }>;

  // CRUD Actions (Demo + Live Firestore)
  addClass: (input: { name: string; gradeLevel: string; academicYear: string; teacherName: string }) => Promise<void>;
  addSubjectWithCompetency: (input: {
    subjectName: string;
    subjectCode: string;
    competencyCode: string;
    competencyName: string;
    description: string;
    gradeLevel: string;
  }) => Promise<void>;
  saveStudent: (input: {
    id?: string;
    displayName: string;
    classId: string;
    gradeLevel: string;
    subjectIds: string[];
    studentOwnerUid?: string;
  }) => Promise<void>;
  removeStudent: (studentId: string) => Promise<void>;
  createAssessment: (input: {
    title: string;
    classId: string;
    subjectId: string;
    competencyId: string;
    type: Assessment['type'];
    difficulty: Assessment['difficulty'];
    isHighImpact: boolean;
    questions: Assessment['questions'];
  }) => Promise<void>;
  createAssignedActivity: (input: {
    studentId: string;
    subjectId: string;
    competencyId: string;
    title: string;
    type: LearningActivity['type'];
    difficulty: LearningActivity['difficulty'];
    origin: LearningActivity['origin'];
    questions: LearningActivity['questions'];
  }) => Promise<void>;
  updateInterventionStatus: (
    interventionId: string,
    status: Intervention['status'],
    outcomeSummary?: string
  ) => Promise<void>;
  markAssessmentReviewed: (resultId: string, reviewed: boolean) => Promise<void>;
  updateConsent: (
    consentId: string,
    updates: Partial<Pick<ConsentRecord, 'guardianConsentStatus' | 'dataMinimizationAccepted' | 'retentionPolicyDays'>>
  ) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<AppMode>('DEMO');
  const [demoDataset, setDemoDataset] = useState<WorkspaceDataset>(() => createDeterministicDemoDataset());
  const [demoRole, setDemoRole] = useState<UserRole>('TEACHER');
  const [activeStudentId, setActiveStudentId] = useState<string | null>('stu_demo_001');

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [liveInstitution, setLiveInstitution] = useState<Institution | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loadingLive, setLoadingLive] = useState(false);

  const [liveClasses, setLiveClasses] = useState<SchoolClass[]>([]);
  const [liveStudents, setLiveStudents] = useState<Student[]>([]);
  const [liveSubjects, setLiveSubjects] = useState<Subject[]>([]);
  const [liveCompetencies, setLiveCompetencies] = useState<Competency[]>([]);
  const [liveAssessments, setLiveAssessments] = useState<Assessment[]>([]);
  const [liveResults, setLiveResults] = useState<AssessmentResult[]>([]);
  const [liveActivities, setLiveActivities] = useState<LearningActivity[]>([]);
  const [livePaths, setLivePaths] = useState<LearningPath[]>([]);
  const [liveInterventions, setLiveInterventions] = useState<Intervention[]>([]);
  const [liveEvents, setLiveEvents] = useState<LearningEvent[]>([]);
  const [liveInsights, setLiveInsights] = useState<AIInsight[]>([]);
  const [liveAuditLogs, setLiveAuditLogs] = useState<AuditLog[]>([]);
  const [liveConsentRecords, setLiveConsentRecords] = useState<ConsentRecord[]>([]);

  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [engineProcessing, setEngineProcessing] = useState(false);
  const [lastEngineRun, setLastEngineRun] = useState<EngineRunSummary | null>(null);
  const [bannerNotice, setBannerNotice] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

  const clearBanner = useCallback(() => setBannerNotice(null), []);

  useEffect(() => {
    fetchEngineHealth()
      .then((h) => setGeminiConfigured(h.geminiConfigured))
      .catch(() => setGeminiConfigured(false));
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setUserProfile(null);
        setLiveInstitution(null);
        setNeedsOnboarding(false);
        return;
      }

      try {
        setLoadingLive(true);
        const profile = await getUserProfile(user.uid);
        if (!profile) {
          setUserProfile(null);
          setNeedsOnboarding(true);
        } else {
          setUserProfile(profile);
          setNeedsOnboarding(false);
          if (profile.role !== 'STUDENT') {
            const inst = await getInstitution(profile.institutionId);
            setLiveInstitution(inst);
          } else {
            setLiveInstitution({
              id: profile.institutionId,
              name: 'Portal do Estudante da Instituição',
              joinCode: 'STUDENT',
              ownerUid: '',
              staffUids: [],
              retentionDays: 365,
              createdAt: profile.createdAt,
            });
          }
          setModeState('LIVE');
        }
      } catch (err) {
        setBannerNotice({
          type: 'error',
          message: err instanceof Error ? err.message : 'Não foi possível carregar o perfil da instituição.',
        });
      } finally {
        setLoadingLive(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (mode !== 'LIVE' || !firebaseUser || !userProfile) {
      return;
    }

    const unsub = subscribeInstitutionWorkspace(
      userProfile.institutionId,
      firebaseUser.uid,
      userProfile.role,
      {
        onClasses: setLiveClasses,
        onStudents: setLiveStudents,
        onSubjects: setLiveSubjects,
        onCompetencies: setLiveCompetencies,
        onAssessments: setLiveAssessments,
        onAssessmentResults: setLiveResults,
        onActivities: setLiveActivities,
        onLearningPaths: setLivePaths,
        onInterventions: setLiveInterventions,
        onLearningEvents: setLiveEvents,
        onAIInsights: setLiveInsights,
        onAuditLogs: setLiveAuditLogs,
        onConsentRecords: setLiveConsentRecords,
        onError: (err) => {
          setBannerNotice({ type: 'error', message: err.message });
        },
      }
    );
    return () => unsub();
  }, [mode, firebaseUser, userProfile]);

  const setMode = useCallback(
    (nextMode: AppMode) => {
      if (nextMode === 'LIVE' && !firebaseUser) {
        setBannerNotice({
          type: 'info',
          message: 'Entre com sua conta Google para conectar seu ambiente institucional ao Cloud Firestore.',
        });
        return;
      }
      setModeState(nextMode);
    },
    [firebaseUser]
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const profile = await getUserProfile(cred.user.uid);
      if (!profile) {
        setNeedsOnboarding(true);
        setModeState('LIVE');
      } else {
        setUserProfile(profile);
        setNeedsOnboarding(false);
        setModeState('LIVE');
      }
    } catch (err) {
      setBannerNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'O login com Google foi cancelado ou falhou.',
      });
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUserProfile(null);
    setLiveInstitution(null);
    setNeedsOnboarding(false);
    setModeState('DEMO');
  }, []);

  const createWorkspace = useCallback(
    async (institutionName: string, role: 'ADMIN' | 'TEACHER') => {
      if (!firebaseUser) return;
      setLoadingLive(true);
      try {
        const { institution, profile } = await createInstitutionWorkspace({
          uid: firebaseUser.uid,
          email: firebaseUser.email || 'educador@instituicao.edu',
          displayName: firebaseUser.displayName || 'Educador da Instituição',
          institutionName,
          role,
        });
        setLiveInstitution(institution);
        setUserProfile(profile);
        setNeedsOnboarding(false);
        setModeState('LIVE');
        setBannerNotice({
          type: 'success',
          message: `Instituição "${institution.name}" provisionada no Cloud Firestore. Código de acesso: ${institution.joinCode}`,
        });
      } catch (err) {
        setBannerNotice({
          type: 'error',
          message: err instanceof Error ? err.message : 'Falha ao criar o ambiente da instituição.',
        });
      } finally {
        setLoadingLive(false);
      }
    },
    [firebaseUser]
  );

  const joinWorkspaceByCode = useCallback(
    async (joinCode: string) => {
      if (!firebaseUser) return;
      setLoadingLive(true);
      try {
        const profile = await joinInstitutionByCode({
          uid: firebaseUser.uid,
          email: firebaseUser.email || 'estudante@instituicao.edu',
          displayName: firebaseUser.displayName || 'Estudante',
          joinCode,
        });
        setUserProfile(profile);
        setNeedsOnboarding(false);
        setModeState('LIVE');
        setBannerNotice({
          type: 'success',
          message: 'Você ingressou na instituição com perfil de Estudante.',
        });
      } catch (err) {
        setBannerNotice({
          type: 'error',
          message: err instanceof Error ? err.message : 'Não foi possível ingressar na instituição.',
        });
      } finally {
        setLoadingLive(false);
      }
    },
    [firebaseUser]
  );

  const liveDataset: WorkspaceDataset = useMemo(
    () => ({
      institution: liveInstitution || {
        id: 'live_pending',
        name: 'Live Institution Workspace',
        joinCode: 'PENDING',
        ownerUid: firebaseUser?.uid || '',
        staffUids: firebaseUser ? [firebaseUser.uid] : [],
        retentionDays: 365,
        createdAt: new Date().toISOString(),
      },
      classes: liveClasses,
      students: liveStudents,
      subjects: liveSubjects,
      competencies: liveCompetencies,
      assessments: liveAssessments,
      assessmentResults: liveResults,
      activities: liveActivities,
      learningPaths: livePaths,
      interventions: liveInterventions,
      learningEvents: liveEvents,
      aiInsights: liveInsights,
      auditLogs: liveAuditLogs,
      consentRecords: liveConsentRecords,
    }),
    [
      liveInstitution,
      firebaseUser,
      liveClasses,
      liveStudents,
      liveSubjects,
      liveCompetencies,
      liveAssessments,
      liveResults,
      liveActivities,
      livePaths,
      liveInterventions,
      liveEvents,
      liveInsights,
      liveAuditLogs,
      liveConsentRecords,
    ]
  );

  const dataset = mode === 'DEMO' ? demoDataset : liveDataset;
  const effectiveRole: UserRole = mode === 'DEMO' ? demoRole : userProfile?.role || 'TEACHER';

  const getStaffUids = useCallback((): string[] => {
    if (mode === 'DEMO') return demoDataset.institution.staffUids;
    if (liveInstitution?.staffUids?.length) return liveInstitution.staffUids;
    return firebaseUser ? [firebaseUser.uid] : [];
  }, [mode, demoDataset, liveInstitution, firebaseUser]);

  /**
   * Core Event-Driven Autonomous Learning Cycle execution (both Demo & Live)
   */
  const executeAutonomousCycle = useCallback(
    async (params: {
      student: Student;
      subject: Subject;
      competency: Competency;
      eventType: LearningEvent['eventType'];
      referenceId: string;
      latestScore: number;
      recentScores: number[];
      missedTopics?: string[];
    }) => {
      const now = new Date().toISOString();
      const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const eventId = `evt_${suffix}`;
      const idempotencyKey = `idem_${params.referenceId}_${params.eventType}_${Math.round(params.latestScore)}`;

      const completedCount = dataset.activities.filter(
        (a) => a.studentId === params.student.id && a.status === 'COMPLETED'
      ).length;

      const engineRes = await triggerAutonomousEngine({
        eventId,
        idempotencyKey,
        eventType: params.eventType,
        institutionId: dataset.institution.id,
        pseudonymId: params.student.pseudonymId,
        gradeLevel: params.student.gradeLevel,
        subjectName: params.subject.name,
        competencyCode: params.competency.code,
        competencyName: params.competency.name,
        recentScores: params.recentScores,
        latestScore: params.latestScore,
        completedActivitiesCount: completedCount,
        missedTopics: params.missedTopics,
        demoMode: mode === 'DEMO',
      });

      const { analysis } = engineRes;
      const staffUids = getStaffUids();
      const actId = `act_ai_${suffix}`;
      const intId = `int_ai_${suffix}`;
      const insId = `ins_ai_${suffix}`;
      const audId = `aud_ai_${suffix}`;
      const existingPath = dataset.learningPaths.find(
        (p) => p.studentId === params.student.id && p.competencyId === params.competency.id
      );
      const pathId = existingPath ? existingPath.id : `path_ai_${suffix}`;

      const generatedActivity: LearningActivity = {
        id: actId,
        institutionId: dataset.institution.id,
        staffUids,
        studentOwnerUid: params.student.studentOwnerUid,
        studentId: params.student.id,
        classId: params.student.classId,
        subjectId: params.subject.id,
        competencyId: params.competency.id,
        title: mode === 'DEMO' ? `${analysis.generatedActivity.title} (DEMO)` : analysis.generatedActivity.title,
        type: analysis.generatedActivity.type,
        difficulty: analysis.difficultyLevel,
        origin: 'AI_AUTONOMOUS',
        status: 'ASSIGNED',
        questions: analysis.generatedActivity.questions,
        feedbackSummary: analysis.generatedActivity.shortLessonSummary,
        createdAt: now,
        updatedAt: now,
      };

      const completedModules = analysis.learningPathPlan.modules.filter((m) => m.status === 'COMPLETED').length;
      const progressPercent = Math.round(
        (completedModules / Math.max(1, analysis.learningPathPlan.modules.length)) * 100
      );

      const learningPath: LearningPath = {
        id: pathId,
        institutionId: dataset.institution.id,
        staffUids,
        studentOwnerUid: params.student.studentOwnerUid,
        studentId: params.student.id,
        subjectId: params.subject.id,
        competencyId: params.competency.id,
        title: analysis.learningPathPlan.title,
        educationalObjective: analysis.learningObjective,
        estimatedLevel: analysis.learningPathPlan.estimatedLevel,
        masteryCriterion: analysis.learningPathPlan.masteryCriterion,
        nextReviewDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        progressPercent,
        modules: analysis.learningPathPlan.modules,
        updatedAt: now,
      };

      const intervention: Intervention | undefined = analysis.interventionPlan?.needed
        ? {
            id: intId,
            institutionId: dataset.institution.id,
            staffUids,
            studentOwnerUid: params.student.studentOwnerUid,
            studentId: params.student.id,
            subjectId: params.subject.id,
            competencyId: params.competency.id,
            sourceEventId: eventId,
            evidence: analysis.evidence,
            strategy: analysis.interventionPlan.strategy,
            priority: analysis.priority,
            status: 'ASSIGNED',
            contentSummary: analysis.interventionPlan.contentSummary,
            activityIds: [actId],
            createdAt: now,
            updatedAt: now,
          }
        : undefined;

      const learningEvent: LearningEvent = {
        id: eventId,
        institutionId: dataset.institution.id,
        staffUids,
        studentOwnerUid: params.student.studentOwnerUid,
        eventType: params.eventType,
        studentId: params.student.id,
        subjectId: params.subject.id,
        competencyId: params.competency.id,
        referenceId: params.referenceId,
        idempotencyKey,
        status: 'PROCESSED',
        createdAt: now,
        processedAt: engineRes.processedAt,
      };

      const aiInsight: AIInsight = {
        id: insId,
        institutionId: dataset.institution.id,
        staffUids,
        studentOwnerUid: params.student.studentOwnerUid,
        eventId,
        studentId: params.student.id,
        pseudonymId: params.student.pseudonymId,
        subjectId: params.subject.id,
        competencyId: params.competency.id,
        evidence: analysis.evidence,
        pedagogicalDiagnosis: `${analysis.identifiedGap} ${analysis.uncertaintyNote}`,
        priority: analysis.priority,
        strategyChosen: analysis.recommendedStrategy,
        learningObjective: analysis.learningObjective,
        confidence: analysis.confidence,
        engineSource: analysis.engineSource,
        observedOutcome: intervention
          ? `Intervenção (${intervention.id}) e atividade personalizada "${generatedActivity.title}" atribuídas.`
          : `Trilha adaptativa atualizada para nível ${learningPath.estimatedLevel} e atividade de consolidação atribuída.`,
        generatedActivityId: actId,
        interventionId: intervention?.id,
        createdAt: now,
      };

      const auditLog: AuditLog = {
        id: audId,
        institutionId: dataset.institution.id,
        staffUids,
        actorUid: 'autonomous_learning_engine',
        actorType: 'AI_ENGINE',
        action: intervention ? 'INTERVENCAO_AUTONOMA_CRIADA' : 'TRILHA_ADAPTADA_AUTONOMAMENTE',
        targetCollection: intervention ? 'interventions' : 'learningPaths',
        targetId: intervention ? intervention.id : learningPath.id,
        summary: `Evento ${eventId} (${params.eventType}) de ${params.student.pseudonymId} processado via ${analysis.engineSource}; zero PII enviada.`,
        createdAt: now,
      };

      const newAvg = Math.round(
        (params.recentScores.reduce((a, b) => a + b, 0) / params.recentScores.length) * 10
      ) / 10;

      const updatedStudentStats = {
        studentId: params.student.id,
        pedagogicalStatus: analysis.pedagogicalStatusRecommendation,
        averageScore: newAvg,
        completionRate: Math.min(100, params.student.completionRate + 2),
        updatedAt: now,
      };

      if (mode === 'LIVE') {
        await persistAutonomousCycleOutputs({
          event: learningEvent,
          insight: aiInsight,
          generatedActivity,
          learningPath,
          intervention,
          auditLog,
          studentUpdate: updatedStudentStats,
        });
      } else {
        setDemoDataset((prev) => ({
          ...prev,
          learningEvents: [learningEvent, ...prev.learningEvents],
          aiInsights: [aiInsight, ...prev.aiInsights],
          activities: [generatedActivity, ...prev.activities],
          learningPaths: existingPath
            ? prev.learningPaths.map((p) => (p.id === pathId ? learningPath : p))
            : [learningPath, ...prev.learningPaths],
          interventions: intervention ? [intervention, ...prev.interventions] : prev.interventions,
          auditLogs: [auditLog, ...prev.auditLogs],
          students: prev.students.map((s) =>
            s.id === params.student.id
              ? {
                  ...s,
                  pedagogicalStatus: updatedStudentStats.pedagogicalStatus,
                  averageScore: updatedStudentStats.averageScore,
                  completionRate: updatedStudentStats.completionRate,
                  updatedAt: updatedStudentStats.updatedAt,
                }
              : s
          ),
        }));
      }

      setLastEngineRun({
        id: eventId,
        pseudonymId: params.student.pseudonymId,
        subjectName: params.subject.name,
        competencyCode: params.competency.code,
        engineSource: analysis.engineSource,
        strategy: analysis.recommendedStrategy,
        nextAction: analysis.nextAction,
        timestamp: now,
      });

      return { analysis, generatedActivity, intervention, aiInsight };
    },
    [dataset, mode, getStaffUids]
  );

  const runAutonomousLearningDemo = useCallback(
    async (targetStudentId?: string) => {
      if (dataset.students.length === 0 || dataset.subjects.length === 0 || dataset.competencies.length === 0) {
        setBannerNotice({
          type: 'error',
          message: 'Cadastre pelo menos um estudante, uma disciplina e uma competência antes de executar o ciclo.',
        });
        return;
      }

      setEngineProcessing(true);
      try {
        const student =
          (targetStudentId && dataset.students.find((s) => s.id === targetStudentId)) ||
          dataset.students.find((s) => s.averageScore < 72) ||
          dataset.students[0];

        const competency =
          dataset.competencies.find((c) => c.code === 'MAT-EQ1' || c.code === 'MATH-EQ1') || dataset.competencies[0];
        const subject =
          dataset.subjects.find((s) => s.id === competency.subjectId) || dataset.subjects[0];

        const simulatedResultId = `res_sim_${Date.now().toString(36)}`;
        const simulatedScore = 58;
        const priorScores = dataset.assessmentResults
          .filter((r) => r.studentId === student.id)
          .slice(-3)
          .map((r) => r.percentage);
        const recentScores = [...priorScores, simulatedScore];

        const simulatedResult: AssessmentResult = {
          id: simulatedResultId,
          institutionId: dataset.institution.id,
          staffUids: getStaffUids(),
          studentOwnerUid: student.studentOwnerUid,
          assessmentId: dataset.assessments[0]?.id || 'asmt_demo_1',
          studentId: student.id,
          subjectId: subject.id,
          competencyId: competency.id,
          score: simulatedScore,
          maxScore: 100,
          percentage: simulatedScore,
          teacherReviewed: false,
          aiPreliminaryFeedback: `Evento simulado de atividade (${simulatedScore}%) registrado em ${competency.code}; Motor Autônomo acionado.`,
          submittedAt: new Date().toISOString(),
        };

        if (mode === 'DEMO') {
          setDemoDataset((prev) => ({
            ...prev,
            assessmentResults: [simulatedResult, ...prev.assessmentResults],
          }));
        }

        const out = await executeAutonomousCycle({
          student,
          subject,
          competency,
          eventType: 'ActivityCompleted',
          referenceId: simulatedResultId,
          latestScore: simulatedScore,
          recentScores,
          missedTopics: ['Operações inversas com sinais negativos', 'Equações com parênteses'],
        });

        setBannerNotice({
          type: 'success',
          message: `Ciclo autônomo concluído (${out.analysis.engineSource}): lacuna detectada para ${student.pseudonymId} em ${competency.code}, atividade "${out.generatedActivity.title}" atribuída, intervenção criada e trilha atualizada.`,
        });
      } catch (err) {
        setBannerNotice({
          type: 'error',
          message: err instanceof Error ? err.message : 'Falha na execução do ciclo autônomo.',
        });
      } finally {
        setEngineProcessing(false);
      }
    },
    [dataset, mode, getStaffUids, executeAutonomousCycle]
  );

  const submitActivityAttempt = useCallback(
    async (activityId: string, answersByQuestionId: Record<string, string>) => {
      const activity = dataset.activities.find((a) => a.id === activityId);
      if (!activity) {
        throw new Error('Activity not found.');
      }
      const student = dataset.students.find((s) => s.id === activity.studentId);
      const subject = dataset.subjects.find((s) => s.id === activity.subjectId) || dataset.subjects[0];
      const competency =
        dataset.competencies.find((c) => c.id === activity.competencyId) || dataset.competencies[0];

      setEngineProcessing(true);
      try {
        const submittedAnswers: SubmittedAnswer[] = [];
        let earnedPoints = 0;

        for (const q of activity.questions) {
          const userAns = (answersByQuestionId[q.id] || '').trim();
          if (q.questionType === 'short_answer') {
            const evalRes = await evaluateOpenResponse({
              subjectName: subject?.name || 'Subject',
              competencyName: competency?.name || 'Competency',
              questionPrompt: q.prompt,
              referenceAnswer: q.correctAnswer,
              studentResponse: userAns || 'No response provided',
              demoMode: mode === 'DEMO',
            });
            const isPass = evalRes.preliminaryScore >= 70;
            if (isPass) earnedPoints += 1;
            else earnedPoints += evalRes.preliminaryScore / 100;
            submittedAnswers.push({
              questionId: q.id,
              answer: userAns,
              isCorrect: isPass,
              feedback: `${evalRes.feedback} (AI preliminary feedback — teacher retains final review authority)`,
            });
          } else {
            const isCorrect = userAns.toLowerCase() === q.correctAnswer.trim().toLowerCase();
            if (isCorrect) earnedPoints += 1;
            submittedAnswers.push({
              questionId: q.id,
              answer: userAns,
              isCorrect,
              feedback: q.explanation,
            });
          }
        }

        const scorePercentage = Math.round((earnedPoints / Math.max(1, activity.questions.length)) * 100);
        const feedbackSummary =
          scorePercentage >= 80
            ? `Excelente desempenho (${scorePercentage}%). Sua trilha adaptativa avançou para a próxima etapa.`
            : `Atividade concluída (${scorePercentage}%). O Motor Autônomo de Aprendizagem está preparando reforço direcionado em ${competency?.name || 'esta competência'}.`;
        const now = new Date().toISOString();

        if (mode === 'LIVE') {
          await saveActivitySubmissionInFirestore({
            activityId,
            scorePercentage,
            feedbackSummary,
            submittedAnswers,
            updatedAt: now,
          });
        } else {
          setDemoDataset((prev) => ({
            ...prev,
            activities: prev.activities.map((a) =>
              a.id === activityId
                ? {
                    ...a,
                    status: 'COMPLETED',
                    scorePercentage,
                    feedbackSummary,
                    submittedAnswers,
                    updatedAt: now,
                  }
                : a
            ),
          }));
        }

        if (student && subject && competency) {
          const prior = dataset.assessmentResults
            .filter((r) => r.studentId === student.id && r.competencyId === competency.id)
            .slice(-3)
            .map((r) => r.percentage);
          await executeAutonomousCycle({
            student,
            subject,
            competency,
            eventType: 'ActivityCompleted',
            referenceId: activityId,
            latestScore: scorePercentage,
            recentScores: [...prior, scorePercentage],
            missedTopics: scorePercentage < 75 ? [competency.name] : [],
          });
        }

        return { scorePercentage, feedback: feedbackSummary };
      } finally {
        setEngineProcessing(false);
      }
    },
    [dataset, mode, executeAutonomousCycle]
  );

  const addClass = useCallback(
    async (input: { name: string; gradeLevel: string; academicYear: string; teacherName: string }) => {
      const id = `cls_${Date.now().toString(36)}`;
      const cls: SchoolClass = {
        id,
        institutionId: dataset.institution.id,
        staffUids: getStaffUids(),
        name: input.name.trim().slice(0, 100),
        gradeLevel: input.gradeLevel.trim().slice(0, 40),
        academicYear: input.academicYear.trim().slice(0, 20),
        teacherUid: firebaseUser?.uid || 'demo_teacher_uid',
        teacherName: input.teacherName.trim().slice(0, 120),
        createdAt: new Date().toISOString(),
      };
      if (mode === 'LIVE') {
        await createClassInFirestore(cls);
      } else {
        setDemoDataset((prev) => ({ ...prev, classes: [cls, ...prev.classes] }));
      }
    },
    [dataset.institution.id, getStaffUids, firebaseUser, mode]
  );

  const addSubjectWithCompetency = useCallback(
    async (input: {
      subjectName: string;
      subjectCode: string;
      competencyCode: string;
      competencyName: string;
      description: string;
      gradeLevel: string;
    }) => {
      const now = new Date().toISOString();
      const subId = `sub_${Date.now().toString(36)}`;
      const compId = `comp_${Date.now().toString(36)}`;
      const staffUids = getStaffUids();

      const subject: Subject = {
        id: subId,
        institutionId: dataset.institution.id,
        staffUids,
        name: input.subjectName.trim().slice(0, 100),
        code: input.subjectCode.trim().toUpperCase().slice(0, 24),
        createdAt: now,
      };
      const competency: Competency = {
        id: compId,
        institutionId: dataset.institution.id,
        staffUids,
        subjectId: subId,
        code: input.competencyCode.trim().toUpperCase().slice(0, 32),
        name: input.competencyName.trim().slice(0, 140),
        description: input.description.trim().slice(0, 600),
        gradeLevel: input.gradeLevel.trim().slice(0, 40),
        createdAt: now,
      };

      if (mode === 'LIVE') {
        await createSubjectInFirestore(subject, competency);
      } else {
        setDemoDataset((prev) => ({
          ...prev,
          subjects: [...prev.subjects, subject],
          competencies: [...prev.competencies, competency],
        }));
      }
    },
    [dataset.institution.id, getStaffUids, mode]
  );

  const saveStudent = useCallback(
    async (input: {
      id?: string;
      displayName: string;
      classId: string;
      gradeLevel: string;
      subjectIds: string[];
      studentOwnerUid?: string;
    }) => {
      const now = new Date().toISOString();
      const staffUids = getStaffUids();

      if (input.id) {
        if (mode === 'LIVE') {
          await updateStudentInFirestore(input.id, {
            displayName: input.displayName.trim().slice(0, 120),
            classId: input.classId,
            gradeLevel: input.gradeLevel,
            subjectIds: input.subjectIds,
            studentOwnerUid: input.studentOwnerUid || '',
            updatedAt: now,
          });
        } else {
          setDemoDataset((prev) => ({
            ...prev,
            students: prev.students.map((s) =>
              s.id === input.id
                ? {
                    ...s,
                    displayName: input.displayName.trim().slice(0, 120),
                    classId: input.classId,
                    gradeLevel: input.gradeLevel,
                    subjectIds: input.subjectIds,
                    updatedAt: now,
                  }
                : s
            ),
          }));
        }
        return;
      }

      const id = `stu_${Date.now().toString(36)}`;
      const pseudonymId = `STU-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const newStudent: Student = {
        id,
        institutionId: dataset.institution.id,
        staffUids,
        studentOwnerUid: input.studentOwnerUid || '',
        classId: input.classId,
        pseudonymId,
        displayName: input.displayName.trim().slice(0, 120),
        gradeLevel: input.gradeLevel,
        pedagogicalStatus: 'Progressing',
        averageScore: 76,
        completionRate: 80,
        subjectIds: input.subjectIds,
        createdAt: now,
        updatedAt: now,
      };
      const consent: ConsentRecord = {
        id: `cons_${id}`,
        institutionId: dataset.institution.id,
        staffUids,
        studentId: id,
        guardianConsentStatus: 'PENDING',
        dataMinimizationAccepted: true,
        retentionPolicyDays: dataset.institution.retentionDays || 365,
        updatedByUid: firebaseUser?.uid || 'demo_teacher_uid',
        updatedAt: now,
      };

      if (mode === 'LIVE') {
        await upsertStudentInFirestore(newStudent, consent);
      } else {
        setDemoDataset((prev) => ({
          ...prev,
          students: [newStudent, ...prev.students],
          consentRecords: [consent, ...prev.consentRecords],
        }));
      }
    },
    [dataset.institution, getStaffUids, firebaseUser, mode]
  );

  const removeStudent = useCallback(
    async (studentId: string) => {
      if (mode === 'LIVE') {
        await deleteStudentInFirestore(studentId);
      } else {
        setDemoDataset((prev) => ({
          ...prev,
          students: prev.students.filter((s) => s.id !== studentId),
        }));
      }
    },
    [mode]
  );

  const createAssessment = useCallback(
    async (input: {
      title: string;
      classId: string;
      subjectId: string;
      competencyId: string;
      type: Assessment['type'];
      difficulty: Assessment['difficulty'];
      isHighImpact: boolean;
      questions: Assessment['questions'];
    }) => {
      const id = `asmt_${Date.now().toString(36)}`;
      const assessment: Assessment = {
        id,
        institutionId: dataset.institution.id,
        staffUids: getStaffUids(),
        classId: input.classId,
        subjectId: input.subjectId,
        competencyId: input.competencyId,
        title: input.title.trim().slice(0, 160),
        type: input.type,
        difficulty: input.difficulty,
        isHighImpact: input.isHighImpact,
        questions: input.questions,
        createdByUid: firebaseUser?.uid || 'demo_teacher_uid',
        createdAt: new Date().toISOString(),
      };
      if (mode === 'LIVE') {
        await createAssessmentInFirestore(assessment);
      } else {
        setDemoDataset((prev) => ({ ...prev, assessments: [assessment, ...prev.assessments] }));
      }
    },
    [dataset.institution.id, getStaffUids, firebaseUser, mode]
  );

  const createAssignedActivity = useCallback(
    async (input: {
      studentId: string;
      subjectId: string;
      competencyId: string;
      title: string;
      type: LearningActivity['type'];
      difficulty: LearningActivity['difficulty'];
      origin: LearningActivity['origin'];
      questions: LearningActivity['questions'];
    }) => {
      const stu = dataset.students.find((s) => s.id === input.studentId);
      if (!stu) return;
      const now = new Date().toISOString();
      const activity: LearningActivity = {
        id: `act_${Date.now().toString(36)}`,
        institutionId: dataset.institution.id,
        staffUids: getStaffUids(),
        studentOwnerUid: stu.studentOwnerUid,
        studentId: stu.id,
        classId: stu.classId,
        subjectId: input.subjectId,
        competencyId: input.competencyId,
        title: input.title.trim().slice(0, 180),
        type: input.type,
        difficulty: input.difficulty,
        origin: input.origin,
        status: 'ASSIGNED',
        questions: input.questions,
        createdAt: now,
        updatedAt: now,
      };
      if (mode === 'LIVE') {
        await createActivityInFirestore(activity);
      } else {
        setDemoDataset((prev) => ({ ...prev, activities: [activity, ...prev.activities] }));
      }
    },
    [dataset.students, dataset.institution.id, getStaffUids, mode]
  );

  const updateInterventionStatus = useCallback(
    async (interventionId: string, status: Intervention['status'], outcomeSummary?: string) => {
      if (mode === 'LIVE') {
        await updateInterventionStatusInFirestore(interventionId, status, outcomeSummary);
      } else {
        setDemoDataset((prev) => ({
          ...prev,
          interventions: prev.interventions.map((i) =>
            i.id === interventionId
              ? { ...i, status, outcomeSummary: outcomeSummary ?? i.outcomeSummary, updatedAt: new Date().toISOString() }
              : i
          ),
        }));
      }
    },
    [mode]
  );

  const markAssessmentReviewed = useCallback(
    async (resultId: string, reviewed: boolean) => {
      if (mode === 'LIVE') {
        await updateAssessmentReviewInFirestore(resultId, reviewed);
      } else {
        setDemoDataset((prev) => ({
          ...prev,
          assessmentResults: prev.assessmentResults.map((r) =>
            r.id === resultId ? { ...r, teacherReviewed: reviewed } : r
          ),
        }));
      }
    },
    [mode]
  );

  const updateConsent = useCallback(
    async (
      consentId: string,
      updates: Partial<Pick<ConsentRecord, 'guardianConsentStatus' | 'dataMinimizationAccepted' | 'retentionPolicyDays'>>
    ) => {
      const now = new Date().toISOString();
      if (mode === 'LIVE') {
        await updateConsentRecordInFirestore(consentId, {
          ...updates,
          updatedByUid: firebaseUser?.uid || 'admin',
          updatedAt: now,
        });
      } else {
        setDemoDataset((prev) => ({
          ...prev,
          consentRecords: prev.consentRecords.map((c) =>
            c.id === consentId ? { ...c, ...updates, updatedAt: now } : c
          ),
        }));
      }
    },
    [mode, firebaseUser]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        mode,
        setMode,
        firebaseUser,
        authReady,
        userProfile,
        effectiveRole,
        setDemoRole,
        activeStudentId,
        setActiveStudentId,
        geminiConfigured,
        dataset,
        needsOnboarding,
        loadingLive,
        engineProcessing,
        lastEngineRun,
        bannerNotice,
        clearBanner,
        signInWithGoogle,
        logout,
        createWorkspace,
        joinWorkspaceByCode,
        runAutonomousLearningDemo,
        submitActivityAttempt,
        addClass,
        addSubjectWithCompetency,
        saveStudent,
        removeStudent,
        createAssessment,
        createAssignedActivity,
        updateInterventionStatus,
        markAssessmentReviewed,
        updateConsent,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider');
  }
  return ctx;
}
