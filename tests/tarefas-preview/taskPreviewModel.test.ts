import test from "node:test";
import assert from "node:assert/strict";
import {
  createPreviewTask,
  filterPreviewTasksByPrimaryTab,
  filterPreviewTasksByQueueFilter,
  filterPreviewTasks,
  getPreviewCategoryBreakdown,
  getPreviewQueueCounts,
  getPreviewTaskDeadline,
  getPreviewTaskExecutionSummary,
  getPreviewWorkspaceCreateLabel,
  getPreviewWorkspaceEntity,
  getNextPreviewTaskStatus,
  getPreviewSummary,
  isCollaborativePreviewTask,
  type PreviewTask,
} from "../../src/features/tarefas-preview/taskPreviewModel.ts";

const tasks: PreviewTask[] = [
  {
    id: "estoque-1",
    title: "Conferir mesas ADV 160",
    area: "Estoque",
    category: "estoque",
    priority: "alta",
    status: "em-andamento",
    dueLabel: "Hoje às 16:30",
    estimateMinutes: 20,
    checklist: [
      {
        id: "a",
        label: "Conferir peças",
        completed: true,
        owner: "admin",
        completedAt: "14:15",
      },
      {
        id: "b",
        label: "Registrar condição",
        completed: false,
        owner: "admin",
      },
    ],
  },
  {
    id: "estoque-1",
    title: "Organizar prateleiras A1 a A4",
    area: "Estoque",
    category: "estoque",
    priority: "normal",
    status: "aguardando",
    dueLabel: "Hoje às 18:00",
    estimateMinutes: 35,
    checklist: [
      { id: "c", label: "Etiquetar caixas", completed: false, owner: "admin" },
    ],
  },
];

test("resume tarefas abertas e progresso de checklist", () => {
  assert.deepEqual(getPreviewSummary(tasks), {
    open: 2,
    inProgress: 1,
    completedChecklistItems: 1,
    totalChecklistItems: 3,
  });
});

test("filtra a fila por texto e status sem esconder a tarefa correspondente", () => {
  assert.deepEqual(
    filterPreviewTasks(tasks, { query: "mesas", status: "em-andamento" }).map(
      (task) => task.id
    ),
    ["estoque-1"]
  );
});

test("mantém todas as tarefas no Meu turno e delega os recortes aos tabs principais", () => {
  assert.equal(filterPreviewTasksByPrimaryTab(tasks, "turno").length, 2);
  assert.equal(filterPreviewTasksByPrimaryTab(tasks, "abertas").length, 2);
  assert.equal(filterPreviewTasksByPrimaryTab(tasks, "pendencias").length, 1);
  assert.equal(filterPreviewTasksByPrimaryTab(tasks, "concluidas").length, 0);
});

test("define 16:30 para despacho e não cria prazo artificial nas demais categorias", () => {
  assert.equal(getPreviewTaskDeadline("despacho"), "Hoje às 16:30");
  assert.equal(getPreviewTaskDeadline("estoque"), "Hoje, sem horário");
  assert.equal(getPreviewTaskDeadline("organizacao"), "Hoje, sem horário");
  assert.equal(getPreviewTaskDeadline("limpeza"), "Hoje, sem horário");
  assert.equal(getPreviewTaskDeadline("outro"), "Hoje, sem horário");
});

test("cria tarefa de despacho com prazo fixo, responsáveis e checklist informados", () => {
  const task = createPreviewTask({
    id: "tk-demo",
    title: "Conferir lote reservado",
    category: "despacho",
    priority: "critica",
    operatorIds: ["kaua", "eloisa"],
    checklistOwners: ["kaua", "eloisa"],
    instructions: "Conferir condição e separar por pedido.",
    checklistLabels: ["Conferir código", "Registrar condição"],
    dueTime: "18:00",
  });

  assert.equal(task.dueLabel, "Hoje às 16:30");
  assert.equal(task.priority, "critica");
  assert.deepEqual(task.operatorIds, ["kaua", "eloisa"]);
  assert.equal(task.instructions, "Conferir condição e separar por pedido.");
  assert.deepEqual(
    task.checklist.map((item) => item.label),
    ["Conferir código", "Registrar condição"]
  );
  assert.deepEqual(
    task.checklist.map((item) => item.owner),
    ["kaua", "eloisa"]
  );
});

test("categoriza tarefas por volume e progresso de cada rotina", () => {
  const breakdown = getPreviewCategoryBreakdown([
    ...tasks,
    { ...tasks[0], id: "limpeza-1", category: "limpeza", status: "concluida" },
  ]);

  assert.deepEqual(
    breakdown.find((item) => item.category === "estoque"),
    {
      category: "estoque",
      total: 2,
      open: 2,
      completed: 0,
      completionRate: 0,
      share: 67,
    }
  );
  assert.deepEqual(
    breakdown.find((item) => item.category === "limpeza"),
    {
      category: "limpeza",
      total: 1,
      open: 0,
      completed: 1,
      completionRate: 100,
      share: 33,
    }
  );
});

test("resume colaboração e próxima ação da tarefa para a superfície de execução", () => {
  const collaborative = getPreviewTaskExecutionSummary({
    ...tasks[0],
    operatorIds: ["admin", "operador-2"],
  });
  const individual = getPreviewTaskExecutionSummary({
    ...tasks[1],
    operatorIds: ["admin"],
  });

  assert.deepEqual(collaborative, {
    isCollaborative: true,
    responsibleCount: 2,
    completedChecklistItems: 1,
    totalChecklistItems: 2,
    percentage: 50,
    primaryAction: "Concluir tarefa",
  });
  assert.equal(individual.isCollaborative, false);
  assert.equal(individual.primaryAction, "Iniciar tarefa");
});

test("separa os filtros locais da fila da navegação global", () => {
  const queueTasks: PreviewTask[] = [
    ...tasks,
    {
      ...tasks[0],
      id: "grupo-1",
      status: "concluida",
      operatorIds: ["kaua", "ryan"],
    },
  ];

  assert.deepEqual(
    filterPreviewTasksByQueueFilter(queueTasks, "todas").map((task) => task.id),
    ["estoque-1", "estoque-1", "grupo-1"]
  );
  assert.equal(filterPreviewTasksByQueueFilter(queueTasks, "abertas").length, 2);
  assert.equal(
    filterPreviewTasksByQueueFilter(queueTasks, "pendencias").length,
    1
  );
  assert.deepEqual(
    filterPreviewTasksByQueueFilter(queueTasks, "grupo").map((task) => task.id),
    ["grupo-1"]
  );
  assert.deepEqual(getPreviewQueueCounts(queueTasks), {
    todas: 3,
    abertas: 2,
    pendencias: 1,
    grupo: 1,
  });
});

test("reconhece tarefa colaborativa apenas com mais de um responsável", () => {
  assert.equal(isCollaborativePreviewTask(tasks[0]), false);
  assert.equal(
    isCollaborativePreviewTask({ ...tasks[0], operatorIds: ["kaua"] }),
    false
  );
  assert.equal(
    isCollaborativePreviewTask({ ...tasks[0], operatorIds: ["kaua", "ryan"] }),
    true
  );
});

test("o CTA global deriva a entidade da aba ativa", () => {
  assert.equal(getPreviewWorkspaceEntity("turno"), "tarefa");
  assert.equal(getPreviewWorkspaceEntity("concluidas"), "tarefa");
  assert.equal(getPreviewWorkspaceEntity("lembretes"), "lembrete");
  assert.equal(getPreviewWorkspaceCreateLabel("pendencias"), "Nova tarefa");
  assert.equal(getPreviewWorkspaceCreateLabel("lembretes"), "Novo lembrete");
});

test("avança o status da tarefa no fluxo interativo do preview", () => {
  assert.equal(getNextPreviewTaskStatus("aguardando"), "em-andamento");
  assert.equal(getNextPreviewTaskStatus("em-andamento"), "concluida");
  assert.equal(getNextPreviewTaskStatus("concluida"), "aguardando");
});
