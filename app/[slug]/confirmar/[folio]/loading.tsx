import { Skeleton } from '@/components/ui/skeleton'

export default function ConfirmationLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <div className="flex flex-col items-center mb-8 gap-3">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="rounded-lg border divide-y mb-6">
        {[100, 80, 80, 60, 60].map((w, i) => (
          <div key={i} className="px-4 py-3">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className={`h-4 w-${w}`} />
          </div>
        ))}
      </div>

      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-3 w-64 mx-auto mt-6" />
    </div>
  )
}
