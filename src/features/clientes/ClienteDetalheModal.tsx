import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  Pencil, MessageCircle, Ban, RotateCcw, ShieldAlert,
  ShoppingBag, Receipt, ClipboardList, MapPin, Clock,
  PackageSearch, StickyNote, Download, Trash2, Send,
  Loader2, Plus, X,
} from 'lucide-react';
import { cn } from '../../utils';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge';
import { Button } from '@/src/components/ui/button';
import { Select } from '@/src/components/ui/Select';
import { ClienteProfileCard } from './ClienteProfileCard';
import type { Cliente, ClienteNota, PecaProcuradaStatus } from './types';
import { pedidoStatusCopy } from './operacaoCopy';

const spring = { type: 'spring' as const, stiffness: 300, damping: 30 };

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

function formatarData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
}

const PECA_STATUS_LABELS: Record<PecaProcuradaStatus, string> = pedidoStatusCopy;
const PECA_STATUS_TONS: Record<PecaProcuradaStatus, StatusTone> = {
  nova: 'accent',
  em_busca: 'warning',
  peca_disponivel: 'positive',
  aguardando_cliente: 'warning',
  vendida: 'positive',
  nao_encontrada: 'neutral',
  cliente_desistiu: 'neutral',
  aguardando: 'warning',
  atendida: 'positive',
  cancelada: 'neutral',
};

function StatCard({ valor, label }: { valor: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="bg-surface-inset rounded-control py-2.5 text-center"
    >
      <p data-stat-value className="text-base font-bold text-text-primary tabular-nums">
        {valor}
      </p>
      <p className="text-[10px] text-text-faint uppercase tracking-wide mt-0.5">{label}</p>
    </motion.div>
  );
}

function AnimatedActionButton({
  children,
  onClick,
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={spring}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-auto flex-1 py-3 rounded-control font-medium text-sm border transition-colors inline-flex items-center justify-center gap-1.5',
        className
      )}
    >
      {children}
    </motion.button>
  );
}

export interface ClienteDetalheModalProps {
  aberto: boolean;
  onFechar: () => void;
  onEditar: () => void;
  onAlternarAtivo: () => void;
  onAlternarBanido: () => void;
  cliente: Cliente;
  historico: {
    totalGasto: number;
    ticketMedio: number;
    diasDesdeUltimaCompra: number | null;
    quantidadeCompras: number;
    vendas: { id: string; data: string; nome_item: string; valor_total: number }[];
    orcamentosAbertos: { id: string; codigo: string; criado_em: string }[];
  } | null;
  segmentoLabel?: string;
  segmentoTom?: StatusTone;
  badges?: { modeloMotoId: string; nome: string; tom: StatusTone }[];
  tarefas?: { id: string; titulo: string; tipo: string; prazo?: string | null; status: string }[];
  // Callbacks para seções interativas
  onExportarCsv?: () => void;
  onEnviarNota?: (texto: string) => Promise<void>;
  onExcluirNota?: (id: string) => void;
  onEnviarPeca?: (descricao: string, categoriaId: string | null, modeloMotoId: string | null) => Promise<void>;
  onAtualizarStatusPeca?: (id: string, status: PecaProcuradaStatus) => void;
  onRemoverPeca?: (id: string) => void;
  onRemoverComprovante?: (id: string, vendaId: string | null) => void;
  carregandoFicha?: boolean;
  podeExcluirComprovante?: boolean;
  opcoesCategoria?: { id: string; label: string }[];
  opcoesModelo?: { id: string; label: string }[];
  formatTelefoneBR: (tel: string) => string;
  formatDocumentoBR: (doc: string) => string;
  linkWhatsapp: (tel: string | null | undefined, msg?: string) => string | null;
}

export function ClienteDetalheModal({
  aberto,
  onFechar,
  onEditar,
  onAlternarAtivo,
  onAlternarBanido,
  cliente,
  historico,
  segmentoLabel,
  segmentoTom = 'neutral',
  badges = [],
  tarefas = [],
  onExportarCsv,
  onEnviarNota,
  onExcluirNota,
  onEnviarPeca,
  onAtualizarStatusPeca,
  onRemoverPeca,
  onRemoverComprovante,
  carregandoFicha = false,
  podeExcluirComprovante = false,
  opcoesCategoria = [],
  opcoesModelo = [],
  formatTelefoneBR,
  formatDocumentoBR,
  linkWhatsapp,
}: ClienteDetalheModalProps) {
  const [novaNota, setNovaNota] = useState('');
  const [enviandoNota, setEnviandoNota] = useState(false);
  const [novaPeca, setNovaPeca] = useState({ descricao: '', categoria_id: null as string | null, modelo_moto_id: null as string | null });
  const [enviandoPeca, setEnviandoPeca] = useState(false);

  const handleEnviarNota = async () => {
    if (!novaNota.trim() || !onEnviarNota) return;
    setEnviandoNota(true);
    try {
      await onEnviarNota(novaNota.trim());
      setNovaNota('');
    } finally {
      setEnviandoNota(false);
    }
  };

  const handleEnviarPeca = async () => {
    if (!novaPeca.descricao.trim() || !onEnviarPeca) return;
    setEnviandoPeca(true);
    try {
      await onEnviarPeca(novaPeca.descricao.trim(), novaPeca.categoria_id, novaPeca.modelo_moto_id);
      setNovaPeca({ descricao: '', categoria_id: null, modelo_moto_id: null });
    } finally {
      setEnviandoPeca(false);
    }
  };

  const whatsUrl = linkWhatsapp(cliente.telefone);
  const inputClass =
    'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={cliente.nome}
      subtitulo={cliente.telefone ? formatTelefoneBR(cliente.telefone) : 'Sem telefone cadastrado'}
      tamanho="lg"
      rodape={
        <div className="flex gap-3">
          {whatsUrl && (
            <AnimatedActionButton
              onClick={() => window.open(whatsUrl, '_blank')}
              className="border-positive/30 text-positive hover:bg-positive-bg hover:text-positive"
            >
              <MessageCircle size={14} /> WhatsApp
            </AnimatedActionButton>
          )}
          <AnimatedActionButton
            onClick={onEditar}
            className="border-border-default text-text-secondary hover:bg-surface-raised"
          >
            <Pencil size={14} /> Editar
          </AnimatedActionButton>
          <AnimatedActionButton
            onClick={onAlternarAtivo}
            className={cn(
              cliente.ativo
                ? 'border-danger/30 text-danger hover:bg-danger-bg hover:text-danger'
                : 'border-positive/30 text-positive hover:bg-positive-bg hover:text-positive'
            )}
          >
            {cliente.ativo ? (
              <><Ban size={14} /> Desativar</>
            ) : (
              <><RotateCcw size={14} /> Reativar</>
            )}
          </AnimatedActionButton>
          <AnimatedActionButton
            onClick={onAlternarBanido}
            className={cn(
              cliente.banido
                ? 'border-positive/30 text-positive hover:bg-positive-bg hover:text-positive'
                : 'border-danger/30 text-danger hover:bg-danger-bg hover:text-danger'
            )}
          >
            <ShieldAlert size={14} /> {cliente.banido ? 'Desbanir' : 'Banir'}
          </AnimatedActionButton>
        </div>
      }
    >
      <div className="space-y-5">
        <ClienteProfileCard
          nome={cliente.nome}
          telefone={cliente.telefone ? formatTelefoneBR(cliente.telefone) : null}
          documento={cliente.documento ? formatDocumentoBR(cliente.documento) : null}
          aniversario={cliente.data_nascimento ? new Date(cliente.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : null}
          origem={null}
          contatoPreferido={null}
          cidade={cliente.cidade}
          estado={cliente.estado}
          tags={cliente.tags}
          motosBusca={badges}
          segmentoLabel={segmentoLabel}
          segmentoTom={segmentoTom}
          banido={cliente.banido}
        />

        {(!cliente.ativo || badges.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {!cliente.ativo && <StatusBadge texto="Inativo" tom="neutral" ativo={false} />}
            {badges.map((b) => (
              <span key={b.modeloMotoId} title="Moto procurada">
                <StatusBadge texto={b.nome} tom={b.tom} />
              </span>
            ))}
          </div>
        )}

        {segmentoLabel && (
          <span data-segmento-badge>
            <StatusBadge texto={segmentoLabel} tom={segmentoTom} />
          </span>
        )}

        {cliente.observacoes && (
          <p className="text-sm text-text-secondary italic">"{cliente.observacoes}"</p>
        )}

        {historico && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <ShoppingBag size={12} /> Histórico de compras
              </p>
              {historico.vendas.length > 0 && onExportarCsv && (
                <Button
                  variant="ghost"
                  onClick={onExportarCsv}
                  className="h-auto p-0 text-[11px] font-semibold uppercase tracking-wide text-accent-soft-fg hover:bg-transparent hover:text-accent-soft-fg hover:opacity-80"
                >
                  <Download size={12} /> Exportar CSV
                </Button>
              )}
            </div>
            {historico.vendas.length === 0 ? (
              <p className="text-xs text-text-faint">Nenhuma venda vinculada a este cliente ainda.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <StatCard valor={formatCurrency(historico.totalGasto)} label="Total gasto" />
                  <StatCard valor={formatCurrency(historico.ticketMedio)} label="Ticket médio" />
                  <StatCard
                    valor={historico.diasDesdeUltimaCompra != null ? `${historico.diasDesdeUltimaCompra}d` : '—'}
                    label="Última compra"
                  />
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {historico.vendas.map((v) => (
                    <div key={v.id} className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary truncate">
                        {formatarData(v.data)} · {v.nome_item}
                      </span>
                      <span className="text-text-primary font-medium shrink-0 ml-2">
                        {formatCurrency(v.valor_total)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {historico.orcamentosAbertos.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1.5">
                  <Receipt size={12} /> Orçamentos em aberto
                </p>
                <div className="space-y-1.5">
                  {historico.orcamentosAbertos.map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">{o.codigo}</span>
                      <span className="text-text-faint">{formatarData(o.criado_em.slice(0, 10))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tarefas.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
              <ClipboardList size={12} /> Tarefas e visitas
            </p>
            <div className="space-y-1.5">
              {tarefas.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-text-secondary flex items-center gap-1.5 min-w-0">
                    {t.tipo === 'visita' && <MapPin size={11} className="text-accent shrink-0" />}
                    <span className="truncate">{t.titulo}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {t.prazo && (
                      <span className="text-text-faint flex items-center gap-1">
                        <Clock size={10} /> {new Date(t.prazo).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {t.status === 'concluida' ? (
                      <StatusBadge texto="Concluída" tom="positive" />
                    ) : (
                      <StatusBadge texto="Pendente" tom="warning" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
            <PackageSearch size={12} /> Peças procuradas
          </p>
          <div className="space-y-1.5 mb-3">
            {(cliente.pecas_procuradas || []).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 bg-surface-card border border-border-subtle rounded-control p-2.5">
                <div className="min-w-0 text-xs flex-1">
                  <p className="text-text-primary truncate">{p.descricao}</p>
                  <p className="text-text-faint truncate">
                    {[p.categoria?.nome, p.modelo_moto?.nome].filter(Boolean).join(' · ') || 'Sem filtro'}
                  </p>
                </div>
                <StatusBadge texto={PECA_STATUS_LABELS[p.status]} tom={PECA_STATUS_TONS[p.status]} />
                {p.status === 'aguardando' && onAtualizarStatusPeca && (
                  <Button variant="ghost" size="icon" onClick={() => onAtualizarStatusPeca(p.id, 'cancelada')} title="Cancelar pedido" className="shrink-0 size-6 rounded-control text-text-faint hover:text-danger">
                    <X size={12} />
                  </Button>
                )}
                {onRemoverPeca && (
                  <Button variant="ghost" size="icon" onClick={() => onRemoverPeca(p.id)} title="Cancelar pedido" className="shrink-0 size-6 rounded-control text-text-faint hover:text-danger">
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            ))}
            {(cliente.pecas_procuradas || []).length === 0 && (
              <p className="text-xs text-text-faint">Nenhum pedido em aberto.</p>
            )}
          </div>
          {onEnviarPeca && (
            <div className="space-y-2">
              <input
                value={novaPeca.descricao}
                onChange={(e) => setNovaPeca((p) => ({ ...p, descricao: e.target.value }))}
                placeholder="O que o cliente está procurando?"
                className={cn(inputClass, 'text-xs py-2')}
              />
              <div className="grid grid-cols-2 gap-2">
                <Select ariaLabel="Categoria da peça procurada" size="sm" value={novaPeca.categoria_id || ''} onChange={(categoria_id) => setNovaPeca((peca) => ({ ...peca, categoria_id: categoria_id || null }))} options={[{ value: '', label: 'Categoria (opcional)' }, ...opcoesCategoria.map((opcao) => ({ value: opcao.id, label: opcao.label }))]} />
                <Select ariaLabel="Modelo da peça procurada" size="sm" value={novaPeca.modelo_moto_id || ''} onChange={(modelo_moto_id) => setNovaPeca((peca) => ({ ...peca, modelo_moto_id: modelo_moto_id || null }))} options={[{ value: '', label: 'Modelo (opcional)' }, ...opcoesModelo.map((opcao) => ({ value: opcao.id, label: opcao.label }))]} />
              </div>
              <Button
                variant="outline"
                onClick={handleEnviarPeca}
                disabled={enviandoPeca || !novaPeca.descricao.trim()}
                className="w-full h-9 rounded-control bg-surface-inset border-border-default text-text-secondary text-xs font-medium"
              >
                {enviandoPeca ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Registrar pedido
              </Button>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
            <StickyNote size={12} /> Anotações de atendimento
          </p>
          {onEnviarNota && (
            <div className="flex gap-2 mb-3">
              <input
                value={novaNota}
                onChange={(e) => setNovaNota(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEnviarNota()}
                className={inputClass}
                placeholder="Registrar uma anotação..."
              />
              <Button size="icon" onClick={handleEnviarNota} disabled={enviandoNota || !novaNota.trim()} className="shrink-0 size-10 rounded-control">
                {enviandoNota ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </Button>
            </div>
          )}
          {carregandoFicha ? (
            <div className="py-4 flex items-center justify-center text-text-faint">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : cliente.notas && cliente.notas.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cliente.notas.map((nota: ClienteNota) => (
                <div key={nota.id} className="bg-surface-card border border-border-subtle rounded-control p-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-text-secondary">{nota.texto}</p>
                    <p className="text-[11px] text-text-faint mt-1">
                      {nota.autor?.nome_exibicao || 'Equipe'} · {new Date(nota.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {onExcluirNota && (
                    <Button variant="ghost" size="icon" onClick={() => onExcluirNota(nota.id)} className="shrink-0 size-6 rounded-control text-text-faint hover:text-danger">
                      <Trash2 size={12} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-faint">Nenhuma anotação registrada ainda.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
            <Receipt size={12} /> Comprovantes de PIX
          </p>
          {carregandoFicha ? (
            <div className="py-4 flex items-center justify-center text-text-faint">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : (cliente.comprovantes_pix || []).length === 0 ? (
            <p className="text-xs text-text-faint">Nenhum comprovante anexado ainda.</p>
          ) : (
            <div className="space-y-2">
              {cliente.comprovantes_pix!.map((c) => (
                <div key={c.id} className="bg-surface-card border border-border-subtle rounded-control p-3 text-xs text-text-secondary">
                  {c.venda?.nome_item || 'Comprovante'} · {c.venda?.data ? formatarData(c.venda.data) : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
