import { Navigate } from 'react-router-dom'
import { useRole } from '@/hooks/use-role'

export default function Index() {
  const { role } = useRole()

  if (role === 'super_admin') {
    return <Navigate to="/admin" replace />
  }

  return <Navigate to="/dashboard" replace />
}
