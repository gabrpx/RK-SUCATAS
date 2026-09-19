import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Plus,
  UserPlus,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/utils";
import type {
  PreviewTaskCategory,
  PreviewTaskPriority,
} from "./taskPreviewModel";

export type DemoOperator = {
  id: string;
  name: string;
  initials: string;
  tone: string;
};

export const demoOperators: DemoOperator[] = [
  {
    id: "kaua",
    name: "Kauã",
    initials: "KA",
    tone: "bg-blue-100 text-blue-700 ring-blue-200",
  },
  {
    id: "ayrton",
    name: "Ayrton",
    initials: "AY",
    tone: "bg-amber-100 text-amber-800 ring-amber-200",
  },
  {
    id: "ryan",
    name: "Ryan",
    initials: "RY",
    tone: "bg-violet-100 text-violet-700 ring-violet-200",
  },
  {
    id: "pitoco",
    name: "Pitoco",
    initials: "PI",
    tone: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  },
  {
    id: "eloisa",
    name: "Eloisa",
    initials: "EL",
    tone: "bg-rose-100 text-rose-700 ring-rose-200",
  },
];

const categoryLabel: Record<PreviewTaskCategory, string> = {
  estoque: "Estoque",
  organizacao: "Organização",
  limpeza: "Limpeza",
  despacho: "Despacho",
  outro: "Outro",
};

const priorityOptions: Array<{
  value: PreviewTaskPriority;
  label: string;
  description: string;
  className: string;
}> = [
  {
    value: "baixa",
    label: "P3 Baixa",
    description: "Sem urgência",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  {
    value: "normal",
    label: "P2 Normal",
    description: "No turno",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    value: "alta",
    label: "P1 Alta",
    description: "Priorizar",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  {
    value: "critica",
    label: "P0 Crítica",
    description: "Ação imediata",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
];

type ChecklistDraft = { id: string; label: string; owner: string };

type ComposerDraft = {
  title: string;
  instructions: string;
  category: PreviewTaskCategory;
  priority: PreviewTaskPriority;
  operatorIds: string[];
  dueTime: string;
  checklist: ChecklistDraft[];
};

function makeInitialDraft(owner = "ryan"): ComposerDraft {
  return {
    title: "",
    instructions: "",
    category: "estoque",
    priority: "normal",
    operatorIds: [owner],
    dueTime: "17:30",
    checklist: [],
  };
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
      {children}
    </p>
  );
}

function OperatorAvatar({
  operator,
  small = false,
}: {
  operator: DemoOperator;
  small?: boolean;
}) {
  return (
    <span
      aria-label={operator.name}
      title={operator.name}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-mono font-bold ring-1",
        small ? "size-6 text-[9px]" : "size-8 text-[10px]",
        operator.tone
      )}
    >
      {operator.initials}
    </span>
  );
}

function FormSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 pt-6 first:border-t-0 first:pt-0">
      <Label>{eyebrow}</Label>
      <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ActionTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-48 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-center text-[10px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

function ChecklistOwnerPicker({
  ownerId,
  operators,
  onChange,
}: {
  ownerId: string;
  operators: DemoOperator[];
  onChange: (operatorId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const selected =
    operators.find((operator) => operator.id === ownerId) ?? operators[0];

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gutter = 8;
      const preferredHeight = 236;
      const spaceBelow = window.innerHeight - rect.bottom - gutter;
      const spaceAbove = rect.top - gutter;
      const openAbove = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
      const maxHeight = Math.max(116, Math.min(preferredHeight, openAbove ? spaceAbove : spaceBelow));
      const width = Math.max(rect.width, 208);
      const left = Math.max(gutter, Math.min(rect.left, window.innerWidth - width - gutter));
      setPosition(
        openAbove
          ? { bottom: window.innerHeight - rect.top + gutter, left, width, maxHeight }
          : { top: rect.bottom + gutter, left, width, maxHeight }
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  if (!selected) {
    return (
      <span className="block rounded-md border border-dashed border-slate-200 px-2 py-2 text-xs text-slate-400">
        Defina a equipe
      </span>
    );
  }

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left text-xs text-slate-700 shadow-sm transition-colors hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <OperatorAvatar operator={selected} small />
        <span className="min-w-0 flex-1 truncate">{selected.name}</span>
        <ChevronDown
          size={14}
          className={cn(
            "text-slate-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && position && (
            <motion.div
              ref={menuRef}
              role="listbox"
              aria-label="Responsáveis disponíveis na equipe"
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              style={position}
              onWheel={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
              className="fixed z-[300] overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white p-1.5 shadow-[0_16px_32px_rgba(15,23,42,0.16)] [scrollbar-color:rgb(96_165_250)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-400 [&::-webkit-scrollbar-thumb:hover]:bg-blue-500 [&::-webkit-scrollbar-track]:bg-slate-100"
            >
              <p className="sticky top-0 z-10 border-b border-slate-100 bg-white px-2 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Equipe designada ({operators.length})
              </p>
              {operators.map((operator) => (
                <button
                  key={operator.id}
                  type="button"
                  role="option"
                  aria-selected={operator.id === ownerId}
                  onClick={() => {
                    onChange(operator.id);
                    close();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    operator.id === ownerId
                      ? "bg-blue-50 text-blue-800"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <OperatorAvatar operator={operator} small />
                  <span className="flex-1">{operator.name}</span>
                  {operator.id === ownerId && <Check size={13} />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function DiscardChangesDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[260] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-[0_24px_72px_rgba(15,23,42,0.28)]"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-amber-50 text-amber-700">
                <AlertTriangle size={18} />
              </span>
              <div>
                <Label>Alterações não salvas</Label>
                <h3
                  id="discard-title"
                  className="mt-1 text-lg font-semibold tracking-tight text-slate-900"
                >
                  Descartar esta tarefa?
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  O título, prazo, responsáveis e checklist preenchidos nesta
                  sessão serão perdidos.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <ActionTooltip label="Mantém o formulário aberto para continuar a edição.">
                <button
                  type="button"
                  autoFocus
                  onClick={onCancel}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Continuar editando
                </button>
              </ActionTooltip>
              <ActionTooltip label="Remove o preenchimento atual e fecha a criação.">
                <button
                  type="button"
                  onClick={onConfirm}
                  className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  Descartar alterações
                </button>
              </ActionTooltip>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function TaskComposer({
  open,
  onClose,
  onCreate,
  operators = demoOperators,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    category: PreviewTaskCategory;
    priority: PreviewTaskPriority;
    operatorIds: string[];
    instructions: string;
    checklistLabels: string[];
    checklistOwners: string[];
    dueTime: string;
  }) => void;
  operators?: DemoOperator[];
}) {
  const [draft, setDraft] = useState<ComposerDraft>(makeInitialDraft);
  const [isDirty, setIsDirty] = useState(false);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [checklistFocusId, setChecklistFocusId] = useState<string | null>(null);
  const [shouldLockScroll, setShouldLockScroll] = useState(open);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dialogScrollRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setShouldLockScroll(true);
    setDraft(makeInitialDraft(operators[0]?.id));
    setIsDirty(false);
    setIsDiscardDialogOpen(false);
  }, [open]);

  useEffect(() => {
    if (!shouldLockScroll) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [shouldLockScroll]);

  useEffect(() => {
    if (!checklistFocusId) return;
    const settleLayout = window.setTimeout(() => {
      const target = document.getElementById(
        `checklist-step-${checklistFocusId}`
      ) as HTMLInputElement | null;
      const scrollContainer = dialogScrollRef.current;
      if (!target || !scrollContainer) return;

      target.focus({ preventScroll: true });
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextTop =
        scrollContainer.scrollTop +
        targetRect.top -
        containerRect.top -
        containerRect.height * 0.42;

      scrollContainer.scrollTo({
        top: Math.max(0, nextTop),
        behavior: shouldReduceMotion ? "auto" : "smooth",
      });
      setChecklistFocusId(null);
    }, shouldReduceMotion ? 0 : 180);

    return () => window.clearTimeout(settleLayout);
  }, [checklistFocusId, shouldReduceMotion]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isDiscardDialogOpen) setIsDiscardDialogOpen(false);
        else requestClose();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const selectedOperators = useMemo(
    () =>
      operators.filter((operator) =>
        draft.operatorIds.includes(operator.id)
      ),
    [draft.operatorIds, operators]
  );
  const deadline =
    draft.category === "despacho" ? "Hoje, 16:30" : `Hoje, ${draft.dueTime}`;

  const updateDraft = (update: (current: ComposerDraft) => ComposerDraft) => {
    setDraft(update);
    setIsDirty(true);
  };
  const requestClose = () => {
    if (isDirty) {
      setIsDiscardDialogOpen(true);
      return;
    }
    onClose();
  };
  const confirmDiscard = () => {
    setIsDiscardDialogOpen(false);
    onClose();
  };
  const toggleOperator = (id: string) => {
    updateDraft((current) => {
      const isSelected = current.operatorIds.includes(id);
      if (isSelected && current.operatorIds.length === 1) return current;

      const operatorIds = isSelected
        ? current.operatorIds.filter((item) => item !== id)
        : [...current.operatorIds, id];
      const fallbackOwner = operatorIds[0];

      return {
        ...current,
        operatorIds,
        checklist: current.checklist.map((entry) =>
          operatorIds.includes(entry.owner)
            ? entry
            : { ...entry, owner: fallbackOwner }
        ),
      };
    });
  };
  const setChecklistOwner = (checklistId: string, owner: string) => {
    updateDraft((current) => ({
      ...current,
      operatorIds: current.operatorIds.includes(owner)
        ? current.operatorIds
        : [...current.operatorIds, owner],
      checklist: current.checklist.map((entry) =>
        entry.id === checklistId ? { ...entry, owner } : entry
      ),
    }));
  };
  const addChecklistStep = () => {
    const id = `step-${Date.now()}`;
    updateDraft((current) => ({
      ...current,
      checklist: [
        ...current.checklist,
        { id, label: "", owner: current.operatorIds[0] ?? "ryan" },
      ],
    }));
    setChecklistFocusId(id);
  };
  const submit = () => {
    if (!draft.title.trim()) return;
    onCreate({
      title: draft.title,
      category: draft.category,
      priority: draft.priority,
      operatorIds: draft.operatorIds,
      instructions: draft.instructions,
      checklistLabels: draft.checklist.map((item) => item.label),
      checklistOwners: draft.checklist.map((item) => item.owner),
      dueTime: draft.dueTime,
    });
  };

  return (
    <AnimatePresence
      initial={false}
      onExitComplete={() => {
        setShouldLockScroll(false);
        previousFocusRef.current?.focus?.();
      }}
    >
      {open && <motion.div
      ref={dialogScrollRef}
      role="dialog"
      aria-modal="true"
      aria-label="Criar tarefa operacional"
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0 }}
      className="fixed inset-0 z-[220] overflow-x-hidden overflow-y-auto overscroll-contain bg-slate-950/35 p-0 backdrop-blur-sm [scrollbar-color:rgb(96_165_250)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-400 [&::-webkit-scrollbar-track]:bg-transparent sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <motion.form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        onMouseDown={(event) => event.stopPropagation()}
        initial={
          shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, y: 14, scale: 0.985 }}
        layout="size"
        transition={{
          default: { type: "spring", stiffness: 360, damping: 32, mass: 0.72 },
          layout: { type: "spring", stiffness: 380, damping: 32, mass: 0.72 },
        }}
        className="mx-auto min-h-[100dvh] min-w-0 w-full max-w-[1120px] overflow-x-hidden rounded-none border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.26)] sm:my-2 sm:min-h-0 sm:rounded-xl sm:border"
      >
        <header className="sticky top-0 z-20 flex min-w-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-7 sm:py-4">
          <div className="min-w-0">
            <Label>Nova tarefa · turno ativo</Label>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-2xl">
              Preparar execução operacional
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline">
              ESC
            </kbd>
            <button
              type="button"
              aria-label="Fechar criação de tarefa"
              onClick={requestClose}
              className="grid size-11 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={17} />
            </button>
          </div>
        </header>

        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 space-y-7 p-5 sm:p-7">
            <FormSection
              eyebrow="01 · Definir tarefa"
              title="O que precisa ser feito?"
            >
              <div className="flex items-end justify-between gap-3">
                <label htmlFor="task-title" className="flex-1">
                  <Label>Título operacional *</Label>
                  <input
                    id="task-title"
                    autoFocus
                    required
                    maxLength={100}
                    value={draft.title}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Ex.: Organizar lote de bengalas"
                    className="mt-2 w-full border-0 border-b border-slate-300 bg-transparent px-0 py-3 text-lg font-medium text-slate-900 outline-none placeholder:text-slate-300 focus:border-blue-600"
                  />
                </label>
                <span className="pb-3 font-mono text-[10px] text-slate-400">
                  {draft.title.length}/100
                </span>
              </div>
              <label htmlFor="task-instructions" className="mt-5 block">
                <Label>Instruções e cuidados</Label>
                <textarea
                  id="task-instructions"
                  value={draft.instructions}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      instructions: event.target.value,
                    }))
                  }
                  placeholder="Explique cuidados, ponto de conferência ou risco antes da conclusão."
                  rows={3}
                    className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-2.5 text-base leading-relaxed text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm"
                />
              </label>
              <div className="mt-5">
                <Label>Setor responsável *</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.keys(categoryLabel) as PreviewTaskCategory[]).map(
                    (category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() =>
                          updateDraft((current) => ({ ...current, category }))
                        }
                        aria-pressed={draft.category === category}
                        className={cn(
                          "min-h-11 rounded-md border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                          draft.category === category
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                        )}
                      >
                        {categoryLabel[category]}
                      </button>
                    )
                  )}
                </div>
              </div>
            </FormSection>

            <FormSection
              eyebrow="02 · Coordenar execução"
              title="Quando e com quem?"
            >
              <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
                <div>
                  <Label>Prioridade e impacto</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {priorityOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          updateDraft((current) => ({
                            ...current,
                            priority: option.value,
                          }))
                        }
                        aria-pressed={draft.priority === option.value}
                        className={cn(
                          "rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                          draft.priority === option.value
                            ? `${option.className} ring-1 ring-current`
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        <span className="block text-xs font-semibold">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-[10px] opacity-70">
                          {option.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <Label>Prazo / SLA</Label>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <Clock3 size={14} className="text-blue-600" /> {deadline}
                  </p>
                  {draft.category === "despacho" ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-violet-700">
                      Fechamento de expedição às 16:30.
                    </p>
                  ) : (
                    <label className="mt-3 block text-xs font-medium text-slate-600">
                      Horário
                      <input
                        type="time"
                        value={draft.dueTime}
                        onChange={(event) =>
                          updateDraft((current) => ({
                            ...current,
                            dueTime: event.target.value,
                          }))
                        }
                        className="mt-1.5 block h-11 w-full rounded border border-slate-300 bg-white px-2 text-base outline-none focus:border-blue-500 sm:text-sm"
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <Label>Responsáveis</Label>
                  <UserPlus size={15} className="text-blue-600" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {operators.map((operator) => (
                    <button
                      key={operator.id}
                      type="button"
                      aria-pressed={draft.operatorIds.includes(operator.id)}
                      onClick={() => toggleOperator(operator.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        draft.operatorIds.includes(operator.id)
                          ? "border-blue-200 bg-blue-50 text-blue-800"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <OperatorAvatar operator={operator} small />{" "}
                      <span>{operator.name}</span>
                      {draft.operatorIds.includes(operator.id) && (
                        <Check size={13} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </FormSection>

            <FormSection
              eyebrow="03 · Preparar execução"
              title="Checklist e responsáveis por etapa"
            >
              <div className="divide-y divide-slate-200 border-y border-slate-200">
                <AnimatePresence initial={false}>
                  {draft.checklist.map((item, index) => (
                    <motion.div
                      key={item.id}
                      layout="position"
                      initial={
                        shouldReduceMotion ? false : { opacity: 0, y: -6 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        shouldReduceMotion ? undefined : { opacity: 0, y: -6 }
                      }
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                      className="grid gap-2 py-3 sm:grid-cols-[28px_minmax(0,1fr)_150px_auto] sm:items-center"
                    >
                      <span className="font-mono text-[10px] text-slate-400">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <input
                        id={`checklist-step-${item.id}`}
                        value={item.label}
                        onChange={(event) =>
                          updateDraft((current) => ({
                            ...current,
                            checklist: current.checklist.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, label: event.target.value }
                                : entry
                            ),
                          }))
                        }
                        placeholder="Descreva a etapa"
                        className="min-h-11 min-w-0 bg-transparent text-base text-slate-700 outline-none placeholder:text-slate-400 sm:text-sm"
                      />
                      <ChecklistOwnerPicker ownerId={item.owner} operators={selectedOperators} onChange={(owner) => setChecklistOwner(item.id, owner)} />
                      <button
                        type="button"
                        aria-label={`Remover etapa ${index + 1}`}
                        onClick={() =>
                          updateDraft((current) => ({
                            ...current,
                            checklist: current.checklist.filter(
                              (entry) => entry.id !== item.id
                            ),
                          }))
                        }
                        className="grid size-11 place-items-center justify-self-end rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <X size={15} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <button
                type="button"
                onClick={addChecklistStep}
                className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Plus size={14} /> Adicionar etapa
              </button>
            </FormSection>
          </div>

          <aside className="min-w-0 border-t border-slate-200 bg-slate-50/70 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div className="lg:sticky lg:top-5">
              <Label>04 · Revisar e criar</Label>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                Resumo da execução
              </h3>
              <div className="mt-5 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                <div>
                  <Label>Tarefa</Label>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {draft.title || "Defina o título da tarefa"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                  <div>
                    <Label>Setor</Label>
                    <p className="mt-1 text-xs font-medium text-slate-700">
                      {categoryLabel[draft.category]}
                    </p>
                  </div>
                  <div>
                    <Label>Prazo</Label>
                    <p className="mt-1 text-xs font-medium text-slate-700">
                      {deadline}
                    </p>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-4">
                  <Label>Equipe ({selectedOperators.length})</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedOperators.length ? (
                      selectedOperators.map((operator) => (
                        <OperatorAvatar
                          key={operator.id}
                          operator={operator}
                          small
                        />
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">
                        Nenhum responsável definido
                      </span>
                    )}
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-4">
                  <Label>Checklist</Label>
                  <p className="mt-1 text-xs text-slate-600">
                    {draft.checklist.filter((item) => item.label.trim()).length}{" "}
                    etapa(s) preparada(s)
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                A tarefa entra na fila recomendada do turno após a criação.
              </p>
            </div>
          </aside>
        </div>

        <footer className="sticky bottom-0 z-20 flex min-w-0 flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-4 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] pt-3 sm:px-7 sm:py-4">
          <span className="mr-auto hidden font-mono text-[10px] text-slate-400 sm:inline">
            ⌘↵ criar tarefa
          </span>
          <ActionTooltip label="Abre a confirmação antes de descartar o preenchimento.">
            <button
              type="button"
              onClick={requestClose}
              className="h-11 rounded-md px-3 text-sm text-slate-500 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Descartar
            </button>
          </ActionTooltip>
          <ActionTooltip
            label={
              draft.title.trim()
                ? "Cria a tarefa e a envia para a fila do turno."
                : "Informe o título operacional para criar a tarefa."
            }
          >
            <Button
              type="submit"
              disabled={!draft.title.trim()}
              className="h-11 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} /> Criar tarefa <ChevronRight size={15} />
            </Button>
          </ActionTooltip>
        </footer>
      </motion.form>
      <DiscardChangesDialog
        open={isDiscardDialogOpen}
        onCancel={() => setIsDiscardDialogOpen(false)}
        onConfirm={confirmDiscard}
      />
    </motion.div>}
    </AnimatePresence>
  );
}
