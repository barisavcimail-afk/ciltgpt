import type { AnalysisInput, AnalysisOutput, AnalysisProvider } from "./types";
import { runOpenAIVisionAnalysis } from "../openai/openaiAnalysis";

declare const process: {
  env: Record<string, string | undefined>;
};

export function createAnalysisRequest(input: AnalysisInput): AnalysisInput {
  return {
    ...input,
    consentAccepted: Boolean(input.consentAccepted),
    photos: input.photos || {},
    notes: input.notes || "",
  };
}

export function getAnalysisProvider(): AnalysisProvider {
  const provider = process.env.ANALYSIS_PROVIDER || "openaiVision";

  if (provider === "openai" || provider === "openaiVision" || provider === "perfectcorp") {
    return provider;
  }

  return "openaiVision";
}

export function generateMockAnalysis(input: AnalysisInput): AnalysisOutput {
  const mainConcern = input.mainConcern;
  const isSensitive = input.skinType === "Hassas" || mainConcern === "Hassasiyet";
  const noSpf = input.spfUsage === "Hayır";

  const scores = {
    hydration: mainConcern === "Kuruluk" ? 52 : 68,
    pigmentation: mainConcern === "Leke" ? 48 : noSpf ? 56 : 66,
    pores: mainConcern === "Gözenek" ? 52 : 61,
    wrinkles: mainConcern === "Kırışıklık" ? 46 : 58,
    sensitivity: isSensitive ? 44 : 73,
  };

  const overallScore = Math.round(
    (scores.hydration + scores.pigmentation + scores.pores + scores.wrinkles + scores.sensitivity) / 5,
  );

  const spfNote = noSpf
    ? " SPF kullanımı özellikle güçlendirilmelidir."
    : " Düzenli SPF kullanımı mevcut protokolü destekler.";

  return {
    reportId: "mock-report-001",
    customerId: input.customerId,
    customerName: input.customerName,
    createdAt: new Date().toISOString(),
    overallScore,
    scores,
    skinType: input.skinType,
    mainConcern,
    aiComment:
      `Analiz sonucuna göre ${input.skinType.toLowerCase()} cilt yapısında ${mainConcern.toLowerCase()} odağı öne çıkmaktadır. ` +
      "Cilt bariyerini destekleyen, nem dengesini koruyan ve ev devam bakımını düzenli hale getiren bir protokol önerilir." +
      spfNote,
    recommendedProtocol: {
      name: "HydraCare Leke ve Nem Dengeleme Protokolü",
      sessions: 6,
      frequency: "Haftada 1",
      salonNote: "İlk 3 seansta bariyer desteği ve nem takibi önerilir.",
    },
    recommendedProducts: [
      {
        name: "HydraCare Gentle Cleanser",
        time: "Sabah / Akşam",
        purpose: "Hassasiyet",
        salesNote: "Hassasiyet yaşayan müşteriler için başlangıç ürünü olarak önerilebilir.",
      },
      {
        name: "HydraCare Barrier Serum",
        time: "Akşam",
        purpose: "Bariyer onarımı",
        salesNote: "Kabin sonrası ev devam rutininde serum adımı olarak konumlandırılabilir.",
      },
      {
        name: "HydraCare SPF 50",
        time: "Sabah",
        purpose: "SPF koruması",
        salesNote: "Leke protokolü alan her müşteriye günlük kullanım için önerilmeli.",
      },
    ],
  };
}

export async function runSkinAnalysis(input: AnalysisInput): Promise<AnalysisOutput> {
  const request = createAnalysisRequest(input);
  const provider = getAnalysisProvider();

  if (provider === "mock") {
    throw new Error("Mock analysis provider is disabled. Set ANALYSIS_PROVIDER=openaiVision.");
  }

  if (provider === "openaiVision") {
    return await runOpenAIVisionAnalysis(request);
  }

  if (provider === "openai") {
    throw new Error("OpenAI provider is not implemented yet");
  }

  throw new Error("PerfectCorp provider is not implemented yet");
}
