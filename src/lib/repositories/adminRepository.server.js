import { prisma } from "./customerRepository.server.js";

const packagePrices = {
  Starter: 1490,
  Pro: 2990,
  Premium: 4990,
  Enterprise: 0,
};

function repositoryError(message, error) {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getAdminDashboardStats() {
  try {
    const monthStart = startOfCurrentMonth();
    const [totalSalons, activeSalons, monthlyAnalyses, pendingAnalyses, completedReports, activeSubscriptions] =
      await Promise.all([
        prisma.salon.count(),
        prisma.subscription.count({ where: { status: "ACTIVE" } }),
        prisma.analysis.count({ where: { createdAt: { gte: monthStart } } }),
        prisma.analysis.count({ where: { status: { not: "COMPLETED" } } }),
        prisma.report.count(),
        prisma.subscription.findMany({ where: { status: "ACTIVE" } }),
      ]);

    const revenue = activeSubscriptions.reduce(
      (total, subscription) => total + (packagePrices[subscription.packageName] || 0),
      0,
    );

    return {
      totalSalons,
      activeSalons,
      monthlyAnalyses,
      pendingAnalyses,
      completedReports,
      estimatedRevenue: `${revenue.toLocaleString("tr-TR")} TL`,
    };
  } catch (error) {
    throw repositoryError("Admin istatistikleri alınamadı", error);
  }
}

export async function getAllSalons() {
  try {
    const monthStart = startOfCurrentMonth();
    const salons = await prisma.salon.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subscription: true,
        teamMembers: true,
        createdByFirm: true,
        createdByUser: true,
        analyses: {
          where: { createdAt: { gte: monthStart } },
        },
      },
    });

    return salons.map((salon) => {
      const subscription = salon.subscription;
      const monthlyLimit = subscription?.monthlyLimit || 0;
      const currentUsage = subscription?.currentUsage || 0;

      return {
        id: salon.id,
        name: salon.name,
        owner: salon.ownerName,
        city: salon.city,
        packageName: subscription?.packageName || "-",
        status: subscription?.status === "ACTIVE" ? "Aktif" : "Pasif",
        userCount: salon.teamMembers.length,
        monthlyAnalysisLimit: monthlyLimit,
        usedAnalyses: currentUsage,
        monthlyAnalyses: salon.analyses.length,
        remainingAnalyses: Math.max(monthlyLimit - currentUsage, 0),
        createdByFirmId: salon.createdByFirmId || "",
        createdByUserId: salon.createdByUserId || "",
        isAdminCreated: !salon.createdByFirmId,
        createdBy:
          salon.createdByFirm?.name || salon.createdByUser?.name
            ? `${salon.createdByFirm?.name || "Sistem"}${salon.createdByUser?.name ? ` / ${salon.createdByUser.name}` : ""}`
            : "Sistem",
      };
    });
  } catch (error) {
    throw repositoryError("Salon listesi alınamadı", error);
  }
}

export async function getAdminAnalyses(limit) {
  try {
    const analyses = await prisma.analysis.findMany({
      orderBy: { createdAt: "desc" },
      ...(Number.isInteger(limit) && limit > 0 ? { take: limit } : {}),
      include: {
        salon: {
          include: {
            createdByFirm: true,
          },
        },
        customer: true,
        report: true,
      },
    });

    return analyses.map((analysis) => ({
      id: analysis.id,
      salon: analysis.salon?.name || "-",
      firm: analysis.salon?.createdByFirm?.name || "Sistem",
      customer: analysis.customer?.fullName || "-",
      date: analysis.createdAt,
      status: analysis.status === "COMPLETED" ? "Tamamlandı" : "Bekliyor",
      score: analysis.report?.overallScore ?? "-",
      mainConcern: analysis.mainConcern || "-",
      skinType: analysis.skinType || "-",
      reportId: analysis.report?.id || "",
    }));
  } catch (error) {
    throw repositoryError("Analiz listesi alınamadı", error);
  }
}

