import { prisma } from "./customerRepository.server.js";

function normalizeProtocolText(value) {
  const text = String(value || "");
  const repaired = /[ÃÄÅ]/.test(text) ? Buffer.from(text, "latin1").toString("utf8") : text;

  return repaired
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ı", "i")
    .replace(/\bcilt\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function protocolMatchScore(protocol, skinType, mainConcern) {
  const targetSkin = normalizeProtocolText(skinType);
  const targetConcern = normalizeProtocolText(mainConcern);
  const haystack = normalizeProtocolText([protocol.name, protocol.notes].filter(Boolean).join(" "));

  let score = 0;
  if (targetSkin && haystack.includes(targetSkin)) score += 2;
  if (targetConcern && haystack.includes(targetConcern)) score += 4;
  return score;
}

function toRecommendedProtocol(protocol) {
  return {
    name: protocol.name,
    sessions: protocol.sessionCount,
    frequency: protocol.frequency,
    salonNote: protocol.notes || "Cilt yanıtı her seansta tekrar değerlendirilmelidir.",
  };
}

export async function getRecommendedProtocolByAnalysis(salonId, skinType, mainConcern) {
  const protocols = await prisma.protocol.findMany({
    where: {
      salonId,
      isActive: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!protocols.length) return null;

  const ranked = protocols
    .map((protocol) => ({
      protocol,
      score: protocolMatchScore(protocol, skinType, mainConcern),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  return best?.score > 0 ? toRecommendedProtocol(best.protocol) : toRecommendedProtocol(protocols[0]);
}
