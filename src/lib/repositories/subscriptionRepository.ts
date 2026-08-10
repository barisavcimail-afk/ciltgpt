import { prisma } from "../prisma";

function repositoryError(message: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

export async function getSubscriptionBySalonId(salonId: string) {
  try {
    return await prisma.subscription.findUnique({
      where: { salonId },
    });
  } catch (error) {
    throw repositoryError("Abonelik bilgisi alınamadı", error);
  }
}

export async function updateSubscriptionUsage(salonId: string, usage: number) {
  try {
    return await prisma.subscription.update({
      where: { salonId },
      data: { currentUsage: usage },
    });
  } catch (error) {
    throw repositoryError("Abonelik kullanımı güncellenemedi", error);
  }
}
