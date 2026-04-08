import { Suspense } from 'react'
import LoginForm from '@/components/auth/LoginForm'

export const metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <span className="text-2xl font-bold tracking-tight">Crescova</span>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
