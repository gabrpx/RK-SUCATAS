import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/src/utils"
import {
  RippleButton,
  RippleButtonRipples,
} from "@/src/components/animate-ui/primitives/buttons/ripple"
import { Magnetic } from "@/src/components/animate-ui/primitives/effects/magnetic"

const RippleButtonCompat = RippleButton as React.ComponentType<any>

// outline/ghost usam bg-surface-raised/text-text-primary em vez do
// hover:bg-accent padrão do shadcn: "accent" aqui colidiria com o token de
// marca (ver comentário em theme.css). dark: removido — o app não tem modo
// claro, <html> já nasce com o tema escuro fixo.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary/90",
        destructive: "bg-destructive text-surface-page hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline: "border bg-background shadow-xs hover:bg-surface-raised hover:text-text-primary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-surface-raised hover:text-text-primary",
        link: "text-primary underline-offset-4 hover:underline",
        // Único CTA preenchido por tela (ver CLAUDE.md > Design system):
        // gradiente de marca + ripple (toque) + magnetic (hover desktop).
        "accent-cta":
          "text-white bg-[image:var(--gradient-accent-cta)] hover:brightness-110 shadow-elevation-2 hover:shadow-glow-accent transition-all",
        positive: "bg-positive text-surface-page hover:bg-positive/90",
        soft: "bg-accent-soft-bg text-accent-soft-fg hover:bg-accent-soft-bg/80",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-control px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-control px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-control px-6 has-[>svg]:px-4",
        // Alvo de toque confortável (~44px) pras telas mobile-first.
        mobile: "h-11 px-4 text-base has-[>svg]:px-3",
        icon: "size-9",
        "icon-xs": "size-6 rounded-control [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  // accent-cta é o único CTA preenchido por tela: ganha ripple ao toque e
  // magnetic hover no desktop (Magnetic já desliga sozinho em ponteiro
  // "coarse", então mobile fica só com o ripple). asChild não compõe com o
  // wrapper — nesse caso cai no <Comp> comum abaixo, sem ripple/magnetic.
  if (variant === "accent-cta" && !asChild) {
    return (
      <Magnetic strength={0.15} disableOnTouch>
        <RippleButtonCompat
          data-slot="button"
          data-variant={variant}
          data-size={size}
          className={cn(buttonVariants({ variant, size, className }))}
          {...props}
        >
          {children}
          <RippleButtonRipples color="var(--text-primary)" />
        </RippleButtonCompat>
      </Magnetic>
    )
  }

  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
