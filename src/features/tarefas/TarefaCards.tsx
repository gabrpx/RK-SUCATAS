// Grade de cards de tarefa que se expandem (padrão "expandable card" do
// aceternity): clicar num card faz ele MORFAR (layoutId compartilhado) num
// painel central de detalhes sobre um backdrop; fecha no Esc, no clique fora ou
// no X. Usado nas DUAS visões da aba Tarefas — o que muda entre elas são as
// ações passadas por render prop (permissões diferentes).
'use client';

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock, MapPin, Phone, X, User } from 'lucide-react';
import { cn } from '../../utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SPRING_SHEET } from '../../components/ui/motion';
import { formatarPrazo, estaVencida, PRIORIDADE_LABELS, PRIORIDADE_TONS } from './tarefaUtils';
import type { Tarefa } from './types';

function useClickOutside(ref: RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

function StatusDaTarefa({ tarefa }: { tarefa: Tarefa }) {
  if (tarefa.status === 'concluida') return <StatusBadge texto="Concluída" tom="positive" />;
  if (estaVencida(tarefa)) return <StatusBadge texto="Atrasada" tom="danger" />;
  return <StatusBadge texto="Pendente" tom="warning" />;
}

interface TarefaCardsProps {
  tarefas: Tarefa[];
  // Ações no painel expandido (variam por visão/permissão).
  renderAcoes?: (tarefa: Tarefa, fechar: () => void) => ReactNode;
  // Ação rápida opcional no rodapé do card recolhido (ex: Concluir na visão do responsável).
  renderAcaoRapida?: (tarefa: Tarefa) => ReactNode;
  // Menu de ação (⋯) no canto superior — aparece no card recolhido e no painel
  // expandido. É aqui que entra o DropdownMenu animado (visão do criador).
  renderMenu?: (tarefa: Tarefa) => ReactNode;
}

export function TarefaCards({ tarefas, renderAcoes, renderAcaoRapida, renderMenu }: TarefaCardsProps) {
  const [ativa, setAtiva] = useState<Tarefa | null>(null);
  const id = useId();
  const painelRef = useRef<HTMLDivElement>(null);

  // Sincroniza a tarefa aberta com a lista (ex: após concluir/reabrir, a prop
  // muda de identidade) e fecha se ela sumir.
  useEffect(() => {
    if (!ativa) return;
    const atual = tarefas.find((t) => t.id === ativa.id);
    if (!atual) setAtiva(null);
    else if (atual !== ativa) setAtiva(atual);
  }, [tarefas]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAtiva(null);
    if (ativa) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [ativa]);

  useClickOutside(painelRef, () => setAtiva(null));

  const fechar = () => setAtiva(null);

  return (
    <>
      <AnimatePresence>
        {ativa && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[190] bg-black/60 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ativa && (
          <div className="fixed inset-0 z-[200] grid place-items-center p-4">
            <motion.div
              layoutId={`tarefa-${ativa.id}-${id}`}
              ref={painelRef}
              transition={SPRING_SHEET}
              className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl border border-border-subtle bg-surface-card shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-surface-card/95 p-5 pb-3 backdrop-blur-sm">
                <motion.div layoutId={`tarefa-titulo-${ativa.id}-${id}`} className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {ativa.tipo === 'visita' && <MapPin size={15} className="text-accent shrink-0" />}
                    <h2 className={cn('text-lg font-medium text-text-primary', ativa.status === 'concluida' && 'line-through opacity-60')}>{ativa.titulo}</h2>
                  </div>
                </motion.div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {renderMenu?.(ativa)}
                  <button onClick={fechar} className="flex size-10 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-surface-inset hover:text-text-primary" title="Fechar">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 px-5 pb-5">
                <motion.div layoutId={`tarefa-badges-${ativa.id}-${id}`} className="flex items-center gap-2 flex-wrap">
                  <StatusDaTarefa tarefa={ativa} />
                  <StatusBadge texto={PRIORIDADE_LABELS[ativa.prioridade]} tom={PRIORIDADE_TONS[ativa.prioridade]} />
                </motion.div>

                {ativa.descricao && <p className="text-sm text-text-secondary whitespace-pre-line">{ativa.descricao}</p>}

                <div className="space-y-2 rounded-2xl bg-surface-inset/60 p-4">
                  {ativa.cliente && (
                    <p className="flex items-center gap-2 text-sm text-text-secondary">
                      <User size={14} className="text-text-muted shrink-0" />
                      {ativa.cliente.nome}
                      {ativa.cliente.telefone && (
                        <span className="inline-flex items-center gap-1 text-text-faint">
                          <Phone size={12} /> {ativa.cliente.telefone}
                        </span>
                      )}
                    </p>
                  )}
                  <p className="flex items-center gap-2 text-sm text-text-secondary">
                    <User size={14} className="text-text-muted shrink-0" />
                    <span className="text-text-faint">Responsável:</span> {ativa.atribuido?.nome_exibicao || '—'}
                  </p>
                  {ativa.prazo && (
                    <p className={cn('flex items-center gap-2 text-sm', estaVencida(ativa) ? 'text-danger font-medium' : 'text-text-secondary')}>
                      <Clock size={14} className="shrink-0" />
                      <span className="text-text-faint">Prazo:</span> {formatarPrazo(ativa.prazo)}
                    </p>
                  )}
                </div>

                {renderAcoes && <div className="flex items-center justify-end gap-2 pt-1">{renderAcoes(ativa, fechar)}</div>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tarefas.map((tarefa) => {
          const vencida = estaVencida(tarefa);
          const concluida = tarefa.status === 'concluida';
          return (
            <motion.div
              key={tarefa.id}
              layoutId={`tarefa-${tarefa.id}-${id}`}
              onClick={() => setAtiva(tarefa)}
              transition={SPRING_SHEET}
              className={cn(
                'cursor-pointer rounded-card border bg-surface-card p-4 transition-colors hover:border-border-default',
                vencida ? 'border-danger/30' : 'border-border-subtle'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <motion.div layoutId={`tarefa-titulo-${tarefa.id}-${id}`} className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {tarefa.tipo === 'visita' && <MapPin size={13} className="text-accent shrink-0" />}
                    <p className={cn('text-sm font-medium text-text-primary truncate', concluida && 'line-through opacity-60')}>{tarefa.titulo}</p>
                  </div>
                </motion.div>
                {renderMenu && (
                  <div className="shrink-0 -mr-1 -mt-1" onClick={(e) => e.stopPropagation()}>
                    {renderMenu(tarefa)}
                  </div>
                )}
              </div>

              {tarefa.descricao && <p className="mt-1 text-xs text-text-faint line-clamp-2">{tarefa.descricao}</p>}
              {tarefa.cliente && <p className="mt-1 text-xs text-text-faint truncate">{tarefa.cliente.nome}</p>}

              <motion.div layoutId={`tarefa-badges-${tarefa.id}-${id}`} className="mt-3 flex items-center gap-2 flex-wrap">
                <StatusDaTarefa tarefa={tarefa} />
                {tarefa.prioridade !== 'media' && <StatusBadge texto={PRIORIDADE_LABELS[tarefa.prioridade]} tom={PRIORIDADE_TONS[tarefa.prioridade]} />}
              </motion.div>

              {tarefa.prazo && (
                <p className={cn('mt-3 inline-flex items-center gap-1.5 text-xs font-medium', vencida ? 'text-danger' : 'text-text-faint')}>
                  <Clock size={12} /> até {formatarPrazo(tarefa.prazo)}
                </p>
              )}

              {renderAcaoRapida && (
                <div className="mt-3 flex justify-end" onClick={(e) => e.stopPropagation()}>
                  {renderAcaoRapida(tarefa)}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
