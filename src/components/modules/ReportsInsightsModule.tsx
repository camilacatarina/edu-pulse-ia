import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useWorkspace } from '../../context/WorkspaceContext';
import { labelPedagogicalStatus } from '../../utils/labels';

export const ReportsInsightsModule: React.FC = () => {
  const { dataset, mode } = useWorkspace();

  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'LAST_7_DAYS' | 'LAST_30_DAYS'>('ALL');

  const filteredStudents = useMemo(() => {
    return dataset.students.filter((s) => classFilter === 'ALL' || s.classId === classFilter);
  }, [dataset.students, classFilter]);

  const filteredResults = useMemo(() => {
    const allowedIds = new Set(filteredStudents.map((s) => s.id));
    const cutoff =
      periodFilter === 'LAST_7_DAYS'
        ? new Date(Date.now() - 7 * 86400000).toISOString()
        : periodFilter === 'LAST_30_DAYS'
          ? new Date(Date.now() - 30 * 86400000).toISOString()
          : '';

    return dataset.assessmentResults.filter((r) => {
      if (!allowedIds.has(r.studentId)) return false;
      if (subjectFilter !== 'ALL' && r.subjectId !== subjectFilter) return false;
      if (cutoff && r.submittedAt < cutoff) return false;
      return true;
    });
  }, [dataset.assessmentResults, filteredStudents, subjectFilter, periodFilter]);

  const classPerformance = useMemo(() => {
    return dataset.classes
      .filter((c) => classFilter === 'ALL' || c.id === classFilter)
      .map((cls) => {
        const clsStudents = dataset.students.filter((s) => s.classId === cls.id);
        const avg =
          clsStudents.length > 0
            ? Math.round(
                (clsStudents.reduce((a, b) => a + b.averageScore, 0) / clsStudents.length) * 10
              ) / 10
            : 0;
        const completed = dataset.activities.filter(
          (a) => a.classId === cls.id && a.status === 'COMPLETED'
        ).length;
        const pending = dataset.activities.filter(
          (a) => a.classId === cls.id && a.status !== 'COMPLETED'
        ).length;
        return {
          className: cls.name,
          students: clsStudents.length,
          avgScore: avg,
          completedActivities: completed,
          pendingActivities: pending,
        };
      });
  }, [dataset, classFilter]);

  const competencyStats = useMemo(() => {
    return dataset.competencies
      .filter((c) => subjectFilter === 'ALL' || c.subjectId === subjectFilter)
      .map((comp) => {
        const rows = filteredResults.filter((r) => r.competencyId === comp.id);
        const avg =
          rows.length > 0
            ? Math.round((rows.reduce((a, b) => a + b.percentage, 0) / rows.length) * 10) / 10
            : null;
        return {
          code: comp.code,
          name: comp.name,
          observations: rows.length,
          avgScore: avg,
        };
      })
      .sort((a, b) => (a.avgScore ?? 999) - (b.avgScore ?? 999));
  }, [dataset.competencies, filteredResults, subjectFilter]);

  const interventionEffectiveness = useMemo(() => {
    const relevant = dataset.interventions.filter((i) => {
      if (subjectFilter !== 'ALL' && i.subjectId !== subjectFilter) return false;
      const stu = filteredStudents.find((s) => s.id === i.studentId);
      return Boolean(stu);
    });
    const completed = relevant.filter((i) => i.status === 'COMPLETED');
    return {
      total: relevant.length,
      completedCount: completed.length,
      inProgressCount: relevant.filter((i) => i.status === 'IN_PROGRESS' || i.status === 'ASSIGNED').length,
      reassessmentCount: relevant.filter((i) => i.status === 'REASSESSMENT_REQUIRED').length,
    };
  }, [dataset.interventions, filteredStudents, subjectFilter]);

  const handleExportCsv = () => {
    const headers = [
      'PseudonimoID',
      'NomeExibicao',
      'SerieAno',
      'TurmaID',
      'StatusPedagogico',
      'NotaMedia',
      'TaxaConclusao',
      'ModoDados',
    ];
    const rows = filteredStudents.map((s) => [
      s.pseudonymId,
      `"${s.displayName.replace(/"/g, '""')}"`,
      s.gradeLevel,
      s.classId,
      labelPedagogicalStatus(s.pedagogicalStatus),
      String(s.averageScore),
      String(s.completionRate),
      mode,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `edupulse-relatorio-${mode.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {mode === 'DEMO' ? 'DADOS DEMO · Analítica Institucional' : 'RELATÓRIOS INSTITUCIONAIS AO VIVO'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Relatórios e Insights
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Filtre resultados por turma, disciplina e período. Exporte registros em CSV ou imprima resumos executivos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 no-print">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Relatório
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 no-print">
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white"
        >
          <option value="ALL">Todas as Turmas</option>
          {dataset.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white"
        >
          <option value="ALL">Todas as Disciplinas</option>
          {dataset.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value as typeof periodFilter)}
          className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white"
        >
          <option value="ALL">Período Letivo Completo</option>
          <option value="LAST_30_DAYS">Últimos 30 Dias</option>
          <option value="LAST_7_DAYS">Últimos 7 Dias</option>
        </select>
        <span className="text-xs text-slate-500 ml-auto">
          Avaliando {filteredResults.length} registros observados em {filteredStudents.length} estudantes
        </span>
      </div>

      {/* KPIs Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Total de Intervenções</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {interventionEffectiveness.total}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Intervenções Concluídas</p>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">
            {interventionEffectiveness.completedCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Atividades Concluídas</p>
          <p className="text-2xl font-bold text-sky-700 tabular-nums mt-1">
            {dataset.activities.filter((a) => a.status === 'COMPLETED').length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Atividades Pendentes</p>
          <p className="text-2xl font-bold text-amber-700 tabular-nums mt-1">
            {dataset.activities.filter((a) => a.status !== 'COMPLETED').length}
          </p>
        </div>
      </div>

      {/* Gráfico + Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900">Desempenho por Turma e Carga de Atividades</h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Média observada por turma (%)
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="className" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="avgScore" name="Média (%)" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900">Competências Ordenadas por Prioridade de Apoio</h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Os tamanhos amostrais são exibidos explicitamente; métricas com poucas observações permanecem provisórias.
          </p>
          <div className="divide-y divide-slate-100">
            {competencyStats.map((c) => (
              <div key={c.code} className="py-2.5 flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <span className="font-mono text-xs text-slate-500 mr-2">{c.code}</span>
                  <span className="font-medium text-slate-800">{c.name}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                    {c.avgScore !== null ? `${c.avgScore}%` : '—'}
                  </span>
                  <span className="text-xs text-slate-400 ml-2">({c.observations} obs.)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Nota Metodológica: As métricas representam registros formativos e diagnósticos observados na janela selecionada. Resultados baseados em amostra única são tratados como indicadores provisórios, nunca como conclusões acadêmicas definitivas.
      </p>
    </div>
  );
};
