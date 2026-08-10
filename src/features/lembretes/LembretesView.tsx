// Sub-aba "Lembretes" dentro de Tarefas: avisos que repetem a cada N
// minutos até serem concluídos, ou disparam uma vez num horário específico
// (ver migration_042 e src/services/lembretesScheduler.ts). Cada usuário só
// vê os que criou ou os que foram atribuídos a ele — sem "visão de dono vê
// tudo" como em Tarefas, porque lembrete é mais pessoal que mandado de campo.
import { useEffect, useMemo, useState } from 'react';
import { Bell, Plus, Pencil, Trash2, CheckCircle2, RotateCcw, Repeat, Clock, Loader2 } from 'lucide-react';
import { cn } from '../../utils';
import { aviso } from '../../components/ui/toast';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { useLembretes } from './useLembretes';
import { lembretesApi } from './api';
import type { Lembrete, UsuarioResumo } from './types';

const INTERVALOS_COMUNS = [
  { label: '5 min', minutos: 5 },
  { label: '10 min', minutos: 10 },
  { label: '25 min', minutos: 25 },
  { label: '1 h', minutos: 60 },
  { label: '3 h', minutos: 180 },
];

type ModoDisparo = 'repetir' | 'horario';

interface FormState {
  titulo: string;
  descricao: string;
  atribuido_para: string;
  modo: ModoDisparo;
  intervaloMinutos: number;
  horarioFixo: string;
}

function formVazio(meuId: string): FormState {
  return { titulo: '', descricao: '', atribuido_para: meuId, modo: 'repetir', intervaloMinutos: 25, horarioFixo: '' };
}

// Converte o valor do <input type="datetime-local"> (sem timezone) pra ISO,
// e o inverso, pra reabrir o form de edição já preenchido — mesmo padrão de
// TarefasView.tsx (campo `prazo`).
function paraDatetimeLocal(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatarQuando(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function descreverDisparo(lembrete: Lembrete): string {
  if (lembrete.intervalo_minutos != null) {
    const label = INTERVALOS_COMUNS.find((i) => i.minutos === lembrete.intervalo_minutos)?.label || `${lembrete.intervalo_minutos} min`;
    return lembrete.status === 'concluido' ? `Repetia a cada ${label}` : `Repete a cada ${label}`;
  }
  if (lembrete.proxima_notificacao_em) return `Dispara em ${formatarQuando(lembrete.proxima_notificacao_em)}`;
  return 'Horário já disparado';
}

export function LembretesView({ userRoles }: { userRoles: string[] }) {
  const { lembretes, loading, error, refetch } = useLembretes();
  const meuId = localStorage.getItem('user_id') || '';
  const [usuarios, setUsuarios] = useState<UsuarioResumo[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<'pendente' | 'concluido' | 'todos'>('pendente');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editando, setEditando] = useState<Lembrete | null>(null);
  const [form, setForm] = useState<FormState>(formVazio(meuId));
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<Lembrete | null>(null);
  const [alterandoStatus, setAlterandoStatus] = useState<string | null>(null);

  useEffect(() => {
    lembretesApi.listarUsuariosAtivos().then((r) => {
      if (r.success) setUsuarios(r.data);
    });
  }, []);

  const filtrados = useMemo(() => (filtroStatus === 'todos' ? lembretes : lembretes.filter((l) => l.status === filtroStatus)), [lembretes, filtroStatus]);

  const podeEditar = (l: Lembrete) => userRoles.includes('admin') || l.criado_por === meuId;

  const abrirCriar = () => {
    setEditando(null);
    setForm(formVazio(meuId));
    setErroForm(null);
    setIsFormOpen(true);
  };

  const abrirEditar = (l: Lembrete) => {
    setEditando(l);
    setForm({
      titulo: l.titulo,
      descricao: l.descricao || '',
      atribuido_para: l.atribuido_para,
      modo: l.intervalo_minutos != null ? 'repetir' : 'horario',
      intervaloMinutos: l.intervalo_minutos ?? 25,
      horarioFixo: paraDatetimeLocal(l.proxima_notificacao_em),
    });
    setErroForm(null);
    setIsFormOpen(true);
  };

  const salvar = async () => {
    if (!form.titulo.trim()) return setErroForm('Título é obrigatório');
    if (form.modo === 'horario' && !form.horarioFixo) return setErroForm('Escolha um horário');

    setSalvando(true);
    setErroForm(null);
    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      atribuido_para: form.atribuido_para || meuId,
      intervalo_minutos: form.modo === 'repetir' ? form.intervaloMinutos : null,
      horario_fixo: form.modo === 'horario' ? new Date(form.horarioFixo).toISOString() : null,
    };
    try {
      const result = editando ? await lembretesApi.atualizar(editando.id, payload) : await lembretesApi.criar(payload);
      if (!result.success) throw new Error(result.error);
      setIsFormOpen(false);
      refetch();
    } catch (err: any) {
      setErroForm(err.message || 'Erro ao salvar lembrete');
    } finally {
      setSalvando(false);
    }
  };

  const alternarStatus = async (l: Lembrete) => {
    setAlterandoStatus(l.id);
    try {
      const result = l.status === 'concluido' ? await lembretesApi.reabrir(l.id) : await lembretesApi.concluir(l.id);
      if (!result.success) throw new Error(result.error);
      refetch();
    } catch (err: any) {
      aviso.falha(err, l.status === 'concluido' ? 'Erro ao reabrir lembrete' : 'Erro ao concluir lembrete');
    } finally {
      setAlterandoStatus(null);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    try {
      const result = await lembretesApi.excluir(excluindo.id);
      if (!result.success) throw new Error(result.error);
      setExcluindo(null);
      refetch();
    } catch (err: any) {
      aviso.falha(err, 'Erro ao excluir lembrete');
    }
  };

  const inputClass =
    'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';
  const labelClass = 'text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted';

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-text-primary">Lembretes</h2>
          <p className="text-sm text-text-faint mt-0.5">Avisos que repetem até você resolver, ou tocam uma vez num horário</p>
        </div>
        <button
          onClick={abrirCriar}
          className="h-10 px-5 rounded-control bg-accent text-white text-[11px] font-semibold uppercase tracking-wider shadow-sm flex items-center gap-2 hover:opacity-90 self-start md:self-auto"
        >
          <Plus size={16} /> Novo lembrete
        </button>
      </div>

      <div className="flex items-center gap-2">
        {(['pendente', 'concluido', 'todos'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={cn(
              'h-9 px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider transition-colors',
              filtroStatus === s ? 'bg-accent-soft-bg border-accent/30 text-accent-soft-fg' : 'bg-surface-inset border-border-default text-text-muted hover:text-text-secondary'
            )}
          >
            {s === 'todos' ? 'Todos' : s === 'pendente' ? 'Pendentes' : 'Concluídos'}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {loading && lembretes.length === 0 ? (
        <div className="py-12 flex items-center justify-center text-text-faint">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState icone={Bell} mensagem="Nenhum lembrete por aqui." />
      ) : (
        <div className="space-y-3">
          {filtrados.map((l) => {
            const concluido = l.status === 'concluido';
            return (
              <div key={l.id} className="bg-surface-card border border-border-subtle rounded-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={cn('text-base font-medium text-text-primary', concluido && 'line-through opacity-60')}>{l.titulo}</p>
                    {l.descricao && <p className="text-sm text-text-secondary mt-1">{l.descricao}</p>}
                    <p className="text-xs text-text-faint mt-1">
                      {l.atribuido?.nome_exibicao || '—'}
                      {l.atribuido_para !== l.criado_por && l.criador ? ` · criado por ${l.criador.nome_exibicao}` : ''}
                    </p>
                  </div>
                  {concluido ? <StatusBadge texto="Concluído" tom="positive" /> : <StatusBadge texto="Pendente" tom="warning" />}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-faint">
                    {l.intervalo_minutos != null ? <Repeat size={12} /> : <Clock size={12} />} {descreverDisparo(l)}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    {!concluido && (
                      <button
                        onClick={() => alternarStatus(l)}
                        disabled={alterandoStatus === l.id}
                        title="Marcar como concluído"
                        className="h-9 px-3 rounded-control border border-positive/30 bg-positive-bg text-positive text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 hover:opacity-80 disabled:opacity-50"
                      >
                        {alterandoStatus === l.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Concluir
                      </button>
                    )}
                    {concluido && (
                      <button
                        onClick={() => alternarStatus(l)}
                        disabled={alterandoStatus === l.id}
                        title="Reabrir"
                        className="size-8 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary disabled:opacity-50"
                      >
                        {alterandoStatus === l.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                      </button>
                    )}
                    {podeEditar(l) && (
                      <>
                        <button
                          onClick={() => abrirEditar(l)}
                          title="Editar"
                          className="size-8 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary"
                        >
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setExcluindo(l)} title="Excluir" className="size-8 flex items-center justify-center rounded-control text-danger hover:bg-surface-raised">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center" onClick={() => setIsFormOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md flex flex-col overflow-hidden rounded-t-card md:rounded-card bg-surface-page text-text-primary border border-border-subtle max-h-[90vh]"
          >
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-lg font-medium">{editando ? 'Editar lembrete' : 'Novo lembrete'}</h2>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              {erroForm && <p className="text-sm text-danger">{erroForm}</p>}
              <div>
                <label className={labelClass}>Título</label>
                <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} className={inputClass} placeholder="ex: Ligar pro fornecedor" />
              </div>
              <div>
                <label className={labelClass}>Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  className={cn(inputClass, 'min-h-16 resize-none')}
                  placeholder="Detalhes (opcional)"
                />
              </div>
              <div>
                <label className={labelClass}>Responsável</label>
                <select value={form.atribuido_para} onChange={(e) => setForm((f) => ({ ...f, atribuido_para: e.target.value }))} className={inputClass}>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.id === meuId ? `${u.nome_exibicao} (você)` : u.nome_exibicao}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                {(['repetir', 'horario'] as const).map((modo) => (
                  <button
                    key={modo}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, modo }))}
                    className={cn(
                      'h-9 px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider transition-colors',
                      form.modo === modo ? 'bg-accent-soft-bg border-accent/30 text-accent-soft-fg' : 'bg-surface-inset border-border-default text-text-muted hover:text-text-secondary'
                    )}
                  >
                    {modo === 'repetir' ? 'Repetir' : 'Horário específico'}
                  </button>
                ))}
              </div>
              {form.modo === 'repetir' ? (
                <div>
                  <label className={labelClass}>Repetir a cada</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {INTERVALOS_COMUNS.map((i) => (
                      <button
                        key={i.minutos}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, intervaloMinutos: i.minutos }))}
                        className={cn(
                          'h-9 px-3 rounded-control border text-[11px] font-semibold transition-colors',
                          form.intervaloMinutos === i.minutos ? 'bg-accent-soft-bg border-accent/30 text-accent-soft-fg' : 'bg-surface-inset border-border-default text-text-muted hover:text-text-secondary'
                        )}
                      >
                        {i.label}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={5}
                      value={form.intervaloMinutos}
                      onChange={(e) => setForm((f) => ({ ...f, intervaloMinutos: Math.max(5, Number(e.target.value) || 5) }))}
                      className={cn(inputClass, 'w-24')}
                    />
                    <span className="text-xs text-text-faint">min (mín. 5)</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Horário</label>
                  <input type="datetime-local" value={form.horarioFixo} onChange={(e) => setForm((f) => ({ ...f, horarioFixo: e.target.value }))} className={inputClass} />
                </div>
              )}
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
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm flex flex-col overflow-hidden rounded-t-card md:rounded-card bg-surface-page text-text-primary border border-border-subtle p-6 space-y-4"
          >
            <h2 className="text-lg font-medium">Excluir lembrete?</h2>
            <p className="text-sm text-text-secondary">"{excluindo.titulo}" será removido definitivamente.</p>
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
