import OpenAI from "openai";
import { getOpenAIConfig } from "../repositories/systemSettingsRepository.server";
import type { AnalysisInput, AnalysisOutput, RecommendedProduct } from "../analysis/types";

declare const process: {
  env: Record<string, string | undefined>;
};

type OpenAIAnalysisPayload = {
  overallScore?: number;
  scores?: {
    hydration?: number;
    pigmentation?: number;
    pores?: number;
    wrinkles?: number;
    sensitivity?: number;
  };
  aiComment?: string;
  recommendedProtocol?: {
    name?: string;
    sessions?: number;
    frequency?: string;
    salonNote?: string;
  };
  recommendedProducts?: Array<Partial<RecommendedProduct>>;
};

const OPENAI_TIMEOUT_MS = 60_000;

function clampScore(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score)) return 60;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function parseJsonResponse(text: string): OpenAIAnalysisPayload {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned) as OpenAIAnalysisPayload;
}

function photoEntries(photos: AnalysisInput["photos"]): Array<[string, string]> {
  return Object.entries(photos || {}).filter((entry): entry is [string, string] => {
    const value = entry[1];
    return typeof value === "string" && value.startsWith("data:image/");
  });
}

function orderedPhotoEntries(photos: AnalysisInput["photos"]): Array<[string, string]> {
  const entries = photoEntries(photos);
  const preferredKeys = ["front", "left", "right", "close"];
  const ordered = preferredKeys
    .map((key) => entries.find(([entryKey]) => entryKey === key))
    .filter((entry): entry is [string, string] => Boolean(entry));
  const extra = entries.filter(([key]) => !preferredKeys.includes(key));

  return [...ordered, ...extra];
}

function productCatalogLines(productCatalog: AnalysisInput["productCatalog"] = []): string {
  if (!productCatalog.length) {
    return "Ürün kataloğu boş. recommendedProducts alanını boş dizi olarak döndür.";
  }

  return productCatalog
    .map((product, index) => `${index + 1}. ${product.name} - kullanım amacı: ${product.usagePurpose}`)
    .join("\n");
}

function buildPrompt(input: AnalysisInput): string {
  return `
Sen profesyonel bir kozmetik cilt analiz uzmanısın.

Görevin yalnızca kozmetik değerlendirme yapmaktır.
Tıbbi tanı koyma.
Hastalık ismi kullanma.
Kesin ifadeler kullanma.
Yorumlarını yalnızca gönderilen yüz fotoğrafları ve kullanıcı bilgilerine göre oluştur.
Yalnızca görülebilen alanlara göre değerlendirme yap ve emin olmadığın konularda orta seviyede puan ver.
Eğer gönderilen fotoğraflardan herhangi birinde yüz algılanmıyor, kadraj dışında kalıyor, belirgin şekilde bulanık oluyor veya cephe/profil açısı değerlendirme için uygun değilse o fotoğrafa dayalı yorum yapma. Cephe, sol profil, sağ profil veya yakın plan görselinde yüz güvenilir biçimde görünmüyorsa ilgili açı üzerinden nem, leke, gözenek, kırışıklık ya da hassasiyet yorumu üretme. Bu durumda aiComment içinde ilgili fotoğrafın analiz için yeterli olmadığını kozmetik ve kısa bir dille belirt, emin olmadığın skorları orta seviyede tut.

Hiçbir zaman eksik bilgi uydurma.
Form: müşteri=${input.customerName}, yaş=${input.age ?? "-"}, cinsiyet=${input.gender ?? "-"}, ciltTipi=${input.skinType}, anaŞikayet=${input.mainConcern}, SPF=${input.spfUsage}, evRutini=${input.homeCareRoutine}, not=${input.notes || "-"}.
aiComment alanında 5-7 cümlelik detaylı bir kozmetik analiz yaz. Fotoğraflarda görülebilen nem dengesi, ton eşitsizliği, gözenek görünümü, ince çizgi eğilimi, hassasiyet izlenimi ve kullanıcının form yanıtları arasındaki ilişkiyi açıkla. Kullanılan puanların nedenlerini kısa gerekçelerle belirt. Salonun müşteriye aktarabileceği profesyonel ama anlaşılır bir dil kullan.

Veritabanındaki aktif ev devam ürünleri:
${productCatalogLines(input.productCatalog)}

recommendedProducts alanında yalnızca yukarıdaki ürün listesinden ilgili olan en fazla 4 ürünü seç. Ürün adı listedeki name ile birebir aynı olmalı. purpose alanında listedeki kullanım amacını kullan. salesNote alanında bu ürünün analiz sonucuyla neden ilgili olduğunu salon satış diline uygun, kısa ve kozmetik çerçevede açıkla. Listede olmayan ürün adı yazma.
Yalnızca kısa ve geçerli JSON döndür: overallScore, scores{hydration,pigmentation,pores,wrinkles,sensitivity}, aiComment, recommendedProtocol, recommendedProducts.
`;
}

function normalizeRecommendedProducts(
  input: AnalysisInput,
  payloadProducts: OpenAIAnalysisPayload["recommendedProducts"],
): RecommendedProduct[] {
  const catalog = input.productCatalog || [];
  if (!catalog.length || !payloadProducts?.length) return [];

  const catalogByName = new Map(catalog.map((product) => [product.name.trim().toLowerCase(), product]));

  return payloadProducts
    .map((product) => {
      const catalogProduct = catalogByName.get(String(product.name || "").trim().toLowerCase());
      if (!catalogProduct) return null;

      return {
        name: catalogProduct.name,
        time: product.time || "Salon önerisine göre",
        purpose: catalogProduct.usagePurpose,
        salesNote:
          product.salesNote ||
          `${catalogProduct.usagePurpose} odağı nedeniyle ev devam bakımında salon tarafından önerilebilir.`,
      };
    })
    .filter((product): product is RecommendedProduct => Boolean(product))
    .slice(0, 4);
}

function normalizeOutput(input: AnalysisInput, payload: OpenAIAnalysisPayload): AnalysisOutput {
  const scores = {
    hydration: clampScore(payload.scores?.hydration),
    pigmentation: clampScore(payload.scores?.pigmentation),
    pores: clampScore(payload.scores?.pores),
    wrinkles: clampScore(payload.scores?.wrinkles),
    sensitivity: clampScore(payload.scores?.sensitivity),
  };

  return {
    reportId: "openai-vision-report",
    customerId: input.customerId,
    customerName: input.customerName,
    createdAt: new Date().toISOString(),
    overallScore: clampScore(payload.overallScore),
    scores,
    skinType: input.skinType,
    mainConcern: input.mainConcern,
    aiComment:
      payload.aiComment ||
      "Fotoğraflar ve form bilgileri birlikte değerlendirildi. Cilt bariyerini destekleyen bir bakım planı önerilir.",
    recommendedProtocol: {
      name: payload.recommendedProtocol?.name || "HydraCare Cilt Bakım Protokolü",
      sessions: Number(payload.recommendedProtocol?.sessions) || 6,
      frequency: payload.recommendedProtocol?.frequency || "Haftada 1",
      salonNote: payload.recommendedProtocol?.salonNote || "Cilt yanıtı her seansta tekrar değerlendirilmelidir.",
    },
    recommendedProducts: normalizeRecommendedProducts(input, payload.recommendedProducts),
  };
}

export async function runOpenAIVisionAnalysis(input: AnalysisInput): Promise<AnalysisOutput> {
  const openAIConfig = await getOpenAIConfig();
  if (!openAIConfig.apiKey) {
    throw new Error("OPENAI_API_KEY is not configured in database or environment variables");
  }

  const client = new OpenAI({
    apiKey: openAIConfig.apiKey,
    timeout: OPENAI_TIMEOUT_MS,
  });

  const response = await client.responses.create({
    model: openAIConfig.model || "gpt-5-mini",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: buildPrompt(input) },
          ...orderedPhotoEntries(input.photos).map(([, imageUrl]) => ({
            type: "input_image" as const,
            image_url: imageUrl,
            detail: "low" as const,
          })),
        ],
      },
    ],
    max_output_tokens: 900,
    reasoning: { effort: "minimal" },
  });

  return normalizeOutput(input, parseJsonResponse(response.output_text));
}
