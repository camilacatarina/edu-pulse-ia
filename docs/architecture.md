# EduPulse AI — Arquitetura do Sistema

## 1. Separação em Camadas

O EduPulse AI separa apresentação de interface, tipos de domínio, repositórios de persistência e orquestração de IA no servidor:

- `src/types/domain.ts` — Interfaces TypeScript canônicas e limites volumétricos sincronizados com `firebase-blueprint.json`.
- `src/lib/firebase.ts` — Inicialização do SDK cliente do Firebase (`db` vinculado a `firestoreDatabaseId`, `auth`), validação inicial de conexão (`testFirestoreConnection`) e diagnóstico estruturado `handleFirestoreError`.
- `src/services/firestoreRepository.ts` — Consultas ao Firestore isoladas por instituição (`where('institutionId', '==', ...)` + escopo por `staffUids` / `studentOwnerUid`) e persistência atômica via `writeBatch`.
- `src/services/demoDataService.ts` — Gerador sintético determinístico (`5` turmas, `60` estudantes, `5` disciplinas, `10` competências) claramente rotulado como `DADOS DEMO`.
- `src/server/geminiClient.ts` — Wrapper exclusivo do servidor para `@google/genai` utilizando `gemini-4-hydrogen` com backoff exponencial e cabeçalho `'User-Agent': 'aistudio-build'`.
- `src/server/autonomousEngine.ts` — O `AutonomousLearningEngine`, responsável por avaliação idempotente de eventos, validação por esquema Zod e salvaguardas pedagógicas.
- `server.ts` — Servidor Express + Vite expondo os endpoints REST (`/api/health`, `/api/autonomous-engine/process-event`, `/api/internal/learning-cycle`, `/api/ai/generate-content`, `/api/ai/evaluate-open-response`).

## 2. Isolamento Multi-Instituição

Cada documento de coleção carrega `institutionId` e `staffUids` (além de `studentOwnerUid` em entidades visíveis ao estudante). As regras `firestore.rules` garantem que:
- Educadores (`ADMIN`, `TEACHER`) só leem e escrevem documentos pertencentes à sua instituição (`request.auth.uid in resource.data.staffUids`).
- Estudantes (`STUDENT`) só leem e atualizam seus próprios registros (`resource.data.studentOwnerUid == request.auth.uid`).
- Consultas entre instituições distintas são bloqueadas diretamente na camada de regras do Firestore.

