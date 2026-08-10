import { prisma } from "./customerRepository.server.js";

function repositoryError(message, error) {
  const detail = error instanceof Error ? error.message : "Unknown repository error";
  return new Error(`${message}: ${detail}`);
}

export async function getProducts() {
  try {
    return await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    throw repositoryError("Ürün listesi alınamadı", error);
  }
}

export async function getSalonProductsBySalonId(salonId) {
  try {
    return await prisma.salonProduct.findMany({
      where: { salonId },
      orderBy: { createdAt: "desc" },
      include: { product: true },
    });
  } catch (error) {
    throw repositoryError("Salon ürün listesi alınamadı", error);
  }
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

export async function getProductById(id) {
  try {
    return await prisma.product.findUnique({ where: { id } });
  } catch (error) {
    throw repositoryError("Ürün detayı alınamadı", error);
  }
}

export async function getProductBrands() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ brand: "asc" }, { name: "asc" }],
      select: { brand: true },
    });
    const counts = new Map();
    products.forEach((product) => {
      const brand = String(product.brand || "").trim();
      if (!brand) return;
      counts.set(brand, (counts.get(brand) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([brand, count]) => ({ brand, count }));
  } catch (error) {
    throw repositoryError("Marka listesi alınamadı", error);
  }
}

export async function importBrandProductsToSalon(salonId, brand) {
  try {
    const products = await prisma.product.findMany({
      where: {
        brand,
        isActive: true,
      },
      select: { id: true },
    });

    let added = 0;
    for (const product of products) {
      const existing = await prisma.salonProduct.findUnique({
        where: {
          salonId_productId: {
            salonId,
            productId: product.id,
          },
        },
      });

      await prisma.salonProduct.upsert({
        where: {
          salonId_productId: {
            salonId,
            productId: product.id,
          },
        },
        update: { isActive: true },
        create: {
          salonId,
          productId: product.id,
          isActive: true,
        },
      });

      if (!existing) added += 1;
    }

    return {
      total: products.length,
      added,
      existing: products.length - added,
    };
  } catch (error) {
    throw repositoryError("Marka ürünleri salona aktarılamadı", error);
  }
}

export async function getActiveProductCatalogForAnalysis(salonId) {
  try {
    if (salonId) {
      const salonProducts = await prisma.salonProduct.findMany({
        where: {
          salonId,
          product: { isActive: true, isCabinProduct: false },
        },
        orderBy: { createdAt: "desc" },
        include: { product: true },
      });

      if (salonProducts.length) {
        return salonProducts
          .filter((salonProduct) => salonProduct.isActive)
          .map(({ product }) => ({
            name: product.name,
            usagePurpose: product.usagePurpose,
            usageTime: product.usageTime,
          }));
      }
    }

    return await prisma.product.findMany({
      where: { isActive: true, isCabinProduct: false },
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

export async function createSalonProduct(salonId, data) {
  try {
    const product = await prisma.product.create({ data });
    return await prisma.salonProduct.create({
      data: {
        salonId,
        productId: product.id,
        isActive: product.isActive,
      },
      include: { product: true },
    });
  } catch (error) {
    throw repositoryError("Salon ürünü oluşturulamadı", error);
  }
}

export async function updateSalonProductStatus(salonId, salonProductId, isActive) {
  try {
    await prisma.salonProduct.updateMany({
      where: {
        id: salonProductId,
        salonId,
      },
      data: { isActive },
    });
    const product = await prisma.salonProduct.findFirst({
      where: {
        id: salonProductId,
        salonId,
      },
      include: { product: true },
    });
    if (!product) throw new Error("Salon ürünü bulunamadı");
    return product;
  } catch (error) {
    throw repositoryError("Salon ürün durumu güncellenemedi", error);
  }
}

export async function createProduct(data) {
  try {
    return await prisma.product.create({ data });
  } catch (error) {
    throw repositoryError("Ürün oluşturulamadı", error);
  }
}

export async function updateProduct(id, data) {
  try {
    return await prisma.product.update({
      where: { id },
      data,
    });
  } catch (error) {
    throw repositoryError("Ürün güncellenemedi", error);
  }
}
