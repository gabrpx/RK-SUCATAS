import { animate, stagger } from 'animejs';
import { DotMatrix } from 'dot-anime-react';
import {
  Activity,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Command,
  Filter,
  Gauge,
  Layers3,
  LockKeyhole,
  MoreHorizontal,
  Network,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TimerReset,
  UserRound,
  UsersRound,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Area, AreaChart } from '@/src/components/charts/area-chart';
import { ChartTooltip } from '@/src/components/charts/tooltip';
import { Grid } from '@/src/components/charts/grid';
import { XAxis } from '@/src/components/charts/x-axis';
import { Button } from '@/src/components/animate-ui/components/buttons/button';
import { cn } from '@/src/utils';
import { getTaskSummary, sortTasksByFocus, type Task, type TaskStatus } from './taskModel';

type TasksViewProps = {
  theme: 'light' | 'dark';
};

type ViewMode = 'turno' | 'radar' | 'equipe' | 'playbooks';

const VIEW_MODES: Array<{ id: ViewMode; label: string; icon: typeof Activity }> = [
  { id: 'turno', label: 'Meu turno', icon: Target },
  { id: 'radar', label: 'Radar', icon: Activity },
  { id: 'equipe', label: 'Equipe', icon: UsersRound },
  { id: 'playbooks', label: 'Playbooks', icon: Layers3 },
];

const seedTasks: Task[] = [
  {
    id: 'task-4821',
    title: 'Liberar pedido 4821 para despacho',
    status: 'in-progress',
    priority: 'critical',
    impact: 'high',
    dueLabel: 'vence em 35 min',
    dueAt: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
    estimateMinutes: 20,
    owner: 'Você',
    area: 'Expedição',
    context: 'Pedido #4821 · Frete expresso',
    reason: 'Bloqueia o despacho de hoje',
    tags: ['SLA', 'despacho'],
  },
  {
    id: 'task-carenagens',
    title: 'Revisar fotos do lote de carenagens',
    status: 'blocked',
    priority: 'high',
    impact: 'medium',
    dueLabel: 'aguardando retorno',
    dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    estimateMinutes: 45,
    owner: 'Você',
    area: 'Catálogo',
    context: 'Lote 24-B · 18 peças',
    reason: 'Aguardando aprovação de qualidade',
    tags: ['bloqueada', 'qualidade'],
  },
  {
    id: 'task-caixa',
    title: 'Conciliar diferença do fechamento de ontem',
    status: 'ready',
    priority: 'high',
    impact: 'high',
    dueLabel: 'hoje, 11:30',
    dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    estimateMinutes: 30,
    owner: 'Você',
    area: 'Caixa',
    context: 'Fechamento · R$ 184,90',
    reason: 'Protege a conferência financeira do dia',
    tags: ['financeiro'],
  },
  {
    id: 'task-entrada',
    title: 'Validar identificação das peças recebidas',
    status: 'ready',
    priority: 'normal',
    impact: 'medium',
    dueLabel: 'hoje, 14:00',
    dueAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    estimateMinutes: 55,
    owner: 'Você',
    area: 'Estoque',
    context: 'Entrada #ENT-093 · 27 itens',
    reason: 'Evita cadastro incompleto no próximo lote',
    tags: ['entrada'],
  },
  {
    id: 'task-orcamento',
    title: 'Retornar orçamento da CB 300 ao cliente',
    status: 'waiting',
    priority: 'normal',
    impact: 'medium',
    dueLabel: 'aguardando cliente',
    dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    estimateMinutes: 15,
    owner: 'Você',
    area: 'Atendimento',
    context: 'Orçamento #ORC-908',
    reason: 'Cliente pediu retorno amanhã cedo',
    tags: ['follow-up'],
  },
];

const teamLoad = [
  { name: 'Ana', role: 'Estoque', load: 82, color: 'bg-fuchsia-400', status: 'atenção' },
  { name: 'Carlos', role: 'Expedição', load: 64, color: 'bg-cyan-400', status: 'saudável' },
  { name: 'João', role: 'Atendimento', load: 44, color: 'bg-amber-300', status: 'livre' },
  { name: 'Mariana', role: 'Gestão', load: 91, color: 'bg-rose-400', status: 'sobrecarga' },
];

const playbooks = [
  { title: 'Entrada de lote', steps: 6, duration: '1h 40', running: 3, accent: 'amber' },
  { title: 'Despacho expresso', steps: 4, duration: '25 min', running: 2, accent: 'cyan' },
  { title: 'Fechamento de caixa', steps: 5, duration: '35 min', running: 1, accent: 'violet' },
];

const taskFlowData = Array.from({ length: 7 }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() - (6 - index));
  return {
    date,
    completed: [8, 11, 9, 14, 12, 16, 13][index],
    blocked: [3, 2, 4, 2, 3, 1, 2][index],
  };
});

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

function StatusPill({ status }: { status: TaskStatus }) {
  const config: Record<TaskStatus, { label: string; className: string }> = {
    ready: { label: 'pronta', className: 'border-white/10 bg-white/[0.06] text-zinc-300' },
    'in-progress': { label: 'em andamento', className: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200' },
    waiting: { label: 'aguardando', className: 'border-amber-300/30 bg-amber-300/10 text-amber-200' },
    blocked: { label: 'bloqueada', className: 'border-rose-300/30 bg-rose-300/10 text-rose-200' },
    review: { label: 'em revisão', className: 'border-violet-300/30 bg-violet-300/10 text-violet-200' },
    completed: { label: 'concluída', className: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' },
  };

  return <span className={cn('rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em]', config[status].className)}>{config[status].label}</span>;
}

function PriorityMark({ priority }: { priority: Task['priority'] }) {
  const config = {
    critical: { label: 'P0', className: 'bg-rose-400 text-rose-950' },
    high: { label: 'P1', className: 'bg-amber-300 text-amber-950' },
    normal: { label: 'P2', className: 'bg-cyan-300 text-cyan-950' },
    low: { label: 'P3', className: 'bg-zinc-600 text-zinc-100' },
  }[priority];

  return <span className={cn('inline-flex h-6 min-w-7 items-center justify-center rounded-md px-1.5 font-mono text-[10px] font-black', config.className)}>{config.label}</span>;
}

function TaskRow({ task, onSelect, onComplete }: { task: Task; onSelect: (task: Task) => void; onComplete: (id: string) => void }) {
  const isComplete = task.status === 'completed';

  return (
    <motion.div layout className={cn('group relative flex items-start gap-3 border-b border-white/[0.07] py-4 last:border-0', isComplete && 'opacity-50')}>
      <button
        aria-label={isComplete ? `Tarefa concluída: ${task.title}` : `Concluir tarefa: ${task.title}`}
        onClick={() => onComplete(task.id)}
        className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors', isComplete ? 'border-emerald-300 bg-emerald-300 text-emerald-950' : 'border-zinc-600 hover:border-amber-300 hover:bg-amber-300/10')}
      >
        {isComplete ? <Check size={14} strokeWidth={3} /> : <Circle size={9} className="text-zinc-600" />}
      </button>

      <button onClick={() => onSelect(task)} className="min-w-0 flex-1 text-left">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <PriorityMark priority={task.priority} />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">{task.area}</span>
          <StatusPill status={task.status} />
        </div>
        <p className="text-[15px] font-semibold leading-snug text-zinc-100 transition-colors group-hover:text-amber-200">{task.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
          <span className={cn('flex items-center gap-1', task.status === 'blocked' ? 'text-rose-300' : 'text-zinc-500')}><Clock3 size={12} /> {task.dueLabel}</span>
          <span className="flex items-center gap-1"><TimerReset size={12} /> {formatMinutes(task.estimateMinutes)}</span>
          <span className="text-zinc-600">{task.context}</span>
        </div>
      </button>

      <button aria-label={`Mais ações para ${task.title}`} className="mt-1 rounded-lg p-1.5 text-zinc-600 opacity-0 transition-opacity hover:bg-white/10 hover:text-zinc-200 group-hover:opacity-100"><MoreHorizontal size={17} /></button>
    </motion.div>
  );
}

function Metric({ label, value, suffix, tone }: { label: string; value: string; suffix?: string; tone: 'amber' | 'cyan' | 'rose' | 'violet' }) {
  const tones = {
    amber: 'text-amber-200 border-amber-300/15 bg-amber-300/[0.06]',
    cyan: 'text-cyan-200 border-cyan-300/15 bg-cyan-300/[0.06]',
    rose: 'text-rose-200 border-rose-300/15 bg-rose-300/[0.06]',
    violet: 'text-violet-200 border-violet-300/15 bg-violet-300/[0.06]',
  };

  return (
    <div className={cn('min-w-[116px] rounded-2xl border px-4 py-3', tones[tone])}>
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-black tracking-tight">{value}<span className="ml-1 text-[10px] font-medium text-zinc-500">{suffix}</span></p>
    </div>
  );
}

function TasksChart({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div className="h-[205px] w-full">
      <AreaChart data={taskFlowData} aspectRatio="auto" style={{ height: 205 }}>
        <Grid horizontal stroke={theme === 'dark' ? 'rgba(255,255,255,.08)' : 'rgba(20,20,30,.12)'} />
        <Area dataKey="completed" fill="var(--chart-line-primary)" fillOpacity={0.22} stroke="var(--chart-line-primary)" strokeWidth={2} fadeEdges />
        <XAxis numTicks={4} />
        <ChartTooltip
          showDatePill={false}
          showCrosshair
          showDots
          rows={(point) => [{ label: 'Concluídas', value: `${point.completed ?? 0}`, color: 'var(--chart-line-primary)' }]}
        />
      </AreaChart>
    </div>
  );
}

export function TasksView({ theme }: TasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(seedTasks[0]);
  const [activeView, setActiveView] = useState<ViewMode>('turno');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'blocked'>('all');

  useEffect(() => {
    const intro = animate('.tasks-reveal', {
      opacity: [0, 1],
      translateY: [14, 0],
      delay: stagger(55),
      duration: 700,
      ease: 'out(4)',
    });

    return () => {
      intro.pause();
    };
  }, []);

  const summary = useMemo(() => getTaskSummary(tasks), [tasks]);
  const orderedTasks = useMemo(() => sortTasksByFocus([...tasks]), [tasks]);
  const visibleTasks = orderedTasks.filter((task) => {
    if (filter === 'open') return task.status !== 'completed' && task.status !== 'blocked' && task.status !== 'waiting';
    if (filter === 'blocked') return task.status === 'blocked' || task.status === 'waiting';
    return true;
  });
  const focusTask = orderedTasks.find((task) => task.status !== 'completed' && task.status !== 'blocked' && task.status !== 'waiting') ?? orderedTasks[0];

  const completeTask = (id: string) => {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status: 'completed' } : task));
    setSelectedTask((current) => current?.id === id ? { ...current, status: 'completed' } : current);
  };

  const startFocus = () => {
    if (!focusTask) return;
    setSelectedTask(focusTask);
    setIsFocusMode(true);
    setTasks((current) => current.map((task) => task.id === focusTask.id && task.status === 'ready' ? { ...task, status: 'in-progress' } : task));
  };

  return (
    <div className="relative mx-auto w-full max-w-[1500px] overflow-hidden pb-20 text-zinc-100">
      <div className="pointer-events-none absolute -left-28 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-[110px]" />
      <div className="pointer-events-none absolute right-0 top-20 h-64 w-64 rounded-full bg-cyan-400/[0.08] blur-[100px]" />

      <div className="tasks-reveal relative mb-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/80">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,.9)]" />
            Torre de operações · turno aberto
          </div>
          <h1 className="max-w-3xl text-[clamp(2.3rem,7vw,5.7rem)] font-black leading-[0.9] tracking-[-0.075em] text-white">
            Seu trabalho,<br /><span className="bg-gradient-to-r from-amber-200 via-amber-100 to-violet-200 bg-clip-text text-transparent">em movimento.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">Uma fila viva de decisões, entregas e desbloqueios. O sistema organiza o ruído para você agir no que muda o resultado.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 sm:flex">
            <DotMatrix sequence={[[0, 1, 5, 6, 7, 11, 12, 13, 17, 18, 19, 23, 24], [1, 5, 7, 11, 13, 17, 19, 23]]} rows={5} cols={5} dotSize={4} gap={3} interval={850} color="#fcd34d" inactiveColor="rgba(252,211,77,.12)" />
            <div><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">sincronizado</p><p className="text-sm font-bold text-amber-100">agora</p></div>
          </div>
          <Button variant="accent" size="lg" onClick={() => setIsComposerOpen(true)} className="h-12 rounded-2xl px-5 font-black shadow-[0_12px_40px_rgba(252,211,77,.14)]"><Plus size={18} /> Nova tarefa</Button>
        </div>
      </div>

      <div className="tasks-reveal mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {VIEW_MODES.map((view) => {
          const Icon = view.icon;
          return <button key={view.id} onClick={() => setActiveView(view.id)} className={cn('flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[11px] font-bold transition-all', activeView === view.id ? 'border-amber-300/30 bg-amber-300/10 text-amber-100' : 'border-white/[0.08] bg-white/[0.03] text-zinc-500 hover:border-white/20 hover:text-zinc-200')}><Icon size={14} /> {view.label}</button>;
        })}
        <div className="ml-auto hidden items-center gap-2 lg:flex"><button className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-zinc-500 hover:text-white"><Search size={15} /></button><button className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-zinc-500 hover:text-white"><Command size={15} /></button></div>
      </div>

      {activeView === 'turno' && (
        <>
          <div className="tasks-reveal mb-5 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            <Metric label="abertas" value={`${summary.open}`} suffix="tarefas" tone="cyan" />
            <Metric label="vence logo" value={`${summary.dueSoon}`} suffix="agora" tone="amber" />
            <Metric label="bloqueios" value={`${summary.blocked}`} suffix="atenção" tone="rose" />
            <Metric label="ritmo do turno" value="72" suffix="%" tone="violet" />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_360px]">
            <section className="tasks-reveal min-w-0 space-y-5">
              <div className="relative overflow-hidden rounded-[2rem] border border-amber-200/20 bg-[linear-gradient(135deg,rgba(252,211,77,.12),rgba(139,92,246,.08)_48%,rgba(8,10,20,.85))] p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] sm:p-7">
                <div className="pointer-events-none absolute right-[-15%] top-[-45%] h-80 w-80 rounded-full border border-amber-200/10 bg-amber-100/[0.04] blur-2xl" />
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                  <div className="max-w-2xl">
                    <div className="mb-4 flex flex-wrap items-center gap-2"><span className="flex items-center gap-1.5 rounded-full border border-amber-200/20 bg-amber-200/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-amber-100"><Sparkles size={12} /> próxima melhor ação</span><StatusPill status={focusTask?.status ?? 'ready'} /></div>
                    <h2 className="max-w-xl text-2xl font-black leading-tight tracking-[-0.04em] text-white sm:text-4xl">{focusTask?.title}</h2>
                    <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-amber-100/65"><Zap size={15} className="mt-0.5 shrink-0 text-amber-200" /> {focusTask?.reason}</p>
                  </div>
                  <Button variant="accent" size="lg" onClick={startFocus} className="h-12 shrink-0 rounded-2xl px-5 font-black"><Play size={16} fill="currentColor" /> Iniciar foco</Button>
                </div>
                <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 sm:grid-cols-4">
                  <div><p className="text-[9px] uppercase tracking-[0.16em] text-zinc-500">impacto</p><p className="mt-1 text-sm font-bold text-white">alto</p></div>
                  <div><p className="text-[9px] uppercase tracking-[0.16em] text-zinc-500">tempo</p><p className="mt-1 text-sm font-bold text-white">{formatMinutes(focusTask?.estimateMinutes ?? 0)}</p></div>
                  <div><p className="text-[9px] uppercase tracking-[0.16em] text-zinc-500">contexto</p><p className="mt-1 truncate text-sm font-bold text-white">{focusTask?.context}</p></div>
                  <div><p className="text-[9px] uppercase tracking-[0.16em] text-zinc-500">dependências</p><p className="mt-1 text-sm font-bold text-cyan-200">1 liberada</p></div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/[0.08] bg-zinc-950/50 p-5 sm:p-7">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">fluxo de execução</p><h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-white">Sequência recomendada</h2></div><div className="flex gap-1.5"><Filter size={14} className="mr-1 mt-2 text-zinc-600" />{(['all', 'open', 'blocked'] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={cn('rounded-lg px-2.5 py-1.5 text-[10px] font-bold capitalize', filter === item ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-zinc-300')}>{item === 'all' ? 'todas' : item === 'open' ? 'abertas' : 'impedimentos'}</button>)}</div></div>
                <div>{visibleTasks.map((task) => <TaskRow key={task.id} task={task} onSelect={setSelectedTask} onComplete={completeTask} />)}</div>
                {visibleTasks.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-center"><CheckCircle2 size={30} className="mb-3 text-emerald-300" /><p className="font-bold text-zinc-200">Nada pendente nesta lente</p><p className="mt-1 text-sm text-zinc-500">A fila está limpa por aqui.</p></div>}
              </div>
            </section>

            <aside className="tasks-reveal space-y-5">
              <div className="rounded-[2rem] border border-white/[0.08] bg-zinc-950/50 p-5 sm:p-6"><div className="mb-4 flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">ritmo operacional</p><h3 className="mt-1 text-lg font-black text-white">O time está fluindo</h3></div><Activity size={17} className="text-cyan-300" /></div><TasksChart theme={theme} /><div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-3 text-[11px]"><span className="text-zinc-500">tarefas concluídas</span><span className="font-mono font-bold text-cyan-200">+18% <ArrowUpRight size={12} className="inline" /></span></div></div>
              <div className="rounded-[2rem] border border-rose-300/15 bg-rose-300/[0.04] p-5 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-rose-200/50">radar de risco</p><h3 className="mt-1 text-lg font-black text-white">2 pontos pedem você</h3></div><BellRing size={17} className="text-rose-300" /></div><div className="space-y-3"><div className="flex gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-300 shadow-[0_0_10px_rgba(253,164,175,.8)]" /><div><p className="text-sm font-semibold text-zinc-200">Lote de carenagens parado</p><p className="mt-1 text-[11px] text-zinc-500">bloqueado há 48 min · Qualidade</p></div></div><div className="flex gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,.8)]" /><div><p className="text-sm font-semibold text-zinc-200">Conciliação vence hoje</p><p className="mt-1 text-[11px] text-zinc-500">R$ 184,90 · Caixa</p></div></div></div><button onClick={() => setActiveView('radar')} className="mt-5 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-[11px] font-bold text-zinc-300 hover:bg-white/10">Abrir radar completo <ChevronRight size={15} /></button></div>
            </aside>
          </div>
        </>
      )}

      {activeView === 'radar' && <div className="tasks-reveal grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,.7fr)]"><section className="rounded-[2rem] border border-white/[0.08] bg-zinc-950/50 p-5 sm:p-7"><div className="mb-6 flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-rose-200/50">visão de exceção</p><h2 className="mt-1 text-2xl font-black text-white">Tudo que pode sair do trilho</h2></div><Button variant="ghost" size="sm"><RefreshCw size={14} /> Atualizar</Button></div><div className="space-y-1">{orderedTasks.filter((task) => task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical').map((task) => <TaskRow key={task.id} task={task} onSelect={setSelectedTask} onComplete={completeTask} />)}</div></section><section className="rounded-[2rem] border border-white/[0.08] bg-zinc-950/50 p-5 sm:p-7"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">pressão por processo</p><h2 className="mt-1 text-2xl font-black text-white">Onde a operação sente</h2><div className="mt-6 space-y-4">{['Expedição', 'Catálogo', 'Caixa', 'Estoque'].map((label, index) => <div key={label}><div className="mb-2 flex justify-between text-xs"><span className="font-semibold text-zinc-300">{label}</span><span className="font-mono text-zinc-500">{[84, 61, 48, 36][index]}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.07]"><motion.div initial={{ width: 0 }} animate={{ width: `${[84, 61, 48, 36][index]}%` }} transition={{ duration: .8, delay: index * .08 }} className={cn('h-full rounded-full', ['bg-rose-300', 'bg-amber-300', 'bg-cyan-300', 'bg-violet-300'][index])} /></div></div>)}</div></section></div>}

      {activeView === 'equipe' && <div className="tasks-reveal grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]"><section className="rounded-[2rem] border border-white/[0.08] bg-zinc-950/50 p-5 sm:p-7"><div className="mb-6"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/50">capacidade humana</p><h2 className="mt-1 text-2xl font-black text-white">Distribua o peso certo</h2></div><div className="space-y-3">{teamLoad.map((member) => <div key={member.name} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4"><div className="flex items-center gap-3"><div className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-zinc-950', member.color)}>{member.name.slice(0, 1)}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="font-bold text-zinc-100">{member.name}</p><span className="font-mono text-xs text-zinc-400">{member.load}%</span></div><p className="mt-1 text-[11px] text-zinc-500">{member.role} · {member.status}</p></div><button className="rounded-lg p-2 text-zinc-600 hover:bg-white/10 hover:text-white"><MoreHorizontal size={16} /></button></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><motion.div initial={{ width: 0 }} animate={{ width: `${member.load}%` }} transition={{ duration: .9 }} className={cn('h-full rounded-full', member.color)} /></div></div>)}</div></section><section className="rounded-[2rem] border border-amber-300/15 bg-amber-300/[0.04] p-5 sm:p-7"><Gauge className="text-amber-200" size={22} /><p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-100/50">leitura do gestor</p><h2 className="mt-1 text-2xl font-black text-white">A equipe tem 1h20 de espaço livre.</h2><p className="mt-3 text-sm leading-relaxed text-zinc-400">João pode absorver uma tarefa de atendimento. Mariana está em sobrecarga e tem duas entregas críticas em paralelo.</p><Button variant="accent" className="mt-6 w-full rounded-xl font-black">Redistribuir com cuidado <ArrowUpRight size={15} /></Button></section></div>}

      {activeView === 'playbooks' && <div className="tasks-reveal"><div className="mb-5 flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-200/50">processos que se repetem</p><h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">Playbooks vivos</h2></div><Button variant="outline" className="rounded-xl"><Plus size={15} /> Novo playbook</Button></div><div className="grid gap-4 md:grid-cols-3">{playbooks.map((book) => <motion.button whileHover={{ y: -4 }} key={book.title} className="rounded-[2rem] border border-white/[0.08] bg-zinc-950/50 p-5 text-left transition-colors hover:border-violet-300/30"><div className="flex items-start justify-between"><div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', book.accent === 'amber' ? 'bg-amber-300/15 text-amber-200' : book.accent === 'cyan' ? 'bg-cyan-300/15 text-cyan-200' : 'bg-violet-300/15 text-violet-200')}><Network size={18} /></div><MoreHorizontal size={17} className="text-zinc-600" /></div><h3 className="mt-7 text-lg font-black text-white">{book.title}</h3><p className="mt-2 text-sm text-zinc-500">{book.steps} etapas · {book.duration} em média</p><div className="mt-7 flex items-center justify-between border-t border-white/[0.08] pt-4"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">em execução</span><span className="font-mono text-sm font-bold text-zinc-200">{book.running}</span></div></motion.button>)}</div></div>}

      <AnimatePresence>
        {selectedTask && <motion.div className="fixed inset-0 z-[120] flex justify-end bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedTask(null)}><motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 240 }} onClick={(event) => event.stopPropagation()} className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#0e1018] p-5 shadow-2xl sm:p-8"><div className="flex items-center justify-between"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500"><LockKeyhole size={13} /> ficha operacional</div><button onClick={() => setSelectedTask(null)} className="rounded-xl p-2 text-zinc-500 hover:bg-white/10 hover:text-white"><X size={18} /></button></div><div className="mt-10"><div className="flex items-center gap-2"><PriorityMark priority={selectedTask.priority} /><StatusPill status={selectedTask.status} /></div><h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.05em] text-white">{selectedTask.title}</h2><p className="mt-4 text-sm leading-relaxed text-zinc-400">{selectedTask.reason}. Esta tarefa faz parte da fila de {selectedTask.area.toLowerCase()} e precisa preservar o contexto até a entrega.</p><div className="mt-8 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-[9px] uppercase tracking-[0.16em] text-zinc-600">responsável</p><p className="mt-2 flex items-center gap-2 text-sm font-bold text-zinc-100"><UserRound size={14} className="text-amber-200" /> {selectedTask.owner}</p></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-[9px] uppercase tracking-[0.16em] text-zinc-600">prazo</p><p className="mt-2 flex items-center gap-2 text-sm font-bold text-zinc-100"><CalendarClock size={14} className="text-cyan-200" /> {selectedTask.dueLabel}</p></div></div><div className="mt-6 rounded-2xl border border-amber-200/15 bg-amber-200/[0.05] p-4"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-100"><Sparkles size={13} /> por que está aqui</p><p className="mt-2 text-sm leading-relaxed text-amber-100/70">Impacto {selectedTask.impact}, estimativa de {formatMinutes(selectedTask.estimateMinutes)} e influência direta no fluxo de {selectedTask.area.toLowerCase()}.</p></div><div className="mt-7"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">critério de aceite</p><div className="mt-3 space-y-2"><div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-zinc-300"><CheckCircle2 size={16} className="text-cyan-200" /> Registro conferido</div><div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-zinc-300"><CheckCircle2 size={16} className="text-cyan-200" /> Evidência anexada</div><div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-zinc-300"><Circle size={16} className="text-zinc-600" /> Aprovação do responsável</div></div></div><div className="mt-8 flex gap-3"><Button variant="accent" className="flex-1 rounded-xl font-black" onClick={() => completeTask(selectedTask.id)}><Check size={16} /> Marcar concluída</Button><Button variant="outline" className="rounded-xl" onClick={() => setIsFocusMode(true)}><Play size={16} /></Button></div></div></motion.aside></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {isComposerOpen && <motion.div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsComposerOpen(false)}><motion.div initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 220 }} onClick={(event) => event.stopPropagation()} className="w-full max-w-2xl rounded-t-[2rem] border border-white/10 bg-[#0e1018] p-5 sm:rounded-[2rem] sm:p-8"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-200/60">nova entrada de trabalho</p><h2 className="mt-1 text-2xl font-black text-white">O que precisa acontecer?</h2></div><button onClick={() => setIsComposerOpen(false)} className="rounded-xl p-2 text-zinc-500 hover:bg-white/10 hover:text-white"><X size={18} /></button></div><div className="mt-7 space-y-4"><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">resultado esperado</span><input autoFocus placeholder="Ex.: liberar o lote para venda" className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-200/50" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">área responsável</span><select className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none"><option>Estoque</option><option>Expedição</option><option>Caixa</option><option>Atendimento</option></select></label><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">prazo</span><input type="datetime-local" className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none" /></label></div><div className="flex items-center gap-3 rounded-xl border border-cyan-200/15 bg-cyan-200/[0.05] p-3 text-xs leading-relaxed text-cyan-100/70"><Sparkles size={15} className="shrink-0 text-cyan-200" /> O sistema vai sugerir responsável, prioridade e dependências depois que o resultado estiver claro.</div></div><div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => setIsComposerOpen(false)}>Cancelar</Button><Button variant="accent" onClick={() => setIsComposerOpen(false)} className="rounded-xl font-black"><Plus size={16} /> Criar tarefa</Button></div></motion.div></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {isFocusMode && focusTask && <motion.div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#080910]/95 p-5 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div initial={{ scale: .94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-3xl rounded-[2rem] border border-amber-200/20 bg-[radial-gradient(circle_at_top_right,rgba(252,211,77,.13),transparent_35%),#11131e] p-6 shadow-[0_30px_120px_rgba(0,0,0,.5)] sm:p-10"><div className="flex items-center justify-between"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-200/60"><span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" /> modo foco ativo</div><button onClick={() => setIsFocusMode(false)} className="rounded-xl p-2 text-zinc-500 hover:bg-white/10 hover:text-white"><X size={18} /></button></div><div className="mt-14 max-w-2xl"><PriorityMark priority={focusTask.priority} /><h2 className="mt-5 text-4xl font-black leading-[.95] tracking-[-.06em] text-white sm:text-6xl">{focusTask.title}</h2><p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-400">{focusTask.reason}. Trabalhe com o contexto essencial e registre a prova da entrega.</p></div><div className="mt-12 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-[9px] uppercase tracking-[0.16em] text-zinc-600">etapa 01</p><p className="mt-2 text-sm font-bold text-zinc-100">Conferir registro</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-[9px] uppercase tracking-[0.16em] text-zinc-600">etapa 02</p><p className="mt-2 text-sm font-bold text-zinc-100">Validar evidência</p></div><div className="rounded-2xl border border-dashed border-amber-200/30 bg-amber-200/[0.05] p-4"><p className="text-[9px] uppercase tracking-[0.16em] text-amber-200/60">etapa 03</p><p className="mt-2 text-sm font-bold text-amber-100">Confirmar entrega</p></div></div><div className="mt-10 flex flex-col gap-3 sm:flex-row"><Button variant="accent" size="lg" className="rounded-xl font-black" onClick={() => { completeTask(focusTask.id); setIsFocusMode(false); }}><Check size={17} /> Concluir entrega</Button><Button variant="outline" size="lg" className="rounded-xl" onClick={() => setIsFocusMode(false)}><Pause size={17} /> Pausar e voltar</Button></div></motion.div></motion.div>}
      </AnimatePresence>
    </div>
  );
}
