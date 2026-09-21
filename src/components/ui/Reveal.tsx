import * as React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/src/utils';
import { useMotionTier } from './hooks/useMotionTier';
import { EASE_STANDARD } from './motion';

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  stagger?: number;
  className?: string;
}

export function Reveal({ children, delay = 0, stagger, className }: RevealProps) {
  const tier = useMotionTier();
  if (tier === 'reduced') return <div className={className}>{children}</div>;

  if (stagger && Array.isArray(children)) {
    return (
      <motion.div
        className={cn(className)}
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      >
        {React.Children.map(children, (child, i) => (
          <motion.div
            key={i}
            variants={{
              hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
              show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: EASE_STANDARD as any } },
            }}
          >
            {child}
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.7, delay, ease: EASE_STANDARD as any }}
    >
      {children}
    </motion.div>
  );
}
