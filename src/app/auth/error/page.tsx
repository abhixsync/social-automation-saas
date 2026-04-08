import Link from 'next/link'
import { Button } from '@/components/ui/button'

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: 'This email is already registered with a different sign-in method. Please use the original method.',
  OAuthSignin: 'Could not sign in with Google. Please try again.',
  OAuthCallback: 'Error during sign-in callback. Please try again.',
  CredentialsSignin: 'Invalid email or password.',
  Default: 'An unexpected error occurred. Please try again.',
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const message = ERROR_MESSAGES[params.error ?? 'Default'] ?? ERROR_MESSAGES.Default

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-8 text-center space-y-4">
          <span className="text-4xl">⚠️</span>
          <h1 className="text-xl font-semibold">Sign-in error</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" size="sm">
              <Link href="/auth/signup">Create account</Link>
            </Button>
            <Button size="sm">
              <Link href="/auth/login">Try again</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
