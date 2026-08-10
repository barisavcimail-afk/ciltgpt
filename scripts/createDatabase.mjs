import { PrismaClient } from "@prisma/client";

const adminUrl = "postgresql://postgres:930976@localhost:5432/postgres";
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: adminUrl,
    },
  },
});

try {
  const databases = await prisma.$queryRawUnsafe(
    "SELECT datname FROM pg_database WHERE datname = 'ciltgpt'",
  );

  if (databases.length === 0) {
    await prisma.$executeRawUnsafe("CREATE DATABASE ciltgpt");
    console.log("ciltgpt database created");
  } else {
    console.log("ciltgpt database already exists");
  }
} finally {
  await prisma.$disconnect();
}
