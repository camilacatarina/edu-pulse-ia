import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  LifeBuoy,
  Play,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { InterventionStatus } from '../../types/domain';
import {
  labelActivityStatus,
  labelEstimatedLevel,
  labelInterventionStatus,
  labelModuleStatus,
  labelPriority,
} from '../../utils/labels';
import { formatGradeTen, labelRiskShort } from '../../utils/pedagogicalAnalytics';

function statusTextColor(status: InterventionStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'text-emerald-700';
    case 'IN_PROGRESS':
    case 'ASSIGNED':
      return 'text-sky-700';
    case 'REASSESSMENT_REQUIRED':
      return 'text-red-700';
    default:
      return 'text-slate-700';
  }
}

export const SupportAndPathsModule: React.FC = () => {
  const {
    dataset,
    teacherFilter,
    setTeacherFilter,
    availableTeachers,
    scopedStudentProfiles,
    updateInterventionStatus,
    runAutonomousLearningDemo,
    engineProcessing,
  } = useWorkspace();

  const [subTab, setSubTab] = useState<'MATRIX' | 'INTERVENTIONS' | 'PATHS' | 'AI_LOG'>('MATRIX');
  const [selectedIntId, setSelectedIntId] = useState<string | null>(null);
  const [outcomeInput, setOutcomeInput] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);

  const scopedStudentIds = useMemo(
    () => new Set(scopedStudentProfiles.map((sp) => sp.student.id)),
    [scopedStudentProfiles]
  );

  // Resumo por disciplina: média da turma, alunos com melhor desempenho e alunos mais críticos
  const subjectSummaries = useMemo(() => {
    return dataset.subjects.map((sub) => {
      const entries = scopedStudentProfiles
        .map((sp) => {
          const perf = sp.subjectPerformances.find((p) => p.subject.id === sub.id);
          return perf ? { profile: sp, perf } : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      const avg =
        entries.length > 0
          ? Math.round(
              (entries.reduce((acc, e) => acc + e.perf.average, 0) / entries.length) * 10
            ) / 10
          : 0;

      const sortedDesc = [...entries].sort((a, b) => b.perf.average - a.perf.average);
      const sortedAsc = [...entries].sort((a, b) => a.perf.average - b.perf.average);
      const failingCount = entries.filter((e) => e.perf.isFailing).length;
      const strongCount = entries.filter((e) => e.perf.average >= 80).length;

      return {
        subject: sub,
        classAverage: avg,
        failingCount,
        strongCount,
        topStudents: sortedDesc.slice(0, 2),
        strugglingStudents: sortedAsc.slice(0, 2),
      };
    });
  }, [dataset.subjects, scopedStudentProfiles]);

  const filteredMatrixProfiles = useMemo(() => {
    if (subjectFilter === 'ALL') return scopedStudentProfiles;
    return scopedStudentProfiles.filter(
      (sp) => sp.worstSubject?.subject.id === subjectFilter || sp.bestSubject?.subject.id === subjectFilter
    );
  }, [scopedStudentProfiles, subjectFilter]);

  const sortedInterventions = useMemo(
    () =>
      dataset.interventions
        .filter((i) => scopedStudentIds.has(i.studentId))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [dataset.interventions, scopedStudentIds]
  );

  const activeIntervention =
    sortedInterventions.find((i) => i.id === selectedIntId) || sortedInterventions[0] || null;

  const filteredPaths = useMemo(
    () =>
      dataset.learningPaths.filter(
        (p) =>
          scopedStudentIds.has(p.studentId) &&
          (subjectFilter === 'ALL' || p.subjectId === subjectFilter)
      ),
    [dataset.learningPaths, scopedStudentIds, subjectFilter]
  );

  const activePath =
    filteredPaths.find((p) => p.id === selectedPathId) || filteredPaths[0] || null;

  const recentInsights = useMemo(
    () =>
      dataset.aiInsights
        .filter((ins) => scopedStudentIds.has(ins.studentId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [dataset.aiInsights, scopedStudentIds]
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Mapa por Matéria e Recuperação Automática
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Veja em qual disciplina cada aluno vai melhor, onde tem mais dificuldade e os planos de recuperação gerados pela IA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {availableTeachers.length > 0 && (
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              aria-label="Filtrar por professor"
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-800 whitespace-nowrap"
            >
              <option value="ALL">Todos os Professores</option>
              {availableTeachers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => setSubTab('MATRIX')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                subTab === 'MATRIX' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Mapa Forte × Fraco
            </button>
            <button
              type="button"
              onClick={() => setSubTab('INTERVENTIONS')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                subTab === 'INTERVENTIONS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Recuperação ({sortedInterventions.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('PATHS')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                subTab === 'PATHS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Trilhas ({filteredPaths.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('AI_LOG')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                subTab === 'AI_LOG' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Decisões da IA
            </button>
          </div>

          <button
            type="button"
            disabled={engineProcessing}
            onClick={() => runAutonomousLearningDemo()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            {engineProcessing ? 'Analisando...' : 'Executar Ciclo da IA'}
          </button>
        </div>
      </div>

      {/* ABA 1: Mapa Forte × Fraco por Matéria */}
      {subTab === 'MATRIX' && (
        <div className="space-y-6">
          {/* Cards por Disciplina */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {subjectSummaries.map((item) => {
              const isSelected = subjectFilter === item.subject.id;
              return (
                <article
                  key={item.subject.id}
                  className={`bg-white border rounded-xl p-5 space-y-4 transition-colors ${
                    isSelected ? 'border-sky-600 ring-1 ring-sky-600/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                        {item.subject.code}
                      </p>
                      <h2 className="text-base font-bold text-slate-900 mt-0.5">
                        {item.subject.name}
                      </h2>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-slate-500">Média da Turma</p>
                      <p
                        className={`text-xl font-bold tabular-nums font-mono ${
                          item.classAverage < 60
                            ? 'text-red-600'
                            : item.classAverage < 70
                              ? 'text-amber-600'
                              : 'text-slate-900'
                        }`}
                      >
                        {formatGradeTen(item.classAverage)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-lg p-3">
                      <p className="font-semibold text-emerald-800 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                        Destaque ({item.strongCount})
                      </p>
                      <div className="mt-2 space-y-1">
                        {item.topStudents.map((entry) => (
                          <div key={entry.profile.student.id} className="flex items-center justify-between gap-2">
                            <span className="text-slate-800 truncate">{entry.profile.student.displayName}</span>
                            <span className="font-mono tabular-nums font-semibold text-emerald-700 shrink-0">
                              {formatGradeTen(entry.perf.average)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-red-50/60 border border-red-200/80 rounded-lg p-3">
                      <p className="font-semibold text-red-800 flex items-center gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                        Abaixo de 6,0 ({item.failingCount})
                      </p>
                      <div className="mt-2 space-y-1">
                        {item.strugglingStudents.map((entry) => (
                          <div key={entry.profile.student.id} className="flex items-center justify-between gap-2">
                            <span className="text-slate-800 truncate">{entry.profile.student.displayName}</span>
                            <span className="font-mono tabular-nums font-semibold text-red-700 shrink-0">
                              {formatGradeTen(entry.perf.average)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      {item.failingCount === 0
                        ? 'Sem alunos em risco nesta matéria'
                        : `${item.failingCount} aluno(s) precisando de reforço`}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSubjectFilter(isSelected ? 'ALL' : item.subject.id)
                      }
                      className="text-xs font-semibold text-sky-700 hover:underline whitespace-nowrap"
                    >
                      {isSelected ? 'Mostrar todas' : 'Filtrar alunos'}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          {/* Tabela Comparativa Forte vs Fraco por Aluno */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Comparativo Individual: Onde se Dá Melhor × Onde é Mais Ruim
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ordenado automaticamente pela urgência de reprovação para priorizar atendimentos sem trabalho manual.
                </p>
              </div>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                aria-label="Filtrar tabela por disciplina"
                className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="ALL">Todas as Disciplinas</option>
                {dataset.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Aluno / Série</th>
                    <th className="py-3 px-4 text-right">Média Geral</th>
                    <th className="py-3 px-4">Risco</th>
                    <th className="py-3 px-4">Onde se Dá Melhor</th>
                    <th className="py-3 px-4">Onde é Mais Ruim</th>
                    <th className="py-3 px-4 text-right">Diferença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredMatrixProfiles.map((sp) => {
                    const cls = dataset.classes.find((c) => c.id === sp.student.classId);
                    const gapTen =
                      sp.bestSubject && sp.worstSubject
                        ? (sp.bestSubject.average - sp.worstSubject.average) / 10
                        : 0;

                    return (
                      <tr key={sp.student.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{sp.student.displayName}</p>
                          <p className="text-xs text-slate-500">
                            {sp.student.gradeLevel}
                            {cls?.teacherName ? ` · ${cls.teacherName}` : ''}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold">
                          <span
                            className={
                              sp.overallAverage < 60
                                ? 'text-red-600'
                                : sp.overallAverage < 70
                                  ? 'text-amber-600'
                                  : 'text-slate-900'
                            }
                          >
                            {formatGradeTen(sp.overallAverage)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold">
                          {sp.riskLevel === 'MAXIMUM' ? (
                            <span className="inline-flex items-center gap-1.5 text-red-700 whitespace-nowrap">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              {labelRiskShort(sp.riskLevel)}
                            </span>
                          ) : sp.riskLevel === 'MODERATE' ? (
                            <span className="inline-flex items-center gap-1.5 text-amber-700 whitespace-nowrap">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              {labelRiskShort(sp.riskLevel)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 whitespace-nowrap">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              {labelRiskShort(sp.riskLevel)}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          {sp.bestSubject ? (
                            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
                              <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              {sp.bestSubject.subject.name}{' '}
                              <span className="font-mono tabular-nums font-bold">
                                ({formatGradeTen(sp.bestSubject.average)})
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          {sp.worstSubject ? (
                            <span
                              className={`inline-flex items-center gap-1.5 font-medium ${
                                sp.worstSubject.isFailing ? 'text-red-700' : 'text-amber-800'
                              }`}
                            >
                              <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                              {sp.worstSubject.subject.name}{' '}
                              <span className="font-mono tabular-nums font-bold">
                                ({formatGradeTen(sp.worstSubject.average)})
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                          {gapTen.toFixed(1).replace('.', ',')} pts
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ABA 2: Planos de Recuperação */}
      {subTab === 'INTERVENTIONS' && (
        <>
          {sortedInterventions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <LifeBuoy className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-800">
                Nenhum plano de recuperação registrado para este filtro ainda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-2.5">
                {sortedInterventions.map((intv) => {
                  const stu = dataset.students.find((s) => s.id === intv.studentId);
                  const sub = dataset.subjects.find((s) => s.id === intv.subjectId);
                  const comp = dataset.competencies.find((c) => c.id === intv.competencyId);
                  const selected = activeIntervention?.id === intv.id;

                  return (
                    <button
                      key={intv.id}
                      type="button"
                      onClick={() => {
                        setSelectedIntId(intv.id);
                        setOutcomeInput(intv.outcomeSummary || '');
                      }}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-900 border-slate-200 hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={selected ? 'text-sky-300 font-medium' : 'text-slate-500 font-medium'}>
                          {stu?.displayName || intv.studentId} · {stu?.gradeLevel || ''}
                        </span>
                        <span
                          className={`font-semibold ${
                            selected ? 'text-white' : statusTextColor(intv.status)
                          }`}
                        >
                          {labelInterventionStatus(intv.status)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold mt-1">{comp?.name || intv.strategy}</p>
                      <p className={`text-xs mt-1 ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {sub?.name} · Prioridade {labelPriority(intv.priority).toLowerCase()}
                      </p>
                    </button>
                  );
                })}
              </div>

              {activeIntervention && (
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                  {(() => {
                    const stu = dataset.students.find((s) => s.id === activeIntervention.studentId);
                    const sub = dataset.subjects.find((s) => s.id === activeIntervention.subjectId);
                    const comp = dataset.competencies.find((c) => c.id === activeIntervention.competencyId);
                    const linkedActivities = dataset.activities.filter((a) =>
                      activeIntervention.activityIds.includes(a.id)
                    );

                    return (
                      <>
                        <div className="pb-4 border-b border-slate-100">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{sub?.name} · {stu?.gradeLevel}</span>
                            <span className="font-mono">{activeIntervention.createdAt.slice(0, 10)}</span>
                          </div>
                          <h2 className="text-lg font-bold text-slate-900 mt-1">
                            {stu?.displayName} — {comp?.name}
                          </h2>
                          <p className="text-xs text-slate-500 mt-1">
                            Estratégia: <span className="text-slate-800 font-medium">{activeIntervention.strategy}</span>
                          </p>
                        </div>

                        <div className="space-y-3 text-xs">
                          <div>
                            <p className="font-semibold text-slate-500">Motivo identificado</p>
                            <p className="text-slate-700 mt-1 leading-relaxed">
                              {activeIntervention.evidence}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-500">Plano de apoio gerado automaticamente</p>
                            <p className="text-slate-800 mt-1 leading-relaxed">
                              {activeIntervention.contentSummary}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-2">
                            Atividades vinculadas ({linkedActivities.length})
                          </p>
                          <div className="space-y-2">
                            {linkedActivities.map((act) => (
                              <div
                                key={act.id}
                                className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                              >
                                <span className="font-medium text-slate-800">{act.title}</span>
                                <span className="font-mono text-slate-600">{labelActivityStatus(act.status)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 space-y-3">
                          <label className="block text-xs font-semibold text-slate-700">
                            Observação opcional do professor
                          </label>
                          <textarea
                            rows={2}
                            value={outcomeInput}
                            onChange={(e) => setOutcomeInput(e.target.value)}
                            placeholder="Observação do professor sobre a evolução do estudante..."
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                          />
                          <div className="flex flex-wrap gap-2">
                            {(['IN_PROGRESS', 'COMPLETED', 'REASSESSMENT_REQUIRED'] as const).map((nextStatus) => (
                              <button
                                key={nextStatus}
                                type="button"
                                onClick={() =>
                                  updateInterventionStatus(
                                    activeIntervention.id,
                                    nextStatus,
                                    outcomeInput || undefined
                                  )
                                }
                                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg"
                              >
                                Marcar como {labelInterventionStatus(nextStatus)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ABA 3: Trilhas de Estudo */}
      {subTab === 'PATHS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Trilhas progressivas adaptadas automaticamente às matérias com menor desempenho de cada aluno.
            </p>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg"
            >
              <option value="ALL">Todas as Disciplinas</option>
              {dataset.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {filteredPaths.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <Compass className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-800">Nenhuma trilha criada ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-2.5">
                {filteredPaths.map((path) => {
                  const stu = dataset.students.find((s) => s.id === path.studentId);
                  const sub = dataset.subjects.find((s) => s.id === path.subjectId);
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
                        <span className={isSelected ? 'text-sky-300 font-medium' : 'text-sky-700 font-medium'}>
                          {stu?.displayName} · {stu?.gradeLevel}
                        </span>
                        <span className="font-mono font-semibold">{path.progressPercent}%</span>
                      </div>
                      <p className="text-sm font-semibold mt-1">{path.title}</p>
                      <p className={`text-xs mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {sub?.name} · {labelEstimatedLevel(path.estimatedLevel)}
                      </p>
                    </button>
                  );
                })}
              </div>

              {activePath && (
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                  {(() => {
                    const stu = dataset.students.find((s) => s.id === activePath.studentId);
                    const sub = dataset.subjects.find((s) => s.id === activePath.subjectId);

                    return (
                      <>
                        <div className="pb-4 border-b border-slate-100">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{stu?.displayName} · {sub?.name}</span>
                            <span className="font-mono font-semibold text-sky-700">
                              {activePath.progressPercent}% concluído
                            </span>
                          </div>
                          <h2 className="text-lg font-bold text-slate-900 mt-1">{activePath.title}</h2>
                          <p className="text-xs text-slate-600 mt-1">{activePath.educationalObjective}</p>
                        </div>

                        <div className="space-y-3">
                          {activePath.modules.map((mod) => (
                            <div
                              key={mod.order}
                              className="border border-slate-200 rounded-lg p-3.5 flex items-start justify-between gap-4"
                            >
                              <div className="flex items-start gap-3">
                                {mod.status === 'COMPLETED' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                ) : mod.status === 'IN_PROGRESS' ? (
                                  <Clock className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                                ) : (
                                  <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                                )}
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {mod.order}. {mod.title}
                                  </p>
                                  <p className="text-xs text-slate-600 mt-0.5">{mod.shortLesson}</p>
                                  <p className="text-xs text-slate-500 mt-1">{mod.exerciseFocus}</p>
                                </div>
                              </div>
                              <span
                                className={`text-xs font-semibold shrink-0 ${
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
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ABA 4: Decisões Recentes da IA */}
      {subTab === 'AI_LOG' && (
        <div className="space-y-3">
          {recentInsights.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              Nenhuma análise registrada ainda. A IA atua automaticamente em segundo plano.
            </div>
          ) : (
            recentInsights.map((insight) => {
              const stu = dataset.students.find((s) => s.id === insight.studentId);
              const sub = dataset.subjects.find((s) => s.id === insight.subjectId);
              const comp = dataset.competencies.find((c) => c.id === insight.competencyId);

              return (
                <article
                  key={insight.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                      <span className="font-semibold text-slate-900">
                        {stu?.displayName || insight.pseudonymId}
                      </span>
                      <span>·</span>
                      <span>{sub?.name}</span>
                      <span>·</span>
                      <span>{comp?.name || insight.competencyId}</span>
                    </div>
                    <span className="font-mono">{insight.createdAt.slice(0, 10)}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{insight.strategyChosen}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{insight.pedagogicalDiagnosis}</p>
                  <p className="text-xs text-sky-700 font-medium">{insight.observedOutcome}</p>
                </article>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
