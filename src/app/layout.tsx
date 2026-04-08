import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Providers from "@/components/shared/Providers";
import AppModeProvider from "@/components/shared/AppModeProvider";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crescova.app'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Crescova — Automate Your LinkedIn Presence",
    template: "%s — Crescova",
  },
  description:
    "AI-powered LinkedIn post automation. Schedule, generate, and publish posts automatically. Grow your professional presence every day — on autopilot.",
  keywords: [
    "LinkedIn automation",
    "AI LinkedIn posts",
    "LinkedIn scheduling",
    "social media automation",
    "professional growth",
    "LinkedIn content generator",
  ],
  authors: [{ name: "Crescova" }],
  creator: "Crescova",
  publisher: "Crescova",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "Crescova",
    title: "Crescova — Automate Your LinkedIn Presence",
    description:
      "AI-powered LinkedIn post automation. Schedule, generate, and publish posts automatically.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Crescova — Automate Your LinkedIn Presence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crescova — Automate Your LinkedIn Presence",
    description:
      "AI-powered LinkedIn post automation. Schedule, generate, and publish posts automatically.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <AppModeProvider />
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
