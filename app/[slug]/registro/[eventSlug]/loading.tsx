import { Skeleton } from '@/components/ui/skeleton'

export default function RegistrationLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <Skeleton className="h-7 w-64 mb-1" />
      <Skeleton className="h-4 w-40 mb-8" />
      <div className="flex justify-center gap-8 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
