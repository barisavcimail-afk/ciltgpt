import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

function repositoryError(message: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

export async function getTeamMembersBySalonId(salonId: string) {
  try {
    return await prisma.teamMember.findMany({
      where: { salonId },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    throw repositoryError("Ekip üyeleri alınamadı", error);
  }
}

export async function createTeamMember(data: Prisma.TeamMemberCreateInput) {
  try {
    return await prisma.teamMember.create({ data });
  } catch (error) {
    throw repositoryError("Ekip üyesi oluşturulamadı", error);
  }
}

export async function updateTeamMemberStatus(id: string, isActive: boolean) {
  try {
    return await prisma.teamMember.update({
      where: { id },
      data: { isActive },
    });
  } catch (error) {
    throw repositoryError("Ekip üyesi durumu güncellenemedi", error);
  }
}
