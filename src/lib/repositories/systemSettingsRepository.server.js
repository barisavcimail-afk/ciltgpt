import { prisma } from "./customerRepository.server.js";

let ensured = false;

async function ensureSystemSettingTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SystemSetting" (
      "id" TEXT PRIMARY KEY,
      "key" TEXT NOT NULL UNIQUE,
      "value" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  ensured = true;
}

function createId() {
  return `sys_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function getSystemSetting(key) {
  await ensureSystemSettingTable();
  const rows = await prisma.$queryRawUnsafe(
    'SELECT "value" FROM "SystemSetting" WHERE "key" = $1 LIMIT 1',
    key,
  );
  return rows[0]?.value || "";
}

export async function upsertSystemSetting(key, value) {
  await ensureSystemSettingTable();
  const rows = await prisma.$queryRawUnsafe(
    'INSERT INTO "SystemSetting" ("id", "key", "value", "createdAt", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP RETURNING "key", "value", "updatedAt"',
    createId(),
    key,
    value,
  );
  return rows[0];
}

export async function getOpenAIConfig() {
  let databaseApiKey = "";
  let databaseModel = "";
  try {
    databaseApiKey = await getSystemSetting("OPENAI_API_KEY");
    databaseModel = await getSystemSetting("OPENAI_MODEL");
  } catch (error) {
    console.error("OpenAI ayarları veritabanından okunamadı:", error);
  }

  const envApiKey = process.env.OPENAI_API_KEY || "";
  const envModel = process.env.OPENAI_MODEL || "";
  return {
    apiKey: databaseApiKey || envApiKey,
    model: databaseModel || envModel || "gpt-5-mini",
    source: databaseApiKey ? "database" : envApiKey ? "env" : "missing",
  };
}

export async function getPublicSystemSettings() {
  const openAIConfig = await getOpenAIConfig();
  return {
    openAI: {
      configured: Boolean(openAIConfig.apiKey),
      source: openAIConfig.source,
      model: openAIConfig.model,
    },
  };
}
