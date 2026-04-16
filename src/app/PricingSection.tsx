"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Currency = "INR" | "USD";

interface Plan {
  name: string;
  credits: number;
  posts: string;
  model: string;
  priceINR: string;
  priceUSD: string;
  features: string[];
  popular: boolean;
  free: boolean;
}

const plans: Plan[] = [
  {
    name: "Free",
    credits: 1000,
    posts: "~200 posts/mo",
    model: "Llama 3.3 70B",
    priceINR: "Free",
    priceUSD: "Free",
    popular: false,
    free: true,
    features: [
      "1,000 credits / month",
      "~200 posts per month",
      "Llama 3.3 70B model",
      "1 LinkedIn account",
      "Smart scheduling",
      "Approval mode",
    ],
  },
  {
    name: "Pro",
    credits: 10000,
    posts: "~2,000 posts/mo",
    model: "Claude Sonnet",
    priceINR: "₹999",
    priceUSD: "$11.99",
    popular: true,
    free: false,
    features: [
      "10,000 credits / month",
      "~2,000 posts per month",
      "Claude Sonnet model",
      "10 LinkedIn accounts",
      "Smart scheduling",
      "Approval mode",
      "Priority support",
    ],
  },
];

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="size-4 shrink-0 text-indigo-500"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 8l3.5 3.5 7-7" />
    </svg>
  );
}

export default function PricingSection() {
  const [currency, setCurrency] = useState<Currency>("INR");

  // Read persisted preference after mount to avoid SSR mismatch
  useEffect(() => {
    const saved = localStorage.getItem("crescova_currency");
    if (saved === "INR" || saved === "USD") {
      setCurrency(saved);
    }
  }, []);

  function handleCurrencyChange(next: Currency) {
    setCurrency(next);
    localStorage.setItem("crescova_currency", next);
  }

  return (
    <section id="pricing" className="bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-6">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">
            Pricing
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-gray-500">
            Start free. Upgrade when you need more. No hidden fees.
          </p>

          {/* Currency toggle */}
          <div className="mt-8 inline-flex items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => handleCurrencyChange("INR")}
              className={`rounded-md px-5 py-1.5 text-sm font-medium transition-colors ${
                currency === "INR"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              ₹ INR
            </button>
            <button
              onClick={() => handleCurrencyChange("USD")}
              className={`rounded-md px-5 py-1.5 text-sm font-medium transition-colors ${
                currency === "USD"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              $ USD
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 sm:grid-cols-2 max-w-2xl mx-auto w-full">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                plan.popular
                  ? "border-indigo-500 ring-1 ring-indigo-500"
                  : "border-gray-100"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-indigo-600 px-3 text-xs font-semibold text-white">
                    Most Popular
                  </Badge>
                </div>
              )}

              {/* Plan name */}
              <p className="text-sm font-semibold text-gray-900">{plan.name}</p>

              {/* Price */}
              <div className="mt-3 mb-4">
                <span className="text-3xl font-bold text-gray-900">
                  {currency === "INR" ? plan.priceINR : plan.priceUSD}
                </span>
                {!plan.free && (
                  <span className="ml-1 text-sm text-gray-400">/month</span>
                )}
              </div>

              {/* Model badge */}
              <div className="mb-5">
                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {plan.model}
                </span>
              </div>

              {/* Features */}
              <ul className="mb-8 flex flex-col gap-2.5">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2">
                    <CheckIcon />
                    <span className="text-sm text-gray-500">{feat}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="mt-auto">
                <Link href="/auth/signup" className="block w-full">
                  <Button
                    className={`w-full text-sm font-semibold ${
                      plan.popular
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                    size="default"
                  >
                    {plan.free ? "Get started free" : "Get started"}
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Credit note */}
        <p className="mt-8 text-center text-xs text-gray-400">
          1 credit = 50 words. Credits reset on your billing date.
        </p>
      </div>
    </section>
  );
}
