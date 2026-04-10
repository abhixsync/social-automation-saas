import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function SettingsLoading() {
  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
          <Skeleton className="h-9 w-28 rounded-md mt-2" />
        </CardContent>
      </Card>
    </div>
  )
}
