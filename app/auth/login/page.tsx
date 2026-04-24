import { LoginForm } from '@/components/auth/login-form'

export const metadata = { title: 'Iniciar sesión — CEPROME' }

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <LoginForm />
    </div>
  )
}
