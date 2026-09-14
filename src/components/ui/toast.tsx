// Avisos do sistema. Substitui os alert() nativos, que travavam a tela inteira
// e, no celular, viravam um popup do sistema operacional no meio do trabalho.
//
// Fica atrás de um wrapper (em vez de usar sonner direto nas telas) por dois
// motivos: as cores vêm do theme.css em vez de virem prontas da biblioteca, e
// trocar de biblioteca depois mexe num arquivo só.
import { Suspense, lazy, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';

// Sparkles é ~1.7MB (@tsparticles) — carregado só quando alguém realmente
// passa withSparkles: true. Import estático aqui inflaria o bundle de toda
// tela que dispara um toast de sucesso comum, então fica atrás de
// React.lazy() e só entra na rede no primeiro toast que pedir o efeito.
const SparklesCoreLazy = lazy(() =>
  import('@/src/components/animate-ui/primitives/effects/sparkles').then((mod) => ({ default: mod.SparklesCore }))
);

function IconComSparkles({ icon }: { icon: ReactNode }) {
  return (
    <span className="relative inline-flex size-4 items-center justify-center">
      <span className="pointer-events-none absolute -inset-1.5 overflow-hidden rounded-full">
        <SparklesCoreLazy
          background="transparent"
          minSize={0.4}
          maxSize={1}
          particleDensity={60}
          particleColor="var(--color-positive)"
          className="h-full w-full"
        />
      </span>
      <span className="relative z-10">{icon}</span>
    </span>
  );
}

// Fallback do Suspense é o ícone puro (sem partículas) — enquanto o chunk
// de sparkles ainda não chegou, ou pra quem não pediu o efeito.
function iconeSucesso(withSparkles?: boolean) {
  if (!withSparkles) return undefined; // deixa o sonner usar o ícone padrão dele
  const iconeBase = <CheckCircle2 size={16} />;
  return (
    <Suspense fallback={iconeBase}>
      <IconComSparkles icon={iconeBase} />
    </Suspense>
  );
}

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
  /**
   * Opt-in: envolve o ícone de sucesso num efeito de partículas (Sparkles).
   * Carregado sob demanda (React.lazy) — só usar em momentos que merecem
   * destaque (ex: fechar uma venda), não em todo sucesso do dia a dia.
   */
  withSparkles?: boolean;
}

function montar({ descricao, acao, duracao }: OpcoesToast = {}) {
  return {
    description: descricao,
    duration: duracao,
    action: acao ? { label: acao.label, onClick: acao.onClick } : undefined,
  };
}

export const aviso = {
  sucesso: (mensagem: string, opcoes?: OpcoesToast) =>
    sonnerToast.success(mensagem, { ...montar(opcoes), icon: iconeSucesso(opcoes?.withSparkles) }),
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
