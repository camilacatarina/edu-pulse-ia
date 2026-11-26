import React from 'react';
import { LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { labelRole } from '../../utils/labels';

export const SettingsModule: React.FC = () => {
  const {
    mode,
    setMode,
    firebaseUser,
    userProfile,
    effectiveRole,
    setDemoRole,
    dataset,
    signInWithGoogle,
    logout,
    updateConsent,
  } = useWorkspace();

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Configurações da Escola
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Gerencie o acesso à conta escolar, permissões e autorização dos responsáveis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-sky-700" />
            Conta e Ambiente
          </h2>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Escola</span>
              <span className="font-semibold text-slate-900">{dataset.institution.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Código da Escola</span>
              <span className="font-mono font-semibold text-sky-700">{dataset.institution.joinCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Modo</span>
              <span className="font-semibold text-slate-900">
                {mode === 'DEMO' ? 'Demonstração' : 'Escola Conectada (Nuvem)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Perfil Atual</span>
              <span className="font-semibold text-slate-900">{labelRole(effectiveRole)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            {!firebaseUser ? (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                Entrar com Google
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMode(mode === 'DEMO' ? 'LIVE' : 'DEMO')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 rounded-lg hover:bg-sky-800"
                >
                  Alternar para {mode === 'DEMO' ? 'Modo Escola (Nuvem)' : 'Modo Demonstração'}
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair ({userProfile?.displayName || firebaseUser.email})
                </button>
              </>
            )}
          </div>

          {mode === 'DEMO' && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-700 mb-2">
                Testar visão de outro perfil
              </p>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                {(['ADMIN', 'TEACHER', 'STUDENT'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDemoRole(r)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                      effectiveRole === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {labelRole(r)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Privacidade e Segurança Escolar
          </h2>
          <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
            <li>
              <span className="font-semibold text-slate-900">Proteção de identidade:</span> Nomes e e-mails dos alunos não são enviados à inteligência artificial — apenas códigos anônimos e notas.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Acesso por escola:</span> Cada escola visualiza apenas suas próprias turmas, e cada estudante acessa somente suas atividades.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Decisão do professor:</span> A IA cria exercícios de apoio e trilhas de estudo; notas oficiais e aprovações são sempre do professor.
            </li>
          </ul>
        </section>
      </div>

      {/* Consentimento dos Responsáveis */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Autorização dos Responsáveis
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Controle de autorização para estudantes do Ensino Médio.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Estudante</th>
                <th className="py-3 px-4">Série</th>
                <th className="py-3 px-4">Autorização</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {dataset.consentRecords.slice(0, 12).map((rec) => {
                const stu = dataset.students.find((s) => s.id === rec.studentId);
                return (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {stu?.displayName || rec.studentId}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">
                      {stu?.gradeLevel || 'Ensino Médio'}
                    </td>
                    <td className="py-2.5 px-4">
                      <select
                        value={rec.guardianConsentStatus}
                        onChange={(e) =>
                          updateConsent(rec.id, {
                            guardianConsentStatus: e.target.value as 'VERIFIED' | 'PENDING' | 'REVOKED',
                          })
                        }
                        className="px-2 py-1 text-xs font-medium border border-slate-200 rounded bg-white"
                      >
                        <option value="VERIFIED">Autorizado</option>
                        <option value="PENDING">Pendente</option>
                        <option value="REVOKED">Revogado</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
              {dataset.consentRecords.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-xs text-slate-500">
                    Nenhum estudante matriculado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
