// Aba Tarefas: admin/equipe criam e atribuem, quem tem um cargo "executor"
// (EXECUTORES_TAREFA — mandados/Pitoco, mecanico/Itinho) só vê e dá baixa nas
// próprias. Um componente só, dois modos de renderização por papel — ver
// App.tsx (TAB_ROLES) pra quem enxerga esta aba. As duas visões usam a grade
// de cards expansíveis (TarefaCards); o que muda é o conjunto de ações.
import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, Pencil, Trash2, CheckCircle2, RotateCcw, Loader2, MapPin, MoreHorizontal } from 'lucide-react';
import { cn } from '../../utils';
import { aviso } from '../../components/ui/toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Button } from '@/src/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../../components/ui/dropdown-menu';
import { SeletorCliente } from '../clientes/SeletorCliente';
import { LembretesView } from '../lembretes/LembretesView';
import { TarefaCards } from './TarefaCards';
import { useTarefas } from './useTarefas';
import { tarefasApi } from './api';
import { EXECUTORES_TAREFA } from '../../constants/roles';
import type { Role } from '../../constants/roles';
import { PRIORIDADE_LABELS, paraDatetimeLocal } from './tarefaUtils';
import type { Tarefa, TarefaInput, TarefaPrioridade, UsuarioResumo } from './types';

const EMPTY_FORM: TarefaInput = { titulo: '', descricao: '', prazo: '', atribuido_para: '', cliente_id: null, prioridade: 'media', tipo: 'geral' };

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
              'h-11 sm:h-9 px-4 sm:px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider transition-colors',
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
        <VisaoResponsavel tarefas={tarefas} setTarefas={setTarefas} loading={loading} error={error} refetch={refetch} />
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
  refetch,
}: {
  tarefas: Tarefa[];
  setTarefas: (fn: (prev: Tarefa[]) => Tarefa[]) => void;
  loading: boolean;
  error: string | null;
  refetch: () => void;
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

  // Estilo outline (não accent-preenchido de propósito): a lista pode ter
  // várias tarefas pendentes ao mesmo tempo, e o design system permite no
  // máximo um botão de acento preenchido por tela — aqui o verde (positive) já
  // carrega o significado de "concluir".
  const botaoConcluir = (tarefa: Tarefa) =>
    tarefa.status !== 'concluida' ? (
      <Button
        variant="outline"
        onClick={() => concluir(tarefa)}
        disabled={concluindo === tarefa.id}
        className="h-11 sm:h-9 px-4 rounded-control border-positive/30 bg-positive-bg text-positive text-[11px] font-semibold uppercase tracking-wider hover:text-positive"
      >
        <CheckCircle2 size={14} /> {concluindo === tarefa.id ? 'Concluindo...' : 'Concluir'}
      </Button>
    ) : null;

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
        <TarefaCards tarefas={tarefas} renderAcaoRapida={botaoConcluir} renderAcoes={(t) => botaoConcluir(t)} onContatoSalvo={refetch} />
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

  // Menu de ação (⋯) de cada tarefa — o DropdownMenu animado. Concluir/reabrir
  // é sempre permitido (regra do backend); editar/excluir só pra quem pode.
  const menuTarefa = (t: Tarefa) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex size-10 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-surface-inset hover:text-text-primary active:bg-surface-inset"
          title="Ações"
          disabled={alterandoStatus === t.id}
        >
          {alterandoStatus === t.id ? <Loader2 size={18} className="animate-spin" /> : <MoreHorizontal size={18} />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => alternarStatus(t)}>
          {t.status === 'concluida' ? <RotateCcw /> : <CheckCircle2 />}
          {t.status === 'concluida' ? 'Reabrir' : 'Marcar como concluída'}
        </DropdownMenuItem>
        {podeEditar(t) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => abrirEditar(t)}>
              <Pencil /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem variant="danger" onSelect={() => setExcluindo(t)}>
              <Trash2 /> Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-text-primary">Tarefas</h1>
          <p className="text-sm text-text-faint mt-0.5">Mandados pra equipe de campo (Itinho, Pitoco e outros mecânicos/mandados)</p>
        </div>
        <Button
          onClick={abrirCriar}
          disabled={responsaveis.length === 0}
          className="h-11 md:h-10 px-5 rounded-control text-[11px] font-semibold uppercase tracking-wider shadow-sm self-start md:self-auto"
        >
          <Plus size={16} /> Nova tarefa
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {(['todas', 'pendente', 'concluida'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={cn(
              'h-11 sm:h-9 px-4 sm:px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider transition-colors',
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

      {loading && tarefas.length === 0 ? (
        <div className="py-12 flex items-center justify-center text-text-faint">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <EmptyState icone={ClipboardList} mensagem="Nenhuma tarefa por aqui." />
      ) : (
        <TarefaCards tarefas={filtradas} renderMenu={menuTarefa} onContatoSalvo={refetch} />
      )}

      <Modal
        aberto={isFormOpen}
        onFechar={() => setIsFormOpen(false)}
        titulo={editando ? 'Editar tarefa' : 'Nova tarefa'}
        tamanho="md"
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
          <div className="flex items-center gap-2">
            {(['geral', 'visita'] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipo }))}
                className={cn(
                  'h-11 sm:h-9 px-4 sm:px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5',
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
            <Button variant="outline" onClick={() => setExcluindo(null)} className="h-auto flex-1 py-3 rounded-control font-medium text-sm border-border-default">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarExclusao} className="h-auto flex-1 py-3 rounded-control font-medium text-sm">
              Excluir
            </Button>
          </div>
        }
      >
        {excluindo && <p className="text-sm text-text-secondary">"{excluindo.titulo}" será removida definitivamente.</p>}
      </Modal>
    </div>
  );
}
