import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpRight, Play, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { labelEngineSource, labelPedagogicalStatus, labelPriority } from '../../utils/labels';

interface OverviewModuleProps {
  onNavigate: (tab: string) => void;
  onSelectStudent: (studentId: string) => void;
}

export const OverviewModule: React.FC<OverviewModuleProps> = ({
  onNavigate,
  onSelectStudent,
}) => {
  const {
    dataset,
    mode,
    engineProcessing,
    runAutonomousLearningDemo,
    geminiConfigured,
  } = useWorkspace();

  const metrics = useMemo(() => {
    const totalStudents = dataset.students.length;
    const totalClasses = dataset.classes.length;
    const avgPerformance =
      totalStudents > 0
        ? Math.round(
            (dataset.students.reduce((acc, s) => acc + s.averageScore, 0) / totalStudents) * 10
          ) / 10
        : 0;
    const completionRate =
      totalStudents > 0
        ? Math.round(
            (dataset.students.reduce((acc, s) => acc + s.completionRate, 0) / totalStudents) * 10
          ) / 10
        : 0;
    const studentsNeedingSupport = dataset.students.filter(
      (s) =>
        s.pedagogicalStatus === 'Needs Reinforcement' ||
        s.pedagogicalStatus === 'Additional Practice Recommended'
    ).length;
    const aiInterventionsCount = dataset.interventions.length;
    const pendingActivitiesCount = dataset.activities.filter(
      (a) => a.status !== 'COMPLETED'
    ).length;

    return {
      totalStudents,
      totalClasses,
      avgPerformance,
      completionRate,
      studentsNeedingSupport,
      aiInterventionsCount,
      pendingActivitiesCount,
    };
  }, [dataset]);

  // Chart 1: Desempenho Acadêmico ao Longo do Tempo
  const performanceOverTime = useMemo(() => {
    const weeks = [
      { label: 'Semana 1 (04 Nov)', filterDate: '2026-11-08' },
      { label: 'Semana 2 (11 Nov)', filterDate: '2026-11-15' },
      { label: 'Semana 3 (18 Nov)', filterDate: '2026-11-22' },
      { label: 'Ciclo Atual', filterDate: '2099-01-01' },
    ];

    if (dataset.assessmentResults.length === 0) {
      return [
        { period: 'Semana 1', averageScore: 0, completion: 0 },
        { period: 'Atual', averageScore: metrics.avgPerformance, completion: metrics.completionRate },
      ];
    }

    const sorted = [...dataset.assessmentResults].sort((a, b) =>
      a.submittedAt.localeCompare(b.submittedAt)
    );

    const buckets: Record<string, number[]> = {
      'Semana 1': [],
      'Semana 2': [],
      'Semana 3': [],
      Atual: [],
    };

    sorted.forEach((r) => {
      const d = r.submittedAt.slice(0, 10);
      if (d <= weeks[0].filterDate) buckets['Semana 1'].push(r.percentage);
      else if (d <= weeks[1].filterDate) buckets['Semana 2'].push(r.percentage);
      else if (d <= weeks[2].filterDate) buckets['Semana 3'].push(r.percentage);
      else buckets['Atual'].push(r.percentage);
    });

    return Object.entries(buckets).map(([period, vals], idx) => {
      const avg =
        vals.length > 0
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
          : metrics.avgPerformance;
      return {
        period,
        averageScore: avg,
        completion: Math.min(100, Math.round(metrics.completionRate - (3 - idx) * 3)),
      };
    });
  }, [dataset.assessmentResults, metrics]);

  // Chart 2: Learning Progress by Subject
  const progressBySubject = useMemo(() => {
    return dataset.subjects.map((sub) => {
      const results = dataset.assessmentResults.filter((r) => r.subjectId === sub.id);
      const avg =
        results.length > 0
          ? Math.round((results.reduce((a, b) => a + b.percentage, 0) / results.length) * 10) / 10
          : metrics.avgPerformance;
      const completedActs = dataset.activities.filter(
        (a) => a.subjectId === sub.id && a.status === 'COMPLETED'
      ).length;
      return {
        subject: sub.code,
        fullName: sub.name,
        avgScore: avg,
        completedActivities: completedActs,
      };
    });
  }, [dataset, metrics.avgPerformance]);

  // Chart 3: Class Performance Comparison
  const classComparison = useMemo(() => {
    return dataset.classes.map((cls) => {
      const clsStudents = dataset.students.filter((s) => s.classId === cls.id);
      const avg =
        clsStudents.length > 0
          ? Math.round(
              (clsStudents.reduce((a, b) => a + b.averageScore, 0) / clsStudents.length) * 10
            ) / 10
          : 0;
      const comp =
        clsStudents.length > 0
          ? Math.round(
              (clsStudents.reduce((a, b) => a + b.completionRate, 0) / clsStudents.length) * 10
            ) / 10
          : 0;
      return {
        name: cls.name.split('—')[0].trim(),
        fullName: cls.name,
        averageScore: avg,
        completionRate: comp,
        studentCount: clsStudents.length,
      };
    });
  }, [dataset]);

  // Chart 4: Competency Mastery (lowest-to-highest so reinforcement priorities stand out)
  const competencyMastery = useMemo(() => {
    return dataset.competencies
      .map((comp) => {
        const res = dataset.assessmentResults.filter((r) => r.competencyId === comp.id);
        const mastery =
          res.length > 0
            ? Math.round((res.reduce((a, b) => a + b.percentage, 0) / res.length) * 10) / 10
            : 75;
        return {
          code: comp.code,
          name: comp.name,
          mastery,
        };
      })
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 6);
  }, [dataset]);

  // Chart 5: Visão Geral das Intervenções da IA
  const interventionsOverview = useMemo(() => {
    const statuses: Array<{ status: string; label: string; count: number; color: string }> = [
      { status: 'CREATED', label: 'Criada', count: 0, color: '#64748b' },
      { status: 'ASSIGNED', label: 'Atribuída', count: 0, color: '#0284c7' },
      { status: 'IN_PROGRESS', label: 'Em Andamento', count: 0, color: '#d97706' },
      { status: 'COMPLETED', label: 'Concluída', count: 0, color: '#16a34a' },
      { status: 'REASSESSMENT_REQUIRED', label: 'Reavaliação', count: 0, color: '#dc2626' },
    ];
    dataset.interventions.forEach((intv) => {
      const target = statuses.find((s) => s.status === intv.status);
      if (target) target.count += 1;
    });
    return statuses;
  }, [dataset.interventions]);

  const topStrugglingCompetencies = competencyMastery.slice(0, 3);
  const supportStudentsList = useMemo(
    () =>
      dataset.students
        .filter(
          (s) =>
            s.pedagogicalStatus === 'Needs Reinforcement' ||
            s.pedagogicalStatus === 'Additional Practice Recommended'
        )
        .sort((a, b) => a.averageScore - b.averageScore)
        .slice(0, 5),
    [dataset.students]
  );

  const recentAiFeed = useMemo(() => {
    return [...dataset.aiInsights]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6);
  }, [dataset.aiInsights]);

  return (
    <div className="space-y-8">
      {/* Cabeçalho Executivo e Gatilho do Ciclo Autônomo */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {mode === 'DEMO' ? 'DADOS DEMO · Simulação Institucional Sintética' : 'DADOS AO VIVO DA INSTITUIÇÃO · Cloud Firestore'}
            {' · '}
            {dataset.institution.name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Visão Geral Executiva de Aprendizagem
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Monitoramento acadêmico contínuo, detecção proativa de lacunas de competência e intervenções pedagógicas autônomas em todas as turmas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('intelligence')}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Inspecionar Central de IA
          </button>
          <button
            type="button"
            disabled={engineProcessing}
            onClick={() => runAutonomousLearningDemo()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            {engineProcessing ? 'Processando Ciclo...' : 'EXECUTAR CICLO AUTÔNOMO DEMO'}
          </button>
        </div>
      </div>

      {/* Grade de KPIs Principais */}
      <section aria-label="Principais métricas acadêmicas" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total de Estudantes</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{metrics.totalStudents}</p>
          <p className="text-xs text-slate-500 mt-1">
            Em <span className="tabular-nums font-medium text-slate-700">{metrics.totalClasses}</span> turmas ativas
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Desempenho Médio</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{metrics.avgPerformance}%</p>
          <p className="text-xs text-emerald-700 font-medium mt-1">
            Conclusão de atividades {metrics.completionRate}%
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Estudantes com Necessidade de Apoio</p>
          <p className="text-2xl font-bold text-amber-700 tabular-nums mt-2">
            {metrics.studentsNeedingSupport}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Reforço pedagógico ativo
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Intervenções da IA e Pendências</p>
          <p className="text-2xl font-bold text-sky-700 tabular-nums mt-2">
            {metrics.aiInterventionsCount}
            <span className="text-sm font-normal text-slate-500 ml-2">
              / {metrics.pendingActivitiesCount} pendentes
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {geminiConfigured ? 'Motor Gemini 4 Hydrogen' : 'Regras Pedagógicas Demo'}
          </p>
        </div>
      </section>

      {/* Feed em Destaque ATIVIDADE DA IA + Lista de Apoio Prioritário */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <h2 className="text-base font-semibold text-slate-900">ATIVIDADE DA IA</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Decisões autônomas de aprendizagem, aulas geradas e atualizações de trilha ({dataset.learningEvents.length} eventos processados)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('intelligence')}
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800 whitespace-nowrap shrink-0"
            >
              Ver Registro Completo <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentAiFeed.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-600">Nenhum evento autônomo registrado ainda neste ambiente.</p>
              <button
                type="button"
                onClick={() => runAutonomousLearningDemo()}
                className="mt-3 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                Disparar Primeiro Ciclo Autônomo
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-2">
              {recentAiFeed.map((item) => {
                const sub = dataset.subjects.find((s) => s.id === item.subjectId);
                const comp = dataset.competencies.find((c) => c.id === item.competencyId);
                const priorityLabel =
                  item.priority === 'HIGH'
                    ? 'text-red-700'
                    : item.priority === 'MEDIUM'
                      ? 'text-amber-700'
                      : 'text-emerald-700';

                return (
                  <div key={item.id} className="py-3.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-medium text-slate-800">{item.pseudonymId}</span>
                        <span aria-hidden="true">·</span>
                        <span>{sub?.name || 'Disciplina'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{comp?.code || item.competencyId}</span>
                        <span aria-hidden="true">·</span>
                        <span className={`font-semibold ${priorityLabel}`}>
                          PRIORIDADE {labelPriority(item.priority)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        {item.strategyChosen}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                        {item.observedOutcome}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono text-slate-500 block">
                        {item.createdAt.slice(0, 16).replace('T', ' ')}
                      </span>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        Origem: {labelEngineSource(item.engineSource)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Competências com Maior Dificuldade e Fila de Reforço */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Competências e Prioridades de Apoio</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Áreas com menor domínio e estudantes recebendo reforço ativo da IA
            </p>

            <div className="mt-4 space-y-3">
              {topStrugglingCompetencies.map((comp) => (
                <div key={comp.code} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-slate-500">{comp.code}</p>
                    <p className="text-sm font-medium text-slate-800 truncate">{comp.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-semibold tabular-nums ${comp.mastery < 70 ? 'text-amber-700' : 'text-slate-900'}`}>
                      {comp.mastery}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-6 mb-3">
              Estudantes em Reforço Pedagógico
            </h3>
            <div className="space-y-2.5">
              {supportStudentsList.map((stu) => (
                <button
                  key={stu.id}
                  type="button"
                  onClick={() => onSelectStudent(stu.id)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200 hover:border-sky-300 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{stu.displayName}</p>
                    <p className="text-xs text-amber-700 mt-0.5">{labelPedagogicalStatus(stu.pedagogicalStatus)}</p>
                  </div>
                  <span className="text-sm font-semibold font-mono tabular-nums text-slate-800 shrink-0">
                    {stu.averageScore}%
                  </span>
                </button>
              ))}
              {supportStudentsList.length === 0 && (
                <p className="text-xs text-slate-500">Todos os estudantes matriculados estão em progresso ou com domínio consolidado.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Grade dos 5 Gráficos Executivos */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Desempenho Acadêmico ao Longo do Tempo */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-900">1. Desempenho Acadêmico ao Longo do Tempo</h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Evolução longitudinal da média da turma (%) e da taxa de conclusão (%)
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="averageScore"
                  name="Desempenho Médio (%)"
                  stroke="#0284c7"
                  fill="#e0f2fe"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="completion"
                  name="Taxa de Conclusão (%)"
                  stroke="#16a34a"
                  fill="#dcfce7"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Progresso de Aprendizagem por Disciplina */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-900">2. Progresso de Aprendizagem por Disciplina</h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Domínio médio (%) nas disciplinas do currículo
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressBySubject}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="subject" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="avgScore" name="Pontuação Média (%)" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Comparativo de Desempenho por Turma */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-900">3. Comparativo de Desempenho por Turma</h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Média de desempenho vs. taxa de conclusão por turma
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="averageScore" name="Média (%)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completionRate" name="Conclusão (%)" fill="#0891b2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Domínio de Competências */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-900">4. Domínio de Competências</h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Percentual de domínio nas competências prioritárias do currículo
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={competencyMastery} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis type="category" dataKey="code" width={92} tick={{ fontSize: 11, fill: '#334155' }} />
                <Tooltip />
                <Bar dataKey="mastery" name="Domínio (%)" radius={[0, 4, 4, 0]}>
                  {competencyMastery.map((entry) => (
                    <Cell
                      key={entry.code}
                      fill={entry.mastery >= 80 ? '#16a34a' : entry.mastery >= 70 ? '#0284c7' : '#d97706'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 5. Visão Geral das Intervenções da IA */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">5. Visão Geral das Intervenções da IA</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribuição das intervenções pedagógicas autônomas por etapa do ciclo de vida
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('interventions')}
            className="text-xs font-medium text-sky-700 hover:text-sky-800 whitespace-nowrap shrink-0"
          >
            Gerenciar Intervenções →
          </button>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={interventionsOverview}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip />
              <Bar dataKey="count" name="Intervenções" radius={[4, 4, 0, 0]}>
                {interventionsOverview.map((entry) => (
                  <Cell key={entry.status} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};
