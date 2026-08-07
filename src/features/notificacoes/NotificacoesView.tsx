// Aba "Notificações": ativar push neste dispositivo + gerenciar os
// dispositivos já inscritos. Visível a ALL_ROLES (ver TAB_ROLES em
// src/constants/roles.ts) — é aqui, e não em Configurações (admin/equipe
// só), que Pitoco (mandados) e Itinho (mecanico) conseguem ativar a
// notificação de tarefa nova atribuída a eles.
import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, Smartphone, Trash2 } from 'lucide-react';
import { cn } from '../../utils';
import { formatDateRelative } from '../../utils';
import { EmptyState } from '../../components/ui/EmptyState';
import { aviso } from '../../components/ui/toast';
import { ativarPushNesteDispositivo, suportaWebPush } from '../../services/pushClient';
import { notificacoesApi } from './api';
import type { PushSubscriptionResumo } from './types';

const TIPO_LABEL: Record<PushSubscriptionResumo['tipo'], string> = { web: 'Navegador', fcm: 'Celular (app)' };

export function NotificacoesView() {
  const [subscriptions, setSubscriptions] = useState<PushSubscriptionResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ativando, setAtivando] = useState(false);
  const [permissaoNegada, setPermissaoNegada] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const resultado = await notificacoesApi.listarSubscriptions();
      // A API pode responder 200 com { success:false, error } quando a
      // migration_039 (tabela push_subscriptions) ainda não rodou no
      // Supabase — degrada pra lista vazia em vez de quebrar a tela.
      setSubscriptions(resultado.success ? resultado.data : []);
    } catch (err) {
      console.error('Erro ao carregar subscriptions:', err);
      setSubscriptions([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    if (typeof Notification !== 'undefined') setPermissaoNegada(Notification.permission === 'denied');
  }, []);

  const handleAtivar = async () => {
    setAtivando(true);
    const resultado = await ativarPushNesteDispositivo();
    setAtivando(false);

    if (resultado.success) {
      aviso.sucesso('Notificações ativadas neste dispositivo.');
      carregar();
      return;
    }
    if (!('motivo' in resultado)) return;

    if (resultado.motivo === 'sem_suporte') {
      aviso.erro('Este navegador não suporta notificações push.');
    } else if (resultado.motivo === 'permissao_negada') {
      setPermissaoNegada(true);
      aviso.atencao('Permissão de notificação negada pelo navegador.');
    } else {
      aviso.erro('Não foi possível ativar as notificações. Tente novamente.');
    }
  };

  const handleToggleAtivo = async (sub: PushSubscriptionResumo) => {
    const novoValor = !sub.ativo;
    setSubscriptions((prev) => prev.map((s) => (s.id === sub.id ? { ...s, ativo: novoValor } : s)));
    try {
      await notificacoesApi.atualizarAtivo(sub.id, novoValor);
    } catch (err) {
      console.error('Erro ao atualizar subscription:', err);
      setSubscriptions((prev) => prev.map((s) => (s.id === sub.id ? { ...s, ativo: sub.ativo } : s)));
      aviso.erro('Não foi possível atualizar este dispositivo.');
    }
  };

  const handleRemover = async (sub: PushSubscriptionResumo) => {
    setSubscriptions((prev) => prev.filter((s) => s.id !== sub.id));
    try {
      await notificacoesApi.remover(sub.id);
    } catch (err) {
      console.error('Erro ao remover subscription:', err);
      aviso.erro('Não foi possível remover este dispositivo.');
      carregar();
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-medium text-text-primary">Notificações</h1>
        <p className="text-sm text-text-faint mt-0.5">Receba avisos do sistema mesmo com o navegador fechado</p>
      </div>

      <div className="bg-surface-card border border-border-subtle rounded-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-control bg-accent-soft-bg flex items-center justify-center text-accent-soft-fg shrink-0">
            <BellRing size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">Este dispositivo</p>
            <p className="text-xs text-text-faint">Ativa notificações de tarefa nova e alertas do sistema aqui.</p>
          </div>
        </div>

        {!suportaWebPush() ? (
          <p className="text-xs text-text-faint">Este navegador não suporta notificações push.</p>
        ) : permissaoNegada ? (
          <p className="text-xs text-warning">
            Notificações bloqueadas para este site. Pra reativar, abra as configurações do navegador (ícone de cadeado ao lado do endereço) e permita notificações.
          </p>
        ) : (
          <button
            type="button"
            onClick={handleAtivar}
            disabled={ativando}
            className="flex items-center justify-center gap-2 w-full rounded-control bg-accent text-white text-sm font-medium py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {ativando ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
            Ativar notificações neste dispositivo
          </button>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.04em] text-text-faint">Dispositivos ativos</h2>

        {carregando ? (
          <div className="flex justify-center py-8">
            <Loader2 size={18} className="animate-spin text-text-faint" />
          </div>
        ) : subscriptions.length === 0 ? (
          <EmptyState icone={BellOff} mensagem="Nenhum dispositivo com notificação ativada ainda." />
        ) : (
          <div className="bg-surface-card border border-border-subtle rounded-card divide-y divide-border-subtle overflow-hidden">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center gap-3 px-4 py-3">
                <Smartphone size={16} className="text-text-faint shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary truncate">{sub.user_agent || TIPO_LABEL[sub.tipo]}</p>
                  <p className="text-[11px] text-text-faint">
                    {TIPO_LABEL[sub.tipo]} · adicionado {formatDateRelative(sub.criado_em)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleAtivo(sub)}
                  className={cn(
                    'shrink-0 px-2.5 py-1 rounded-badge text-[10px] font-semibold uppercase tracking-wide transition-colors',
                    sub.ativo ? 'bg-positive-bg text-positive' : 'bg-surface-inset text-text-muted'
                  )}
                >
                  {sub.ativo ? 'Ativo' : 'Pausado'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemover(sub)}
                  className="shrink-0 p-1.5 rounded-control text-text-faint hover:text-danger hover:bg-danger-bg transition-colors"
                  title="Remover dispositivo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
