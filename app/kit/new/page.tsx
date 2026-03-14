import { prisma } from '@/lib/prisma'
import KitWizard from '@/components/KitWizard'

interface PageProps {
  searchParams: { restaurantId?: string }
}

export default async function NewKitPage({ searchParams }: PageProps) {
  const restaurantId = searchParams.restaurantId

  const [restaurant, restaurants] = await Promise.all([
    restaurantId
      ? prisma.restaurant.findUnique({ where: { id: restaurantId } })
      : Promise.resolve(null),
    !restaurantId
      ? prisma.restaurant.findMany({ orderBy: { name: 'asc' } })
      : Promise.resolve([]),
  ])

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Crear kit de redes sociales</h1>
          <p className="text-gray-500 mt-2">Genera 3 piezas gráficas con IA en menos de 2 minutos</p>
        </div>
        <KitWizard
          restaurant={restaurant as Parameters<typeof KitWizard>[0]['restaurant']}
          restaurants={restaurants as Parameters<typeof KitWizard>[0]['restaurants']}
        />
      </div>
    </div>
  )
}
