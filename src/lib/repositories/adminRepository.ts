import { AnalysisStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../prisma";
import type { AdminDashboardStats, AdminSalonListItem } from "../admin/types";

const packagePrices: Record<string, number> = {
  Starter: 1490,
  Pro: 2990,
  Premium: 4990,
  Enterprise: 0,
};

function repositoryError(message: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  try {
    const monthStart = startOfCurrentMonth();
    const [totalSalons, activeSalons, monthlyAnalyses, pendingAnalyses, completedReports, activeSubscriptions] =
      await Promise.all([
        prisma.salon.count(),
        prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
        prisma.analysis.count({ where: { createdAt: { gte: monthStart } } }),
        prisma.analysis.count({ where: { status: { not: AnalysisStatus.COMPLETED } } }),
        prisma.report.count(),
        prisma.subscription.findMany({ where: { status: SubscriptionStatus.ACTIVE } }),
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

export async function getAllSalons(): Promise<AdminSalonListItem[]> {
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
        status: subscription?.status === SubscriptionStatus.ACTIVE ? "Aktif" : "Pasif",
        userCount: salon.teamMembers.length,
        monthlyAnalysisLimit: monthlyLimit,
        usedAnalyses: currentUsage,
        monthlyAnalyses: salon.analyses.length,
        remainingAnalyses: Math.max(monthlyLimit - currentUsage, 0),
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
