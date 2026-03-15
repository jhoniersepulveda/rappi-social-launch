import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const role = session.user.role
  if (role === 'kam')        redirect('/dashboard/kam')
  if (role === 'restaurant') redirect('/dashboard/restaurant')
  if (role === 'admin')      redirect('/dashboard/admin')

  redirect('/login')
}
