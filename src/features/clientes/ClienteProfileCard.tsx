// Cartão de perfil do cliente no estilo do profile-card do watermelon.sh:
// cabeçalho clicável (avatar + nome + segmento) que expande/recolhe uma lista
// de atributos em linhas (DataRow) com animação de mola. Adaptado deste
// projeto: os ícones react-icons do template viraram lucide, e as cores
// hardcoded viraram tokens do design system (ver theme.css). Usado na ficha
// do cliente (ClientesView) no lugar da grade de infos estática.
import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp, Phone, IdCard, Cake, Compass, MessageCircle, Bike, Tag } from 'lucide-react';
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge';

interface ClienteProfileCardProps {
  nome: string;
  telefone?: string | null;
  documento?: string | null;
  aniversario?: string | null;
  origem?: string | null;
  contatoPreferido?: string | null;
  tags?: string[];
  motosCount?: number;
  segmentoLabel?: string;
  segmentoTom?: StatusTone;
  /** Inicia expandido (default true — na ficha o usuário quer ver logo). */
  defaultAberto?: boolean;
}

const spring = { type: 'spring', stiffness: 300, damping: 30 } as const;

function iniciaisDe(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function ClienteProfileCard({
  nome,
  telefone,
  documento,
  aniversario,
  origem,
  contatoPreferido,
  tags = [],
  motosCount = 0,
  segmentoLabel,
  segmentoTom = 'neutral',
  defaultAberto = true,
}: ClienteProfileCardProps) {
  const [aberto, setAberto] = useState(defaultAberto);

  return (
    <motion.div
      layout
      transition={spring}
      className="w-full overflow-hidden rounded-card border border-border-subtle bg-surface-card"
    >
      <div className="h-px w-full bg-gradient-surface-edge" />
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-control bg-accent-soft-bg text-accent-soft-fg text-sm font-semibold">
            {iniciaisDe(nome) || '?'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-text-primary">{nome}</p>
            {telefone && <p className="truncate text-xs text-text-muted tabular-nums">{telefone}</p>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {segmentoLabel && <StatusBadge texto={segmentoLabel} tom={segmentoTom} />}
          <motion.span
            animate={{ rotate: aberto ? 0 : 180 }}
            transition={spring}
            className="flex size-7 items-center justify-center rounded-control border border-border-default text-text-muted"
          >
            <ChevronUp size={18} />
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            className="overflow-hidden border-t border-border-subtle bg-surface-inset/40"
          >
            <div className="space-y-3.5 p-4">
              <DataRow icon={<Phone size={15} />} label="Telefone">
                <span className="text-sm font-medium text-text-primary tabular-nums">{telefone || '—'}</span>
              </DataRow>
              <DataRow icon={<IdCard size={15} />} label="Documento">
                <span className="text-sm font-medium text-text-primary tabular-nums">{documento || '—'}</span>
              </DataRow>
              <DataRow icon={<Cake size={15} />} label="Aniversário">
                <span className="text-sm font-medium text-text-primary">{aniversario || '—'}</span>
              </DataRow>
              <DataRow icon={<Compass size={15} />} label="Origem">
                <span className="text-sm font-medium text-text-primary">{origem || '—'}</span>
              </DataRow>
              <DataRow icon={<MessageCircle size={15} />} label="Contato preferido">
                <span className="text-sm font-medium text-text-primary">{contatoPreferido || '—'}</span>
              </DataRow>
              <DataRow icon={<Bike size={15} />} label="Motos">
                <span className="text-sm font-medium text-text-primary tabular-nums">
                  {motosCount > 0 ? `${motosCount} cadastrada(s)` : '—'}
                </span>
              </DataRow>
              {tags.length > 0 && (
                <DataRow icon={<Tag size={15} />} label="Tags">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {tags.map((t) => (
                      <span key={t}>
                        <StatusBadge texto={t} tom="accent" />
                      </span>
                    ))}
                  </div>
                </DataRow>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DataRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex shrink-0 items-center gap-2.5 text-text-muted">
        {icon}
        <span className="text-[13px] font-medium whitespace-nowrap">{label}</span>
      </div>
      <div className="flex min-w-0 flex-1 justify-end text-right">{children}</div>
    </div>
  );
}
