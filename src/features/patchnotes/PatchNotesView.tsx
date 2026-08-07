// Aba "Novidades": changelog do produto, conteúdo estático mantido em
// data.ts a cada entrega relevante — não é uma tela de CRUD.
import { Sparkles, Wrench, ArrowUpCircle } from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { StatusTone } from '../../components/ui/StatusBadge';
import { PATCH_NOTES } from './data';
import type { PatchNoteTipo } from './data';

const TIPO_LABEL: Record<PatchNoteTipo, string> = { feature: 'Novo', melhoria: 'Melhoria', fix: 'Correção' };
const TIPO_TOM: Record<PatchNoteTipo, StatusTone> = { feature: 'positive', melhoria: 'accent', fix: 'warning' };
const TIPO_ICONE: Record<PatchNoteTipo, typeof Sparkles> = { feature: Sparkles, melhoria: ArrowUpCircle, fix: Wrench };

export function PatchNotesView() {
  return (
    <div className="space-y-6 pb-24 md:pb-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-medium text-text-primary">Novidades</h1>
        <p className="text-sm text-text-faint mt-0.5">O que mudou no sistema, atualização por atualização</p>
      </div>

      <div className="space-y-6">
        {PATCH_NOTES.map((entrada) => (
          <div key={entrada.versao} className="bg-surface-card border border-border-subtle rounded-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{entrada.titulo}</h2>
                <p className="text-xs text-text-faint mt-0.5">
                  Versão {entrada.versao} · {new Date(`${entrada.data}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            <ul className="divide-y divide-border-subtle">
              {entrada.itens.map((item, i) => {
                const Icone = TIPO_ICONE[item.tipo];
                return (
                  <li key={i} className="px-5 py-3 flex items-start gap-3">
                    <Icone size={15} className="text-text-faint shrink-0 mt-0.5" />
                    <p className="text-sm text-text-secondary flex-1">{item.texto}</p>
                    <span className="shrink-0">
                      <StatusBadge texto={TIPO_LABEL[item.tipo]} tom={TIPO_TOM[item.tipo]} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
