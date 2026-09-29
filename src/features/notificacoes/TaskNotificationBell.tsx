import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Bell, CheckCheck, Clock3, Eye, Loader2 } from 'lucide-react';
import { tarefasApi } from '../tarefas/api';
import type { Tarefa } from '../tarefas/types';
import { filtrarNotificacoesTarefa } from './taskNotificationsModel';

const REFRESH_MS = 20000;

function tituloTarefa(tarefa: Tarefa) {
  return tarefa.titulo?.trim() || tarefa.itens[0]?.texto || 'Tarefa operacional';
}

export function TaskNotificationBell({
  currentUserId,
  onOpenTask,
}: {
  currentUserId: string;
  onOpenTask: (taskId: string) => void;
}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [aba, setAba] = useState<'pendentes' | 'visualizadas'>('pendentes');
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  const carregar = useCallback(async () => {
    try {
      const response = await tarefasApi.listar();
      if (!response.success) throw new Error(response.error || 'Não foi possível carregar notificações');
      setTarefas(response.data);
      setErro(null);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar notificações');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const interval = window.setInterval(carregar, REFRESH_MS);
    const refreshOnFocus = () => void carregar();
    const refreshAfterRead = () => void carregar();
    window.addEventListener('focus', refreshOnFocus);
    window.addEventListener('rk:tarefa-lida', refreshAfterRead);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnFocus);
      window.removeEventListener('rk:tarefa-lida', refreshAfterRead);
    };
  }, [carregar]);

  useEffect(() => {
    const fecharFora = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setAberto(false);
    };
    const fecharEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !aberto) return;
      event.preventDefault();
      setAberto(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', fecharFora);
    document.addEventListener('keydown', fecharEscape);
    return () => {
      document.removeEventListener('mousedown', fecharFora);
      document.removeEventListener('keydown', fecharEscape);
    };
  }, [aberto]);

  const pendentes = useMemo(() => filtrarNotificacoesTarefa(tarefas, currentUserId, false), [tarefas, currentUserId]);
  const visualizadas = useMemo(() => filtrarNotificacoesTarefa(tarefas, currentUserId, true), [tarefas, currentUserId]);
  const itens = aba === 'pendentes' ? pendentes : visualizadas;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Notificações de tarefas: ${pendentes.length} pendentes`}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        onClick={() => setAberto((value) => !value)}
        className="relative grid size-11 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
      >
        <Bell size={16} />
        {pendentes.length > 0 && <span aria-hidden="true" className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold leading-4 text-white">{pendentes.length > 99 ? '99+' : pendentes.length}</span>}
      </button>
      <AnimatePresence>
        {aberto && (
          <motion.section
            role="dialog"
            aria-label="Notificações de tarefas"
            initial={reduceMotion ? false : { opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.14 }}
            className="absolute right-0 top-full z-[180] mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Notificações</h2>
                <p className="mt-0.5 text-xs text-slate-500">Tarefas atribuídas a você</p>
              </div>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">{pendentes.length} pendentes</span>
            </div>
            <div role="tablist" aria-label="Estado das notificações" className="flex gap-1 border-b border-slate-100 px-3 pt-2">
              <button role="tab" aria-selected={aba === 'pendentes'} type="button" onClick={() => setAba('pendentes')} className={`inline-flex min-h-9 items-center gap-1.5 rounded-t-md px-2.5 text-xs font-medium ${aba === 'pendentes' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}><Clock3 size={13} />Pendentes</button>
              <button role="tab" aria-selected={aba === 'visualizadas'} type="button" onClick={() => setAba('visualizadas')} className={`inline-flex min-h-9 items-center gap-1.5 rounded-t-md px-2.5 text-xs font-medium ${aba === 'visualizadas' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}><Eye size={13} />Visualizadas</button>
            </div>
            <div className="max-h-[min(65vh,26rem)] overflow-y-auto p-2">
              {carregando ? (
                <p role="status" className="flex items-center justify-center gap-2 px-3 py-8 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Carregando…</p>
              ) : erro ? (
                <div className="px-3 py-7 text-center"><p role="alert" className="text-xs text-rose-700">{erro}</p><button type="button" onClick={() => void carregar()} className="mt-2 min-h-9 rounded-md px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50">Tentar novamente</button></div>
              ) : itens.length ? (
                <ul className="space-y-1">
                  {itens.map((tarefa) => {
                    const participante = tarefa.participantes?.find((item) => item.usuario_id === currentUserId);
                    return <li key={tarefa.id}>
                      <button type="button" onClick={() => { setAberto(false); onOpenTask(tarefa.id); }} className="flex min-h-16 w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30">
                        <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${participante?.lida ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{participante?.lida ? <CheckCheck size={15} /> : <Bell size={15} />}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{tituloTarefa(tarefa)}</span><span className="mt-1 block text-[11px] text-slate-500">{tarefa.prazo ? `Prazo ${new Date(tarefa.prazo).toLocaleDateString('pt-BR')}` : 'Sem prazo definido'}</span></span>
                        {!participante?.lida && <span className="mt-2 size-2 shrink-0 rounded-full bg-blue-600" aria-label="Não visualizada" />}
                      </button>
                    </li>;
                  })}
                </ul>
              ) : (
                <div className="px-4 py-8 text-center"><span className="mx-auto grid size-9 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckCheck size={16} /></span><p className="mt-2 text-sm font-medium text-slate-700">{aba === 'pendentes' ? 'Nenhuma tarefa pendente' : 'Nenhuma tarefa visualizada'}</p><p className="mt-1 text-xs text-slate-500">{aba === 'pendentes' ? 'Quando uma tarefa for atribuída, ela aparecerá aqui.' : 'Tarefas abertas pela primeira vez aparecem neste histórico.'}</p></div>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
