import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function repositoryError(message, error) {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

export async function getCustomersBySalonId(salonId) {
  try {
    return await prisma.customer.findMany({
      where: { salonId },
      orderBy: { createdAt: "desc" },
      include: {
        analyses: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { report: true },
        },
      },
    });
  } catch (error) {
    throw repositoryError("Müşteri listesi alınamadı", error);
  }
}

export async function getCustomerById(id) {
  try {
    return await prisma.customer.findUnique({
      where: { id },
      include: {
        analyses: {
          orderBy: { createdAt: "desc" },
          include: { report: true },
        },
      },
    });
  } catch (error) {
    throw repositoryError("Müşteri detayı alınamadı", error);
  }
}

export async function createCustomer(data) {
  try {
    return await prisma.customer.create({ data });
  } catch (error) {
    throw repositoryError("Müşteri oluşturulamadı", error);
  }
}
