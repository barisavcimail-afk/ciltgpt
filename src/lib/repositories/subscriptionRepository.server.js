import { prisma } from "./customerRepository.server.js";

function repositoryError(message, error) {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

export async function getSubscriptionBySalonId(salonId) {
  try {
    return await prisma.subscription.findUnique({
      where: { salonId },
    });
  } catch (error) {
    throw repositoryError("Abonelik bilgisi alınamadı", error);
  }
}

export async function updateSubscriptionUsage(salonId, usage) {
  try {
    return await prisma.subscription.update({
      where: { salonId },
      data: { currentUsage: usage },
    });
  } catch (error) {
    throw repositoryError("Abonelik kullanımı güncellenemedi", error);
  }
}
