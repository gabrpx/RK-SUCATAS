import { animate, stagger } from "animejs";
import { DotMatrix } from "dot-anime-react";
import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Command,
  Filter,
  ListChecks,
  Plus,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart } from "@/src/components/charts/area-chart";
import { Grid } from "@/src/components/charts/grid";
import { ChartTooltip } from "@/src/components/charts/tooltip";
import { XAxis } from "@/src/components/charts/x-axis";
import { Button } from "@/src/components/animate-ui/components/buttons/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/src/components/animate-ui/components/tabs/tabs";
import { cn } from "@/src/utils";
import {
  createPreviewTask,
  filterPreviewTasks,
  filterPreviewTasksByPrimaryTab,
  getPreviewCategoryBreakdown,
  getNextPreviewTaskStatus,
  getPreviewTaskDeadline,
  getPreviewTaskExecutionSummary,
  getPreviewSummary,
  type PreviewTask,
  type PreviewTaskCategory,
  type PreviewTaskPriority,
  type PreviewTaskStatus,
} from "./taskPreviewModel";
import { TaskComposer, demoOperators } from "./TaskComposer";
import { initialReminders, RemindersPanel } from "./RemindersPanel";
import type { Reminder } from "./reminderModel";

type PreviewScreen = "turno" | "abertas";
type PreviewFilter = "todas" | PreviewTaskStatus;
type QueueFilter = "todas" | "abertas" | "pendencias" | "grupo";
type WorkspaceTab = "turno" | "lembretes";

const initialTasks: PreviewTask[] = [
  {
    id: "tk-760",
    title: "Conferir medidas do par de mesas ADV 160",
    area: "Estoque",
    category: "estoque",
    priority: "alta",
    status: "em-andamento",
    dueLabel: "Hoje às 15:40",
    estimateMinutes: 20,
    operatorIds: ["ryan", "kaua"],
    instructions:
      "Confirme encaixes, pontos de fixação e a condição do conjunto antes de atualizar o estoque.",
    checklist: [
      {
        id: "760-1",
        label: "Medir encaixes e pontos de fixação",
        completed: true,
        owner: "ryan",
        completedAt: "14:15",
      },
      {
        id: "760-2",
        label: "Comparar com o cadastro do lote",
        completed: true,
        owner: "kaua",
        completedAt: "14:28",
      },
      {
        id: "760-3",
        label: "Registrar condição no estoque",
        completed: false,
        owner: "ryan",
      },
    ],
  },
  {
    id: "tk-759",
    title: "Inventário rotativo e conferência de prateleiras",
    area: "Estoque",
    category: "estoque",
    priority: "normal",
    status: "aguardando",
    dueLabel: "Hoje às 18:00",
    estimateMinutes: 35,
    operatorIds: ["ayrton", "ryan"],
    instructions:
      "Auditoria cíclica de estoque e reconciliação dos registros físicos com a base de dados do sistema.",
    checklist: [
      {
        id: "759-1",
        label: "Contagem física do corredor B1 a B3",
        completed: true,
        owner: "ayrton",
        completedAt: "14:15",
      },
      {
        id: "759-2",
        label: "Bipagem de conferência no sistema coletor",
        completed: true,
        owner: "ryan",
        completedAt: "14:28",
      },
      {
        id: "759-3",
        label: "Conciliar divergência de itens com a supervisão",
        completed: false,
        owner: "ayrton",
      },
      {
        id: "759-4",
        label: "Fechar lote de auditoria no sistema",
        completed: false,
        owner: "ryan",
      },
    ],
  },
  {
    id: "tk-695",
    title: "Limpar bancada após desmontagem",
    area: "Limpeza",
    category: "limpeza",
    priority: "normal",
    status: "aguardando",
    dueLabel: "Hoje às 17:15",
    estimateMinutes: 25,
    operatorIds: ["pitoco"],
    instructions:
      "Recolha resíduos e confirme que nenhuma peça ou parafuso ficou sobre a bancada.",
    checklist: [
      {
        id: "695-1",
        label: "Recolher resíduos e parafusos",
        completed: true,
        owner: "pitoco",
        completedAt: "13:55",
      },
      {
        id: "695-2",
        label: "Higienizar a superfície da bancada",
        completed: false,
        owner: "pitoco",
      },
    ],
  },
  {
    id: "tk-544",
    title: "Separar peças reservadas para despacho",
    area: "Despacho",
    category: "despacho",
    priority: "alta",
    status: "aguardando",
    dueLabel: getPreviewTaskDeadline("despacho"),
    estimateMinutes: 25,
    operatorIds: ["ayrton", "kaua"],
    instructions:
      "Confira código, condição e destino das peças reservadas antes do limite do turno.",
    checklist: [
      {
        id: "544-1",
        label: "Localizar as peças reservadas",
        completed: false,
        owner: "ayrton",
      },
      {
        id: "544-2",
        label: "Conferir código e condição",
        completed: false,
        owner: "kaua",
      },
    ],
  },
  {
    id: "tk-682",
    title: "Catalogar roda dianteira ADV",
    area: "Estoque",
    category: "estoque",
    priority: "baixa",
    status: "concluida",
    dueLabel: "Concluída às 13:40",
    estimateMinutes: 15,
    operatorIds: ["eloisa"],
    instructions:
      "Registre fotos, descrição e localização antes de finalizar a catalogação.",
    checklist: [
      {
        id: "682-1",
        label: "Fotografar a peça",
        completed: true,
        owner: "eloisa",
        completedAt: "13:28",
      },
      {
        id: "682-2",
        label: "Salvar descrição e localização",
        completed: true,
        owner: "eloisa",
        completedAt: "13:40",
      },
    ],
  },
];

const flowData = [9, 12, 10, 14, 13, 17, 15].map((completed, index) => {
  const date = new Date();
  date.setDate(date.getDate() - (6 - index));
  return { date, completed };
});

const priorityStyle: Record<PreviewTaskPriority, string> = {
  critica: "border-rose-200 bg-rose-50 text-rose-700",
  alta: "border-amber-200 bg-amber-50 text-amber-800",
  normal: "border-blue-200 bg-blue-50 text-blue-700",
  baixa: "border-slate-200 bg-slate-50 text-slate-600",
};

const statusStyle: Record<PreviewTaskStatus, string> = {
  "em-andamento": "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  aguardando: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  concluida: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

const categoryLabel: Record<PreviewTaskCategory, string> = {
  despacho: "Despacho",
  organizacao: "Organização",
  limpeza: "Limpeza",
  estoque: "Estoque",
  outro: "Outro",
};

const categoryStyle: Record<PreviewTaskCategory, string> = {
  despacho: "border-violet-200 bg-violet-50 text-violet-700",
  organizacao: "border-blue-200 bg-blue-50 text-blue-700",
  limpeza: "border-emerald-200 bg-emerald-50 text-emerald-700",
  estoque: "border-amber-200 bg-amber-50 text-amber-800",
  outro: "border-slate-200 bg-slate-50 text-slate-700",
};

function progress(task: PreviewTask) {
  const total = task.checklist.length;
  const completed = task.checklist.filter((item) => item.completed).length;
  return {
    total,
    completed,
    percentage: total ? Math.round((completed / total) * 100) : 0,
  };
}

function SurfaceLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
      {children}
    </p>
  );
}

function EmployeeIcon({
  operatorId = "ryan",
  size = 16,
}: {
  operatorId?: string;
  size?: number;
}) {
  const operator =
    demoOperators.find((item) => item.id === operatorId) ?? demoOperators[0];
  return (
    <span
      title={operator.name}
      aria-label={operator.name}
      style={{ width: size + 8, height: size + 8 }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-mono font-bold ring-1",
        operator.tone,
        size <= 11 ? "text-[7px]" : "text-[9px]"
      )}
    >
      {operator.initials}
    </span>
  );
}

function EmployeeIdentity({
  operatorId,
  size = 12,
  className,
}: {
  operatorId?: string;
  size?: number;
  className?: string;
}) {
  const operator =
    demoOperators.find((item) => item.id === operatorId) ?? demoOperators[0];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-600",
        className
      )}
    >
      <EmployeeIcon operatorId={operator.id} size={size} />
      <span>{operator.name}</span>
    </span>
  );
}

function TurnMetricStrip({
  summary,
}: {
  summary: ReturnType<typeof getPreviewSummary>;
}) {
  const metrics = [
    {
      label: "Tarefas no turno",
      value: "18",
      suffix: "totais",
      detail: `${summary.open} abertas no seu circuito`,
      tone: "emerald",
    },
    {
      label: "Em andamento",
      value: `${summary.inProgress}`,
      suffix: "tarefa",
      detail: "em execução agora",
      tone: "amber",
    },
    {
      label: "Checklist",
      value: `${summary.completedChecklistItems}`,
      suffix: "concluídos",
      detail: `de ${summary.totalChecklistItems} etapas concluídas`,
      tone: "blue",
    },
    {
      label: "Ritmo de conclusão",
      value: "78%",
      suffix: "",
      detail: "andamento: 80%",
      tone: "blue",
    },
  ];

  return (
    <section aria-label="Resumo do turno" className="mt-6 overflow-x-auto">
      <div className="grid min-w-[920px] grid-cols-4 gap-3">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={cn(
              "min-h-[132px] rounded-lg border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
              metric.tone === "amber" && "border-amber-200",
              metric.tone === "emerald" && "border-slate-200",
              metric.tone === "blue" && "border-slate-200"
            )}
          >
            <div className="flex items-center justify-between">
              <SurfaceLabel>{metric.label}</SurfaceLabel>
              {index < 3 && (
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    metric.tone === "emerald" && "bg-emerald-500",
                    metric.tone === "amber" && "bg-amber-500",
                    metric.tone === "blue" && "bg-blue-500"
                  )}
                  aria-hidden="true"
                />
              )}
              {index === 3 && (
                <span className="font-mono text-[10px] font-semibold text-blue-700">
                  ANDAMENTO: 80%
                </span>
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-[28px] font-semibold leading-none tracking-[-0.05em] text-slate-900">
                {metric.value}
              </p>
              {metric.suffix && (
                <span className="font-mono text-[11px] text-slate-500">
                  {metric.suffix}
                </span>
              )}
            </div>
            {index === 3 ? (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[78%] rounded-full bg-blue-600" />
              </div>
            ) : (
              <p
                className={cn(
                  "mt-3 text-[11px] leading-snug",
                  metric.tone === "emerald" && "text-emerald-700",
                  metric.tone === "amber" && "text-amber-700",
                  metric.tone === "blue" && "text-slate-500"
                )}
              >
                <span
                  className={cn(
                    "mr-1 inline-block size-1.5 rounded-full",
                    metric.tone === "emerald" && "bg-emerald-500",
                    metric.tone === "amber" && "bg-amber-500",
                    metric.tone === "blue" && "bg-blue-500"
                  )}
                />
                {metric.detail}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  compact,
  onOpen,
  onToggleChecklist,
}: {
  task: PreviewTask;
  compact?: boolean;
  onOpen: () => void;
  onToggleChecklist: (taskId: string, checklistId: string) => void;
}) {
  const taskProgress = progress(task);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
            categoryStyle[task.category]
          )}
        >
          {categoryLabel[task.category]}
        </span>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
            priorityStyle[task.priority]
          )}
        >
          prioridade {task.priority}
        </span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
            statusStyle[task.status]
          )}
        >
          {task.status.replace("-", " ")}
        </span>
        <span className="ml-auto font-mono text-[10px] text-slate-400">
          {task.area}
        </span>
      </div>

      <button onClick={onOpen} className="mt-3 w-full text-left">
        <h3 className="text-base font-semibold tracking-tight text-slate-900 hover:text-blue-700">
          {task.title}
        </h3>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CalendarClock size={13} /> {task.dueLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 size={13} /> {task.estimateMinutes} min
          </span>
        </div>
      </button>

      {!compact && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">Checklist</span>
            <span className="font-mono text-slate-400">
              {taskProgress.completed} de {taskProgress.total}
            </span>
          </div>
          <div className="space-y-1.5">
            {task.checklist.slice(0, 3).map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => onToggleChecklist(task.id, item.id)}
                  className="mt-0.5 size-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span
                  className={cn(
                    "flex-1",
                    item.completed && "text-slate-400 line-through"
                  )}
                >
                  {item.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <EmployeeIdentity operatorId={item.owner} size={10} />
                  <span className="font-mono text-[10px] text-slate-400">
                    {item.completedAt ?? ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function SearchDialog({
  tasks,
  open,
  onClose,
  onOpenTask,
}: {
  tasks: PreviewTask[];
  open: boolean;
  onClose: () => void;
  onOpenTask: (task: PreviewTask) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(
    () => filterPreviewTasks(tasks, { query, status: "todas" }),
    [query, tasks]
  );

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pesquisa global"
      className="fixed inset-0 z-[200] flex items-start justify-center bg-slate-950/30 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search size={19} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar tarefa, peça ou código"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            ESC
          </kbd>
          <button
            aria-label="Fechar busca"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
          >
            <X size={17} />
          </button>
        </div>
        <div className="max-h-[58vh] overflow-y-auto p-2">
          <div className="px-2 py-2">
            <SurfaceLabel>Resultados em tarefas</SurfaceLabel>
          </div>
          {results.length ? (
            results.map((task) => (
              <button
                key={task.id}
                onClick={() => onOpenTask(task)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-blue-50"
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    task.status === "em-andamento"
                      ? "bg-emerald-500"
                      : "bg-amber-400"
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {task.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {task.area} · {task.dueLabel}
                  </span>
                </span>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            ))
          ) : (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              Nenhuma tarefa encontrada.
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2.5 font-mono text-[10px] text-slate-400">
          <span>↵ abrir</span>
          <span>esc fechar</span>
          <span className="ml-auto">RK Sucatas · Prévia</span>
        </div>
      </div>
    </div>
  );
}

function TaskInspector({
  task,
  onClose,
  onToggleChecklist,
  onAdvanceStatus,
}: {
  task: PreviewTask | null;
  onClose: () => void;
  onToggleChecklist: (taskId: string, checklistId: string) => void;
  onAdvanceStatus: (taskId: string) => void;
}) {
  if (!task) return null;
  const taskProgress = progress(task);
  const execution = getPreviewTaskExecutionSummary(task);
  const elapsedMinutes = Math.min(
    task.estimateMinutes,
    Math.max(
      10,
      Math.round(task.estimateMinutes * (taskProgress.percentage / 100))
    )
  );

  return (
    <motion.aside
      aria-label="Detalhes da tarefa"
      className="fixed inset-y-0 right-0 z-[180] flex w-full max-w-[760px] flex-col border-l border-slate-200 bg-[#f8fafc] shadow-[-24px_0_70px_rgba(15,23,42,0.16)]"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 32, mass: 0.75 }}
    >
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5 sm:px-7">
        <div>
          <SurfaceLabel>Execução da tarefa</SurfaceLabel>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            {task.id.toUpperCase()} ·{" "}
            {execution.isCollaborative
              ? "EXECUÇÃO COLETIVA"
              : "EXECUÇÃO INDIVIDUAL"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Pausar
          </button>
          <button
            type="button"
            className="rounded border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Editar
          </button>
          <button
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="rounded border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
          >
            <X size={16} />
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7 sm:py-8">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
          Tarefas &gt; {task.area} &gt; execução
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
              categoryStyle[task.category]
            )}
          >
            {categoryLabel[task.category]}
          </span>
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
              priorityStyle[task.priority]
            )}
          >
            prioridade {task.priority}
          </span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
              statusStyle[task.status]
            )}
          >
            {task.status.replace("-", " ")}
          </span>
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-slate-500">
            setor: {task.area}
          </span>
        </div>
        <h2 className="mt-4 max-w-[650px] text-[28px] font-semibold leading-[1.12] tracking-[-0.04em] text-slate-900 sm:text-[34px]">
          {task.title}
        </h2>
        <p className="mt-3 text-sm text-slate-500">
          Prazo: {task.dueLabel.replace("Hoje às ", "")}{" "}
          <span className="px-1 text-slate-300">•</span> setor responsável:{" "}
          {task.area}
        </p>

        <section className="mt-7">
          <SurfaceLabel>Métricas de execução</SurfaceLabel>
          <div className="mt-3 grid overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-4 sm:divide-x sm:divide-slate-200">
            {[
              [
                "Prazo",
                task.dueLabel.replace("Hoje às ", ""),
                "Prazo operacional",
              ],
              [
                "Tempo decorrido",
                `${execution.percentage}%`,
                `${elapsedMinutes} / ${task.estimateMinutes} min`,
              ],
              ["Setor", task.area, "Responsável pela execução"],
              [
                "Responsáveis",
                `${execution.responsibleCount} pessoa(s)`,
                execution.isCollaborative
                  ? "Execução coletiva"
                  : "Execução individual",
              ],
            ].map(([label, value, detail]) => (
              <div key={label} className="min-h-[98px] bg-white p-3.5">
                <SurfaceLabel>{label}</SurfaceLabel>
                <p className="mt-1.5 text-sm font-semibold tracking-tight text-slate-900">
                  {value}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">
                  {detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7 border-t border-slate-200 pt-5">
          <SurfaceLabel>Instruções da tarefa</SurfaceLabel>
          <p className="mt-2 max-w-[620px] text-sm leading-relaxed text-slate-600">
            {task.instructions ||
              "Siga a sequência abaixo e confira cada peça antes de mover o conjunto para o próximo setor."}
          </p>
        </section>

        <section className="mt-7">
          <div className="flex items-end justify-between border-b border-slate-200 pb-3">
            <div>
              <SurfaceLabel>Checklist de execução</SurfaceLabel>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                Progresso: {taskProgress.completed} de {taskProgress.total} (
                {taskProgress.percentage}%)
              </h3>
            </div>
            <ListChecks size={18} className="text-blue-600" />
          </div>
          <div className="divide-y divide-slate-200 border-b border-slate-200">
            {task.checklist.map((item, index) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-3 py-3.5"
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => onToggleChecklist(task.id, item.id)}
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-mono text-[10px] text-slate-400">
                  0{index + 1}
                </span>
                <span
                  className={cn(
                    "flex-1 text-sm",
                    item.completed
                      ? "text-slate-400 line-through"
                      : "font-medium text-slate-700"
                  )}
                >
                  {item.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <EmployeeIdentity operatorId={item.owner} size={10} />
                  <span className="font-mono text-[10px] text-slate-400">
                    {item.completedAt ?? ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="mt-7 border-t border-slate-200 pt-5">
          <SurfaceLabel>Histórico operacional</SurfaceLabel>
          <div className="mt-3 space-y-3 border-l border-slate-200 pl-4">
            {task.checklist
              .filter((item) => item.completedAt)
              .map((item) => (
                <p
                  key={item.id}
                  className="relative flex items-center gap-2 text-xs leading-relaxed text-slate-600"
                >
                  <span className="absolute -left-[21px] size-2 rounded-full bg-emerald-500 ring-4 ring-[#f8fafc]" />
                  <span className="font-mono text-[10px] text-emerald-700">
                    {item.completedAt}
                  </span>
                  <EmployeeIdentity operatorId={item.owner} size={10} />{" "}
                  confirmou: {item.label}
                </p>
              ))}
            {!task.checklist.some((item) => item.completedAt) && (
              <p className="text-xs text-slate-500">
                Ainda não há confirmações.
              </p>
            )}
          </div>
        </section>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3.5 sm:px-7">
        <div className="min-w-0">
          <SurfaceLabel>Próxima ação</SurfaceLabel>
          <p className="mt-1 text-xs text-slate-600">
            {execution.isCollaborative
              ? `${execution.responsibleCount} responsáveis acompanham esta execução.`
              : "A execução está atribuída a uma pessoa."}
          </p>
        </div>
        <Button
          onClick={() => onAdvanceStatus(task.id)}
          className="rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          <Check size={15} /> {execution.primaryAction}
        </Button>
      </footer>
    </motion.aside>
  );
}

function QueueTaskRows({
  tasks,
  onOpen,
  onToggleChecklist,
}: {
  tasks: PreviewTask[];
  onOpen: (task: PreviewTask) => void;
  onToggleChecklist: (taskId: string, checklistId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <article
          key={task.id}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)] sm:p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                categoryStyle[task.category]
              )}
            >
              {categoryLabel[task.category]}
            </span>
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                priorityStyle[task.priority]
              )}
            >
              Prioridade {task.priority}
            </span>
            {task.operatorIds && task.operatorIds.length > 1 && (
              <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-blue-700">
                Em grupo
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-slate-500">
              <Clock3 size={12} className="text-slate-400" /> {task.dueLabel}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold tracking-tight text-slate-900">
                {task.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                {task.instructions}
              </p>
            </div>
            {(task.operatorIds?.length ?? 0) > 1 ? (
              <div
                className="flex -space-x-1.5 pt-0.5"
                aria-label="Responsáveis pela tarefa"
              >
                {(task.operatorIds ?? []).map((operatorId) => (
                  <span
                    key={operatorId}
                    className="rounded-full border-2 border-white bg-white"
                  >
                    <EmployeeIcon operatorId={operatorId} size={10} />
                  </span>
                ))}
              </div>
            ) : (
              <EmployeeIdentity
                operatorId={task.operatorIds?.[0]}
                className="pt-0.5 text-[11px]"
              />
            )}
          </div>

          {(task.operatorIds?.length ?? 0) > 1 ? (
            <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="font-medium text-slate-600">
                  Progresso do checklist
                </span>
                <span className="font-mono text-slate-500">
                  {progress(task).completed} de {progress(task).total}{" "}
                  concluídas
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
                  style={{ width: `${progress(task).percentage}%` }}
                />
              </div>
              <div className="mt-3 space-y-1.5">
                {task.checklist.slice(0, 3).map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-100 bg-white px-2.5 py-2 transition-colors hover:border-blue-100 hover:bg-blue-50/40"
                  >
                    <input type="checkbox" checked={item.completed} onChange={() => onToggleChecklist(task.id, item.id)} className="size-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[11px] text-slate-600",
                        item.completed && "text-slate-400 line-through"
                      )}
                    >
                      {item.label}
                    </span>
                    <EmployeeIcon operatorId={item.owner} size={8} />
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        item.completed ? "text-emerald-700" : "text-slate-500"
                      )}
                    >
                      {item.completed ? "Concluída" : "Pendente"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs font-medium text-slate-500">
              {task.status === "em-andamento"
                ? "Em andamento"
                : task.status === "concluida"
                ? "Concluída"
                : "Pendente"}
              <span className="px-1.5 text-slate-300">•</span>
              Atribuída a{" "}
              {demoOperators.find(
                (operator) => operator.id === task.operatorIds?.[0]
              )?.name ?? "Operador"}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="font-mono text-[10px] text-slate-400">
              {(task.operatorIds?.length ?? 0) > 1
                ? `Checklist: ${progress(task).total} subtarefas`
                : `${task.estimateMinutes} min previstos`}
            </span>
            <button
              onClick={() => onOpen(task)}
              className={cn(
                "inline-flex min-h-7 items-center justify-center rounded px-2.5 text-[11px] font-semibold transition active:translate-y-px",
                task.status === "em-andamento"
                  ? "bg-blue-600 text-white shadow-[0_1px_2px_rgba(37,99,235,0.3)] hover:bg-blue-700"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              {task.status === "em-andamento" ? "Foco" : "Abrir"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

const routineBarStyle: Record<PreviewTaskCategory, string> = {
  organizacao: "bg-blue-600",
  estoque: "bg-violet-600",
  limpeza: "bg-emerald-600",
  despacho: "bg-amber-500",
  outro: "bg-slate-500",
};

function TeamActivityCard({ tasks }: { tasks: PreviewTask[] }) {
  const activities = tasks
    .flatMap((task) =>
      task.checklist
        .filter((item) => item.completedAt)
        .map((item) => ({ ...item, taskTitle: task.title }))
    )
    .slice(0, 4);

  return (
    <section
      data-preview-reveal
      className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <SurfaceLabel>Tempo real</SurfaceLabel>
          <h2 className="mt-1 text-lg font-semibold">
            Atividades recentes da equipe
          </h2>
        </div>
        <span
          className="mt-1 size-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50"
          aria-label="Atividade sincronizada"
        />
      </div>
      <div className="mt-5 space-y-4 border-l border-slate-200 pl-4">
        {activities.map((item) => (
          <div key={item.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 size-2 rounded-full border-2 border-white bg-emerald-500" />
            <p className="font-mono text-[10px] text-slate-400">
              {item.completedAt}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              <EmployeeIdentity operatorId={item.owner} size={10} />{" "}
              <span className="ml-1">concluiu “{item.label}”</span>
            </p>
            <p className="mt-1 truncate text-[10px] text-slate-400">
              {item.taskTitle}
            </p>
          </div>
        ))}
        {!activities.length && (
          <p className="text-xs text-slate-500">
            Nenhuma atividade registrada ainda.
          </p>
        )}
      </div>
    </section>
  );
}

function RoutineProgressCard({ tasks }: { tasks: PreviewTask[] }) {
  const routines = getPreviewCategoryBreakdown(tasks).filter((routine) => routine.total > 0);
  const leadingRoutine = routines.reduce(
    (leading, routine) => (routine.total > leading.total ? routine : leading),
    routines[0]
  );

  return (
    <section
      data-preview-reveal
      className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <SurfaceLabel>Status por categoria</SurfaceLabel>
          <h2 className="mt-1 text-lg font-semibold">
            Progresso das rotinas do galpão
          </h2>
        </div>
        <ListChecks size={18} className="text-blue-600" />
      </div>
      <div className="mt-5 space-y-4">
        <AnimatePresence initial={false} mode="popLayout">
        {routines.map((routine) => (
          <motion.div key={routine.category} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ type: "spring", stiffness: 360, damping: 30, bounce: 0 }}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-slate-700">
                {categoryLabel[routine.category]}
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {routine.total} {routine.total === 1 ? "tarefa" : "tarefas"} ·{" "}
                {routine.completionRate}% concluído
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  routineBarStyle[routine.category]
                )}
                style={{
                  width: `${Math.max(
                    routine.completionRate,
                    routine.total ? 10 : 0
                  )}%`,
                }}
              />
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
      </div>
      {leadingRoutine && <div className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500">
        Maior volume:{" "}
        <strong className="text-slate-800">
          {categoryLabel[leadingRoutine.category]}
        </strong>{" "}
        <span className="font-mono text-slate-400">
          ({leadingRoutine.total} tarefas)
        </span>
      </div>}
    </section>
  );
}

type PrimaryTaskTab = "turno" | "abertas" | "pendencias" | "concluidas";

function PrimaryTaskTabs({
  value,
  onValueChange,
  counts,
}: {
  value: PrimaryTaskTab;
  onValueChange: (value: PrimaryTaskTab) => void;
  counts: { open: number; pending: number; completed: number };
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue as PrimaryTaskTab)}
      className="w-fit max-w-full"
    >
      <TabsList className="max-w-full overflow-x-auto bg-slate-50">
        <TabsTrigger value="turno">
          Meu turno{" "}
          <span className="ml-1 font-mono text-[10px]">{counts.open}</span>
        </TabsTrigger>
        <TabsTrigger value="abertas">
          Tarefas abertas{" "}
          <span className="ml-1 font-mono text-[10px]">{counts.open}</span>
        </TabsTrigger>
        <TabsTrigger value="pendencias">
          Pendências{" "}
          <span className="ml-1 font-mono text-[10px]">{counts.pending}</span>
        </TabsTrigger>
        <TabsTrigger value="concluidas">
          Concluídas{" "}
          <span className="ml-1 font-mono text-[10px]">{counts.completed}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function OpenScreenInsights({ tasks }: { tasks: PreviewTask[] }) {
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-2">
      <TeamActivityCard tasks={tasks} />
      <RoutineProgressCard tasks={tasks} />
    </div>
  );
}

function TaskBoard({
  tasks,
  onOpen,
  onToggleChecklist,
}: {
  tasks: PreviewTask[];
  onOpen: (task: PreviewTask) => void;
  onToggleChecklist: (taskId: string, checklistId: string) => void;
}) {
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_340px]">
      <section data-preview-reveal className="grid gap-4 md:grid-cols-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={() => onOpen(task)}
            onToggleChecklist={onToggleChecklist}
          />
        ))}
        {!tasks.length && (
          <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
            <CheckCircle2 className="mx-auto text-emerald-500" />
            <p className="mt-3 font-medium text-slate-700">
              Nenhuma tarefa nessa seleção.
            </p>
          </div>
        )}
      </section>
      <aside className="space-y-5">
        <TeamActivityCard tasks={tasks} />
        <RoutineProgressCard tasks={tasks} />
      </aside>
    </div>
  );
}

export function TasksPreview() {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("turno");
  const [activeReminderCount, setActiveReminderCount] = useState(5);
  const [reminderComposerOpen, setReminderComposerOpen] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const [screen, setScreen] = useState<PreviewScreen>("turno");
  const [tasks, setTasks] = useState<PreviewTask[]>(initialTasks);
  const [filter, setFilter] = useState<PreviewFilter>("todas");
  const [activePrimaryTab, setActivePrimaryTab] =
    useState<PrimaryTaskTab>("turno");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PreviewTask | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("todas");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || !rootRef.current) return;
    const animation = animate(
      rootRef.current.querySelectorAll("[data-preview-reveal]"),
      {
        opacity: [0, 1],
        translateY: [10, 0],
        delay: stagger(45),
        duration: 460,
        ease: "out(3)",
      }
    );
    return () => {
      animation.pause();
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.altKey && event.code === "Space") {
        event.preventDefault();
        const task =
          tasks.find((item) => item.status === "em-andamento") ?? tasks[0];
        if (task) setSelectedTask(task);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tasks]);

  const summary = useMemo(() => getPreviewSummary(tasks), [tasks]);
  const visibleTasks = useMemo(
    () => filterPreviewTasksByPrimaryTab(tasks, activePrimaryTab),
    [tasks, activePrimaryTab]
  );
  const queueTasks = useMemo(() => {
    if (queueFilter === "abertas") {
      return tasks.filter((task) => task.status !== "concluida");
    }
    if (queueFilter === "pendencias") {
      return tasks.filter((task) => task.status === "aguardando");
    }
    if (queueFilter === "grupo") {
      return tasks.filter((task) => (task.operatorIds?.length ?? 0) > 1);
    }
    return tasks;
  }, [queueFilter, tasks]);
  const focusTask =
    tasks.find((task) => task.status === "em-andamento") ?? tasks[0];
  const setPrimaryTab = (value: PrimaryTaskTab) => {
    setActivePrimaryTab(value);
    setScreen("turno");
    setFilter("todas");
  };
  const toggleChecklist = (taskId: string, checklistId: string) =>
    setTasks((current) =>
      current.map((task) =>
        task.id !== taskId
          ? task
          : {
              ...task,
              checklist: task.checklist.map((item) =>
                item.id === checklistId
                  ? {
                      ...item,
                      completed: !item.completed,
                      completedAt: !item.completed ? "agora" : undefined,
                    }
                  : item
              ),
            }
      )
    );

  const advanceTaskStatus = (taskId: string) =>
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, status: getNextPreviewTaskStatus(task.status) }
          : task
      )
    );

  const openTask = (task: PreviewTask) => {
    setSearchOpen(false);
    setSelectedTask(task);
  };

  const createTask = (input: {
    title: string;
    category: PreviewTaskCategory;
    priority: PreviewTaskPriority;
    operatorIds: string[];
    instructions: string;
    checklistLabels: string[];
    checklistOwners: string[];
    dueTime: string;
  }) => {
    const task = createPreviewTask({ id: `tk-${Date.now()}`, ...input });
    setTasks((current) => [task, ...current]);
    setIsComposerOpen(false);
    setActivePrimaryTab("abertas");
    setScreen("turno");
  };

  return (
    <div
      ref={rootRef}
      className="min-h-screen bg-[#f8fafc] font-[Geist,Inter,ui-sans-serif,system-ui] text-slate-900"
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-7 place-items-center rounded bg-blue-600 text-[10px] font-black text-white">
              RK
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                RK Sucatas
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400">
                Torre de operações · prévia
              </p>
            </div>
          </div>
          <div className="ml-auto hidden items-center gap-5 text-xs text-slate-500 lg:flex">
            <span>Turno ativo · 08:00–17:00</span>
            <span className="inline-flex items-center gap-2">
              {prefersReducedMotion ? (
                <span className="size-2 rounded-full bg-emerald-600" />
              ) : (
                <DotMatrix
                  sequence={[
                    [0, 1, 3, 4, 6, 7, 9, 10, 12, 13, 15],
                    [1, 4, 7, 10, 13],
                  ]}
                  rows={4}
                  cols={4}
                  dotSize={3}
                  gap={2}
                  interval={900}
                  color="#059669"
                  inactiveColor="rgba(5,150,105,.16)"
                />
              )}
              Sincronizado
            </span>
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            className="ml-auto flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:border-blue-300 hover:bg-blue-50 sm:ml-0"
          >
            <Search size={15} />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden rounded border border-slate-200 px-1 font-mono text-[10px] text-slate-400 sm:inline">
              ⌘K
            </kbd>
          </button>
          <Button
            variant="default"
            size="sm"
            onClick={() => workspaceTab === "lembretes" ? setReminderComposerOpen(true) : setIsComposerOpen(true)}
            className="rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus size={15} />{" "}
            <span className="hidden sm:inline">{workspaceTab === "lembretes" ? "Novo lembrete" : "Nova tarefa"}</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:py-10">
        <style>{'[aria-label="Alternar tela"] { display: none; }'}</style>
        <div
          data-preview-reveal
          className="flex flex-col gap-5 border-b border-slate-200 pb-0 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="pb-5">
            <SurfaceLabel>
              Operação do galpão · estoque, organização, limpeza e despacho
            </SurfaceLabel>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-4xl">
              {workspaceTab === "turno"
                ? "Painel de operações do turno"
                : "Central de lembretes e alertas"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Uma prévia interativa separada da tela atual de tarefas.
            </p>
          </div>
          <div className="flex w-full justify-end pb-5 lg:w-auto">
            <Tabs
              value={workspaceTab}
              onValueChange={(value) => setWorkspaceTab(value as WorkspaceTab)}
            >
              <TabsList className="bg-slate-50">
                <TabsTrigger value="turno" className="text-sm">
                  Meu turno <span className="ml-1 text-[11px] text-slate-400">{summary.open}</span>
                </TabsTrigger>
                <TabsTrigger value="lembretes" className="text-sm">
                  Lembretes <span className="ml-1 text-[11px] text-slate-400">{activeReminderCount}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <nav
            aria-label="Alternar tela"
            className="flex max-w-full overflow-x-auto"
          >
            <button
              onClick={() => {
                setScreen("turno");
                setFilter("todas");
              }}
              className={cn(
                "shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                screen === "turno"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              Meu turno{" "}
              <span
                className={cn(
                  "ml-1 font-mono text-[10px]",
                  screen === "turno" ? "text-blue-600" : "text-slate-400"
                )}
              >
                {summary.open}
              </span>
            </button>
            <button
              onClick={() => {
                setScreen("abertas");
                setFilter("todas");
              }}
              className={cn(
                "shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                screen === "abertas" && filter === "todas"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              Tarefas abertas{" "}
              <span className="ml-1 font-mono text-[10px] text-slate-400">
                {summary.open}
              </span>
            </button>
            <button
              onClick={() => {
                setScreen("abertas");
                setFilter("aguardando");
              }}
              className={cn(
                "shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                screen === "abertas" && filter === "aguardando"
                  ? "border-amber-500 text-amber-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              Pendências{" "}
              <span className="ml-1 font-mono text-[10px] text-slate-400">
                {tasks.filter((task) => task.status === "aguardando").length}
              </span>
            </button>
            <button
              onClick={() => {
                setScreen("abertas");
                setFilter("concluida");
              }}
              className={cn(
                "shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                screen === "abertas" && filter === "concluida"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              Concluídas{" "}
              <span className="ml-1 font-mono text-[10px] text-slate-400">
                {tasks.filter((task) => task.status === "concluida").length}
              </span>
            </button>
          </nav>
        </div>

        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={workspaceTab}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -5 }}
            transition={{ type: "spring", stiffness: 340, damping: 31, bounce: 0 }}
          >
        {workspaceTab === "lembretes" ? (
          <RemindersPanel reminders={reminders} onRemindersChange={setReminders} onActiveCountChange={setActiveReminderCount} composerOpen={reminderComposerOpen} onComposerOpenChange={setReminderComposerOpen} />
        ) : (
          <>
        {screen === "abertas" && <OpenScreenInsights tasks={tasks} />}

        {screen === "turno" ? (
          <>
            <div data-preview-reveal>
              <TurnMetricStrip summary={summary} />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_360px]">
              <section className="space-y-6">
                <div data-preview-reveal className="hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-blue-700">
                        Recomendação de trabalho
                      </span>
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                          categoryStyle[focusTask.category]
                        )}
                      >
                        {categoryLabel[focusTask.category]}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      ID: {focusTask.id.toUpperCase()}
                    </span>
                  </div>
                  <div className="p-5 sm:p-6">
                    <h2 className="max-w-2xl text-[25px] font-semibold leading-tight tracking-[-0.04em] text-slate-900 sm:text-[30px]">
                      {focusTask.title}
                    </h2>
                    <p className="mt-2 text-sm text-amber-700">
                      {focusTask.area}{" "}
                      <span className="px-1 text-amber-300">•</span> prazo:{" "}
                      {focusTask.dueLabel.replace("Hoje às ", "")}
                    </p>
                    <div className="mt-5 grid gap-2 sm:grid-cols-4">
                      {[
                        ["Situação", "Em andamento", "text-emerald-700"],
                        [
                          "Tempo previsto",
                          `${focusTask.estimateMinutes} min`,
                          "text-blue-700",
                        ],
                        [
                          "Prazo",
                          focusTask.dueLabel.replace("Hoje às ", ""),
                          "text-amber-700",
                        ],
                        [
                          "Responsáveis",
                          `${focusTask.operatorIds?.length ?? 1} conta(s)`,
                          "text-violet-700",
                        ],
                      ].map(([label, value, color]) => (
                        <div
                          key={label}
                          className="rounded border border-slate-100 bg-slate-50 px-3 py-3"
                        >
                          <SurfaceLabel>{label}</SurfaceLabel>
                          <p
                            className={cn("mt-1 text-xs font-semibold", color)}
                          >
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {(focusTask.operatorIds ?? ["ryan"]).map(
                          (operatorId) => (
                            <EmployeeIdentity
                              key={operatorId}
                              operatorId={operatorId}
                            />
                          )
                        )}
                      </div>
                      <Button
                        onClick={() => setSelectedTask(focusTask)}
                        className="rounded bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Activity size={15} /> Abrir tarefa{" "}
                        <kbd className="ml-1 rounded border border-white/25 px-1 font-mono text-[10px]">
                          ⌥Space
                        </kbd>
                      </Button>
                    </div>
                  </div>
                </div>
                <div
                  data-preview-reveal
                  className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
                >
                  <Tabs
                    value={queueFilter}
                    onValueChange={(value) =>
                      setQueueFilter(value as QueueFilter)
                    }
                  >
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <SurfaceLabel>Sequência recomendada</SurfaceLabel>
                        <h2 className="mt-1 text-xl font-semibold tracking-tight">
                          Fila prioritária de trabalho
                        </h2>
                      </div>
                      <TabsList>
                        {(
                          [
                            ["todas", `Todas (${tasks.length})`],
                            ["abertas", `Abertas (${summary.open})`],
                            [
                              "pendencias",
                              `Pendências (${
                                tasks.filter(
                                  (task) => task.status === "aguardando"
                                ).length
                              })`,
                            ],
                            [
                              "grupo",
                              `Tarefas em grupo (${
                                tasks.filter(
                                  (task) => (task.operatorIds?.length ?? 0) > 1
                                ).length
                              })`,
                            ],
                          ] as const
                        ).map(([id, label]) => (
                          <TabsTrigger key={id} value={id}>
                            {label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                    <div className="mt-4">
                      <AnimatePresence initial={false} mode="wait">
                        <motion.div
                          key={queueFilter}
                          role="tabpanel"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{
                            type: "spring",
                            stiffness: 340,
                            damping: 30,
                            bounce: 0,
                          }}
                        >
                          <QueueTaskRows
                            tasks={queueTasks}
                            onOpen={setSelectedTask}
                            onToggleChecklist={toggleChecklist}
                          />
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </Tabs>
                </div>
              </section>
              <aside className="space-y-6">
                <RoutineProgressCard tasks={tasks} />
                <TeamActivityCard tasks={tasks} />
                <div data-preview-reveal className="hidden">
                  <div className="flex items-start justify-between">
                    <div>
                      <SurfaceLabel>Ritmo de tarefas</SurfaceLabel>
                      <h2 className="mt-1 text-lg font-semibold">
                        Concluídas no turno
                      </h2>
                    </div>
                    <ArrowUpRight size={18} className="text-emerald-600" />
                  </div>
                  <div className="mt-4 h-48">
                    <AreaChart
                      data={flowData}
                      aspectRatio="auto"
                      style={{ height: 192 }}
                    >
                      <Grid horizontal stroke="rgba(148,163,184,.25)" />
                      <Area
                        dataKey="completed"
                        fill="#2563eb"
                        fillOpacity={0.13}
                        stroke="#2563eb"
                        strokeWidth={2}
                        fadeEdges
                      />
                      <XAxis numTicks={3} />
                      <ChartTooltip
                        showDatePill={false}
                        rows={(point) => [
                          {
                            label: "Concluídas",
                            value: `${point.completed ?? 0}`,
                            color: "#2563eb",
                          },
                        ]}
                      />
                    </AreaChart>
                  </div>
                  <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                    Comparado ao previsto:{" "}
                    <strong className="font-mono text-emerald-700">
                      +18,2%
                    </strong>
                  </p>
                </div>
                <div data-preview-reveal className="hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <SurfaceLabel>Equipe no turno</SurfaceLabel>
                      <h2 className="mt-1 text-lg font-semibold">
                        5 contas demonstrativas
                      </h2>
                    </div>
                    <UsersRound size={18} className="text-blue-600" />
                  </div>
                  <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex flex-wrap justify-between gap-2">
                      {demoOperators.map((operator) => (
                        <EmployeeIdentity
                          key={operator.id}
                          operatorId={operator.id}
                          size={10}
                        />
                      ))}
                      <span className="font-mono text-[11px] text-emerald-700">
                        ATIVAS
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                      <div className="h-full w-[82%] rounded-full bg-blue-600" />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Acompanhamento de tarefas do turno
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </>
        ) : (
          <>
            <section
              data-preview-reveal
              className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]"
            >
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <Search size={16} className="text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filtrar tarefas abertas"
                  className="min-w-0 flex-1 text-sm outline-none placeholder:text-slate-400"
                />
              </label>
              <div className="flex overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
                {(
                  [
                    ["todas", "Todas"],
                    ["em-andamento", "Em andamento"],
                    ["aguardando", "Aguardando"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className={cn(
                      "shrink-0 rounded-md px-3 py-2 text-xs font-medium",
                      filter === id
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_340px]">
              <section
                data-preview-reveal
                className="grid gap-4 md:grid-cols-2"
              >
                {visibleTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={() => setSelectedTask(task)}
                    onToggleChecklist={toggleChecklist}
                  />
                ))}
                {!visibleTasks.length && (
                  <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
                    <CheckCircle2 className="mx-auto text-emerald-500" />
                    <p className="mt-3 font-medium text-slate-700">
                      Nenhuma tarefa nessa seleção.
                    </p>
                  </div>
                )}
              </section>
              <aside
                data-preview-reveal
                className="h-fit rounded-lg border border-slate-200 bg-white p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <SurfaceLabel>Atividades recentes</SurfaceLabel>
                    <h2 className="mt-1 text-lg font-semibold">
                      Confirmações da equipe
                    </h2>
                  </div>
                  <Filter size={17} className="text-slate-400" />
                </div>
                <div className="mt-5 space-y-4 border-l border-slate-200 pl-4">
                  {tasks
                    .flatMap((task) =>
                      task.checklist
                        .filter((item) => item.completedAt)
                        .map((item) => ({ ...item, taskTitle: task.title }))
                    )
                    .map((item) => (
                      <div key={item.id} className="relative">
                        <span className="absolute -left-[21px] top-1.5 size-2 rounded-full border-2 border-white bg-emerald-500" />
                        <p className="font-mono text-[10px] text-emerald-700">
                          {item.completedAt}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs leading-relaxed text-slate-600">
                          <EmployeeIdentity operatorId={item.owner} size={10} />{" "}
                          confirmou {item.label.toLocaleLowerCase("pt-BR")}.
                        </p>
                      </div>
                    ))}
                </div>
              </aside>
            </div>
          </>
        )}
          </>
        )}
          </motion.div>
        </AnimatePresence>
      </main>

      <SearchDialog
        tasks={tasks}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenTask={openTask}
      />
      {selectedTask && (
        <>
          <button
            aria-label="Fechar detalhes"
            onClick={() => setSelectedTask(null)}
            className="fixed inset-0 z-[170] bg-slate-950/10"
          />
          <TaskInspector
            task={
              tasks.find((task) => task.id === selectedTask.id) ?? selectedTask
            }
            onClose={() => setSelectedTask(null)}
            onToggleChecklist={toggleChecklist}
            onAdvanceStatus={advanceTaskStatus}
          />
        </>
      )}
      <TaskComposer
        open={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onCreate={createTask}
      />
    </div>
  );
}
