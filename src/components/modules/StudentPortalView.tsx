import React, { useMemo, useState } from 'react';
import { Award, BookOpen, CheckCircle2, Compass, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { LearningActivity } from '../../types/domain';
import {
  labelActivityType,
  labelDifficulty,
  labelModuleStatus,
  labelPedagogicalStatus,
} from '../../utils/labels';

export const StudentPortalView: React.FC = () => {
  const {
    dataset,
    mode,
    activeStudentId,
    setActiveStudentId,
    submitActivityAttempt,
    engineProcessing,
  } = useWorkspace();

  const student = useMemo(() => {
    if (activeStudentId) {
      const found = dataset.students.find((s) => s.id === activeStudentId);
      if (found) return found;
    }
    return dataset.students[0] || null;
  }, [dataset.students, activeStudentId]);

  const [selectedActivity, setSelectedActivity] = useState<LearningActivity | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  if (!student) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-900">Seu Espaço de Aprendizagem Está Pronto</h2>
        <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
          Peça ao seu professor para vincular o UID da sua conta ao seu perfil de estudante para que suas atividades personalizadas e trilha apareçam aqui.
        </p>
      </div>
    );
  }

  const myActivities = dataset.activities.filter((a) => a.studentId === student.id);
  const myPending = myActivities.filter((a) => a.status !== 'COMPLETED');
  const myCompleted = myActivities.filter((a) => a.status === 'COMPLETED');
  const myPaths = dataset.learningPaths.filter((p) => p.studentId === student.id);
  const myRecommendations = dataset.aiInsights.filter((i) => i.studentId === student.id);

  const handleOpenActivity = (act: LearningActivity) => {
    setSelectedActivity(act);
    setAnswers({});
    setFeedbackBanner(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;
    const res = await submitActivityAttempt(selectedActivity.id, answers);
    setFeedbackBanner(
      `Nota: ${res.scorePercentage}% — ${res.feedback} Sua trilha de aprendizagem foi atualizada automaticamente.`
    );
    setSelectedActivity(null);
  };

  return (
    <div className="space-y-8">
      {/* Cabeçalho Acolhedor */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-sky-700">
            Espaço Pessoal de Aprendizagem {mode === 'DEMO' ? '· DADOS DEMO' : ''}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Bem-vindo(a) de volta, {student.displayName}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Cada exercício concluído ajuda o EduPulse a adaptar seus próximos passos no seu próprio ritmo.
          </p>
        </div>

        {mode === 'DEMO' && (
          <div className="shrink-0">
            <label className="block text-xs text-slate-500 mb-1">Pré-visualizar Conta de Estudante</label>
            <select
              value={student.id}
              onChange={(e) => setActiveStudentId(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg"
            >
              {dataset.students.slice(0, 12).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} ({s.pseudonymId})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {feedbackBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-900">
          {feedbackBanner}
        </div>
      )}

      {/* Faixa de Progresso */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Meu Progresso</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {student.averageScore}%
          </p>
          <p className="text-xs text-sky-700 font-medium mt-1">
            Etapa atual: {labelPedagogicalStatus(student.pedagogicalStatus)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Atividades Concluídas</p>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">
            {myCompleted.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {myPending.length} prontas para você explorar
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Próximo Objetivo</p>
          <p className="text-sm font-semibold text-slate-900 mt-2">
            {myPaths[0]?.educationalObjective || 'Conclua sua próxima prática guiada'}
          </p>
        </div>
      </section>

      {/* Executor de Atividade Ativa */}
      {selectedActivity && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-sky-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-medium text-sky-700">
                {labelActivityType(selectedActivity.type)} · {labelDifficulty(selectedActivity.difficulty)}
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">{selectedActivity.title}</h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedActivity(null)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Fechar
            </button>
          </div>

          {selectedActivity.feedbackSummary && (
            <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">
              {selectedActivity.feedbackSummary}
            </p>
          )}

          <div className="space-y-4">
            {selectedActivity.questions.map((q, idx) => (
              <div key={q.id} className="border border-slate-200 rounded-lg p-4 space-y-2.5">
                <p className="text-sm font-medium text-slate-900">
                  {idx + 1}. {q.prompt}
                </p>
                {q.questionType === 'short_answer' ? (
                  <textarea
                    rows={2}
                    required
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder="Compartilhe seu raciocínio..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                ) : (
                  <div className="space-y-2">
                    {(q.options || ['Verdadeiro', 'Falso']).map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={`stu_q_${q.id}`}
                          required
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={engineProcessing}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60"
          >
            {engineProcessing ? 'Verificando e Atualizando Sua Trilha...' : 'Enviar Atividade'}
          </button>
        </form>
      )}

      {/* Divisão Principal: Minhas Atividades + Minha Trilha de Aprendizagem */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-700" />
            <h2 className="text-base font-semibold text-slate-900">Minhas Atividades</h2>
          </div>

          {myPending.length === 0 ? (
            <p className="text-sm text-slate-500">
              Você concluiu todas as atividades atribuídas no momento. Excelente ritmo!
            </p>
          ) : (
            <div className="space-y-3">
              {myPending.map((act) => (
                <div
                  key={act.id}
                  className="border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{act.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {labelActivityType(act.type)} · {labelDifficulty(act.difficulty)} · {act.questions.length} questões
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenActivity(act)}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shrink-0"
                  >
                    Iniciar
                  </button>
                </div>
              ))}
            </div>
          )}

          {myCompleted.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Concluídas e Feedback Formativo
              </h3>
              {myCompleted.map((act) => (
                <div key={act.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {act.title}
                    </span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {act.scorePercentage ?? 0}%
                    </span>
                  </div>
                  {act.feedbackSummary && (
                    <p className="text-slate-600 mt-1">{act.feedbackSummary}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-sky-700" />
            <h2 className="text-base font-semibold text-slate-900">Minha Trilha de Aprendizagem e Aulas Recomendadas</h2>
          </div>

          {myPaths.length === 0 ? (
            <p className="text-sm text-slate-500">
              Conclua uma atividade ao lado para gerar sua trilha personalizada passo a passo.
            </p>
          ) : (
            <div className="space-y-4">
              {myPaths.map((path) => (
                <div key={path.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">{path.title}</h3>
                    <span className="text-xs font-mono font-semibold text-sky-700">
                      {path.progressPercent}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{path.educationalObjective}</p>
                  <div className="space-y-2">
                    {path.modules.map((mod) => (
                      <div key={mod.order} className="flex items-start justify-between gap-2 text-xs py-1.5 border-t border-slate-100">
                        <div>
                          <p className="font-medium text-slate-800">
                            {mod.order}. {mod.title}
                          </p>
                          <p className="text-slate-500 mt-0.5">{mod.shortLesson}</p>
                        </div>
                        <span
                          className={`font-semibold shrink-0 ${
                            mod.status === 'COMPLETED'
                              ? 'text-emerald-700'
                              : mod.status === 'IN_PROGRESS'
                                ? 'text-sky-700'
                                : 'text-slate-400'
                          }`}
                        >
                          {labelModuleStatus(mod.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {myRecommendations.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-sky-700" />
                Próximo Foco Recomendado
              </h3>
              {myRecommendations.slice(0, 2).map((rec) => (
                <div key={rec.id} className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-slate-800">
                  <p className="font-semibold text-sky-900">{rec.learningObjective}</p>
                  <p className="mt-1 text-slate-700">{rec.strategyChosen}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
