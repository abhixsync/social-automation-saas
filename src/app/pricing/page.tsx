import Link from "next/link";
import PricingSection from "@/app/PricingSection";
import Logo from "@/components/shared/Logo";

export const metadata = {
  title: "Pricing — Crescova",
  description:
    "Simple, transparent pricing. Start free. Upgrade when you need more.",
};

const faqs = [
  {
    q: "What is a credit?",
    a: "1 credit = 50 words. A typical LinkedIn post uses 4–8 credits.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "Post generation pauses. You can buy a top-up (100 credits) or wait for your monthly reset.",
  },
  {
    q: "Do credits roll over?",
    a: "No, credits reset on your billing date each month. Top-up credits never expire.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the billing dashboard anytime. You keep access until the end of your billing period.",
  },
  {
    q: "Which AI model do I get?",
    a: "Free uses Llama 3.3 70B. Pro uses Claude Sonnet (Anthropic's best model).",
  },
  {
    q: "Is there a free plan?",
    a: "Yes — always free, no credit card required. 1,000 credits per month, no time limit.",
  },
  {
    q: "Can I switch plans?",
    a: "Yes, upgrade or downgrade anytime from the billing dashboard.",
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-full flex-col bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Pricing cards */}
        <PricingSection />

        {/* FAQ */}
        <section className="bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-12 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">
                FAQ
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Frequently asked questions
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base text-gray-500">
                Everything you need to know about Crescova pricing and credits.
              </p>
            </div>

            <div className="mx-auto max-w-2xl divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-gray-50 shadow-sm">
              {faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="group px-6 py-5"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-gray-900 marker:hidden">
                    {faq.q}
                    <span className="ml-auto shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180">
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className="size-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 6l4 4 4-4"
                        />
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-gray-500">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8 text-center">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Crescova. Built for LinkedIn creators.
          </p>
        </div>
      </footer>
    </div>
  );
}
