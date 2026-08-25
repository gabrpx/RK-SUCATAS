// Acesso às permissões do usuário logado no frontend. Fonte da verdade é o
// localStorage (gravado no login, ver Login.tsx) — permissões só mudam no
// próximo login, então ler uma vez por render (useMemo) é suficiente.
//
// O helper puro `pode(permissoes, isAdmin, 'tela.acao')` vive em
// src/constants/permissoes.ts (compartilhado com o backend); aqui só ligamos
// ele ao usuário atual.
import { useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { pode as podeBase, type Permissoes } from '../constants/permissoes';

// Espelha o bypass de dev de App.tsx/middleware/auth.ts: acesso via localhost
// (fora de plataforma nativa) é sempre admin, sem passar pelo login.
const IS_LOCALHOST =
  !Capacitor.isNativePlatform() && typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

export function lerPermissoesArmazenadas(): Permissoes {
  try {
    const raw = localStorage.getItem('user_permissoes');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Permissoes) : {};
  } catch {
    return {};
  }
}

export function ehAdminArmazenado(): boolean {
  if (IS_LOCALHOST) return true;
  try {
    const raw = localStorage.getItem('user_roles');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.includes('admin');
  } catch {
    return false;
  }
}

// Versão não-reativa (fora de componentes) — lê o localStorage na hora.
export function podeAtual(chave: string): boolean {
  return podeBase(lerPermissoesArmazenadas(), ehAdminArmazenado(), chave);
}

export interface UsePermissaoResult {
  isAdmin: boolean;
  permissoes: Permissoes;
  /** pode('tela.acao') — respeita admin (super) e a dependência de `<tela>.ver`. */
  pode: (chave: string) => boolean;
}

export function usePermissao(): UsePermissaoResult {
  return useMemo(() => {
    const isAdmin = ehAdminArmazenado();
    const permissoes = lerPermissoesArmazenadas();
    return { isAdmin, permissoes, pode: (chave: string) => podeBase(permissoes, isAdmin, chave) };
  }, []);
}
