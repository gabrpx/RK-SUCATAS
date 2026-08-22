"use client"

import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"
import {
  AnimatePresence,
  HTMLMotionProps,
  motion,
  TargetAndTransition,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react"
import useMeasure from "react-use-measure"

import { cn } from "../../utils"

const springConfig = { stiffness: 200, damping: 20, bounce: 0.2 }

interface ExpandableContextType {
  isExpanded: boolean // Indicates whether the component is expanded
  toggleExpand: () => void // Function to toggle the expanded state
  expandDirection: "vertical" | "horizontal" | "both" // Direction of expansion
  expandBehavior: "replace" | "push" // How the expansion affects surrounding content
  transitionDuration: number // Duration of the expansion/collapse animation
  easeType:
    | "easeInOut"
    | "easeIn"
    | "easeOut"
    | "linear"
    | [number, number, number, number] // Easing function for the animation
  initialDelay: number // Delay before the animation starts
  onExpandEnd?: () => void // Callback function when expansion ends
  onCollapseEnd?: () => void // Callback function when collapse ends
}

// Create a context with default values
const ExpandableContext = createContext<ExpandableContextType>({
  isExpanded: false,
  toggleExpand: () => {},
  expandDirection: "vertical", // 'vertical' | 'horizontal' | 'both' // Direction of expansion
  expandBehavior: "replace", // How the expansion affects surrounding content
  transitionDuration: 0.3, // Duration of the expansion/collapse animation
  easeType: "easeInOut" as const, // Easing function for the animation
  initialDelay: 0,
})

// Custom hook to use the ExpandableContext
const useExpandable = () => useContext(ExpandableContext)

type ExpandablePropsBase = Omit<HTMLMotionProps<"div">, "children">

interface ExpandableProps extends ExpandablePropsBase {
  children: ReactNode | ((props: { isExpanded: boolean }) => ReactNode)
  expanded?: boolean
  onToggle?: () => void
  transitionDuration?: number
  easeType?:
    | "easeInOut"
    | "easeIn"
    | "easeOut"
    | "linear"
    | [number, number, number, number]
  expandDirection?: "vertical" | "horizontal" | "both"
  expandBehavior?: "replace" | "push"
  initialDelay?: number
  onExpandStart?: () => void
  onExpandEnd?: () => void
  onCollapseStart?: () => void
  onCollapseEnd?: () => void
}
// ROOT Expand component
const Expandable = React.forwardRef<HTMLDivElement, ExpandableProps>(
  (
    {
      children,
      expanded,
      onToggle,
      transitionDuration = 0.3,
      easeType = "easeInOut" as const,
      expandDirection = "vertical",
      expandBehavior = "replace",
      initialDelay = 0,
      onExpandStart,
      onExpandEnd,
      onCollapseStart,
      onCollapseEnd,
      ...props
    }: ExpandableProps,
    ref
  ) => {
    // Internal state for expansion when the component is uncontrolled
    const [isExpandedInternal, setIsExpandedInternal] = useState(false)

    // Use the provided expanded prop if available, otherwise use internal state
    const isExpanded = expanded !== undefined ? expanded : isExpandedInternal

    // Use the provided onToggle function if available, otherwise use internal toggle function
    const toggleExpand =
      onToggle || (() => setIsExpandedInternal((prev) => !prev))

    // Effect to call onExpandStart or onCollapseStart when isExpanded changes
    useEffect(() => {
      if (isExpanded) {
        onExpandStart?.()
      } else {
        onCollapseStart?.()
      }
    }, [isExpanded, onExpandStart, onCollapseStart])

    // Create the context value to be provided to child components
    const contextValue: ExpandableContextType = {
      isExpanded,
      toggleExpand,
      expandDirection,
      expandBehavior,
      transitionDuration,
      easeType,
      initialDelay,
      onExpandEnd,
      onCollapseEnd,
    }

    return (
      <ExpandableContext.Provider value={contextValue}>
        <motion.div
          ref={ref}
          initial={false}
          transition={{
            duration: transitionDuration,
            ease: easeType,
            delay: initialDelay,
          }}
          {...props}
        >
          {/* Render children as a function if provided, otherwise render as is */}
          {typeof children === "function" ? children({ isExpanded }) : children}
        </motion.div>
      </ExpandableContext.Provider>
    )
  }
)

// Simplify animation types
type AnimationPreset = {
  initial: { [key: string]: any }
  animate: { [key: string]: any }
  exit: { [key: string]: any }
}

// Update ANIMATION_PRESETS type
const ANIMATION_PRESETS: Record<string, AnimationPreset> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  "slide-up": {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  "slide-down": {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  "slide-left": {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  "slide-right": {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
  },
  rotate: {
    initial: { opacity: 0, rotate: -10 },
    animate: { opacity: 1, rotate: 0 },
    exit: { opacity: 0, rotate: -10 },
  },
  "blur-sm": {
    initial: { opacity: 0, filter: "blur(4px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    exit: { opacity: 0, filter: "blur(4px)" },
  },
  "blur-md": {
    initial: { opacity: 0, filter: "blur(8px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    exit: { opacity: 0, filter: "blur(8px)" },
  },
  "blur-lg": {
    initial: { opacity: 0, filter: "blur(16px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    exit: { opacity: 0, filter: "blur(16px)" },
  },
}

// Props for defining custom animations
interface AnimationProps {
  initial?: TargetAndTransition
  animate?: TargetAndTransition
  exit?: TargetAndTransition
  transition?: any
}

// Inside ExpandableContent component
const getAnimationProps = (
  preset: keyof typeof ANIMATION_PRESETS | undefined,
  animateIn?: AnimationProps,
  animateOut?: AnimationProps
) => {
  const defaultAnimation = {
    initial: {},
    animate: {},
    exit: {},
  }

  const presetAnimation = preset ? ANIMATION_PRESETS[preset] : defaultAnimation

  return {
    initial: presetAnimation.initial,
    animate: presetAnimation.animate,
    exit: animateOut?.exit || presetAnimation.exit,
  }
}

// Wrap this around items in the card that you want to be hidden then animated in on expansion
const ExpandableContent = React.forwardRef<
  HTMLDivElement,
  Omit<HTMLMotionProps<"div">, "ref"> & {
    preset?: keyof typeof ANIMATION_PRESETS
    animateIn?: AnimationProps
    animateOut?: AnimationProps
    stagger?: boolean
    staggerChildren?: number
    keepMounted?: boolean
  }
>(
  (
    {
      children,
      preset,
      animateIn,
      animateOut,
      stagger = false,
      staggerChildren = 0.1,
      keepMounted = false,
      ...props
    },
    ref
  ) => {
    const { isExpanded, transitionDuration, easeType } = useExpandable()
    // useMeasure is used to measure the height of the content
    const [measureRef, { height: measuredHeight }] = useMeasure()
    // useMotionValue creates a value that can be animated smoothly
    const animatedHeight = useMotionValue(0)
    // Refino local (não faz parte do componente original do Cult UI): com
    // `prefers-reduced-motion` a altura troca de uma vez, sem percorrer o
    // caminho — o conteúdo continua aparecendo, só não desliza.
    const reduce = useReducedMotion()
    // useSpring applies a spring animation to the height value
    const smoothHeight = useSpring(
      animatedHeight,
      reduce ? { duration: 0 } : springConfig
    )

    useEffect(() => {
      // Animate the height based on whether the content is expanded or collapsed
      if (isExpanded) {
        animatedHeight.set(measuredHeight)
      } else {
        animatedHeight.set(0)
      }
    }, [isExpanded, measuredHeight, animatedHeight])

    const animationProps = getAnimationProps(preset, animateIn, animateOut)

    return (
      // This motion.div animates the height of the content
      <motion.div
        ref={ref}
        style={{
          height: smoothHeight,
          overflow: "hidden",
        }}
        transition={{ duration: reduce ? 0 : transitionDuration, ease: easeType }}
        {...props}
      >
        {/* AnimatePresence handles the entering and exiting of components */}
        <AnimatePresence initial={false}>
          {(isExpanded || keepMounted) && (
            // This motion.div handles the animation of the content itself
            <motion.div
              ref={measureRef}
              initial={animationProps.initial}
              animate={animationProps.animate}
              exit={animationProps.exit}
              transition={{ duration: reduce ? 0 : transitionDuration, ease: easeType }}
            >
              {stagger ? (
                // If stagger is true, we apply a staggered animation to the children
                <motion.div
                  variants={{
                    hidden: {},
                    visible: {
                      transition: {
                        staggerChildren: staggerChildren,
                      },
                    },
                  }}
                  initial="hidden"
                  animate="visible"
                >
                  {React.Children.map(
                    children as React.ReactNode,
                    (child, index) => (
                      <motion.div
                        key={`${child?.toLocaleString}-${index}`}
                        variants={{
                          hidden: { opacity: 0, y: 20 },
                          visible: { opacity: 1, y: 0 },
                        }}
                      >
                        {child}
                      </motion.div>
                    )
                  )}
                </motion.div>
              ) : (
                children
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }
)

// I'm telling you we just have to expand 🤌💵
const ExpandableTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, className, ...props }, ref) => {
  const { toggleExpand } = useExpandable()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      toggleExpand()
    }
  }

  return (
    <div
      ref={ref}
      onClick={toggleExpand}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Toggle expand"
      className={cn("cursor-pointer", className)}
      {...props}
    >
      {children}
    </div>
  )
})

ExpandableTrigger.displayName = "ExpandableTrigger"

export {
  Expandable,
  useExpandable,
  ExpandableContent,
  ExpandableContext,
  ExpandableTrigger,
}
