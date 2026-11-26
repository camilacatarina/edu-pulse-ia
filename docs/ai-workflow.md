# Motor de Aprendizagem Autônoma e Fluxo de IA

## 1. Ciclo de Execução Orientado a Eventos

Quando um estudante conclui uma atividade ou envia uma avaliação, o sistema executa o seguinte fluxo autônomo:

1. **Criação de Evento**: Registra um `LearningEvent` (`AssessmentSubmitted` ou `ActivityCompleted`) com uma `idempotencyKey` determinística.
2. **Pseudonimização**: Remove todos os dados pessoais identificáveis (nomes, e-mails, documentos), encaminhando apenas `pseudonymId`, `gradeLevel`, `subjectName`, `competencyCode` e histórico longitudinal de notas para `POST /api/autonomous-engine/process-event`.
3. **Calibração Longitudinal de Evidências**: Avalia múltiplas observações recentes quando disponíveis e calcula uma pontuação calibrada de `confidence` e `uncertaintyNote`, evitando que uma única nota baixa gere rótulos definitivos negativos.
4. **Raciocínio Estruturado com Gemini**: Invoca `gemini-4-hydrogen` com restrições estritas de esquema JSON (`responseSchema`) para produzir:
   - `identifiedGap` e `pedagogicalDiagnosis`
   - `learningObjective` e `recommendedStrategy`
   - `generatedActivity` (Múltipla Escolha, Verdadeiro/Falso, Resposta Discursiva com gabarito e explicações)
   - `learningPathPlan` (módulos sequenciados e critério de domínio)
   - `interventionPlan` (quando critérios de reforço são atingidos)
5. **Validação de Salvaguardas e Esquema**: Analisa a saída com Zod e rejeita qualquer resposta que tente escalar permissões, impor exclusão punitiva ou emitir diagnósticos clínicos.
6. **Persistência Atômica**: Salva `AIInsight`, `LearningActivity`, `LearningPath`, `Intervention` (se necessário), `AuditLog` e marca o `LearningEvent` como `PROCESSED`.

## 2. Endpoint de Lote Agendado

`POST /api/internal/learning-cycle` recebe lotes de `LearningEvent` pendentes e os processa de forma idempotente, permitindo que agendadores externos (como Cloud Scheduler) executem ciclos periódicos sem exigir sessão ativa no navegador.

