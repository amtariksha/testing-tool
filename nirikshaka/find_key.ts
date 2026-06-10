import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const key = await prisma.aPIKey.findUnique({
    where: { key: 'eqk_live_zxg9hxuxsnd' },
    include: { project: true }
  });
  console.log(JSON.stringify(key, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
