import { prisma } from "./customerRepository.server.js";

function repositoryError(message, error) {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

export async function getSalonById(id) {
  try {
    return await prisma.salon.findUnique({
      where: { id },
    });
  } catch (error) {
    throw repositoryError("Salon detayı alınamadı", error);
  }
}

export async function updateSalon(id, data) {
  try {
    return await prisma.salon.update({
      where: { id },
      data,
    });
  } catch (error) {
    throw repositoryError("Salon güncellenemedi", error);
  }
}
