import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

function repositoryError(message: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

export async function getSalons() {
  try {
    return await prisma.salon.findMany({
      orderBy: { createdAt: "desc" },
      include: { subscription: true },
    });
  } catch (error) {
    throw repositoryError("Salon listesi alınamadı", error);
  }
}

export async function getSalonById(id: string) {
  try {
    return await prisma.salon.findUnique({
      where: { id },
      include: { subscription: true, teamMembers: true },
    });
  } catch (error) {
    throw repositoryError("Salon detayı alınamadı", error);
  }
}

export async function createSalon(data: Prisma.SalonCreateInput) {
  try {
    return await prisma.salon.create({ data });
  } catch (error) {
    throw repositoryError("Salon oluşturulamadı", error);
  }
}

export async function updateSalon(id: string, data: Prisma.SalonUpdateInput) {
  try {
    return await prisma.salon.update({
      where: { id },
      data,
    });
  } catch (error) {
    throw repositoryError("Salon güncellenemedi", error);
  }
}
