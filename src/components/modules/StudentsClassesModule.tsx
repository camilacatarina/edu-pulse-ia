import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookPlus,
  Edit3,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Student } from '../../types/domain';
import {
  FailureRiskLevel,
  formatGradeTen,
  labelRiskLevel,
  labelRiskShort,
  parseStructuredExamReview,
} from '../../utils/pedagogicalAnalytics';

interface StudentsClassesModuleProps {
  selectedStudentId: string | null;
  onSelectStudent: (id: string | null) => void;
}

const HIGH_SCHOOL_GRADES = ['1ª Série EM', '2ª Série EM', '3ª Série EM'] as const;

function riskTextColor(level: FailureRiskLevel): string {
  switch (level) {
    case 'MAXIMUM':
      return 'text-red-700';
    case 'MODERATE':
      return 'text-amber-700';
    case 'LOW':
      return 'text-emerald-700';
  }
}

export const StudentsClassesModule: React.FC<StudentsClassesModuleProps> = ({
  selectedStudentId,
  onSelectStudent,
}) => {
  const {
    dataset,
    teacherFilter,
    setTeacherFilter,
    availableTeachers,
    scopedStudentProfiles,
    studentProfiles,
    addClass,
    addSubjectWithCompetency,
    saveStudent,
    removeStudent,
    recordExamGrade,
    runAutonomousLearningDemo,
    engineProcessing,
  } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | FailureRiskLevel>('ALL');
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Partial<Student> | null>(null);

  // Quick grade modal inside student profile
  const [showQuickGrade, setShowQuickGrade] = useState(false);
  const [qSubjectId, setQSubjectId] = useState('');
  const [qCompId, setQCompId] = useState('');
  const [qScoreTen, setQScoreTen] = useState('5.0');
  const [savingQuickGrade, setSavingQuickGrade] = useState(false);

  // Class form state
  const [className, setClassName] = useState('');
  const [classGrade, setClassGrade] = useState('1ª Série EM');
  const [academicYear, setAcademicYear] = useState('2026');
  const [teacherName, setTeacherName] = useState('');

  // Subject + Competency form state
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [compCode, setCompCode] = useState('');
  const [compName, setCompName] = useState('');
  const [compGrade, setCompGrade] = useState('1ª Série EM');

  // Student form state
  const [stuName, setStuName] = useState('');
  const [stuClassId, setStuClassId] = useState('');
  const [stuGrade, setStuGrade] = useState('1ª Série EM');
  const [stuOwnerUid, setStuOwnerUid] = useState('');
  const [stuSubjects, setStuSubjects] = useState<string[]>([]);

  const selectedProfile = useMemo(
    () => studentProfiles.find((p) => p.student.id === selectedStudentId) || null,
    [studentProfiles, selectedStudentId]
  );

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedStudentProfiles.filter((p) => {
      if (classFilter !== 'ALL' && p.student.classId !== classFilter) return false;
      if (riskFilter !== 'ALL' && p.riskLevel !== riskFilter) return false;
      if (!q) return true;
      return (
        p.student.displayName.toLowerCase().includes(q) ||
        p.student.gradeLevel.toLowerCase().includes(q) ||
        labelRiskShort(p.riskLevel).toLowerCase().includes(q) ||
        (p.bestSubject?.subject.name.toLowerCase().includes(q) ?? false) ||
        (p.worstSubject?.subject.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [scopedStudentProfiles, searchQuery, classFilter, riskFilter]);

  const openStudentForm = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setStuName(student.displayName);
      setStuClassId(student.classId);
      setStuGrade(student.gradeLevel);
      setStuOwnerUid(student.studentOwnerUid);
      setStuSubjects(student.subjectIds);
    } else {
      setEditingStudent({});
      setStuName('');
      setStuClassId(dataset.classes[0]?.id || '');
      setStuGrade(dataset.classes[0]?.gradeLevel || '1ª Série EM');
      setStuOwnerUid('');
      setStuSubjects(dataset.subjects.map((s) => s.id));
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stuName.trim() || !stuClassId) return;
    await saveStudent({
      id: editingStudent?.id,
      displayName: stuName,
      classId: stuClassId,
      gradeLevel: stuGrade,
      subjectIds: stuSubjects.length > 0 ? stuSubjects : dataset.subjects.map((s) => s.id),
      studentOwnerUid: stuOwnerUid.trim(),
    });
    setEditingStudent(null);
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;
    await addClass({
      name: className,
      gradeLevel: classGrade,
      academicYear,
      teacherName: teacherName || 'Professor Responsável',
    });
    setClassName('');
    setTeacherName('');
    setShowClassModal(false);
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || !subCode.trim() || !compName.trim()) return;
    await addSubjectWithCompetency({
      subjectName: subName,
      subjectCode: subCode,
      competencyCode: compCode || `${subCode.toUpperCase()}-1`,
      competencyName: compName,
      description: `Competência de ${subName} para ${compGrade}.`,
      gradeLevel: compGrade,
    });
    setSubName('');
    setSubCode('');
    setCompCode('');
    setCompName('');
    setShowSubjectModal(false);
  };

  // Boletim Individual Completo do Aluno
  if (selectedProfile) {
    const selectedStudent = selectedProfile.student;
    const cls = dataset.classes.find((c) => c.id === selectedStudent.classId);
    const stuResults = [...dataset.assessmentResults]
      .filter((r) => r.studentId === selectedStudent.id)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

    const openProfileGradeModal = () => {
      const subId = selectedProfile.worstSubject?.subject.id || dataset.subjects[0]?.id || '';
      const comp = dataset.competencies.find((c) => c.subjectId === subId) || dataset.competencies[0];
      setQSubjectId(subId);
      setQCompId(comp?.id || '');
      setQScoreTen('5.5');
      setShowQuickGrade(true);
    };

    const handleQuickGradeSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = Number(qScoreTen.replace(',', '.'));
      if (Number.isNaN(val) || !qSubjectId || !qCompId) return;
      setSavingQuickGrade(true);
      try {
        await recordExamGrade({
          studentId: selectedStudent.id,
          subjectId: qSubjectId,
          competencyId: qCompId,
          percentage: Math.min(100, Math.max(0, Math.round(val * 10))),
        });
        setShowQuickGrade(false);
      } finally {
        setSavingQuickGrade(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectStudent(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </button>
            <div>
              <p className="text-xs text-slate-500">
                {cls?.name || selectedStudent.gradeLevel} · {cls?.teacherName || 'Ensino Médio'}
              </p>
              <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
                {selectedStudent.displayName}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openProfileGradeModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Lançar Nota de Prova
            </button>
            <button
              type="button"
              disabled={engineProcessing}
              onClick={() => runAutonomousLearningDemo(selectedStudent.id)}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
            >
              {engineProcessing ? 'Atualizando IA...' : 'Atualizar Reforço com IA'}
            </button>
          </div>
        </div>

        {/* Risco de Reprovação + Melhor Matéria + Pior Matéria */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Média Geral</p>
            <p
              className={`text-2xl font-bold font-mono tabular-nums mt-1.5 ${
                selectedProfile.overallAverage < 60
                  ? 'text-red-700'
                  : selectedProfile.overallAverage < 70
                    ? 'text-amber-700'
                    : 'text-slate-900'
              }`}
            >
              {formatGradeTen(selectedProfile.overallAverage)}{' '}
              <span className="text-sm font-normal text-slate-400">/ 10</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">{selectedProfile.overallAverage}% de aproveitamento</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">Risco de Reprovação</p>
              {selectedProfile.riskLevel === 'MAXIMUM' && (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
            </div>
            <p className={`text-sm font-bold mt-2 ${riskTextColor(selectedProfile.riskLevel)}`}>
              {labelRiskLevel(selectedProfile.riskLevel)}
            </p>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{selectedProfile.riskReason}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">Onde se dá Melhor</p>
              <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
            <p className="text-base font-bold text-slate-900 mt-1.5">
              {selectedProfile.bestSubject?.subject.name || '—'}
            </p>
            <p className="text-xs font-mono font-semibold text-emerald-700 mt-1">
              {selectedProfile.bestSubject
                ? `Média ${formatGradeTen(selectedProfile.bestSubject.average)} (${selectedProfile.bestSubject.average}%)`
                : 'Sem notas'}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">Onde é Mais Ruim</p>
              <TrendingDown className="w-4 h-4 text-red-600 shrink-0" />
            </div>
            <p className="text-base font-bold text-slate-900 mt-1.5">
              {selectedProfile.worstSubject?.subject.name || '—'}
            </p>
            <p className="text-xs font-mono font-semibold text-red-700 mt-1">
              {selectedProfile.worstSubject
                ? `Média ${formatGradeTen(selectedProfile.worstSubject.average)} (${selectedProfile.worstSubject.average}%)`
                : 'Sem notas'}
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Médias por Matéria */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">
              Notas e Médias por Matéria
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Ordenado da matéria com maior dificuldade para a mais forte
            </p>

            <div className="space-y-4">
              {[...selectedProfile.subjectPerformances]
                .sort((a, b) => a.average - b.average)
                .map((sp) => (
                  <div key={sp.subject.id}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div>
                        <span className="font-medium text-slate-900">{sp.subject.name}</span>
                        <span className="text-xs text-slate-400 ml-2">
                          ({sp.examsCount} {sp.examsCount === 1 ? 'prova' : 'provas'})
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          sp.isFailing
                            ? 'text-red-700'
                            : sp.isNearRisk
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {formatGradeTen(sp.average)}{' '}
                        <span className="text-xs font-normal text-slate-400">({sp.average}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          sp.isFailing
                            ? 'bg-red-600'
                            : sp.isNearRisk
                              ? 'bg-amber-500'
                              : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(4, sp.average))}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* Revisões de Provas feitas pela IA */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Provas e Revisões Automáticas da IA
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                A IA analisa automaticamente cada prova indicando acertos, erros e ação recomendada.
              </p>
            </div>

            <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
              {stuResults.map((res) => {
                const sub = dataset.subjects.find((s) => s.id === res.subjectId);
                const comp = dataset.competencies.find((c) => c.id === res.competencyId);
                const parsed = parseStructuredExamReview(res.aiPreliminaryFeedback);

                return (
                  <div key={res.id} className="border border-slate-200 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {sub?.name} — {comp?.name || 'Avaliação'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Data: {res.submittedAt.slice(0, 10)} ·{' '}
                          {parsed ? 'Revisada pela IA' : 'Aguardando ciclo da IA'}
                        </p>
                      </div>
                      <span
                        className={`text-base font-bold font-mono tabular-nums shrink-0 ${
                          res.percentage < 60
                            ? 'text-red-700'
                            : res.percentage < 70
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {formatGradeTen(res.percentage)}
                      </span>
                    </div>

                    {parsed ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5">
                        <p className="font-semibold text-slate-900">{parsed.verdict}</p>
                        {parsed.whatWentWell && (
                          <p className="text-emerald-800">
                            <span className="font-semibold">Onde foi bem:</span> {parsed.whatWentWell}
                          </p>
                        )}
                        {parsed.whereStruggled && (
                          <p className="text-red-800">
                            <span className="font-semibold">Onde errou:</span> {parsed.whereStruggled}
                          </p>
                        )}
                        {parsed.recommendation && (
                          <p className="text-sky-800">
                            <span className="font-semibold">Ação da IA:</span> {parsed.recommendation}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">
                        A IA fará a revisão desta prova automaticamente no próximo ciclo.
                      </p>
                    )}
                  </div>
                );
              })}

              {stuResults.length === 0 && (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Nenhuma prova registrada para este aluno ainda.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Modal Lançar Nota no Perfil */}
        {showQuickGrade && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
            <form
              onSubmit={handleQuickGradeSubmit}
              className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                Lançar Nota · {selectedStudent.displayName}
              </h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Matéria</label>
                <select
                  value={qSubjectId}
                  onChange={(e) => {
                    setQSubjectId(e.target.value);
                    const first = dataset.competencies.find((c) => c.subjectId === e.target.value);
                    if (first) setQCompId(first.id);
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Competência / Tema</label>
                <select
                  value={qCompId}
                  onChange={(e) => setQCompId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {dataset.competencies
                    .filter((c) => c.subjectId === qSubjectId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nota da Prova (0,0 a 10,0)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  required
                  value={qScoreTen}
                  onChange={(e) => setQScoreTen(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickGrade(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingQuickGrade}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                >
                  {savingQuickGrade ? 'Revisando com IA...' : 'Salvar e Revisar com IA'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Médias, Notas e Matérias por Aluno
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Visualize a média geral, notas por disciplina e onde cada estudante se dá melhor ou pior.
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
              <option value="ALL">Todos os Professores</option>
              {availableTeachers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowSubjectModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <BookPlus className="w-3.5 h-3.5" />
            Nova Matéria
          </button>
          <button
            type="button"
            onClick={() => setShowClassModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Turma
          </button>
          <button
            type="button"
            onClick={() => openStudentForm()}
            disabled={dataset.classes.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Matricular Aluno
          </button>
        </div>
      </div>

      {/* Turmas do Ensino Médio */}
      {dataset.classes.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {dataset.classes.map((cls) => {
            const count = scopedStudentProfiles.filter((p) => p.student.classId === cls.id).length;
            const active = classFilter === cls.id;
            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => setClassFilter(active ? 'ALL' : cls.id)}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-900 border-slate-200 hover:border-sky-300'
                }`}
              >
                <p className="text-sm font-semibold truncate">{cls.name}</p>
                <p className={`text-xs mt-1 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                  {cls.teacherName || cls.gradeLevel} · {count} estudantes
                </p>
              </button>
            );
          })}
        </section>
      )}

      {/* Busca e Filtro de Risco */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar aluno, série ou matéria forte/fraca..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {(['ALL', 'MAXIMUM', 'MODERATE', 'LOW'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setRiskFilter(lvl)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                riskFilter === lvl ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {lvl === 'ALL'
                ? 'Todos'
                : lvl === 'MAXIMUM'
                  ? 'Risco Máximo'
                  : lvl === 'MODERATE'
                    ? 'Atenção'
                    : 'Regulares'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela Boletim Completo */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Aluno</th>
                <th className="py-3 px-4 text-right">Média</th>
                <th className="py-3 px-4">Risco</th>
                <th className="py-3 px-4">Melhor Matéria</th>
                <th className="py-3 px-4">Pior Matéria</th>
                {dataset.subjects.slice(0, 5).map((sub) => (
                  <th key={sub.id} className="py-3 px-2.5 text-right font-mono">
                    {sub.code}
                  </th>
                ))}
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredProfiles.map((profile) => {
                const stu = profile.student;
                const cls = dataset.classes.find((c) => c.id === stu.classId);

                return (
                  <tr key={stu.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        onClick={() => onSelectStudent(stu.id)}
                        className="font-semibold text-slate-900 hover:text-sky-700 text-left block"
                      >
                        {stu.displayName}
                      </button>
                      <span className="text-xs text-slate-500">{cls?.name || stu.gradeLevel}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">
                      <span
                        className={
                          profile.overallAverage < 60
                            ? 'text-red-700'
                            : profile.overallAverage < 70
                              ? 'text-amber-700'
                              : 'text-slate-900'
                        }
                      >
                        {formatGradeTen(profile.overallAverage)}
                      </span>
                    </td>
                    <td className={`py-2.5 px-4 text-xs font-semibold whitespace-nowrap ${riskTextColor(profile.riskLevel)}`}>
                      {labelRiskShort(profile.riskLevel)}
                    </td>
                    <td className="py-2.5 px-4 text-xs">
                      {profile.bestSubject ? (
                        <span className="text-emerald-800 font-medium">
                          {profile.bestSubject.subject.code}{' '}
                          <span className="font-mono tabular-nums">
                            ({formatGradeTen(profile.bestSubject.average)})
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-xs">
                      {profile.worstSubject ? (
                        <span className="text-red-700 font-medium">
                          {profile.worstSubject.subject.code}{' '}
                          <span className="font-mono tabular-nums">
                            ({formatGradeTen(profile.worstSubject.average)})
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    {dataset.subjects.slice(0, 5).map((sub) => {
                      const sp = profile.subjectPerformances.find((s) => s.subject.id === sub.id);
                      const avg = sp?.average ?? stu.averageScore;
                      return (
                        <td
                          key={sub.id}
                          className={`py-2.5 px-2.5 text-right font-mono text-xs tabular-nums ${
                            avg < 60
                              ? 'text-red-700 font-bold'
                              : avg < 70
                                ? 'text-amber-700 font-semibold'
                                : 'text-slate-700'
                          }`}
                        >
                          {formatGradeTen(avg)}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectStudent(stu.id)}
                          className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap"
                        >
                          Boletim
                        </button>
                        <button
                          type="button"
                          onClick={() => openStudentForm(stu)}
                          aria-label={`Editar ${stu.displayName}`}
                          className="p-1 text-slate-500 hover:text-slate-900"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStudent(stu.id)}
                          aria-label={`Remover ${stu.displayName}`}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProfiles.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-sm text-slate-500">
                    Nenhum estudante encontrado para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar Turma */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form onSubmit={handleAddClass} className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Nova Turma do Ensino Médio</h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nome da Turma</label>
              <input
                required
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="ex.: 1ª Série B"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Série</label>
                <select
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {HIGH_SCHOOL_GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ano Letivo</label>
                <input
                  required
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Professor(a) Responsável</label>
              <input
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="ex.: Profª. Elena Martins"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClassModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                Salvar Turma
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Nova Disciplina */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form onSubmit={handleAddSubject} className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Nova Matéria e Competência</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Matéria</label>
                <input
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="ex.: História"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sigla</label>
                <input
                  required
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  placeholder="HIST"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Série</label>
                <select
                  value={compGrade}
                  onChange={(e) => setCompGrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {HIGH_SCHOOL_GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Código</label>
                <input
                  value={compCode}
                  onChange={(e) => setCompCode(e.target.value)}
                  placeholder="HIST-BR"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tema / Competência</label>
              <input
                required
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                placeholder="ex.: Brasil República e Cidadania"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSubjectModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Matricular / Editar Aluno */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form onSubmit={handleSaveStudent} className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">
              {editingStudent.id ? 'Editar Aluno' : 'Matricular Aluno'}
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nome do Aluno</label>
              <input
                required
                value={stuName}
                onChange={(e) => setStuName(e.target.value)}
                placeholder="ex.: Marina Almeida"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Turma</label>
                <select
                  required
                  value={stuClassId}
                  onChange={(e) => {
                    setStuClassId(e.target.value);
                    const cls = dataset.classes.find((c) => c.id === e.target.value);
                    if (cls) setStuGrade(cls.gradeLevel);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {dataset.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Série</label>
                <select
                  value={stuGrade}
                  onChange={(e) => setStuGrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {HIGH_SCHOOL_GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Código da Conta do Aluno (Opcional)
              </label>
              <input
                value={stuOwnerUid}
                onChange={(e) => setStuOwnerUid(e.target.value)}
                placeholder="Opcional: UID do login Google do aluno"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
