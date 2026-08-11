// Aba Tarefas: admin/equipe criam e atribuem, quem tem um cargo "executor"
// (EXECUTORES_TAREFA — mandados/Pitoco, mecanico/Itinho) só vê e dá baixa nas
// próprias. Um componente só, dois modos de renderização por papel — ver
// App.tsx (TAB_ROLES) pra quem enxerga esta aba.
import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, Pencil, Trash2, CheckCircle2, RotateCcw, Clock, Loader2, MapPin, Phone } from 'lucide-react';
import { cn } from '../../utils';
import { aviso } from '../../components/ui/toast';
import { DataTable } from '../../components/ui/DataTable';
import type { DataTableColumn } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { StatusTone } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { SeletorCliente } from '../clientes/SeletorCliente';
import { LembretesView } from '../lembretes/LembretesView';
import { useTarefas } from './useTarefas';
import { tarefasApi } from './api';
import { EXECUTORES_TAREFA } from '../../constants/roles';
import type { Role } from '../../constants/roles';
import type { Tarefa, TarefaInput, TarefaPrioridade, UsuarioResumo } from './types';

const EMPTY_FORM: TarefaInput = { titulo: '', descricao: '', prazo: '', atribuido_para: '', cliente_id: null, prioridade: 'media', tipo: 'geral' };

const PRIORIDADE_LABELS: Record<TarefaPrioridade, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };
const PRIORIDADE_TONS: Record<TarefaPrioridade, StatusTone> = { baixa: 'neutral', media: 'warning', alta: 'danger' };

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

export function TarefasView({ userRoles }: { userRoles: string[] }) {
  const [aba, setAba] = useState<'tarefas' | 'lembretes'>('tarefas');
  const { tarefas, setTarefas, loading, error, refetch } = useTarefas();
  // Admin/equipe sempre cai na visão de quem cria, mesmo se também tiver um
  // papel executor (mandados/mecanico) — só quem é EXCLUSIVAMENTE executor
  // (ex: estoque_leitura + mandados) fica na visão restrita "minhas tarefas".
  const ehAdminOuEquipe = userRoles.includes('admin') || userRoles.includes('equipe');
  const ehResponsavel = !ehAdminOuEquipe && userRoles.some((r) => EXECUTORES_TAREFA.includes(r as Role));
  const meuId = localStorage.getItem('user_id');

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Sub-abas: Tarefas (o que já existia) / Lembretes (avisos pessoais/atribuíveis) */}
      <div className="flex items-center gap-2">
        {(['tarefas', 'lembretes'] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={cn(
              'h-9 px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider transition-colors',
              aba === a ? 'bg-accent-soft-bg border-accent/30 text-accent-soft-fg' : 'bg-surface-inset border-border-default text-text-muted hover:text-text-secondary'
            )}
          >
            {a === 'tarefas' ? 'Tarefas' : 'Lembretes'}
          </button>
        ))}
      </div>

      {aba === 'lembretes' ? (
        <LembretesView userRoles={userRoles} />
      ) : ehResponsavel ? (
        <VisaoResponsavel tarefas={tarefas} setTarefas={setTarefas} loading={loading} error={error} />
      ) : (
        <VisaoCriador tarefas={tarefas} loading={loading} error={error} refetch={refetch} userRoles={userRoles} meuId={meuId} />
      )}
    </div>
  );
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
      aviso.falha(err, 'Erro ao concluir tarefa');
    } finally {
      setConcluindo(null);
    }
  };

  return (
    <div className="space-y-4">
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {tarefa.tipo === 'visita' && <MapPin size={13} className="text-accent shrink-0" />}
                      <p className={cn('text-base font-medium text-text-primary', concluida && 'line-through opacity-60')}>{tarefa.titulo}</p>
                    </div>
                    {tarefa.descricao && <p className="text-sm text-text-secondary mt-1">{tarefa.descricao}</p>}
                    {tarefa.cliente && (
                      <p className="text-xs text-text-faint mt-1 flex items-center gap-1.5">
                        {tarefa.cliente.nome}
                        {tarefa.cliente.telefone && (
                          <span className="inline-flex items-center gap-0.5">
                            <Phone size={10} /> {tarefa.cliente.telefone}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {concluida ? (
                      <StatusBadge texto="Concluída" tom="positive" />
                    ) : vencida ? (
                      <StatusBadge texto="Atrasada" tom="danger" />
                    ) : (
                      <StatusBadge texto="Pendente" tom="warning" />
                    )}
                    {!concluida && tarefa.prioridade !== 'media' && <StatusBadge texto={PRIORIDADE_LABELS[tarefa.prioridade]} tom={PRIORIDADE_TONS[tarefa.prioridade]} />}
                  </div>
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
  userRoles,
  meuId,
}: {
  tarefas: Tarefa[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  userRoles: string[];
  meuId: string | null;
}) {
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendente' | 'concluida'>('todas');
  const [responsaveis, setResponsaveis] = useState<UsuarioResumo[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editando, setEditando] = useState<Tarefa | null>(null);
  const [form, setForm] = useState<TarefaInput>(EMPTY_FORM);
  // Só pra exibição no SeletorCliente — o que de fato é salvo é form.cliente_id.
  const [clienteNomeTexto, setClienteNomeTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<Tarefa | null>(null);
  const [alterandoStatus, setAlterandoStatus] = useState<string | null>(null);

  useEffect(() => {
    tarefasApi.listarResponsaveisPossiveis().then((r) => {
      if (r.success) setResponsaveis(r.data);
    });
  }, []);

  const filtradas = useMemo(() => (filtroStatus === 'todas' ? tarefas : tarefas.filter((t) => t.status === filtroStatus)), [tarefas, filtroStatus]);

  const podeEditar = (tarefa: Tarefa) => userRoles.includes('admin') || tarefa.criado_por === meuId;

  const abrirCriar = () => {
    setEditando(null);
    setForm({ ...EMPTY_FORM, atribuido_para: responsaveis[0]?.id || '' });
    setClienteNomeTexto('');
    setErroForm(null);
    setIsFormOpen(true);
  };

  const abrirEditar = (tarefa: Tarefa) => {
    setEditando(tarefa);
    setForm({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao || '',
      prazo: paraDatetimeLocal(tarefa.prazo),
      atribuido_para: tarefa.atribuido_para,
      cliente_id: tarefa.cliente_id,
      prioridade: tarefa.prioridade,
      tipo: tarefa.tipo,
    });
    setClienteNomeTexto(tarefa.cliente?.nome || '');
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
      cliente_id: form.cliente_id || null,
      prioridade: form.prioridade || 'media',
      tipo: form.tipo || 'geral',
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

  // Admin/equipe podem dar baixa (ou reverter) em qualquer tarefa, não só na
  // que criaram — mesma regra do backend (ver podeConcluir em
  // src/server/routes/tarefas.ts), diferente de podeEditar acima, que é
  // restrito ao criador quando o papel é equipe.
  const alternarStatus = async (tarefa: Tarefa) => {
    setAlterandoStatus(tarefa.id);
    try {
      const result = tarefa.status === 'concluida' ? await tarefasApi.reabrir(tarefa.id) : await tarefasApi.concluir(tarefa.id);
      if (!result.success) throw new Error(result.error);
      refetch();
    } catch (err: any) {
      aviso.falha(err, tarefa.status === 'concluida' ? 'Erro ao reabrir tarefa' : 'Erro ao concluir tarefa');
    } finally {
      setAlterandoStatus(null);
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
      aviso.falha(err, 'Erro ao excluir tarefa');
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
          <span className="text-sm font-medium text-text-primary flex items-center gap-1.5">
            {t.tipo === 'visita' && <MapPin size={12} className="text-accent shrink-0" />}
            {t.titulo}
          </span>
          {t.descricao && <span className="text-xs text-text-faint line-clamp-1">{t.descricao}</span>}
          {t.cliente && <span className="text-xs text-text-faint">{t.cliente.nome}</span>}
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
      key: 'prioridade',
      header: 'Prioridade',
      render: (t) => <StatusBadge texto={PRIORIDADE_LABELS[t.prioridade]} tom={PRIORIDADE_TONS[t.prioridade]} />,
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
      render: (t) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => alternarStatus(t)}
            disabled={alterandoStatus === t.id}
            title={t.status === 'concluida' ? 'Reabrir' : 'Marcar como concluída'}
            className={cn(
              'size-7 flex items-center justify-center rounded-control hover:bg-surface-raised disabled:opacity-50',
              t.status === 'concluida' ? 'text-text-muted hover:text-text-primary' : 'text-positive'
            )}
          >
            {alterandoStatus === t.id ? <Loader2 size={14} className="animate-spin" /> : t.status === 'concluida' ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
          </button>
          {podeEditar(t) && (
            <>
              <button type="button" onClick={() => abrirEditar(t)} title="Editar" className="size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary">
                <Pencil size={14} />
              </button>
              <button type="button" onClick={() => setExcluindo(t)} title="Excluir" className="size-7 flex items-center justify-center rounded-control text-danger hover:bg-surface-raised">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  // Mesmas colunas acima, empilhadas — usado pelo DataTable abaixo de `md`.
  function renderMobileCard(t: Tarefa) {
    return (
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate flex items-center gap-1.5">
              {t.tipo === 'visita' && <MapPin size={12} className="text-accent shrink-0" />}
              {t.titulo}
            </p>
            {t.descricao && <p className="text-xs text-text-faint line-clamp-1">{t.descricao}</p>}
            {t.cliente && <p className="text-xs text-text-faint">{t.cliente.nome}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => alternarStatus(t)}
              disabled={alterandoStatus === t.id}
              title={t.status === 'concluida' ? 'Reabrir' : 'Marcar como concluída'}
              className={cn(
                'size-7 flex items-center justify-center rounded-control hover:bg-surface-raised disabled:opacity-50',
                t.status === 'concluida' ? 'text-text-muted hover:text-text-primary' : 'text-positive'
              )}
            >
              {alterandoStatus === t.id ? <Loader2 size={14} className="animate-spin" /> : t.status === 'concluida' ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
            </button>
            {podeEditar(t) && (
              <>
                <button type="button" onClick={() => abrirEditar(t)} title="Editar" className="size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary">
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => setExcluindo(t)} title="Excluir" className="size-7 flex items-center justify-center rounded-control text-danger hover:bg-surface-raised">
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {t.status === 'concluida' ? (
            <StatusBadge texto="Concluída" tom="positive" />
          ) : estaVencida(t) ? (
            <StatusBadge texto="Atrasada" tom="danger" />
          ) : (
            <StatusBadge texto="Pendente" tom="warning" />
          )}
          <span className="text-xs text-text-faint">{t.atribuido?.nome_exibicao || '—'}</span>
          {t.prazo && <span className={cn('text-xs', estaVencida(t) ? 'text-danger font-medium' : 'text-text-faint')}>{formatarPrazo(t.prazo)}</span>}
          <StatusBadge texto={PRIORIDADE_LABELS[t.prioridade]} tom={PRIORIDADE_TONS[t.prioridade]} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            <EmptyState icone={ClipboardList} mensagem="Nenhuma tarefa por aqui." />
          )
        }
      />

      <Modal
        aberto={isFormOpen}
        onFechar={() => setIsFormOpen(false)}
        titulo={editando ? 'Editar tarefa' : 'Nova tarefa'}
        tamanho="md"
        rodape={
          <div className="flex gap-3">
            <button onClick={() => setIsFormOpen(false)} className="flex-1 py-3 rounded-control font-medium text-sm border border-border-default text-text-secondary hover:bg-surface-raised">
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando} className="flex-1 py-3 rounded-control font-medium text-sm bg-accent text-white hover:opacity-90 disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {erroForm && <p className="text-sm text-danger">{erroForm}</p>}
          <div className="flex items-center gap-2">
            {(['geral', 'visita'] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipo }))}
                className={cn(
                  'h-9 px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5',
                  form.tipo === tipo ? 'bg-accent-soft-bg border-accent/30 text-accent-soft-fg' : 'bg-surface-inset border-border-default text-text-muted hover:text-text-secondary'
                )}
              >
                {tipo === 'visita' && <MapPin size={12} />}
                {tipo === 'geral' ? 'Tarefa geral' : 'Visita à loja'}
              </button>
            ))}
          </div>
          <div>
            <label className={labelClass}>Título</label>
            <input
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              className={inputClass}
              placeholder={form.tipo === 'visita' ? 'ex: Visita pra ver a moto' : 'ex: Buscar peça no fornecedor'}
            />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Prazo</label>
              <input type="datetime-local" value={form.prazo || ''} onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Prioridade</label>
              <select value={form.prioridade} onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value as TarefaPrioridade }))} className={inputClass}>
                {(['baixa', 'media', 'alta'] as const).map((p) => (
                  <option key={p} value={p}>
                    {PRIORIDADE_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
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
          <div>
            <label className={labelClass}>Cliente (opcional)</label>
            <SeletorCliente
              clienteId={form.cliente_id || null}
              nome={clienteNomeTexto}
              onChange={(id, nome) => {
                setForm((f) => ({ ...f, cliente_id: id }));
                setClienteNomeTexto(nome);
              }}
              placeholder="Vincular a um cliente cadastrado"
            />
          </div>
        </div>
      </Modal>

      <Modal
        aberto={!!excluindo}
        onFechar={() => setExcluindo(null)}
        titulo="Excluir tarefa?"
        tamanho="sm"
        rodape={
          <div className="flex gap-3">
            <button onClick={() => setExcluindo(null)} className="flex-1 py-3 rounded-control font-medium text-sm border border-border-default text-text-secondary hover:bg-surface-raised">
              Cancelar
            </button>
            <button onClick={confirmarExclusao} className="flex-1 py-3 rounded-control font-medium text-sm bg-danger text-surface-page hover:opacity-90">
              Excluir
            </button>
          </div>
        }
      >
        {excluindo && <p className="text-sm text-text-secondary">"{excluindo.titulo}" será removida definitivamente.</p>}
      </Modal>
    </div>
  );
}
