import React, { useMemo, useState } from 'react';
import { Cpu, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { runInternalLearningCycleBatch } from '../../services/aiApiService';
import { labelEngineSource, labelEventType, labelPriority } from '../../utils/labels';

export const AIIntelligenceCenterModule: React.FC = () => {
  const {
    dataset,
    mode,
    geminiConfigured,
    engineProcessing,
    lastEngineRun,
    runAutonomousLearningDemo,
  } = useWorkspace();

  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [runningBatch, setRunningBatch] = useState(false);

  const filteredInsights = useMemo(() => {
    const sorted = [...dataset.aiInsights].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    if (priorityFilter === 'ALL') return sorted;
    return sorted.filter((i) => i.priority === priorityFilter);
  }, [dataset.aiInsights, priorityFilter]);

  const sortedEvents = useMemo(
    () =>
      [...dataset.learningEvents]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 12),
    [dataset.learningEvents]
  );

  const handleRunInternalBatch = async () => {
    if (dataset.students.length === 0 || dataset.competencies.length === 0) return;
    setRunningBatch(true);
    setBatchNotice(null);
    try {
      const stu = dataset.students[0];
      const comp = dataset.competencies[0];
      const sub = dataset.subjects.find((s) => s.id === comp.subjectId) || dataset.subjects[0];
      const eventId = `evt_batch_${Date.now().toString(36)}`;
      const res = await runInternalLearningCycleBatch([
        {
          eventId,
          idempotencyKey: `idem_batch_${stu.pseudonymId}_${comp.code}_${stu.averageScore}`,
          eventType: 'StudentProgressUpdated',
          institutionId: dataset.institution.id,
          pseudonymId: stu.pseudonymId,
          gradeLevel: stu.gradeLevel,
          subjectName: sub?.name || 'Matemática',
          competencyCode: comp.code,
          competencyName: comp.name,
          recentScores: [stu.averageScore],
          latestScore: stu.averageScore,
          completedActivitiesCount: dataset.activities.filter(
            (a) => a.studentId === stu.id && a.status === 'COMPLETED'
          ).length,
          demoMode: mode === 'DEMO',
        },
      ]);
      setBatchNotice(
        `Endpoint interno de ciclo processou ${res.processedCount} evento(s) com idempotência (motor: ${res.results[0]?.engineSource}, idempotentHit: ${res.results[0]?.idempotentHit}).`
      );
    } catch (err) {
      setBatchNotice(err instanceof Error ? err.message : 'Erro na execução em lote.');
    } finally {
      setRunningBatch(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho & Status Real do Motor */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            AutonomousLearningEngine · Fluxo de Decisão Pseudonimizado
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Central de Inteligência IA
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Transparência total sobre detecção proativa de lacunas, escolha de estratégia pedagógica, geração de atividades e atualizações de trilha.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs">
            <span className="font-mono font-semibold text-emerald-700">
              STATUS DO MOTOR DE IA: ATIVO
            </span>
            <span className="text-slate-400 mx-2">|</span>
            <span className="text-slate-600">
              {geminiConfigured ? 'Gemini API Pronta' : 'Regras Pedagógicas Demo'}
            </span>
          </div>
          <button
            type="button"
            disabled={engineProcessing}
            onClick={() => runAutonomousLearningDemo()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            {engineProcessing ? 'Executando Ciclo...' : 'EXECUTAR CICLO AUTÔNOMO DEMO'}
          </button>
        </div>
      </div>

      {/* Resumo Real do Motor */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Eventos de Aprendizagem Processados</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {dataset.learningEvents.filter((e) => e.status === 'PROCESSED').length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Fila de eventos idempotente</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Lacunas e Decisões Detectadas</p>
          <p className="text-2xl font-bold text-sky-700 tabular-nums mt-1">
            {dataset.aiInsights.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Estruturadas e validadas por esquema</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Atividades Autônomas</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {dataset.activities.filter((a) => a.origin === 'AI_AUTONOMOUS').length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Personalizadas por competência</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Planos de Estudo Gerados</p>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">
            {dataset.learningPaths.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Adaptações contínuas de trilha</p>
        </div>
      </section>

      {lastEngineRun && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-slate-800">
            <span className="font-semibold text-sky-900">Último Ciclo Processado:</span>{' '}
            <span className="font-mono">{lastEngineRun.id}</span> · Estudante{' '}
            <span className="font-mono font-semibold">{lastEngineRun.pseudonymId}</span> ·{' '}
            {lastEngineRun.subjectName} ({lastEngineRun.competencyCode}) →{' '}
            <span className="font-medium">{lastEngineRun.strategy}</span>
          </div>
          <span className="text-xs font-mono text-sky-800 shrink-0">
            {labelEngineSource(lastEngineRun.engineSource)} · {lastEngineRun.nextAction}
          </span>
        </div>
      )}

      {/* Controle de Ciclo em Lote do Backend */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Cpu className="w-5 h-5 text-slate-700 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Endpoint Orientado a Eventos para Agendador (<code className="font-mono text-xs">POST /api/internal/learning-cycle</code>)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Ciclo idempotente no servidor preparado para execução autônoma via Cloud Scheduler sem depender de sessão aberta no navegador.
            </p>
            {batchNotice && (
              <p className="text-xs text-sky-700 font-medium mt-2">{batchNotice}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={runningBatch}
          onClick={handleRunInternalBatch}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 shrink-0 whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${runningBatch ? 'animate-spin' : ''}`} />
          Verificar Ciclo Idempotente
        </button>
      </div>

      {/* Divisão Principal: Decisões Detalhadas da IA + Fluxo Real de Eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">
              Decisões Recentes da IA e Análises Pedagógicas
            </h2>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriorityFilter(p)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    priorityFilter === p
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p === 'ALL' ? 'TODAS' : labelPriority(p)}
                </button>
              ))}
            </div>
          </div>

          {filteredInsights.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              Nenhum insight de IA corresponde ao filtro de prioridade selecionado.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInsights.map((insight) => {
                const stu = dataset.students.find((s) => s.id === insight.studentId);
                const sub = dataset.subjects.find((s) => s.id === insight.subjectId);
                const comp = dataset.competencies.find((c) => c.id === insight.competencyId);
                const act = dataset.activities.find((a) => a.id === insight.generatedActivityId);

                return (
                  <article
                    key={insight.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-slate-800">{insight.id}</span>
                        <span>·</span>
                        <span className="font-medium text-slate-800">
                          {insight.pseudonymId} {stu ? `(${stu.displayName})` : ''}
                        </span>
                        <span>·</span>
                        <span>{sub?.name || insight.subjectId}</span>
                        <span>·</span>
                        <span className="font-mono">{comp?.code || insight.competencyId}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span
                          className={`font-semibold ${
                            insight.priority === 'HIGH'
                              ? 'text-red-700'
                              : insight.priority === 'MEDIUM'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}
                        >
                          PRIORIDADE {labelPriority(insight.priority)}
                        </span>
                        <span className="font-mono text-slate-500">
                          {insight.createdAt.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Evidência Observada</p>
                        <p className="text-slate-700 mt-1 text-xs leading-relaxed">{insight.evidence}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Diagnóstico Pedagógico</p>
                        <p className="text-slate-800 mt-1 text-xs leading-relaxed">{insight.pedagogicalDiagnosis}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <p className="text-slate-500 font-medium">Estratégia Escolhida</p>
                        <p className="text-slate-900 font-semibold mt-0.5">{insight.strategyChosen}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Atividade Gerada</p>
                        <p className="text-sky-700 font-medium mt-0.5">
                          {act ? act.title : insight.generatedActivityId || 'Trilha atualizada'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Resultado Observado</p>
                        <p className="text-slate-800 mt-0.5">{insight.observedOutcome}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5 text-emerald-700">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Dados Pessoais Removidos (Pseudonimizados) · Decisões de Alto Impacto Reservadas aos Docentes
                      </span>
                      <span className="font-mono">
                        Confiança: {Math.round(insight.confidence * 100)}% · {labelEngineSource(insight.engineSource)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Fluxo de Eventos e Registro de Auditoria */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900">Eventos de Aprendizagem Processados</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Registros reais de eventos que acionam o motor autônomo
            </p>
            <div className="divide-y divide-slate-100">
              {sortedEvents.map((evt) => (
                <div key={evt.id} className="py-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{labelEventType(evt.eventType)}</span>
                    <span className="font-mono text-emerald-700">
                      {evt.status === 'PROCESSED'
                        ? 'PROCESSADO'
                        : evt.status === 'FAILED'
                          ? 'FALHOU'
                          : 'PENDENTE'}
                    </span>
                  </div>
                  <p className="text-slate-500 font-mono mt-0.5 truncate">
                    {evt.id} · {evt.createdAt.slice(11, 19)}
                  </p>
                </div>
              ))}
              {sortedEvents.length === 0 && (
                <p className="text-xs text-slate-500 py-4">Nenhum evento processado até o momento.</p>
              )}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900">Registros Recentes de Auditoria e Governança</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Trilha imutável de ações da IA e do corpo docente
            </p>
            <div className="divide-y divide-slate-100">
              {dataset.auditLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="py-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {log.actorType === 'AI_ENGINE'
                        ? 'MOTOR DE IA'
                        : log.actorType === 'TEACHER'
                          ? 'PROFESSOR'
                          : log.actorType === 'ADMIN'
                            ? 'ADMINISTRADOR'
                            : 'ESTUDANTE'}
                    </span>
                    <span className="font-mono">{log.createdAt.slice(0, 10)}</span>
                  </div>
                  <p className="text-slate-700 mt-0.5 leading-relaxed">{log.summary}</p>
                </div>
              ))}
              {dataset.auditLogs.length === 0 && (
                <p className="text-xs text-slate-500 py-4">Nenhum registro de auditoria ainda.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
