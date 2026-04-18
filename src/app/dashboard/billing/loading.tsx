import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function BillingLoading() {
  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 space-y-1">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        {/* Left column */}
        <div className="flex flex-col gap-6 lg:w-2/5">
          {/* Current plan card */}
          <Card className="border-indigo-200">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-3 w-48" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-3 bg-white rounded-lg border border-gray-100 text-center space-y-1">
                    <Skeleton className="h-6 w-8 mx-auto" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-9 w-24 rounded-md" />
            </CardContent>
          </Card>

          {/* Top-up card */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3 space-y-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-center space-y-1">
                <Skeleton className="h-8 w-12 mx-auto" />
                <Skeleton className="h-3 w-14 mx-auto" />
                <Skeleton className="h-6 w-16 mx-auto" />
              </div>
              <Skeleton className="h-3 w-40 mx-auto" />
              <Skeleton className="h-9 w-full rounded-md" />
            </CardContent>
          </Card>
        </div>

        {/* Right column: plan cards */}
        <div className="flex flex-col lg:w-3/5">
          <Skeleton className="h-5 w-20 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 flex-1">
            {[...Array(2)].map((_, i) => (
              <Card key={i} className="border-gray-200 flex flex-col">
                <CardHeader className="pb-4 pt-6 space-y-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-4 w-36" />
                </CardHeader>
                <CardContent className="space-y-3 flex-1">
                  {[...Array(6)].map((_, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
