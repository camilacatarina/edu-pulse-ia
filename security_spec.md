# EduPulse AI — Security Specification & Data Invariants

## 1. Core Data Invariants

1. **Institution Boundary Isolation**: Every academic, assessment, activity, learning path, intervention, event, AI insight, audit log, and consent document belongs to exactly one `institutionId`. Cross-institution read or write is strictly denied unless the user is the verified platform bootstrap administrator.
2. **Role & Staff Verification**:
   - `ADMIN` and `TEACHER` staff members are authorized via `staffUids` (bounded `<= 50` UIDs) on institution-scoped documents and verified against `/institutions/{institutionId}` on single-document operations.
   - `STUDENT` users can only read/list their own academic records (`studentOwnerUid == request.auth.uid`) and cannot access other students' records, peer assessment results, or institutional audit logs.
3. **Self-Assigned Privilege Escalation Prevention**: A user creating `/users/{userId}` can only set `uid == request.auth.uid`. Staff roles (`ADMIN`, `TEACHER`) require either being the owner of the referenced `/institutions/{institutionId}` (`ownerUid == request.auth.uid`), verified bootstrap admin (`camilacatarina2003@gmail.com` with `email_verified == true`), or an existing staff member. Unprivileged users joining without ownership default to `STUDENT`.
4. **PII Isolation**: User email addresses are stored exclusively in `/users/{userId}/private/{docId}` and readable/writable only by the user (`request.auth.uid == userId`) or verified platform admin. AI payloads use `pseudonymId` only.
5. **Immutable Audit & Provenance**: `auditLogs` are append-only (`allow update, delete: if false;`) and `createdAt` / `institutionId` fields are immutable across updates.
6. **Terminal State Protection**: Completed interventions (`status == 'COMPLETED'`) and processed learning events (`status == 'PROCESSED'`) cannot be reverted or modified by students.
7. **Input Volumetric Bounds**: All document IDs match `^[a-zA-Z0-9_-]+$` (`<= 128` chars), and all strings/arrays enforce explicit `.size()` upper bounds.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Cross-Tenant Institution Read (`classes`)**: Authenticated user from `inst_A` attempts `list` or `get` on `/classes/class_B` belonging to `inst_B` where `uid` is not in `staffUids`. -> **Expected: PERMISSION_DENIED**.
2. **Self-Escalation to ADMIN (`users`)**: User creates `/users/{uid}` claiming `role: "ADMIN"` on an existing institution they do not own. -> **Expected: PERMISSION_DENIED**.
3. **Role Mutation on Update (`users`)**: Student updates `/users/{uid}` with `{ role: "TEACHER" }` or `{ institutionId: "other_inst" }`. -> **Expected: PERMISSION_DENIED**.
4. **Shadow / Ghost Field Injection (`students`)**: Staff member attempts to create or update `/students/stu_1` with an undeclared field `isExemptFromAudit: true`. -> **Expected: PERMISSION_DENIED**.
5. **ID Poisoning (`activities`)**: Attacker sends a 1,500-character document ID or path traversal characters (`../admin`) to `/activities/{activityId}`. -> **Expected: PERMISSION_DENIED**.
6. **Email Spoofing (`institutions`)**: Token has `email: "camilacatarina2003@gmail.com"` but `email_verified: false`. -> **Expected: PERMISSION_DENIED**.
7. **PII Blanket Read (`users/{otherUid}/private/info`)**: A teacher or student tries to read another user's `/private/info` document containing email. -> **Expected: PERMISSION_DENIED**.
8. **Student Reading Peer Activity (`activities`)**: Student A (`uid_A`) queries `/activities` or gets `/activities/act_B` owned by Student B (`studentOwnerUid: "uid_B"`). -> **Expected: PERMISSION_DENIED**.
9. **Student Forging Teacher Review (`assessmentResults`)**: Student updates `/assessmentResults/res_1` trying to change `score` or `teacherReviewed: true`. -> **Expected: PERMISSION_DENIED**.
10. **Audit Log Tampering (`auditLogs`)**: Any user attempts `update` or `delete` on `/auditLogs/log_1`. -> **Expected: PERMISSION_DENIED**.
11. **Unbounded Array / Payload Exhaustion (`students`)**: Payload sends `subjectIds` array with 100 items or `displayName` with 5,000 chars. -> **Expected: PERMISSION_DENIED**.
12. **Type Poisoning on Whitelisted Update (`activities`)**: Student updates `status` on `/activities/act_1` with `{ status: 12345 }` or invalid enum `"HACKED"`. -> **Expected: PERMISSION_DENIED**.
