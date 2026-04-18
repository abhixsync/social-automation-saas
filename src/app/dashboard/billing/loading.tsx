import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function BillingLoading() {
  return (
    <div className="p-6 max-w-5xl space-y-8">
      <div className="space-y-1">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current plan skeleton */}
        <Card className="lg:col-span-2 border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex justify-between">
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
            <div className="grid grid-cols-3 gap-3 pt-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1 text-center">
                  <Skeleton className="h-7 w-8 mx-auto" />
                  <Skeleton className="h-3 w-20 mx-auto" />
                </div>
              ))}
            </div>
            <Skeleton className="h-9 w-36 rounded-md" />
          </CardContent>
        </Card>

        {/* Top-up skeleton */}
        <Card className="border-gray-200">
          <CardHeader className="pb-3 space-y-1.5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-44" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-center space-y-1">
              <Skeleton className="h-8 w-12 mx-auto" />
              <Skeleton className="h-3 w-14 mx-auto" />
              <Skeleton className="h-6 w-16 mx-auto" />
            </div>
            <Skeleton className="h-9 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>

      {/* Plan cards */}
      <div className="space-y-4">
        <Skeleton className="h-5 w-20" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-gray-200">
              <CardHeader className="pb-3 space-y-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-20" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-3.5 rounded-full flex-shrink-0" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
