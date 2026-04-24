import { Sidebar } from '@/components/admin/sidebar'
import { NavUser } from '@/components/admin/nav-user'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="h-14 shrink-0 border-b flex items-center justify-end px-6">
          <NavUser />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
