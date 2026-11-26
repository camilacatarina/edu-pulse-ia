# Segurança, Privacidade e Proteção de Dados de Menores

## 1. Princípios de Privacidade para Dados de Estudantes

- **Minimização de Dados e Pseudonimização**: Os modelos de IA recebem tokens `pseudonymId` (ex.: `STU-D001`) em vez de nomes ou e-mails de estudantes.
- **Isolamento de Dados Pessoais (PII)**: Endereços de e-mail são armazenados exclusivamente em `/users/{userId}/private/info`, acessíveis somente ao próprio usuário autenticado ou ao administrador da plataforma.
- **Supervisão Humana para Decisões de Alto Impacto**: A IA não pode finalizar notas oficiais, aplicar medidas disciplinares, emitir diagnósticos clínicos/psicológicos nem excluir estudantes de oportunidades educacionais.
- **Governança de Consentimento e Retenção**: `consentRecords` registram o status de autorização dos responsáveis (`VERIFIED`, `PENDING`, `REVOKED`), sinalizadores de minimização de dados e janelas configuráveis de retenção institucional.

## 2. Blindagem das Regras de Segurança do Firestore

`firestore.rules` é validado com `@firebase/eslint-plugin-security-rules` e auditado contra a suíte adversarial Dirty Dozen (`firestore.rules.test.ts`):
- Regra padrão de negação total (`default-deny`) na raiz.
- Validação `isValidId()` em operações de documento único.
- Lista restritiva estrita de chaves (`hasAll` + `hasOnly` na criação; `affectedKeys().hasOnly()` na atualização).
- Verificação de e-mail validado (`request.auth.token.email_verified == true`) em todas as escritas autenticadas.
- Coleção `auditLogs` imutável (`allow update, delete: if false;`).
- Zero chamadas `get()`/`exists()` dentro de regras `allow list`.

## 3. Gestão de Segredos

- `GEMINI_API_KEY` e a variável opcional `INTERNAL_CRON_SECRET` residem estritamente no backend Node.js (`process.env`).
- Nenhuma chave secreta é versionada no Git ou empacotada nos arquivos do frontend.

