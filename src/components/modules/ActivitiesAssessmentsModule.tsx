import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { generatePedagogicalMaterial } from '../../services/aiApiService';
import { ActivityType, DifficultyLevel, LearningActivity, QuestionItem } from '../../types/domain';
import {
  labelActivityStatus,
  labelActivityType,
  labelDifficulty,
} from '../../utils/labels';
import {
  formatGradeTen,
  labelRiskShort,
  parseStructuredExamReview,
} from '../../utils/pedagogicalAnalytics';

export const ActivitiesAssessmentsModule: React.FC = () => {
  const {
    dataset,
    mode,
    effectiveRole,
    scopedStudentProfiles,
    submitActivityAttempt,
    createAssignedActivity,
    markAssessmentReviewed,
    recordExamGrade,
    runAutonomousAutoScan,
    engineProcessing,
  } = useWorkspace();

  const [tab, setTab] = useState<'REVIEWS' | 'ACTIVITIES' | 'GENERATOR'>(
    effectiveRole === 'STUDENT' ? 'ACTIVITIES' : 'REVIEWS'
  );
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'MAX_RISK' | 'PENDING_AI' | 'AI_DONE'>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'COMPLETED'>('ALL');
  const [activeActivity, setActiveActivity] = useState<LearningActivity | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    scorePercentage: number;
    feedback: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal Lançar Nota de Prova
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [gradeStudentId, setGradeStudentId] = useState(dataset.students[0]?.id || '');
  const [gradeSubjectId, setGradeSubjectId] = useState(dataset.subjects[0]?.id || '');
  const [gradeCompId, setGradeCompId] = useState(dataset.competencies[0]?.id || '');
  const [gradeTen, setGradeTen] = useState('5.0');
  const [savingGrade, setSavingGrade] = useState(false);

  // Gerador de Conteúdo IA
  const [genStudentId, setGenStudentId] = useState<string>(dataset.students[0]?.id || '');
  const [genSubjectId, setGenSubjectId] = useState<string>(dataset.subjects[0]?.id || '');
  const [genCompId, setGenCompId] = useState<string>(dataset.competencies[0]?.id || '');
  const [genDifficulty, setGenDifficulty] = useState<DifficultyLevel>('Intermediate');
  const [genMaterialType, setGenMaterialType] = useState<
    | 'Simplified Explanation'
    | 'Worked Examples'
    | 'Practice Exercises'
    | 'Revision Quiz'
    | 'Summary'
    | 'Study Plan'
  >('Practice Exercises');
  const [genObjective, setGenObjective] = useState(
    'Recuperar conteúdos críticos da última prova com questões estilo ENEM'
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

  const scopedStudentIds = useMemo(
    () => new Set(scopedStudentProfiles.map((p) => p.student.id)),
    [scopedStudentProfiles]
  );

  const filteredExamReviews = useMemo(() => {
    return [...dataset.assessmentResults]
      .filter((r) => scopedStudentIds.has(r.studentId))
      .filter((r) => subjectFilter === 'ALL' || r.subjectId === subjectFilter)
      .filter((r) => {
        const hasAiReview = Boolean(
          r.aiPreliminaryFeedback && r.aiPreliminaryFeedback.includes('Ponto Forte:')
        );
        const stuProfile = scopedStudentProfiles.find((p) => p.student.id === r.studentId);
        if (reviewFilter === 'MAX_RISK') {
          return stuProfile?.riskLevel === 'MAXIMUM' || r.percentage < 60;
        }
        if (reviewFilter === 'PENDING_AI') return !hasAiReview;
        if (reviewFilter === 'AI_DONE') return hasAiReview;
        return true;
      })
      .sort((a, b) => a.percentage - b.percentage || b.submittedAt.localeCompare(a.submittedAt));
  }, [dataset.assessmentResults, scopedStudentIds, scopedStudentProfiles, subjectFilter, reviewFilter]);

  const filteredActivities = useMemo(() => {
    return dataset.activities.filter((a) => {
      if (effectiveRole !== 'STUDENT' && !scopedStudentIds.has(a.studentId)) return false;
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      return true;
    });
  }, [dataset.activities, statusFilter, effectiveRole, scopedStudentIds]);

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

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(gradeTen.replace(',', '.'));
    if (Number.isNaN(numeric) || !gradeStudentId || !gradeSubjectId || !gradeCompId) return;
    setSavingGrade(true);
    try {
      await recordExamGrade({
        studentId: gradeStudentId,
        subjectId: gradeSubjectId,
        competencyId: gradeCompId,
        percentage: Math.min(100, Math.max(0, Math.round(numeric * 10))),
      });
      setShowGradeModal(false);
    } finally {
      setSavingGrade(false);
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
        gradeLevel: student?.gradeLevel || comp.gradeLevel || '1ª Série EM',
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Provas, Revisões da IA e Recuperação
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            A IA revisa as provas automaticamente, destaca onde cada aluno errou e cria listas de recuperação.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {effectiveRole !== 'STUDENT' && (
              <button
                type="button"
                onClick={() => setTab('REVIEWS')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  tab === 'REVIEWS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Revisões de Provas ({filteredExamReviews.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setTab('ACTIVITIES')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'ACTIVITIES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Recuperação ({filteredActivities.length})
            </button>
            {effectiveRole !== 'STUDENT' && (
              <button
                type="button"
                onClick={() => setTab('GENERATOR')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  tab === 'GENERATOR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Gerar Simulado
              </button>
            )}
          </div>

          {effectiveRole !== 'STUDENT' && (
            <button
              type="button"
              onClick={() => {
                setGradeStudentId(scopedStudentProfiles[0]?.student.id || dataset.students[0]?.id || '');
                setGradeSubjectId(dataset.subjects[0]?.id || '');
                const c = dataset.competencies.find((x) => x.subjectId === dataset.subjects[0]?.id);
                setGradeCompId(c?.id || dataset.competencies[0]?.id || '');
                setShowGradeModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Lançar Nota
            </button>
          )}
        </div>
      </div>

      {/* ABA 1: Revisões de Provas pela IA */}
      {tab === 'REVIEWS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              {(
                [
                  { id: 'ALL', label: 'Todas as Provas' },
                  { id: 'MAX_RISK', label: 'Notas Críticas (< 6,0)' },
                  { id: 'AI_DONE', label: 'Revisadas pela IA' },
                  { id: 'PENDING_AI', label: 'Aguardando IA' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setReviewFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                    reviewFilter === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg"
              >
                <option value="ALL">Todas as Matérias</option>
                {dataset.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={engineProcessing}
                onClick={() => runAutonomousAutoScan(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 disabled:opacity-60 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {engineProcessing ? 'Revisando...' : 'Revisar Próxima com IA'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredExamReviews.slice(0, 30).map((res) => {
              const stuProfile = scopedStudentProfiles.find((p) => p.student.id === res.studentId);
              const stu = stuProfile?.student || dataset.students.find((s) => s.id === res.studentId);
              const sub = dataset.subjects.find((s) => s.id === res.subjectId);
              const comp = dataset.competencies.find((c) => c.id === res.competencyId);
              const parsed = parseStructuredExamReview(res.aiPreliminaryFeedback);

              return (
                <article
                  key={res.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-900">
                          {stu?.displayName || res.studentId}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{stu?.gradeLevel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-sky-700">{sub?.name}</span>
                        {stuProfile?.riskLevel === 'MAXIMUM' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                              <AlertTriangle className="w-3 h-3" />
                              {labelRiskShort('MAXIMUM')}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 mt-1">
                        Prova: {comp?.name || 'Avaliação Bimestral'} ({comp?.code})
                      </h3>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p
                          className={`text-lg font-bold font-mono tabular-nums ${
                            res.percentage < 60
                              ? 'text-red-700'
                              : res.percentage < 70
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}
                        >
                          {formatGradeTen(res.percentage)}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">{res.percentage}%</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => markAssessmentReviewed(res.id, !res.teacherReviewed)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap ${
                          res.teacherReviewed
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {res.teacherReviewed ? 'Validada pelo Prof.' : 'Validar Revisão'}
                      </button>
                    </div>
                  </div>

                  {parsed ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-3">
                        <p className="font-semibold text-emerald-900">Onde o aluno foi bem</p>
                        <p className="text-emerald-800 mt-1 leading-relaxed">
                          {parsed.whatWentWell || 'Base conceitual inicial identificada.'}
                        </p>
                      </div>
                      <div className="bg-red-50/70 border border-red-200/80 rounded-lg p-3">
                        <p className="font-semibold text-red-900">Onde errou na prova</p>
                        <p className="text-red-800 mt-1 leading-relaxed">
                          {parsed.whereStruggled || 'Sem erros críticos apontados.'}
                        </p>
                      </div>
                      <div className="bg-sky-50/70 border border-sky-200/80 rounded-lg p-3">
                        <p className="font-semibold text-sky-900">Ação automática da IA</p>
                        <p className="text-sky-800 mt-1 leading-relaxed">
                          {parsed.recommendation || parsed.verdict}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-center justify-between gap-3">
                      <span>
                        Prova na fila automática — a IA produzirá a revisão comentada sem intervenção manual.
                      </span>
                      <ClipboardCheck className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                  )}
                </article>
              );
            })}

            {filteredExamReviews.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                Nenhuma prova encontrada com os filtros atuais.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: Lista e Execução de Atividades de Recuperação */}
      {tab === 'ACTIVITIES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Listas de Recuperação (IA)</span>
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
                    {st === 'ALL' ? 'Todas' : st === 'ASSIGNED' ? 'Pendentes' : 'Concluídas'}
                  </button>
                ))}
              </div>
            </div>

            {filteredActivities.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                Nenhuma atividade encontrada.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
                {filteredActivities.map((act) => {
                  const stu = dataset.students.find((s) => s.id === act.studentId);
                  const sub = dataset.subjects.find((s) => s.id === act.subjectId);
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
                        <span className={selected ? 'text-sky-300 font-medium' : 'text-sky-700 font-medium'}>
                          {sub?.name} · {act.origin === 'AI_AUTONOMOUS' ? 'Gerada pela IA' : 'Professor'}
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
                          {act.status === 'COMPLETED'
                            ? `${formatGradeTen(act.scorePercentage ?? 0)}`
                            : labelActivityStatus(act.status)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold mt-1">{act.title}</p>
                      <p className={`text-xs mt-1 ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {stu?.displayName || act.studentId} · {stu?.gradeLevel || ''} · {labelDifficulty(act.difficulty)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-7">
            {!activeActivity ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <BookOpenCheck className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-900">Selecione uma atividade</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  Cada atividade foi gerada automaticamente após a IA revisar provas com notas baixas.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmitActivity}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
              >
                <div className="pb-4 border-b border-slate-100">
                  <span className="text-xs text-slate-500">
                    {labelActivityType(activeActivity.type)} · {labelDifficulty(activeActivity.difficulty)}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">{activeActivity.title}</h2>
                  {activeActivity.feedbackSummary && activeActivity.status !== 'COMPLETED' && (
                    <p className="text-xs text-slate-600 mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      {activeActivity.feedbackSummary}
                    </p>
                  )}
                </div>

                {submissionFeedback && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      Nota: {formatGradeTen(submissionFeedback.scorePercentage)} ({submissionFeedback.scorePercentage}%)
                    </div>
                    <p className="text-xs text-emerald-900 mt-1">{submissionFeedback.feedback}</p>
                  </div>
                )}

                <div className="space-y-4">
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
                            placeholder="Escreva sua resposta em poucas linhas..."
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
                              {prevSubmitted?.isCorrect ? 'Correta' : 'Revisar'}
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
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submitting || engineProcessing}
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
                    >
                      {submitting || engineProcessing ? 'Corrigindo...' : 'Enviar Respostas'}
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: Gerador de Simulado com IA */}
      {tab === 'GENERATOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleGenerateContent}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-sky-700" />
              <h2 className="text-base font-semibold text-slate-900">Gerar Prova ou Recuperação com IA</h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Estudante</label>
              <select
                value={genStudentId}
                onChange={(e) => setGenStudentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {dataset.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} ({s.gradeLevel})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Matéria</label>
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
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nível</label>
                <select
                  value={genDifficulty}
                  onChange={(e) => setGenDifficulty(e.target.value as DifficultyLevel)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Foundational">Básico (Recuperação)</option>
                  <option value="Intermediate">Intermediário</option>
                  <option value="Advanced">Avançado (ENEM)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tema / Competência</label>
              <select
                value={genCompId}
                onChange={(e) => setGenCompId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {subjectCompetencies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Formato</label>
              <select
                value={genMaterialType}
                onChange={(e) => setGenMaterialType(e.target.value as typeof genMaterialType)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="Practice Exercises">Lista de Recuperação</option>
                <option value="Revision Quiz">Simulado de Revisão</option>
                <option value="Simplified Explanation">Resumo Comentado</option>
                <option value="Worked Examples">Exemplos Resolvidos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Objetivo</label>
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
              {generating ? 'Gerando...' : 'Gerar Material'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            {!generatedPreview ? (
              <div className="py-16 text-center">
                <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">
                  O material gerado aparecerá aqui para você revisar e enviar ao aluno.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900">{generatedPreview.title}</h3>
                  <button
                    type="button"
                    onClick={handleAssignGenerated}
                    className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 rounded-lg hover:bg-sky-800 whitespace-nowrap"
                  >
                    Enviar para o Aluno
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
                    Questões ({generatedPreview.questions.length})
                  </h4>
                  {generatedPreview.questions.map((q, i) => (
                    <div key={q.id} className="border border-slate-200 rounded-lg p-3.5 text-xs space-y-1">
                      <p className="font-semibold text-slate-900">{i + 1}. {q.prompt}</p>
                      <p className="text-emerald-700 font-medium">Gabarito: {q.correctAnswer}</p>
                      <p className="text-slate-600">{q.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Lançar Nota */}
      {showGradeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveGrade}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Lançar Nota de Prova</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                A IA revisa a prova automaticamente e recalcula o risco de reprovação ao salvar.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Aluno</label>
              <select
                value={gradeStudentId}
                onChange={(e) => setGradeStudentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {dataset.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} ({s.gradeLevel})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Matéria</label>
              <select
                value={gradeSubjectId}
                onChange={(e) => {
                  setGradeSubjectId(e.target.value);
                  const first = dataset.competencies.find((c) => c.subjectId === e.target.value);
                  if (first) setGradeCompId(first.id);
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
              <label className="block text-xs font-medium text-slate-700 mb-1">Competência / Prova</label>
              <select
                value={gradeCompId}
                onChange={(e) => setGradeCompId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {dataset.competencies
                  .filter((c) => c.subjectId === gradeSubjectId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nota (0,0 a 10,0)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                required
                value={gradeTen}
                onChange={(e) => setGradeTen(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGradeModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingGrade}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg"
              >
                {savingGrade ? 'Revisando com IA...' : 'Salvar e Revisar com IA'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
