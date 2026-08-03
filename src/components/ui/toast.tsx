// Avisos do sistema. Substitui os alert() nativos, que travavam a tela inteira
// e, no celular, viravam um popup do sistema operacional no meio do trabalho.
//
// Fica atrás de um wrapper (em vez de usar sonner direto nas telas) por dois
// motivos: as cores vêm do theme.css em vez de virem prontas da biblioteca, e
// trocar de biblioteca depois mexe num arquivo só.
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      // unstyled: sem isso a folha de estilo da própria lib vence as classes
      // abaixo e o aviso sai claro no meio do app escuro. Com ela desligada,
      // toda a aparência vem do theme.css.
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'group flex items-start gap-3 w-full rounded-card border border-border-default bg-surface-card px-4 py-3 text-sm text-text-primary shadow-2xl backdrop-blur-sm',
          content: 'flex-1 min-w-0',
          title: 'font-medium leading-snug',
          description: 'text-text-muted text-xs mt-0.5',
          icon: 'shrink-0 mt-0.5 flex items-center',
          actionButton:
            'shrink-0 self-center rounded-control bg-accent px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white hover:opacity-90',
          cancelButton: 'shrink-0 self-center rounded-control px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted',
          closeButton:
            'absolute -left-2 -top-2 size-5 rounded-full border border-border-default bg-surface-raised text-text-muted hover:text-text-primary flex items-center justify-center',
          // A borda colorida é o que carrega o significado — por isso cada
          // tom só muda ela, não o fundo (fundo colorido competiria com o
          // resto da tela).
          success: 'border-positive/40',
          error: 'border-danger/40',
          warning: 'border-warning/40',
          info: 'border-accent/40',
        },
      }}
      // 4s é curto pra ler um erro no meio do galpão com a mão suja de graxa.
      duration={5000}
      gap={8}
      offset={16}
      closeButton
    />
  );
}

interface OpcoesToast {
  descricao?: string;
  /** Botão à direita — use pra dar saída ao aviso, nunca só informar */
  acao?: { label: string; onClick: () => void };
  duracao?: number;
}

function montar({ descricao, acao, duracao }: OpcoesToast = {}) {
  return {
    description: descricao,
    duration: duracao,
    action: acao ? { label: acao.label, onClick: acao.onClick } : undefined,
  };
}

export const aviso = {
  sucesso: (mensagem: string, opcoes?: OpcoesToast) => sonnerToast.success(mensagem, montar(opcoes)),
  erro: (mensagem: string, opcoes?: OpcoesToast) => sonnerToast.error(mensagem, montar(opcoes)),
  atencao: (mensagem: string, opcoes?: OpcoesToast) => sonnerToast.warning(mensagem, montar(opcoes)),
  info: (mensagem: string, opcoes?: OpcoesToast) => sonnerToast.info(mensagem, montar(opcoes)),

  // Erro vindo de catch: normaliza o texto pra nunca aparecer "[object Object]"
  // nem um erro em inglês do fetch pra quem está usando o sistema.
  falha: (err: unknown, fallback = 'Algo deu errado. Tente de novo.') => {
    const mensagem = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
    sonnerToast.error(mensagem || fallback);
  },

  // Acompanha uma promessa do início ao fim — usado em salvar/excluir pra a
  // pessoa saber que a ação está em curso sem travar a interface.
  carregando: <T,>(promessa: Promise<T>, textos: { carregando: string; sucesso: string; erro?: string }) =>
    sonnerToast.promise(promessa, {
      loading: textos.carregando,
      success: textos.sucesso,
      error: (err: unknown) => (err instanceof Error ? err.message : textos.erro || 'Não foi possível concluir'),
    }),
};
