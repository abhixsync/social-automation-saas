import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return adminEmails.includes(email.toLowerCase())
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!isAdmin(session?.user?.email)) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-3 flex items-center gap-4">
        <span className="font-semibold text-gray-900">Admin</span>
        <a href="/admin/users" className="text-sm text-indigo-600 hover:underline">
          Users
        </a>
        <a href="/admin/settings" className="text-sm text-indigo-600 hover:underline">
          Settings
        </a>
        <a href="/dashboard" className="text-sm text-gray-500 hover:underline ml-auto">
          Back to Dashboard
        </a>
      </div>
      <main className="p-6">{children}</main>
    </div>
  )
}
