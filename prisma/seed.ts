import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Seed default SiteSettings for Kill Switch
  await prisma.siteSetting.upsert({
    where: { key: 'app_mode' },
    update: {},
    create: { key: 'app_mode', value: 'active' },
  })

  await prisma.siteSetting.upsert({
    where: { key: 'maintenance_until' },
    update: {},
    create: { key: 'maintenance_until', value: '' },
  })

  console.log('✅ Seed complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
