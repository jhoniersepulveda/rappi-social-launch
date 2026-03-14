// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  await prisma.restaurant.createMany({
    skipDuplicates: true,
    data: [
      {
        name: 'El Corral Premium',
        slug: 'el-corral-premium',
        logoUrl: 'https://via.placeholder.com/90x90/FF441B/FFFFFF?text=EC',
        category: 'Fast food',
        topProducts: [
          {
            name: 'Triple Corral',
            imageUrl: 'https://via.placeholder.com/400x400/FF6B35/FFF?text=Burger',
            price: 28900,
          },
          {
            name: 'Corral Clásico',
            imageUrl: 'https://via.placeholder.com/400x400/FF441B/FFF?text=Classic',
            price: 22900,
          },
          {
            name: 'Papas Rancheras',
            imageUrl: 'https://via.placeholder.com/400x400/FFA500/FFF?text=Papas',
            price: 12900,
          },
        ],
        email: 'marketing@elcorral.com',
      },
      {
        name: 'Amor Perfecto Café',
        slug: 'amor-perfecto-cafe',
        logoUrl: 'https://via.placeholder.com/90x90/1A1A1A/FFFFFF?text=AP',
        category: 'Cafetería',
        topProducts: [
          {
            name: 'Flat White Especial',
            imageUrl: 'https://via.placeholder.com/400x400/8B4513/FFF?text=Cafe',
            price: 9900,
          },
          {
            name: 'Croissant de Almendra',
            imageUrl: 'https://via.placeholder.com/400x400/D2691E/FFF?text=Croissant',
            price: 7900,
          },
        ],
        email: 'ventas@amorperfecto.co',
      },
      {
        name: 'Freshii Colombia',
        slug: 'freshii-colombia',
        logoUrl: 'https://via.placeholder.com/90x90/4CAF50/FFFFFF?text=FR',
        category: 'Saludable',
        topProducts: [
          {
            name: 'Bowl Energize',
            imageUrl: 'https://via.placeholder.com/400x400/4CAF50/FFF?text=Bowl',
            price: 25900,
          },
          {
            name: 'Wrap Mediterráneo',
            imageUrl: 'https://via.placeholder.com/400x400/8BC34A/FFF?text=Wrap',
            price: 21900,
          },
          {
            name: 'Jugo Detox Verde',
            imageUrl: 'https://via.placeholder.com/400x400/33691E/FFF?text=Jugo',
            price: 11900,
          },
        ],
        email: 'digital@freshii.co',
      },
    ],
  })

  const restaurants = await prisma.restaurant.findMany()
  console.log(`Seeded ${restaurants.length} restaurants:`)
  restaurants.forEach((r: { name: string; slug: string }) => console.log(`  - ${r.name} (${r.slug})`))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
