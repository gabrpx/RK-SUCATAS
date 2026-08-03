// Tela de login: acesso restrito de admin via senha única (JWT, ver
// server.ts). Não há mais catálogo público nem estatísticas pré-login —
// este é um sistema interno.
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Wrench, KeyRound, User, Eye, EyeOff } from 'lucide-react';
import { fetchWithRetry, parseJson } from '../lib/apiClient';

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
      localStorage.setItem('user_role', data.user.role);
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
    <div className="min-h-screen bg-[#09090b] font-sans relative overflow-x-hidden flex items-center justify-center p-4">
      <div className="hidden md:block">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1], x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-violet-600/20 blur-[120px] rounded-full pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1], x: [0, -60, 0], y: [0, 40, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl rounded-[2rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden border border-zinc-800/50 relative z-10"
      >
        <div className="p-8 md:p-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center mb-4">
              <Wrench className="text-violet-400" size={26} />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
              <span className="text-white">RK</span>
              <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent"> SUCATAS</span>
            </h1>
            <p className="text-zinc-500 text-xs font-medium mt-2">Controle de estoque, vendas e caixa</p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2"
              >
                <div className="w-1 h-1 bg-red-500 rounded-full shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Usuário</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-zinc-500" />
                </div>
                <input
                  autoFocus
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all font-medium"
                  placeholder="seu.usuario"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-4 w-4 text-zinc-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all font-medium"
                  placeholder="••••••••"
                  minLength={6}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-600 to-blue-600 text-white py-3.5 rounded-xl font-black uppercase tracking-widest hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-[0_0_20px_rgba(139,92,246,0.2)] disabled:opacity-50 text-xs"
              >
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Entrar no Sistema'}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-4 border-t border-zinc-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Servidor Administrativo Privado</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
