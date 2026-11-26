import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  Bot,
  Download,
  Pause,
  Play,
  Plus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  formatGradeTen,
  labelRiskShort,
  parseStructuredExamReview,
} from '../../utils/pedagogicalAnalytics';

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
    teacherFilter,
    setTeacherFilter,
    availableTeachers,
    scopedStudentProfiles,
    engineProcessing,
    autoPilotEnabled,
    setAutoPilotEnabled,
    nextScanSeconds,
    autoActionsCount,
    lastAutoDecision,
    runAutonomousAutoScan,
    recordExamGrade,
  } = useWorkspace();

  const [riskTab, setRiskTab] = useState<'MAXIMUM' | 'MODERATE' | 'ALL'>('MAXIMUM');
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [gradeStudentId, setGradeStudentId] = useState('');
  const [gradeSubjectId, setGradeSubjectId] = useState('');
  const [gradeCompetencyId, setGradeCompetencyId] = useState('');
  const [gradeScoreTen, setGradeScoreTen] = useState('5.5');
  const [savingGrade, setSavingGrade] = useState(false);

  const scopedStudentIds = useMemo(
    () => new Set(scopedStudentProfiles.map((p) => p.student.id)),
    [scopedStudentProfiles]
  );

  const scopedResults = useMemo(
    () => dataset.assessmentResults.filter((r) => scopedStudentIds.has(r.studentId)),
    [dataset.assessmentResults, scopedStudentIds]
  );

  const metrics = useMemo(() => {
    const total = scopedStudentProfiles.length;
    const maxRiskCount = scopedStudentProfiles.filter((p) => p.riskLevel === 'MAXIMUM').length;
    const moderateRiskCount = scopedStudentProfiles.filter((p) => p.riskLevel === 'MODERATE').length;
    const avgOverall =
      total > 0
        ? Math.round(
            (scopedStudentProfiles.reduce((acc, p) => acc + p.overallAverage, 0) / total) * 10
          ) / 10
        : 0;

    const totalExams = scopedResults.length;
    const aiReviewedExams = scopedResults.filter(
      (r) => Boolean(r.aiPreliminaryFeedback && r.aiPreliminaryFeedback.includes('Ponto Forte:'))
    ).length;

    const subjectAverages = dataset.subjects.map((sub) => {
      const vals = scopedStudentProfiles
        .map((p) => p.subjectPerformances.find((sp) => sp.subject.id === sub.id)?.average)
        .filter((v): v is number => typeof v === 'number');
      const avg =
        vals.length > 0
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
          : 0;
      return { subject: sub, avg };
    });

    const criticalSubject = [...subjectAverages].sort((a, b) => a.avg - b.avg)[0] || null;

    return {
      total,
      maxRiskCount,
      moderateRiskCount,
      avgOverall,
      totalExams,
      aiReviewedExams,
      pendingExams: Math.max(0, totalExams - aiReviewedExams),
      subjectAverages,
      criticalSubject,
    };
  }, [scopedStudentProfiles, scopedResults, dataset.subjects]);

  const priorityList = useMemo(() => {
    if (riskTab === 'MAXIMUM') {
      return scopedStudentProfiles.filter((p) => p.riskLevel === 'MAXIMUM');
    }
    if (riskTab === 'MODERATE') {
      return scopedStudentProfiles.filter((p) => p.riskLevel === 'MODERATE');
    }
    return scopedStudentProfiles;
  }, [scopedStudentProfiles, riskTab]);

  const recentReviewedExams = useMemo(() => {
    return [...scopedResults]
      .filter((r) => Boolean(r.aiPreliminaryFeedback && r.aiPreliminaryFeedback.trim().length > 0))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .slice(0, 5);
  }, [scopedResults]);

  const subjectChartData = useMemo(() => {
    return metrics.subjectAverages.map((item) => ({
      name: item.subject.code,
      fullName: item.subject.name,
      media: item.avg,
    }));
  }, [metrics.subjectAverages]);

  const openNewGradeModal = () => {
    const firstStu = scopedStudentProfiles[0]?.student || dataset.students[0];
    const firstSub = dataset.subjects[0];
    const firstComp =
      dataset.competencies.find((c) => c.subjectId === firstSub?.id) || dataset.competencies[0];
    setGradeStudentId(firstStu?.id || '');
    setGradeSubjectId(firstSub?.id || '');
    setGradeCompetencyId(firstComp?.id || '');
    setGradeScoreTen('5.2');
    setShowGradeModal(true);
  };

  const handleSaveExamGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeStudentId || !gradeSubjectId || !gradeCompetencyId) return;
    const numericTen = Number(gradeScoreTen.replace(',', '.'));
    if (Number.isNaN(numericTen)) return;
    const pct = Math.min(100, Math.max(0, Math.round(numericTen * 10)));
    setSavingGrade(true);
    try {
      await recordExamGrade({
        studentId: gradeStudentId,
        subjectId: gradeSubjectId,
        competencyId: gradeCompetencyId,
        percentage: pct,
      });
      setShowGradeModal(false);
    } finally {
      setSavingGrade(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Estudante',
      'Serie',
      'Media_0_10',
      'Risco_Reprovacao',
      'Melhor_Materia',
      'Pior_Materia',
      'Motivo_Risco',
    ];
    const rows = scopedStudentProfiles.map((p) => [
      `"${p.student.displayName.replace(/"/g, '""')}"`,
      p.student.gradeLevel,
      formatGradeTen(p.overallAverage),
      labelRiskShort(p.riskLevel),
      p.bestSubject ? `${p.bestSubject.subject.name} (${formatGradeTen(p.bestSubject.average)})` : '-',
      p.worstSubject ? `${p.worstSubject.subject.name} (${formatGradeTen(p.worstSubject.average)})` : '-',
      `"${p.riskReason.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `painel-professor-em-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Seletor do Professor */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {dataset.institution.name} · {mode === 'DEMO' ? 'Ambiente Demo' : 'Dados em Tempo Real'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Painel do Professor · Risco de Reprovação e Revisões da IA
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Acompanhe médias, identifique prioridades máximas de reprovação e veja onde cada aluno vai melhor ou pior.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {availableTeachers.length > 0 && (
            <select
              aria-label="Filtrar por professor"
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg"
            >
              <option value="ALL">Todos os Professores ({dataset.students.length} alunos)</option>
              {availableTeachers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={openNewGradeModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Lançar Nota de Prova
          </button>

          <button
            type="button"
            onClick={() => setAutoPilotEnabled(!autoPilotEnabled)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap shrink-0 transition-colors ${
              autoPilotEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {autoPilotEnabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {autoPilotEnabled ? 'IA Autônoma Ativa' : 'Retomar IA'}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
        </div>
      </div>

      {/* Motor Autônomo de IA (Sem Manutenção Humana) */}
      <section className="bg-slate-950 text-slate-100 rounded-xl p-6 border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-emerald-400">
                  {engineProcessing
                    ? 'REVISANDO PROVA E CALCULANDO RISCOS'
                    : autoPilotEnabled
                      ? 'IA OPERANDO SOZINHA · SEM MANUTENÇÃO HUMANA'
                      : 'IA AUTÔNOMA PAUSADA'}
                </span>
                <span className="text-slate-500">·</span>
                <span className="font-mono tabular-nums text-slate-300">
                  {autoPilotEnabled
                    ? engineProcessing
                      ? 'Processando revisão automática...'
                      : `Próxima verificação automática em ${nextScanSeconds}s`
                    : 'Pausada pelo professor'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                {lastAutoDecision
                  ? `${lastAutoDecision.modeType === 'EXAM_REVIEW' ? 'Última revisão de prova' : 'Última ação da IA'}: ${lastAutoDecision.studentName} (${lastAutoDecision.subjectName})`
                  : 'Analisando provas pendentes e risco de reprovação automaticamente...'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            disabled={engineProcessing}
            onClick={() => runAutonomousAutoScan(false)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-white rounded-lg hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {engineProcessing ? 'Processando...' : 'Revisar Próxima Prova Agora'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 text-xs">
          <div>
            <p className="text-slate-400">Diagnóstico Automático</p>
            <p className="text-slate-100 font-medium mt-1 leading-relaxed">
              {lastAutoDecision
                ? lastAutoDecision.reviewVerdict || lastAutoDecision.reason
                : 'Priorizando provas com notas abaixo de 6,0 para revisão imediata.'}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Ponto Forte × Pior Matéria</p>
            <p className="text-slate-200 font-medium mt-1 leading-relaxed">
              {lastAutoDecision?.bestSubject || lastAutoDecision?.worstSubject
                ? `Melhor: ${lastAutoDecision.bestSubject || '-'} · Pior: ${lastAutoDecision.worstSubject || '-'}`
                : 'Mapeando afinidade por matéria de cada aluno.'}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Lista de Recuperação Gerada</p>
            <p className="text-sky-300 font-medium mt-1 leading-relaxed">
              {lastAutoDecision
                ? lastAutoDecision.activityTitle
                : 'Aguardando seleção automática...'}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Ações Autônomas na Sessão</p>
            <p className="text-white text-base font-bold font-mono tabular-nums mt-1">
              {autoActionsCount} {autoActionsCount === 1 ? 'revisão/ação' : 'revisões/ações'}
            </p>
          </div>
        </div>
      </section>

      {/* 4 KPIs Essenciais para o Professor */}
      <section aria-label="Indicadores do professor" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Prioridade Máxima de Reprovação</p>
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          </div>
          <p className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1.5">
            {metrics.maxRiskCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            +{metrics.moderateRiskCount} em atenção preventiva
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Média Geral da Turma</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
            {formatGradeTen(metrics.avgOverall)} <span className="text-sm font-normal text-slate-400">/ 10</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.avgOverall}% em {metrics.total} alunos
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Provas Revisadas pela IA</p>
            <BookOpenCheck className="w-4 h-4 text-sky-700 shrink-0" />
          </div>
          <p className="text-2xl font-bold text-sky-700 font-mono tabular-nums mt-1.5">
            {metrics.aiReviewedExams} <span className="text-sm font-normal text-slate-400">/ {metrics.totalExams}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.pendingExams} aguardando ciclo automático
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Matéria Mais Crítica</p>
          <p className="text-lg font-bold text-slate-900 truncate mt-1.5">
            {metrics.criticalSubject ? metrics.criticalSubject.subject.name : '—'}
          </p>
          <p className="text-xs text-amber-700 font-medium font-mono tabular-nums mt-1">
            {metrics.criticalSubject
              ? `Média ${formatGradeTen(metrics.criticalSubject.avg)} (${metrics.criticalSubject.avg}%)`
              : 'Sem notas registradas'}
          </p>
        </div>
      </section>

      {/* Âncora Principal: Alunos em Prioridade Máxima de Reprovação */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Alerta Automático de Reprovação
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Classificação automática pela média geral (&lt; 6,0) e quantidade de matérias abaixo da média mínima.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit shrink-0">
            <button
              type="button"
              onClick={() => setRiskTab('MAXIMUM')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                riskTab === 'MAXIMUM' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              Prioridade Máxima ({metrics.maxRiskCount})
            </button>
            <button
              type="button"
              onClick={() => setRiskTab('MODERATE')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                riskTab === 'MODERATE' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              Atenção ({metrics.moderateRiskCount})
            </button>
            <button
              type="button"
              onClick={() => setRiskTab('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                riskTab === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Todos ({metrics.total})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Aluno</th>
                <th className="py-3 px-4 text-right">Média Geral</th>
                <th className="py-3 px-4">Onde se dá Melhor</th>
                <th className="py-3 px-4">Onde é Mais Ruim</th>
                <th className="py-3 px-4">Diagnóstico Automático de Risco</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {priorityList.slice(0, 10).map((profile) => {
                const riskColor =
                  profile.riskLevel === 'MAXIMUM'
                    ? 'text-red-700'
                    : profile.riskLevel === 'MODERATE'
                      ? 'text-amber-700'
                      : 'text-emerald-700';

                return (
                  <tr key={profile.student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onSelectStudent(profile.student.id)}
                        className="font-semibold text-slate-900 hover:text-sky-700 text-left block"
                      >
                        {profile.student.displayName}
                      </button>
                      <span className="text-xs text-slate-500">
                        {profile.student.gradeLevel} ·{' '}
                        <span className={`font-semibold ${riskColor}`}>
                          {labelRiskShort(profile.riskLevel)}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <span
                        className={`text-sm font-bold ${
                          profile.overallAverage < 60
                            ? 'text-red-700'
                            : profile.overallAverage < 70
                              ? 'text-amber-700'
                              : 'text-slate-900'
                        }`}
                      >
                        {formatGradeTen(profile.overallAverage)}
                      </span>
                      <span className="text-xs text-slate-400 block">{profile.overallAverage}%</span>
                    </td>
                    <td className="py-3 px-4">
                      {profile.bestSubject ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-medium text-slate-900">
                            {profile.bestSubject.subject.name}
                          </span>
                          <span className="font-mono tabular-nums text-emerald-700 font-semibold">
                            {formatGradeTen(profile.bestSubject.average)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {profile.worstSubject ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <TrendingDown className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span className="font-medium text-slate-900">
                            {profile.worstSubject.subject.name}
                          </span>
                          <span className="font-mono tabular-nums text-red-700 font-semibold">
                            {formatGradeTen(profile.worstSubject.average)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">
                      {profile.riskReason}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectStudent(profile.student.id)}
                        className="text-xs font-semibold text-sky-700 hover:underline whitespace-nowrap"
                      >
                        Ver Boletim →
                      </button>
                    </td>
                  </tr>
                );
              })}

              {priorityList.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    Nenhum estudante nesta faixa de risco no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Revisões de Provas Feitas pela IA + Média por Matéria */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="w-4 h-4 text-sky-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Últimas Revisões de Provas Feitas pela IA
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('activities')}
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline whitespace-nowrap"
            >
              Abrir Todas <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {recentReviewedExams.map((res) => {
              const stu = dataset.students.find((s) => s.id === res.studentId);
              const sub = dataset.subjects.find((s) => s.id === res.subjectId);
              const parsed = parseStructuredExamReview(res.aiPreliminaryFeedback);

              return (
                <div key={res.id} className="py-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-500">
                      <span className="font-semibold text-slate-900">
                        {stu?.displayName || res.studentId}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{sub?.name || 'Disciplina'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{res.submittedAt.slice(0, 10)}</span>
                    </div>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        res.percentage < 60
                          ? 'text-red-700'
                          : res.percentage < 75
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}
                    >
                      Nota {formatGradeTen(res.percentage)}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800">
                    {parsed?.verdict || 'Revisão da prova concluída pela IA'}
                  </p>
                  {parsed?.whereStruggled && (
                    <p className="text-xs text-slate-600 line-clamp-2">
                      Onde errou: {parsed.whereStruggled}
                    </p>
                  )}
                </div>
              );
            })}
            {recentReviewedExams.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-500">
                A IA está processando a revisão automática das provas...
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-900">Média por Matéria (Ensino Médio)</h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Linha tracejada indica a média mínima de aprovação (60% / nota 6,0)
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <ReferenceLine y={60} stroke="#dc2626" strokeDasharray="4 4" />
                <Bar dataKey="media" name="Média (%)" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Modal Lançar Nota de Prova (Dispara Revisão Automática da IA) */}
      {showGradeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveExamGrade}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Lançar Nota de Prova</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ao salvar a nota, a IA revisa a prova automaticamente e recalcula o risco de reprovação.
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
                  if (first) setGradeCompetencyId(first.id);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {dataset.subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Conteúdo / Competência da Prova</label>
              <select
                value={gradeCompetencyId}
                onChange={(e) => setGradeCompetencyId(e.target.value)}
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
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nota obtida na prova (0,0 a 10,0)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                required
                value={gradeScoreTen}
                onChange={(e) => setGradeScoreTen(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGradeModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingGrade}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60"
              >
                {savingGrade ? 'Salvando e Revisando...' : 'Salvar e Revisar com IA'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
