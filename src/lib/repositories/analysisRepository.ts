import type { AnalysisStatus, Prisma } from "@prisma/client";
import { prisma } from "../prisma";

function repositoryError(message: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

export async function getAnalysesBySalonId(salonId: string) {
  try {
    return await prisma.analysis.findMany({
      where: { salonId },
      orderBy: { createdAt: "desc" },
      include: { customer: true, report: true },
    });
  } catch (error) {
    throw repositoryError("Analiz listesi alınamadı", error);
  }
}

export async function getAnalysisById(id: string) {
  try {
    return await prisma.analysis.findUnique({
      where: { id },
      include: { customer: true, report: true },
    });
  } catch (error) {
    throw repositoryError("Analiz detayı alınamadı", error);
  }
}

export async function createAnalysis(data: Prisma.AnalysisCreateInput) {
  try {
    return await prisma.analysis.create({ data });
  } catch (error) {
    throw repositoryError("Analiz oluşturulamadı", error);
  }
}

export async function updateAnalysisStatus(id: string, status: AnalysisStatus) {
  try {
    return await prisma.analysis.update({
      where: { id },
      data: { status },
    });
  } catch (error) {
    throw repositoryError("Analiz durumu güncellenemedi", error);
  }
}
