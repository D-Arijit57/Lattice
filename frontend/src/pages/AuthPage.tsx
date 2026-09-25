import { useState, type FormEvent } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { Mail, Lock, Eye, EyeOff, ArrowRight, Box, Grid3x3, FileText, Link2 } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"
import { ApiError } from "@/lib/api"
import {
  AssemblyImage,
  ConnectorLines,
  REVEAL_DELAY,
  LABEL_DURATION,
  EASE_OUT,
} from "@/components/auth/AssemblyGraphic"
import authStack from "@/assets/auth-stack.png"

function GithubIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12c0-6.27-5.23-11.5-11.5-11.5Z"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.25v3.1A11.998 11.998 0 0 0 12 24Z"/>
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.25A12 12 0 0 0 0 12c0 1.94.46 3.77 1.25 5.38l4.02-3.1Z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.25 6.62l4.02 3.1C6.22 6.86 8.87 4.75 12 4.75Z"/>
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 23 23">
      <rect x="1" y="1" width="10" height="10" fill="#F35325"/>
      <rect x="12" y="1" width="10" height="10" fill="#81BC06"/>
      <rect x="1" y="12" width="10" height="10" fill="#05A6F0"/>
      <rect x="12" y="12" width="10" height="10" fill="#FFBA08"/>
    </svg>
  )
}

// All text is real markup (Geist Sans/Mono, same as the rest of the app).
// The stack is an animated SVG (AssemblyGraphic) rather than a static image
// so each of its four layers can rise into place on its own - see that
// file for the assembly choreography shared with the FeatureBlock reveals
// below.
function BrandPanel() {
  const prefersReducedMotion = useReducedMotion()
  const play = !prefersReducedMotion
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div
      className="hidden lg:flex lg:w-1/2 flex-col bg-neutral-50 border-r border-neutral-200 px-8 xl:px-16 py-10 xl:py-12 relative overflow-hidden"
      style={{
        backgroundImage: "radial-gradient(circle, #00000009 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div>
        <h1 className="font-logo text-4xl text-neutral-900 leading-none">Lattice</h1>
        <p className="text-xs font-mono text-neutral-500 mt-2">Composable Data Engine</p>
      </div>

      <div className="mt-10 xl:mt-12">
        <div className="text-xs font-mono text-neutral-400">v1.0.0</div>
        <div className="w-6 h-0.5 bg-neutral-300 mt-2" />
      </div>

      <div className="mt-8 xl:mt-10">
        <h2 className="font-display text-4xl xl:text-6xl font-semibold tracking-tight text-neutral-900 leading-[1.05] mb-4">
          Your data,<br />your way.
        </h2>
        <p className="text-neutral-500 max-w-sm mb-8 xl:mb-10">
          Define structured data once, and use it everywhere.
        </p>

        <div className="relative grid grid-cols-[1fr_auto_1fr] gap-2 xl:gap-6 items-center">
          <ConnectorLines
            className="absolute inset-0 w-full h-full"
            hoveredIndex={hoveredIndex}
            play={play}
          />
          <div className="relative z-10 space-y-6 xl:space-y-8 min-w-0">
            <FeatureBlock
              index={0}
              side="left"
              icon={Box}
              title="Content Types"
              items={["Products", "Customers", "Orders"]}
              hoveredIndex={hoveredIndex}
              onHover={setHoveredIndex}
              play={play}
            />
            <FeatureBlock
              index={1}
              side="left"
              icon={Grid3x3}
              title="Schema"
              items={["Fields", "Validation", "Versions"]}
              hoveredIndex={hoveredIndex}
              onHover={setHoveredIndex}
              play={play}
            />
          </div>
          <AssemblyImage
            src={authStack}
            className="relative z-10 w-36 h-auto xl:w-44 shrink-0 select-none"
            hovered={hoveredIndex !== null}
            play={play}
          />
          <div className="relative z-10 space-y-6 xl:space-y-8 min-w-0">
            <FeatureBlock
              index={2}
              side="right"
              icon={FileText}
              title="Entries"
              items={["Create", "Read", "Update"]}
              hoveredIndex={hoveredIndex}
              onHover={setHoveredIndex}
              play={play}
            />
            <FeatureBlock
              index={3}
              side="right"
              icon={Link2}
              title="API"
              items={["Integrate", "Build", "Scale"]}
              hoveredIndex={hoveredIndex}
              onHover={setHoveredIndex}
              play={play}
            />
          </div>
        </div>
      </div>

      <div className="mt-auto pt-10">
        <div className="w-6 h-0.5 bg-neutral-300 mb-2" />
      </div>
    </div>
  )
}

function FeatureBlock({
  index,
  side,
  icon: Icon,
  title,
  items,
  hoveredIndex,
  onHover,
  play,
}: {
  index: number
  side: "left" | "right"
  icon: typeof Box
  title: string
  items: string[]
  hoveredIndex: number | null
  onHover: (index: number | null) => void
  play: boolean
}) {
  const isHovered = hoveredIndex === index
  return (
    <motion.div
      className="flex items-start gap-2 xl:gap-3 min-w-0"
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      initial={play ? { opacity: 0, x: side === "left" ? -10 : 10 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={
        play
          ? { delay: REVEAL_DELAY, duration: LABEL_DURATION, ease: EASE_OUT }
          : { duration: 0 }
      }
    >
      <motion.div
        className="w-8 h-8 xl:w-9 xl:h-9 rounded-lg bg-white border flex items-center justify-center shrink-0"
        animate={{
          y: isHovered ? -2 : 0,
          borderColor: isHovered ? "#bfdbfe" : "#e5e5e5",
          boxShadow: isHovered
            ? "0 4px 10px -2px rgb(59 130 246 / 0.18)"
            : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        }}
        transition={{ duration: 0.25, ease: EASE_OUT }}
      >
        <Icon className="w-4 h-4 text-blue-600" />
      </motion.div>
      <div className="min-w-0">
        <p className="font-mono font-semibold text-sm text-neutral-900 truncate">{title}</p>
        <ul className="text-xs text-neutral-500 font-mono mt-1 space-y-0.5">
          {items.map((item) => (
            <li key={item} className="truncate">{item}</li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as Record<string, unknown> | null
    if (body && typeof body === "object") {
      if (typeof body.detail === "string") return body.detail
      const firstField = Object.values(body)[0]
      if (Array.isArray(firstField) && typeof firstField[0] === "string") return firstField[0]
    }
    return err.status === 401 ? "Invalid email or password." : "Something went wrong. Please try again."
  }
  return "Something went wrong. Please try again."
}

export function AuthPage() {
  const { status, login, signup } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === "authenticated") {
    const from = (location.state as { from?: string })?.from ?? "/"
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === "signin") {
        await login(email, password)
      } else {
        await signup(name, email, password)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      <BrandPanel />

      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-16 py-12">
        <div className="max-w-sm mx-auto w-full">
          <div className="w-8 h-0.5 bg-neutral-900 mb-8" />

          <h2 className="font-display text-3xl font-semibold tracking-tight text-neutral-900">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-neutral-500 mt-1 mb-8">
            {mode === "signin" ? "Sign in to your Lattice workspace" : "Start building with Lattice"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div>
                <label className="font-mono text-sm font-medium text-neutral-900 block mb-1.5">Name</label>
                <Input
                  type="text"
                  placeholder="Arijit Das"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="font-mono text-sm font-medium text-neutral-900 block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="email"
                  placeholder="arijit@acme.inc"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono text-sm font-medium text-neutral-900">Password</label>
                {mode === "signin" && (
                  <span className="font-mono text-sm text-blue-600 cursor-not-allowed opacity-60" title="Not yet available">
                    Forgot password?
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  className="pl-9 pr-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={mode === "signup" ? 8 : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="font-mono text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full bg-neutral-900 hover:bg-neutral-800 h-10" disabled={submitting}>
              {submitting ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200" />
            </div>
            <div className="relative flex justify-center text-xs font-mono text-neutral-400 uppercase tracking-wider">
              <span className="bg-white px-3">Or continue with</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button variant="outline" className="w-full h-10" disabled title="Not yet available">
              <GithubIcon /> <span className="ml-2">Continue with GitHub</span>
            </Button>
            <Button variant="outline" className="w-full h-10" disabled title="Not yet available">
              <GoogleIcon /> <span className="ml-2">Continue with Google</span>
            </Button>
            <Button variant="outline" className="w-full h-10" disabled title="Not yet available">
              <MicrosoftIcon /> <span className="ml-2">Continue with Microsoft</span>
            </Button>
          </div>

          <p className="font-mono text-center text-sm text-neutral-500 mt-8">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              className="font-mono text-blue-600 font-medium hover:underline"
              onClick={() => {
                setError(null)
                setMode(mode === "signin" ? "signup" : "signin")
              }}
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
