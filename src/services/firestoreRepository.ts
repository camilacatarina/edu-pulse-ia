import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
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
  SchoolClass,
  Student,
  Subject,
  UserProfile,
  UserRole,
  VALIDATION_LIMITS,
} from '../types/domain';

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, VALIDATION_LIMITS.MAX_ID_LENGTH);
}

function truncate(str: string, max: number): string {
  return str.trim().slice(0, max);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function getInstitution(institutionId: string): Promise<Institution | null> {
  const path = `institutions/${institutionId}`;
  try {
    const snap = await getDoc(doc(db, 'institutions', institutionId));
    return snap.exists() ? (snap.data() as Institution) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function createInstitutionWorkspace(params: {
  uid: string;
  email: string;
  displayName: string;
  institutionName: string;
  role: 'ADMIN' | 'TEACHER';
}): Promise<{ institution: Institution; profile: UserProfile }> {
  const now = new Date().toISOString();
  const instId = sanitizeId(`inst_${Date.now().toString(36)}_${params.uid.slice(0, 6)}`);
  const joinCode = `EDU-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const institution: Institution = {
    id: instId,
    name: truncate(params.institutionName, VALIDATION_LIMITS.MAX_INSTITUTION_NAME_LENGTH),
    joinCode,
    ownerUid: params.uid,
    staffUids: [params.uid],
    retentionDays: 365,
    createdAt: now,
  };

  const profile: UserProfile = {
    uid: params.uid,
    institutionId: instId,
    role: params.role,
    displayName: truncate(params.displayName || 'Educator', VALIDATION_LIMITS.MAX_NAME_LENGTH),
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'institutions', instId), institution);
    await setDoc(doc(db, 'institutionDirectory', joinCode), {
      joinCode,
      institutionId: instId,
      name: institution.name,
      ownerUid: params.uid,
      createdAt: now,
    });
    await setDoc(doc(db, 'users', params.uid), profile);
    await setDoc(doc(db, 'users', params.uid, 'private', 'info'), {
      uid: params.uid,
      email: params.email.slice(0, 254),
      institutionId: instId,
      updatedAt: now,
    });

    // Disciplinas iniciais para uso imediato no Modo LIVE
    const defaultSubjects: Array<{ name: string; code: string; compName: string; compCode: string }> = [
      { name: 'Matemática', code: 'MAT', compName: 'Equações de Primeiro Grau e Operações Inversas', compCode: 'MAT-EQ1' },
      { name: 'Ciências Físicas', code: 'FIS', compName: 'Movimento Uniforme e Cinemática', compCode: 'FIS-CIN1' },
      { name: 'Língua Portuguesa', code: 'PORT', compName: 'Argumentação Baseada em Evidências', compCode: 'PORT-ARG1' },
    ];

    const batch = writeBatch(db);
    defaultSubjects.forEach((s, i) => {
      const subId = sanitizeId(`sub_${instId.slice(-6)}_${i + 1}`);
      const compId = sanitizeId(`comp_${instId.slice(-6)}_${i + 1}`);
      batch.set(doc(db, 'subjects', subId), {
        id: subId,
        institutionId: instId,
        staffUids: [params.uid],
        name: s.name,
        code: s.code,
        createdAt: now,
      });
      batch.set(doc(db, 'competencies', compId), {
        id: compId,
        institutionId: instId,
        staffUids: [params.uid],
        subjectId: subId,
        code: s.compCode,
        name: s.compName,
        description: `Competência fundamental em ${s.name}.`,
        gradeLevel: '8º Ano',
        createdAt: now,
      });
    });

    const auditId = sanitizeId(`aud_${Date.now()}`);
    batch.set(doc(db, 'auditLogs', auditId), {
      id: auditId,
      institutionId: instId,
      staffUids: [params.uid],
      actorUid: params.uid,
      actorType: params.role,
      action: 'INSTITUTION_WORKSPACE_CREATED',
      targetCollection: 'institutions',
      targetId: instId,
      summary: `Workspace institucional isolado "${institution.name}" criado com currículo inicial.`,
      createdAt: now,
    });

    await batch.commit();
    return { institution, profile };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `institutions/${instId}`);
  }
}

export async function joinInstitutionByCode(params: {
  uid: string;
  email: string;
  displayName: string;
  joinCode: string;
}): Promise<UserProfile> {
  const code = params.joinCode.trim().toUpperCase();
  try {
    const dirSnap = await getDoc(doc(db, 'institutionDirectory', code));
    if (!dirSnap.exists()) {
      throw new Error('Código da instituição não encontrado. Verifique com o administrador da escola.');
    }
    const dir = dirSnap.data() as { institutionId: string; name: string };
    const now = new Date().toISOString();
    const profile: UserProfile = {
      uid: params.uid,
      institutionId: dir.institutionId,
      role: 'STUDENT',
      displayName: truncate(params.displayName || 'Estudante', VALIDATION_LIMITS.MAX_NAME_LENGTH),
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'users', params.uid), profile);
    await setDoc(doc(db, 'users', params.uid, 'private', 'info'), {
      uid: params.uid,
      email: params.email.slice(0, 254),
      institutionId: dir.institutionId,
      updatedAt: now,
    });
    return profile;
  } catch (err) {
    if (err instanceof Error && err.message.includes('não encontrado')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `institutionDirectory/${code}`);
  }
}

export interface LiveWorkspaceCallbacks {
  onClasses: (items: SchoolClass[]) => void;
  onStudents: (items: Student[]) => void;
  onSubjects: (items: Subject[]) => void;
  onCompetencies: (items: Competency[]) => void;
  onAssessments: (items: Assessment[]) => void;
  onAssessmentResults: (items: AssessmentResult[]) => void;
  onActivities: (items: LearningActivity[]) => void;
  onLearningPaths: (items: LearningPath[]) => void;
  onInterventions: (items: Intervention[]) => void;
  onLearningEvents: (items: LearningEvent[]) => void;
  onAIInsights: (items: AIInsight[]) => void;
  onAuditLogs: (items: AuditLog[]) => void;
  onConsentRecords: (items: ConsentRecord[]) => void;
  onError: (err: Error) => void;
}

export function subscribeInstitutionWorkspace(
  institutionId: string,
  uid: string,
  role: UserRole,
  cb: LiveWorkspaceCallbacks
): () => void {
  const unsubs: Unsubscribe[] = [];

  const watch = <T>(
    colName: string,
    q: ReturnType<typeof query>,
    setter: (items: T[]) => void
  ) => {
    const unsub = onSnapshot(
      q,
      (snap) => {
        setter(snap.docs.map((d) => d.data() as T));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, colName);
        } catch (wrapped) {
          cb.onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );
    unsubs.push(unsub);
  };

  if (role === 'STUDENT') {
    // Student role queries strictly scoped to studentOwnerUid == uid
    watch<Student>(
      'students',
      query(collection(db, 'students'), where('studentOwnerUid', '==', uid)),
      cb.onStudents
    );
    watch<AssessmentResult>(
      'assessmentResults',
      query(collection(db, 'assessmentResults'), where('studentOwnerUid', '==', uid)),
      cb.onAssessmentResults
    );
    watch<LearningActivity>(
      'activities',
      query(collection(db, 'activities'), where('studentOwnerUid', '==', uid)),
      cb.onActivities
    );
    watch<LearningPath>(
      'learningPaths',
      query(collection(db, 'learningPaths'), where('studentOwnerUid', '==', uid)),
      cb.onLearningPaths
    );
    watch<Intervention>(
      'interventions',
      query(collection(db, 'interventions'), where('studentOwnerUid', '==', uid)),
      cb.onInterventions
    );
    watch<AIInsight>(
      'aiInsights',
      query(collection(db, 'aiInsights'), where('studentOwnerUid', '==', uid)),
      cb.onAIInsights
    );
    cb.onClasses([]);
    cb.onSubjects([]);
    cb.onCompetencies([]);
    cb.onAssessments([]);
    cb.onLearningEvents([]);
    cb.onAuditLogs([]);
    cb.onConsentRecords([]);
    return () => unsubs.forEach((u) => u());
  }

  // ADMIN / TEACHER queries strictly scoped to staffUids array-contains uid & institutionId
  const staffFilter = (colName: string) =>
    query(
      collection(db, colName),
      where('institutionId', '==', institutionId),
      where('staffUids', 'array-contains', uid)
    );

  watch<SchoolClass>('classes', staffFilter('classes'), cb.onClasses);
  watch<Student>('students', staffFilter('students'), cb.onStudents);
  watch<Subject>('subjects', staffFilter('subjects'), cb.onSubjects);
  watch<Competency>('competencies', staffFilter('competencies'), cb.onCompetencies);
  watch<Assessment>('assessments', staffFilter('assessments'), cb.onAssessments);
  watch<AssessmentResult>('assessmentResults', staffFilter('assessmentResults'), cb.onAssessmentResults);
  watch<LearningActivity>('activities', staffFilter('activities'), cb.onActivities);
  watch<LearningPath>('learningPaths', staffFilter('learningPaths'), cb.onLearningPaths);
  watch<Intervention>('interventions', staffFilter('interventions'), cb.onInterventions);
  watch<LearningEvent>('learningEvents', staffFilter('learningEvents'), cb.onLearningEvents);
  watch<AIInsight>('aiInsights', staffFilter('aiInsights'), cb.onAIInsights);
  watch<AuditLog>('auditLogs', staffFilter('auditLogs'), cb.onAuditLogs);
  watch<ConsentRecord>('consentRecords', staffFilter('consentRecords'), cb.onConsentRecords);

  return () => unsubs.forEach((u) => u());
}

export async function createClassInFirestore(data: SchoolClass): Promise<void> {
  try {
    await setDoc(doc(db, 'classes', data.id), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `classes/${data.id}`);
  }
}

export async function createSubjectInFirestore(subject: Subject, competency: Competency): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'subjects', subject.id), subject);
    batch.set(doc(db, 'competencies', competency.id), competency);
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `subjects/${subject.id}`);
  }
}

export async function upsertStudentInFirestore(student: Student, consent?: ConsentRecord): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'students', student.id), student);
    if (consent) {
      batch.set(doc(db, 'consentRecords', consent.id), consent);
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `students/${student.id}`);
  }
}

export async function updateStudentInFirestore(
  studentId: string,
  updates: Partial<Pick<Student, 'displayName' | 'classId' | 'gradeLevel' | 'pedagogicalStatus' | 'averageScore' | 'completionRate' | 'subjectIds' | 'studentOwnerUid' | 'updatedAt'>>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'students', studentId), updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `students/${studentId}`);
  }
}

export async function deleteStudentInFirestore(studentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'students', studentId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `students/${studentId}`);
  }
}

export async function createAssessmentInFirestore(assessment: Assessment): Promise<void> {
  try {
    await setDoc(doc(db, 'assessments', assessment.id), assessment);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `assessments/${assessment.id}`);
  }
}

export async function persistAutonomousCycleOutputs(params: {
  event: LearningEvent;
  insight: AIInsight;
  generatedActivity: LearningActivity;
  learningPath: LearningPath;
  intervention?: Intervention;
  auditLog: AuditLog;
  studentUpdate: {
    studentId: string;
    pedagogicalStatus: Student['pedagogicalStatus'];
    averageScore: number;
    completionRate: number;
    updatedAt: string;
  };
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'learningEvents', params.event.id), params.event);
    batch.set(doc(db, 'aiInsights', params.insight.id), params.insight);
    batch.set(doc(db, 'activities', params.generatedActivity.id), params.generatedActivity);
    batch.set(doc(db, 'learningPaths', params.learningPath.id), params.learningPath);
    if (params.intervention) {
      batch.set(doc(db, 'interventions', params.intervention.id), params.intervention);
    }
    batch.set(doc(db, 'auditLogs', params.auditLog.id), params.auditLog);
    batch.update(doc(db, 'students', params.studentUpdate.studentId), {
      pedagogicalStatus: params.studentUpdate.pedagogicalStatus,
      averageScore: params.studentUpdate.averageScore,
      completionRate: params.studentUpdate.completionRate,
      updatedAt: params.studentUpdate.updatedAt,
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `learningEvents/${params.event.id}`);
  }
}

export async function saveActivitySubmissionInFirestore(params: {
  activityId: string;
  scorePercentage: number;
  feedbackSummary: string;
  submittedAnswers: LearningActivity['submittedAnswers'];
  updatedAt: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'activities', params.activityId), {
      status: 'COMPLETED',
      scorePercentage: params.scorePercentage,
      feedbackSummary: params.feedbackSummary,
      submittedAnswers: params.submittedAnswers,
      updatedAt: params.updatedAt,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `activities/${params.activityId}`);
  }
}

export async function createActivityInFirestore(activity: LearningActivity): Promise<void> {
  try {
    await setDoc(doc(db, 'activities', activity.id), activity);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `activities/${activity.id}`);
  }
}

export async function updateInterventionStatusInFirestore(
  interventionId: string,
  status: Intervention['status'],
  outcomeSummary?: string
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (outcomeSummary !== undefined) {
      payload.outcomeSummary = outcomeSummary.slice(0, 800);
    }
    await updateDoc(doc(db, 'interventions', interventionId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `interventions/${interventionId}`);
  }
}

export async function updateAssessmentReviewInFirestore(
  resultId: string,
  teacherReviewed: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'assessmentResults', resultId), {
      teacherReviewed,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `assessmentResults/${resultId}`);
  }
}

export async function updateConsentRecordInFirestore(
  consentId: string,
  updates: Partial<Pick<ConsentRecord, 'guardianConsentStatus' | 'dataMinimizationAccepted' | 'retentionPolicyDays' | 'updatedByUid' | 'updatedAt'>>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'consentRecords', consentId), updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `consentRecords/${consentId}`);
  }
}

export async function fetchAllConsentRecordsOnce(institutionId: string, uid: string): Promise<ConsentRecord[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'consentRecords'),
        where('institutionId', '==', institutionId),
        where('staffUids', 'array-contains', uid)
      )
    );
    return snap.docs.map((d) => d.data() as ConsentRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'consentRecords');
  }
}
