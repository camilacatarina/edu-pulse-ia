import React, { useMemo, useState } from 'react';
import { ArrowLeft, BookPlus, Edit3, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { PedagogicalStatus, Student } from '../../types/domain';
import {
  labelActivityStatus,
  labelActivityType,
  labelEngineSource,
  labelEstimatedLevel,
  labelModuleStatus,
  labelPedagogicalStatus,
} from '../../utils/labels';

interface StudentsClassesModuleProps {
  selectedStudentId: string | null;
  onSelectStudent: (id: string | null) => void;
}

function statusStyle(status: PedagogicalStatus): string {
  switch (status) {
    case 'Mastering':
      return 'text-emerald-700';
    case 'Progressing':
      return 'text-sky-700';
    case 'Additional Practice Recommended':
      return 'text-amber-700';
    case 'Needs Reinforcement':
      return 'text-red-700';
  }
}

export const StudentsClassesModule: React.FC<StudentsClassesModuleProps> = ({
  selectedStudentId,
  onSelectStudent,
}) => {
  const {
    dataset,
    mode,
    addClass,
    addSubjectWithCompetency,
    saveStudent,
    removeStudent,
    runAutonomousLearningDemo,
    engineProcessing,
  } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Partial<Student> | null>(null);

  // Class form state
  const [className, setClassName] = useState('');
  const [classGrade, setClassGrade] = useState('8º Ano');
  const [academicYear, setAcademicYear] = useState('2026');
  const [teacherName, setTeacherName] = useState('');

  // Subject + Competency form state
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [compCode, setCompCode] = useState('');
  const [compName, setCompName] = useState('');
  const [compDesc, setCompDesc] = useState('');

  // Student form state
  const [stuName, setStuName] = useState('');
  const [stuClassId, setStuClassId] = useState('');
  const [stuGrade, setStuGrade] = useState('8º Ano');
  const [stuOwnerUid, setStuOwnerUid] = useState('');
  const [stuSubjects, setStuSubjects] = useState<string[]>([]);

  const selectedStudent = useMemo(
    () => dataset.students.find((s) => s.id === selectedStudentId) || null,
    [dataset.students, selectedStudentId]
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dataset.students.filter((s) => {
      if (classFilter !== 'ALL' && s.classId !== classFilter) return false;
      if (!q) return true;
      return (
        s.displayName.toLowerCase().includes(q) ||
        s.pseudonymId.toLowerCase().includes(q) ||
        labelPedagogicalStatus(s.pedagogicalStatus).toLowerCase().includes(q) ||
        s.pedagogicalStatus.toLowerCase().includes(q)
      );
    });
  }, [dataset.students, searchQuery, classFilter]);

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
      setStuGrade(dataset.classes[0]?.gradeLevel || '8º Ano');
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
      teacherName: teacherName || 'Docente Responsável',
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
      description: compDesc || `Critério essencial de aprendizagem em ${subName}.`,
      gradeLevel: '8º Ano',
    });
    setSubName('');
    setSubCode('');
    setCompCode('');
    setCompName('');
    setCompDesc('');
    setShowSubjectModal(false);
  };

  // Individual Student Profile View
  if (selectedStudent) {
    const cls = dataset.classes.find((c) => c.id === selectedStudent.classId);
    const stuResults = dataset.assessmentResults.filter((r) => r.studentId === selectedStudent.id);
    const stuActivities = dataset.activities.filter((a) => a.studentId === selectedStudent.id);
    const stuPaths = dataset.learningPaths.filter((p) => p.studentId === selectedStudent.id);
    const stuInsights = dataset.aiInsights.filter((i) => i.studentId === selectedStudent.id);
    const stuInterventions = dataset.interventions.filter((i) => i.studentId === selectedStudent.id);

    const subjectBreakdown = dataset.subjects.map((sub) => {
      const res = stuResults.filter((r) => r.subjectId === sub.id);
      const avg =
        res.length > 0
          ? Math.round((res.reduce((a, b) => a + b.percentage, 0) / res.length) * 10) / 10
          : selectedStudent.averageScore;
      return { subject: sub, avg, observations: res.length };
    });

    const competencyBreakdown = dataset.competencies.map((comp) => {
      const res = stuResults.filter((r) => r.competencyId === comp.id);
      const avg =
        res.length > 0
          ? Math.round((res.reduce((a, b) => a + b.percentage, 0) / res.length) * 10) / 10
          : null;
      return { comp, avg, count: res.length };
    });

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
              Todos os Estudantes
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-slate-800">{selectedStudent.pseudonymId}</span>
                <span>·</span>
                <span>{cls?.name || 'Turma não atribuída'}</span>
                <span>·</span>
                <span>{selectedStudent.gradeLevel}</span>
                {mode === 'DEMO' && (
                  <>
                    <span>·</span>
                    <span>DADOS DEMO</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
                Perfil do Estudante: {selectedStudent.displayName}
              </h1>
            </div>
          </div>

          <button
            type="button"
            disabled={engineProcessing}
            onClick={() => runAutonomousLearningDemo(selectedStudent.id)}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {engineProcessing ? 'Processando Evento...' : 'Simular Novo Evento de Atividade'}
          </button>
        </div>

        {/* Visão Geral de Desempenho */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Status Pedagógico</p>
            <p className={`text-base font-semibold mt-2 ${statusStyle(selectedStudent.pedagogicalStatus)}`}>
              {labelPedagogicalStatus(selectedStudent.pedagogicalStatus)}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Visão Geral de Desempenho</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {selectedStudent.averageScore}%
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Conclusão de Atividades</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {selectedStudent.completionRate}%
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Intervenções Ativas</p>
            <p className="text-2xl font-bold text-sky-700 tabular-nums mt-1">
              {stuInterventions.length}
            </p>
          </div>
        </section>

        {/* Evolução por Disciplina & Mapa de Competências */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900">Evolução por Disciplina</h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Média de desempenho calculada em atividades formativas e diagnósticas
            </p>
            <div className="space-y-4">
              {subjectBreakdown.map(({ subject, avg, observations }) => (
                <div key={subject.id}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-800">
                      {subject.name}{' '}
                      <span className="text-xs text-slate-400 font-normal">
                        ({observations} obs.)
                      </span>
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900">{avg}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${avg >= 80 ? 'bg-emerald-600' : avg >= 70 ? 'bg-sky-600' : 'bg-amber-600'}`}
                      style={{ width: `${Math.min(100, Math.max(4, avg))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900">Mapa de Competências</h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Domínio observado por padrão curricular de aprendizagem
            </p>
            <div className="divide-y divide-slate-100">
              {competencyBreakdown.slice(0, 6).map(({ comp, avg, count }) => (
                <div key={comp.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-slate-500">{comp.code}</p>
                    <p className="text-sm font-medium text-slate-800 truncate">{comp.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {avg !== null ? (
                      <span className={`text-sm font-mono font-semibold tabular-nums ${avg >= 80 ? 'text-emerald-700' : avg >= 70 ? 'text-sky-700' : 'text-amber-700'}`}>
                        {avg}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Dados insuficientes ({count})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Jornada de Aprendizagem & Recomendações da IA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900">Jornada de Aprendizagem</h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Trilhas adaptativas de aprendizagem e módulos sequenciados
            </p>
            {stuPaths.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma trilha adaptativa atribuída até o momento.</p>
            ) : (
              <div className="space-y-4">
                {stuPaths.map((path) => (
                  <div key={path.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{path.title}</h3>
                      <span className="text-xs font-mono font-semibold text-sky-700">
                        {labelEstimatedLevel(path.estimatedLevel)} · {path.progressPercent}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{path.educationalObjective}</p>
                    <div className="mt-3 space-y-1.5">
                      {path.modules.map((m) => (
                        <div key={m.order} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700">
                            {m.order}. {m.title}
                          </span>
                          <span className={`font-medium ${m.status === 'COMPLETED' ? 'text-emerald-700' : m.status === 'IN_PROGRESS' ? 'text-sky-700' : 'text-slate-400'}`}>
                            {labelModuleStatus(m.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900">Recomendações da IA e Atividades Realizadas</h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Recomendações proativas geradas a partir de evidências pseudonimizadas
            </p>
            <div className="space-y-3">
              {stuInsights.map((ins) => (
                <div key={ins.id} className="border border-slate-200 rounded-lg p-3.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{ins.strategyChosen}</span>
                    <span className="font-mono">{labelEngineSource(ins.engineSource)}</span>
                  </div>
                  <p className="text-sm text-slate-800 mt-1">{ins.pedagogicalDiagnosis}</p>
                  <p className="text-xs text-sky-700 mt-1">Objetivo: {ins.learningObjective}</p>
                </div>
              ))}
              {stuActivities.map((act) => (
                <div key={act.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{act.title}</p>
                    <p className="text-xs text-slate-500">
                      {labelActivityType(act.type)} · {act.origin === 'AI_AUTONOMOUS' ? 'IA Autônoma' : 'Docente'}
                    </p>
                  </div>
                  <span className={`text-xs font-mono font-semibold shrink-0 ${act.status === 'COMPLETED' ? 'text-emerald-700' : 'text-sky-700'}`}>
                    {act.status === 'COMPLETED' ? `${act.scorePercentage ?? 0}% CONCLUÍDA` : labelActivityStatus(act.status)}
                  </span>
                </div>
              ))}
              {stuInsights.length === 0 && stuActivities.length === 0 && (
                <p className="text-sm text-slate-500">Nenhuma recomendação ou atividade registrada até o momento.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {mode === 'DEMO' ? 'DADOS DEMO · 5 Turmas · 60 Estudantes' : 'ELENCO AO VIVO NO FIRESTORE'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Estudantes e Turmas
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Gerencie turmas institucionais, disciplinas curriculares, matrículas e perfis pedagógicos individuais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowSubjectModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <BookPlus className="w-3.5 h-3.5" />
            Adicionar Disciplina
          </button>
          <button
            type="button"
            onClick={() => setShowClassModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar Turma
          </button>
          <button
            type="button"
            onClick={() => openStudentForm()}
            disabled={dataset.classes.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Matricular Estudante
          </button>
        </div>
      </div>

      {/* Faixa de Turmas */}
      <section>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          Turmas ({dataset.classes.length}) · Disciplinas ({dataset.subjects.length})
        </h2>
        {dataset.classes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
            <p className="text-sm text-slate-600">Nenhuma turma criada ainda neste ambiente.</p>
            <button
              type="button"
              onClick={() => setShowClassModal(true)}
              className="mt-3 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg"
            >
              Criar Primeira Turma
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {dataset.classes.map((cls) => {
              const count = dataset.students.filter((s) => s.classId === cls.id).length;
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
                    {cls.gradeLevel} · {count} estudantes
                  </p>
                  <p className={`text-xs mt-0.5 truncate ${active ? 'text-slate-400' : 'text-slate-400'}`}>
                    {cls.teacherName || 'Corpo Docente'}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Barra de Busca e Filtro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome do estudante, pseudônimo ou status..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>Exibindo {filteredStudents.length} estudantes</span>
          {classFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setClassFilter('ALL')}
              className="text-sky-700 font-medium hover:underline"
            >
              Limpar filtro de turma
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Estudantes */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Pseudônimo</th>
                <th className="py-3 px-4">Estudante</th>
                <th className="py-3 px-4">Turma</th>
                <th className="py-3 px-4">Status Pedagógico</th>
                <th className="py-3 px-4 text-right">Nota Média</th>
                <th className="py-3 px-4 text-right">Conclusão</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.map((stu) => {
                const cls = dataset.classes.find((c) => c.id === stu.classId);
                return (
                  <tr key={stu.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{stu.pseudonymId}</td>
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        onClick={() => onSelectStudent(stu.id)}
                        className="font-medium text-slate-900 hover:text-sky-700 text-left"
                      >
                        {stu.displayName}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">{cls?.name || stu.gradeLevel}</td>
                    <td className={`py-2.5 px-4 text-xs font-semibold ${statusStyle(stu.pedagogicalStatus)}`}>
                      {labelPedagogicalStatus(stu.pedagogicalStatus)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {stu.averageScore}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {stu.completionRate}%
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectStudent(stu.id)}
                          className="text-xs font-medium text-sky-700 hover:text-sky-800"
                        >
                          Perfil
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
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    Nenhum estudante corresponde ao filtro atual.
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
            <h3 className="text-lg font-semibold text-slate-900">Criar Turma</h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nome da Turma</label>
              <input
                required
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="ex.: 8º C — Matemática Aplicada"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Série / Ano</label>
                <input
                  required
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
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
                placeholder="ex.: Profa. Elena Martins"
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

      {/* Modal Adicionar Disciplina e Competência */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form onSubmit={handleAddSubject} className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Cadastrar Disciplina e Competência</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Nome da Disciplina</label>
                <input
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="ex.: Química"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Código</label>
                <input
                  required
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  placeholder="QUIM"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cód. Comp.</label>
                <input
                  value={compCode}
                  onChange={(e) => setCompCode(e.target.value)}
                  placeholder="QUIM-1"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Competência Principal</label>
                <input
                  required
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="Balanceamento Estequiométrico"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Descrição</label>
              <textarea
                rows={2}
                value={compDesc}
                onChange={(e) => setCompDesc(e.target.value)}
                placeholder="Critérios do padrão de aprendizagem..."
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
                Salvar Disciplina
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Matricular / Editar Estudante */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form onSubmit={handleSaveStudent} className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">
              {editingStudent.id ? 'Editar Matrícula de Estudante' : 'Matricular Estudante'}
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nome de Exibição do Estudante (ou Pseudônimo Autorizado)
              </label>
              <input
                required
                value={stuName}
                onChange={(e) => setStuName(e.target.value)}
                placeholder="ex.: Marina A."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Turma</label>
                <select
                  required
                  value={stuClassId}
                  onChange={(e) => setStuClassId(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Série / Ano</label>
                <input
                  required
                  value={stuGrade}
                  onChange={(e) => setStuGrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Firebase UID do Estudante Vinculado (Opcional para acesso ao Portal)
              </label>
              <input
                value={stuOwnerUid}
                onChange={(e) => setStuOwnerUid(e.target.value)}
                placeholder="Deixe em branco até o estudante vincular a conta"
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
                Salvar Estudante
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
