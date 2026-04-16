import Link from 'next/link'

export const metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <span className="text-2xl font-bold tracking-tight">Crescova</span>
        <div className="bg-card border rounded-xl px-8 py-10 space-y-4 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Coming soon — we&apos;re working on these.
          </p>
        </div>
        <Link href="/auth/login" className="text-sm text-primary hover:underline font-medium">
          Back to login
        </Link>
      </div>
    </main>
  )
}
