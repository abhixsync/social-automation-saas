import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PricingSection from "./PricingSection";
import Logo from "@/components/shared/Logo";

// ─── Hero ────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-20 text-center sm:pb-32 sm:pt-28">
        <div className="mb-6 flex justify-center">
          <Badge
            variant="outline"
            className="gap-1.5 border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
          >
            <span className="inline-block size-1.5 rounded-full bg-indigo-500" />
            AI-Powered LinkedIn Automation
          </Badge>
        </div>

        <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
          Your LinkedIn,{" "}
          <span className="text-indigo-600">on autopilot.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-500">
          Crescova generates and posts AI-written content to LinkedIn on your schedule.
          Set it up once, grow your presence every day.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/auth/signup">
            <Button
              size="lg"
              className="h-11 rounded-lg bg-indigo-600 px-8 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Start for free
            </Button>
          </Link>
          <Link href="#features">
            <Button
              variant="outline"
              size="lg"
              className="h-11 rounded-lg border-gray-200 px-8 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              See how it works
            </Button>
          </Link>
        </div>

        {/* Social proof strip */}
        <p className="mt-8 text-xs text-gray-400">
          No credit card required · Free plan available · Cancel anytime
        </p>
      </div>
    </section>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
    title: "AI Content Generation",
    description:
      "Groq & Claude models write posts in your voice. Set your niche, tone, and content pillars — Crescova handles the rest.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: "Smart Scheduling",
    description:
      "Pick your days and times. Posts go out automatically via BullMQ job queues — reliable, timezone-aware, and always on time.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Approval Mode",
    description:
      "Want full control? Enable approval mode and review every post before it goes live. Your brand, your voice, your call.",
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-14 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">
            Everything you need
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Built for consistent creators
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-gray-500">
            Crescova takes care of the consistency so you can focus on the strategy.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm"
            >
              <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-indigo-50 p-3 text-indigo-600">
                {f.icon}
              </div>
              <h3 className="mb-2 text-base font-semibold text-gray-900">{f.title}</h3>
              <p className="text-sm leading-7 text-gray-500">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

const steps = [
  { num: "01", title: "Connect your LinkedIn account", desc: "Securely link your LinkedIn profile with OAuth. Crescova never stores your password." },
  { num: "02", title: "Set your preferences", desc: "Tell Crescova your niche, tone of voice, and the topics you want to post about." },
  { num: "03", title: "Choose a schedule", desc: "Pick the days and times that work for you. Crescova adapts to your timezone." },
  { num: "04", title: "Posts publish automatically", desc: "Sit back. Crescova generates and publishes posts on your behalf, every single day." },
];

function HowItWorksSection() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-14 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">
            Simple setup
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Up and running in minutes
          </h2>
        </div>

        <div className="relative grid gap-0 sm:grid-cols-4">
          {/* Connector line — desktop only */}
          <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gray-100 sm:block" />

          {steps.map((step) => (
            <div key={step.num} className="relative flex flex-col items-center px-4 pb-10 text-center sm:pb-0">
              <div className="relative z-10 mb-5 flex size-16 items-center justify-center rounded-2xl border border-indigo-100 bg-white shadow-sm">
                <span className="text-sm font-bold text-indigo-600">{step.num}</span>
              </div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">{step.title}</h3>
              <p className="text-sm leading-6 text-gray-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Crescova',
    description:
      'AI-powered LinkedIn post automation. Schedule, generate, and publish posts automatically.',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free plan available',
    },
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
      </main>
      <Footer />
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/">
          <Logo size="sm" />
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          <Link href="#features" className="text-sm text-gray-500 hover:text-gray-900">
            Features
          </Link>
          <Link href="#pricing" className="text-sm text-gray-500 hover:text-gray-900">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/auth/login">
            <Button variant="ghost" size="sm" className="text-sm text-gray-600">
              Log in
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button
              size="sm"
              className="bg-indigo-600 text-sm text-white hover:bg-indigo-700"
            >
              Sign up free
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div>
            <Logo size="sm" />
            <p className="text-xs text-gray-400 mt-1">Grow your LinkedIn, automatically.</p>
          </div>

          <nav className="flex items-center gap-6">
            <Link href="#features" className="text-sm text-gray-400 hover:text-gray-700">
              Features
            </Link>
            <Link href="#pricing" className="text-sm text-gray-400 hover:text-gray-700">
              Pricing
            </Link>
            <Link href="/auth/login" className="text-sm text-gray-400 hover:text-gray-700">
              Login
            </Link>
            <Link href="/auth/signup" className="text-sm text-gray-400 hover:text-gray-700">
              Sign up
            </Link>
          </nav>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-6 text-center">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Crescova. Built for LinkedIn creators.
          </p>
        </div>
      </div>
    </footer>
  );
}
