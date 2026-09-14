// Tela de login: acesso restrito de admin via senha única (JWT, ver
// server.ts). Não há mais catálogo público nem estatísticas pré-login —
// este é um sistema interno.
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Wrench, KeyRound, User, Eye, EyeOff } from 'lucide-react';
import { fetchWithRetry, parseJson } from '../lib/apiClient';
import { Button } from './ui/button';
import { SPRING_MICRO, EASE_STANDARD } from './ui/motion';

interface LoginProps {
  onLogin: () => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Preencha usuário e senha.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetchWithRetry('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao entrar');
      }

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user_roles', JSON.stringify(data.user.roles));
      localStorage.setItem('user_permissoes', JSON.stringify(data.user.permissoes ?? {}));
      localStorage.setItem('user_name', data.user.nome_exibicao || data.user.username);
      localStorage.setItem('user_id', data.user.id);

      window.dispatchEvent(new CustomEvent('local-login-success', { detail: data.user }));
      onLogin();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface-page font-sans relative overflow-x-hidden flex items-center justify-center p-4">
      {/* Glow ambiente — só desktop: blur pesado é caro no WebView do Android
          (ver otimização mobile em index.css), então nem monta aqui embaixo de md. */}
      <div className="hidden md:block">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.12, 0.2, 0.12], x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] bg-gradient-accent-cta opacity-20 blur-[120px] rounded-full pointer-events-none"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_STANDARD }}
        className="w-full max-w-md bg-surface-card/90 md:bg-surface-card/80 md:backdrop-blur-xl rounded-card shadow-lg overflow-hidden border border-border-default/60 relative z-10"
      >
        {/* Realce de 1px no topo — o "barato" de profundidade (ver
            --gradient-surface-edge em theme.css), funciona igual em mobile. */}
        <div className="h-px w-full bg-gradient-surface-edge" />

        <div className="p-8 md:p-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="size-16 rounded-card bg-gradient-to-br from-accent-bright/35 to-accent/10 ring-1 ring-accent/25 shadow-lg shadow-accent/25 flex items-center justify-center mb-5">
              <Wrench className="text-accent-soft-fg" size={28} strokeWidth={1.75} />
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none">
              <span className="text-text-primary">RK</span>
              <span className="text-accent"> SUCATAS</span>
            </h1>
            <p className="text-text-muted text-sm font-medium mt-3">Controle de estoque, vendas e caixa</p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: EASE_STANDARD }}
                className="mb-4 p-3 rounded-control bg-danger-bg border border-danger/20 text-danger text-xs font-bold flex items-center gap-2"
              >
                <div className="w-1 h-1 bg-danger rounded-full shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-2xs font-bold text-text-muted uppercase tracking-wider ml-1">Usuário</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
                </div>
                <input
                  autoFocus
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full bg-surface-inset border border-border-default rounded-control pl-10 pr-4 py-3 text-sm text-text-primary placeholder-text-faint focus:outline-none focus:border-accent/60 focus:ring-[3px] focus:ring-accent/25 transition-colors duration-base font-medium"
                  placeholder="seu.usuario"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-2xs font-bold text-text-muted uppercase tracking-wider ml-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-inset border border-border-default rounded-control pl-10 pr-10 py-3 text-sm text-text-primary placeholder-text-faint focus:outline-none focus:border-accent/60 focus:ring-[3px] focus:ring-accent/25 transition-colors duration-base font-medium"
                  placeholder="••••••••"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-secondary transition-colors duration-fast"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <motion.div whileTap={{ scale: 0.98 }} transition={SPRING_MICRO}>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-auto py-3.5 rounded-control font-black uppercase tracking-widest bg-gradient-accent-cta hover:brightness-110 gap-2.5 shadow-[0_0_24px_var(--color-accent-shadow)] text-xs transition-[filter] duration-base"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Entrar no Sistema'}
                </Button>
              </motion.div>
            </div>
          </form>

          <div className="mt-8 pt-4 border-t border-border-default/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 bg-positive rounded-full animate-pulse shadow-[0_0_8px_var(--color-positive-shadow)]" />
              <span className="text-3xs font-bold text-text-faint uppercase tracking-wider">Servidor Administrativo Privado</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
