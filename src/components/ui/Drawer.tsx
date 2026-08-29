// Alias semântico do Sheet com side='right' fixo — pra formulário longo
// (ex: novo cliente, editar peça) onde "gaveta lateral" comunica melhor a
// intenção que "sheet" genérico. Sem lógica própria: repassa tudo pro Sheet.
import * as React from 'react';
import { Sheet } from './Sheet';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Drawer(props: DrawerProps) {
  return <Sheet {...props} side="right" />;
}
