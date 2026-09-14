// Editar / excluir gaveta (Fase 2A). Espelha o form de "Nova gaveta" do
// GavetaList (mesmo Dialog Radix, inputClass, select de categorias de
// useCatalogos) — nome + categoria + ícone (emoji opcional). O backend
// (PATCH/DELETE /api/gavetas/:id) e os hooks já existem desde a Fase 1; aqui
// é só a UI que faltava.
//
// Excluir é ação destrutiva secundária DENTRO do dialog (não na linha da
// listagem, pra não expor exclusão a um toque). Passa por uma confirmação
// (padrão T13) que deixa explícito que NENHUMA peça é apagada — elas voltam
// pra "Itens não agrupados". O backend solta as peças (gaveta_id = null)
// antes de excluir.
//
// Regra de 1 accent por superfície: o único accent-cta é "Salvar alterações".
// Excluir é danger textual; na sub-tela de confirmação o botão vermelho é
// `destructive` (o Salvar não está visível lá), então não há dois accents.
import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useCatalogos } from '../../../hooks/useCatalogos';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { cn } from '../../../utils';
import { useAtualizarGaveta, useExcluirGaveta } from './hooks';
import { CategoriaGavetaDropdown } from './CategoriaGavetaDropdown';
import type { Gaveta } from '../types';

const inputClass =
  'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';

interface EditarGavetaDialogProps {
  gaveta: Gaveta;
  /** Quantas peças estão na gaveta hoje — usado só na confirmação de exclusão. */
  qtdPecas: number;
  onFechar: () => void;
  /** Chamado com a gaveta atualizada após salvar (pra a lista refletir sem refetch). */
  onAtualizada?: (gaveta: Gaveta) => void;
  /** Chamado após excluir com sucesso (o pai decide navegar de volta). */
  onExcluida?: () => void;
}

export function EditarGavetaDialog({ gaveta, qtdPecas, onFechar, onAtualizada, onExcluida }: EditarGavetaDialogProps) {
  const { categorias } = useCatalogos();
  const { atualizar, loading: salvando, error: erroSalvar } = useAtualizarGaveta();
  const { excluir, loading: excluindo, error: erroExcluir } = useExcluirGaveta();

  const [nome, setNome] = useState(gaveta.nome);
  const [categoriaId, setCategoriaId] = useState<string>(gaveta.categoria_id ?? '');
  const [icone, setIcone] = useState<string>(gaveta.icone ?? '');
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const nomeValido = nome.trim().length > 0;

  const salvar = async () => {
    if (!nomeValido) return;
    try {
      const atualizada = await atualizar(gaveta.id, {
        nome: nome.trim(),
        categoria_id: categoriaId || null,
        icone: icone.trim() || null,
      });
      onAtualizada?.(atualizada);
      onFechar();
    } catch {
      // erro exposto via erroSalvar — usuário pode tentar de novo
    }
  };

  const confirmarExclusao = async () => {
    try {
      await excluir(gaveta.id);
      onExcluida?.();
    } catch {
      // erro exposto via erroExcluir
    }
  };

  return (
    <Dialog open onOpenChange={(aberto) => (!aberto ? onFechar() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirmandoExclusao ? 'Excluir gaveta?' : 'Editar gaveta'}</DialogTitle>
        </DialogHeader>

        {confirmandoExclusao ? (
          <>
            <div className="flex gap-3 rounded-card bg-warning-bg/60 p-3">
              <AlertTriangle size={18} className="flex-none text-warning mt-0.5" />
              <div className="text-sm text-text-secondary space-y-1">
                <p className="font-semibold text-text-primary">Nenhuma peça é apagada.</p>
                <p>
                  {qtdPecas === 0
                    ? 'Esta gaveta está vazia. Ela será removida da lista.'
                    : `${qtdPecas} ${qtdPecas === 1 ? 'peça volta' : 'peças voltam'} para "Itens não agrupados" e a gaveta é removida da lista.`}
                </p>
              </div>
            </div>
            {erroExcluir && <p className="text-xs text-danger">{erroExcluir}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setConfirmandoExclusao(false)} disabled={excluindo}>
                Voltar
              </Button>
              <Button type="button" variant="destructive" onClick={confirmarExclusao} disabled={excluindo}>
                {excluindo ? <Loader2 size={16} className="animate-spin" /> : 'Excluir gaveta'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {erroSalvar && <p className="text-xs text-danger">{erroSalvar}</p>}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted" htmlFor="editar-gaveta-nome">
                  Nome
                </label>
                <input
                  id="editar-gaveta-nome"
                  autoFocus
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Tanque CG 125"
                  className={cn(inputClass, 'h-11')}
                />
              </div>
              <CategoriaGavetaDropdown
                id="editar-gaveta-categoria"
                label="Categoria (opcional)"
                value={categoriaId}
                onChange={setCategoriaId}
                options={[{ id: '', nome: 'Sem categoria' }, ...categorias.map((cat) => ({ id: cat.id, nome: cat.nome }))]}
              />
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted" htmlFor="editar-gaveta-icone">
                  Ícone (emoji, opcional)
                </label>
                <input
                  id="editar-gaveta-icone"
                  value={icone}
                  onChange={(e) => setIcone(e.target.value)}
                  placeholder="Ex: 🔧"
                  maxLength={4}
                  className={cn(inputClass, 'h-11 w-20 text-center text-lg')}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConfirmandoExclusao(true)}
              disabled={salvando}
              className="flex items-center gap-1.5 text-xs font-semibold text-danger hover:underline w-fit mt-1 min-h-11 sm:min-h-0"
            >
              <Trash2 size={14} /> Excluir gaveta
            </button>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onFechar} disabled={salvando}>
                Cancelar
              </Button>
              <Button type="button" variant="accent-cta" onClick={salvar} disabled={!nomeValido || salvando}>
                {salvando ? <Loader2 size={16} className="animate-spin" /> : 'Salvar alterações'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
