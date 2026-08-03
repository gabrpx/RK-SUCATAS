// Aba Tarefas: admin/equipe criam e atribuem, quem tem um cargo "executor"
// (EXECUTORES_TAREFA — mandados/Pitoco, mecanico/Itinho) só vê e dá baixa nas
// próprias. Um componente só, dois modos de renderização por papel — ver
// App.tsx (TAB_ROLES) pra quem enxerga esta aba.
import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, Pencil, Trash2, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { cn } from '../../utils';
import { DataTable } from '../../components/ui/DataTable';
import type { DataTableColumn } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTarefas } from './useTarefas';
import { tarefasApi } from './api';
import { EXECUTORES_TAREFA } from '../../constants/roles';
import type { Role } from '../../constants/roles';
import type { Tarefa, TarefaInput, UsuarioResumo } from './types';

const EMPTY_FORM: TarefaInput = { titulo: '', descricao: '', prazo: '', atribuido_para: '' };

function formatarPrazo(prazo: string | null) {
  if (!prazo) return null;
  return new Date(prazo).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function estaVencida(tarefa: Tarefa) {
  return tarefa.status === 'pendente' && !!tarefa.prazo && new Date(tarefa.prazo).getTime() < Date.now();
}

// Converte o valor do <input type="datetime-local"> (sem timezone) pra ISO,
// e o inverso, pra reabrir o form de edição já preenchido.
function paraDatetimeLocal(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TarefasView({ userRole }: { userRole: string }) {
  const { tarefas, setTarefas, loading, error, refetch } = useTarefas();
  const ehResponsavel = EXECUTORES_TAREFA.includes(userRole as Role);
  const meuId = localStorage.getItem('user_id');

  if (ehResponsavel) return <VisaoResponsavel tarefas={tarefas} setTarefas={setTarefas} loading={loading} error={error} />;
  return <VisaoCriador tarefas={tarefas} loading={loading} error={error} refetch={refetch} userRole={userRole} meuId={meuId} />;
}

// =============================================================================
// Visão do responsável (mandados/mecanico): só as próprias, dá baixa com um toque.
// =============================================================================
function VisaoResponsavel({
  tarefas,
  setTarefas,
  loading,
  error,
}: {
  tarefas: Tarefa[];
  setTarefas: (fn: (prev: Tarefa[]) => Tarefa[]) => void;
  loading: boolean;
  error: string | null;
}) {
  const [concluindo, setConcluindo] = useState<string | null>(null);

  const concluir = async (tarefa: Tarefa) => {
    setConcluindo(tarefa.id);
    try {
      const result = await tarefasApi.concluir(tarefa.id);
      if (!result.success) throw new Error(result.error);
      setTarefas((prev) => prev.map((t) => (t.id === tarefa.id ? result.data : t)));
    } catch (err: any) {
      alert(err.message || 'Erro ao concluir tarefa');
    } finally {
      setConcluindo(null);
    }
  };

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div>
        <h1 className="text-2xl font-medium text-text-primary">Minhas tarefas</h1>
        <p className="text-sm text-text-faint mt-0.5">O que precisa ser feito, na ordem de prazo</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {loading && tarefas.length === 0 ? (
        <div className="py-12 flex items-center justify-center text-text-faint">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : tarefas.length === 0 ? (
        <EmptyState icone={ClipboardList} mensagem="Nenhuma tarefa pra você no momento." />
      ) : (
        <div className="space-y-3">
          {tarefas.map((tarefa) => {
            const vencida = estaVencida(tarefa);
            const concluida = tarefa.status === 'concluida';
            return (
              <div key={tarefa.id} className="bg-surface-card border border-border-subtle rounded-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={cn('text-base font-medium text-text-primary', concluida && 'line-through opacity-60')}>{tarefa.titulo}</p>
                    {tarefa.descricao && <p className="text-sm text-text-secondary mt-1">{tarefa.descricao}</p>}
                  </div>
                  {concluida ? (
                    <StatusBadge texto="Concluída" tom="positive" />
                  ) : vencida ? (
                    <StatusBadge texto="Atrasada" tom="danger" />
                  ) : (
                    <StatusBadge texto="Pendente" tom="warning" />
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  {tarefa.prazo ? (
                    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', vencida ? 'text-danger' : 'text-text-faint')}>
                      <Clock size={12} /> até {formatarPrazo(tarefa.prazo)}
                    </span>
                  ) : (
                    <span />
                  )}

                  {!concluida && (
                    // Estilo outline (não accent-preenchido de propósito): a lista pode
                    // ter várias tarefas pendentes ao mesmo tempo, e o design system
                    // permite no máximo um botão de acento preenchido por tela — aqui
                    // o verde (positive) já carrega o significado de "concluir".
                    <button
                      onClick={() => concluir(tarefa)}
                      disabled={concluindo === tarefa.id}
                      className="h-9 px-4 rounded-control border border-positive/30 bg-positive-bg text-positive text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 hover:opacity-80 disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} /> {concluindo === tarefa.id ? 'Concluindo...' : 'Concluir'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Visão de quem cria (admin/equipe): lista tudo, cria/edita/exclui.
// =============================================================================
function VisaoCriador({
  tarefas,
  loading,
  error,
  refetch,
  userRole,
  meuId,
}: {
  tarefas: Tarefa[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  userRole: string;
  meuId: string | null;
}) {
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendente' | 'concluida'>('todas');
  const [responsaveis, setResponsaveis] = useState<UsuarioResumo[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editando, setEditando] = useState<Tarefa | null>(null);
  const [form, setForm] = useState<TarefaInput>(EMPTY_FORM);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<Tarefa | null>(null);

  useEffect(() => {
    tarefasApi.listarResponsaveisPossiveis().then((r) => {
      if (r.success) setResponsaveis(r.data);
    });
  }, []);

  const filtradas = useMemo(() => (filtroStatus === 'todas' ? tarefas : tarefas.filter((t) => t.status === filtroStatus)), [tarefas, filtroStatus]);

  const podeEditar = (tarefa: Tarefa) => userRole === 'admin' || tarefa.criado_por === meuId;

  const abrirCriar = () => {
    setEditando(null);
    setForm({ ...EMPTY_FORM, atribuido_para: responsaveis[0]?.id || '' });
    setErroForm(null);
    setIsFormOpen(true);
  };

  const abrirEditar = (tarefa: Tarefa) => {
    setEditando(tarefa);
    setForm({ titulo: tarefa.titulo, descricao: tarefa.descricao || '', prazo: paraDatetimeLocal(tarefa.prazo), atribuido_para: tarefa.atribuido_para });
    setErroForm(null);
    setIsFormOpen(true);
  };

  const salvar = async () => {
    if (!form.titulo.trim()) return setErroForm('Título é obrigatório');
    if (!form.atribuido_para) return setErroForm('Escolha um responsável');

    setSalvando(true);
    setErroForm(null);
    const payload: TarefaInput = {
      titulo: form.titulo.trim(),
      descricao: form.descricao?.trim() || null,
      prazo: form.prazo ? new Date(form.prazo).toISOString() : null,
      atribuido_para: form.atribuido_para,
    };
    try {
      const result = editando ? await tarefasApi.atualizar(editando.id, payload) : await tarefasApi.criar(payload);
      if (!result.success) throw new Error(result.error);
      setIsFormOpen(false);
      refetch();
    } catch (err: any) {
      setErroForm(err.message || 'Erro ao salvar tarefa');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    try {
      const result = await tarefasApi.excluir(excluindo.id);
      if (!result.success) throw new Error(result.error);
      setExcluindo(null);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir tarefa');
    }
  };

  const inputClass =
    'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';
  const labelClass = 'text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted';

  const colunas: DataTableColumn<Tarefa>[] = [
    {
      key: 'titulo',
      header: 'Tarefa',
      render: (t) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary">{t.titulo}</span>
          {t.descricao && <span className="text-xs text-text-faint line-clamp-1">{t.descricao}</span>}
        </div>
      ),
    },
    { key: 'responsavel', header: 'Responsável', render: (t) => t.atribuido?.nome_exibicao || '—' },
    {
      key: 'prazo',
      header: 'Prazo',
      render: (t) => (t.prazo ? <span className={cn(estaVencida(t) && 'text-danger font-medium')}>{formatarPrazo(t.prazo)}</span> : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) =>
        t.status === 'concluida' ? <StatusBadge texto="Concluída" tom="positive" /> : estaVencida(t) ? <StatusBadge texto="Atrasada" tom="danger" /> : <StatusBadge texto="Pendente" tom="warning" />,
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (t) =>
        podeEditar(t) ? (
          <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={() => abrirEditar(t)} title="Editar" className="size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary">
              <Pencil size={14} />
            </button>
            <button type="button" onClick={() => setExcluindo(t)} title="Excluir" className="size-7 flex items-center justify-center rounded-control text-danger hover:bg-surface-raised">
              <Trash2 size={14} />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-text-primary">Tarefas</h1>
          <p className="text-sm text-text-faint mt-0.5">Mandados pra equipe de campo (Itinho, Pitoco e outros mecânicos/mandados)</p>
        </div>
        <button
          onClick={abrirCriar}
          disabled={responsaveis.length === 0}
          className="h-10 px-5 rounded-control bg-accent text-white text-[11px] font-semibold uppercase tracking-wider shadow-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-50 self-start md:self-auto"
        >
          <Plus size={16} /> Nova tarefa
        </button>
      </div>

      <div className="flex items-center gap-2">
        {(['todas', 'pendente', 'concluida'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={cn(
              'h-9 px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider transition-colors',
              filtroStatus === s ? 'bg-accent-soft-bg border-accent/30 text-accent-soft-fg' : 'bg-surface-inset border-border-default text-text-muted hover:text-text-secondary'
            )}
          >
            {s === 'todas' ? 'Todas' : s === 'pendente' ? 'Pendentes' : 'Concluídas'}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {responsaveis.length === 0 && !loading && (
        <p className="text-sm text-text-faint">
          Nenhum usuário com papel "Mandados" ou "Mecânico" cadastrado ainda — crie um em Configurações → Usuários antes de atribuir tarefas.
        </p>
      )}

      <DataTable
        colunas={colunas}
        dados={loading ? [] : filtradas}
        getRowKey={(t) => t.id}
        destaqueLinha={estaVencida}
        paginaAtual={1}
        totalPaginas={1}
        onMudarPagina={() => {}}
        emptyState={
          loading ? (
            <div className="py-12 flex items-center justify-center text-text-faint">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <EmptyState icone={ClipboardList} mensagem="Nenhuma tarefa por aqui." />
          )
        }
      />

      {isFormOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center" onClick={() => setIsFormOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md flex flex-col overflow-hidden rounded-t-card md:rounded-card bg-surface-page text-text-primary border border-border-subtle"
          >
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-lg font-medium">{editando ? 'Editar tarefa' : 'Nova tarefa'}</h2>
            </div>
            <div className="p-6 space-y-4">
              {erroForm && <p className="text-sm text-danger">{erroForm}</p>}
              <div>
                <label className={labelClass}>Título</label>
                <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} className={inputClass} placeholder="ex: Buscar peça no fornecedor" />
              </div>
              <div>
                <label className={labelClass}>Descrição</label>
                <textarea
                  value={form.descricao || ''}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  className={cn(inputClass, 'min-h-20 resize-none')}
                  placeholder="Detalhes do que precisa ser feito"
                />
              </div>
              <div>
                <label className={labelClass}>Prazo</label>
                <input type="datetime-local" value={form.prazo || ''} onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Responsável</label>
                <select value={form.atribuido_para} onChange={(e) => setForm((f) => ({ ...f, atribuido_para: e.target.value }))} className={inputClass}>
                  {responsaveis.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome_exibicao}
                    </option>
                  ))}
                </select>
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

      {excluindo && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center" onClick={() => setExcluindo(null)}>
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm flex flex-col overflow-hidden rounded-t-card md:rounded-card bg-surface-page text-text-primary border border-border-subtle p-6 space-y-4">
            <h2 className="text-lg font-medium">Excluir tarefa?</h2>
            <p className="text-sm text-text-secondary">"{excluindo.titulo}" será removida definitivamente.</p>
            <div className="flex gap-3">
              <button onClick={() => setExcluindo(null)} className="flex-1 py-3 rounded-control font-medium text-sm border border-border-default text-text-secondary hover:bg-surface-raised">
                Cancelar
              </button>
              <button onClick={confirmarExclusao} className="flex-1 py-3 rounded-control font-medium text-sm bg-danger text-surface-page hover:opacity-90">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
