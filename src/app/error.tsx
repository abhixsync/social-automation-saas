'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[root-error]', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-red-50 rounded-full">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-500 mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}
