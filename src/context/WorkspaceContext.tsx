import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  createAssessmentResultInFirestore,
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
  updateAssessmentResultAiReviewInFirestore,
  updateAssessmentReviewInFirestore,
  updateConsentRecordInFirestore,
  updateInterventionStatusInFirestore,
  updateStudentInFirestore,
  upsertStudentInFirestore,
} from '../services/firestoreRepository';
import {
  AutoExamCandidatePayload,
  AutoStepCandidatePayload,
  evaluateOpenResponse,
  fetchEngineHealth,
  triggerAutonomousAutoStep,
  triggerAutonomousEngine,
  triggerAutonomousExamReview,
} from '../services/aiApiService';
import {
  buildStudentAcademicProfile,
  StudentAcademicProfile,
} from '../utils/pedagogicalAnalytics';

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

interface AutoDecisionSummary {
  id: string;
  modeType: 'EXAM_REVIEW' | 'RISK_INTERVENTION';
  studentName: string;
  gradeLevel: string;
  subjectName: string;
  competencyName: string;
  activityTitle: string;
  reason: string;
  reviewVerdict?: string;
  riskAlert?: 'PRIORIDADE_MAXIMA' | 'ATENCAO' | 'REGULAR';
  bestSubject?: string;
  worstSubject?: string;
  engineSource: 'GEMINI' | 'DEMO_RULES' | 'RULE_ENGINE_FALLBACK';
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
  teacherFilter: string;
  setTeacherFilter: (teacherName: string) => void;
  availableTeachers: string[];
  studentProfiles: StudentAcademicProfile[];
  scopedStudentProfiles: StudentAcademicProfile[];
  geminiConfigured: boolean;
  dataset: WorkspaceDataset;
  needsOnboarding: boolean;
  loadingLive: boolean;
  engineProcessing: boolean;
  autoPilotEnabled: boolean;
  setAutoPilotEnabled: (enabled: boolean) => void;
  nextScanSeconds: number;
  autoActionsCount: number;
  lastAutoDecision: AutoDecisionSummary | null;
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
  runAutonomousAutoScan: (silent?: boolean) => Promise<void>;
  recordExamGrade: (input: {
    studentId: string;
    subjectId: string;
    competencyId: string;
    percentage: number;
  }) => Promise<void>;
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
  const [teacherFilter, setTeacherFilter] = useState<string>('ALL');
  const [engineProcessing, setEngineProcessing] = useState(false);
  const [autoPilotEnabled, setAutoPilotEnabled] = useState(true);
  const [nextScanSeconds, setNextScanSeconds] = useState(20);
  const [autoActionsCount, setAutoActionsCount] = useState(0);
  const [lastAutoDecision, setLastAutoDecision] = useState<AutoDecisionSummary | null>(null);
  const [lastEngineRun, setLastEngineRun] = useState<EngineRunSummary | null>(null);
  const [bannerNotice, setBannerNotice] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const engineRunningRef = useRef(false);
  const initialAutoTriggeredRef = useRef(false);

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

  const availableTeachers = useMemo(() => {
    const names = Array.from(
      new Set(
        dataset.classes
          .map((c) => c.teacherName?.trim())
          .filter((n): n is string => Boolean(n && n.length > 0))
      )
    );
    return names;
  }, [dataset.classes]);

  const studentProfiles = useMemo(() => {
    return dataset.students
      .map((student) =>
        buildStudentAcademicProfile(
          student,
          dataset.subjects,
          dataset.assessmentResults,
          dataset.activities
        )
      )
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [dataset.students, dataset.subjects, dataset.assessmentResults, dataset.activities]);

  const scopedStudentProfiles = useMemo(() => {
    if (teacherFilter === 'ALL') return studentProfiles;
    const teacherClassIds = new Set(
      dataset.classes.filter((c) => c.teacherName === teacherFilter).map((c) => c.id)
    );
    return studentProfiles.filter((sp) => teacherClassIds.has(sp.student.classId));
  }, [studentProfiles, dataset.classes, teacherFilter]);

  const getStaffUids = useCallback((): string[] => {
    if (mode === 'DEMO') return demoDataset.institution.staffUids;
    if (liveInstitution?.staffUids?.length) return liveInstitution.staffUids;
    return firebaseUser ? [firebaseUser.uid] : [];
  }, [mode, demoDataset, liveInstitution, firebaseUser]);

  /**
   * Core Event-Driven Autonomous Learning Cycle execution (both Demo & Live)
   */
  const persistAnalysisOutputs = useCallback(
    async (params: {
      student: Student;
      subject: Subject;
      competency: Competency;
      eventType: LearningEvent['eventType'];
      eventId: string;
      idempotencyKey: string;
      referenceId: string;
      processedAt: string;
      recentScores: number[];
      analysis: Awaited<ReturnType<typeof triggerAutonomousEngine>>['analysis'];
      selectionReason?: string;
    }) => {
      const now = new Date().toISOString();
      const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const { analysis } = params;
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
        title: analysis.generatedActivity.title,
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
            sourceEventId: params.eventId,
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
        id: params.eventId,
        institutionId: dataset.institution.id,
        staffUids,
        studentOwnerUid: params.student.studentOwnerUid,
        eventType: params.eventType,
        studentId: params.student.id,
        subjectId: params.subject.id,
        competencyId: params.competency.id,
        referenceId: params.referenceId,
        idempotencyKey: params.idempotencyKey,
        status: 'PROCESSED',
        createdAt: now,
        processedAt: params.processedAt,
      };

      const aiInsight: AIInsight = {
        id: insId,
        institutionId: dataset.institution.id,
        staffUids,
        studentOwnerUid: params.student.studentOwnerUid,
        eventId: params.eventId,
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
          ? `Apoio automático criado com a atividade "${generatedActivity.title}".`
          : `Trilha atualizada para ${learningPath.estimatedLevel} com a atividade "${generatedActivity.title}".`,
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
        summary: `IA agiu sozinha para ${params.student.pseudonymId} (${params.competency.code}) via ${analysis.engineSource}.`,
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
        id: params.eventId,
        pseudonymId: params.student.pseudonymId,
        subjectName: params.subject.name,
        competencyCode: params.competency.code,
        engineSource: analysis.engineSource,
        strategy: analysis.recommendedStrategy,
        nextAction: analysis.nextAction,
        timestamp: now,
      });

      setAutoActionsCount((c) => c + 1);
      setLastAutoDecision({
        id: params.eventId,
        modeType: 'RISK_INTERVENTION',
        studentName: params.student.displayName,
        gradeLevel: params.student.gradeLevel,
        subjectName: params.subject.name,
        competencyName: params.competency.name,
        activityTitle: generatedActivity.title,
        reason:
          params.selectionReason ||
          `A IA identificou oportunidade de reforço em ${params.competency.name} e agiu automaticamente.`,
        engineSource: analysis.engineSource,
        timestamp: now,
      });

      return { analysis, generatedActivity, intervention, aiInsight };
    },
    [dataset.institution.id, dataset.learningPaths, getStaffUids, mode]
  );

  const runAutonomousAutoScan = useCallback(
    async (silent = true) => {
      if (engineRunningRef.current) return;
      if (
        dataset.students.length === 0 ||
        dataset.subjects.length === 0 ||
        dataset.competencies.length === 0
      ) {
        return;
      }

      engineRunningRef.current = true;
      setEngineProcessing(true);
      try {
        // 1. Automanutenção: concluir intervenções cujas atividades já foram entregues
        const completedActivityIds = new Set(
          dataset.activities.filter((a) => a.status === 'COMPLETED').map((a) => a.id)
        );
        const readyToClose = dataset.interventions.filter(
          (intv) =>
            (intv.status === 'ASSIGNED' || intv.status === 'IN_PROGRESS') &&
            intv.activityIds.length > 0 &&
            intv.activityIds.every((id) => completedActivityIds.has(id))
        );

        for (const intv of readyToClose) {
          const outcome = 'Concluída automaticamente pela IA após entrega das atividades de recuperação.';
          if (mode === 'LIVE') {
            await updateInterventionStatusInFirestore(intv.id, 'COMPLETED', outcome);
          } else {
            setDemoDataset((prev) => ({
              ...prev,
              interventions: prev.interventions.map((i) =>
                i.id === intv.id
                  ? { ...i, status: 'COMPLETED', outcomeSummary: outcome, updatedAt: new Date().toISOString() }
                  : i
              ),
            }));
          }
        }

        // 2. Prioridade #1: Revisões de provas automáticas pela IA em provas sem revisão detalhada
        const pendingExams = dataset.assessmentResults.filter(
          (r) => !r.aiPreliminaryFeedback || !r.aiPreliminaryFeedback.includes('Ponto Forte:')
        );

        if (pendingExams.length > 0) {
          const examCandidates: Array<{
            result: AssessmentResult;
            student: Student;
            subject: Subject;
            competency: Competency;
            profile?: StudentAcademicProfile;
            payload: AutoExamCandidatePayload;
          }> = [];

          for (const res of pendingExams.slice(0, 24)) {
            const stu = dataset.students.find((s) => s.id === res.studentId);
            const sub = dataset.subjects.find((s) => s.id === res.subjectId);
            const comp = dataset.competencies.find((c) => c.id === res.competencyId);
            if (!stu || !sub || !comp) continue;

            const profile = studentProfiles.find((sp) => sp.student.id === stu.id);
            const subScores = dataset.assessmentResults
              .filter((r) => r.studentId === stu.id && r.subjectId === sub.id)
              .slice(-3)
              .map((r) => r.percentage);

            examCandidates.push({
              result: res,
              student: stu,
              subject: sub,
              competency: comp,
              profile,
              payload: {
                resultId: res.id,
                pseudonymId: stu.pseudonymId,
                gradeLevel: stu.gradeLevel,
                subjectName: sub.name,
                competencyCode: comp.code,
                competencyName: comp.name,
                score: res.score,
                maxScore: res.maxScore,
                percentage: res.percentage,
                studentOverallAvg: profile?.overallAverage ?? stu.averageScore,
                bestSubjectName: profile?.bestSubject?.subject.name || '',
                worstSubjectName: profile?.worstSubject?.subject.name || sub.name,
                recentScores: subScores.length > 0 ? subScores : [res.percentage],
                alreadyReviewed: false,
              },
            });
          }

          if (examCandidates.length > 0) {
            const reviewOut = await triggerAutonomousExamReview({
              institutionId: dataset.institution.id,
              exams: examCandidates.map((e) => e.payload),
              demoMode: mode === 'DEMO',
            });

            const matchedExam =
              examCandidates.find((e) => e.result.id === reviewOut.selectedExam.resultId) ||
              examCandidates[0];

            // Salvar revisão da prova no AssessmentResult
            if (mode === 'LIVE') {
              await updateAssessmentResultAiReviewInFirestore(
                matchedExam.result.id,
                reviewOut.examReview.reviewText
              );
            } else {
              setDemoDataset((prev) => ({
                ...prev,
                assessmentResults: prev.assessmentResults.map((r) =>
                  r.id === matchedExam.result.id
                    ? { ...r, aiPreliminaryFeedback: reviewOut.examReview.reviewText }
                    : r
                ),
              }));
            }

            await persistAnalysisOutputs({
              student: matchedExam.student,
              subject: matchedExam.subject,
              competency: matchedExam.competency,
              eventType: 'AssessmentSubmitted',
              eventId: reviewOut.eventId,
              idempotencyKey: reviewOut.idempotencyKey,
              referenceId: matchedExam.result.id,
              processedAt: reviewOut.processedAt,
              recentScores: matchedExam.payload.recentScores,
              analysis: reviewOut.analysis,
              selectionReason: reviewOut.selectionReason,
            });

            setLastAutoDecision({
              id: reviewOut.eventId,
              modeType: 'EXAM_REVIEW',
              studentName: matchedExam.student.displayName,
              gradeLevel: matchedExam.student.gradeLevel,
              subjectName: matchedExam.subject.name,
              competencyName: matchedExam.competency.name,
              activityTitle: reviewOut.analysis.generatedActivity.title,
              reason: reviewOut.selectionReason,
              reviewVerdict: reviewOut.examReview.verdict,
              riskAlert: reviewOut.examReview.failureRiskAlert,
              bestSubject: matchedExam.profile?.bestSubject?.subject.name,
              worstSubject: matchedExam.profile?.worstSubject?.subject.name,
              engineSource: reviewOut.examReview.engineSource,
              timestamp: reviewOut.processedAt,
            });

            if (!silent) {
              setBannerNotice({
                type: 'success',
                message: `IA revisou a prova de ${matchedExam.student.displayName} em ${matchedExam.subject.name} e atualizou o risco de reprovação automaticamente.`,
              });
            }
            return;
          }
        }

        // 3. Caso todas as provas já tenham revisão, varrer matérias fracas sem reforço ativo
        const candidates: Array<{
          student: Student;
          subject: Subject;
          competency: Competency;
          recentScores: number[];
          profile?: StudentAcademicProfile;
          payload: AutoStepCandidatePayload;
        }> = [];

        dataset.students.forEach((stu) => {
          const profile = studentProfiles.find((sp) => sp.student.id === stu.id);
          const worstSub = profile?.worstSubject?.subject;
          const candidateComps = worstSub
            ? dataset.competencies.filter((c) => c.subjectId === worstSub.id)
            : dataset.competencies;
          const pool = candidateComps.length > 0 ? candidateComps : dataset.competencies;

          const pendingCompIds = new Set(
            dataset.activities
              .filter((a) => a.studentId === stu.id && a.status !== 'COMPLETED')
              .map((a) => a.competencyId)
          );

          const candidateComp =
            pool.find((c) => !pendingCompIds.has(c.id)) ||
            dataset.competencies.find((c) => !pendingCompIds.has(c.id)) ||
            pool[0];

          const stuResults = dataset.assessmentResults.filter((r) => r.studentId === stu.id);
          const compScores = stuResults
            .filter((r) => r.subjectId === candidateComp.subjectId)
            .slice(-3)
            .map((r) => r.percentage);
          const recentScores =
            compScores.length > 0
              ? compScores
              : [profile?.worstSubject?.average ?? stu.averageScore];

          const latestScore = recentScores[recentScores.length - 1] ?? stu.averageScore;
          const subject =
            dataset.subjects.find((s) => s.id === candidateComp.subjectId) || dataset.subjects[0];

          const hasPendingActivity = dataset.activities.some(
            (a) =>
              a.studentId === stu.id &&
              a.competencyId === candidateComp.id &&
              a.status !== 'COMPLETED'
          );
          const hasOpenIntervention = dataset.interventions.some(
            (i) => i.studentId === stu.id && i.status !== 'COMPLETED'
          );
          const completedCount = dataset.activities.filter(
            (a) => a.studentId === stu.id && a.status === 'COMPLETED'
          ).length;

          candidates.push({
            student: stu,
            subject,
            competency: candidateComp,
            recentScores,
            profile,
            payload: {
              pseudonymId: stu.pseudonymId,
              gradeLevel: stu.gradeLevel,
              subjectName: subject.name,
              competencyCode: candidateComp.code,
              competencyName: candidateComp.name,
              recentScores,
              latestScore,
              completedActivitiesCount: completedCount,
              hasPendingActivity,
              hasOpenIntervention,
            },
          });
        });

        if (candidates.length === 0) return;

        const out = await triggerAutonomousAutoStep({
          institutionId: dataset.institution.id,
          candidates: candidates.slice(0, 20).map((c) => c.payload),
          demoMode: mode === 'DEMO',
        });

        const matched =
          candidates.find((c) => c.student.pseudonymId === out.selectedCandidate.pseudonymId) ||
          candidates[0];

        await persistAnalysisOutputs({
          student: matched.student,
          subject: matched.subject,
          competency: matched.competency,
          eventType: 'StudentProgressUpdated',
          eventId: out.eventId,
          idempotencyKey: out.idempotencyKey,
          referenceId: matched.student.id,
          processedAt: out.processedAt,
          recentScores: matched.recentScores,
          analysis: out.analysis,
          selectionReason: out.selectionReason,
        });

        setLastAutoDecision((prev) => ({
          id: out.eventId,
          modeType: 'RISK_INTERVENTION',
          studentName: matched.student.displayName,
          gradeLevel: matched.student.gradeLevel,
          subjectName: matched.subject.name,
          competencyName: matched.competency.name,
          activityTitle: out.analysis.generatedActivity.title,
          reason: out.selectionReason,
          riskAlert:
            matched.profile?.riskLevel === 'MAXIMUM'
              ? 'PRIORIDADE_MAXIMA'
              : matched.profile?.riskLevel === 'MODERATE'
                ? 'ATENCAO'
                : 'REGULAR',
          bestSubject: matched.profile?.bestSubject?.subject.name,
          worstSubject: matched.profile?.worstSubject?.subject.name,
          engineSource: out.analysis.engineSource,
          timestamp: out.processedAt,
        }));

        if (!silent) {
          setBannerNotice({
            type: 'success',
            message: `A IA atuou em ${matched.student.displayName} (${matched.subject.name}) e preparou "${out.analysis.generatedActivity.title}".`,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha na execução automática da IA.';
        if (msg.includes('429') || msg.includes('Cota diária')) {
          setAutoPilotEnabled(false);
        }
        if (!silent || msg.includes('429')) {
          setBannerNotice({ type: 'error', message: msg });
        }
      } finally {
        engineRunningRef.current = false;
        setEngineProcessing(false);
        setNextScanSeconds(20);
      }
    },
    [dataset, mode, persistAnalysisOutputs, studentProfiles]
  );

  const recordExamGrade = useCallback(
    async (input: {
      studentId: string;
      subjectId: string;
      competencyId: string;
      percentage: number;
    }) => {
      const student = dataset.students.find((s) => s.id === input.studentId);
      const subject = dataset.subjects.find((s) => s.id === input.subjectId);
      const competency = dataset.competencies.find((c) => c.id === input.competencyId);
      if (!student || !subject || !competency) return;

      const cleanPct = Math.min(100, Math.max(0, Math.round(input.percentage)));
      const now = new Date().toISOString();
      const resultId = `res_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
      const assessment =
        dataset.assessments.find((a) => a.subjectId === subject.id) || dataset.assessments[0];

      const newResult: AssessmentResult = {
        id: resultId,
        institutionId: dataset.institution.id,
        staffUids: getStaffUids(),
        studentOwnerUid: student.studentOwnerUid,
        assessmentId: assessment?.id || `asmt_${subject.code.toLowerCase()}`,
        studentId: student.id,
        subjectId: subject.id,
        competencyId: competency.id,
        score: cleanPct,
        maxScore: 100,
        percentage: cleanPct,
        teacherReviewed: false,
        aiPreliminaryFeedback: '',
        submittedAt: now,
      };

      if (mode === 'LIVE') {
        await createAssessmentResultInFirestore(newResult);
      } else {
        setDemoDataset((prev) => ({
          ...prev,
          assessmentResults: [newResult, ...prev.assessmentResults],
        }));
      }

      // Dispara revisão imediata da IA para essa prova recém-lançada
      const profile = studentProfiles.find((sp) => sp.student.id === student.id);
      setEngineProcessing(true);
      try {
        const reviewOut = await triggerAutonomousExamReview({
          institutionId: dataset.institution.id,
          exams: [
            {
              resultId,
              pseudonymId: student.pseudonymId,
              gradeLevel: student.gradeLevel,
              subjectName: subject.name,
              competencyCode: competency.code,
              competencyName: competency.name,
              score: cleanPct,
              maxScore: 100,
              percentage: cleanPct,
              studentOverallAvg: profile?.overallAverage ?? student.averageScore,
              bestSubjectName: profile?.bestSubject?.subject.name || '',
              worstSubjectName: profile?.worstSubject?.subject.name || subject.name,
              recentScores: [cleanPct],
              alreadyReviewed: false,
            },
          ],
          demoMode: mode === 'DEMO',
        });

        if (mode === 'LIVE') {
          await updateAssessmentResultAiReviewInFirestore(
            resultId,
            reviewOut.examReview.reviewText
          );
        } else {
          setDemoDataset((prev) => ({
            ...prev,
            assessmentResults: prev.assessmentResults.map((r) =>
              r.id === resultId
                ? { ...r, aiPreliminaryFeedback: reviewOut.examReview.reviewText }
                : r
            ),
          }));
        }

        await persistAnalysisOutputs({
          student,
          subject,
          competency,
          eventType: 'AssessmentSubmitted',
          eventId: reviewOut.eventId,
          idempotencyKey: reviewOut.idempotencyKey,
          referenceId: resultId,
          processedAt: reviewOut.processedAt,
          recentScores: [cleanPct],
          analysis: reviewOut.analysis,
          selectionReason: reviewOut.selectionReason,
        });

        setLastAutoDecision({
          id: reviewOut.eventId,
          modeType: 'EXAM_REVIEW',
          studentName: student.displayName,
          gradeLevel: student.gradeLevel,
          subjectName: subject.name,
          competencyName: competency.name,
          activityTitle: reviewOut.analysis.generatedActivity.title,
          reason: reviewOut.selectionReason,
          reviewVerdict: reviewOut.examReview.verdict,
          riskAlert: reviewOut.examReview.failureRiskAlert,
          bestSubject: profile?.bestSubject?.subject.name,
          worstSubject: profile?.worstSubject?.subject.name,
          engineSource: reviewOut.examReview.engineSource,
          timestamp: reviewOut.processedAt,
        });

        setBannerNotice({
          type: 'success',
          message: `Nota lançada (${(cleanPct / 10).toFixed(1).replace('.', ',')}). A IA revisou a prova e atualizou a prioridade de ${student.displayName}.`,
        });
      } finally {
        setEngineProcessing(false);
      }
    },
    [dataset, getStaffUids, mode, persistAnalysisOutputs, studentProfiles]
  );

  const runAutonomousLearningDemo = useCallback(
    async (targetStudentId?: string) => {
      if (dataset.students.length === 0 || dataset.subjects.length === 0 || dataset.competencies.length === 0) {
        setBannerNotice({
          type: 'error',
          message: 'Cadastre pelo menos um estudante, uma disciplina e uma competência antes de executar a IA.',
        });
        return;
      }

      if (!targetStudentId) {
        await runAutonomousAutoScan(false);
        return;
      }

      if (engineRunningRef.current) return;
      engineRunningRef.current = true;
      setEngineProcessing(true);
      try {
        const student =
          dataset.students.find((s) => s.id === targetStudentId) || dataset.students[0];
        const gradeComps = dataset.competencies.filter((c) => c.gradeLevel === student.gradeLevel);
        const competency = gradeComps[0] || dataset.competencies[0];
        const subject =
          dataset.subjects.find((s) => s.id === competency.subjectId) || dataset.subjects[0];

        const priorScores = dataset.assessmentResults
          .filter((r) => r.studentId === student.id)
          .slice(-3)
          .map((r) => r.percentage);
        const latestScore = priorScores[priorScores.length - 1] ?? student.averageScore;
        const recentScores = priorScores.length > 0 ? priorScores : [latestScore];
        const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const eventId = `evt_${suffix}`;
        const idempotencyKey = `idem_${student.id}_${competency.code}_${suffix}`;

        const completedCount = dataset.activities.filter(
          (a) => a.studentId === student.id && a.status === 'COMPLETED'
        ).length;

        const engineRes = await triggerAutonomousEngine({
          eventId,
          idempotencyKey,
          eventType: 'StudentProgressUpdated',
          institutionId: dataset.institution.id,
          pseudonymId: student.pseudonymId,
          gradeLevel: student.gradeLevel,
          subjectName: subject.name,
          competencyCode: competency.code,
          competencyName: competency.name,
          recentScores,
          latestScore,
          completedActivitiesCount: completedCount,
          missedTopics: latestScore < 75 ? [competency.name] : [],
          demoMode: mode === 'DEMO',
        });

        await persistAnalysisOutputs({
          student,
          subject,
          competency,
          eventType: 'StudentProgressUpdated',
          eventId,
          idempotencyKey,
          referenceId: student.id,
          processedAt: engineRes.processedAt,
          recentScores,
          analysis: engineRes.analysis,
        });

        setBannerNotice({
          type: 'success',
          message: `IA executada para ${student.displayName}: "${engineRes.analysis.generatedActivity.title}" criada e trilha atualizada.`,
        });
      } catch (err) {
        setBannerNotice({
          type: 'error',
          message: err instanceof Error ? err.message : 'Falha na execução da IA.',
        });
      } finally {
        engineRunningRef.current = false;
        setEngineProcessing(false);
        setNextScanSeconds(25);
      }
    },
    [dataset, mode, persistAnalysisOutputs, runAutonomousAutoScan]
  );

  // Ref para manter o ciclo contínuo sempre atualizado sem reiniciar timers
  const autoScanRef = useRef(runAutonomousAutoScan);
  useEffect(() => {
    autoScanRef.current = runAutonomousAutoScan;
  }, [runAutonomousAutoScan]);

  // Disparo inicial automático ao abrir o sistema (sem precisar clicar em nada)
  useEffect(() => {
    if (!autoPilotEnabled || effectiveRole === 'STUDENT' || needsOnboarding) return;
    if (dataset.students.length === 0 || initialAutoTriggeredRef.current) return;

    const timer = setTimeout(() => {
      initialAutoTriggeredRef.current = true;
      void autoScanRef.current(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [autoPilotEnabled, effectiveRole, needsOnboarding, dataset.students.length]);

  // Varredura periódica autônoma a cada 20 segundos
  useEffect(() => {
    if (!autoPilotEnabled || effectiveRole === 'STUDENT' || needsOnboarding) return;
    if (dataset.students.length === 0) return;

    const tick = setInterval(() => {
      setNextScanSeconds((prev) => {
        if (prev <= 1) {
          void autoScanRef.current(true);
          return 20;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [autoPilotEnabled, effectiveRole, needsOnboarding, dataset.students.length]);

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

      return persistAnalysisOutputs({
        student: params.student,
        subject: params.subject,
        competency: params.competency,
        eventType: params.eventType,
        eventId,
        idempotencyKey,
        referenceId: params.referenceId,
        processedAt: engineRes.processedAt,
        recentScores: params.recentScores,
        analysis: engineRes.analysis,
      });
    },
    [dataset.activities, dataset.institution.id, mode, persistAnalysisOutputs]
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
              subjectName: subject?.name || 'Disciplina',
              competencyName: competency?.name || 'Competência',
              questionPrompt: q.prompt,
              referenceAnswer: q.correctAnswer,
              studentResponse: userAns || 'Sem resposta informada',
              demoMode: mode === 'DEMO',
            });
            const isPass = evalRes.preliminaryScore >= 70;
            if (isPass) earnedPoints += 1;
            else earnedPoints += evalRes.preliminaryScore / 100;
            submittedAnswers.push({
              questionId: q.id,
              answer: userAns,
              isCorrect: isPass,
              feedback: `${evalRes.feedback} (Feedback preliminar da IA — a revisão final é do professor)`,
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
        teacherFilter,
        setTeacherFilter,
        availableTeachers,
        studentProfiles,
        scopedStudentProfiles,
        geminiConfigured,
        dataset,
        needsOnboarding,
        loadingLive,
        engineProcessing,
        autoPilotEnabled,
        setAutoPilotEnabled,
        nextScanSeconds,
        autoActionsCount,
        lastAutoDecision,
        lastEngineRun,
        bannerNotice,
        clearBanner,
        signInWithGoogle,
        logout,
        createWorkspace,
        joinWorkspaceByCode,
        runAutonomousLearningDemo,
        runAutonomousAutoScan,
        recordExamGrade,
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
