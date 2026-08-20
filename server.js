import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const port = Number(process.env.PORT || 3000);
const root = process.cwd();

function loadEnvFile() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const sessions = new Map();
const salonLoginPassword = process.env.SALON_LOGIN_PASSWORD || "123456";
const adminLoginPassword = process.env.ADMIN_LOGIN_PASSWORD || "admin123";
const sessionSecret = process.env.SESSION_SECRET || `${salonLoginPassword}:${adminLoginPassword}:ciltgpt-session`;
const sessionMaxAge = 60 * 60 * 24 * 7;
const rolePermissions = {
  "Salon Yoneticisi": ["dashboard", "customers", "analyses", "reports", "products", "team", "billing", "settings", "subscription", "protocols"],
  "Salon Yöneticisi": ["dashboard", "customers", "analyses", "reports", "products", "team", "billing", "settings", "subscription", "protocols"],
  "Analiz Uzmanı": ["dashboard", "customers", "analyses", "reports", "subscription"],
  "Analiz Uzmani": ["dashboard", "customers", "analyses", "reports", "subscription"],
  "Satış Danışmanı": ["dashboard", "customers:read", "reports", "products"],
  "Satis Danismani": ["dashboard", "customers:read", "reports", "products"],
  Resepsiyon: ["dashboard", "customers", "reports"],
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return index === -1 ? [item, ""] : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
      }),
  );
}

function encodeBase64Url(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeBase64Url(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function signSessionPayload(payload) {
  return createHmac("sha256", sessionSecret).update(payload).digest("base64url");
}

function createSessionToken(session) {
  const cookieSession = {
    id: session.id,
    role: session.role,
    staffRole: session.staffRole || "",
    salonId: session.salonId || null,
    firmId: session.firmId || null,
  };
  const payload = encodeBase64Url({
    ...cookieSession,
    exp: Math.floor(Date.now() / 1000) + sessionMaxAge,
  });
  return `${payload}.${signSessionPayload(payload)}`;
}

function readSessionToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = signSessionPayload(payload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature || "");
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  try {
    const session = decodeBase64Url(payload);
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    const { exp, ...safeSession } = session;
    return safeSession;
  } catch {
    return null;
  }
}

function setSessionCookie(req, res, token) {
  const secure = process.env.VERCEL || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `ciltgpt_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${sessionMaxAge}; SameSite=Lax${secure}`);
}

function createSession(req, res, user) {
  const session = {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username || "",
    role: user.role,
    staffRole: user.staffRole || "",
    salonId: user.salonId || null,
    firmId: user.firmId || null,
    firmName: user.firm?.name || "",
    firmBrandName: user.firm?.brandName || "",
    firmLogoUrl: user.firm?.logoUrl || "",
    salonName: user.salon?.name || "",
    salonLogoUrl: user.salon?.logoUrl || "",
  };
  const token = createSessionToken(session);
  sessions.set(token, session);
  setSessionCookie(req, res, token);
  return session;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, hash] = storedHash.split(":");
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(String(password), salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hasRolePermission(session, permission) {
  if (!session || session.role === "ADMIN") return false;
  if (session.role === "SALON_OWNER") return true;
  const staffRole = session.staffRole || "";
  const permissions = rolePermissions[staffRole] || [];
  return permissions.includes(permission) || permissions.includes(permission.split(":")[0]);
}

function clearSession(req, res) {
  const token = parseCookies(req).ciltgpt_session;
  if (token) sessions.delete(token);
  const secure = process.env.VERCEL || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `ciltgpt_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`);
}

function getSession(req) {
  const token = parseCookies(req).ciltgpt_session;
  if (!token) return null;
  return readSessionToken(token) || sessions.get(token) || null;
}

function requireSalonSession(req, res, permission = "") {
  const session = getSession(req);
  if (!session || !session.salonId || session.role === "ADMIN") {
    sendJson(res, 401, { message: "Salon paneline erişmek için giriş yapın." });
    return null;
  }
  if (permission && !hasRolePermission(session, permission)) {
    sendJson(res, 403, { message: "Bu işlem için rol yetkiniz bulunmuyor." });
    return null;
  }
  return session;
}

function requireAdminSession(req, res) {
  const session = getSession(req);
  if (!session || session.role !== "ADMIN") {
    sendJson(res, 401, { message: "Admin paneline erişmek için admin girişi yapın." });
    return null;
  }
  return session;
}

function requireFirmSession(req, res) {
  const session = getSession(req);
  if (!session || session.role !== "FIRM" || !session.firmId) {
    sendJson(res, 401, { message: "Firma paneline erişmek için firma girişi yapın." });
    return null;
  }
  return session;
}

function sendFile(res, statusCode, contentType, buffer, filename) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": buffer.length,
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
  res.end(buffer);
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf-8");
  return rawBody ? JSON.parse(rawBody) : {};
}

async function readRequestBuffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function detectCsvDelimiter(text) {
  const firstLine = String(text || "").split(/\r?\n/).find((line) => line.trim()) || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  if (tabCount >= semicolonCount && tabCount >= commaCount && tabCount > 0) return "\t";
  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;
  const delimiter = detectCsvDelimiter(text);

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function decodeHtmlCell(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function parseHtmlTableRows(text) {
  const rows = [];
  const rowMatches = String(text || "").match(/<tr[\s\S]*?<\/tr>/gi) || [];

  for (const rowHtml of rowMatches) {
    const cells = [];
    const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let match = cellRegex.exec(rowHtml);
    while (match) {
      cells.push(decodeHtmlCell(match[1]));
      match = cellRegex.exec(rowHtml);
    }
    if (cells.some(Boolean)) rows.push(cells);
  }

  return rows;
}

function parseProductImportRows(text) {
  const raw = String(text || "");
  if (/<table[\s\S]*<\/table>/i.test(raw)) {
    const rows = parseHtmlTableRows(raw);
    if (rows.length) return rows;
  }
  return parseCsvRows(raw).filter((row) => !String(row[0] || "").trim().toLowerCase().startsWith("sep="));
}

function decodeUploadedText(buffer) {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!utf8.includes("\uFFFD")) return utf8;

  try {
    return new TextDecoder("windows-1254", { fatal: false }).decode(buffer);
  } catch {
    return utf8;
  }
}

function extractMultipartFileText(req, buffer) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return decodeUploadedText(buffer);

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const rawBinary = buffer.toString("latin1");
  const parts = rawBinary.split(`--${boundary}`);
  const filePart = parts.find((part) => part.includes('name="file"')) || "";
  const separator = filePart.indexOf("\r\n\r\n");
  if (separator === -1) return "";

  const fileBinary = filePart.slice(separator + 4).replace(/\r\n--$/, "").trim();
  return decodeUploadedText(Buffer.from(fileBinary, "latin1"));
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function productTemplateCsv() {
  const rows = [
    ["name", "brand", "category", "usagePurpose", "usageTime", "isActive", "isCabinProduct"],
    ["HydraCare Gentle Cleanser", "HedraCare", "Temizleyici", "Hassasiyet", "Sabah/Akşam", "true", "false"],
  ];
  return "\uFEFFsep=;\r\n" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

function normalizeImportHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

function toGenderEnum(value) {
  if (value === "Kadın" || value === "Kadin" || value === "FEMALE") return "FEMALE";
  if (value === "Erkek" || value === "MALE") return "MALE";
  if (value === "OTHER") return "OTHER";
  return "UNSPECIFIED";
}

function toGenderLabel(value) {
  if (value === "FEMALE") return "Kadın";
  if (value === "MALE") return "Erkek";
  if (value === "OTHER") return "Diğer";
  return "Belirtmek istemiyor";
}

function customerResponse(customer) {
  const lastAnalysis = customer.analyses?.[0];

  return {
    id: customer.id,
    fullName: customer.fullName,
    phone: customer.phone,
    age: customer.age ?? "",
    gender: toGenderLabel(customer.gender),
    notes: customer.notes ?? "",
    createdAt: customer.createdAt,
    lastAnalysisDate: lastAnalysis?.createdAt ?? null,
    status: "Aktif",
  };
}

function reportResponse(report, analysisOutput, customer) {
  return {
    reportId: report.id,
    customerId: customer.id,
    customerName: customer.fullName,
    createdAt: report.createdAt,
    overallScore: report.overallScore,
    scores: {
      hydration: report.hydrationScore,
      pigmentation: report.pigmentationScore,
      pores: report.poreScore,
      wrinkles: report.wrinkleScore,
      sensitivity: report.sensitivityScore,
    },
    skinType: analysisOutput.skinType,
    mainConcern: analysisOutput.mainConcern,
    aiComment: report.aiComment,
    rawAiResponse: report.rawAiResponse || analysisOutput.rawAiResponse || null,
    recommendedProtocol: analysisOutput.recommendedProtocol,
    recommendedProducts: analysisOutput.recommendedProducts,
  };
}

function normalizeAnalysisPhotos(photos) {
  if (!photos || typeof photos !== "object") return {};
  const allowedKeys = ["front", "left", "right", "close"];
  return Object.fromEntries(
    allowedKeys
      .map((key) => [key, typeof photos[key] === "string" && photos[key].startsWith("data:image/") ? photos[key] : ""])
      .filter(([, value]) => value)
  );
}

function databaseReportResponse(report) {
  const analysis = report.analysis;
  const customer = analysis?.customer;
  const recommendedProtocol = report.recommendedProtocol && typeof report.recommendedProtocol === "object" ? report.recommendedProtocol : null;
  const recommendedProducts = Array.isArray(report.recommendedProducts) ? report.recommendedProducts : [];

  return {
    id: report.id,
    reportId: report.id,
    customerId: customer?.id || "",
    customerName: customer?.fullName || "-",
    age: customer?.age ?? "-",
    analysisDate: report.createdAt,
    overallScore: report.overallScore,
    skinType: analysis?.skinType || "-",
    complaint: analysis?.mainConcern || "-",
    status: analysis?.status === "COMPLETED" ? "Rapor hazır" : "Analiz bekliyor",
    salonNote: "İlk 3 seansta bariyer desteği ve nem takibi önerilir.",
    aiComment: report.aiComment,
    rawAiResponse: report.rawAiResponse || null,
    analysisPhotos: analysis?.photos || {},
    recommendedProtocol,
    recommendedProducts,
    salonBranding: report.salon
      ? {
          salonName: report.salon.name,
          reportSalonName: report.salon.reportSalonName || report.salon.name,
          whatsapp: report.salon.whatsapp || "",
          phone: report.salon.phone,
          email: report.salon.email,
          city: report.salon.city,
          address: report.salon.address,
          reportFooter: report.salon.reportFooter || "",
          logoUrl: report.salon.logoUrl || "",
        }
      : null,
    scores: {
      Nem: report.hydrationScore,
      Leke: report.pigmentationScore,
      Gözenek: report.poreScore,
      Kırışıklık: report.wrinkleScore,
      Hassasiyet: report.sensitivityScore,
    },
  };
}

function normalizePdfText(value) {
  return String(value ?? "")
    .replaceAll("ğ", "g")
    .replaceAll("Ğ", "G")
    .replaceAll("ı", "i")
    .replaceAll("İ", "I")
    .replaceAll("ö", "o")
    .replaceAll("Ö", "O")
    .replaceAll("ü", "u")
    .replaceAll("Ü", "U")
    .replaceAll("ş", "s")
    .replaceAll("Ş", "S")
    .replaceAll("ç", "c")
    .replaceAll("Ç", "C")
    .replace(/[^\x20-\x7E]/g, " ");
}

function escapePdfText(value) {
  return normalizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapPdfText(value, maxLength = 88) {
  const words = normalizePdfText(value).split(/\s+/).filter(Boolean);
  let lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function pdfTextLine(text, x, y, size = 10, font = "F1") {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;
}

function pdfColoredTextLine(text, x, y, size = 10, font = "F1", color = [0, 0, 0]) {
  return `q ${color.join(" ")} rg BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET Q`;
}

function pdfFillRect(x, y, width, height, color = [1, 1, 1]) {
  return `q ${color.join(" ")} rg ${x} ${y} ${width} ${height} re f Q`;
}

function pdfStrokeRect(x, y, width, height, color = [0.85, 0.89, 0.87], lineWidth = 1) {
  return `q ${lineWidth} w ${color.join(" ")} RG ${x} ${y} ${width} ${height} re S Q`;
}

function pdfLine(x1, y1, x2, y2, color = [0.89, 0.93, 0.91], lineWidth = 1) {
  return `q ${lineWidth} w ${color.join(" ")} RG ${x1} ${y1} m ${x2} ${y2} l S Q`;
}

function pdfRoundedRectPath(x, y, width, height, radius = 10) {
  const r = Math.min(radius, width / 2, height / 2);
  const c = 0.5522847498;
  return [
    `${x + r} ${y} m`,
    `${x + width - r} ${y} l`,
    `${x + width - r + r * c} ${y} ${x + width} ${y + r - r * c} ${x + width} ${y + r} c`,
    `${x + width} ${y + height - r} l`,
    `${x + width} ${y + height - r + r * c} ${x + width - r + r * c} ${y + height} ${x + width - r} ${y + height} c`,
    `${x + r} ${y + height} l`,
    `${x + r - r * c} ${y + height} ${x} ${y + height - r + r * c} ${x} ${y + height - r} c`,
    `${x} ${y + r} l`,
    `${x} ${y + r - r * c} ${x + r - r * c} ${y} ${x + r} ${y} c`,
    "h",
  ].join(" ");
}

function pdfFillRoundedRect(x, y, width, height, radius = 10, color = [1, 1, 1]) {
  return `q ${color.join(" ")} rg ${pdfRoundedRectPath(x, y, width, height, radius)} f Q`;
}

function pdfStrokeRoundedRect(x, y, width, height, radius = 10, color = [0.85, 0.89, 0.87], lineWidth = 1) {
  return `q ${lineWidth} w ${color.join(" ")} RG ${pdfRoundedRectPath(x, y, width, height, radius)} S Q`;
}

function pdfCirclePath(cx, cy, radius) {
  const c = 0.5522847498;
  const r = radius;
  return [
    `${cx + r} ${cy} m`,
    `${cx + r} ${cy + r * c} ${cx + r * c} ${cy + r} ${cx} ${cy + r} c`,
    `${cx - r * c} ${cy + r} ${cx - r} ${cy + r * c} ${cx - r} ${cy} c`,
    `${cx - r} ${cy - r * c} ${cx - r * c} ${cy - r} ${cx} ${cy - r} c`,
    `${cx + r * c} ${cy - r} ${cx + r} ${cy - r * c} ${cx + r} ${cy} c`,
    "h",
  ].join(" ");
}

function pdfFillCircle(cx, cy, radius, color = [0.02, 0.31, 0.22]) {
  return `q ${color.join(" ")} rg ${pdfCirclePath(cx, cy, radius)} f Q`;
}

const pdfPasswordPadding = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
  0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

function md5(buffer) {
  return createHash("md5").update(buffer).digest();
}

function rc4(key, data) {
  const state = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;

  for (let i = 0; i < 256; i += 1) {
    j = (j + state[i] + key[i % key.length]) & 255;
    [state[i], state[j]] = [state[j], state[i]];
  }

  const output = Buffer.alloc(data.length);
  let i = 0;
  j = 0;

  for (let offset = 0; offset < data.length; offset += 1) {
    i = (i + 1) & 255;
    j = (j + state[i]) & 255;
    [state[i], state[j]] = [state[j], state[i]];
    const k = state[(state[i] + state[j]) & 255];
    output[offset] = data[offset] ^ k;
  }

  return output;
}

function padPdfPassword(password) {
  const source = Buffer.from(String(password || ""), "latin1");
  if (source.length >= 32) return source.subarray(0, 32);
  return Buffer.concat([source, pdfPasswordPadding]).subarray(0, 32);
}

function createPdfEncryption(password) {
  if (!password) return null;
  const userPassword = padPdfPassword(password);
  const ownerPassword = padPdfPassword(password);
  const ownerKey = md5(ownerPassword).subarray(0, 5);
  const ownerEntry = rc4(ownerKey, userPassword);
  const permissions = -4;
  const permissionsBuffer = Buffer.alloc(4);
  permissionsBuffer.writeInt32LE(permissions, 0);
  const fileId = randomBytes(16);
  const encryptionKey = md5(Buffer.concat([userPassword, ownerEntry, permissionsBuffer, fileId])).subarray(0, 5);
  const userEntry = rc4(encryptionKey, pdfPasswordPadding);

  return {
    dictionary: `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${ownerEntry.toString("hex")}> /U <${userEntry.toString("hex")}> /P ${permissions} >>`,
    encryptStream(objectNumber, data) {
      const objectBytes = Buffer.from([
        objectNumber & 255,
        (objectNumber >> 8) & 255,
        (objectNumber >> 16) & 255,
        0,
        0,
      ]);
      const objectKey = md5(Buffer.concat([encryptionKey, objectBytes])).subarray(0, 10);
      return rc4(objectKey, data);
    },
    fileId: fileId.toString("hex"),
  };
}

function createSimplePdf(linesOrPages, options = {}) {
  const pages = Array.isArray(linesOrPages[0]) ? linesOrPages : [linesOrPages];
  const imagesByPage = Array.isArray(options.imagesByPage) ? options.imagesByPage : [];
  const pageObjectIds = pages.map((_, index) => 5 + index * 2);
  const imageObjectStartId = 5 + pages.length * 2;
  let imageCounter = 0;
  const pageImageRefs = pages.map((_, pageIndex) => {
    const pageImages = Array.isArray(imagesByPage[pageIndex]) ? imagesByPage[pageIndex] : [];
    return pageImages.map((image) => ({ ...image, objectId: imageObjectStartId + imageCounter++ }));
  });
  const encryption = createPdfEncryption(options.password);
  const objects = [
    { body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { body: `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>` },
    { body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
    { body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>" },
  ];

  pages.forEach((pageLines, index) => {
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = pageObjectId + 1;
    const content = Buffer.from(pageLines.join("\n"), "utf8");
    const imageResources = pageImageRefs[index].length
      ? ` /XObject << ${pageImageRefs[index].map((image) => `/${image.name} ${image.objectId} 0 R`).join(" ")} >>`
      : "";
    objects.push(
      { body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${imageResources} >> /Contents ${contentObjectId} 0 R >>` },
      { stream: content },
    );
  });

  pageImageRefs.flat().forEach((image) => {
    objects.push({
      dictionary: `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length __LENGTH__ >>`,
      stream: image.data,
    });
  });

  if (encryption) objects.push({ body: encryption.dictionary });

  const chunks = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets = [0];
  let byteLength = chunks[0].length;

  objects.forEach((object, index) => {
    const objectNumber = index + 1;
    offsets.push(byteLength);
    const header = Buffer.from(`${objectNumber} 0 obj\n`, "latin1");
    chunks.push(header);
    byteLength += header.length;

    if (object.stream) {
      const stream = encryption ? encryption.encryptStream(objectNumber, object.stream) : object.stream;
      const dictionary = object.dictionary
        ? object.dictionary.replace("__LENGTH__", String(stream.length))
        : `<< /Length ${stream.length} >>`;
      const streamHeader = Buffer.from(`${dictionary}\nstream\n`, "latin1");
      const streamFooter = Buffer.from("\nendstream", "latin1");
      chunks.push(streamHeader, stream, streamFooter);
      byteLength += streamHeader.length + stream.length + streamFooter.length;
    } else {
      const body = Buffer.from(object.body, "latin1");
      chunks.push(body);
      byteLength += body.length;
    }

    const footer = Buffer.from("\nendobj\n", "latin1");
    chunks.push(footer);
    byteLength += footer.length;
  });

  const xrefOffset = byteLength;
  const xrefChunks = [Buffer.from(`xref\n0 ${objects.length + 1}\n`, "latin1"), Buffer.from("0000000000 65535 f \n", "latin1")];
  for (let index = 1; index <= objects.length; index += 1) {
    xrefChunks.push(Buffer.from(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`, "latin1"));
  }

  const encryptObjectNumber = encryption ? objects.length : null;
  const idTrailer = encryption ? ` /Encrypt ${encryptObjectNumber} 0 R /ID [<${encryption.fileId}> <${encryption.fileId}>]` : "";
  xrefChunks.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${idTrailer} >>\nstartxref\n${xrefOffset}\n%%EOF`, "latin1"));

  return Buffer.concat([...chunks, ...xrefChunks]);
}
function parseJpegSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  const sizeMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    if (sizeMarkers.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }

  return null;
}

function pdfImageFromDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:image\/(?:jpeg|jpg);base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) return null;
  const data = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  const size = parseJpegSize(data);
  if (!size || !size.width || !size.height) return null;
  return { data, width: size.width, height: size.height };
}

function pdfPhotoEntries(photos) {
  const labels = {
    front: "On yuz",
    left: "Sol profil",
    right: "Sag profil",
    close: "Yakin plan",
  };

  return Object.entries(labels)
    .map(([key, label]) => {
      const image = pdfImageFromDataUrl(photos?.[key]);
      return image ? { label, image } : null;
    })
    .filter(Boolean);
}
function createReportPdf(report) {
  const data = databaseReportResponse(report);
  const date = new Date(data.analysisDate).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const branding = data.salonBranding || {};
  const salonName = branding.reportSalonName || branding.salonName || report.salon?.name || "CiltGPT Salon";
  const salonPhone = branding.phone || report.salon?.phone || "";
  const salonWhatsapp = branding.whatsapp || salonPhone || "-";
  const salonEmail = branding.email || report.salon?.email || "";
  const salonCity = branding.city || report.salon?.city || "";
  const salonAddress = branding.address || report.salon?.address || "";
  const footerNote = branding.reportFooter || "Bu rapor kozmetik bakım önerisi amacıyla hazırlanmıştır.";
  const protocol = data.recommendedProtocol || {};
  const products = Array.isArray(data.recommendedProducts) ? data.recommendedProducts : [];
  const customerName = String(data.customerName || "-").toLocaleLowerCase("tr-TR");
  const pages = [];
  const pageImages = [];
  let lines = [];
  const page = { width: 595, height: 842 };
  const content = { x: 42, width: 511 };
  const green = [0.08, 0.55, 0.32];
  const deepGreen = [0.03, 0.25, 0.18];
  const gold = [0.72, 0.58, 0.32];
  const greenSoft = [0.93, 0.98, 0.95];
  const paper = [1, 1, 1];
  const background = [0.96, 0.98, 0.97];
  const border = [0.86, 0.92, 0.88];
  let y = 0;

  const textLine = (value, x, textY, size = 10, font = "F1") => {
    lines.push(pdfTextLine(value, x, textY, size, font));
  };
  const roundedBox = (x, boxY, width, height, radius = 10, fill = paper, stroke = border) => {
    lines.push(pdfFillRoundedRect(x, boxY, width, height, radius, fill));
    lines.push(pdfStrokeRoundedRect(x, boxY, width, height, radius, stroke, 1));
  };
  const startPage = () => {
    lines = [];
    pages.push(lines);
    pageImages.push([]);
    lines.push(pdfFillRect(0, 0, page.width, page.height, background));
    lines.push(pdfFillRect(30, 24, 535, 794, paper));
    lines.push(pdfStrokeRect(30, 24, 535, 794, [0.88, 0.93, 0.9], 1));
    y = 775;
  };
  const ensureSpace = (height) => {
    if (y - height < 66) startPage();
  };
  const sectionTitle = (title) => {
    ensureSpace(42);
    lines.push(pdfColoredTextLine(title, content.x, y, 16, "F2", green));
    y -= 24;
  };
  const paragraph = (value, x, startY, maxLength = 80, size = 10, gap = 15, font = "F1") => {
    const linesToRender = wrapPdfText(value, maxLength);
    linesToRender.forEach((line, index) => textLine(line, x, startY - index * gap, size, index === 0 ? font : "F1"));
    return linesToRender.length * gap;
  };
  const infoCard = (x, boxY, width, label, value) => {
    roundedBox(x, boxY, width, 72, 11, paper);
    textLine(label, x + 14, boxY + 45, 10, "F2");
    textLine(value, x + 14, boxY + 23, 15, "F2");
  };
  const scoreCard = (x, boxY, width, label, value) => {
    const score = Math.min(Math.max(Number(value) || 0, 0), 100);
    roundedBox(x, boxY, width, 72, 11, paper);
    textLine(label, x + 13, boxY + 48, 10, "F2");
    textLine(`${score}/100`, x + 13, boxY + 24, 15, "F2");
    lines.push(pdfFillRoundedRect(x + 13, boxY + 12, width - 26, 7, 3, [0.91, 0.94, 0.92]));
    lines.push(pdfFillRoundedRect(x + 13, boxY + 12, Math.max(8, (width - 26) * (score / 100)), 7, 3, green));
  };
  const currentPageImages = () => pageImages[pageImages.length - 1] || [];
  const drawPhotoCard = (label, image, x, boxY, width, height) => {
    roundedBox(x, boxY, width, height, 11, paper);
    textLine(label, x + 13, boxY + height - 22, 10, "F2");
    const areaX = x + 12;
    const areaY = boxY + 14;
    const areaWidth = width - 24;
    const areaHeight = height - 48;
    lines.push(pdfFillRoundedRect(areaX, areaY, areaWidth, areaHeight, 8, [0.96, 0.98, 0.97]));
    const scale = Math.min(areaWidth / image.width, areaHeight / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const drawX = areaX + (areaWidth - drawWidth) / 2;
    const drawY = areaY + (areaHeight - drawHeight) / 2;
    const imageName = `Im${currentPageImages().length + 1}`;
    currentPageImages().push({ ...image, name: imageName });
    lines.push(`q ${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm /${imageName} Do Q`);
  };

  startPage();
  lines.push(pdfFillCircle(content.x + 34, y - 10, 28, deepGreen));
  lines.push(pdfColoredTextLine("BB", content.x + 17, y - 18, 22, "F2", gold));
  lines.push(pdfColoredTextLine(salonName, content.x + 78, y + 4, 22, "F2", deepGreen));
  textLine([salonCity, salonPhone].filter(Boolean).join(" - "), content.x + 79, y - 22, 14, "F1");
  lines.push(pdfLine(content.x, y - 52, content.x + content.width, y - 52, [0.86, 0.91, 0.88], 1));
  y -= 88;

  infoCard(content.x, y - 72, 178, "Musteri", customerName);
  infoCard(content.x + 198, y - 72, 154, "Analiz tarihi", date);
  infoCard(content.x + 372, y - 72, 139, "Genel cilt skoru", `${data.overallScore}/100`);
  y -= 100;

  sectionTitle("Rapor Ozeti");
  const summaryText = `${customerName} icin hazirlanan bu kozmetik cilt analizinde ${data.skinType} cilt tipi ve ${data.complaint} ana sikayeti dikkate alinmistir.`;
  const summaryLines = wrapPdfText(summaryText, 77);
  const summaryHeight = Math.max(116, 58 + summaryLines.length * 17);
  roundedBox(content.x, y - summaryHeight, content.width, summaryHeight, 12, paper);
  paragraph(summaryText, content.x + 18, y - 34, 77, 13, 18, "F2");
  textLine(`Yas: ${data.age || "-"} - Durum: ${data.status}`, content.x + 18, y - summaryHeight + 34, 12, "F1");
  y -= summaryHeight + 28;

  sectionTitle("Skor Kartlari");
  const scoreSectionHeight = 228;
  roundedBox(content.x, y - scoreSectionHeight, content.width, scoreSectionHeight, 12, paper);
  const scores = [["Genel cilt skoru", data.overallScore], ...Object.entries(data.scores || {})];
  scores.forEach(([label, value], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = content.x + 19 + column * 168;
    const boxY = y - 95 - row * 86;
    scoreCard(x, boxY, 150, label, value);
  });
  y -= scoreSectionHeight + 34;

  ensureSpace(185);
  sectionTitle("AI Yorum");
  const aiLines = wrapPdfText(data.aiComment, 78);
  const aiHeight = Math.max(145, 40 + aiLines.length * 15);
  roundedBox(content.x, y - aiHeight, content.width, aiHeight, 10, paper);
  paragraph(data.aiComment, content.x + 18, y - 28, 78, 10, 15);
  y -= aiHeight + 28;

  const protocolName = protocol.name || "Protokol onerisi";
  const protocolSessions = protocol.sessions || protocol.sessionCount || "-";
  const protocolFrequency = protocol.frequency || "-";
  const protocolNote = protocol.salonNote || "Cilt skorlari ve uzman degerlendirmesi dogrultusunda, onerilen kabin protokolu salon uzmaniniz tarafindan kisiye ozel olarak guncellenebilir.";
  const protocolText = `${protocolName}. Seans sayisi: ${protocolSessions}. Siklik: ${protocolFrequency}. ${protocolNote}`;
  const protocolLines = wrapPdfText(protocolText, 78);
  const protocolHeight = Math.max(116, 40 + protocolLines.length * 15);
  ensureSpace(protocolHeight + 60);
  sectionTitle("Onerilen Kabin Protokolu");
  roundedBox(content.x, y - protocolHeight, content.width, protocolHeight, 10, greenSoft);
  paragraph(protocolText, content.x + 18, y - 28, 78, 10, 15, "F2");
  y -= protocolHeight + 28;

  ensureSpace(160);
  sectionTitle("Onerilen Ev Devam Urunleri");
  textLine("Bu urunler salonunuz tarafindan musteriye ev devam bakimi olarak onerilebilir.", content.x, y, 10, "F1");
  y -= 22;
  const productRows = products.length
    ? products
    : [{ name: "Urun onerisi bulunmuyor", time: "", purpose: "", salesNote: "" }];
  productRows.forEach((product) => {
    const details = [product.time, product.purpose].filter(Boolean).join(" - ");
    const salesNote = product.salesNote ? ` ${product.salesNote}` : "";
    const productText = `${product.name || "Urun"}${details ? ` - ${details}` : ""}${salesNote}`;
    const productLines = wrapPdfText(productText, 78);
    const productHeight = Math.max(54, 26 + productLines.length * 14);
    ensureSpace(productHeight + 14);
    roundedBox(content.x, y - productHeight, content.width, productHeight, 10, paper);
    productLines.forEach((line, index) => textLine(line, content.x + 16, y - 18 - index * 14, 10, index === 0 ? "F2" : "F1"));
    y -= productHeight + 10;
  });


  const photoRows = pdfPhotoEntries(data.analysisPhotos);
  if (photoRows.length) {
    const photoCardWidth = 238;
    const photoCardHeight = 168;
    ensureSpace(photoCardHeight + 64);
    sectionTitle("Analiz Fotograflari");
    photoRows.forEach((photo, index) => {
      if (index % 2 === 0 && y - photoCardHeight < 66) {
        startPage();
        sectionTitle("Analiz Fotograflari");
      }
      const column = index % 2;
      const x = content.x + column * (photoCardWidth + 35);
      drawPhotoCard(photo.label, photo.image, x, y - photoCardHeight, photoCardWidth, photoCardHeight);
      if (column === 1 || index === photoRows.length - 1) y -= photoCardHeight + 18;
    });
  }
  ensureSpace(110);
  sectionTitle("Salon Iletisim");
  roundedBox(content.x, y - 82, content.width, 82, 10, greenSoft);
  textLine(`WhatsApp: ${salonWhatsapp} - ${salonEmail || "-"}`, content.x + 16, y - 23, 10, "F2");
  paragraph(salonAddress || "Adres bilgisi bulunmuyor", content.x + 16, y - 42, 82, 9, 12);
  paragraph(footerNote, content.x + 16, y - 62, 82, 9, 12);

  const pdfPassword = getReportPdfPassword(report);
  return createSimplePdf(pages, { password: pdfPassword, imagesByPage: pageImages });
}
function safeFileName(value) {
  return normalizePdfText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "ciltgpt-rapor";
}

function getReportPdfPassword(report) {
  const phone = report.analysis?.customer?.phone || report.customer?.phone || "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  const fallback = String(report.id || "0000").replace(/\D/g, "").slice(-4);
  return fallback.padStart(4, "0");
}
function scoreMapFromReport(report) {
  if (!report) {
    return {
      Nem: 0,
      Leke: 0,
      "Gözenek": 0,
      "Kırışıklık": 0,
      Hassasiyet: 0,
    };
  }

  return {
    Nem: report.hydrationScore,
    Leke: report.pigmentationScore,
    "Gözenek": report.poreScore,
    "Kırışıklık": report.wrinkleScore,
    Hassasiyet: report.sensitivityScore,
  };
}

function customerDetailResponse(customer) {
  const latestAnalysis = customer.analyses?.[0];
  const latestReport = latestAnalysis?.report;

  return {
    id: customer.id,
    fullName: customer.fullName,
    phone: customer.phone,
    age: customer.age ?? "-",
    gender: toGenderLabel(customer.gender),
    notes: customer.notes ?? "",
    createdAt: customer.createdAt,
    lastAnalysisDate: latestAnalysis?.createdAt ?? null,
    status: "Aktif",
    skinSummary: {
      lastScore: latestReport?.overallScore ?? "-",
      skinType: latestAnalysis?.skinType || "-",
      mainConcern: latestAnalysis?.mainConcern || "-",
      sensitivity: latestReport?.sensitivityScore ?? "-",
      spfUsage: "-",
      homeCareRoutine: "-",
    },
    reports: (customer.analyses || [])
      .filter((analysis) => analysis.report)
      .map((analysis) => ({
        id: analysis.report.id,
        date: analysis.report.createdAt,
        overallScore: analysis.report.overallScore,
        mainConcern: analysis.mainConcern,
        status: analysis.status === "COMPLETED" ? "Rapor hazır" : "Analiz bekliyor",
      })),
    productHistory: [],
    reminders: [
      { title: "Kontrol randevusu", detail: "Son analiz tarihine göre takip edilebilir.", status: "Takip gerekiyor" },
      { title: "Ürün yenileme zamanı", detail: "Ürün geçmişi DB'ye taşındığında otomatik hesaplanacak.", status: "Planlanacak" },
      { title: "Yeni analiz önerisi", detail: "Son rapora göre yeni analiz önerisi oluşturulabilir.", status: "Yeni analiz önerilir" },
    ],
    whatsappMessage: `Merhaba ${customer.fullName}, cilt analiziniz sonrası kontrol ve ürün yenileme için salonumuza bekleriz.`,
  };
}

function productResponse(product) {
  const sourceProduct = product.product || product;
  const isActive = product.product ? product.isActive && sourceProduct.isActive : sourceProduct.isActive;
  const status = isActive ? "Aktif" : "Pasif";

  return {
    id: product.id,
    globalProductId: sourceProduct.id,
    name: sourceProduct.name,
    brand: sourceProduct.brand,
    category: sourceProduct.category,
    purpose: sourceProduct.usagePurpose,
    usagePurpose: sourceProduct.usagePurpose,
    time: sourceProduct.usageTime,
    usageTime: sourceProduct.usageTime,
    isCabinProduct: Boolean(sourceProduct.isCabinProduct),
    productType: sourceProduct.isCabinProduct ? "Kabin ürünü" : "Ev devam ürünü",
    status,
    isActive,
    recommendedInReports: isActive,
  };
}

function teamMemberResponse(member) {
  const status = member.isActive ? "Aktif" : "Pasif";

  return {
    id: member.id,
    fullName: member.name,
    name: member.name,
    email: member.email,
    role: member.role,
    status,
    isActive: member.isActive,
  };
}

function packageIdFromName(packageName) {
  return String(packageName || "").toLowerCase();
}

function defaultPackagePlans() {
  return [
    {
      slug: "starter",
      name: "Starter",
      monthlyPriceLabel: "1.490 TL / ay",
      monthlyPriceValue: 1490,
      currency: "TL",
      analysisLimit: 50,
      analysisLimitLabel: "50 analiz",
      userLimit: 1,
      userLimitLabel: "1 kullanıcı",
      status: "Aktif",
      features: ["Temel rapor ekranı", "AI analiz", "Ürün öneri listesi"],
      sortOrder: 1,
    },
    {
      slug: "pro",
      name: "Pro",
      monthlyPriceLabel: "2.990 TL / ay",
      monthlyPriceValue: 2990,
      currency: "TL",
      analysisLimit: 150,
      analysisLimitLabel: "150 analiz",
      userLimit: 3,
      userLimitLabel: "3 kullanıcı",
      status: "Aktif",
      features: ["Gelişmiş raporlar", "Salon ürün yönetimi", "Müşteri takip akışı"],
      sortOrder: 2,
    },
    {
      slug: "premium",
      name: "Premium",
      monthlyPriceLabel: "4.990 TL / ay",
      monthlyPriceValue: 4990,
      currency: "TL",
      analysisLimit: 400,
      analysisLimitLabel: "400 analiz",
      userLimit: 10,
      userLimitLabel: "10 kullanıcı",
      status: "Aktif",
      features: ["Yüksek analiz limiti", "Çoklu kullanıcı", "Öncelikli destek"],
      sortOrder: 3,
    },
    {
      slug: "enterprise",
      name: "Enterprise",
      monthlyPriceLabel: "Teklif al",
      monthlyPriceValue: null,
      currency: "TL",
      analysisLimit: 1000,
      analysisLimitLabel: "1000 analiz",
      userLimit: null,
      userLimitLabel: "Sınırsız kullanıcı",
      status: "Özel",
      features: ["Sınırsız analiz", "Özel kurulum", "Kurumsal destek"],
      sortOrder: 4,
    },
  ];
}

function packagePlanResponse(plan) {
  return {
    id: plan.slug,
    slug: plan.slug,
    name: plan.name,
    price: plan.monthlyPriceLabel,
    monthlyPrice: plan.monthlyPriceLabel,
    monthlyPriceValue: plan.monthlyPriceValue === null || plan.monthlyPriceValue === undefined ? null : Number(plan.monthlyPriceValue),
    currency: plan.currency,
    analysisLimit: plan.analysisLimit,
    analysisLimitLabel: plan.analysisLimitLabel,
    userLimit: plan.userLimitLabel,
    userLimitValue: plan.userLimit,
    status: plan.status,
    features: Array.isArray(plan.features) ? plan.features : [],
    sortOrder: plan.sortOrder,
  };
}

async function ensurePackagePlans(prisma) {
  const count = await prisma.packagePlan.count();
  if (count === 0) {
    for (const plan of defaultPackagePlans()) {
      await prisma.packagePlan.create({ data: plan });
    }
  }
  return prisma.packagePlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
}

async function getPackagePlans(prisma) {
  const plans = await ensurePackagePlans(prisma);
  return plans.map(packagePlanResponse);
}

async function getPackagePlanByName(prisma, packageName) {
  const slug = packageIdFromName(packageName);
  await ensurePackagePlans(prisma);
  return prisma.packagePlan.findFirst({
    where: {
      OR: [{ slug }, { name: { equals: String(packageName || ""), mode: "insensitive" } }],
      isActive: true,
    },
  });
}

function monthlyPriceFromPackage(packageName) {
  return "-";
}

function userLimitFromPackage(packageName) {
  return "-";
}

function numericUserLimitFromPackage(packageName) {
  return null;
}

function firmBalanceResponse(balance) {
  const totalPurchased = balance?.totalPurchased || 0;
  const usedByPromo = balance?.usedByPromo || 0;
  return {
    totalPurchased,
    usedByPromo,
    remaining: Math.max(totalPurchased - usedByPromo, 0),
  };
}

function promoCodeResponse(code) {
  return {
    id: code.id,
    code: code.code,
    packageName: code.packageName,
    monthlyLimit: code.monthlyLimit,
    userLimit: code.userLimit,
    status: code.status === "ACTIVE" ? "Aktif" : code.status === "USED" ? "Kullanıldı" : "İptal",
    usedAt: code.usedAt,
    usedBySalonName: code.usedBySalon?.name || "",
    createdAt: code.createdAt,
  };
}

function generatePromoCodeText(packageName) {
  const prefix = String(packageName || "PKT").slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "P");
  return `${prefix}-${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

async function getValidFirmPromoCode(tx, codeText, firmId) {
  const normalizedCode = String(codeText || "").trim().toUpperCase();
  if (!normalizedCode) return null;

  const promoCode = await tx.firmPromoCode.findUnique({ where: { code: normalizedCode } });
  if (!promoCode) {
    throw new Error("Promosyon kodu bulunamadı.");
  }
  if (promoCode.firmId !== firmId) {
    throw new Error("Bu promosyon kodu yalnızca kodu üreten firmanın eklediği salonlarda kullanılabilir.");
  }
  if (promoCode.status !== "ACTIVE" || promoCode.usedAt || promoCode.usedBySalonId) {
    throw new Error("Bu promosyon kodu daha önce kullanılmış veya aktif değil.");
  }
  return promoCode;
}

async function getValidSalonPromoCode(tx, codeText, salon) {
  const normalizedCode = String(codeText || "").trim().toUpperCase();
  if (!normalizedCode) return null;

  const promoCode = await tx.firmPromoCode.findUnique({ where: { code: normalizedCode } });
  if (!promoCode) {
    throw new Error("Promosyon kodu bulunamadı.");
  }
  if (promoCode.firmId && promoCode.firmId !== salon.createdByFirmId) {
    throw new Error("Bu promosyon kodu yalnızca kodu üreten firmanın eklediği salonlarda kullanılabilir.");
  }
  if (!promoCode.firmId && salon.createdByFirmId) {
    throw new Error("Admin promosyon kodları sadece admin tarafından açılan salonlarda kullanılabilir.");
  }
  if (promoCode.status !== "ACTIVE" || promoCode.usedAt || promoCode.usedBySalonId) {
    throw new Error("Bu promosyon kodu daha önce kullanılmış veya aktif değil.");
  }
  return promoCode;
}

function subscriptionResponse(subscription, packagePlan = null) {
  if (!subscription) return null;

  const analysisLimit = subscription.monthlyLimit;
  const usedAnalyses = subscription.currentUsage;
  const remainingAnalyses = Math.max(analysisLimit - usedAnalyses, 0);
  const usagePercent = analysisLimit > 0 ? Math.round((usedAnalyses / analysisLimit) * 100) : 0;

  return {
    id: subscription.id,
    packageId: packagePlan?.slug || packageIdFromName(subscription.packageName),
    packageName: subscription.packageName,
    monthlyPrice: packagePlan?.monthlyPriceLabel || monthlyPriceFromPackage(subscription.packageName),
    analysisLimit,
    analysisLimitLabel: `${analysisLimit} analiz`,
    monthlyLimit: subscription.monthlyLimit,
    currentUsage: subscription.currentUsage,
    userLimit: packagePlan?.userLimitLabel || userLimitFromPackage(subscription.packageName),
    userLimitValue: packagePlan?.userLimit ?? numericUserLimitFromPackage(subscription.packageName),
    status: subscription.status === "ACTIVE" ? "Aktif" : subscription.status,
    renewalDate: subscription.renewalDate,
    usage: {
      usedAnalyses,
      remainingAnalyses,
      analysisLimit,
      usagePercent,
    },
  };
}

function salonResponse(salon) {
  if (!salon) return null;

  return {
    id: salon.id,
    name: salon.name,
    ownerName: salon.ownerName,
    email: salon.email,
    phone: salon.phone,
    city: salon.city,
    address: salon.address,
    logoUrl: salon.logoUrl || "",
    reportSalonName: salon.reportSalonName || salon.name,
    whatsapp: salon.whatsapp || "",
    reportFooter: salon.reportFooter || "",
    defaultProtocol: salon.defaultProtocol || "",
    defaultSessionCount: salon.defaultSessionCount || 6,
    defaultControlPeriod: salon.defaultControlPeriod || "",
    activeProductsOnly: salon.activeProductsOnly,
    notifyAnalysisDone: salon.notifyAnalysisDone,
    notifyControlTime: salon.notifyControlTime,
    notifyProductRenewal: salon.notifyProductRenewal,
    createdAt: salon.createdAt,
    updatedAt: salon.updatedAt,
  };
}

function protocolResponse(protocol) {
  return {
    id: protocol.id,
    name: protocol.name,
    sessionCount: protocol.sessionCount,
    controlPeriod: protocol.controlPeriod,
    frequency: protocol.frequency,
    status: protocol.isActive ? "Aktif" : "Pasif",
    notes: protocol.notes || "",
    createdAt: protocol.createdAt,
  };
}

async function handleAuthApi(req, res, pathname) {
  try {
    const { prisma } = await import("./src/lib/repositories/customerRepository.server.js");

    if (pathname === "/api/auth/me" && req.method === "GET") {
      const session = getSession(req);
      if (!session) {
        sendJson(res, 401, { user: null });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: session.id },
        include: { salon: true, firm: true },
      });

      if (!user) {
        clearSession(req, res);
        sendJson(res, 401, { user: null });
        return;
      }

      const hydratedSession = {
        ...session,
        name: user.name,
        email: user.email,
        username: user.username || "",
        role: user.role,
        staffRole: user.staffRole || "",
        salonId: user.salonId || null,
        firmId: user.firmId || null,
        firmName: user.firm?.name || "",
        firmBrandName: user.firm?.brandName || "",
        firmLogoUrl: user.firm?.logoUrl || "",
        salonName: user.salon?.name || "",
        salonLogoUrl: user.salon?.logoUrl || "",
      };

      const token = createSessionToken(hydratedSession);
      sessions.set(token, hydratedSession);
      setSessionCookie(req, res, token);

      sendJson(res, 200, { user: hydratedSession });
      return;
    }

    if (pathname === "/api/auth/logout" && req.method === "POST") {
      clearSession(req, res);
      sendJson(res, 200, { message: "Çıkış yapıldı." });
      return;
    }

    if ((pathname === "/api/auth/login" || pathname === "/api/auth/admin-login" || pathname === "/api/auth/firm-login") && req.method === "POST") {
      const body = await readJsonBody(req);
      const identifier = String(body.email || body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const isAdminLogin = pathname === "/api/auth/admin-login";
      const isFirmLogin = pathname === "/api/auth/firm-login";
      const expectedPassword = isAdminLogin ? adminLoginPassword : salonLoginPassword;

      if (!identifier || !password) {
        sendJson(res, 400, { message: "Kullanıcı adı/e-posta ve şifre zorunludur." });
        return;
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: identifier }, { username: identifier }],
        },
        include: {
          salon: true,
          firm: true,
        },
      });
      if (!user) {
        sendJson(res, 401, { message: "Kullanıcı adı/e-posta veya şifre hatalı." });
        return;
      }

      const passwordOk = user.passwordHash ? verifyPassword(password, user.passwordHash) : password === expectedPassword;
      if (!passwordOk) {
        sendJson(res, 401, { message: "Kullanıcı adı/e-posta veya şifre hatalı." });
        return;
      }

      if (isAdminLogin && user.role !== "ADMIN") {
        sendJson(res, 403, { message: "Bu kullanıcı admin yetkisine sahip değil." });
        return;
      }

      if (isFirmLogin && (user.role !== "FIRM" || !user.firmId)) {
        sendJson(res, 403, { message: "Bu kullanıcı firma paneline bağlı değil." });
        return;
      }

      if (!isAdminLogin && !isFirmLogin && (user.role === "ADMIN" || user.role === "FIRM" || !user.salonId)) {
        sendJson(res, 403, { message: "Bu kullanıcı salon paneline bağlı değil." });
        return;
      }

      const session = createSession(req, res, user);
      sendJson(res, 200, { user: session, redirectTo: isAdminLogin ? "/admin" : isFirmLogin ? "/firm" : "/dashboard" });
      return;
    }

    sendJson(res, 404, { message: "Auth endpoint bulunamadı." });
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Giriş işlemi sırasında bir hata oluştu.", detail });
  }
}

async function handleCustomersApi(req, res) {
  try {
    const session = requireSalonSession(req, res, req.method === "GET" ? "customers:read" : "customers");
    if (!session) return;
    const salonId = session.salonId;
    const { getCustomersBySalonId, createCustomer } = await import("./src/lib/repositories/customerRepository.server.js");

    if (req.method === "GET") {
      const customers = await getCustomersBySalonId(salonId);
      sendJson(res, 200, { customers: customers.map(customerResponse) });
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const fullName = String(body.fullName || "").trim();
      const phone = String(body.phone || "").trim();

      if (!fullName || !phone) {
        sendJson(res, 400, { message: "Ad soyad ve telefon zorunludur." });
        return;
      }

      const ageValue = body.age === "" || body.age === undefined || body.age === null ? undefined : Number(body.age);
      const customer = await createCustomer({
        salon: { connect: { id: salonId } },
        fullName,
        phone,
        age: Number.isFinite(ageValue) ? ageValue : undefined,
        gender: toGenderEnum(body.gender),
        notes: body.notes ? String(body.notes).trim() : undefined,
      });

      sendJson(res, 201, { customer: customerResponse(customer), message: "Müşteri başarıyla eklendi." });
      return;
    }

    sendJson(res, 405, { message: "Bu istek desteklenmiyor." });
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Müşteri kaydedilirken bir hata oluştu.", detail });
  }
}

async function handleCustomerDetailApi(req, res, pathname) {
  try {
    const session = requireSalonSession(req, res, "customers:read");
    if (!session) return;
    const salonId = session.salonId;

    if (req.method !== "GET") {
      sendJson(res, 405, { message: "Bu istek desteklenmiyor." });
      return;
    }

    const customerId = decodeURIComponent(pathname.slice("/api/customers/".length));
    const { getCustomerById } = await import("./src/lib/repositories/customerRepository.server.js");
    const customer = await getCustomerById(customerId);

    if (!customer || customer.salonId !== salonId) {
      sendJson(res, 404, { message: "Müşteri bulunamadı." });
      return;
    }

    sendJson(res, 200, { customer: customerDetailResponse(customer) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Müşteri detayı alınırken bir hata oluştu.", detail });
  }
}

async function handleDashboardApi(req, res) {
  try {
    const session = requireSalonSession(req, res, "dashboard");
    if (!session) return;
    const salonId = session.salonId;

    if (req.method !== "GET") {
      sendJson(res, 405, { message: "Bu istek desteklenmiyor." });
      return;
    }

    const { prisma } = await import("./src/lib/repositories/customerRepository.server.js");
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [totalCustomers, monthlyAnalyses, averageScore, latestReport, latestAnalyses, latestCustomers] = await Promise.all([
      prisma.customer.count({ where: { salonId } }),
      prisma.analysis.count({ where: { salonId, createdAt: { gte: monthStart } } }),
      prisma.report.aggregate({ where: { salonId }, _avg: { overallScore: true } }),
      prisma.report.findFirst({
        where: { salonId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.analysis.findMany({
        where: { salonId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          customer: true,
          report: true,
        },
      }),
      prisma.customer.findMany({
        where: { salonId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    sendJson(res, 200, {
      stats: {
        totalCustomers,
        monthlyAnalyses,
        averageScore: Math.round(averageScore._avg.overallScore || 0),
      },
      latestScores: scoreMapFromReport(latestReport),
      latestAnalyses: latestAnalyses.map((analysis) => ({
        id: analysis.id,
        reportId: analysis.report?.id || null,
        customerId: analysis.customerId,
        customerName: analysis.customer.fullName,
        createdAt: analysis.createdAt,
        status: analysis.status,
        mainConcern: analysis.mainConcern || "-",
        overallScore: analysis.report?.overallScore ?? null,
      })),
      latestCustomers: latestCustomers.map((customer) => ({
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        createdAt: customer.createdAt,
        status: "Aktif",
      })),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Dashboard verileri alınırken bir hata oluştu.", detail });
  }
}

async function handleAnalysesApi(req, res) {
  try {
    const session = requireSalonSession(req, res, "analyses");
    if (!session) return;
    const salonId = session.salonId;

    if (req.method !== "POST") {
      sendJson(res, 405, { message: "Bu istek desteklenmiyor." });
      return;
    }

    const body = await readJsonBody(req);
    const { getCustomerById, createCustomer } = await import("./src/lib/repositories/customerRepository.server.js");
    const { createAnalysis } = await import("./src/lib/repositories/analysisRepository.server.js");
    const { createReport } = await import("./src/lib/repositories/reportRepository.server.js");
    const { runSkinAnalysis } = await import("./src/lib/analysis/analysisService.server.js");
    const { getSubscriptionBySalonId, updateSubscriptionUsage } = await import("./src/lib/repositories/subscriptionRepository.server.js");
    const { getActiveProductCatalogForAnalysis } = await import("./src/lib/repositories/productRepository.server.js");
    const { getRecommendedProtocolByAnalysis } = await import("./src/lib/repositories/protocolRepository.server.js");

    const subscription = await getSubscriptionBySalonId(salonId);
    if (!subscription || subscription.currentUsage >= subscription.monthlyLimit) {
      sendJson(res, 403, { message: "Bu ayki analiz limitiniz dolmuştur. Paketinizi yükseltin." });
      return;
    }

    let customerId = String(body.customerId || "").trim();
    let customer = customerId && customerId !== "new" ? await getCustomerById(customerId) : null;
    if (customer && customer.salonId !== salonId) {
      sendJson(res, 403, { message: "Bu müşteri farklı bir salona ait." });
      return;
    }

    if (!customer && body.newCustomer) {
      const fullName = String(body.newCustomer.fullName || "").trim();
      const phone = String(body.newCustomer.phone || "").trim();

      if (!fullName || !phone) {
        sendJson(res, 400, { message: "Analiz için müşteri seçin veya yeni müşteri bilgilerini doldurun." });
        return;
      }

      const ageValue =
        body.newCustomer.age === "" || body.newCustomer.age === undefined || body.newCustomer.age === null
          ? undefined
          : Number(body.newCustomer.age);

      customer = await createCustomer({
        salon: { connect: { id: salonId } },
        fullName,
        phone,
        age: Number.isFinite(ageValue) ? ageValue : undefined,
        gender: toGenderEnum(body.newCustomer.gender),
        notes: body.newCustomer.notes ? String(body.newCustomer.notes).trim() : undefined,
      });
      customerId = customer.id;
    }

    if (!customer) {
      sendJson(res, 400, { message: "Analiz için geçerli bir müşteri seçin." });
      return;
    }

    if (!body.consentAccepted) {
      sendJson(res, 400, { message: "KVKK / açık rıza onayı zorunludur." });
      return;
    }

    const skinType = String(body.skinType || "Karma");
    const mainConcern = String(body.mainConcern || "Leke");
    const analysisPhotos = normalizeAnalysisPhotos(body.photos || {});
    const productCatalog = await getActiveProductCatalogForAnalysis(salonId);
    const analysis = await createAnalysis({
      salon: { connect: { id: salonId } },
      customer: { connect: { id: customerId } },
      status: "COMPLETED",
      skinType,
      mainConcern,
      consentAccepted: Boolean(body.consentAccepted),
      photos: analysisPhotos,
    });

    const analysisOutput = await runSkinAnalysis({
      customerId,
      customerName: customer.fullName,
      age: customer.age ?? body.age ?? "",
      gender: toGenderLabel(customer.gender) || body.gender || "",
      consentAccepted: Boolean(body.consentAccepted),
      photos: analysisPhotos,
      skinType,
      mainConcern,
      spfUsage: String(body.spfUsage || "Evet"),
      homeCareRoutine: String(body.homeCareRoutine || "Hayır"),
      notes: String(body.notes || ""),
      productCatalog,
    });
    const databaseProtocol = await getRecommendedProtocolByAnalysis(salonId, skinType, mainConcern);
    if (databaseProtocol) {
      analysisOutput.recommendedProtocol = databaseProtocol;
    }

    const report = await createReport({
      analysis: { connect: { id: analysis.id } },
      salon: { connect: { id: salonId } },
      overallScore: analysisOutput.overallScore,
      hydrationScore: analysisOutput.scores.hydration,
      pigmentationScore: analysisOutput.scores.pigmentation,
      poreScore: analysisOutput.scores.pores,
      wrinkleScore: analysisOutput.scores.wrinkles,
      sensitivityScore: analysisOutput.scores.sensitivity,
      aiComment: analysisOutput.aiComment,
      rawAiResponse: analysisOutput.rawAiResponse || null,
      recommendedProtocol: analysisOutput.recommendedProtocol,
      recommendedProducts: analysisOutput.recommendedProducts,
    });

    const updatedSubscription = await updateSubscriptionUsage(salonId, subscription.currentUsage + 1);

    sendJson(res, 201, {
      report: reportResponse(report, analysisOutput, customer),
      reportId: report.id,
      subscription: subscriptionResponse(updatedSubscription),
    });
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "OpenAI analizi başarısız oldu.", detail });
  }
}

async function handleSubscriptionApi(req, res) {
  try {
    const session = requireSalonSession(req, res, "subscription");
    if (!session) return;
    const salonId = session.salonId;

    if (!["GET", "POST"].includes(req.method)) {
      sendJson(res, 405, { message: "Bu istek desteklenmiyor." });
      return;
    }

    const { getSubscriptionBySalonId } = await import("./src/lib/repositories/subscriptionRepository.server.js");
    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const promoCodeText = String(body.promoCode || "").trim().toUpperCase();
      if (!promoCodeText) {
        sendJson(res, 400, { message: "Promosyon kodu zorunludur." });
        return;
      }

      const { prisma } = await import("./src/lib/repositories/customerRepository.server.js");
      const salon = await prisma.salon.findUnique({ where: { id: salonId }, include: { subscription: true } });
      if (!salon) {
        sendJson(res, 404, { message: "Salon bulunamadı." });
        return;
      }

      const subscription = await prisma.$transaction(async (tx) => {
        const promoCode = await getValidSalonPromoCode(tx, promoCodeText, salon);
        const updatedSubscription = salon.subscription
          ? await tx.subscription.update({
              where: { salonId },
              data: {
                packageName: promoCode.packageName,
                monthlyLimit: promoCode.monthlyLimit,
                currentUsage: 0,
                renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: "ACTIVE",
              },
            })
          : await tx.subscription.create({
              data: {
                salonId,
                packageName: promoCode.packageName,
                monthlyLimit: promoCode.monthlyLimit,
                currentUsage: 0,
                renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: "ACTIVE",
              },
            });

        await tx.firmPromoCode.update({
          where: { id: promoCode.id },
          data: {
            status: "USED",
            usedAt: new Date(),
            usedBySalonId: salonId,
          },
        });

        return updatedSubscription;
      });

      const packagePlan = await getPackagePlanByName(prisma, subscription.packageName);
      sendJson(res, 200, { subscription: subscriptionResponse(subscription, packagePlan), message: "Promosyon kodu başarıyla kullanıldı." });
      return;
    }

    const subscription = await getSubscriptionBySalonId(salonId);

    if (!subscription) {
      sendJson(res, 404, { message: "Aktif abonelik bulunamadı." });
      return;
    }

    const { prisma } = await import("./src/lib/repositories/customerRepository.server.js");
    const packagePlan = await getPackagePlanByName(prisma, subscription.packageName);
    sendJson(res, 200, { subscription: subscriptionResponse(subscription, packagePlan) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Abonelik bilgisi alınırken bir hata oluştu.", detail });
  }
}

async function handlePackagePlansApi(req, res) {
  try {
    const session = getSession(req);
    if (!session || (!session.salonId && session.role !== "FIRM" && session.role !== "ADMIN")) {
      sendJson(res, 401, { message: "Paketleri görüntülemek için giriş yapın." });
      return;
    }
    if (req.method !== "GET") {
      sendJson(res, 405, { message: "Bu istek desteklenmiyor." });
      return;
    }
    const { prisma } = await import("./src/lib/repositories/customerRepository.server.js");
    const packages = await getPackagePlans(prisma);
    sendJson(res, 200, { packages });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Paketler alınırken bir hata oluştu.", detail });
  }
}

async function handleProtocolsApi(req, res) {
  try {
    const session = requireSalonSession(req, res, "protocols");
    if (!session) return;
    const salonId = session.salonId;
    const { prisma } = await import("./src/lib/repositories/customerRepository.server.js");

    if (req.method === "GET") {
      const protocols = await prisma.protocol.findMany({
        where: { salonId },
        orderBy: { createdAt: "desc" },
      });
      sendJson(res, 200, { protocols: protocols.map(protocolResponse) });
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const sessionCount = Number(body.sessionCount || 1);
      const controlPeriod = String(body.controlPeriod || "").trim();
      const frequency = String(body.frequency || "").trim();
      const notes = String(body.notes || "").trim();
      const isActive = body.status !== "Pasif";

      if (!name || !Number.isFinite(sessionCount) || sessionCount < 1 || !controlPeriod || !frequency) {
        sendJson(res, 400, { message: "Protokol adı, seans sayısı, sıklık ve kontrol süresi zorunludur." });
        return;
      }

      const protocol = await prisma.protocol.create({
        data: {
          salonId,
          name,
          sessionCount,
          controlPeriod,
          frequency,
          notes,
          isActive,
        },
      });

      sendJson(res, 201, { protocol: protocolResponse(protocol), message: "Protokol başarıyla eklendi." });
      return;
    }

    sendJson(res, 405, { message: "Bu istek desteklenmiyor." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Protokoller işlenirken bir hata oluştu.", detail });
  }
}

async function handleSettingsApi(req, res) {
  try {
    const session = requireSalonSession(req, res, "settings");
    if (!session) return;
    const salonId = session.salonId;

    const { getSalonById, updateSalon } = await import("./src/lib/repositories/salonRepository.server.js");
    const { getProducts } = await import("./src/lib/repositories/productRepository.server.js");

    if (req.method === "GET") {
      const [salon, products] = await Promise.all([
        getSalonById(salonId),
        getProducts(),
      ]);

      if (!salon) {
        sendJson(res, 404, { message: "Salon profili bulunamadı.", productCount: products.length });
        return;
      }

      sendJson(res, 200, {
        salon: salonResponse(salon),
        summary: {
          activeSalon: 1,
          productCount: products.length,
          reportTemplate: "Aktif",
        },
      });
      return;
    }

    if (req.method === "PUT") {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const ownerName = String(body.ownerName || "").trim();
      const email = String(body.email || "").trim();
      const phone = String(body.phone || "").trim();
      const city = String(body.city || "").trim();
      const address = String(body.address || "").trim();
      const logoUrl = String(body.logoUrl || "").trim();
      const reportSalonName = String(body.reportSalonName || "").trim();
      const whatsapp = String(body.whatsapp || "").trim();
      const reportFooter = String(body.reportFooter || "").trim();
      const defaultProtocol = String(body.defaultProtocol || "").trim();
      const defaultSessionCount = Number(body.defaultSessionCount || 6);
      const defaultControlPeriod = String(body.defaultControlPeriod || "").trim();

      if (!name || !ownerName || !email || !phone || !city || !address) {
        sendJson(res, 400, { message: "Salon bilgileri eksiksiz doldurulmalıdır." });
        return;
      }

      const salon = await updateSalon(salonId, {
        name,
        ownerName,
        email,
        phone,
        city,
        address,
        logoUrl: logoUrl || null,
        reportSalonName: reportSalonName || name,
        whatsapp,
        reportFooter,
        defaultProtocol,
        defaultSessionCount: Number.isFinite(defaultSessionCount) ? defaultSessionCount : 6,
        defaultControlPeriod,
        activeProductsOnly: Boolean(body.activeProductsOnly),
        notifyAnalysisDone: Boolean(body.notifyAnalysisDone),
        notifyControlTime: Boolean(body.notifyControlTime),
        notifyProductRenewal: Boolean(body.notifyProductRenewal),
      });

      sendJson(res, 200, { salon: salonResponse(salon), message: "Salon bilgileri başarıyla güncellendi." });
      return;
    }

    sendJson(res, 405, { message: "Bu istek desteklenmiyor." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Salon bilgileri güncellenirken bir hata oluştu.", detail });
  }
}

async function handleAdminApi(req, res, pathname) {
  try {
    const session = requireAdminSession(req, res);
    if (!session) return;

    if (!["GET", "POST", "PUT"].includes(req.method)) {
      sendJson(res, 405, { message: "Bu istek desteklenmiyor." });
      return;
    }

    const { prisma } = await import("./src/lib/repositories/customerRepository.server.js");
    const { getAdminDashboardStats, getAllSalons, getAdminAnalyses } = await import("./src/lib/repositories/adminRepository.server.js");

    if (pathname === "/api/admin/settings" && req.method === "GET") {
      const { getPublicSystemSettings } = await import("./src/lib/repositories/systemSettingsRepository.server.js");
      const settings = await getPublicSystemSettings();
      sendJson(res, 200, { settings });
      return;
    }

    if (pathname === "/api/admin/settings" && req.method === "POST") {
      const body = await readJsonBody(req);
      const { getPublicSystemSettings, upsertSystemSetting } = await import("./src/lib/repositories/systemSettingsRepository.server.js");
      const openAIApiKey = String(body.openAIApiKey || "").trim();
      const openAIModel = String(body.openAIModel || "gpt-5-mini").trim() || "gpt-5-mini";
      if (openAIApiKey) {
        await upsertSystemSetting("OPENAI_API_KEY", openAIApiKey);
      }
      await upsertSystemSetting("OPENAI_MODEL", openAIModel);
      const settings = await getPublicSystemSettings();
      sendJson(res, 200, { settings, message: "Sistem ayarları başarıyla kaydedildi." });
      return;
    }

    if (pathname === "/api/admin/stats" && req.method === "GET") {
      const stats = await getAdminDashboardStats();
      sendJson(res, 200, { stats });
      return;
    }

    if (pathname === "/api/admin/salons" && req.method === "GET") {
      const salons = await getAllSalons();
      sendJson(res, 200, { salons });
      return;
    }

    if (pathname === "/api/admin/salons" && req.method === "POST") {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const ownerName = String(body.ownerName || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const phone = String(body.phone || "").trim();
      const city = String(body.city || "").trim();
      const address = String(body.address || "").trim();
      const username = String(body.username || email.split("@")[0] || "").trim().toLowerCase();
      const password = String(body.password || "123456");

      if (!name || !ownerName || !email || !phone || !city || !address || !username || !password) {
        sendJson(res, 400, { message: "Salon adı, yetkili, e-posta, telefon, şehir, adres, kullanıcı adı ve şifre zorunludur." });
        return;
      }

      const existingSalon = await prisma.salon.findUnique({ where: { email } });
      if (existingSalon) {
        sendJson(res, 409, { message: "Bu e-posta ile daha önce salon oluşturulmuş." });
        return;
      }

      const existingUser = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
      if (existingUser) {
        sendJson(res, 409, { message: "Bu kullanıcı adı veya e-posta daha önce kullanılmış." });
        return;
      }

      await prisma.salon.create({
        data: {
          name,
          ownerName,
          email,
          phone,
          city,
          address,
          reportSalonName: name,
          createdByUserId: session.id,
          users: {
            create: {
              name: ownerName,
              email,
              username,
              passwordHash: hashPassword(password),
              role: "SALON_OWNER",
              staffRole: "Salon Yöneticisi",
            },
          },
          teamMembers: {
            create: {
              name: ownerName,
              email,
              role: "Salon Yöneticisi",
              isActive: true,
            },
          },
        },
      });

      const salons = await getAllSalons();
      sendJson(res, 201, { message: "Salon başarıyla oluşturuldu.", salons });
      return;
    }

    if (pathname === "/api/admin/salon-package" && req.method === "POST") {
      const body = await readJsonBody(req);
      const salonId = String(body.salonId || "").trim();
      const packageName = String(body.packageName || "").trim();

      if (!salonId || !packageName) {
        sendJson(res, 400, { message: "Salon ve paket seçimi zorunludur." });
        return;
      }

      const [salon, selectedPackage] = await Promise.all([
        prisma.salon.findUnique({ where: { id: salonId }, include: { subscription: true } }),
        getPackagePlanByName(prisma, packageName),
      ]);

      if (!salon || salon.createdByFirmId) {
        sendJson(res, 403, { message: "Paket sadece admin tarafından açılan salonlara tanımlanabilir." });
        return;
      }

      if (!selectedPackage) {
        sendJson(res, 400, { message: "Geçerli bir paket seçin." });
        return;
      }

      const subscription = salon.subscription
        ? await prisma.subscription.update({
            where: { salonId },
            data: {
              packageName: selectedPackage.name,
              monthlyLimit: selectedPackage.analysisLimit,
              currentUsage: 0,
              renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              status: "ACTIVE",
            },
          })
        : await prisma.subscription.create({
            data: {
              salonId,
              packageName: selectedPackage.name,
              monthlyLimit: selectedPackage.analysisLimit,
              currentUsage: 0,
              renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              status: "ACTIVE",
            },
          });

      const salons = await getAllSalons();
      sendJson(res, 200, {
        message: `${salon.name} için ${selectedPackage.name} paketi tanımlandı.`,
        subscription: subscriptionResponse(subscription, selectedPackage),
        salons,
      });
      return;
    }

    if (pathname === "/api/admin/promotions" && req.method === "POST") {
      const body = await readJsonBody(req);
      const packageName = String(body.packageName || "").trim();
      const selectedPackage = await getPackagePlanByName(prisma, packageName);

      if (!selectedPackage) {
        sendJson(res, 400, { message: "Geçerli bir paket seçin." });
        return;
      }

      let codeText = generatePromoCodeText(selectedPackage.name);
      let exists = await prisma.firmPromoCode.findUnique({ where: { code: codeText } });
      while (exists) {
        codeText = generatePromoCodeText(selectedPackage.name);
        exists = await prisma.firmPromoCode.findUnique({ where: { code: codeText } });
      }

      const promoCode = await prisma.firmPromoCode.create({
        data: {
          firmId: null,
          code: codeText,
          packageName: selectedPackage.name,
          monthlyLimit: selectedPackage.analysisLimit,
          userLimit: selectedPackage.userLimit,
        },
      });

      sendJson(res, 201, {
        message: "Admin promosyon kodu üretildi. Bu kod sadece admin tarafından açılan salonlarda kullanılabilir.",
        promoCode: promoCodeResponse(promoCode),
      });
      return;
    }

    if (pathname === "/api/admin/promotions" && req.method === "GET") {
      const promoCodes = await prisma.firmPromoCode.findMany({
        where: { firmId: null },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { usedBySalon: true },
      });
      sendJson(res, 200, { promoCodes: promoCodes.map(promoCodeResponse) });
      return;
    }

    if (pathname === "/api/admin/analyses" && req.method === "GET") {
      const analyses = await getAdminAnalyses();
      sendJson(res, 200, { analyses });
      return;
    }

    if (pathname.startsWith("/api/admin/reports/") && req.method === "GET") {
      const { getReportById } = await import("./src/lib/repositories/reportRepository.server.js");
      const reportPath = decodeURIComponent(pathname.slice("/api/admin/reports/".length));
      const isPdfRequest = reportPath.endsWith("/pdf");
      const reportId = isPdfRequest ? reportPath.slice(0, -"/pdf".length) : reportPath;

      if (!reportId) {
        sendJson(res, 400, { message: "Rapor seçilmedi." });
        return;
      }

      const report = await getReportById(reportId);
      if (!report) {
        sendJson(res, 404, { message: "Rapor bulunamadı." });
        return;
      }

      if (isPdfRequest) {
        const pdfBuffer = createReportPdf(report);
        const customerName = report.analysis?.customer?.fullName || "ciltgpt-rapor";
        sendFile(res, 200, "application/pdf", pdfBuffer, `${safeFileName(customerName)}-analiz-raporu.pdf`);
        return;
      }

      sendJson(res, 200, { report: databaseReportResponse(report) });
      return;
    }

    if (pathname === "/api/admin/firms" && req.method === "GET") {
      const firms = await prisma.firm.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          analysisBalance: true,
          promoCodes: { orderBy: { createdAt: "desc" }, take: 5 },
          analysisSales: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      });
      sendJson(res, 200, {
        firms: firms.map((firm) => ({
          id: firm.id,
          name: firm.name,
          brandName: firm.brandName,
          email: firm.email,
          phone: firm.phone || "",
          isActive: firm.isActive,
          balance: firmBalanceResponse(firm.analysisBalance),
          promoCount: firm.promoCodes.length,
          saleCount: firm.analysisSales.length,
        })),
      });
      return;
    }

    if (pathname === "/api/admin/firms" && req.method === "POST") {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const brandName = String(body.brandName || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const phone = String(body.phone || "").trim();
      const website = String(body.website || "").trim();
      const address = String(body.address || "").trim();
      const username = String(body.username || email.split("@")[0] || "").trim().toLowerCase();
      const password = String(body.password || "firm123");

      if (!name || !brandName || !email || !username || !password) {
        sendJson(res, 400, { message: "Firma adı, marka adı, e-posta, kullanıcı adı ve şifre zorunludur." });
        return;
      }

      const existingFirm = await prisma.firm.findUnique({ where: { email } });
      if (existingFirm) {
        sendJson(res, 409, { message: "Bu e-posta ile daha önce firma oluşturulmuş." });
        return;
      }

      const existingUser = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
      if (existingUser) {
        sendJson(res, 409, { message: "Bu kullanıcı adı veya e-posta daha önce kullanılmış." });
        return;
      }

      await prisma.firm.create({
        data: {
          name,
          brandName,
          email,
          phone: phone || null,
          website: website || null,
          address: address || null,
          users: {
            create: {
              name,
              email,
              username,
              passwordHash: hashPassword(password),
              role: "FIRM",
              staffRole: "Firma Yöneticisi",
            },
          },
          analysisBalance: {
            create: {
              totalPurchased: 0,
              usedByPromo: 0,
            },
          },
        },
      });

      sendJson(res, 201, { message: "Firma başarıyla oluşturuldu." });
      return;
    }

    if (pathname === "/api/admin/analysis-sales" && req.method === "GET") {
      const [firms, unitPrice, sales] = await Promise.all([
        prisma.firm.findMany({ orderBy: { name: "asc" }, include: { analysisBalance: true } }),
        prisma.analysisUnitPrice.findFirst({ orderBy: { createdAt: "asc" } }),
        prisma.firmAnalysisSale.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { firm: true } }),
      ]);
      const price = unitPrice || (await prisma.analysisUnitPrice.create({ data: { pricePerAnalysis: 25, currency: "TL" } }));
      sendJson(res, 200, {
        unitPrice: { id: price.id, pricePerAnalysis: Number(price.pricePerAnalysis), currency: price.currency },
        firms: firms.map((firm) => ({
          id: firm.id,
          name: firm.name,
          brandName: firm.brandName,
          balance: firmBalanceResponse(firm.analysisBalance),
        })),
        sales: sales.map((sale) => ({
          id: sale.id,
          firmName: sale.firm.name,
          quantity: sale.quantity,
          unitPrice: Number(sale.unitPrice),
          totalAmount: Number(sale.totalAmount),
          currency: sale.currency,
          note: sale.note || "",
          createdAt: sale.createdAt,
        })),
      });
      return;
    }

    if (pathname === "/api/admin/package-plans" && req.method === "GET") {
      const packages = await getPackagePlans(prisma);
      sendJson(res, 200, { packages });
      return;
    }

    if (pathname === "/api/admin/products" && req.method === "GET") {
      const products = await prisma.product.findMany({
        orderBy: { createdAt: "desc" },
      });
      sendJson(res, 200, { products: products.map(productResponse) });
      return;
    }

    if (pathname.startsWith("/api/admin/products/") && req.method === "PUT") {
      const productId = decodeURIComponent(pathname.slice("/api/admin/products/".length));
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const brand = String(body.brand || "").trim();
      const category = String(body.category || "").trim();
      const usagePurpose = String(body.usagePurpose || body.purpose || "").trim();
      const usageTime = String(body.usageTime || body.time || "").trim();

      if (!productId || !name || !brand || !category || !usagePurpose || !usageTime) {
        sendJson(res, 400, { message: "Ürün adı, marka, kategori, kullanım amacı ve kullanım zamanı zorunludur." });
        return;
      }

      const product = await prisma.product.update({
        where: { id: productId },
        data: {
          name,
          brand,
          category,
          usagePurpose,
          usageTime,
          isActive: body.isActive === undefined ? body.status !== "Pasif" : Boolean(body.isActive),
          isCabinProduct: Boolean(body.isCabinProduct),
        },
      });

      sendJson(res, 200, { product: productResponse(product), message: "Ürün başarıyla güncellendi." });
      return;
    }

    if (pathname === "/api/admin/product-template" && req.method === "GET") {
      const template = Buffer.from(productTemplateCsv(), "utf-8");
      sendFile(res, 200, "text/csv; charset=utf-8", template, "global-urun-sablonu.csv");
      return;
    }

    if (pathname === "/api/admin/products/import" && req.method === "POST") {
      const buffer = await readRequestBuffer(req);
      const rawText = extractMultipartFileText(req, buffer);
      const rows = parseProductImportRows(rawText);
      if (rows.length < 2) {
        sendJson(res, 400, { message: "Yüklenecek ürün satırı bulunamadı." });
        return;
      }

      const headers = rows[0].map(normalizeImportHeader);
      const indexOf = (...names) => {
        const normalizedNames = names.map(normalizeImportHeader);
        return headers.findIndex((header) => normalizedNames.includes(header));
      };
      const indexes = {
        name: indexOf("name", "ürün adı", "urun adi"),
        brand: indexOf("brand", "marka"),
        category: indexOf("category", "kategori"),
        usagePurpose: indexOf("usagePurpose", "kullanım amacı", "kullanim amaci"),
        usageTime: indexOf("usageTime", "kullanım zamanı", "kullanim zamani"),
        isActive: indexOf("isActive", "aktif", "durum"),
        isCabinProduct: indexOf("isCabinProduct", "kabin ürünü mü", "kabin urunu mu"),
      };

      if ([indexes.name, indexes.brand, indexes.category, indexes.usagePurpose, indexes.usageTime].some((index) => index === -1)) {
        sendJson(res, 400, { message: "Şablon kolonları eksik. Lütfen sistem şablonunu kullanın." });
        return;
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;
      for (const row of rows.slice(1)) {
        const name = String(row[indexes.name] || "").trim();
        const brand = String(row[indexes.brand] || "").trim();
        const category = String(row[indexes.category] || "").trim();
        const usagePurpose = String(row[indexes.usagePurpose] || "").trim();
        const usageTime = String(row[indexes.usageTime] || "").trim();
        const isActive = String(row[indexes.isActive] || "true").trim().toLowerCase() !== "false";
        const isCabinProduct = ["true", "evet", "1", "yes"].includes(String(row[indexes.isCabinProduct] || "false").trim().toLowerCase());

        if (!name || !brand || !category || !usagePurpose || !usageTime) {
          skipped += 1;
          continue;
        }

        const existing = await prisma.product.findFirst({
          where: {
            name,
            brand,
            firmId: null,
          },
        });

        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: { category, usagePurpose, usageTime, isActive, isCabinProduct },
          });
          updated += 1;
        } else {
          await prisma.product.create({
            data: {
              name,
              brand,
              category,
              usagePurpose,
              usageTime,
              isActive,
              isCabinProduct,
            },
          });
          created += 1;
        }
      }

      sendJson(res, 200, { created, updated, skipped, message: `${created} yeni ürün eklendi. ${updated} ürün güncellendi. ${skipped} satır atlandı.` });
      return;
    }

    if (pathname === "/api/admin/package-plans" && req.method === "POST") {
      const body = await readJsonBody(req);
      const slug = String(body.slug || "").trim().toLowerCase();
      const name = String(body.name || "").trim();
      const monthlyPriceLabel = String(body.monthlyPriceLabel || "").trim();
      const monthlyPriceValue = body.monthlyPriceValue === "" || body.monthlyPriceValue === null ? null : Number(body.monthlyPriceValue);
      const analysisLimit = Number(body.analysisLimit);
      const analysisLimitLabel = String(body.analysisLimitLabel || "").trim();
      const rawUserLimit = body.userLimit === "" || body.userLimit === null ? null : Number(body.userLimit);
      const userLimit = Number.isFinite(rawUserLimit) ? rawUserLimit : null;
      const userLimitLabel = String(body.userLimitLabel || "").trim();
      const status = String(body.status || "Aktif").trim();
      const sortOrder = Number(body.sortOrder || 0);
      const features = Array.isArray(body.features) ? body.features.map((item) => String(item).trim()).filter(Boolean) : [];

      if (!slug || !name || !monthlyPriceLabel || !Number.isInteger(analysisLimit) || !analysisLimitLabel || !userLimitLabel) {
        sendJson(res, 400, { message: "Paket adı, slug, fiyat etiketi, analiz limiti ve kullanıcı limiti etiketi zorunludur." });
        return;
      }

      const existing = await prisma.packagePlan.findUnique({ where: { slug } });
      if (existing) {
        sendJson(res, 409, { message: "Bu slug ile daha önce paket oluşturulmuş." });
        return;
      }

      await prisma.packagePlan.create({
        data: {
          slug,
          name,
          monthlyPriceLabel,
          monthlyPriceValue: Number.isFinite(monthlyPriceValue) ? monthlyPriceValue : null,
          currency: String(body.currency || "TL").trim() || "TL",
          analysisLimit,
          analysisLimitLabel,
          userLimit,
          userLimitLabel,
          status,
          features,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          isActive: true,
        },
      });

      const packages = await getPackagePlans(prisma);
      sendJson(res, 201, { message: "Paket başarıyla oluşturuldu.", packages });
      return;
    }

    if (pathname === "/api/admin/package-plans" && req.method === "PUT") {
      const body = await readJsonBody(req);
      const currentSlug = String(body.id || body.slug || "").trim().toLowerCase();
      const slug = String(body.slug || "").trim().toLowerCase();
      const name = String(body.name || "").trim();
      const monthlyPriceLabel = String(body.monthlyPriceLabel || "").trim();
      const monthlyPriceValue = body.monthlyPriceValue === "" || body.monthlyPriceValue === null ? null : Number(body.monthlyPriceValue);
      const analysisLimit = Number(body.analysisLimit);
      const analysisLimitLabel = String(body.analysisLimitLabel || "").trim();
      const rawUserLimit = body.userLimit === "" || body.userLimit === null ? null : Number(body.userLimit);
      const userLimit = Number.isFinite(rawUserLimit) ? rawUserLimit : null;
      const userLimitLabel = String(body.userLimitLabel || "").trim();
      const status = String(body.status || "Aktif").trim();
      const sortOrder = Number(body.sortOrder || 0);
      const features = Array.isArray(body.features) ? body.features.map((item) => String(item).trim()).filter(Boolean) : [];

      if (!currentSlug || !slug || !name || !monthlyPriceLabel || !Number.isInteger(analysisLimit) || !analysisLimitLabel || !userLimitLabel) {
        sendJson(res, 400, { message: "Paket bilgileri eksiksiz doldurulmalıdır." });
        return;
      }

      if (slug !== currentSlug) {
        const slugOwner = await prisma.packagePlan.findUnique({ where: { slug } });
        if (slugOwner) {
          sendJson(res, 409, { message: "Bu slug başka bir pakette kullanılıyor." });
          return;
        }
      }

      await prisma.packagePlan.update({
        where: { slug: currentSlug },
        data: {
          slug,
          name,
          monthlyPriceLabel,
          monthlyPriceValue: Number.isFinite(monthlyPriceValue) ? monthlyPriceValue : null,
          currency: String(body.currency || "TL").trim() || "TL",
          analysisLimit,
          analysisLimitLabel,
          userLimit,
          userLimitLabel,
          status,
          features,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        },
      });

      const packages = await getPackagePlans(prisma);
      sendJson(res, 200, { message: "Paket başarıyla güncellendi.", packages });
      return;
    }

    if (pathname === "/api/admin/analysis-unit-price" && req.method === "PUT") {
      const body = await readJsonBody(req);
      const pricePerAnalysis = Number(body.pricePerAnalysis);
      const currency = String(body.currency || "TL").trim() || "TL";
      if (!Number.isFinite(pricePerAnalysis) || pricePerAnalysis <= 0) {
        sendJson(res, 400, { message: "Analiz başı fiyat sıfırdan büyük olmalıdır." });
        return;
      }
      const existing = await prisma.analysisUnitPrice.findFirst({ orderBy: { createdAt: "asc" } });
      const unitPrice = existing
        ? await prisma.analysisUnitPrice.update({ where: { id: existing.id }, data: { pricePerAnalysis, currency } })
        : await prisma.analysisUnitPrice.create({ data: { pricePerAnalysis, currency } });
      sendJson(res, 200, {
        unitPrice: { id: unitPrice.id, pricePerAnalysis: Number(unitPrice.pricePerAnalysis), currency: unitPrice.currency },
        message: "Analiz başı fiyat güncellendi.",
      });
      return;
    }

    if (pathname === "/api/admin/analysis-sales" && req.method === "POST") {
      const body = await readJsonBody(req);
      const firmId = String(body.firmId || "").trim();
      const quantity = Number(body.quantity || 0);
      const note = String(body.note || "").trim();
      if (!firmId || !Number.isInteger(quantity) || quantity <= 0) {
        sendJson(res, 400, { message: "Firma ve satış analiz adedi zorunludur." });
        return;
      }
      const firm = await prisma.firm.findUnique({ where: { id: firmId } });
      if (!firm) {
        sendJson(res, 404, { message: "Firma bulunamadı." });
        return;
      }
      const unitPrice = (await prisma.analysisUnitPrice.findFirst({ orderBy: { createdAt: "asc" } })) || (await prisma.analysisUnitPrice.create({ data: { pricePerAnalysis: 25, currency: "TL" } }));
      const price = Number(unitPrice.pricePerAnalysis);
      const totalAmount = price * quantity;
      const sale = await prisma.$transaction(async (tx) => {
        const createdSale = await tx.firmAnalysisSale.create({
          data: {
            firmId,
            quantity,
            unitPrice: price,
            totalAmount,
            currency: unitPrice.currency,
            note: note || null,
          },
        });
        await tx.firmAnalysisBalance.upsert({
          where: { firmId },
          update: { totalPurchased: { increment: quantity } },
          create: { firmId, totalPurchased: quantity, usedByPromo: 0 },
        });
        return createdSale;
      });
      sendJson(res, 201, {
        sale: { id: sale.id, quantity: sale.quantity, unitPrice: price, totalAmount, currency: unitPrice.currency },
        message: "Toplu analiz satışı kaydedildi.",
      });
      return;
    }

    sendJson(res, 404, { message: "Admin endpoint bulunamadı." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Admin verileri alınırken bir hata oluştu.", detail });
  }
}

async function handleReportsApi(req, res, pathname) {
  try {
    const session = requireSalonSession(req, res, "reports");
    if (!session) return;
    const salonId = session.salonId;

    if (!["GET", "DELETE"].includes(req.method)) {
      sendJson(res, 405, { message: "Bu istek desteklenmiyor." });
      return;
    }

    const { getReportsBySalonId, getReportById, deleteReport } = await import("./src/lib/repositories/reportRepository.server.js");
    const reportPath = pathname.startsWith("/api/reports/") ? decodeURIComponent(pathname.slice("/api/reports/".length)) : "";
    const isPdfRequest = reportPath.endsWith("/pdf");
    const reportId = isPdfRequest ? reportPath.slice(0, -"/pdf".length) : reportPath;

    if (req.method === "DELETE") {
      if (!reportId) {
        sendJson(res, 400, { message: "Silinecek rapor seçilmedi." });
        return;
      }

      const report = await getReportById(reportId);
      if (!report || report.salonId !== salonId) {
        sendJson(res, 404, { message: "Rapor bulunamadı." });
        return;
      }

      await deleteReport(reportId);
      sendJson(res, 200, { message: "Rapor başarıyla silindi." });
      return;
    }

    if (isPdfRequest) {
      if (!reportId) {
        sendJson(res, 400, { message: "PDF için rapor seçilmedi." });
        return;
      }

      const report = await getReportById(reportId);
      if (!report || report.salonId !== salonId) {
        sendJson(res, 404, { message: "Rapor bulunamadı." });
        return;
      }

      const pdfBuffer = createReportPdf(report);
      const customerName = report.analysis?.customer?.fullName || "ciltgpt-rapor";
      sendFile(res, 200, "application/pdf", pdfBuffer, `${safeFileName(customerName)}-analiz-raporu.pdf`);
      return;
    }

    if (reportId) {
      const report = await getReportById(reportId);
      if (!report || report.salonId !== salonId) {
        sendJson(res, 404, { message: "Rapor bulunamadı." });
        return;
      }

      sendJson(res, 200, { report: databaseReportResponse(report) });
      return;
    }

    const reports = await getReportsBySalonId(salonId);
    sendJson(res, 200, { reports: reports.map(databaseReportResponse) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Raporlar alınırken bir hata oluştu.", detail });
  }
}

async function handleProductsApi(req, res) {
  try {
    const session = requireSalonSession(req, res, "products");
    if (!session) return;
    const salonId = session.salonId;

    const { getSalonProductsBySalonId, createSalonProduct, updateSalonProductStatus } = await import("./src/lib/repositories/productRepository.server.js");

    const productPath = new URL(req.url, `http://${req.headers.host}`).pathname;
    const productId = productPath.startsWith("/api/products/") ? decodeURIComponent(productPath.slice("/api/products/".length)) : "";

    if (req.method === "GET" && !productId) {
      const products = await getSalonProductsBySalonId(salonId);
      sendJson(res, 200, { products: products.map(productResponse) });
      return;
    }

    if (req.method === "PUT" && productId) {
      const body = await readJsonBody(req);
      const isActive = body.isActive === undefined ? body.status !== "Pasif" : Boolean(body.isActive);
      const product = await updateSalonProductStatus(salonId, productId, isActive);
      sendJson(res, 200, { product: productResponse(product), message: isActive ? "Ürün aktif hale getirildi." : "Ürün pasif hale getirildi." });
      return;
    }

    if (req.method === "POST" && !productId) {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const brand = String(body.brand || "").trim();
      const category = String(body.category || "").trim();
      const usagePurpose = String(body.usagePurpose || body.purpose || "").trim();
      const usageTime = String(body.usageTime || body.time || "").trim();

      if (!name || !brand || !category || !usagePurpose || !usageTime) {
        sendJson(res, 400, { message: "Ürün adı, marka, kategori, kullanım amacı ve kullanım zamanı zorunludur." });
        return;
      }

      const product = await createSalonProduct(salonId, {
        name,
        brand,
        category,
        usagePurpose,
        usageTime,
        isActive: body.isActive === undefined ? body.status !== "Pasif" : Boolean(body.isActive),
        isCabinProduct: Boolean(body.isCabinProduct),
      });

      sendJson(res, 201, { product: productResponse(product), message: "Ürün başarıyla oluşturuldu." });
      return;
    }

    sendJson(res, 405, { message: "Bu istek desteklenmiyor." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Ürün kaydedilirken bir hata oluştu.", detail });
  }
}

async function handleProductLibraryApi(req, res, pathname) {
  try {
    const session = requireSalonSession(req, res, "products");
    if (!session) return;
    const salonId = session.salonId;

    const { getProductBrands, importBrandProductsToSalon } = await import("./src/lib/repositories/productRepository.server.js");

    if (pathname === "/api/product-library/brands" && req.method === "GET") {
      const brands = await getProductBrands();
      sendJson(res, 200, { brands });
      return;
    }

    if (pathname === "/api/product-library/import-brand" && req.method === "POST") {
      const body = await readJsonBody(req);
      const brand = String(body.brand || "").trim();
      if (!brand) {
        sendJson(res, 400, { message: "Aktarılacak marka seçilmelidir." });
        return;
      }

      const result = await importBrandProductsToSalon(salonId, brand);
      const message =
        result.total === 0
          ? `${brand} markasına ait aktif ürün bulunamadı.`
          : result.added === 0
            ? `${brand} markasına ait ${result.total} ürün daha önce yüklenmiş. Yeni ürün eklenmedi.`
            : result.existing > 0
              ? `${brand} markasında ${result.total} ürün kontrol edildi. ${result.added} yeni ürün eklendi, ${result.existing} ürün zaten vardı.`
              : `${brand} markasına ait ${result.added} ürün salon ürünlerine eklendi.`;
      sendJson(res, 200, {
        ...result,
        message,
      });
      return;
    }

    sendJson(res, 404, { message: "Ürün kütüphanesi endpoint bulunamadı." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Ürün kütüphanesi işlemi başarısız oldu.", detail });
  }
}

async function handleFirmApi(req, res, pathname) {
  try {
    const session = requireFirmSession(req, res);
    if (!session) return;
    const { prisma } = await import("./src/lib/repositories/customerRepository.server.js");

    if (pathname === "/api/firm/products" && req.method === "GET") {
      const products = await prisma.product.findMany({
        where: { firmId: session.firmId },
        orderBy: { createdAt: "desc" },
      });
      sendJson(res, 200, { products: products.map(productResponse) });
      return;
    }

    if (pathname.startsWith("/api/firm/products/") && req.method === "PUT") {
      const productId = decodeURIComponent(pathname.slice("/api/firm/products/".length));
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const brand = String(body.brand || "").trim();
      const category = String(body.category || "").trim();
      const usagePurpose = String(body.usagePurpose || body.purpose || "").trim();
      const usageTime = String(body.usageTime || body.time || "").trim();

      if (!productId || !name || !brand || !category || !usagePurpose || !usageTime) {
        sendJson(res, 400, { message: "Ürün adı, marka, kategori, kullanım amacı ve kullanım zamanı zorunludur." });
        return;
      }

      const existing = await prisma.product.findFirst({
        where: {
          id: productId,
          firmId: session.firmId,
        },
      });
      if (!existing) {
        sendJson(res, 404, { message: "Ürün bulunamadı." });
        return;
      }

      const product = await prisma.product.update({
        where: { id: productId },
        data: {
          name,
          brand,
          category,
          usagePurpose,
          usageTime,
          isActive: body.isActive === undefined ? body.status !== "Pasif" : Boolean(body.isActive),
          isCabinProduct: Boolean(body.isCabinProduct),
        },
      });

      sendJson(res, 200, { product: productResponse(product), message: "Ürün başarıyla güncellendi." });
      return;
    }

    if (pathname === "/api/firm/product-template" && req.method === "GET") {
      const template = Buffer.from(productTemplateCsv(), "utf-8");
      sendFile(res, 200, "text/csv; charset=utf-8", template, "firma-urun-sablonu.csv");
      return;
    }

    if (pathname === "/api/firm/products/import" && req.method === "POST") {
      const buffer = await readRequestBuffer(req);
      const rawText = extractMultipartFileText(req, buffer);
      const rows = parseProductImportRows(rawText);
      if (rows.length < 2) {
        sendJson(res, 400, { message: "Yüklenecek ürün satırı bulunamadı." });
        return;
      }

      const headers = rows[0].map(normalizeImportHeader);
      const indexOf = (...names) => {
        const normalizedNames = names.map(normalizeImportHeader);
        return headers.findIndex((header) => normalizedNames.includes(header));
      };
      const indexes = {
        name: indexOf("name", "ürün adı", "urun adi"),
        brand: indexOf("brand", "marka"),
        category: indexOf("category", "kategori"),
        usagePurpose: indexOf("usagePurpose", "kullanım amacı", "kullanim amaci"),
        usageTime: indexOf("usageTime", "kullanım zamanı", "kullanim zamani"),
        isActive: indexOf("isActive", "aktif", "durum"),
        isCabinProduct: indexOf("isCabinProduct", "kabin ürünü mü", "kabin urunu mu"),
      };

      if ([indexes.name, indexes.brand, indexes.category, indexes.usagePurpose, indexes.usageTime].some((index) => index === -1)) {
        sendJson(res, 400, { message: "Şablon kolonları eksik. Lütfen sistem şablonunu kullanın." });
        return;
      }

      let created = 0;
      let skipped = 0;
      for (const row of rows.slice(1)) {
        const name = String(row[indexes.name] || "").trim();
        const brand = String(row[indexes.brand] || session.firmBrandName || "").trim();
        const category = String(row[indexes.category] || "").trim();
        const usagePurpose = String(row[indexes.usagePurpose] || "").trim();
        const usageTime = String(row[indexes.usageTime] || "").trim();
        const isActive = String(row[indexes.isActive] || "true").trim().toLowerCase() !== "false";
        const isCabinProduct = ["true", "evet", "1", "yes"].includes(String(row[indexes.isCabinProduct] || "false").trim().toLowerCase());

        if (!name || !brand || !category || !usagePurpose || !usageTime) {
          skipped += 1;
          continue;
        }

        const existing = await prisma.product.findFirst({
          where: {
            firmId: session.firmId,
            name,
            brand,
          },
        });

        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: { category, usagePurpose, usageTime, isActive, isCabinProduct },
          });
        } else {
          await prisma.product.create({
            data: {
              firmId: session.firmId,
              name,
              brand,
              category,
              usagePurpose,
              usageTime,
              isActive,
              isCabinProduct,
            },
          });
          created += 1;
        }
      }

      sendJson(res, 200, { created, skipped, message: `${created} yeni ürün eklendi. ${skipped} satır atlandı.` });
      return;
    }

    if (pathname === "/api/firm/salons" && req.method === "GET") {
      const salons = await prisma.salon.findMany({
        where: { createdByFirmId: session.firmId },
        orderBy: { createdAt: "desc" },
        include: { createdByUser: true },
      });
      sendJson(res, 200, {
        salons: salons.map((salon) => ({
          id: salon.id,
          name: salon.name,
          ownerName: salon.ownerName,
          email: salon.email,
          phone: salon.phone,
          city: salon.city,
          createdAt: salon.createdAt,
          createdBy: salon.createdByUser?.name || session.name,
        })),
      });
      return;
    }

    if (pathname === "/api/firm/salons" && req.method === "POST") {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const ownerName = String(body.ownerName || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const phone = String(body.phone || "").trim();
      const city = String(body.city || "").trim();
      const address = String(body.address || "").trim();
      const username = String(body.username || email.split("@")[0] || "").trim().toLowerCase();
      const password = String(body.password || "123456");
      const promoCodeText = String(body.promoCode || "").trim().toUpperCase();

      if (!name || !ownerName || !email || !phone || !city || !address || !username || !password) {
        sendJson(res, 400, { message: "Salon adı, yetkili, e-posta, telefon, şehir, adres, kullanıcı adı ve şifre zorunludur." });
        return;
      }

      const existingSalon = await prisma.salon.findUnique({ where: { email } });
      if (existingSalon) {
        sendJson(res, 409, { message: "Bu e-posta ile daha önce salon oluşturulmuş." });
        return;
      }

      const existingUser = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
      if (existingUser) {
        sendJson(res, 409, { message: "Bu kullanıcı adı veya e-posta daha önce kullanılmış." });
        return;
      }

      const salon = await prisma.$transaction(async (tx) => {
        const promoCode = promoCodeText ? await getValidFirmPromoCode(tx, promoCodeText, session.firmId) : null;

        const createdSalon = await tx.salon.create({
          data: {
            name,
            ownerName,
            email,
            phone,
            city,
            address,
            reportSalonName: name,
            createdByFirmId: session.firmId,
            createdByUserId: session.id,
            ...(promoCode
              ? {
                  subscription: {
                    create: {
                      packageName: promoCode.packageName,
                      monthlyLimit: promoCode.monthlyLimit,
                      currentUsage: 0,
                      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                      status: "ACTIVE",
                    },
                  },
                }
              : {}),
            users: {
              create: {
                name: ownerName,
                email,
                username,
                passwordHash: hashPassword(password),
                role: "SALON_OWNER",
                staffRole: "Salon Yöneticisi",
              },
            },
            teamMembers: {
              create: {
                name: ownerName,
                email,
                role: "Salon Yöneticisi",
                isActive: true,
              },
            },
          },
        });

        if (promoCode) {
          await tx.firmPromoCode.update({
            where: { id: promoCode.id },
            data: {
              status: "USED",
              usedAt: new Date(),
              usedBySalonId: createdSalon.id,
            },
          });
        }

        return createdSalon;
      });

      sendJson(res, 201, { salon, message: "Salon başarıyla eklendi." });
      return;
    }

    if (pathname === "/api/firm/promotions" && req.method === "GET") {
      const [balance, promoCodes] = await Promise.all([
        prisma.firmAnalysisBalance.findUnique({ where: { firmId: session.firmId } }),
        prisma.firmPromoCode.findMany({ where: { firmId: session.firmId }, orderBy: { createdAt: "desc" }, take: 50, include: { usedBySalon: true } }),
      ]);
      const packages = await getPackagePlans(prisma);
      sendJson(res, 200, {
        packages,
        balance: firmBalanceResponse(balance),
        promoCodes: promoCodes.map(promoCodeResponse),
      });
      return;
    }

    if (pathname === "/api/firm/promotions" && req.method === "POST") {
      const body = await readJsonBody(req);
      const packageName = String(body.packageName || "").trim();
      const packages = await getPackagePlans(prisma);
      const selectedPackage = packages.find((pack) => pack.id === packageIdFromName(packageName) || pack.name.toLowerCase() === packageName.toLowerCase());
      if (!selectedPackage) {
        sendJson(res, 400, { message: "Geçerli bir paket seçin." });
        return;
      }

      const monthlyLimit = selectedPackage.analysisLimit;
      const userLimit = selectedPackage.userLimitValue;
      if (monthlyLimit <= 0) {
        sendJson(res, 400, { message: "Bu paket için analiz limiti hesaplanamadı." });
        return;
      }

      const createdCode = await prisma.$transaction(async (tx) => {
        const balance = await tx.firmAnalysisBalance.upsert({
          where: { firmId: session.firmId },
          update: {},
          create: { firmId: session.firmId, totalPurchased: 0, usedByPromo: 0 },
        });
        const remaining = Math.max(balance.totalPurchased - balance.usedByPromo, 0);
        if (remaining < monthlyLimit) {
          throw new Error(`Yetersiz analiz bakiyesi. Bu paket için ${monthlyLimit} analiz gerekir, kalan bakiye ${remaining}.`);
        }

        let codeText = generatePromoCodeText(selectedPackage.name);
        let exists = await tx.firmPromoCode.findUnique({ where: { code: codeText } });
        while (exists) {
          codeText = generatePromoCodeText(selectedPackage.name);
          exists = await tx.firmPromoCode.findUnique({ where: { code: codeText } });
        }

        const code = await tx.firmPromoCode.create({
          data: {
            firmId: session.firmId,
            code: codeText,
            packageName: selectedPackage.name,
            monthlyLimit,
            userLimit,
          },
        });
        await tx.firmAnalysisBalance.update({
          where: { firmId: session.firmId },
          data: { usedByPromo: { increment: monthlyLimit } },
        });
        return code;
      });

      sendJson(res, 201, {
        promoCode: promoCodeResponse(createdCode),
        message: "Tek kullanımlık promosyon kodu üretildi.",
      });
      return;
    }

    if (pathname === "/api/firm/settings" && req.method === "GET") {
      const firm = await prisma.firm.findUnique({ where: { id: session.firmId } });
      if (!firm) {
        sendJson(res, 404, { message: "Firma bilgisi bulunamadı." });
        return;
      }
      sendJson(res, 200, { firm });
      return;
    }

    if (pathname === "/api/firm/settings" && req.method === "PUT") {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const brandName = String(body.brandName || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const phone = String(body.phone || "").trim();
      const website = String(body.website || "").trim();
      const address = String(body.address || "").trim();
      const logoUrl = String(body.logoUrl || "").trim();

      if (!name || !brandName || !email) {
        sendJson(res, 400, { message: "Firma adı, marka adı ve e-posta zorunludur." });
        return;
      }

      const firm = await prisma.firm.update({
        where: { id: session.firmId },
        data: {
          name,
          brandName,
          email,
          phone,
          website,
          address,
          logoUrl: logoUrl || null,
        },
      });

      const token = parseCookies(req).ciltgpt_session;
      if (token && sessions.has(token)) {
        sessions.set(token, {
          ...sessions.get(token),
          firmName: firm.name,
          firmBrandName: firm.brandName,
          firmLogoUrl: firm.logoUrl || "",
        });
      }

      sendJson(res, 200, { firm, message: "Firma bilgileri başarıyla güncellendi." });
      return;
    }

    sendJson(res, 404, { message: "Firma endpoint bulunamadı." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Firma ürün işlemi başarısız oldu.", detail });
  }
}

async function handleTeamApi(req, res) {
  try {
    const session = requireSalonSession(req, res, "team");
    if (!session) return;
    const salonId = session.salonId;

    const { getTeamMembersBySalonId, createTeamMember } = await import("./src/lib/repositories/teamRepository.server.js");

    if (req.method === "GET") {
      const members = await getTeamMembersBySalonId(salonId);
      sendJson(res, 200, { members: members.map(teamMemberResponse) });
      return;
    }

    if (req.method === "POST") {
      const { getSubscriptionBySalonId } = await import("./src/lib/repositories/subscriptionRepository.server.js");
      const [members, subscription] = await Promise.all([
        getTeamMembersBySalonId(salonId),
        getSubscriptionBySalonId(salonId),
      ]);
      const { prisma } = await import("./src/lib/repositories/customerRepository.server.js");
      const packagePlan = subscription ? await getPackagePlanByName(prisma, subscription.packageName) : null;
      const userLimit = packagePlan
        ? packagePlan.userLimit ?? Infinity
        : numericUserLimitFromPackage(subscription?.packageName || "") ?? 0;

      if (members.length >= userLimit) {
        sendJson(res, 403, {
          message: `Mevcut paketiniz ${userLimit} kullanıcı içerir. Yeni kullanıcı eklemek için paketinizi yükseltin.`,
          redirectTo: "/dashboard/billing",
        });
        return;
      }

      const body = await readJsonBody(req);
      const name = String(body.fullName || body.name || "").trim();
      const email = String(body.email || "").trim();
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const role = String(body.role || "").trim();

      if (!name || !email || !username || !password || !role) {
        sendJson(res, 400, { message: "Ad soyad, e-posta, kullanıcı adı, şifre ve rol zorunludur." });
        return;
      }

      if (password.length < 6) {
        sendJson(res, 400, { message: "Şifre en az 6 karakter olmalıdır." });
        return;
      }

      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
      });
      if (existingUser) {
        sendJson(res, 409, { message: "Bu e-posta veya kullanıcı adı zaten kullanılıyor." });
        return;
      }

      const member = await createTeamMember({
        salon: { connect: { id: salonId } },
        name,
        email,
        role,
        isActive: true,
      });

      await prisma.user.create({
        data: {
          salon: { connect: { id: salonId } },
          name,
          email,
          username,
          passwordHash: hashPassword(password),
          staffRole: role,
          role: role === "Salon Yöneticisi" ? "SALON_OWNER" : "SALON_STAFF",
        },
      });

      sendJson(res, 201, { member: teamMemberResponse(member), message: "Kullanıcı başarıyla eklendi." });
      return;
    }

    sendJson(res, 405, { message: "Bu istek desteklenmiyor." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
    sendJson(res, 500, { message: "Kullanıcı eklenirken bir hata oluştu.", detail });
  }
}

function safePath(pathname) {
  const cleanPath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  return join(root, cleanPath);
}

export async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  const srcIndex = pathname.indexOf("/src/");
  const assetPathname = srcIndex > 0 ? pathname.slice(srcIndex) : pathname;

  try {
    if (pathname.startsWith("/api/auth/")) {
      await handleAuthApi(req, res, pathname);
      return;
    }

    if (pathname === "/api/dashboard") {
      await handleDashboardApi(req, res);
      return;
    }

    if (pathname === "/api/customers") {
      await handleCustomersApi(req, res);
      return;
    }

    if (pathname.startsWith("/api/customers/")) {
      await handleCustomerDetailApi(req, res, pathname);
      return;
    }

    if (pathname === "/api/analyses") {
      await handleAnalysesApi(req, res);
      return;
    }

    if (pathname === "/api/reports" || pathname.startsWith("/api/reports/")) {
      await handleReportsApi(req, res, pathname);
      return;
    }

    if (pathname === "/api/products" || pathname.startsWith("/api/products/")) {
      await handleProductsApi(req, res);
      return;
    }

    if (pathname === "/api/product-library/brands" || pathname === "/api/product-library/import-brand") {
      await handleProductLibraryApi(req, res, pathname);
      return;
    }

    if (pathname === "/api/firm/products" || pathname.startsWith("/api/firm/products/") || pathname === "/api/firm/product-template" || pathname === "/api/firm/products/import" || pathname === "/api/firm/salons" || pathname === "/api/firm/promotions" || pathname === "/api/firm/settings") {
      await handleFirmApi(req, res, pathname);
      return;
    }

    if (pathname === "/api/team") {
      await handleTeamApi(req, res);
      return;
    }

    if (pathname === "/api/subscription") {
      await handleSubscriptionApi(req, res);
      return;
    }

    if (pathname === "/api/package-plans") {
      await handlePackagePlansApi(req, res);
      return;
    }

    if (pathname === "/api/protocols") {
      await handleProtocolsApi(req, res);
      return;
    }

    if (pathname === "/api/settings") {
      await handleSettingsApi(req, res);
      return;
    }

    if (pathname.startsWith("/api/admin/")) {
      await handleAdminApi(req, res, pathname);
      return;
    }

    const filePath = assetPathname === "/" ? join(root, "index.html") : safePath(assetPathname.slice(1));
    const ext = extname(filePath);
    const file = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store, max-age=0",
    });
    res.end(file);
  } catch {
    const app = await readFile(join(root, "index.html"));
    res.writeHead(200, {
      "Content-Type": contentTypes[".html"],
      "Cache-Control": "no-store, max-age=0",
    });
    res.end(app);
  }
}

const server = createServer(handleRequest);

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`Port ${port} zaten kullaniliyor. Panel aciksa su adresi kullanin: http://localhost:${port}/dashboard`);
    return;
  }

  throw error;
});

if (!process.env.VERCEL) {
  server.listen(port, () => {
    console.log(`CiltGPT SaaS MVP: http://localhost:${port}`);
  });
}

