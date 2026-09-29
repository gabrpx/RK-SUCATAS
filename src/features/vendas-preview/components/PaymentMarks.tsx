import { Banknote, CreditCard, Handshake } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CanalVendaDemo, MeioPagamentoDemo } from "../data";

export function PixMark({ className = "size-4" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2.7 16.3 7 12 11.3 7.7 7 12 2.7Z" />
    <path d="m21.3 12-4.3 4.3-4.3-4.3 4.3-4.3 4.3 4.3Z" />
    <path d="m12 21.3-4.3-4.3 4.3-4.3 4.3 4.3-4.3 4.3Z" />
    <path d="M2.7 12 7 7.7l4.3 4.3L7 16.3 2.7 12Z" />
  </svg>;
}

const paymentIcons: Record<MeioPagamentoDemo, LucideIcon | null> = {
  Pix: null,
  Dinheiro: Banknote,
  "Cartão de débito": CreditCard,
  "Cartão de crédito": CreditCard,
};

export function PaymentMethodMark({ meio, className = "size-4" }: { meio: MeioPagamentoDemo; className?: string }) {
  const Icon = paymentIcons[meio];
  return Icon ? <Icon aria-hidden="true" className={className} strokeWidth={1.8} /> : <PixMark className={className} />;
}

export function MercadoLivreBadge({ canal, compact = false }: { canal: CanalVendaDemo; compact?: boolean }) {
  if (canal !== "Mercado Livre") return <span className="text-[10px] font-medium text-text-faint">{canal}</span>;
  return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-50 px-2 py-1 font-semibold text-slate-700 ${compact ? "text-[9px]" : "text-[10px]"}`}>
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#ffe600] text-[#1b3a8a]"><Handshake size={12} strokeWidth={2.2} /></span>
    Mercado Livre
  </span>;
}
