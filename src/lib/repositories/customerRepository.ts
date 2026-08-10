import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

function repositoryError(message: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

export async function getCustomersBySalonId(salonId: string) {
  try {
    return await prisma.customer.findMany({
      where: { salonId },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    throw repositoryError("Müşteri listesi alınamadı", error);
  }
}

export async function getCustomerById(id: string) {
  try {
    return await prisma.customer.findUnique({
      where: { id },
      include: { analyses: { include: { report: true } } },
    });
  } catch (error) {
    throw repositoryError("Müşteri detayı alınamadı", error);
  }
}

export async function createCustomer(data: Prisma.CustomerCreateInput) {
  try {
    return await prisma.customer.create({ data });
  } catch (error) {
    throw repositoryError("Müşteri oluşturulamadı", error);
  }
}

export async function updateCustomer(id: string, data: Prisma.CustomerUpdateInput) {
  try {
    return await prisma.customer.update({
      where: { id },
      data,
    });
  } catch (error) {
    throw repositoryError("Müşteri güncellenemedi", error);
  }
}
