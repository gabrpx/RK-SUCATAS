// Gestão de usuários — visível só pro admin (Ayrton), embutida como uma aba
// a mais dentro de Configurações (ver ConfiguracoesView.tsx). Cada pessoa
// tem seu próprio login; papel define o que ela vê no resto do sistema
// (ver TAB_ROLES em src/App.tsx).
import { Fragment, useEffect, useState } from 'react';
import { UserPlus, KeyRound, Pencil, Ban, RotateCcw, Loader2, Check } from 'lucide-react';
import { cn } from '../../utils';
import { aviso } from '../../components/ui/toast';
import { DataTable } from '../../components/ui/DataTable';
import type { DataTableColumn } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { StatusTone } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { usuariosApi } from './api';
import { ALL_ROLES } from '../../constants/roles';
import type { Role, Usuario, UsuarioInput } from './types';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  equipe: 'Equipe',
  estoque_leitura: 'Estoque (leitura)',
  mandados: 'Mandados',
  mecanico: 'Mecânico',
};

const ROLE_TOM: Record<Role, StatusTone> = {
  admin: 'accent',
  equipe: 'positive',
  estoque_leitura: 'neutral',
  mandados: 'warning',
  mecanico: 'warning',
};

const EMPTY_FORM: UsuarioInput = { username: '', nome_exibicao: '', password: '', roles: ['equipe'] };

export function UsuariosView() {
  const meuId = localStorage.getItem('user_id');

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [form, setForm] = useState<UsuarioInput>(EMPTY_FORM);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [redefinindoSenhaDe, setRedefinindoSenhaDe] = useState<Usuario | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [desativando, setDesativando] = useState<Usuario | null>(null);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const result = await usuariosApi.listar();
      if (!result.success) throw new Error(result.error);
      setUsuarios(result.data);
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrirCriar = () => {
    setEditando(null);
    setForm(EMPTY_FORM);
    setErroForm(null);
    setIsFormOpen(true);
  };

  const abrirEditar = (usuario: Usuario) => {
    setEditando(usuario);
    setForm({ username: usuario.username, nome_exibicao: usuario.nome_exibicao, password: '', roles: usuario.roles });
    setErroForm(null);
    setIsFormOpen(true);
  };

  const salvar = async () => {
    setErroForm(null);
    if (!form.username.trim()) {
      setErroForm('Usuário não pode ficar em branco.');
      return;
    }
    if (form.roles.length === 0) {
      setErroForm('Selecione pelo menos um papel.');
      return;
    }
    if (!editando) {
      if (!form.nome_exibicao.trim() || form.password.length < 6) {
        setErroForm('Preencha nome e uma senha com pelo menos 6 caracteres.');
        return;
      }
    }
    setSalvando(true);
    try {
      const result = editando
        ? await usuariosApi.atualizar(editando.id, { username: form.username.trim(), nome_exibicao: form.nome_exibicao, roles: form.roles })
        : await usuariosApi.criar(form);
      if (!result.success) throw new Error(result.error);
      setIsFormOpen(false);
      await carregar();
    } catch (err: any) {
      setErroForm(err.message || 'Erro ao salvar usuário');
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (usuario: Usuario) => {
    try {
      const result = await usuariosApi.atualizar(usuario.id, { ativo: !usuario.ativo });
      if (!result.success) throw new Error(result.error);
      await carregar();
    } catch (err: any) {
      aviso.falha(err, 'Erro ao atualizar usuário');
    }
  };

  // Reativar é inofensivo e reversível na hora — só desativar (bloqueia o
  // login de alguém) passa por confirmação, mesmo padrão do modal de excluir
  // tarefa em TarefasView.tsx.
  const confirmarDesativacao = async () => {
    if (!desativando) return;
    await alternarAtivo(desativando);
    setDesativando(null);
  };

  const confirmarRedefinicao = async () => {
    if (!redefinindoSenhaDe) return;
    if (novaSenha.length < 6) {
      aviso.atencao('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    try {
      const result = await usuariosApi.redefinirSenha(redefinindoSenhaDe.id, novaSenha);
      if (!result.success) throw new Error(result.error);
      setRedefinindoSenhaDe(null);
      setNovaSenha('');
    } catch (err: any) {
      aviso.falha(err, 'Erro ao redefinir senha');
    }
  };

  const inputClass =
    'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';
  const labelClass = 'text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted';

  const colunas: DataTableColumn<Usuario>[] = [
    {
      key: 'nome',
      header: 'Nome',
      render: (u) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary">{u.nome_exibicao}</span>
          <span className="text-xs text-text-faint">@{u.username}</span>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Papéis',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <Fragment key={r}>
              <StatusBadge texto={ROLE_LABEL[r]} tom={ROLE_TOM[r]} />
            </Fragment>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => <StatusBadge texto={u.ativo ? 'Ativo' : 'Inativo'} tom="positive" ativo={u.ativo} />,
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (u) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => abrirEditar(u)}
            title="Editar"
            className="size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => setRedefinindoSenhaDe(u)}
            title="Redefinir senha"
            className="size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary"
          >
            <KeyRound size={14} />
          </button>
          {u.id !== meuId && (
            <button
              type="button"
              onClick={() => (u.ativo ? setDesativando(u) : alternarAtivo(u))}
              title={u.ativo ? 'Desativar' : 'Reativar'}
              className={cn('size-7 flex items-center justify-center rounded-control hover:bg-surface-raised', u.ativo ? 'text-danger' : 'text-positive')}
            >
              {u.ativo ? <Ban size={14} /> : <RotateCcw size={14} />}
            </button>
          )}
        </div>
      ),
    },
  ];

  // Mesmas colunas acima, empilhadas — usado pelo DataTable abaixo de `md`.
  function renderMobileCard(u: Usuario) {
    return (
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{u.nome_exibicao}</p>
          <p className="text-xs text-text-faint">@{u.username}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {u.roles.map((r) => (
              <Fragment key={r}>
                <StatusBadge texto={ROLE_LABEL[r]} tom={ROLE_TOM[r]} />
              </Fragment>
            ))}
            <StatusBadge texto={u.ativo ? 'Ativo' : 'Inativo'} tom="positive" ativo={u.ativo} />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => abrirEditar(u)}
            title="Editar"
            className="size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => setRedefinindoSenhaDe(u)}
            title="Redefinir senha"
            className="size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary"
          >
            <KeyRound size={14} />
          </button>
          {u.id !== meuId && (
            <button
              type="button"
              onClick={() => (u.ativo ? setDesativando(u) : alternarAtivo(u))}
              title={u.ativo ? 'Desativar' : 'Reativar'}
              className={cn('size-7 flex items-center justify-center rounded-control hover:bg-surface-raised', u.ativo ? 'text-danger' : 'text-positive')}
            >
              {u.ativo ? <Ban size={14} /> : <RotateCcw size={14} />}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium text-text-primary">Usuários</h3>
          <p className="text-sm text-text-faint mt-0.5">{usuarios.length} conta(s) — login individual por pessoa</p>
        </div>
        <button
          onClick={abrirCriar}
          className="h-10 px-5 rounded-control bg-accent text-white text-[11px] font-semibold uppercase tracking-wider shadow-sm flex items-center gap-2 hover:opacity-90"
        >
          <UserPlus size={16} /> Novo usuário
        </button>
      </div>

      {erro && <p className="text-sm text-danger">{erro}</p>}

      <DataTable
        colunas={colunas}
        dados={loading ? [] : usuarios}
        getRowKey={(u) => u.id}
        renderMobileCard={renderMobileCard}
        paginaAtual={1}
        totalPaginas={1}
        onMudarPagina={() => {}}
        emptyState={
          loading ? (
            <div className="py-12 flex items-center justify-center text-text-faint">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <EmptyState icone={UserPlus} mensagem="Nenhum usuário cadastrado ainda." acaoLabel="Criar usuário" onAcao={abrirCriar} />
          )
        }
      />

      {isFormOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center" onClick={() => setIsFormOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md flex flex-col overflow-hidden rounded-t-card md:rounded-card bg-surface-page text-text-primary border border-border-subtle"
          >
            <div className="flex items-center justify-between p-6 border-b border-border-subtle">
              <h2 className="text-lg font-medium">{editando ? 'Editar usuário' : 'Novo usuário'}</h2>
            </div>
            <div className="p-6 space-y-4">
              {erroForm && <p className="text-sm text-danger">{erroForm}</p>}

              <div>
                <label className={labelClass}>Usuário</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().trim() }))}
                  className={inputClass}
                  placeholder="ex: ryan"
                  autoCapitalize="none"
                />
              </div>
              <div>
                <label className={labelClass}>Nome de exibição</label>
                <input
                  value={form.nome_exibicao}
                  onChange={(e) => setForm((f) => ({ ...f, nome_exibicao: e.target.value }))}
                  className={inputClass}
                  placeholder="ex: Ryan"
                />
              </div>
              {!editando && (
                <div>
                  <label className={labelClass}>Senha</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className={inputClass}
                    placeholder="mínimo 6 caracteres"
                  />
                </div>
              )}
              <div>
                <label className={labelClass}>Papéis</label>
                <p className="text-xs text-text-faint mb-2">
                  Pode marcar mais de um — ex: "Estoque (leitura)" + "Mandados" pra ver o estoque e também receber tarefas.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_ROLES.map((r) => {
                    const marcado = form.roles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        disabled={editando?.id === meuId}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            roles: marcado ? f.roles.filter((x) => x !== r) : [...f.roles, r],
                          }))
                        }
                        className={cn(
                          'flex items-center gap-2 py-2.5 px-3 rounded-control border text-sm text-left transition-colors disabled:opacity-50',
                          marcado ? 'bg-accent-soft-bg border-accent/30 text-accent-soft-fg' : 'bg-surface-inset border-border-default text-text-secondary'
                        )}
                      >
                        <span className={cn('size-4 rounded shrink-0 flex items-center justify-center border', marcado ? 'bg-accent border-accent text-white' : 'border-border-default')}>
                          {marcado && <Check size={12} />}
                        </span>
                        {ROLE_LABEL[r]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-border-subtle">
              <button onClick={() => setIsFormOpen(false)} className="flex-1 py-3 rounded-control font-medium text-sm border border-border-default text-text-secondary hover:bg-surface-raised">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} className="flex-1 py-3 rounded-control font-medium text-sm bg-accent text-white hover:opacity-90 disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {redefinindoSenhaDe && (
        <div
          className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center"
          onClick={() => {
            setRedefinindoSenhaDe(null);
            setNovaSenha('');
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm flex flex-col overflow-hidden rounded-t-card md:rounded-card bg-surface-page text-text-primary border border-border-subtle"
          >
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-lg font-medium">Redefinir senha de {redefinindoSenhaDe.nome_exibicao}</h2>
            </div>
            <div className="p-6">
              <label className={labelClass}>Nova senha</label>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className={inputClass}
                placeholder="mínimo 6 caracteres"
                autoFocus
              />
            </div>
            <div className="flex gap-3 p-6 border-t border-border-subtle">
              <button
                onClick={() => {
                  setRedefinindoSenhaDe(null);
                  setNovaSenha('');
                }}
                className="flex-1 py-3 rounded-control font-medium text-sm border border-border-default text-text-secondary hover:bg-surface-raised"
              >
                Cancelar
              </button>
              <button onClick={confirmarRedefinicao} className="flex-1 py-3 rounded-control font-medium text-sm bg-accent text-white hover:opacity-90">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {desativando && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center" onClick={() => setDesativando(null)}>
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm flex flex-col overflow-hidden rounded-t-card md:rounded-card bg-surface-page text-text-primary border border-border-subtle p-6 space-y-4">
            <h2 className="text-lg font-medium">Desativar {desativando.nome_exibicao}?</h2>
            <p className="text-sm text-text-secondary">A conta @{desativando.username} não vai conseguir mais entrar no sistema até ser reativada.</p>
            <div className="flex gap-3">
              <button onClick={() => setDesativando(null)} className="flex-1 py-3 rounded-control font-medium text-sm border border-border-default text-text-secondary hover:bg-surface-raised">
                Cancelar
              </button>
              <button onClick={confirmarDesativacao} className="flex-1 py-3 rounded-control font-medium text-sm bg-danger text-surface-page hover:opacity-90">
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
