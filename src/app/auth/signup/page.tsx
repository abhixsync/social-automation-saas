import SignupForm from '@/components/auth/SignupForm'

export const metadata = { title: 'Create account' }

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <span className="text-2xl font-bold tracking-tight">Crescova</span>
        </div>
        <SignupForm />
      </div>
    </main>
  )
}
