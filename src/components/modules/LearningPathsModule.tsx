import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Clock, Compass } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { labelEstimatedLevel, labelModuleStatus } from '../../utils/labels';

export const LearningPathsModule: React.FC = () => {
  const { dataset, mode, runAutonomousLearningDemo, engineProcessing } = useWorkspace();
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);

  const filteredPaths = useMemo(() => {
    return dataset.learningPaths.filter(
      (p) => subjectFilter === 'ALL' || p.subjectId === subjectFilter
    );
  }, [dataset.learningPaths, subjectFilter]);

  const activePath =
    filteredPaths.find((p) => p.id === selectedPathId) || filteredPaths[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {mode === 'DEMO' ? 'DADOS DEMO · Sequenciamento Curricular Adaptativo' : 'TRILHAS DE APRENDIZAGEM ADAPTATIVAS AO VIVO'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Trilhas de Aprendizagem
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Jornadas de aprendizagem individualizadas e sequenciadas, ajustadas automaticamente pelo Motor de Aprendizagem Autônoma conforme o domínio evolui.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg"
          >
            <option value="ALL">Todas as Disciplinas</option>
            {dataset.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={engineProcessing}
            onClick={() => runAutonomousLearningDemo()}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
          >
            {engineProcessing ? 'Adaptando Trilhas...' : 'Adaptar Trilha via Novo Evento'}
          </button>
        </div>
      </div>

      {filteredPaths.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <Compass className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-800">Nenhuma trilha de aprendizagem gerada ainda.</p>
          <p className="text-xs text-slate-500 mt-1">
            Conclua uma avaliação ou execute o ciclo autônomo de aprendizagem para gerar uma trilha personalizada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Lista à esquerda */}
          <div className="lg:col-span-5 space-y-3">
            {filteredPaths.map((path) => {
              const stu = dataset.students.find((s) => s.id === path.studentId);
              const sub = dataset.subjects.find((s) => s.id === path.subjectId);
              const comp = dataset.competencies.find((c) => c.id === path.competencyId);
              const isSelected = activePath?.id === path.id;

              return (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => setSelectedPathId(path.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-900 border-slate-200 hover:border-sky-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={isSelected ? 'text-sky-300 font-mono' : 'text-sky-700 font-mono'}>
                      {stu?.pseudonymId || path.studentId} · {comp?.code || path.competencyId}
                    </span>
                    <span className={`font-mono font-semibold ${isSelected ? 'text-slate-200' : 'text-slate-700'}`}>
                      {path.progressPercent}%
                    </span>
                  </div>
                  <p className="text-sm font-semibold mt-1">{path.title}</p>
                  <p className={`text-xs mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                    {stu?.displayName} · {sub?.name} · Nível: {labelEstimatedLevel(path.estimatedLevel)}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Painel de detalhes à direita */}
          {activePath && (
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              {(() => {
                const stu = dataset.students.find((s) => s.id === activePath.studentId);
                const sub = dataset.subjects.find((s) => s.id === activePath.subjectId);
                const comp = dataset.competencies.find((c) => c.id === activePath.competencyId);

                return (
                  <>
                    <div className="pb-4 border-b border-slate-100">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          {stu?.displayName} ({stu?.pseudonymId}) · {sub?.name} · {comp?.code}
                        </span>
                        <span className="font-mono">Data de Revisão: {activePath.nextReviewDate}</span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 mt-1">{activePath.title}</h2>
                      <p className="text-sm text-slate-600 mt-1.5">{activePath.educationalObjective}</p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-500 block">Nível Estimado</span>
                          <span className="font-semibold text-slate-900 mt-0.5 block">
                            {labelEstimatedLevel(activePath.estimatedLevel)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Critério de Domínio</span>
                          <span className="font-semibold text-slate-900 mt-0.5 block">
                            {activePath.masteryCriterion}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Progresso Geral</span>
                          <span className="font-mono font-semibold text-sky-700 mt-0.5 block">
                            {activePath.progressPercent}% Concluído
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Módulos Sequenciados de Aprendizagem
                      </h3>
                      {activePath.modules.map((mod) => (
                        <div
                          key={mod.order}
                          className="border border-slate-200 rounded-lg p-4 flex items-start justify-between gap-4"
                        >
                          <div className="flex items-start gap-3">
                            {mod.status === 'COMPLETED' ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            ) : mod.status === 'IN_PROGRESS' ? (
                              <Clock className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                Módulo {mod.order}: {mod.title}
                              </p>
                              <p className="text-xs text-slate-600 mt-1">{mod.shortLesson}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                Exercício Recomendado: <span className="font-medium text-slate-700">{mod.exerciseFocus}</span>
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`text-xs font-semibold ${
                                mod.status === 'COMPLETED'
                                  ? 'text-emerald-700'
                                  : mod.status === 'IN_PROGRESS'
                                    ? 'text-sky-700'
                                    : 'text-slate-400'
                              }`}
                            >
                              {labelModuleStatus(mod.status)}
                            </span>
                            {mod.masteryScore !== undefined && (
                              <p className="text-xs font-mono text-slate-600 mt-0.5">
                                {mod.masteryScore}%
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
