import OpenAI from "openai";

const OPENAI_TIMEOUT_MS = 60_000;
const MAX_RECOMMENDED_PRODUCTS_FROM_AI = 4;
const TOTAL_RECOMMENDED_PRODUCTS = 5;

function numericScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 60;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeScore(value, useTenPointScale) {
  const score = numericScore(value);
  if (score === null) return 60;
  return clampScore(useTenPointScale ? score * 10 : score);
}

function shouldConvertTenPointScale(rawScores, rawOverallScore) {
  const values = [
    rawScores.hydration,
    rawScores.pigmentation,
    rawScores.pores,
    rawScores.wrinkles,
    rawScores.sensitivity,
    rawOverallScore,
  ]
    .map(numericScore)
    .filter((value) => value !== null);

  return values.length >= 3 && values.every((value) => value >= 0 && value <= 10);
}

function parseJsonResponse(text) {
  const cleaned = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function photoEntries(photos = {}) {
  return Object.entries(photos).filter(([, value]) => typeof value === "string" && value.startsWith("data:image/"));
}

function orderedPhotoEntries(photos = {}) {
  const entries = photoEntries(photos);
  const preferredKeys = ["front", "left", "right", "close"];
  const ordered = preferredKeys
    .map((key) => entries.find(([entryKey]) => entryKey === key))
    .filter(Boolean);
  const extra = entries.filter(([key]) => !preferredKeys.includes(key));

  return [...ordered, ...extra];
}

function comparableText(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
}

function productKey(value) {
  return comparableText(value).replace(/\s+/g, " ").trim();
}

function isSunShieldProduct(product) {
  const name = comparableText(product?.name);
  const purpose = comparableText(product?.usagePurpose || product?.purpose);
  return (
    name.includes("sun shield") ||
    name.includes("sunshield") ||
    name.includes("spf") ||
    purpose.includes("spf") ||
    purpose.includes("gunes") ||
    purpose.includes("güneş")
  );
}

function findSunShieldProduct(catalog) {
  return (
    catalog.find((product) => comparableText(product.name).includes("sun shield") || comparableText(product.name).includes("sunshield")) ||
    catalog.find(isSunShieldProduct) ||
    null
  );
}

function toRecommendedProduct(product, salesNote) {
  return {
    name: product.name,
    time: product.time || product.usageTime || "Salon önerisine göre",
    purpose: product.purpose || product.usagePurpose || "Ev devam bakımı",
    salesNote:
      salesNote ||
      product.salesNote ||
      `${product.purpose || product.usagePurpose || "Ev devam bakımı"} odağı nedeniyle salon tarafından önerilebilir.`,
  };
}

function productCatalogLines(productCatalog = []) {
  if (!Array.isArray(productCatalog) || !productCatalog.length) {
    return "Ürün kataloğu boş. recommendedProducts alanını boş dizi olarak döndür.";
  }

  return productCatalog
    .map(
      (product, index) =>
        `${index + 1}. ${product.name} - kullanım amacı: ${product.usagePurpose} - kullanım zamanı: ${
          product.usageTime || "Salon önerisine göre"
        }`,
    )
    .join("\n");
}

function buildPrompt(input) {
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
Tüm skorları mutlaka 0-100 aralığında tam sayı olarak döndür. 10 üzerinden puanlama yapma. Örneğin 7/10 yerine 70, 8/10 yerine 80 döndür.

Form: müşteri=${input.customerName}, yaş=${input.age ?? "-"}, cinsiyet=${input.gender ?? "-"}, ciltTipi=${input.skinType}, anaŞikayet=${input.mainConcern}, SPF=${input.spfUsage}, evRutini=${input.homeCareRoutine}, not=${input.notes || "-"}.
aiComment alanında 5-7 cümlelik detaylı bir kozmetik analiz yaz. Fotoğraflarda görülebilen nem dengesi, ton eşitsizliği, gözenek görünümü, ince çizgi eğilimi, hassasiyet izlenimi ve kullanıcının form yanıtları arasındaki ilişkiyi açıkla. Kullanılan puanların nedenlerini kısa gerekçelerle belirt. Salonun müşteriye aktarabileceği profesyonel ama anlaşılır bir dil kullan.

Veritabanındaki aktif ev devam ürünleri:
${productCatalogLines(input.productCatalog)}

recommendedProducts alanında yalnızca yukarıdaki ürün listesinden ilgili olan tam 4 ürünü seç.
Ürün adı listedeki name ile birebir aynı olmalı.
SUN SHIELD güneş koruyucu sistem tarafından ayrıca ilk sıraya eklenecek; bu nedenle recommendedProducts içinde SUN SHIELD veya güneş koruyucu/SPF ürünü seçme.
purpose alanında listedeki kullanım amacını kullan.
salesNote alanında bu ürünün analiz sonucuyla neden ilgili olduğunu salon satış diline uygun, kısa ve kozmetik çerçevede açıkla.
Listede olmayan ürün adı yazma.
Yalnızca kısa ve geçerli JSON döndür:
{"overallScore":0,"scores":{"hydration":0,"pigmentation":0,"pores":0,"wrinkles":0,"sensitivity":0},"aiComment":"5-7 cümlelik detaylı Türkçe kozmetik analiz","recommendedProtocol":{"name":"","sessions":6,"frequency":"","salonNote":""},"recommendedProducts":[{"name":"","time":"","purpose":"","salesNote":""}]}
`;
}

function normalizeRecommendedProducts(input, payloadProducts) {
  const catalog = Array.isArray(input.productCatalog) ? input.productCatalog : [];
  if (!catalog.length) return [];

  const sunShieldProduct = findSunShieldProduct(catalog);
  const fixedSunShield = sunShieldProduct
    ? {
        name: sunShieldProduct.name,
        time: sunShieldProduct.usageTime || "Sabah",
        purpose: "Güneş koruyucu",
        salesNote: "Her analiz sonrasında gündüz rutininin ilk adımı olarak güneş korumasını desteklemek için önerilir.",
      }
    : {
        name: "SUN SHIELD",
        time: "Sabah",
        purpose: "Güneş koruyucu",
        salesNote: "Her analiz sonrasında gündüz rutininin ilk adımı olarak güneş korumasını desteklemek için önerilir.",
      };

  const selectedKeys = new Set([productKey(fixedSunShield.name)]);
  const catalogByName = new Map(catalog.map((product) => [productKey(product.name), product]));
  const result = [fixedSunShield];

  if (Array.isArray(payloadProducts)) {
    for (const product of payloadProducts) {
      if (result.length >= TOTAL_RECOMMENDED_PRODUCTS) break;

      const catalogProduct = catalogByName.get(productKey(product?.name));
      if (!catalogProduct || isSunShieldProduct(catalogProduct) || selectedKeys.has(productKey(catalogProduct.name))) {
        continue;
      }

      result.push(toRecommendedProduct(catalogProduct, product?.salesNote));
      selectedKeys.add(productKey(catalogProduct.name));
    }
  }

  for (const product of catalog) {
    if (result.length >= TOTAL_RECOMMENDED_PRODUCTS) break;
    if (isSunShieldProduct(product) || selectedKeys.has(productKey(product.name))) continue;

    result.push(toRecommendedProduct(product));
    selectedKeys.add(productKey(product.name));
  }

  return result.slice(0, TOTAL_RECOMMENDED_PRODUCTS);
}

function normalizeOutput(input, payload) {
  const rawScores = {
    hydration: payload?.scores?.hydration,
    pigmentation: payload?.scores?.pigmentation,
    pores: payload?.scores?.pores,
    wrinkles: payload?.scores?.wrinkles,
    sensitivity: payload?.scores?.sensitivity,
  };
  const rawOverallScore = payload?.overallScore;
  const useTenPointScale = shouldConvertTenPointScale(rawScores, rawOverallScore);
  const scores = {
    hydration: normalizeScore(rawScores.hydration, useTenPointScale),
    pigmentation: normalizeScore(rawScores.pigmentation, useTenPointScale),
    pores: normalizeScore(rawScores.pores, useTenPointScale),
    wrinkles: normalizeScore(rawScores.wrinkles, useTenPointScale),
    sensitivity: normalizeScore(rawScores.sensitivity, useTenPointScale),
  };
  const averageScore = (scores.hydration + scores.pigmentation + scores.pores + scores.wrinkles + scores.sensitivity) / 5;
  const overallScore = normalizeScore(rawOverallScore ?? averageScore, useTenPointScale);

  return {
    reportId: "openai-vision-report",
    customerId: input.customerId,
    customerName: input.customerName,
    createdAt: new Date().toISOString(),
    overallScore,
    scores,
    skinType: input.skinType,
    mainConcern: input.mainConcern,
    aiComment:
      typeof payload?.aiComment === "string" && payload.aiComment.trim()
        ? payload.aiComment.trim()
        : "Fotoğraflar ve form bilgileri birlikte değerlendirildi. Cilt bariyerini destekleyen, nem dengesini koruyan ve SPF kullanımını düzenli hale getiren bir bakım planı önerilir.",
    rawAiResponse: payload || null,
    recommendedProtocol: {
      name: payload?.recommendedProtocol?.name || "HydraCare Cilt Bakım Protokolü",
      sessions: Number(payload?.recommendedProtocol?.sessions) || 6,
      frequency: payload?.recommendedProtocol?.frequency || "Haftada 1",
      salonNote: payload?.recommendedProtocol?.salonNote || "Cilt yanıtı her seansta tekrar değerlendirilmelidir.",
    },
    recommendedProducts: normalizeRecommendedProducts(input, payload?.recommendedProducts),
  };
}

export async function runOpenAIVisionAnalysis(input) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: OPENAI_TIMEOUT_MS,
  });
  const imageContent = orderedPhotoEntries(input.photos).map(([, imageUrl]) => ({
    type: "input_image",
    image_url: imageUrl,
    detail: "low",
  }));

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    max_output_tokens: 900,
    reasoning: { effort: "minimal" },
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildPrompt(input),
          },
          ...imageContent,
        ],
      },
    ],
  });

  const payload = parseJsonResponse(response.output_text);
  return normalizeOutput(input, payload);
}
