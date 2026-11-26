import React, { useState } from 'react';
import { Building2, GraduationCap, KeyRound } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const OnboardingView: React.FC = () => {
  const { firebaseUser, createWorkspace, joinWorkspaceByCode, setMode, loadingLive } = useWorkspace();
  const [tab, setTab] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [instName, setInstName] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'TEACHER'>('ADMIN');
  const [joinCode, setJoinCode] = useState('');
  const [imgError, setImgError] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instName.trim()) return;
    await createWorkspace(instName.trim(), role);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    await joinWorkspaceByCode(joinCode.trim());
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-5xl w-full bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Coluna Esquerda Editorial */}
        <div className="lg:col-span-5 bg-slate-900 text-white flex flex-col justify-between relative overflow-hidden">
          {!imgError ? (
            <img
              src="/src/assets/images/edupulse_portal_hero_1795715624918.jpg"
              alt="Interior de laboratório educacional moderno"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-56 lg:h-full object-cover opacity-50"
            />
          ) : (
            <div className="w-full h-56 lg:h-full bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900" />
          )}
          <div className="lg:absolute lg:inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-8 flex flex-col justify-end">
            <p className="text-xs font-mono text-sky-300">EduPulse AI · Ambiente Firestore ao Vivo</p>
            <h1 className="text-2xl font-bold mt-2">
              O futuro da educação personalizada.
            </h1>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Cada ambiente institucional é isolado no Cloud Firestore com salvaguardas baseadas em papéis para administradores, professores e estudantes.
            </p>
          </div>
        </div>

        {/* Coluna Direita Formulário */}
        <div className="lg:col-span-7 p-8 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Configure o Acesso da Sua Instituição</h2>
              <p className="text-xs text-slate-500 mt-1">
                Conectado como {firebaseUser?.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMode('DEMO')}
              className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap"
            >
              Voltar ao Modo Demo
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setTab('CREATE')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md ${
                tab === 'CREATE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Criar Instituição
            </button>
            <button
              type="button"
              onClick={() => setTab('JOIN')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md ${
                tab === 'JOIN' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Entrar com Código
            </button>
          </div>

          {tab === 'CREATE' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nome da Instituição
                </label>
                <input
                  required
                  value={instName}
                  onChange={(e) => setInstName(e.target.value)}
                  placeholder="ex.: Colégio Horizonte"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Seu Papel Institucional
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'ADMIN' | 'TEACHER')}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="ADMIN">Administrador da Instituição (ADMIN)</option>
                  <option value="TEACHER">Educador / Professor (TEACHER)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loadingLive}
                className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60"
              >
                {loadingLive ? 'Provisionando Ambiente no Firestore...' : 'Criar Ambiente da Instituição'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Código de Acesso da Instituição
                </label>
                <input
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="ex.: EDU-7K9P2"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg font-mono uppercase"
                />
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-sky-700 shrink-0" />
                Entrar com código cria seu perfil de Estudante dentro do perímetro isolado da instituição.
              </p>
              <button
                type="submit"
                disabled={loadingLive}
                className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60"
              >
                {loadingLive ? 'Entrando...' : 'Entrar na Instituição'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
