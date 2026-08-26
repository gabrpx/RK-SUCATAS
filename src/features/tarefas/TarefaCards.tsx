// Grade de cards de tarefa que se expandem (padrão "expandable card" do
// aceternity): clicar num card faz ele MORFAR (layoutId compartilhado) num
// painel central de detalhes sobre um backdrop; fecha no Esc, no clique fora ou
// no X. Usado nas DUAS visões da aba Tarefas — o que muda entre elas são as
// ações passadas por render prop (permissões diferentes).
'use client';

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, MapPin, Phone, X, User, MessageCircle, Plus, Loader2, UserCog, ListChecks, Check, CheckCircle2, GripVertical, Square, CheckSquare } from 'lucide-react';
import { cn } from '../../utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SPRING_SHEET } from '../../components/ui/motion';
import { aviso } from '../../components/ui/toast';
import { formatTelefoneBR, onlyDigits } from '../../utils/formatters';
import { linkWhatsapp } from '../../utils/whatsapp';
import { clientesApi } from '../clientes/api';
import { tarefasApi } from './api';
import { formatarPrazo, estaVencida, formatarMomentoRelativo, progressoChecklist, moverItem, PRIORIDADE_LABELS, PRIORIDADE_TONS } from './tarefaUtils';
import type { Tarefa, TarefaItem } from './types';

function BadgeProgresso({ feitos, total }: { feitos: number; total: number }) {
  const pct = total ? Math.round((feitos / total) * 100) : 0;
  const completo = feitos === total;
  return (
    <div className="flex items-center gap-2">
      <span className={cn('inline-flex items-center gap-1 text-xs font-medium', completo ? 'text-positive' : 'text-text-faint')}>
        <ListChecks size={12} /> {feitos}/{total}
      </span>
      <div className="h-1.5 flex-1 min-w-12 max-w-24 overflow-hidden rounded-full bg-surface-inset">
        <div className={cn('h-full rounded-full transition-all', completo ? 'bg-positive' : 'bg-accent')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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
  // Chamado quando o número do cliente é salvo aqui pelo botão "Adicionar
  // número" — pra a lista de tarefas recarregar e refletir o telefone novo.
  onContatoSalvo?: () => void;
  // Se quem está vendo pode marcar/desmarcar itens do checklist (o backend
  // valida de verdade); sem passar, os checkboxes ficam só-leitura.
  podeMarcarItens?: (tarefa: Tarefa) => boolean;
  // Se quem está vendo pode reordenar o checklist (drag-and-drop) — é uma
  // EDIÇÃO da tarefa (PATCH /:id), não uma conclusão de item, então usa a
  // mesma regra de podeEditar (backend: só admin ou quem criou), diferente e
  // mais restrita que podeMarcarItens. Sem passar, a lista fica sem drag.
  podeReordenar?: (tarefa: Tarefa) => boolean;
  // Modo de seleção em lote (grade de cards recolhidos) — quando presente,
  // cada card ganha um checkbox no canto superior esquerdo (renderMenu já
  // ocupa o direito) que só alterna a seleção, sem abrir o painel de detalhes.
  selecao?: { ativos: Set<string>; alternar: (id: string) => void };
}

// Uma linha do checklist arrastável. Só fica "pegável" (listeners do
// dnd-kit) quando `arrastavel` é true — senão o clique continua marcando o
// item normalmente.
function ItemChecklistArrastavel({
  item,
  arrastavel,
  podeMarcar,
  alternando,
  onToggle,
}: {
  item: TarefaItem;
  arrastavel: boolean;
  podeMarcar: boolean;
  alternando: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !arrastavel });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-1">
      {arrastavel && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-faint touch-none hover:bg-surface-inset hover:text-text-muted cursor-grab active:cursor-grabbing"
          title="Arrastar pra reordenar"
        >
          <GripVertical size={15} />
        </button>
      )}
      <button
        type="button"
        disabled={!podeMarcar || alternando}
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
          podeMarcar ? 'hover:bg-surface-inset cursor-pointer' : 'cursor-default',
        )}
      >
        <span className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          item.concluido ? 'border-positive bg-positive text-white' : 'border-border-default',
        )}>
          {item.concluido && <Check size={13} />}
        </span>
        <span className={cn('text-text-primary', item.concluido && 'line-through opacity-60')}>{item.texto}</span>
      </button>
    </li>
  );
}

export function TarefaCards({ tarefas, renderAcoes, renderAcaoRapida, renderMenu, onContatoSalvo, podeMarcarItens, podeReordenar, selecao }: TarefaCardsProps) {
  const [ativa, setAtiva] = useState<Tarefa | null>(null);
  const id = useId();
  const painelRef = useRef<HTMLDivElement>(null);

  // Estado do "Adicionar número" inline (item 7) — só uma tarefa aberta por vez.
  const [editandoNumero, setEditandoNumero] = useState(false);
  const [numeroInput, setNumeroInput] = useState('');
  const [salvandoNumero, setSalvandoNumero] = useState(false);

  // Ao trocar/fechar a tarefa aberta, zera o formulário de número.
  useEffect(() => {
    setEditandoNumero(false);
    setNumeroInput('');
  }, [ativa?.id]);

  const salvarNumeroCliente = async () => {
    if (!ativa?.cliente) return;
    const digitos = onlyDigits(numeroInput);
    if (digitos.length < 10) return aviso.atencao('Informe um número com DDD (ex: (83) 98203-9490)');
    setSalvandoNumero(true);
    try {
      const result = await clientesApi.atualizar(ativa.cliente.id, { telefone: digitos });
      if (!result.success) throw new Error(result.error);
      // Otimista: já habilita o WhatsApp no painel aberto sem esperar o refetch.
      setAtiva((prev) => (prev && prev.cliente ? { ...prev, cliente: { ...prev.cliente, telefone: digitos } } : prev));
      setEditandoNumero(false);
      setNumeroInput('');
      onContatoSalvo?.();
    } catch (err) {
      aviso.falha(err, 'Erro ao salvar número');
    } finally {
      setSalvandoNumero(false);
    }
  };

  const [alternandoItem, setAlternandoItem] = useState<string | null>(null);
  const alternarItem = async (tarefa: Tarefa, itemId: string) => {
    setAlternandoItem(itemId);
    try {
      const result = await tarefasApi.alternarItem(tarefa.id, itemId);
      if (!result.success) throw new Error(result.error);
      setAtiva(result.data); // devolve a tarefa inteira (status recalculado)
      onContatoSalvo?.(); // reaproveita o refetch da lista
    } catch (err) {
      aviso.falha(err, 'Erro ao atualizar item');
    } finally {
      setAlternandoItem(null);
    }
  };

  // Sensors com um pequeno threshold de distância — sem isso, um simples
  // toque/clique pra marcar o item já dispara um drag de 1px.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const [reordenando, setReordenando] = useState(false);
  const reordenarItens = async (tarefa: Tarefa, e: DragEndEvent) => {
    const overId = e.over?.id;
    if (!overId || overId === e.active.id) return;
    const novaOrdem = moverItem(tarefa.itens, String(e.active.id), String(overId));
    setAtiva((prev) => (prev && prev.id === tarefa.id ? { ...prev, itens: novaOrdem } : prev)); // otimista
    setReordenando(true);
    try {
      const result = await tarefasApi.atualizar(tarefa.id, { itens: novaOrdem.map((i) => ({ id: i.id, texto: i.texto })) });
      if (!result.success) throw new Error(result.error);
      setAtiva(result.data);
      onContatoSalvo?.();
    } catch (err) {
      aviso.falha(err, 'Erro ao reordenar itens');
      setAtiva((prev) => (prev && prev.id === tarefa.id ? { ...prev, itens: tarefa.itens } : prev)); // desfaz o otimista
    } finally {
      setReordenando(false);
    }
  };

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
                    <h2 className={cn('text-lg font-medium text-text-primary flex items-center gap-1.5', ativa.status === 'concluida' && 'line-through opacity-60')}>
                      {!ativa.titulo && <ListChecks size={16} className="text-accent shrink-0" />}
                      {ativa.titulo || ativa.itens[0]?.texto || 'Tarefa'}
                    </h2>
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

                {ativa.itens.length > 0 && (() => {
                  const prog = progressoChecklist(ativa)!;
                  const podeMarcar = podeMarcarItens?.(ativa) ?? false;
                  const arrastavel = (podeReordenar?.(ativa) ?? false) && !reordenando;
                  return (
                    <div className="space-y-3">
                      <BadgeProgresso feitos={prog.feitos} total={prog.total} />
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => reordenarItens(ativa, e)}>
                        <SortableContext items={ativa.itens.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                          <ul className="space-y-1.5">
                            {ativa.itens.map((item: TarefaItem) => (
                              <ItemChecklistArrastavel
                                key={item.id}
                                item={item}
                                arrastavel={arrastavel}
                                podeMarcar={podeMarcar}
                                alternando={alternandoItem === item.id}
                                onToggle={() => {
                                  if (podeMarcar) void alternarItem(ativa, item.id);
                                }}
                              />
                            ))}
                          </ul>
                        </SortableContext>
                      </DndContext>
                    </div>
                  );
                })()}

                <div className="space-y-2 rounded-2xl bg-surface-inset/60 p-4">
                  {ativa.cliente && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-2 text-sm text-text-secondary">
                        <User size={14} className="text-text-muted shrink-0" />
                        {ativa.cliente.nome}
                        {ativa.cliente.telefone && (
                          <span className="inline-flex items-center gap-1 text-text-faint">
                            <Phone size={12} /> {formatTelefoneBR(ativa.cliente.telefone)}
                          </span>
                        )}
                      </p>
                      {/* Item 7: cliente com número → WhatsApp; sem número →
                          "Adicionar número" que passa a permitir o envio. */}
                      {linkWhatsapp(ativa.cliente.telefone) ? (
                        <button
                          type="button"
                          onClick={() => {
                            const url = linkWhatsapp(ativa.cliente!.telefone);
                            if (url) window.open(url, '_blank');
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-positive/30 py-2.5 text-sm font-medium text-positive transition-colors hover:bg-positive-bg"
                        >
                          <MessageCircle size={15} /> Enviar mensagem no WhatsApp
                        </button>
                      ) : editandoNumero ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={numeroInput}
                            onChange={(e) => setNumeroInput(formatTelefoneBR(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') salvarNumeroCliente();
                              if (e.key === 'Escape') setEditandoNumero(false);
                            }}
                            inputMode="numeric"
                            maxLength={15}
                            placeholder="(00) 00000-0000"
                            className="flex-1 rounded-xl border border-border-default bg-surface-inset px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/50"
                          />
                          <button
                            type="button"
                            onClick={salvarNumeroCliente}
                            disabled={salvandoNumero}
                            className="flex size-9 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-50"
                            title="Salvar número"
                          >
                            {salvandoNumero ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditandoNumero(false)}
                            className="flex size-9 items-center justify-center rounded-xl text-text-muted hover:bg-surface-raised"
                            title="Cancelar"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditandoNumero(true)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-default py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-accent/50 hover:text-accent-soft-fg"
                        >
                          <Plus size={15} /> Adicionar número
                        </button>
                      )}
                    </div>
                  )}
                  <p className="flex items-center gap-2 text-sm text-text-secondary">
                    <User size={14} className="text-text-muted shrink-0" />
                    <span className="text-text-faint">Responsável:</span> {ativa.atribuido?.nome_exibicao || '—'}
                  </p>
                  <p className="flex items-center gap-2 text-sm text-text-secondary">
                    <UserCog size={14} className="text-text-muted shrink-0" />
                    <span className="text-text-faint">Designada por:</span> {ativa.criador?.nome_exibicao || '—'}
                  </p>
                  {ativa.prazo && (
                    <p className={cn('flex items-center gap-2 text-sm', estaVencida(ativa) ? 'text-danger font-medium' : 'text-text-secondary')}>
                      <Clock size={14} className="shrink-0" />
                      <span className="text-text-faint">Prazo:</span> {formatarPrazo(ativa.prazo)}
                    </p>
                  )}
                  <p className="flex items-center gap-2 text-sm text-text-secondary">
                    <Clock size={14} className="text-text-muted shrink-0" />
                    <span className="text-text-faint">Designada em:</span> {formatarMomentoRelativo(ativa.criado_em)}
                  </p>
                  {ativa.status === 'concluida' && formatarMomentoRelativo(ativa.concluida_em) && (
                    <p className="flex items-center gap-2 text-sm text-positive">
                      <CheckCircle2 size={14} className="shrink-0" />
                      <span className="text-text-faint">Concluída em:</span> {formatarMomentoRelativo(ativa.concluida_em)}
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
              onClick={() => (selecao ? selecao.alternar(tarefa.id) : setAtiva(tarefa))}
              transition={SPRING_SHEET}
              className={cn(
                'cursor-pointer rounded-card border bg-surface-card p-4 transition-colors hover:border-border-default',
                selecao?.ativos.has(tarefa.id) ? 'border-accent/50 bg-accent-soft-bg/20' : vencida ? 'border-danger/30' : 'border-border-subtle'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  {selecao && (
                    <span className="shrink-0 mt-0.5 text-accent">
                      {selecao.ativos.has(tarefa.id) ? <CheckSquare size={17} /> : <Square size={17} className="text-text-faint" />}
                    </span>
                  )}
                  <motion.div layoutId={`tarefa-titulo-${tarefa.id}-${id}`} className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {tarefa.tipo === 'visita' && <MapPin size={13} className="text-accent shrink-0" />}
                      {!tarefa.titulo && tarefa.itens.length > 0 && <ListChecks size={13} className="text-accent shrink-0" />}
                      <p className={cn('text-sm font-medium text-text-primary truncate', concluida && 'line-through opacity-60')}>
                        {tarefa.titulo || tarefa.itens[0]?.texto || 'Tarefa'}
                      </p>
                    </div>
                  </motion.div>
                </div>
                {renderMenu && !selecao && (
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

              {progressoChecklist(tarefa) && (
                <div className="mt-3">
                  <BadgeProgresso feitos={progressoChecklist(tarefa)!.feitos} total={progressoChecklist(tarefa)!.total} />
                  {!tarefa.titulo && (
                    <ul className="mt-2 space-y-1">
                      {tarefa.itens.slice(1, 4).map((it) => (
                        <li key={it.id} className="flex items-center gap-1.5 text-xs text-text-faint">
                          <span className={cn('flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border', it.concluido ? 'border-positive bg-positive text-white' : 'border-border-default')}>
                            {it.concluido && <Check size={9} />}
                          </span>
                          <span className={cn('truncate', it.concluido && 'line-through opacity-60')}>{it.texto}</span>
                        </li>
                      ))}
                      {tarefa.itens.length > 4 && <li className="text-xs text-text-faint pl-5">+{tarefa.itens.length - 4} item(ns)</li>}
                    </ul>
                  )}
                </div>
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
