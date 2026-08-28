import { useState } from 'react';
import { motion } from 'motion/react';
import { ScrollText } from 'lucide-react';
import { DeclaracaoVendaModal } from './DeclaracaoVendaModal';

export function FloatingNotaButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <style>{`
        @keyframes declaracao-fab-pulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--color-accent-shadow); }
          50% { box-shadow: 0 0 0 6px transparent; }
        }
        @media (max-width: 767px) {
          @keyframes declaracao-fab-pulse {
            0%, 100% { filter: brightness(1); box-shadow: none; }
            50% { filter: brightness(1.12); box-shadow: none; }
          }
        }
      `}</style>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="size-12 md:size-14 !rounded-full bg-gradient-accent-cta text-white shadow-xl flex items-center justify-center [animation:declaracao-fab-pulse_2s_ease-in-out_infinite]"
        aria-label="Nova Declaração de Venda"
      >
        <ScrollText size={22} />
      </motion.button>
      <DeclaracaoVendaModal open={open} onOpenChange={setOpen} />
    </>
  );
}
