import { animate } from "animejs";
import { DotMatrix } from "dot-anime-react";
import {
  AlarmClock,
  BadgeCheck,
  BellRing,
  Check,
  CircleAlert,
  Clock3,
  FileClock,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AreaChart } from "@/src/components/charts/area-chart";
import { Area } from "@/src/components/charts/area";
import { Grid } from "@/src/components/charts/grid";
import { XAxis } from "@/src/components/charts/x-axis";
import { Button } from "@/src/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "./PreviewTabs";
import { cn } from "@/src/utils";
import {
  filterReminders,
  getMostUrgentReminder,
  getReminderCountdown,
  getReminderPrioritySummary,
  type Reminder,
  type ReminderFilter,
  type ReminderPriority,
} from "./reminderModel";
import type { HorizontalOverflowState } from "./previewOverflowModel";
import { getHorizontalOverflowState as measureHorizontalOverflow } from "./previewOverflowModel";

const priorityLabel: Record<ReminderPriority, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const priorityStyle: Record<ReminderPriority, string> = {
  critica: "border-rose-200 bg-rose-50 text-rose-700",
  alta: "border-amber-200 bg-amber-50 text-amber-800",
  media: "border-blue-200 bg-blue-50 text-blue-700",
  baixa: "border-slate-200 bg-slate-50 text-slate-600",
};

function useOverlayInteraction(
  open: boolean,
  initialFocusRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };

    window.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => initialFocusRef.current?.focus());

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [initialFocusRef, open]);
}

function useHorizontalOverflow(
  scrollRef: React.RefObject<HTMLElement | null>,
): HorizontalOverflowState {
  const [state, setState] = useState<HorizontalOverflowState>({
    isScrollable: false,
    canScrollLeft: false,
    canScrollRight: false,
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const update = () => {
      setState(
        measureHorizontalOverflow({
          scrollLeft: element.scrollLeft,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }),
      );
    };

    update();
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);
    if (element.firstElementChild instanceof HTMLElement) {
      resizeObserver.observe(element.firstElementChild);
    }

    return () => {
      element.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      resizeObserver.disconnect();
    };
  }, [scrollRef]);

  return state;
}

const previewStartedAt = Date.now();

export const initialReminders: Reminder[] = [
  {
    id: "rem-4821",
    title: "Liberar retenção da transportadora para o lote Titan 160",
    description: "Evita a perda da coleta de hoje e mantém o pedido no SLA de despacho.",
    area: "Expedição",
    priority: "critica",
    dueLabel: "Atrasado há 15 min",
    dueAt: previewStartedAt - 15 * 60 * 1000,
    status: "ativo",
    recurrence: "Único",
    channels: ["Coletor", "Tela", "Som"],
    isOverdue: true,
  },
  {
    id: "rem-721",
    title: "Conferir lote de cabeçotes CB 300 antes da sangria de óleo",
    description: "Antecipar a conferência reduz retrabalho e evita contaminação da bancada 02.",
    area: "Desmontagem",
    priority: "alta",
    dueLabel: "Hoje às 16:00 · em 1h20",
    dueAt: previewStartedAt + 80 * 60 * 1000,
    status: "ativo",
    recurrence: "Diário",
    channels: ["Coletor", "Tela"],
  },
  {
    id: "rem-643",
    title: "Revisar calibração do torquímetro da bancada 02",
    description: "Registrar a revisão antes do próximo ciclo de montagem.",
    area: "Manutenção",
    priority: "media",
    dueLabel: "Hoje às 17:15",
    dueAt: previewStartedAt + 155 * 60 * 1000,
    status: "ativo",
    recurrence: "Semanal",
    channels: ["Tela"],
  },
  {
    id: "rem-405",
    title: "Retornar orçamento de amortecedores para a oficina MotoSul",
    description: "Confirmar disponibilidade e prazo do parceiro antes do atendimento.",
    area: "Balcão",
    priority: "alta",
    dueLabel: "Amanhã às 09:00",
    dueAt: previewStartedAt + 18 * 60 * 60 * 1000,
    status: "ativo",
    recurrence: "Único",
    channels: ["Tela"],
  },
  {
    id: "rem-087",
    title: "Backup do catálogo físico de sucata pesada",
    description: "Reunir laudos e registros da prateleira F-04 para a cópia semanal.",
    area: "Estoque",
    priority: "baixa",
    dueLabel: "Sexta às 18:00",
    dueAt: previewStartedAt + 48 * 60 * 60 * 1000,
    status: "ativo",
    recurrence: "Semanal",
    channels: ["Tela"],
  },
];

const filters: Array<{ id: ReminderFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "ativos", label: "Ativos" },
  { id: "atrasados", label: "Atrasados" },
  { id: "concluidos", label: "Concluídos" },
];

const alertPressure = [2, 3, 2, 4, 3, 5, 4].map((active, index) => {
  const date = new Date();
  date.setHours(date.getHours() - (6 - index));
  return { date, active };
});

function useClockNow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  return now;
}

function formatCountdown(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function PriorityCounter({ reminders, onOpen }: { reminders: Reminder[]; onOpen: (id: string) => void }) {
  const summary = getReminderPrioritySummary(reminders);
  const urgentReminder = getMostUrgentReminder(reminders);
  const now = useClockNow();
  const countdown = getReminderCountdown(urgentReminder, now);
  const counterRef = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!counterRef.current || reduceMotion) return;
    const animation = animate(counterRef.current, {
      opacity: [0.45, 1],
      scale: [0.9, 1],
      duration: 260,
      ease: "out(3)",
    });
    return () => {
      animation.pause();
    };
  }, [reduceMotion, summary.count, summary.priority]);

  const title = summary.priority
    ? `${summary.count} lembrete${summary.count === 1 ? "" : "s"} ${priorityLabel[summary.priority].toLocaleLowerCase("pt-BR")}`
    : "Sem lembretes ativos";

  const content = <>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-600"><ShieldAlert size={15} className={countdown.state === "atrasado" ? "text-rose-600" : "text-blue-600"} /> Prioridade máxima</span>
        <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]", countdown.state === "atrasado" ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700")}>{countdown.state === "atrasado" ? "Atrasado" : "Em contagem"}</span>
      </div>
      <div className="px-4 py-4">
        <p className="flex items-baseline gap-2 text-slate-900" aria-live="polite">
          <span ref={counterRef} className="text-2xl font-semibold tracking-[-0.04em]">{summary.count}</span>
          <span className="text-xs font-medium text-slate-600">{title}</span>
        </p>
        {urgentReminder ? <><p className="mt-4 truncate text-xs font-medium text-slate-500">{urgentReminder.title}</p><div className="mt-2 flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><TimerReset size={14} /> {countdown.state === "atrasado" ? "Tempo excedido" : "Restante"}</span><span className={cn("text-lg font-semibold tracking-[-0.03em]", countdown.state === "atrasado" ? "text-rose-700" : "text-slate-900")}>{formatCountdown(countdown.totalSeconds)}</span></div></> : <p className="mt-3 text-sm text-slate-500">Não há lembretes ativos neste turno.</p>}
      </div>
    </>;

  return urgentReminder ? <button type="button" onClick={() => onOpen(urgentReminder.id)} aria-label={`Abrir detalhes de ${urgentReminder.title}`} className={cn("w-full overflow-hidden rounded-xl border bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2", countdown.state === "atrasado" ? "border-rose-200" : "border-slate-200")}>{content}</button> : <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">{content}</section>;
}

function ReminderCard({
  reminder,
  onOpen,
  onComplete,
  onSnooze,
  isCelebratingCompletion,
}: {
  reminder: Reminder;
  onOpen: () => void;
  onComplete: () => void;
  onSnooze: () => void;
  isCelebratingCompletion: boolean;
}) {
  const isCompleted = reminder.status === "concluido";

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={isCelebratingCompletion ? { opacity: 1, y: 0, borderColor: ["#10b981", "#86efac", "#10b981", "#d1fae5"] } : { opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={isCelebratingCompletion ? { duration: 2.8, ease: "easeInOut" } : { type: "spring", stiffness: 360, damping: 30, bounce: 0 }}
      className={cn(
        "group rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)] sm:p-5",
        isCompleted ? "border-emerald-200 bg-emerald-50/30" : reminder.priority === "critica" ? "border-rose-200" : "border-slate-200"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded border px-2 py-1 text-[11px] font-semibold", priorityStyle[reminder.priority])}>
          {priorityLabel[reminder.priority]}
        </span>
        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
          {reminder.area}
        </span>
        <span className={cn("ml-auto inline-flex items-center gap-1 text-xs font-medium", reminder.isOverdue ? "text-rose-700" : isCompleted ? "text-emerald-700" : "text-slate-500")}>
          <Clock3 size={13} /> {reminder.dueLabel}
        </span>
      </div>

      <button type="button" onClick={onOpen} className="mt-3 block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        <h3 className="text-base font-semibold tracking-tight text-slate-900 group-hover:text-blue-700">
          {reminder.title}
        </h3>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-500">{reminder.description}</p>
      </button>

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <BellRing size={14} className="text-blue-600" /> {reminder.recurrence} · {reminder.channels.join(" · ")}
        </span>
        {isCompleted ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-800" aria-live="polite"><BadgeCheck size={15} /> Concluído</span> : <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="ghost" size="sm" onClick={onSnooze} className="h-11 w-full px-2.5 text-slate-500 shadow-none hover:bg-blue-50 hover:text-blue-700 sm:w-auto">
            <AlarmClock size={14} /> Adiar 30 min
          </Button>
          <Button size="sm" onClick={onComplete} className="h-11 w-full bg-blue-600 text-white shadow-[0_1px_2px_rgba(37,99,235,0.26)] hover:bg-blue-700 sm:w-auto">
            <Check size={14} /> Concluir
          </Button>
        </div>}
      </div>
    </motion.article>
  );
}

function ReminderDrawer({
  reminder,
  onClose,
  onComplete,
  onSnooze,
  onDelete,
}: {
  reminder: Reminder | null;
  onClose: () => void;
  onComplete: () => void;
  onSnooze: () => void;
  onDelete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const drawerRef = useRef<HTMLElement>(null);
  useOverlayInteraction(Boolean(reminder), drawerRef, onClose);

  return (
    <AnimatePresence>
      {reminder && (
        <>
          <motion.button
            type="button"
            aria-label="Fechar detalhes do lembrete"
            className="fixed inset-0 z-[170] bg-slate-950/15 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do lembrete"
            tabIndex={-1}
            ref={drawerRef}
            className="fixed inset-x-0 bottom-0 top-[max(1rem,env(safe-area-inset-top))] z-[180] flex w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-[#f8fafc] shadow-[0_-16px_60px_rgba(15,23,42,0.22)] sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:max-w-[620px] sm:rounded-none sm:border-y-0 sm:border-r-0 sm:border-l"
            initial={reduceMotion ? false : { opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: 28 }}
            transition={{ type: "spring", stiffness: 340, damping: 32, mass: 0.75 }}
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-7 sm:py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Detalhes do lembrete</p>
                <p className="mt-1 text-sm font-medium text-slate-600">{reminder.area} · regra operacional ativa</p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar detalhes">
                <X size={17} />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-7 sm:py-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded border px-2 py-1 text-[11px] font-semibold", priorityStyle[reminder.priority])}>{priorityLabel[reminder.priority]}</span>
                {reminder.isOverdue && <span className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">Atrasado</span>}
              </div>
              <h2 className="mt-4 text-3xl font-semibold leading-[1.12] tracking-[-0.045em] text-slate-900">{reminder.title}</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">{reminder.description}</p>

              <section className="mt-7 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-800"><Sparkles size={16} /> Por que este alerta existe</div>
                <p className="mt-2 text-sm leading-relaxed text-blue-900/75">Criado para proteger a próxima decisão operacional: agir antes do horário evita atraso, retrabalho ou perda de contexto na operação.</p>
              </section>

              <section className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Entrega e escalonamento</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Próximo disparo</p><p className="mt-1 text-sm font-semibold text-slate-900">{reminder.dueLabel}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Canais ativos</p><p className="mt-1 text-sm font-semibold text-slate-900">{reminder.channels.join(" · ")}</p></div>
                </div>
              </section>

              <section className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Contexto de execução</p>
                <div className="mt-3 space-y-2">
                  {["Confirmar contexto no setor responsável", "Executar a ação ou registrar o impedimento", "Concluir e deixar o histórico da decisão"].map((item, index) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{index + 1}</span>{item}</div>
                  ))}
                </div>
              </section>
            </div>
            <footer className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-4">
              <Button variant="ghost" onClick={onDelete} className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"><Trash2 size={15} /> Excluir</Button>
              {reminder.status === "ativo" ? <div className="flex flex-wrap items-center gap-2"><Button variant="ghost" onClick={onSnooze} className="text-slate-500 hover:bg-blue-50 hover:text-blue-700"><AlarmClock size={15} /> Adiar 30 min</Button><Button onClick={onComplete} className="bg-blue-600 text-white hover:bg-blue-700"><Check size={15} /> Marcar resolvido</Button></div> : <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><BadgeCheck size={16} /> Lembrete concluído</span>}
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

type PendingReminderAction = { kind: "adiar" | "excluir"; reminder: Reminder } | null;

function ReminderActionDialog({ action, onCancel, onConfirm }: { action: PendingReminderAction; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  useOverlayInteraction(Boolean(action), dialogRef, onCancel);

  const isDelete = action?.kind === "excluir";

  return <AnimatePresence>
    {action && <motion.div className="fixed inset-0 z-[220] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <motion.section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="reminder-action-title" tabIndex={-1} initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.985 }} transition={{ type: "spring", stiffness: 400, damping: 32 }} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.3)]">
        <div className="flex items-start gap-3"><span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", isDelete ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700")}>{isDelete ? <Trash2 size={18} /> : <AlarmClock size={18} />}</span><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{isDelete ? "Ação irreversível" : "Confirmar adiamento"}</p><h3 id="reminder-action-title" className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{isDelete ? "Excluir este lembrete?" : "Adiar por 30 minutos?"}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{isDelete ? `“${action.reminder.title}” será removido da prévia.` : `O próximo disparo de “${action.reminder.title}” passará para daqui a 30 minutos.`}</p></div></div>
        <div className="mt-6 flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button><Button type="button" onClick={onConfirm} className={isDelete ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-blue-600 text-white hover:bg-blue-700"}>{isDelete ? <><Trash2 size={15} /> Excluir lembrete</> : <><AlarmClock size={15} /> Confirmar adiamento</>}</Button></div>
      </motion.section>
    </motion.div>}
  </AnimatePresence>;
}

function ReminderComposer({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (reminder: Reminder) => void }) {
  const reduceMotion = useReducedMotion();
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ReminderPriority>("alta");
  const [recurrence, setRecurrence] = useState("Único");
  useOverlayInteraction(open, titleRef, onClose);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setPriority("alta");
    setRecurrence("Único");
  }, [open]);

  const create = () => {
    if (!title.trim()) return;
    onCreate({
      id: `rem-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || "Ação operacional criada para manter o ritmo do turno.",
      area: "Operação geral",
      priority,
      dueLabel: "Hoje · em 30 min",
      dueAt: Date.now() + 30 * 60 * 1000,
      status: "ativo",
      recurrence,
      channels: ["Tela"],
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[190] flex items-end bg-slate-950/35 backdrop-blur-sm sm:grid sm:place-items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
          <motion.form role="dialog" aria-modal="true" aria-labelledby="reminder-composer-title" onSubmit={(event) => { event.preventDefault(); create(); }} initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.985 }} transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.76 }} className="flex max-h-[calc(100dvh-1rem)] w-full max-w-[760px] flex-col overflow-hidden rounded-t-[20px] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.3)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[20px]">
            <header className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-6 sm:py-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)]"><BellRing size={18} /></span><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Novo lembrete</p><h2 id="reminder-composer-title" className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Proteger uma próxima decisão</h2><p className="mt-1 text-sm text-slate-500">Defina o contexto, a prioridade e a recorrência do alerta.</p></div></div><Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar criação de lembrete"><X size={17} /></Button></header>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
              <label className="block"><span className="text-sm font-semibold text-slate-700">Título operacional</span><input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: confirmar coleta antes da janela Sedex" className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3.5 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 sm:text-sm" /></label>
              <label className="block"><span className="text-sm font-semibold text-slate-700">Contexto que orienta a ação</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explique o risco ou a entrega que este lembrete protege." className="mt-2 min-h-24 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 sm:text-sm" /></label>
              <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm font-semibold text-blue-950">Próximo disparo</p><p className="mt-1 text-xs leading-relaxed text-blue-800/70">Este lembrete será criado para proteger a próxima meia hora operacional.</p></div><span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-[0_1px_2px_rgba(37,99,235,0.08)]"><Clock3 size={15} /> +30 min</span></div>
              <fieldset className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><legend className="px-1 text-sm font-semibold text-slate-700">Nível de prioridade</legend><p className="mt-1 text-xs leading-relaxed text-slate-500">A prioridade define a posição na fila e o destaque do próximo alerta.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{([{ id: "critica", note: "Interrompe o fluxo se não for tratada.", tone: "border-rose-200 bg-rose-50 text-rose-800" }, { id: "alta", note: "Protege uma decisão deste turno.", tone: "border-amber-200 bg-amber-50 text-amber-800" }, { id: "media", note: "Mantém a rotina no prazo.", tone: "border-blue-200 bg-blue-50 text-blue-800" }, { id: "baixa", note: "Acompanhamento sem urgência imediata.", tone: "border-slate-200 bg-white text-slate-700" }] as const).map((option) => <Button key={option.id} type="button" variant="ghost" onClick={() => setPriority(option.id)} className={cn("h-auto justify-start rounded-xl border p-3 text-left shadow-none hover:brightness-[0.98]", option.tone, priority === option.id && "ring-2 ring-blue-500 ring-offset-2")}><span className="size-2 rounded-full bg-current" /><span><span className="block text-sm font-semibold">{priorityLabel[option.id]}</span><span className="mt-0.5 block text-xs font-normal opacity-75">{option.note}</span></span></Button>)}</div></fieldset>
              <fieldset className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><legend className="px-1 text-sm font-semibold text-slate-700">Recorrência</legend><p className="mt-1 text-xs leading-relaxed text-slate-500">Defina se o alerta protege uma decisão única ou volta a aparecer no ciclo operacional.</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{([{ id: "Único", note: "Uma vez" }, { id: "Diário", note: "Todo turno" }, { id: "Semanal", note: "Toda semana" }] as const).map((option) => <Button key={option.id} type="button" variant="ghost" onClick={() => setRecurrence(option.id)} className={cn("h-auto flex-col items-start rounded-xl border border-slate-200 bg-white p-3 text-left text-slate-600 shadow-none hover:border-blue-200 hover:bg-blue-50", recurrence === option.id && "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:text-white")}><span className="text-sm font-semibold">{option.id}</span><span className="text-xs font-normal opacity-75">{option.note}</span></Button>)}</div></fieldset>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><BellRing size={15} className="text-emerald-600" /> Canais previstos</span><strong className="font-semibold text-slate-700">Tela · Coletor · Som crítico</strong></div>
            </div>
            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-4"><Button type="button" variant="ghost" onClick={onClose} className="h-11 w-full sm:w-auto">Cancelar</Button><Button type="submit" disabled={!title.trim()} className="h-11 w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"><Plus size={16} /> Criar lembrete</Button></footer>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function RemindersPanel({ reminders, onRemindersChange, onActiveCountChange, composerOpen, onComposerOpenChange }: { reminders: Reminder[]; onRemindersChange: (next: Reminder[] | ((current: Reminder[]) => Reminder[])) => void; onActiveCountChange: (count: number) => void; composerOpen: boolean; onComposerOpenChange: (open: boolean) => void }) {
  const [filter, setFilter] = useState<ReminderFilter>("todos");
  const [query, setQuery] = useState("");
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingReminderAction>(null);
  const [celebratingReminderId, setCelebratingReminderId] = useState<string | null>(null);
  const reminderFilterScrollRef = useRef<HTMLDivElement>(null);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const activeCount = reminders.filter((reminder) => reminder.status === "ativo").length;
  const selectedReminder = reminders.find((reminder) => reminder.id === selectedReminderId) ?? null;
  const visibleReminders = useMemo(() => filterReminders(reminders, filter, query), [filter, query, reminders]);
  const filterOverflow = useHorizontalOverflow(reminderFilterScrollRef);

  useEffect(() => onActiveCountChange(activeCount), [activeCount, onActiveCountChange]);

  useEffect(() => () => {
    if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
  }, []);

  const complete = (id: string) => {
    onRemindersChange((current) => current.map((reminder) => reminder.id === id ? { ...reminder, status: "concluido", dueLabel: "Concluído agora", isOverdue: false } : reminder));
    setCelebratingReminderId(id);
    if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
    celebrationTimeoutRef.current = window.setTimeout(() => setCelebratingReminderId(null), 2_800);
    setSelectedReminderId(null);
  };
  const confirmPendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "adiar") {
      onRemindersChange((current) => current.map((reminder) => reminder.id === pendingAction.reminder.id ? { ...reminder, dueLabel: "Adiado · em 30 min", dueAt: Date.now() + 30 * 60 * 1000, isOverdue: false } : reminder));
    } else {
      onRemindersChange((current) => current.filter((reminder) => reminder.id !== pendingAction.reminder.id));
      setSelectedReminderId(null);
    }
    setPendingAction(null);
  };
  const requestSnooze = (reminder: Reminder) => setPendingAction({ kind: "adiar", reminder });
  const requestDelete = (reminder: Reminder) => setPendingAction({ kind: "excluir", reminder });

  return (
    <section className="mt-6 font-[Geist,Inter,ui-sans-serif,system-ui]">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Controle operacional</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Lembretes que pedem ação</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Antecipe decisões, proteja prazos e mantenha alertas importantes no contexto do turno.</p></div>
              <Button onClick={() => onComposerOpenChange(true)} className="shrink-0 bg-blue-600 text-white hover:bg-blue-700"><Plus size={16} /> Novo lembrete</Button>
            </div>
            <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={filter} onValueChange={(value) => setFilter(value as ReminderFilter)}>
                <div className="relative max-w-full">
                  <div
                    ref={reminderFilterScrollRef}
                    className="no-scrollbar max-w-full overflow-x-auto overscroll-x-contain"
                    aria-label="Filtros de lembretes"
                  >
                    <TabsList className="max-w-none bg-slate-50">
                      {filters.map((item) => (
                        <TabsTrigger key={item.id} value={item.id} className="shrink-0 px-2 py-1.5 text-[11px] sm:px-2.5 sm:text-xs">
                          {item.label} <span className="ml-1 text-[10px] text-slate-400">{filterReminders(reminders, item.id, "").length}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  {filterOverflow.canScrollLeft && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-white via-white/90 to-transparent" />}
                  {filterOverflow.canScrollRight && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-white via-white/90 to-transparent" />}
                </div>
              </Tabs>
              <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 lg:max-w-xs"><Search size={16} className="text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar lembrete" className="min-w-0 flex-1 text-sm text-slate-800 outline-none placeholder:text-slate-400" /></label>
            </div>
          </div>

          <div className="mt-5 space-y-3"><AnimatePresence initial={false} mode="popLayout">{visibleReminders.map((reminder) => <ReminderCard key={reminder.id} reminder={reminder} onOpen={() => setSelectedReminderId(reminder.id)} onComplete={() => complete(reminder.id)} onSnooze={() => requestSnooze(reminder)} isCelebratingCompletion={celebratingReminderId === reminder.id} />)}</AnimatePresence>{!visibleReminders.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><FileClock className="mx-auto text-blue-500" size={28} /><h3 className="mt-3 text-base font-semibold text-slate-800">Nada pede atenção aqui</h3><p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou crie um lembrete para proteger a próxima decisão.</p><Button className="mt-5 bg-blue-600 text-white hover:bg-blue-700" onClick={() => onComposerOpenChange(true)}><Plus size={16} /> Criar lembrete</Button></div>}</div>
        </div>
        <aside className="space-y-5"><PriorityCounter reminders={reminders} onOpen={setSelectedReminderId} /><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Pressão de alertas</p><h3 className="mt-1 text-lg font-semibold text-slate-900">Janela do turno</h3></div>{reduceMotion ? <span className="mt-1 size-2 rounded-full bg-emerald-500" /> : <DotMatrix sequence={[[0, 1, 2, 4, 6, 8, 10, 12, 14], [1, 4, 7, 10, 13]]} rows={4} cols={4} dotSize={3} gap={2} interval={900} color="#2563eb" inactiveColor="rgba(37,99,235,.14)" />}</div><div className="mt-4 h-32"><AreaChart data={alertPressure} aspectRatio="auto" style={{ height: 128 }} animationDuration={reduceMotion ? 0 : 500}><Grid horizontal stroke="rgba(148,163,184,.2)" hideHorizontalEdgeLines /><Area dataKey="active" fill="#2563eb" fillOpacity={0.12} stroke="#2563eb" strokeWidth={2} fadeEdges /><XAxis numTicks={3} /></AreaChart></div><p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">A janela atual concentra {getReminderPrioritySummary(reminders).count} alerta(s) na maior prioridade ativa.</p></section><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Notificações</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><BellRing size={16} className="text-emerald-600" /> Canais sincronizados</p><p className="mt-2 text-sm leading-relaxed text-slate-500">Tela, coletor e alertas sonoros só são acionados quando o contexto exige resposta.</p></section></aside>
      </div>
      <ReminderDrawer reminder={selectedReminder} onClose={() => setSelectedReminderId(null)} onComplete={() => selectedReminder && complete(selectedReminder.id)} onSnooze={() => selectedReminder && requestSnooze(selectedReminder)} onDelete={() => selectedReminder && requestDelete(selectedReminder)} />
      <ReminderActionDialog action={pendingAction} onCancel={() => setPendingAction(null)} onConfirm={confirmPendingAction} />
      <ReminderComposer open={composerOpen} onClose={() => onComposerOpenChange(false)} onCreate={(reminder) => onRemindersChange((current) => [reminder, ...current])} />
    </section>
  );
}
