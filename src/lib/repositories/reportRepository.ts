import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

function repositoryError(message: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

export async function getReportsBySalonId(salonId: string) {
  try {
    return await prisma.report.findMany({
      where: { salonId },
      orderBy: { createdAt: "desc" },
      include: { analysis: { include: { customer: true } } },
    });
  } catch (error) {
    throw repositoryError("Rapor listesi alınamadı", error);
  }
}

export async function getReportById(id: string) {
  try {
    return await prisma.report.findUnique({
      where: { id },
      include: { analysis: { include: { customer: true } }, salon: true },
    });
  } catch (error) {
    throw repositoryError("Rapor detayı alınamadı", error);
  }
}

export async function createReport(data: Prisma.ReportCreateInput) {
  try {
    return await prisma.report.create({ data });
  } catch (error) {
    throw repositoryError("Rapor oluşturulamadı", error);
  }
}

export async function deleteReport(id: string) {
  try {
    return await prisma.report.delete({
      where: { id },
    });
  } catch (error) {
    throw repositoryError("Rapor silinemedi", error);
  }
}
