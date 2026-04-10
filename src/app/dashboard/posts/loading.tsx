import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function PostsLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="space-y-1">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-4 w-52" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {[80, 96, 88, 72].map((w, i) => (
          <Skeleton key={i} className={`h-9 w-${w / 4} rounded-md`} style={{ width: w }} />
        ))}
      </div>

      {/* Post cards */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="border-gray-200">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-4 w-full max-w-md" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Skeleton className="h-8 w-16 rounded-md" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
