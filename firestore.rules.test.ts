/**
 * Security Rule Verification Suite — Dirty Dozen Adversarial Payloads
 * Aligns with security_spec.md and firestore.rules invariants.
 *
 * Note: To run against a live Firestore Emulator, install @firebase/rules-unit-testing
 * and start `firebase emulators:start --only firestore`. This file also exports the
 * payload matrix for deterministic static verification.
 */

export interface AdversarialTestCase {
  id: string;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  actor: {
    uid: string;
    email: string;
    email_verified: boolean;
    institutionId: string;
    role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  };
  targetPath: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_PAYLOADS: AdversarialTestCase[] = [
  {
    id: 'DD-01',
    name: 'Cross-Tenant Institution Class Read',
    collection: 'classes',
    operation: 'get',
    actor: { uid: 'teacher_a', email: 't@school-a.edu', email_verified: true, institutionId: 'inst_a', role: 'TEACHER' },
    targetPath: '/classes/class_b_1',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isStaffMember(existing().staffUids)'
  },
  {
    id: 'DD-02',
    name: 'Self-Escalation to ADMIN on Existing Institution',
    collection: 'users',
    operation: 'create',
    actor: { uid: 'attacker_1', email: 'a@x.edu', email_verified: true, institutionId: 'inst_a', role: 'STUDENT' },
    targetPath: '/users/attacker_1',
    payload: {
      uid: 'attacker_1',
      institutionId: 'inst_a',
      role: 'ADMIN',
      displayName: 'Rogue Admin',
      createdAt: '2026-11-26T10:00:00Z',
      updatedAt: '2026-11-26T10:00:00Z'
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'request.auth.uid in get(.../institutions/$(incoming().institutionId)).data.staffUids'
  },
  {
    id: 'DD-03',
    name: 'Role Mutation on User Profile Update',
    collection: 'users',
    operation: 'update',
    actor: { uid: 'student_1', email: 's@x.edu', email_verified: true, institutionId: 'inst_a', role: 'STUDENT' },
    targetPath: '/users/student_1',
    payload: { role: 'TEACHER', institutionId: 'inst_b' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().role == existing().role && affectedKeys().hasOnly(["displayName", "updatedAt"])'
  },
  {
    id: 'DD-04',
    name: 'Shadow / Ghost Field Injection on Student',
    collection: 'students',
    operation: 'create',
    actor: { uid: 'teacher_a', email: 't@school-a.edu', email_verified: true, institutionId: 'inst_a', role: 'TEACHER' },
    targetPath: '/students/stu_ghost',
    payload: {
      id: 'stu_ghost',
      institutionId: 'inst_a',
      staffUids: ['teacher_a'],
      studentOwnerUid: '',
      classId: 'cls_1',
      pseudonymId: 'STU-999',
      displayName: 'Test',
      gradeLevel: 'Grade 8',
      pedagogicalStatus: 'Progressing',
      averageScore: 80,
      completionRate: 90,
      subjectIds: ['sub_1'],
      isExemptFromAudit: true,
      createdAt: '2026-11-26T10:00:00Z',
      updatedAt: '2026-11-26T10:00:00Z'
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'data.keys().hasOnly([...]) in isValidStudent'
  },
  {
    id: 'DD-05',
    name: 'ID Poisoning (>128 chars or invalid chars)',
    collection: 'activities',
    operation: 'create',
    actor: { uid: 'teacher_a', email: 't@school-a.edu', email_verified: true, institutionId: 'inst_a', role: 'TEACHER' },
    targetPath: `/activities/${'a'.repeat(300)}`,
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId(activityId)'
  },
  {
    id: 'DD-06',
    name: 'Unverified Email Spoofing Bootstrap Admin',
    collection: 'institutions',
    operation: 'list',
    actor: { uid: 'spoof_uid', email: 'camilacatarina2003@gmail.com', email_verified: false, institutionId: 'inst_b', role: 'STUDENT' },
    targetPath: '/institutions',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isVerifiedUser() checks request.auth.token.email_verified == true'
  },
  {
    id: 'DD-07',
    name: 'Cross-User PII Private Subcollection Read',
    collection: 'users/private',
    operation: 'get',
    actor: { uid: 'teacher_a', email: 't@school-a.edu', email_verified: true, institutionId: 'inst_a', role: 'TEACHER' },
    targetPath: '/users/student_1/private/info',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'request.auth.uid == userId'
  },
  {
    id: 'DD-08',
    name: 'Student Reading Peer Activity',
    collection: 'activities',
    operation: 'get',
    actor: { uid: 'student_a', email: 'sa@school-a.edu', email_verified: true, institutionId: 'inst_a', role: 'STUDENT' },
    targetPath: '/activities/act_belonging_to_student_b',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isStudentOwner(existing().studentOwnerUid)'
  },
  {
    id: 'DD-09',
    name: 'Student Forging Teacher Review on Assessment Result',
    collection: 'assessmentResults',
    operation: 'update',
    actor: { uid: 'student_a', email: 'sa@school-a.edu', email_verified: true, institutionId: 'inst_a', role: 'STUDENT' },
    targetPath: '/assessmentResults/res_1',
    payload: { score: 100, percentage: 100, teacherReviewed: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isInstitutionStaff(existing().institutionId)'
  },
  {
    id: 'DD-10',
    name: 'Audit Log Update / Tampering Attempt',
    collection: 'auditLogs',
    operation: 'update',
    actor: { uid: 'admin_a', email: 'admin@school-a.edu', email_verified: true, institutionId: 'inst_a', role: 'ADMIN' },
    targetPath: '/auditLogs/log_1',
    payload: { summary: 'Altered summary' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'allow update, delete: if false;'
  },
  {
    id: 'DD-11',
    name: 'Unbounded Array & Long String Payload Exhaustion',
    collection: 'students',
    operation: 'create',
    actor: { uid: 'teacher_a', email: 't@school-a.edu', email_verified: true, institutionId: 'inst_a', role: 'TEACHER' },
    targetPath: '/students/stu_huge',
    payload: {
      displayName: 'X'.repeat(5000),
      subjectIds: Array.from({ length: 100 }, (_, i) => `sub_${i}`)
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'data.displayName.size() <= 120 && data.subjectIds.size() <= 20'
  },
  {
    id: 'DD-12',
    name: 'Type Poisoning on Whitelisted Activity Status Update',
    collection: 'activities',
    operation: 'update',
    actor: { uid: 'student_a', email: 'sa@school-a.edu', email_verified: true, institutionId: 'inst_a', role: 'STUDENT' },
    targetPath: '/activities/act_1',
    payload: { status: 'HACKED_STATE', scorePercentage: 999 },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidLearningActivity(incoming())'
  }
];
