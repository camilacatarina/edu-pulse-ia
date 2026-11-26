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
    geminiConfigured,
    signInWithGoogle,
    logout,
    updateConsent,
  } = useWorkspace();

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-slate-200">
        <p className="text-xs font-medium text-slate-500">
          Governança, Proteção de Privacidade e Configuração do Ambiente
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
          Configurações e Governança de Dados
        </h1>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl">
          Configure o isolamento institucional por locatário, regras de proteção de dados de menores, prazos de retenção e modo de autenticação.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuração de Conta & Modo */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-sky-700" />
            Autenticação e Modo de Operação
          </h2>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Modo Ativo do Ambiente</span>
              <span className="font-mono font-semibold text-slate-900">
                {mode === 'DEMO' ? 'DADOS DEMO' : 'AO VIVO (FIRESTORE)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ID da Instituição</span>
              <span className="font-mono text-slate-800">{dataset.institution.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Código de Acesso</span>
              <span className="font-mono font-semibold text-sky-700">{dataset.institution.joinCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Perfil Efetivo</span>
              <span className="font-mono font-semibold text-slate-900">{labelRole(effectiveRole)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Motor Gemini no Servidor</span>
              <span className={`font-mono font-semibold ${geminiConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
                {geminiConfigured ? 'CONFIGURADO' : 'MODO REGRAS DEMO'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            {!firebaseUser ? (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                Entrar com Google (Firestore ao Vivo)
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMode(mode === 'DEMO' ? 'LIVE' : 'DEMO')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 rounded-lg hover:bg-sky-800"
                >
                  Alternar para {mode === 'DEMO' ? 'Modo Firestore ao Vivo' : 'Modo Apresentação DEMO'}
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
                Prévia de Papéis Demo (Avalie as experiências de Administrador, Professor e Estudante)
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

        {/* Privacidade & Salvaguardas para Menores */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Privacidade, Pseudonimização e Proteção de Menores
          </h2>
          <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
            <li>
              <span className="font-semibold text-slate-900">1. Pipeline de IA sem Dados Pessoais (Zero-PII):</span> Nomes, e-mails e documentos de estudantes nunca são enviados ao Gemini. Apenas <code className="font-mono">pseudonymId</code> e indicadores pedagógicos cruzam a API.
            </li>
            <li>
              <span className="font-semibold text-slate-900">2. Isolamento Multi-Instituição:</span> As regras de segurança do Firestore isolam cada documento por <code className="font-mono">institutionId</code> e <code className="font-mono">staffUids</code>, enquanto estudantes leem apenas seus próprios registros (<code className="font-mono">studentOwnerUid</code>).
            </li>
            <li>
              <span className="font-semibold text-slate-900">3. Autoridade Humana em Decisões de Alto Impacto:</span> Intervenções automatizadas restringem-se a conteúdo de apoio, exercícios práticos e sequenciamento de trilha. Notas oficiais, reprovação e questões clínicas exigem educadores humanos.
            </li>
            <li>
              <span className="font-semibold text-slate-900">4. Política de Retenção:</span> Janela de retenção institucional configurada para <span className="font-mono font-semibold text-slate-900">{dataset.institution.retentionDays} dias</span>.
            </li>
          </ul>
        </section>
      </div>

      {/* Registros de Consentimento & Retenção */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Registros de Consentimento e Minimização de Dados dos Estudantes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe o status de autorização dos responsáveis e as políticas de retenção por estudante matriculado.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Estudante</th>
                <th className="py-3 px-4">Pseudônimo</th>
                <th className="py-3 px-4">Consentimento do Responsável</th>
                <th className="py-3 px-4">Minimização de Dados</th>
                <th className="py-3 px-4 text-right">Retenção (Dias)</th>
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
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-600">
                      {stu?.pseudonymId || '—'}
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
                        <option value="VERIFIED">VERIFICADO</option>
                        <option value="PENDING">PENDENTE</option>
                        <option value="REVOKED">REVOGADO</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-4 text-xs font-medium text-emerald-700">
                      {rec.dataMinimizationAccepted ? 'APLICADA' : 'DESATIVADA'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {rec.retentionPolicyDays}
                    </td>
                  </tr>
                );
              })}
              {dataset.consentRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                    Nenhum registro de consentimento ainda. Matricule um estudante para inicializar os registros de governança.
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
