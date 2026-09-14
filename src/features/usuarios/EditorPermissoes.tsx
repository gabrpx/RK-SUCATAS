// Editor de permissões granulares — o miolo do formulário de usuário
// (UsuariosView). Uma seção por TELA do catálogo (src/constants/permissoes.ts):
// o toggle "Ver" manda na tela inteira e as ações abaixo dependem dele, igual
// à regra do helper `pode` (ação só vale se `ver` também estiver ligada).
// Por isso as ações ficam desabilitadas — e não escondidas — com "Ver"
// desligado: o dono continua enxergando o que existe pra liberar.
import { Check } from 'lucide-react';
import { cn } from '../../utils';
import { CATALOGO_PERMISSOES } from '../../constants/permissoes';
import type { Permissoes } from '../../constants/permissoes';

function contarLigadas(permissoes: Permissoes, tela: string): number {
  const mapa = permissoes[tela];
  if (!mapa) return 0;
  return Object.values(mapa).filter(Boolean).length;
}

export function EditorPermissoes({
  permissoes,
  onChange,
  desabilitado = false,
}: {
  permissoes: Permissoes;
  onChange: (proximo: Permissoes) => void;
  /** true quando o usuário é admin (super-usuário: o mapa nem é consultado). */
  desabilitado?: boolean;
}) {
  const alternar = (tela: string, acao: string) => {
    const mapa = { ...(permissoes[tela] ?? {}) };
    if (mapa[acao]) delete mapa[acao];
    else mapa[acao] = true;
    // Desligar "Ver" derruba a tela inteira: manter ações marcadas embaixo de
    // uma tela invisível seria estado morto (o `pode` já as ignoraria).
    const proximo = { ...permissoes };
    if (acao === 'ver' && !mapa.ver) delete proximo[tela];
    else if (Object.keys(mapa).length === 0) delete proximo[tela];
    else proximo[tela] = mapa;
    onChange(proximo);
  };

  const marcarTelaInteira = (tela: string, acoes: string[], ligar: boolean) => {
    const proximo = { ...permissoes };
    if (!ligar) delete proximo[tela];
    else proximo[tela] = Object.fromEntries(acoes.map((a) => [a, true]));
    onChange(proximo);
  };

  if (desabilitado) {
    return (
      <p className="text-sm text-text-secondary bg-surface-inset border border-border-default rounded-control p-3">
        Administrador tem acesso total a todas as telas e ações — não há o que configurar aqui. Desmarque "Administrador" acima para
        escolher permissão por tela.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {CATALOGO_PERMISSOES.map((tela) => {
        const podeVer = permissoes[tela.chave]?.ver === true;
        const acoes = tela.acoes.filter((a) => a.chave !== 'ver');
        const ligadas = contarLigadas(permissoes, tela.chave);
        const todasLigadas = ligadas === tela.acoes.length;

        return (
          <div
            key={tela.chave}
            className={cn(
              'rounded-control border transition-colors',
              podeVer ? 'border-accent/30 bg-accent-soft-bg/40' : 'border-border-default bg-surface-inset'
            )}
          >
            <div className="flex items-center justify-between gap-3 p-3">
              <button
                type="button"
                onClick={() => alternar(tela.chave, 'ver')}
                className="flex items-center gap-2.5 min-w-0 text-left"
              >
                <span
                  className={cn(
                    'size-4 rounded shrink-0 flex items-center justify-center border',
                    podeVer ? 'bg-accent border-accent text-white' : 'border-border-default'
                  )}
                >
                  {podeVer && <Check size={12} />}
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-sm font-medium truncate', podeVer ? 'text-accent-soft-fg' : 'text-text-secondary')}>
                    {tela.rotulo}
                  </span>
                  <span className="block text-xs text-text-faint truncate">{tela.descricao}</span>
                </span>
              </button>

              {acoes.length > 0 && podeVer && (
                <button
                  type="button"
                  onClick={() => marcarTelaInteira(tela.chave, todasLigadas ? [] : tela.acoes.map((a) => a.chave), !todasLigadas)}
                  className="shrink-0 text-2xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors"
                >
                  {todasLigadas ? 'Limpar' : 'Tudo'}
                </button>
              )}
            </div>

            {acoes.length > 0 && (
              <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-1.5 px-3 pb-3', !podeVer && 'opacity-40')}>
                {acoes.map((acao) => {
                  const marcado = podeVer && permissoes[tela.chave]?.[acao.chave] === true;
                  return (
                    <button
                      key={acao.chave}
                      type="button"
                      disabled={!podeVer}
                      title={acao.descricao}
                      onClick={() => alternar(tela.chave, acao.chave)}
                      className={cn(
                        'flex items-start gap-2 py-2 px-2.5 rounded-control border text-left transition-colors min-h-11 sm:min-h-9',
                        marcado ? 'bg-accent-soft-bg border-accent/30 text-accent-soft-fg' : 'bg-surface-card border-border-default text-text-secondary',
                        !podeVer && 'cursor-not-allowed'
                      )}
                    >
                      <span
                        className={cn(
                          'size-4 rounded shrink-0 mt-px flex items-center justify-center border',
                          marcado ? 'bg-accent border-accent text-white' : 'border-border-default'
                        )}
                      >
                        {marcado && <Check size={12} />}
                      </span>
                      <span className="text-[13px] leading-tight">{acao.rotulo}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
