/**
 * Tela real de tarefas.
 *
 * A apresentação é a mesma do tarefas-preview. Este arquivo só conecta a
 * vitrine aos hooks e endpoints reais; não mantém tarefas ou lembretes de
 * demonstração no caminho autenticado.
 */
import { TasksPreview } from '../tarefas-preview/TasksPreview';
import { useTarefas } from './useTarefas';
import { useLembretes } from '../lembretes/useLembretes';
import { TarefasPreviewIntegrated } from './TarefasPreviewIntegrated';

export function TarefasView() {
  const tarefas = useTarefas();
  const lembretes = useLembretes();

  return <TarefasPreviewIntegrated tarefas={tarefas} lembretes={lembretes} Preview={TasksPreview} />;
}
