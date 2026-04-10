import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-gray-100 rounded-full">
            <FileQuestion className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <p className="text-5xl font-bold text-gray-900 mb-3">404</p>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Page not found</h2>
        <p className="text-sm text-gray-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/dashboard" className={buttonVariants()}>Go to Dashboard</Link>
      </div>
    </div>
  )
}
