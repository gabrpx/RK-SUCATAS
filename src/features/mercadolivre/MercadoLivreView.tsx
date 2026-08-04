// Aba Mercado Livre — por enquanto só o primeiro módulo: conectar a conta da
// loja via OAuth e mostrar os dados básicos da página (nome, reputação).
// Os próximos módulos (anúncios, etiquetas, mensagens) entram aqui como
// blocos novos, um de cada vez, todos reaproveitando a mesma conexão.
import { useEffect, useState } from 'react';
import { Store, Loader2, ExternalLink, Star, Award, Unlink } from 'lucide-react';
import { aviso } from '../../components/ui/toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { mercadolivreApi, type MercadoLivreConta } from './api';

// Erros que o callback do backend pode mandar de volta na query string —
// texto amigável pra cada um, o resto cai no genérico.
const MENSAGENS_ERRO: Record<string, string> = {
  estado_invalido: 'O login expirou ou foi aberto de outra aba. Tente conectar de novo.',
  troca_token: 'O Mercado Livre recusou a autorização. Tente conectar de novo.',
};

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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-control border border-border-subtle bg-surface-inset p-3">
                  <div className="flex items-center gap-1.5 text-text-faint mb-1">
                    <Award size={13} />
                    <span className="text-[10px] uppercase font-medium tracking-wide">Nível</span>
                  </div>
                  <p className="text-sm font-medium text-text-primary">{reputacao.level_id?.replace('5_', '') ?? '—'}</p>
                </div>
                <div className="rounded-control border border-border-subtle bg-surface-inset p-3">
                  <div className="flex items-center gap-1.5 text-text-faint mb-1">
                    <Star size={13} />
                    <span className="text-[10px] uppercase font-medium tracking-wide">Vendas completas</span>
                  </div>
                  <p className="text-sm font-medium text-text-primary">{reputacao.transactions?.completed ?? 0}</p>
                </div>
                <div className="rounded-control border border-border-subtle bg-surface-inset p-3">
                  <div className="text-text-faint mb-1">
                    <span className="text-[10px] uppercase font-medium tracking-wide">Avaliações positivas</span>
                  </div>
                  <p className="text-sm font-medium text-positive">{reputacao.transactions?.ratings?.positive != null ? `${Math.round(reputacao.transactions.ratings.positive * 100)}%` : '—'}</p>
                </div>
                <div className="rounded-control border border-border-subtle bg-surface-inset p-3">
                  <div className="text-text-faint mb-1">
                    <span className="text-[10px] uppercase font-medium tracking-wide">Reclamações</span>
                  </div>
                  <p className="text-sm font-medium text-negative">{reputacao.transactions?.ratings?.negative != null ? `${Math.round(reputacao.transactions.ratings.negative * 100)}%` : '—'}</p>
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
