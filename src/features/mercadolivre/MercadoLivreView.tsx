// Aba Mercado Livre — por enquanto só o primeiro módulo: conectar a conta da
// loja via OAuth e mostrar os dados básicos da página (nome, reputação em
// cards e o resumo de avaliações em gráfico). Os próximos módulos (anúncios,
// etiquetas, mensagens) entram aqui como blocos novos, um de cada vez, todos
// reaproveitando a mesma conexão.
import { useEffect, useState } from 'react';
import { Store, Loader2, ExternalLink, Award, CheckCircle2, XCircle, AlertTriangle, Clock, Unlink } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { aviso } from '../../components/ui/toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { MetricCard, type MetricTone } from '../../components/ui/MetricCard';
import { mercadolivreApi, type MercadoLivreConta } from './api';

// Erros que o callback do backend pode mandar de volta na query string —
// texto amigável pra cada um, o resto cai no genérico.
const MENSAGENS_ERRO: Record<string, string> = {
  estado_invalido: 'O login expirou ou foi aberto de outra aba. Tente conectar de novo.',
  troca_token: 'O Mercado Livre recusou a autorização. Tente conectar de novo.',
};

// Cor por SIGNIFICADO (positiva/neutra/negativa), nunca decorativa — mesma
// regra de CLAUDE.md > Design system. Ordem fixa: positivo, neutro, negativo.
const CORES_AVALIACAO = { positivo: 'var(--positive)', neutro: 'var(--text-muted)', negativo: 'var(--negative)' };

const pct = (n: number | undefined) => (n != null ? `${Math.round(n * 100)}%` : '—');

// A API do Mercado Livre devolve o período em inglês ("365 days") — o resto
// da tela é todo em português, então traduz só esse pedaço.
const periodoPt = (periodo: string) => periodo.replace(/(\d+)\s*days?/i, '$1 dias');

// Tooltip custom do donut: card no estilo do design system em vez do balão
// padrão do Recharts.
function ChartTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control border border-border-default bg-surface-raised px-3 py-2 shadow-lg">
      <p className="text-[10px] uppercase tracking-wide text-text-faint mb-1">{payload[0].name}</p>
      <p className="text-sm font-medium text-text-primary">{pct(payload[0].value)}</p>
    </div>
  );
}

export function MercadoLivreView() {
  const [carregando, setCarregando] = useState(true);
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [confirmandoDesconexao, setConfirmandoDesconexao] = useState(false);
  const [conta, setConta] = useState<MercadoLivreConta | null>(null);

  const carregarStatus = async () => {
    setCarregando(true);
    try {
      const status = await mercadolivreApi.status();
      if (!status.conectado) {
        setConta(null);
        return;
      }
      const resultado = await mercadolivreApi.dadosConta();
      if (resultado.success && resultado.data) setConta(resultado.data);
      else {
        setConta(null);
        aviso.falha(resultado.error, 'Não deu pra carregar os dados da conta');
      }
    } catch (err) {
      aviso.falha(err, 'Erro ao verificar conexão com o Mercado Livre');
    } finally {
      setCarregando(false);
    }
  };

  // Trata o retorno do login (?conectado=1 / ?ml_erro=...) que o callback do
  // backend anexa na URL, e já limpa a query string pra não repetir o toast
  // se a pessoa der F5.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const erro = params.get('ml_erro');
    const conectado = params.get('conectado');

    if (erro) aviso.falha(MENSAGENS_ERRO[erro] ?? 'Não deu pra conectar com o Mercado Livre', 'Falha na conexão');
    else if (conectado) aviso.sucesso('Conta do Mercado Livre conectada');

    if (erro || conectado) window.history.replaceState(null, '', window.location.pathname);

    carregarStatus();
  }, []);

  const conectar = async () => {
    setConectando(true);
    try {
      const resultado = await mercadolivreApi.iniciarLogin();
      if (resultado.success && resultado.url) {
        window.location.href = resultado.url;
      } else {
        aviso.falha(resultado.error, 'Não deu pra iniciar o login');
        setConectando(false);
      }
    } catch (err) {
      aviso.falha(err, 'Não deu pra iniciar o login');
      setConectando(false);
    }
  };

  const desconectar = async () => {
    if (!confirmandoDesconexao) {
      setConfirmandoDesconexao(true);
      return;
    }
    setDesconectando(true);
    try {
      const resultado = await mercadolivreApi.desconectar();
      if (resultado.success) {
        setConta(null);
        aviso.sucesso('Conta desconectada');
      } else {
        aviso.falha(resultado.error, 'Não deu pra desconectar');
      }
    } catch (err) {
      aviso.falha(err, 'Não deu pra desconectar');
    } finally {
      setDesconectando(false);
      setConfirmandoDesconexao(false);
    }
  };

  const nomeExibicao = [conta?.first_name, conta?.last_name].filter(Boolean).join(' ') || conta?.nickname;
  const reputacao = conta?.seller_reputation;
  const transacoes = reputacao?.transactions;
  const metrics = reputacao?.metrics;

  // Tom por resultado: taxa oficial 0 é positivo (é o que conta pro nível da
  // conta), qualquer taxa acima de 0 é negativo — não existe "neutro" aqui
  // porque toda reclamação/atraso/cancelamento é, por definição, algo ruim.
  const tomPorTaxa = (rate: number | undefined): MetricTone => (rate ? 'negative' : 'positive');

  const ratingsData = transacoes?.ratings
    ? [
        { name: 'Positivas', value: transacoes.ratings.positive, cor: CORES_AVALIACAO.positivo },
        { name: 'Neutras', value: transacoes.ratings.neutral, cor: CORES_AVALIACAO.neutro },
        { name: 'Negativas', value: transacoes.ratings.negative, cor: CORES_AVALIACAO.negativo },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-5 pb-24 md:pb-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-medium text-text-primary">Mercado Livre</h1>
        <p className="text-sm text-text-faint mt-0.5">Dados da página, anúncios, etiquetas e mensagens — um módulo de cada vez</p>
      </div>

      <div className="rounded-card border border-border-subtle bg-surface-card p-5">
        {carregando ? (
          <div className="py-10 flex items-center justify-center text-text-faint">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : !conta ? (
          <EmptyState
            icone={Store}
            mensagem="Conecte a conta do Mercado Livre da loja pra ver os dados da página, os anúncios e o resto dos módulos."
            acaoLabel={conectando ? 'Abrindo o Mercado Livre...' : 'Conectar com Mercado Livre'}
            onAcao={conectando ? undefined : conectar}
          />
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-11 rounded-control bg-accent-soft-bg text-accent-soft-fg flex items-center justify-center shrink-0">
                  <Store size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-medium text-text-primary truncate">{nomeExibicao}</p>
                  <p className="text-xs text-text-faint truncate">@{conta.nickname}</p>
                </div>
              </div>
              {conta.permalink && (
                <a
                  href={conta.permalink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="shrink-0 h-9 px-3 rounded-control border border-border-default text-xs font-medium text-text-secondary hover:bg-surface-raised flex items-center gap-1.5"
                >
                  Ver página <ExternalLink size={13} />
                </a>
              )}
            </div>

            {reputacao && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <MetricCard icone={Award} label="Nível" valor={reputacao.level_id?.replace(/^\d_/, '') ?? '—'} tom="neutral" />
                <MetricCard
                  icone={CheckCircle2}
                  label="Vendas concluídas"
                  valor={String(transacoes?.completed ?? 0)}
                  contexto={transacoes?.total ? `de ${transacoes.total} no histórico` : undefined}
                  tom="positive"
                />
                <MetricCard
                  icone={XCircle}
                  label="Vendas canceladas"
                  valor={String(transacoes?.canceled ?? 0)}
                  contexto={transacoes?.total ? `${Math.round(((transacoes.canceled ?? 0) / transacoes.total) * 100)}% do histórico` : undefined}
                  tom={transacoes?.canceled ? 'negative' : 'positive'}
                />
                {metrics?.claims && (
                  <MetricCard
                    icone={AlertTriangle}
                    label={`Reclamações (${periodoPt(metrics.claims.period)})`}
                    valor={pct(metrics.claims.rate)}
                    contexto={metrics.claims.excluded?.real_value ? `${metrics.claims.excluded.real_value} registrada(s) ao todo` : undefined}
                    tom={tomPorTaxa(metrics.claims.rate)}
                  />
                )}
                {metrics?.delayed_handling_time && (
                  <MetricCard
                    icone={Clock}
                    label={`Atraso no envio (${periodoPt(metrics.delayed_handling_time.period)})`}
                    valor={pct(metrics.delayed_handling_time.rate)}
                    contexto={metrics.delayed_handling_time.excluded?.real_value ? `${metrics.delayed_handling_time.excluded.real_value} pedido(s) ao todo` : undefined}
                    tom={tomPorTaxa(metrics.delayed_handling_time.rate)}
                  />
                )}
                {metrics?.cancellations && (
                  <MetricCard
                    icone={XCircle}
                    label={`Cancelamentos (${periodoPt(metrics.cancellations.period)})`}
                    valor={pct(metrics.cancellations.rate)}
                    contexto={metrics.cancellations.excluded?.real_value ? `${metrics.cancellations.excluded.real_value} ao todo` : undefined}
                    tom={tomPorTaxa(metrics.cancellations.rate)}
                  />
                )}
              </div>
            )}

            {ratingsData.length > 0 && (
              <div className="rounded-control border border-border-subtle bg-surface-inset p-4">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-text-faint mb-3">Avaliações dos compradores</p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width={160} height={160} className="shrink-0">
                    <PieChart>
                      <Pie data={ratingsData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={3} stroke="none">
                        {ratingsData.map((entry) => (
                          <Cell key={entry.name} fill={entry.cor} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Legenda em lista — nunca flutuante sobre o gráfico */}
                  <ul className="flex-1 w-full space-y-2">
                    {ratingsData.map((entry) => (
                      <li key={entry.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 min-w-0 text-text-secondary">
                          <span className="size-2 rounded-full shrink-0" style={{ background: entry.cor }} />
                          <span className="truncate">{entry.name}</span>
                        </span>
                        <span className="text-text-primary font-medium shrink-0">{pct(entry.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
              <p className="text-xs text-text-faint">Próximos módulos (anúncios, etiquetas, mensagens) chegam aqui em seguida.</p>
              <button
                type="button"
                onClick={desconectar}
                disabled={desconectando}
                className="shrink-0 h-9 px-3 rounded-control border border-border-default text-xs font-medium text-danger hover:bg-danger-bg flex items-center gap-1.5 disabled:opacity-50"
              >
                {desconectando ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
                {confirmandoDesconexao ? 'Confirmar desconexão' : 'Desconectar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
