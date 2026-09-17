import { motion } from "motion/react"

// Shared choreography for the auth-page brand panel: the stack image fades
// in, then all four feature labels and their connector lines fade in
// together as a single group - not staggered one after another.
export const REVEAL_DELAY = 0.15
export const LABEL_DURATION = 0.4
export const LINE_DURATION = 0.4
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

// Thin traces from each feature block toward the stack image. Coordinates
// live on a 0-100 grid stretched over the feature row (preserveAspectRatio
// ="none"); non-scaling-stroke keeps the line weight constant despite that
// non-uniform stretch.
const CONNECTOR_PATHS = [
  "M24 18 C 34 18, 34 32, 42 32",
  "M24 82 C 34 82, 34 66, 42 66",
  "M76 18 C 66 18, 66 32, 58 32",
  "M76 82 C 66 82, 66 66, 58 66",
]
const CONNECTOR_END: [number, number][] = [
  [42, 32],
  [42, 66],
  [58, 32],
  [58, 66],
]

export type ConnectorLinesProps = {
  className?: string
  hoveredIndex: number | null
  play: boolean
}

export function ConnectorLines({ className, hoveredIndex, play }: ConnectorLinesProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {CONNECTOR_PATHS.map((d, i) => {
        const isHovered = hoveredIndex === i
        return (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke={isHovered ? "#93A5C4" : "#D4D9E2"}
            strokeWidth={isHovered ? 1.5 : 1}
            vectorEffect="non-scaling-stroke"
            initial={play ? { pathLength: 0, opacity: 0 } : false}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={
              play
                ? { delay: REVEAL_DELAY, duration: LINE_DURATION, ease: EASE_OUT }
                : { duration: 0.2 }
            }
          />
        )
      })}
      {CONNECTOR_END.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r={hoveredIndex === i ? 1.8 : 1.4}
          fill={hoveredIndex === i ? "#93A5C4" : "#D4D9E2"}
          initial={play ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={
            play
              ? { delay: REVEAL_DELAY + LINE_DURATION * 0.5, duration: 0.2 }
              : { duration: 0.2 }
          }
        />
      ))}
    </svg>
  )
}

export type AssemblyImageProps = {
  className?: string
  src: string
  hovered: boolean
  play: boolean
}

// The stack itself stays the real cropped photo (no vector redraw). Just a
// plain opacity fade-in - no rise, no scale, no positional "unboxing"
// motion. Hover stays equally restrained: a small brightness lift, no
// movement.
export function AssemblyImage({ className, src, hovered, play }: AssemblyImageProps) {
  return (
    <motion.img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      initial={play ? { opacity: 0 } : false}
      animate={{ opacity: 1, filter: hovered ? "brightness(1.04)" : "brightness(1)" }}
      transition={
        play
          ? { opacity: { duration: 0.6, ease: EASE_OUT }, filter: { duration: 0.25, ease: EASE_OUT } }
          : { duration: 0.2, ease: EASE_OUT }
      }
    />
  )
}
