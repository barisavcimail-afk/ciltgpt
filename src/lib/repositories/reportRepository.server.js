import { prisma } from "./customerRepository.server.js";

function repositoryError(message, error) {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

export async function createReport(data) {
  try {
    return await prisma.report.create({ data });
  } catch (error) {
    throw repositoryError("Rapor oluşturulamadı", error);
  }
}

export async function getReportsBySalonId(salonId) {
  try {
    return await prisma.report.findMany({
      where: { salonId },
      orderBy: { createdAt: "desc" },
      include: {
        analysis: {
          include: {
            customer: true,
          },
        },
      },
    });
  } catch (error) {
    throw repositoryError("Rapor listesi alınamadı", error);
  }
}

export async function getReportById(id) {
  try {
    return await prisma.report.findUnique({
      where: { id },
      include: {
        analysis: {
          include: {
            customer: true,
          },
        },
        salon: true,
      },
    });
  } catch (error) {
    throw repositoryError("Rapor detayı alınamadı", error);
  }
}

export async function deleteReport(id) {
  try {
    return await prisma.report.delete({
      where: { id },
    });
  } catch (error) {
    throw repositoryError("Rapor silinemedi", error);
  }
}
