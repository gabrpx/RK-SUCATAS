// Gestão de usuários — visível só pro admin (Ayrton), embutida como uma aba
// a mais dentro de Configurações (ver ConfiguracoesView.tsx). Cada pessoa tem
// seu próprio login e um mapa de PERMISSÕES por tela/ação (EditorPermissoes,
// catálogo em src/constants/permissoes.ts) que define exatamente o que ela vê
// e faz. `roles` sobrou só pra marcar quem é administrador — o super-usuário,
// que ignora o mapa e é o único que abre esta tela.
import { Fragment, useEffect, useState } from 'react';
import { UserPlus, KeyRound, Pencil, Ban, RotateCcw, Loader2, Check, Trash2 } from 'lucide-react';
import { cn } from '../../utils';
import { aviso } from '../../components/ui/toast';
import { DataTable } from '../../components/ui/DataTable';
import type { DataTableColumn } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { StatusTone } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Button } from '@/src/components/ui/button';
import { usuariosApi } from './api';
import { EditorPermissoes } from './EditorPermissoes';
import { CATALOGO_PERMISSOES } from '../../constants/permissoes';
import type { Permissoes } from '../../constants/permissoes';
import type { Usuario, UsuarioInput } from './types';

// `roles` virou um sinalizador binário: ['admin'] = super-usuário, ['equipe']
// = usuário comum (valor inerte, só pra satisfazer o NOT NULL/validação da
// coluna — nenhum gate lê 'equipe' desde a migration 047). O acesso de quem
// não é admin vem inteiro de `permissoes`.
const ROLES_ADMIN = ['admin'] as const;
const ROLES_COMUM = ['equipe'] as const;

const EMPTY_FORM: UsuarioInput = { username: '', nome_exibicao: '', password: '', roles: [...ROLES_COMUM], permissoes: {} };

// Resumo pra tabela: quais telas a pessoa enxerga.
function telasVisiveis(permissoes: Permissoes): string[] {
  return CATALOGO_PERMISSOES.filter((t) => permissoes?.[t.chave]?.ver === true).map((t) => t.rotulo);
}

function ResumoAcesso({ usuario }: { usuario: Usuario }) {
  if (usuario.roles.includes('admin')) return <StatusBadge texto="Administrador" tom={'accent' as StatusTone} />;
  const telas = telasVisiveis(usuario.permissoes ?? {});
  if (telas.length === 0) return <span className="text-xs text-text-faint">Sem acesso</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {telas.slice(0, 3).map((t) => (
        <Fragment key={t}>
          <StatusBadge texto={t} tom={'neutral' as StatusTone} />
        </Fragment>
      ))}
      {telas.length > 3 && <span className="text-xs text-text-faint self-center">+{telas.length - 3}</span>}
    </div>
  );
}

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

  const ehAdminNoForm = form.roles.includes('admin');
  // Ninguém edita o próprio nível de acesso (o backend também barra) — evita
  // se auto-rebaixar e perder a gestão de usuários.
  const editandoAMimMesmo = editando?.id === meuId;

  const [redefinindoSenhaDe, setRedefinindoSenhaDe] = useState<Usuario | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [desativando, setDesativando] = useState<Usuario | null>(null);
  const [excluindo, setExcluindo] = useState<Usuario | null>(null);

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
    setForm({
      username: usuario.username,
      nome_exibicao: usuario.nome_exibicao,
      password: '',
      roles: usuario.roles,
      permissoes: usuario.permissoes ?? {},
    });
    setErroForm(null);
    setIsFormOpen(true);
  };

  const salvar = async () => {
    setErroForm(null);
    if (!form.username.trim()) {
      setErroForm('Usuário não pode ficar em branco.');
      return;
    }
    if (!ehAdminNoForm && Object.keys(form.permissoes).length === 0) {
      setErroForm('Marque pelo menos uma tela que este usuário pode ver — ou torne-o administrador.');
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
        ? await usuariosApi.atualizar(editando.id, {
            username: form.username.trim(),
            nome_exibicao: form.nome_exibicao,
            roles: form.roles,
            permissoes: form.permissoes,
          })
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

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    try {
      const result = await usuariosApi.excluir(excluindo.id);
      if (!result.success) throw new Error(result.error);
      setExcluindo(null);
      await carregar();
    } catch (err: any) {
      aviso.falha(err, 'Erro ao excluir usuário');
      setExcluindo(null);
    }
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
      key: 'acesso',
      header: 'Acesso',
      render: (u) => <ResumoAcesso usuario={u} />,
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => abrirEditar(u)}
            title="Editar"
            className="size-7 rounded-control text-text-muted"
          >
            <Pencil size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setRedefinindoSenhaDe(u)}
            title="Redefinir senha"
            className="size-7 rounded-control text-text-muted"
          >
            <KeyRound size={14} />
          </Button>
          {u.id !== meuId && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => (u.ativo ? setDesativando(u) : alternarAtivo(u))}
                title={u.ativo ? 'Desativar' : 'Reativar'}
                className={cn('size-7 rounded-control', u.ativo ? 'text-danger hover:text-danger' : 'text-positive hover:text-positive')}
              >
                {u.ativo ? <Ban size={14} /> : <RotateCcw size={14} />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setExcluindo(u)}
                title="Excluir permanentemente"
                className="size-7 rounded-control text-danger hover:text-danger"
              >
                <Trash2 size={14} />
              </Button>
            </>
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
            <ResumoAcesso usuario={u} />
            <StatusBadge texto={u.ativo ? 'Ativo' : 'Inativo'} tom="positive" ativo={u.ativo} />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => abrirEditar(u)}
            title="Editar"
            className="size-7 rounded-control text-text-muted"
          >
            <Pencil size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setRedefinindoSenhaDe(u)}
            title="Redefinir senha"
            className="size-7 rounded-control text-text-muted"
          >
            <KeyRound size={14} />
          </Button>
          {u.id !== meuId && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => (u.ativo ? setDesativando(u) : alternarAtivo(u))}
                title={u.ativo ? 'Desativar' : 'Reativar'}
                className={cn('size-7 rounded-control', u.ativo ? 'text-danger hover:text-danger' : 'text-positive hover:text-positive')}
              >
                {u.ativo ? <Ban size={14} /> : <RotateCcw size={14} />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setExcluindo(u)}
                title="Excluir permanentemente"
                className="size-7 rounded-control text-danger hover:text-danger"
              >
                <Trash2 size={14} />
              </Button>
            </>
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
        <Button onClick={abrirCriar} className="h-10 px-5 rounded-control text-[11px] font-semibold uppercase tracking-wider shadow-sm">
          <UserPlus size={16} /> Novo usuário
        </Button>
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

      <Modal
        aberto={isFormOpen}
        onFechar={() => setIsFormOpen(false)}
        titulo={editando ? 'Editar usuário' : 'Novo usuário'}
        tamanho="lg"
        rodape={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="h-auto flex-1 py-3 rounded-control font-medium text-sm border-border-default">
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando} className="h-auto flex-1 py-3 rounded-control font-medium text-sm">
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
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
            <label className={labelClass}>Nível de acesso</label>
            <button
              type="button"
              disabled={editandoAMimMesmo}
              onClick={() =>
                setForm((f) => ({ ...f, roles: ehAdminNoForm ? [...ROLES_COMUM] : [...ROLES_ADMIN] }))
              }
              className={cn(
                'w-full flex items-start gap-2.5 py-3 px-3 rounded-control border text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                ehAdminNoForm ? 'bg-accent-soft-bg border-accent/30 text-accent-soft-fg' : 'bg-surface-inset border-border-default text-text-secondary'
              )}
            >
              <span
                className={cn(
                  'size-4 rounded shrink-0 mt-0.5 flex items-center justify-center border',
                  ehAdminNoForm ? 'bg-accent border-accent text-white' : 'border-border-default'
                )}
              >
                {ehAdminNoForm && <Check size={12} />}
              </span>
              <span>
                <span className="block text-sm font-medium">Administrador</span>
                <span className="block text-xs text-text-faint mt-0.5">
                  Acesso total ao sistema e único que gerencia usuários.
                </span>
              </span>
            </button>
            {editandoAMimMesmo && (
              <p className="text-xs text-text-faint mt-1.5">Você não pode alterar o próprio nível de acesso.</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Permissões</label>
            <p className="text-xs text-text-faint mb-2">
              Marque a tela pra liberar o acesso e, dentro dela, exatamente o que essa pessoa pode fazer.
            </p>
            <EditorPermissoes
              permissoes={form.permissoes}
              onChange={(permissoes) => setForm((f) => ({ ...f, permissoes }))}
              desabilitado={ehAdminNoForm}
            />
          </div>
        </div>
      </Modal>

      <Modal
        aberto={!!redefinindoSenhaDe}
        onFechar={() => {
          setRedefinindoSenhaDe(null);
          setNovaSenha('');
        }}
        titulo={redefinindoSenhaDe ? `Redefinir senha de ${redefinindoSenhaDe.nome_exibicao}` : 'Redefinir senha'}
        icone={KeyRound}
        tamanho="sm"
        rodape={
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setRedefinindoSenhaDe(null);
                setNovaSenha('');
              }}
              className="h-auto flex-1 py-3 rounded-control font-medium text-sm border-border-default"
            >
              Cancelar
            </Button>
            <Button onClick={confirmarRedefinicao} className="h-auto flex-1 py-3 rounded-control font-medium text-sm">
              Confirmar
            </Button>
          </div>
        }
      >
        <label className={labelClass}>Nova senha</label>
        <input
          type="password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          className={inputClass}
          placeholder="mínimo 6 caracteres"
          autoFocus
        />
      </Modal>

      <Modal
        aberto={!!desativando}
        onFechar={() => setDesativando(null)}
        titulo={desativando ? `Desativar ${desativando.nome_exibicao}?` : 'Desativar?'}
        icone={Ban}
        tamanho="sm"
        rodape={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDesativando(null)} className="h-auto flex-1 py-3 rounded-control font-medium text-sm border-border-default">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarDesativacao} className="h-auto flex-1 py-3 rounded-control font-medium text-sm">
              Desativar
            </Button>
          </div>
        }
      >
        {desativando && (
          <p className="text-sm text-text-secondary">A conta @{desativando.username} não vai conseguir mais entrar no sistema até ser reativada.</p>
        )}
      </Modal>

      <Modal
        aberto={!!excluindo}
        onFechar={() => setExcluindo(null)}
        titulo={excluindo ? `Excluir ${excluindo.nome_exibicao}?` : 'Excluir?'}
        icone={Trash2}
        tamanho="sm"
        rodape={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setExcluindo(null)} className="h-auto flex-1 py-3 rounded-control font-medium text-sm border-border-default">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarExclusao} className="h-auto flex-1 py-3 rounded-control font-medium text-sm">
              Excluir permanentemente
            </Button>
          </div>
        }
      >
        {excluindo && (
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">
              A conta @{excluindo.username} será <strong>removida permanentemente</strong> do sistema.
            </p>
            <p className="text-sm text-text-secondary">
              Tarefas, lembretes, notas e demais registros vinculados serão reatribuídos para você.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
