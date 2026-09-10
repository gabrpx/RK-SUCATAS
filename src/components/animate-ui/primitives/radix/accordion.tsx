'use client';

// Portado do animate-ui (variante Radix UI). API flexível com conteúdo dinâmico
// — diferença do Accordion.tsx existente que tem lista fixa de itens.
// Animação de altura via Motion (motion/react) no nível do component wrapper.
import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { motion, useReducedMotion, type Transition } from 'motion/react';

type AccordionProps =
  | (React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root> & { type: 'single' })
  | (React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root> & { type: 'multiple' });

function Accordion(props: AccordionProps) {
  return <AccordionPrimitive.Root data-slot="accordion" {...(props as any)} />;
}

type AccordionItemProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>;

function AccordionItem(props: AccordionItemProps) {
  return <AccordionPrimitive.Item data-slot="accordion-item" {...props} />;
}

type AccordionTriggerProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>;

function AccordionTrigger(props: AccordionTriggerProps) {
  return <AccordionPrimitive.Trigger data-slot="accordion-trigger" {...props} />;
}

// Radix expõe --radix-accordion-content-height como CSS var quando o item está
// aberto. Usamos forceMount + motion para animar height 0 → auto com spring.
//
// Content NÃO usa asChild: Radix escreve estilo inline próprio (CSS vars +
// transition-duration/animation-name durante a medição síncrona de altura) no
// nó que ele controla. Com asChild esse nó é o MESMO motion.div que o Motion
// anima via DOM direto — as duas escritas de `style` colidem e o conteúdo fica
// preso em height:0/opacity:0 mesmo com data-state="open" (reproduzido com
// conteúdo mais alto, como a galeria de fotos do grupo de família no Estoque).
// Deixando o Content renderizar seu próprio wrapper e o motion.div como filho
// (nó DOM separado), cada sistema mexe só no que é seu.
type AccordionContentProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> & {
  transition?: Transition;
};

function AccordionContent({
  children,
  transition,
  ...props
}: AccordionContentProps) {
  const reduce = useReducedMotion();
  const defaultTransition: Transition = reduce
    ? { duration: 0 }
    : { type: 'spring', stiffness: 300, damping: 30, bounce: 0 };
  const t = transition ?? defaultTransition;

  return (
    <AccordionPrimitive.Content forceMount {...props}>
      <AnimatedAccordionContent transition={t}>
        {children}
      </AnimatedAccordionContent>
    </AccordionPrimitive.Content>
  );
}

// Componente interno que lê data-state do wrapper que o Radix Content
// controla (elemento pai direto, já que Content não é mais asChild) para
// animar com Motion, sem disputar o mesmo nó DOM com o Radix.
function AnimatedAccordionContent({
  children,
  transition,
  ...rest
}: {
  children: React.ReactNode;
  transition: Transition;
  [k: string]: any;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;

    const check = () => setIsOpen(parent.getAttribute('data-state') === 'open');

    check();
    const mo = new MutationObserver(check);
    mo.observe(parent, { attributes: true, attributeFilter: ['data-state'] });
    return () => mo.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      data-slot="accordion-content"
      animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
      transition={transition}
      style={{ overflow: 'hidden' }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  type AccordionProps,
  type AccordionItemProps,
  type AccordionTriggerProps,
  type AccordionContentProps,
};
