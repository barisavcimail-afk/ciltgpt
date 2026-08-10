import { prisma } from "./customerRepository.server.js";

function repositoryError(message, error) {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

export async function createAnalysis(data) {
  try {
    return await prisma.analysis.create({ data });
  } catch (error) {
    throw repositoryError("Analiz oluşturulamadı", error);
  }
}
