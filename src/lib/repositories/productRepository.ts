import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

function repositoryError(message: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

export async function getActiveProducts() {
  try {
    return await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    throw repositoryError("Aktif ürün listesi alınamadı", error);
  }
}

export async function getProductById(id: string) {
  try {
    return await prisma.product.findUnique({ where: { id } });
  } catch (error) {
    throw repositoryError("Ürün detayı alınamadı", error);
  }
}

export async function getActiveProductCatalogForAnalysis() {
  try {
    return await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        name: true,
        usagePurpose: true,
        usageTime: true,
      },
    });
  } catch (error) {
    throw repositoryError("Analiz ürün kataloğu alınamadı", error);
  }
}

export async function createProduct(data: Prisma.ProductCreateInput) {
  try {
    return await prisma.product.create({ data });
  } catch (error) {
    throw repositoryError("Ürün oluşturulamadı", error);
  }
}

export async function updateProduct(id: string, data: Prisma.ProductUpdateInput) {
  try {
    return await prisma.product.update({
      where: { id },
      data,
    });
  } catch (error) {
    throw repositoryError("Ürün güncellenemedi", error);
  }
}
