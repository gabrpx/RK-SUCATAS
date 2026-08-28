import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Printer, RotateCcw, Check, Loader2 } from 'lucide-react';
import { cn } from '@/src/utils';
import { SPRING_SHEET } from '@/src/components/ui/motion';
import {
  onlyDigits,
  formatTelefoneBR,
  formatDocumentoBR,
  formatCurrencyInput,
  parseCurrencyInput,
} from '@/src/utils/formatters';
import { NotaTemplate } from './NotaTemplate';
import type { NotaData } from './NotaTemplate';

type ViewState = 'form' | 'loading' | 'preview';

const REQUIRED_FIELDS: (keyof NotaData)[] = ['comprador', 'documento', 'veiculo', 'valor'];

function formatCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function formatDateBR(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function useIsMobile() {
  const [v, setV] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const h = (e: MediaQueryListEvent) => setV(e.matches);
    mql.addEventListener('change', h);
    return () => mql.removeEventListener('change', h);
  }, []);
  return v;
}

function freshForm(): NotaData {
  return {
    data: new Date().toISOString().split('T')[0],
    comprador: '',
    endereco: '',
    cidade: 'Juazeirinho - PB',
    cep: '',
    fone: '',
    documento: '',
    rg: '',
    dataNascimento: '',
    veiculo: '',
    valor: '',
  };
}

const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeclaracaoVendaModal({ open, onOpenChange }: Props) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState<NotaData>(freshForm);
  const [errors, setErrors] = useState<Partial<Record<keyof NotaData, boolean>>>({});
  const [view, setView] = useState<ViewState>('form');
  const [notaData, setNotaData] = useState<NotaData | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobile || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handle = () => setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    vv.addEventListener('resize', handle);
    return () => vv.removeEventListener('resize', handle);
  }, [isMobile]);

  const set = useCallback(
    (field: keyof NotaData, value: string) => {
      setForm((p) => ({ ...p, [field]: value }));
      if (errors[field]) setErrors((p) => ({ ...p, [field]: false }));
    },
    [errors],
  );

  const validate = (): boolean => {
    const next: Partial<Record<keyof NotaData, boolean>> = {};
    let ok = true;
    for (const f of REQUIRED_FIELDS) {
      const v = form[f].trim();
      if (!v || (f === 'valor' && parseCurrencyInput(v) === 0)) {
        next[f] = true;
        ok = false;
      }
    }
    setErrors(next);
    return ok;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setView('loading');
    setNotaData({ ...form });
    setTimeout(() => setView('preview'), 500);
  };

  const handleReset = () => {
    setForm(freshForm());
    setErrors({});
    setNotaData(null);
    setView('form');
    scrollRef.current?.scrollTo(0, 0);
  };

  const handlePrint = () => window.print();

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setView('form'), 350);
      return () => clearTimeout(t);
    }
  }, [open]);

  const footerInScroll = isMobile && keyboardOpen;

  const formFooter = view === 'form' && (
    <div
      className={cn(
        'px-5 py-4 border-t border-border-subtle bg-background',
        isMobile && !keyboardOpen && 'pb-[calc(1rem+env(safe-area-inset-bottom))]',
      )}
    >
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="h-12 px-4 text-text-muted hover:text-text-secondary rounded-control text-sm transition-colors"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="flex-1 h-12 bg-gradient-accent-cta text-white rounded-control font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <FileText size={18} />
          Gerar e Imprimir
        </button>
      </div>
    </div>
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-overlay-scrim"
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                initial={
                  isMobile
                    ? { y: '100%', opacity: 0.5 }
                    : { scale: 0.95, opacity: 0 }
                }
                animate={
                  isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 }
                }
                exit={
                  isMobile
                    ? { y: '100%', opacity: 0 }
                    : { scale: 0.95, opacity: 0 }
                }
                transition={
                  isMobile
                    ? SPRING_SHEET
                    : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }
                }
                className={cn(
                  'fixed z-50 outline-none flex flex-col',
                  isMobile
                    ? 'inset-x-0 bottom-0 top-0 rounded-t-sheet bg-background'
                    : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[85vh] rounded-card border border-border-default bg-background shadow-lg',
                )}
              >
                {/* Header */}
                <div
                  className={cn(
                    'flex items-center justify-between px-5 shrink-0 border-b border-border-subtle',
                    isMobile ? 'min-h-14 pt-safe' : 'h-14',
                  )}
                >
                  <DialogPrimitive.Title className="text-base font-semibold text-text-primary truncate pr-2">
                    Nova Declaração de Venda
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Close className="size-10 md:size-9 flex items-center justify-center rounded-control text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors shrink-0">
                    <X size={18} />
                  </DialogPrimitive.Close>
                </div>

                {/* Scrollable body */}
                <div
                  ref={scrollRef}
                  className={cn(
                    'flex-1 overflow-y-auto overscroll-contain px-5 py-5',
                    view === 'form' && !footerInScroll && 'pb-28',
                  )}
                >
                  <AnimatePresence mode="wait">
                    {view === 'form' && (
                      <motion.div
                        key="form"
                        initial="hidden"
                        animate="show"
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        variants={{
                          hidden: {},
                          show: { transition: { staggerChildren: 0.05 } },
                        }}
                        className="space-y-6"
                      >
                        {/* Comprador */}
                        <motion.div variants={sectionVariants} className="space-y-4">
                          <SectionLabel>Comprador</SectionLabel>
                          <Field label="Nome completo" required error={errors.comprador}>
                            <input
                              type="text"
                              value={form.comprador}
                              onChange={(e) => set('comprador', e.target.value)}
                              placeholder="Nome completo do comprador"
                              className={inputCls(errors.comprador)}
                            />
                          </Field>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="CPF/CNPJ" required error={errors.documento}>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={form.documento}
                                onChange={(e) => set('documento', formatDocumentoBR(e.target.value))}
                                placeholder="000.000.000-00"
                                className={inputCls(errors.documento)}
                              />
                            </Field>
                            <Field label="RG">
                              <input
                                type="text"
                                value={form.rg}
                                onChange={(e) => set('rg', e.target.value)}
                                placeholder="Número do RG"
                                className={inputCls()}
                              />
                            </Field>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Data de Nascimento">
                              <input
                                type="date"
                                value={form.dataNascimento}
                                onChange={(e) => set('dataNascimento', e.target.value)}
                                className={inputCls()}
                              />
                            </Field>
                            <Field label="Telefone">
                              <input
                                type="tel"
                                inputMode="numeric"
                                value={form.fone}
                                onChange={(e) => set('fone', formatTelefoneBR(e.target.value))}
                                placeholder="(00) 00000-0000"
                                className={inputCls()}
                              />
                            </Field>
                          </div>
                        </motion.div>

                        {/* Endereço */}
                        <motion.div variants={sectionVariants} className="space-y-4">
                          <SectionLabel>Endereço</SectionLabel>
                          <Field label="Endereço">
                            <input
                              type="text"
                              value={form.endereco}
                              onChange={(e) => set('endereco', e.target.value)}
                              placeholder="Rua, número, bairro"
                              className={inputCls()}
                            />
                          </Field>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Cidade">
                              <input
                                type="text"
                                value={form.cidade}
                                onChange={(e) => set('cidade', e.target.value)}
                                placeholder="Cidade - UF"
                                className={inputCls()}
                              />
                            </Field>
                            <Field label="CEP">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={form.cep}
                                onChange={(e) => set('cep', formatCEP(e.target.value))}
                                placeholder="00000-000"
                                className={inputCls()}
                              />
                            </Field>
                          </div>
                        </motion.div>

                        {/* Venda */}
                        <motion.div variants={sectionVariants} className="space-y-4">
                          <SectionLabel>Venda</SectionLabel>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Data da venda">
                              <input
                                type="date"
                                value={form.data}
                                onChange={(e) => set('data', e.target.value)}
                                className={inputCls()}
                              />
                            </Field>
                            <Field label="Valor" required error={errors.valor}>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-medium pointer-events-none select-none">
                                  R$
                                </span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={form.valor.replace(/^R\$\s?/, '')}
                                  onChange={(e) =>
                                    set('valor', formatCurrencyInput(e.target.value))
                                  }
                                  placeholder="0,00"
                                  className={cn(inputCls(errors.valor), 'pl-10')}
                                />
                              </div>
                            </Field>
                          </div>
                          <Field label="Veículo" required error={errors.veiculo}>
                            <input
                              type="text"
                              value={form.veiculo}
                              onChange={(e) =>
                                set('veiculo', e.target.value.toUpperCase())
                              }
                              placeholder="Ex: SHINERAY PHOENYX 50CC PRETA"
                              className={cn(
                                inputCls(errors.veiculo),
                                'text-base md:text-lg font-semibold',
                              )}
                            />
                          </Field>
                        </motion.div>
                      </motion.div>
                    )}

                    {view === 'loading' && (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-24 gap-4"
                      >
                        <Loader2 size={32} className="text-accent animate-spin" />
                        <p className="text-text-muted text-sm">
                          Gerando declaração...
                        </p>
                      </motion.div>
                    )}

                    {view === 'preview' && notaData && (
                      <motion.div
                        key="preview"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: 0.3,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="space-y-6"
                      >
                        <div className="flex flex-col items-center gap-3 py-4">
                          <div className="size-12 rounded-full bg-positive/10 flex items-center justify-center">
                            <Check size={24} className="text-positive" />
                          </div>
                          <p className="text-text-secondary text-sm">
                            Declaração gerada com sucesso
                          </p>
                        </div>

                        <div className="bg-surface-card rounded-card border border-border-subtle p-5 space-y-4">
                          <SummaryRow label="Comprador" value={notaData.comprador} />
                          <div className="space-y-1">
                            <p className="text-text-muted text-2xs uppercase tracking-wider font-medium">
                              Veículo
                            </p>
                            <p className="text-text-primary font-bold text-lg uppercase">
                              {notaData.veiculo}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-text-muted text-2xs uppercase tracking-wider font-medium">
                                Valor
                              </p>
                              <p className="text-accent font-bold text-lg">
                                {notaData.valor}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-text-muted text-2xs uppercase tracking-wider font-medium">
                                Data
                              </p>
                              <p className="text-text-primary font-medium">
                                {formatDateBR(notaData.data)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={handlePrint}
                            className="flex-1 h-12 bg-gradient-accent-cta text-white rounded-control font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                          >
                            <Printer size={18} />
                            Imprimir
                          </button>
                          <button
                            type="button"
                            onClick={handleReset}
                            className="h-12 px-5 text-text-muted hover:text-text-secondary hover:bg-surface-raised rounded-control flex items-center justify-center gap-2 transition-colors"
                          >
                            <RotateCcw size={16} />
                            Nova Nota
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {footerInScroll && formFooter}
                </div>

                {/* Fixed footer (keyboard closed) */}
                {!footerInScroll && formFooter}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>

      {notaData && <NotaTemplate data={notaData} />}
    </DialogPrimitive.Root>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-text-muted text-2xs uppercase tracking-wider font-medium">
        {children}
      </span>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-text-secondary text-sm font-medium flex items-center gap-1.5">
        {label}
        {required && (
          <span className="size-1.5 rounded-full bg-accent inline-block" />
        )}
      </label>
      {children}
      {error && <p className="text-danger text-2xs">Campo obrigatório</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-text-muted text-2xs uppercase tracking-wider font-medium">
        {label}
      </p>
      <p className="text-text-primary font-semibold">{value}</p>
    </div>
  );
}

function inputCls(error?: boolean): string {
  return cn(
    'w-full h-12 md:h-10 px-3 bg-surface-raised rounded-control border text-text-primary placeholder:text-text-muted text-sm outline-none transition-colors',
    error
      ? 'border-danger focus:ring-2 focus:ring-danger/40 focus:border-danger'
      : 'border-border-subtle focus:ring-2 focus:ring-accent/40 focus:border-accent',
  );
}
