# EduPulse AI — Plataforma Autônoma de Inteligência Educacional

> **O futuro da educação personalizada.**

O EduPulse AI é uma plataforma SaaS EdTech full-stack impulsionada por um **Motor de Aprendizagem Autônoma** (`AutonomousLearningEngine`) orientado a eventos. Em vez de exigir que docentes abram um chatbot ou acionem análises manualmente, o EduPulse acompanha continuamente resultados de avaliações e atividades, identifica lacunas de competência, escolhe estratégias pedagógicas, gera atividades de reforço sob medida, cria intervenções e adapta trilhas individuais automaticamente.

---

## Problema Educacional e Proposta de Valor

Educadores gerenciam dezenas de estudantes em múltiplas turmas e não conseguem diagnosticar cada lacuna emergente em tempo real. O EduPulse AI resolve esse desafio por meio de um ciclo pedagógico fechado e contínuo:

`DADOS -> ANÁLISE -> DECISÃO -> CONTEÚDO -> INTERVENÇÃO -> RESULTADO -> NOVA ANÁLISE`

- **Autonomia Proativa**: Concluir uma atividade ou enviar uma avaliação aciona imediatamente o `AutonomousLearningEngine`.
- **Autoridade Docente Preservada**: Ações pedagógicas de baixo risco (exercícios práticos, microaulas, sequenciamento de trilhas) operam de forma autônoma, enquanto notas oficiais e decisões de alto impacto permanecem sob revisão humana do professor.
- **Privacidade desde a Concepção**: Dados pessoais identificáveis (nomes, e-mails, documentos) nunca são enviados ao Gemini; apenas identificadores pseudonimizados (`pseudonymId`) e indicadores pedagógicos trafegam na API.

---

## Principais Módulos da Plataforma

1. **Visão Geral**: KPIs executivos, 5 visualizações longitudinais e comparativas com Recharts e o feed em tempo real `ATIVIDADE DA IA`.
2. **Estudantes e Turmas**: Gestão de turmas, disciplinas, competências e matrículas, além de **Perfis Individuais de Estudantes** (`Visão Geral de Desempenho`, `Evolução por Disciplina`, `Mapa de Competências`, `Jornada de Aprendizagem`, `Recomendações da IA`).
3. **Central de Inteligência IA**: Status em tempo real (`STATUS DO MOTOR DE IA: ATIVO`), fluxo de eventos processados, diagnósticos pedagógicos estruturados, calibração de confiança e verificação de lote em `POST /api/internal/learning-cycle`.
4. **Trilhas de Aprendizagem**: Módulos sequenciados e alinhados a competências (`Fundamentos -> Operações Inversas -> Prática Guiada -> Consolidação`) com critérios de domínio e datas de revisão.
5. **Atividades e Avaliações**: Executor interativo (Múltipla Escolha, Verdadeiro/Falso, Resposta Discursiva), **Estúdio de Conteúdo IA** e **Fila de Revisão Docente**.
6. **Intervenções**: Rastreamento completo de ciclo de vida (`Criada`, `Atribuída`, `Em Andamento`, `Concluída`, `Reavaliação Necessária`) com exercícios vinculados e resultados.
7. **Relatórios e Insights**: Filtros institucionais (Turma, Disciplina, Período), exportação em CSV e impressão executiva.
8. **Configurações e Portal do Estudante**: Isolamento por instituição, governança de consentimento de responsáveis, retenção de dados e um Portal do Estudante simplificado e acolhedor.

---

## Arquitetura e Stack Tecnológico

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Recharts, Lucide React
- **Backend**: Node.js, Express, TypeScript, validação Zod
- **Motor de IA**: Google Gemini (`gemini-4-hydrogen`) via SDK oficial `@google/genai` no servidor
- **Banco e Autenticação**: Cloud Firestore e Firebase Authentication (Google Sign-In) com isolamento multi-instituição

---

## Modo Demo vs. Modo Ao Vivo

- **Modo Demo (`DADOS DEMO`)**: Inicia imediatamente com 5 turmas, 60 estudantes sintéticos determinísticos, 5 disciplinas, 10 competências, histórico de avaliações, trilhas de aprendizagem e intervenções. Clique em **`EXECUTAR CICLO AUTÔNOMO DEMO`** para acompanhar o ciclo autônomo completo de ponta a ponta. Caso a cota gratuita do Gemini esteja esgotada ou sem chave configurada no modo Demo, o sistema executa de forma transparente o motor `DEMO_RULES` e sinaliza a origem.
- **Modo Ao Vivo**: Faça login com o Google para criar ou ingressar em um ambiente institucional isolado no Cloud Firestore protegido por `firestore.rules`.

---

## Executando Localmente

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Configure as variáveis de ambiente com base em `.env.example` (`GEMINI_API_KEY` apenas no servidor; nunca exponha chaves no frontend).
3. Inicie o servidor full-stack na porta `3000`:
   ```bash
   npm run dev
   ```
4. Compile para produção:
   ```bash
   npm run build
   npm start
   ```

Consulte `docs/architecture.md`, `docs/ai-workflow.md` e `docs/security.md` para detalhes técnicos completos.

