import React, { useMemo, useState } from 'react';
import { BookOpenCheck, CheckCircle2, ClipboardCheck, Sparkles, Wand2 } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { generatePedagogicalMaterial } from '../../services/aiApiService';
import { ActivityType, DifficultyLevel, LearningActivity, QuestionItem } from '../../types/domain';
import {
  labelActivityStatus,
  labelActivityType,
  labelDifficulty,
  labelEngineSource,
} from '../../utils/labels';

export const ActivitiesAssessmentsModule: React.FC = () => {
  const {
    dataset,
    mode,
    effectiveRole,
    submitActivityAttempt,
    createAssignedActivity,
    markAssessmentReviewed,
    engineProcessing,
  } = useWorkspace();

  const [tab, setTab] = useState<'ACTIVITIES' | 'GENERATOR' | 'REVIEWS'>('ACTIVITIES');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'COMPLETED'>('ALL');
  const [activeActivity, setActiveActivity] = useState<LearningActivity | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    scorePercentage: number;
    feedback: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // AI Content Generator state
  const [genStudentId, setGenStudentId] = useState<string>(dataset.students[0]?.id || '');
  const [genSubjectId, setGenSubjectId] = useState<string>(dataset.subjects[0]?.id || '');
  const [genCompId, setGenCompId] = useState<string>(dataset.competencies[0]?.id || '');
  const [genDifficulty, setGenDifficulty] = useState<DifficultyLevel>('Foundational');
  const [genMaterialType, setGenMaterialType] = useState<
    | 'Simplified Explanation'
    | 'Worked Examples'
    | 'Practice Exercises'
    | 'Revision Quiz'
    | 'Summary'
    | 'Study Plan'
  >('Practice Exercises');
  const [genObjective, setGenObjective] = useState(
    'Desenvolver precisão passo a passo e hábitos de autoverificação'
  );
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generatedPreview, setGeneratedPreview] = useState<{
    origin: string;
    title: string;
    summary: string;
    sections: { heading: string; body: string }[];
    questions: QuestionItem[];
  } | null>(null);

  const filteredActivities = useMemo(() => {
    return dataset.activities.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      return true;
    });
  }, [dataset.activities, statusFilter]);

  const subjectCompetencies = useMemo(
    () =>
      dataset.competencies.filter(
        (c) => !genSubjectId || c.subjectId === genSubjectId
      ),
    [dataset.competencies, genSubjectId]
  );

  const openActivityRunner = (act: LearningActivity) => {
    setActiveActivity(act);
    setAnswers({});
    setSubmissionFeedback(
      act.status === 'COMPLETED'
        ? {
            scorePercentage: act.scorePercentage ?? 0,
            feedback: act.feedbackSummary || 'Concluída.',
          }
        : null
    );
  };

  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeActivity) return;
    setSubmitting(true);
    try {
      const res = await submitActivityAttempt(activeActivity.id, answers);
      setSubmissionFeedback(res);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    const subject = dataset.subjects.find((s) => s.id === genSubjectId) || dataset.subjects[0];
    const comp =
      dataset.competencies.find((c) => c.id === genCompId) ||
      subjectCompetencies[0] ||
      dataset.competencies[0];
    const student = dataset.students.find((s) => s.id === genStudentId) || dataset.students[0];

    if (!subject || !comp) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await generatePedagogicalMaterial({
        gradeLevel: student?.gradeLevel || comp.gradeLevel || '8º Ano',
        subjectName: subject.name,
        competencyCode: comp.code,
        competencyName: comp.name,
        difficulty: genDifficulty,
        materialType: genMaterialType,
        pedagogicalObjective: genObjective,
        demoMode: mode === 'DEMO',
      });
      setGeneratedPreview({
        origin: res.origin,
        ...res.material,
      });
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Não foi possível gerar o material.');
    } finally {
      setGenerating(false);
    }
  };

  const handleAssignGenerated = async () => {
    if (!generatedPreview) return;
    const targetStudentId = genStudentId || dataset.students[0]?.id;
    const targetSubjectId = genSubjectId || dataset.subjects[0]?.id;
    const targetCompId = genCompId || subjectCompetencies[0]?.id || dataset.competencies[0]?.id;
    if (!targetStudentId || !targetSubjectId || !targetCompId) return;

    const activityType: ActivityType =
      genMaterialType === 'Revision Quiz' ? 'Revision Quiz' : 'Practice Exercises';

    await createAssignedActivity({
      studentId: targetStudentId,
      subjectId: targetSubjectId,
      competencyId: targetCompId,
      title: generatedPreview.title,
      type: activityType,
      difficulty: genDifficulty,
      origin: 'AI_AUTONOMOUS',
      questions: generatedPreview.questions,
    });
    setGeneratedPreview(null);
    setTab('ACTIVITIES');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Prática Alinhada a Competências · Correção Objetiva Automática e Feedback Formativo por IA
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Atividades e Avaliações
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Realize atividades atribuídas (acionando automaticamente o Motor de Aprendizagem Autônoma), gere materiais personalizados e revise avaliações de alto impacto.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setTab('ACTIVITIES')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'ACTIVITIES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Atividades ({dataset.activities.length})
          </button>
          {effectiveRole !== 'STUDENT' && (
            <>
              <button
                type="button"
                onClick={() => setTab('GENERATOR')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  tab === 'GENERATOR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Estúdio de Conteúdo IA
              </button>
              <button
                type="button"
                onClick={() => setTab('REVIEWS')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  tab === 'REVIEWS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Fila de Revisão Docente
              </button>
            </>
          )}
        </div>
      </div>

      {/* ABA 1: Lista Interativa e Executor de Atividades */}
      {tab === 'ACTIVITIES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Atividades Atribuídas e Concluídas</h2>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['ALL', 'ASSIGNED', 'COMPLETED'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 text-xs font-medium rounded ${
                      statusFilter === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {st === 'ALL' ? 'TODAS' : st === 'ASSIGNED' ? 'ATRIBUÍDAS' : 'CONCLUÍDAS'}
                  </button>
                ))}
              </div>
            </div>

            {filteredActivities.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                Nenhuma atividade corresponde a este filtro.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
                {filteredActivities.map((act) => {
                  const stu = dataset.students.find((s) => s.id === act.studentId);
                  const sub = dataset.subjects.find((s) => s.id === act.subjectId);
                  const comp = dataset.competencies.find((c) => c.id === act.competencyId);
                  const selected = activeActivity?.id === act.id;

                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => openActivityRunner(act)}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-900 border-slate-200 hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={selected ? 'text-sky-300 font-mono' : 'text-sky-700 font-mono'}>
                          {act.origin === 'AI_AUTONOMOUS' ? 'GERADA PELA IA' : 'DOCENTE'} · {comp?.code || act.competencyId}
                        </span>
                        <span
                          className={`font-semibold ${
                            act.status === 'COMPLETED'
                              ? selected
                                ? 'text-emerald-300'
                                : 'text-emerald-700'
                              : selected
                                ? 'text-amber-300'
                                : 'text-amber-700'
                          }`}
                        >
                          {act.status === 'COMPLETED' ? `${act.scorePercentage ?? 0}% CONCLUÍDA` : labelActivityStatus(act.status)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold mt-1">{act.title}</p>
                      <p className={`text-xs mt-1 ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {stu?.displayName || act.studentId} · {sub?.name} · {labelDifficulty(act.difficulty)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Espaço Interativo de Execução */}
          <div className="lg:col-span-7">
            {!activeActivity ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <BookOpenCheck className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-900">Selecione uma Atividade para Abrir</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  Abrir e enviar qualquer atividade atribuída registra automaticamente a nota, entrega feedback formativo imediato e aciona o Motor de Aprendizagem Autônoma.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmitActivity}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
              >
                <div className="pb-4 border-b border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {labelActivityType(activeActivity.type)} · {labelDifficulty(activeActivity.difficulty)} · {activeActivity.questions.length} itens
                    </span>
                    <span className="font-mono">
                      {activeActivity.origin === 'AI_AUTONOMOUS'
                        ? 'IA AUTÔNOMA'
                        : 'DOCENTE'}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">{activeActivity.title}</h2>
                  {activeActivity.feedbackSummary && activeActivity.status !== 'COMPLETED' && (
                    <p className="text-xs text-slate-600 mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="font-semibold text-slate-800">Contexto da Aula Guiada: </span>
                      {activeActivity.feedbackSummary}
                    </p>
                  )}
                </div>

                {submissionFeedback && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      Atividade Avaliada · Nota: {submissionFeedback.scorePercentage}%
                    </div>
                    <p className="text-xs text-emerald-900 mt-1.5 leading-relaxed">
                      {submissionFeedback.feedback}
                    </p>
                  </div>
                )}

                <div className="space-y-5">
                  {activeActivity.questions.map((q, idx) => {
                    const prevSubmitted = activeActivity.submittedAnswers?.find(
                      (sa) => sa.questionId === q.id
                    );
                    const isCompleted = activeActivity.status === 'COMPLETED';

                    return (
                      <div key={q.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium text-slate-900">
                          {idx + 1}. {q.prompt}
                        </p>

                        {q.questionType === 'short_answer' ? (
                          <textarea
                            rows={2}
                            disabled={isCompleted}
                            required
                            value={isCompleted ? prevSubmitted?.answer || '' : answers[q.id] || ''}
                            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                            placeholder="Escreva sua justificativa em 1 ou 2 frases..."
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-50"
                          />
                        ) : (
                          <div className="space-y-2">
                            {(q.options || ['Verdadeiro', 'Falso']).map((opt) => {
                              const currentVal = isCompleted
                                ? prevSubmitted?.answer
                                : answers[q.id];
                              return (
                                <label
                                  key={opt}
                                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm cursor-pointer ${
                                    currentVal === opt
                                      ? 'border-sky-600 bg-sky-50 text-slate-900'
                                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`q_${q.id}`}
                                    disabled={isCompleted}
                                    required
                                    checked={currentVal === opt}
                                    onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                                  />
                                  <span>{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {isCompleted && (
                          <div className="text-xs pt-2 border-t border-slate-100">
                            <span
                              className={`font-semibold ${
                                prevSubmitted?.isCorrect ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {prevSubmitted?.isCorrect ? 'Correta' : 'Revisão Recomendada'}
                            </span>
                            <span className="text-slate-600 ml-2">
                              {prevSubmitted?.feedback || q.explanation}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {activeActivity.status !== 'COMPLETED' && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-500">
                      O envio aciona automaticamente o Motor de Aprendizagem Autônoma.
                    </span>
                    <button
                      type="submit"
                      disabled={submitting || engineProcessing}
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
                    >
                      {submitting || engineProcessing ? 'Avaliando e Adaptando...' : 'Enviar Respostas'}
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: Estúdio de Geração de Conteúdo IA */}
      {tab === 'GENERATOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleGenerateContent}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-sky-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Gerador de Conteúdo Alinhado a Competências
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              Cria explicações validadas, exemplos resolvidos, exercícios práticos ou quizzes ajustados à série e competência do estudante.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Estudante Destinatário</label>
              <select
                value={genStudentId}
                onChange={(e) => setGenStudentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {dataset.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.pseudonymId} · {s.displayName} ({s.gradeLevel})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Disciplina</label>
                <select
                  value={genSubjectId}
                  onChange={(e) => {
                    setGenSubjectId(e.target.value);
                    const firstComp = dataset.competencies.find((c) => c.subjectId === e.target.value);
                    if (firstComp) setGenCompId(firstComp.id);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {dataset.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Dificuldade</label>
                <select
                  value={genDifficulty}
                  onChange={(e) => setGenDifficulty(e.target.value as DifficultyLevel)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Foundational">Básico</option>
                  <option value="Intermediate">Intermediário</option>
                  <option value="Advanced">Avançado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Competência</label>
              <select
                value={genCompId}
                onChange={(e) => setGenCompId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {subjectCompetencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de Material</label>
              <select
                value={genMaterialType}
                onChange={(e) => setGenMaterialType(e.target.value as typeof genMaterialType)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="Simplified Explanation">Explicação Simplificada</option>
                <option value="Worked Examples">Exemplos Resolvidos</option>
                <option value="Practice Exercises">Exercícios Práticos</option>
                <option value="Revision Quiz">Quiz de Revisão</option>
                <option value="Summary">Resumo</option>
                <option value="Study Plan">Plano de Estudos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Objetivo Pedagógico</label>
              <textarea
                rows={2}
                required
                value={genObjective}
                onChange={(e) => setGenObjective(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            {genError && <p className="text-xs text-red-700 font-medium">{genError}</p>}

            <button
              type="submit"
              disabled={generating}
              className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60"
            >
              {generating ? 'Gerando Material Estruturado...' : 'Gerar Material'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            {!generatedPreview ? (
              <div className="py-16 text-center">
                <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">
                  O conteúdo educacional gerado aparecerá aqui para revisão antes da atribuição.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-mono text-sky-700">
                      Origem:{' '}
                      {generatedPreview.origin === 'GEMINI'
                        ? labelEngineSource('GEMINI')
                        : generatedPreview.origin === 'DEMO_RULES'
                          ? labelEngineSource('DEMO_RULES')
                          : generatedPreview.origin}{' '}
                      · Esquema Validado
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                      {generatedPreview.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAssignGenerated}
                    className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 rounded-lg hover:bg-sky-800 whitespace-nowrap"
                  >
                    Atribuir ao Estudante
                  </button>
                </div>

                <p className="text-sm text-slate-700">{generatedPreview.summary}</p>

                <div className="space-y-3">
                  {generatedPreview.sections.map((sec, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-slate-900">{sec.heading}</h4>
                      <p className="text-xs text-slate-700 mt-1 leading-relaxed">{sec.body}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Questões Geradas ({generatedPreview.questions.length})
                  </h4>
                  {generatedPreview.questions.map((q, i) => (
                    <div key={q.id} className="border border-slate-200 rounded-lg p-3.5 text-xs space-y-1">
                      <p className="font-semibold text-slate-900">
                        {i + 1}. {q.prompt}
                      </p>
                      <p className="text-emerald-700 font-medium">Gabarito: {q.correctAnswer}</p>
                      <p className="text-slate-600">Explicação: {q.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: Fila de Revisão Docente para Resultados Oficiais */}
      {tab === 'REVIEWS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-sky-700" />
                Resultados de Avaliação e Salvaguarda de Revisão Humana
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                A IA oferece apenas feedback formativo preliminar; notas oficiais e decisões acadêmicas de alto impacto permanecem sob autoridade docente.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Estudante</th>
                  <th className="py-3 px-4">Competência</th>
                  <th className="py-3 px-4 text-right">Nota</th>
                  <th className="py-3 px-4">Feedback Preliminar</th>
                  <th className="py-3 px-4">Status da Revisão</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {dataset.assessmentResults.slice(0, 25).map((res) => {
                  const stu = dataset.students.find((s) => s.id === res.studentId);
                  const comp = dataset.competencies.find((c) => c.id === res.competencyId);
                  return (
                    <tr key={res.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {stu?.displayName || res.studentId}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-mono text-slate-600">
                        {comp?.code || res.competencyId}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                        {res.percentage}%
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 max-w-md truncate">
                        {res.aiPreliminaryFeedback || 'Correção objetiva automática'}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-semibold">
                        <span className={res.teacherReviewed ? 'text-emerald-700' : 'text-amber-700'}>
                          {res.teacherReviewed ? 'REVISADO PELO DOCENTE' : 'REVISÃO PENDENTE'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => markAssessmentReviewed(res.id, !res.teacherReviewed)}
                          className="text-xs font-medium text-sky-700 hover:underline"
                        >
                          {res.teacherReviewed ? 'Reabrir' : 'Confirmar Revisão'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
