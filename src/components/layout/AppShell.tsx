import React, { useState } from 'react';
import {
  Activity,
  BookOpenCheck,
  Compass,
  LayoutDashboard,
  LogIn,
  Menu,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { labelRole } from '../../utils/labels';

export type NavSectionId =
  | 'overview'
  | 'students'
  | 'activities'
  | 'support'
  | 'settings';

interface AppShellProps {
  activeTab: NavSectionId;
  onSelectTab: (tab: NavSectionId) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: NavSectionId; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'overview', label: 'Painel de Risco', icon: LayoutDashboard },
  { id: 'students', label: 'Médias e Alunos', icon: Users },
  { id: 'activities', label: 'Revisões de Provas', icon: BookOpenCheck },
  { id: 'support', label: 'Mapa por Matéria', icon: Compass },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

export const AppShell: React.FC<AppShellProps> = ({ activeTab, onSelectTab, children }) => {
  const {
    mode,
    setMode,
    firebaseUser,
    effectiveRole,
    setDemoRole,
    autoPilotEnabled,
    engineProcessing,
    signInWithGoogle,
    bannerNotice,
    clearBanner,
  } = useWorkspace();

  const [mobileOpen, setMobileOpen] = useState(false);

  const currentNavLabel =
    effectiveRole === 'STUDENT'
      ? 'Meu Espaço de Estudos'
      : NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Painel de Risco';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Barra Lateral */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-slate-950 text-slate-100 flex flex-col justify-between transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <span className="font-display font-bold text-sm tracking-tight text-white block leading-tight">
                  EduPulse AI
                </span>
                <span className="text-[11px] text-sky-400 font-medium block">
                  Ensino Médio
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white"
              aria-label="Fechar navegação"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-3 space-y-1" aria-label="Navegação principal">
            {effectiveRole === 'STUDENT' ? (
              <button
                type="button"
                onClick={() => {
                  onSelectTab('overview');
                  setMobileOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-sky-600/20 text-sky-300 whitespace-nowrap"
              >
                <Compass className="w-4 h-4 shrink-0" />
                Meus Estudos
              </button>
            ) : (
              NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })
            )}
          </nav>
        </div>

        {/* Seletor Simples no Rodapé */}
        <div className="p-4 border-t border-slate-800/80 space-y-3 text-xs">
          <div>
            <p className="text-slate-400 mb-1.5">Ambiente</p>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 rounded-lg">
              <button
                type="button"
                onClick={() => setMode('DEMO')}
                className={`py-1.5 rounded font-medium transition-colors ${
                  mode === 'DEMO' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Demo
              </button>
              <button
                type="button"
                onClick={() => setMode('LIVE')}
                className={`py-1.5 rounded font-medium transition-colors ${
                  mode === 'LIVE' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Escola
              </button>
            </div>
          </div>

          {mode === 'DEMO' && (
            <div>
              <p className="text-slate-400 mb-1.5">Visualizar como</p>
              <select
                value={effectiveRole}
                onChange={(e) => setDemoRole(e.target.value as 'ADMIN' | 'TEACHER' | 'STUDENT')}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
              >
                <option value="TEACHER">Professor</option>
                <option value="ADMIN">Coordenação</option>
                <option value="STUDENT">Aluno</option>
              </select>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-slate-600 hover:text-slate-900"
              aria-label="Abrir navegação"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-slate-500 truncate">
              Ensino Médio / <span className="text-slate-900 font-semibold">{currentNavLabel}</span>
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {effectiveRole !== 'STUDENT' && (
              <span
                className={`hidden md:inline text-xs font-semibold whitespace-nowrap ${
                  engineProcessing
                    ? 'text-sky-700'
                    : autoPilotEnabled
                      ? 'text-emerald-700'
                      : 'text-slate-400'
                }`}
              >
                {engineProcessing
                  ? 'IA processando...'
                  : autoPilotEnabled
                    ? 'IA Autônoma Ativa'
                    : 'IA em Pausa'}
              </span>
            )}
            <span className="hidden sm:inline text-xs text-slate-500 whitespace-nowrap">
              {mode === 'DEMO' ? 'Modo Demo' : 'Conectado'} ·{' '}
              <strong className="text-slate-800">{labelRole(effectiveRole)}</strong>
            </span>

            {!firebaseUser ? (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                Entrar com Google
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelectTab('settings')}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap shrink-0"
              >
                Minha Conta
              </button>
            )}
          </div>
        </header>

        {bannerNotice && (
          <div
            className={`px-6 py-3 text-xs flex items-center justify-between gap-4 border-b ${
              bannerNotice.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : bannerNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-sky-50 border-sky-200 text-sky-900'
            }`}
          >
            <p className="font-medium">{bannerNotice.message}</p>
            <button
              type="button"
              onClick={clearBanner}
              className="text-xs underline shrink-0"
            >
              Fechar
            </button>
          </div>
        )}

        <main className="flex-1 p-6 lg:p-8 max-w-[1320px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
