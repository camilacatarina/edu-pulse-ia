import React, { useMemo, useState } from 'react';
import { LifeBuoy, Play } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { InterventionStatus } from '../../types/domain';
import {
  labelActivityStatus,
  labelInterventionStatus,
  labelPriority,
} from '../../utils/labels';

const STATUS_OPTIONS: InterventionStatus[] = [
  'CREATED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'REASSESSMENT_REQUIRED',
];

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

export const InterventionsModule: React.FC = () => {
  const {
    dataset,
    mode,
    updateInterventionStatus,
    runAutonomousLearningDemo,
    engineProcessing,
  } = useWorkspace();

  const [statusFilter, setStatusFilter] = useState<'ALL' | InterventionStatus>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [outcomeInput, setOutcomeInput] = useState('');

  const filteredInterventions = useMemo(() => {
    const sorted = [...dataset.interventions].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
    if (statusFilter === 'ALL') return sorted;
    return sorted.filter((i) => i.status === statusFilter);
  }, [dataset.interventions, statusFilter]);

  const activeIntervention =
    filteredInterventions.find((i) => i.id === selectedId) || filteredInterventions[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {mode === 'DEMO' ? 'DADOS DEMO · Apoio Pedagógico Automatizado' : 'RASTREADOR DE INTERVENÇÕES AO VIVO'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Intervenções
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Acompanhe intervenções autônomas de reforço criadas quando lacunas são detectadas, visualize atividades vinculadas e registre resultados pós-intervenção.
          </p>
        </div>

        <button
          type="button"
          disabled={engineProcessing}
          onClick={() => runAutonomousLearningDemo()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          <Play className="w-3.5 h-3.5" />
          {engineProcessing ? 'Gerando...' : 'Disparar Intervenção Autônoma'}
        </button>
      </div>

      {/* Filtro por Status */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md ${
            statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          TODAS ({dataset.interventions.length})
        </button>
        {STATUS_OPTIONS.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
              statusFilter === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {labelInterventionStatus(st)}
          </button>
        ))}
      </div>

      {filteredInterventions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <LifeBuoy className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-800">Nenhuma intervenção neste status.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-3">
            {filteredInterventions.map((intv) => {
              const stu = dataset.students.find((s) => s.id === intv.studentId);
              const sub = dataset.subjects.find((s) => s.id === intv.subjectId);
              const comp = dataset.competencies.find((c) => c.id === intv.competencyId);
              const selected = activeIntervention?.id === intv.id;

              return (
                <button
                  key={intv.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(intv.id);
                    setOutcomeInput(intv.outcomeSummary || '');
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    selected
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-900 border-slate-200 hover:border-sky-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={selected ? 'text-sky-300 font-mono' : 'text-slate-500 font-mono'}>
                      {stu?.pseudonymId || intv.studentId} · {comp?.code || intv.competencyId}
                    </span>
                    <span
                      className={`font-semibold ${
                        selected ? 'text-white' : statusTextColor(intv.status)
                      }`}
                    >
                      {labelInterventionStatus(intv.status)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold mt-1">{intv.strategy}</p>
                  <p className={`text-xs mt-1 ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                    {stu?.displayName} · {sub?.name} · Prioridade: {labelPriority(intv.priority)}
                  </p>
                </button>
              );
            })}
          </div>

          {activeIntervention && (
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
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
                        <span className="font-mono">{activeIntervention.id}</span>
                        <span className="font-mono">
                          Criada em {activeIntervention.createdAt.slice(0, 10)}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 mt-1">
                        {stu?.displayName} — {comp?.name}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {sub?.name} · Prioridade: {labelPriority(activeIntervention.priority)} · Status Atual:{' '}
                        <span className={`font-semibold ${statusTextColor(activeIntervention.status)}`}>
                          {labelInterventionStatus(activeIntervention.status)}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Evidência Desencadeadora</p>
                        <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                          {activeIntervention.evidence}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Plano de Intervenção e Conteúdo</p>
                        <p className="text-xs text-slate-800 mt-1 leading-relaxed">
                          {activeIntervention.contentSummary}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">
                        Atividades de Reforço Atribuídas ({linkedActivities.length})
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
                        Registro de Resultado e Atualização de Etapa
                      </label>
                      <textarea
                        rows={2}
                        value={outcomeInput}
                        onChange={(e) => setOutcomeInput(e.target.value)}
                        placeholder="Registre o avanço observado na aprendizagem ou decisão de acompanhamento..."
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
    </div>
  );
};
