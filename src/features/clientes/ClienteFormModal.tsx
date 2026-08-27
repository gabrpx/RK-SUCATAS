import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Loader2, Plus, X } from 'lucide-react';
import { cn } from '../../utils';
import { Modal } from '../../components/ui/Modal';
import { Button } from '@/src/components/ui/button';
import { formatCep, validarCep, buscarCep } from './cep';
import type { ClienteOrigem, PreferenciaContato } from './types';

const ORIGEM_LABELS: Record<ClienteOrigem, string> = {
  balcao: 'Passou na loja',
  indicacao: 'Indicação',
  mercado_livre: 'Mercado Livre',
  redes_sociais: 'Redes sociais',
  outro: 'Outro',
};

const CONTATO_LABELS: Record<PreferenciaContato, string> = {
  whatsapp: 'WhatsApp',
  ligacao: 'Ligação',
  sms: 'SMS',
  nenhuma: 'Nenhuma',
};

export interface ClienteFormData {
  nome: string;
  telefone: string;
  documento: string;
  data_nascimento: string;
  origem: string | null;
  preferencia_contato: string | null;
  tags: string[];
  observacoes: string;
  cidade: string;
  cep: string;
}

export interface ClienteFormModalProps {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: () => void;
  salvando: boolean;
  form: ClienteFormData;
  onFormChange: (form: ClienteFormData) => void;
  editando: boolean;
  erroForm: string | null;
  opcoesModelo: { id: string; label: string }[];
  motosBuscaForm: { id: string; nome: string }[];
  onAdicionarMoto: () => void;
  onRemoverMoto: (id: string) => void;
  motoBuscaSel: string;
  onMotoBuscaSelChange: (v: string) => void;
  tagsTexto: string;
  onTagsTextoChange: (v: string) => void;
}

const spring = { type: 'spring' as const, stiffness: 300, damping: 30 };

const baseInput =
  'w-full border rounded-control py-2.5 px-4 text-sm outline-none bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint transition-all duration-fast';

function FloatingField({
  label,
  children,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="relative">
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function AnimatedButton({
  children,
  variant = 'outline',
  disabled,
  onClick,
  className,
}: {
  children: ReactNode;
  variant?: 'accent' | 'outline' | 'ghost';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const base = 'h-auto flex-1 py-3 rounded-control font-medium text-sm transition-colors';
  const variants = {
    accent:
      'bg-accent text-surface-page hover:bg-accent-strong shadow-[0_2px_8px_var(--accent-shadow)]',
    outline: 'border border-border-default text-text-secondary hover:bg-surface-raised',
    ghost: 'text-text-secondary hover:bg-surface-raised',
  };

  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={spring}
      onClick={onClick}
      disabled={disabled}
      className={cn(base, variants[variant], disabled && 'opacity-50 cursor-not-allowed', className)}
    >
      {children}
    </motion.button>
  );
}

export function ClienteFormModal({
  aberto,
  onFechar,
  onSalvar,
  salvando,
  form,
  onFormChange,
  editando,
  erroForm,
  opcoesModelo,
  motosBuscaForm,
  onAdicionarMoto,
  onRemoverMoto,
  motoBuscaSel,
  onMotoBuscaSelChange,
  tagsTexto,
  onTagsTextoChange,
}: ClienteFormModalProps) {
  const cepLookupRef = useRef<string | null>(null);

  const update = (patch: Partial<ClienteFormData>) =>
    onFormChange({ ...form, ...patch });

  const handleCepChange = (raw: string) => {
    const formatted = formatCep(raw);
    update({ cep: formatted });
  };

  useEffect(() => {
    if (!validarCep(form.cep)) return;
    if (cepLookupRef.current === form.cep) return;
    cepLookupRef.current = form.cep;

    buscarCep(form.cep).then((result) => {
      if (result) {
        onFormChange({ ...form, cidade: `${result.cidade} - ${result.uf}` });
      }
    });
  }, [form.cep]);

  const cepLen = form.cep.replace(/\D/g, '').length;
  const cepValid = validarCep(form.cep);
  const cepTouched = cepLen > 0;
  const cepStatus: 'positive' | 'negative' | 'idle' = cepTouched
    ? cepValid ? 'positive' : 'negative'
    : 'idle';

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={editando ? 'Editar cliente' : 'Novo cliente'}
      tamanho="md"
      rodape={
        <div className="flex gap-3">
          <AnimatedButton variant="outline" onClick={onFechar}>
            Cancelar
          </AnimatedButton>
          <AnimatedButton variant="accent" onClick={onSalvar} disabled={salvando}>
            {salvando ? (
              <>
                <Loader2 size={14} className="inline animate-spin mr-1.5" /> Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </AnimatedButton>
        </div>
      }
    >
      <div className="space-y-4">
        {erroForm && <p className="text-sm text-danger">{erroForm}</p>}

        <FloatingField label="Nome">
          <input
            value={form.nome}
            onChange={(e) => update({ nome: e.target.value })}
            className={cn(baseInput, 'focus:ring-2 focus:ring-accent/50')}
            placeholder="Nome do cliente"
          />
        </FloatingField>

        <div className="grid grid-cols-2 gap-3">
          <FloatingField label="Telefone">
            <input
              value={form.telefone}
              onChange={(e) => update({ telefone: e.target.value })}
              inputMode="numeric"
              maxLength={15}
              className={cn(baseInput, 'focus:ring-2 focus:ring-accent/50')}
              placeholder="(00) 00000-0000"
            />
          </FloatingField>
          <FloatingField label="CPF/CNPJ">
            <input
              value={form.documento}
              onChange={(e) => update({ documento: e.target.value })}
              inputMode="numeric"
              maxLength={18}
              className={cn(baseInput, 'focus:ring-2 focus:ring-accent/50')}
              placeholder="Opcional"
            />
          </FloatingField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FloatingField label="CEP">
            <input
              value={form.cep}
              onChange={(e) => handleCepChange(e.target.value)}
              inputMode="numeric"
              maxLength={9}
              data-cep-status={cepStatus}
              style={
                cepStatus === 'positive'
                  ? { boxShadow: '0 0 0 2px var(--positive)', borderColor: 'var(--positive)' }
                  : cepStatus === 'negative'
                    ? { boxShadow: '0 0 0 2px var(--negative)', borderColor: 'var(--negative)' }
                    : undefined
              }
              className={cn(baseInput, 'focus:ring-2 focus:ring-accent/50')}
              placeholder="00000-000"
            />
          </FloatingField>
          <FloatingField label="Cidade / UF">
            <input
              value={form.cidade}
              onChange={(e) => update({ cidade: e.target.value })}
              className={cn(baseInput, 'focus:ring-2 focus:ring-accent/50')}
              placeholder="Preenchido pelo CEP"
            />
          </FloatingField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FloatingField label="Aniversário">
            <input
              type="date"
              value={form.data_nascimento}
              onChange={(e) => update({ data_nascimento: e.target.value })}
              className={cn(baseInput, 'focus:ring-2 focus:ring-accent/50')}
            />
          </FloatingField>
          <FloatingField label="Preferência de contato">
            <select
              value={form.preferencia_contato || ''}
              onChange={(e) => update({ preferencia_contato: e.target.value || null })}
              className={cn(baseInput, 'focus:ring-2 focus:ring-accent/50')}
            >
              <option value="">—</option>
              {(Object.keys(CONTATO_LABELS) as PreferenciaContato[]).map((k) => (
                <option key={k} value={k}>
                  {CONTATO_LABELS[k]}
                </option>
              ))}
            </select>
          </FloatingField>
        </div>

        <FloatingField label="Como conheceu a loja">
          <select
            value={form.origem || ''}
            onChange={(e) => update({ origem: e.target.value || null })}
            className={cn(baseInput, 'focus:ring-2 focus:ring-accent/50')}
          >
            <option value="">—</option>
            {(Object.keys(ORIGEM_LABELS) as ClienteOrigem[]).map((k) => (
              <option key={k} value={k}>
                {ORIGEM_LABELS[k]}
              </option>
            ))}
          </select>
        </FloatingField>

        <FloatingField label="Motos que ele busca peças">
          <div className="flex gap-2">
            <select
              value={motoBuscaSel}
              onChange={(e) => onMotoBuscaSelChange(e.target.value)}
              className={cn(baseInput, 'flex-1 focus:ring-2 focus:ring-accent/50')}
            >
              <option value="">Escolher modelo…</option>
              {opcoesModelo
                .filter((o) => !motosBuscaForm.some((m) => m.id === o.id))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={onAdicionarMoto}
              disabled={!motoBuscaSel}
              className="h-auto px-4 rounded-control border-border-default text-sm shrink-0"
            >
              <Plus size={14} /> Add
            </Button>
          </div>
          {motosBuscaForm.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {motosBuscaForm.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-soft-bg text-accent-soft-fg text-xs font-medium pl-2.5 pr-1 py-1"
                >
                  {m.nome.split('›').pop()?.trim() || m.nome}
                  <button
                    type="button"
                    onClick={() => onRemoverMoto(m.id)}
                    className="flex size-4 items-center justify-center rounded-full hover:bg-accent/20"
                    title="Remover"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-text-faint mt-1.5">
            Vira um pedido de peça com a moto — aparece como badge no cliente e na lista.
          </p>
        </FloatingField>

        <FloatingField label="Tags (separadas por vírgula)">
          <input
            value={tagsTexto}
            onChange={(e) => onTagsTextoChange(e.target.value)}
            className={cn(baseInput, 'focus:ring-2 focus:ring-accent/50')}
            placeholder="ex: revendedor, atacado"
          />
        </FloatingField>

        <FloatingField label="Observações">
          <textarea
            value={form.observacoes}
            onChange={(e) => update({ observacoes: e.target.value })}
            className={cn(baseInput, 'min-h-20 resize-none focus:ring-2 focus:ring-accent/50')}
            placeholder='Nota fixa, ex: "só liga depois das 18h"'
          />
        </FloatingField>
      </div>
    </Modal>
  );
}
