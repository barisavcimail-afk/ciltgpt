import { PrismaClient, AnalysisStatus, Gender, SubscriptionStatus, UserRole } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { DEFAULT_SALON_ID } from "../src/lib/constants";

const prisma = new PrismaClient();
function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const salon = await prisma.salon.upsert({
    where: { id: DEFAULT_SALON_ID },
    update: {
      name: "Bella Beauty",
      ownerName: "Ayşe Demir",
      email: "info@bellabeauty.com",
      phone: "0532 000 00 00",
      city: "İstanbul",
      address: "Bağdat Caddesi No: 120 Kadıköy",
    },
    create: {
      id: DEFAULT_SALON_ID,
      name: "Bella Beauty",
      ownerName: "Ayşe Demir",
      email: "info@bellabeauty.com",
      phone: "0532 000 00 00",
      city: "İstanbul",
      address: "Bağdat Caddesi No: 120 Kadıköy",
      users: {
        create: [
          {
            name: "Ayşe Demir",
            email: "ayse@bellabeauty.com",
            username: "ayse",
            passwordHash: hashPassword("123456"),
            staffRole: "Salon Yöneticisi",
            role: UserRole.SALON_OWNER,
          },
        ],
      },
      subscription: {
        create: {
          packageName: "Pro",
          monthlyLimit: 150,
          currentUsage: 64,
          renewalDate: new Date("2026-08-01"),
          status: SubscriptionStatus.ACTIVE,
        },
      },
      teamMembers: {
        create: [
          { name: "Ayşe Demir", email: "ayse@bellabeauty.com", role: "Salon Yöneticisi", isActive: true },
        ],
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@ciltgpt.com" },
    update: {
      salonId: null,
      name: "Platform Admin",
      username: "admin",
      passwordHash: hashPassword("admin123"),
      staffRole: null,
      role: UserRole.ADMIN,
    },
    create: {
      name: "Platform Admin",
      email: "admin@ciltgpt.com",
      username: "admin",
      passwordHash: hashPassword("admin123"),
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "ayse@bellabeauty.com" },
    update: {
      salonId: salon.id,
      name: "Ayşe Demir",
      username: "ayse",
      passwordHash: hashPassword("123456"),
      staffRole: "Salon Yöneticisi",
      role: UserRole.SALON_OWNER,
    },
    create: {
      salon: { connect: { id: salon.id } },
      name: "Ayşe Demir",
      email: "ayse@bellabeauty.com",
      username: "ayse",
      passwordHash: hashPassword("123456"),
      staffRole: "Salon Yöneticisi",
      role: UserRole.SALON_OWNER,
    },
  });

  const firm = await prisma.firm.upsert({
    where: { email: "firm@hedracare.com" },
    update: {
      name: "HedraCare Firma",
      brandName: "HedraCare",
      phone: "0850 000 00 00",
      isActive: true,
    },
    create: {
      name: "HedraCare Firma",
      brandName: "HedraCare",
      email: "firm@hedracare.com",
      phone: "0850 000 00 00",
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "firm@hedracare.com" },
    update: {
      firmId: firm.id,
      salonId: null,
      name: "HedraCare Yetkili",
      username: "hedracare",
      passwordHash: hashPassword("firm123"),
      staffRole: null,
      role: UserRole.FIRM,
    },
    create: {
      firm: { connect: { id: firm.id } },
      name: "HedraCare Yetkili",
      email: "firm@hedracare.com",
      username: "hedracare",
      passwordHash: hashPassword("firm123"),
      role: UserRole.FIRM,
    },
  });

  const [ayse, elif, zeynep] = await Promise.all([
    prisma.customer.create({
      data: {
        salon: { connect: { id: salon.id } },
        fullName: "Ayşe Yılmaz",
        phone: "0532 111 22 33",
        age: 34,
        gender: Gender.FEMALE,
        notes: "Nem dengesi takip ediliyor.",
      },
    }),
    prisma.customer.create({
      data: {
        salon: { connect: { id: salon.id } },
        fullName: "Elif Demir",
        phone: "0543 222 33 44",
        age: 29,
        gender: Gender.FEMALE,
        notes: "Leke protokolü planlandı.",
      },
    }),
    prisma.customer.create({
      data: {
        salon: { connect: { id: salon.id } },
        fullName: "Zeynep Kaya",
        phone: "0554 333 44 55",
        age: 41,
        gender: Gender.FEMALE,
        notes: "Hassasiyet nedeniyle düşük yoğunluk önerildi.",
      },
    }),
  ]);

  await prisma.product.createMany({
    data: [
      { name: "HydraCare Gentle Cleanser", brand: "HydraCare", category: "Temizleyici", usagePurpose: "Hassasiyet", usageTime: "Sabah / Akşam" },
      { name: "HydraCare Barrier Serum", brand: "HydraCare", category: "Serum", usagePurpose: "Bariyer onarımı", usageTime: "Akşam" },
      { name: "HydraCare SPF 50", brand: "HydraCare", category: "Güneş Koruyucu", usagePurpose: "SPF koruması", usageTime: "Sabah" },
      { name: "HydraCare Night Repair Cream", brand: "HydraCare", category: "Gece Bakımı", usagePurpose: "Nem desteği", usageTime: "Akşam" },
      { name: "HydraCare Hydration Mask", brand: "HydraCare", category: "Maske", usagePurpose: "Nem desteği", usageTime: "Haftada 2" },
    ],
  });

  const analysisData = [
    { customerId: ayse.id, skinType: "Karma", mainConcern: "Leke", score: 72 },
    { customerId: elif.id, skinType: "Kuru", mainConcern: "Kuruluk", score: 81 },
    { customerId: zeynep.id, skinType: "Hassas", mainConcern: "Hassasiyet", score: 65 },
  ];

  for (const item of analysisData) {
    await prisma.analysis.create({
      data: {
        salon: { connect: { id: salon.id } },
        customer: { connect: { id: item.customerId } },
        status: AnalysisStatus.COMPLETED,
        skinType: item.skinType,
        mainConcern: item.mainConcern,
        consentAccepted: true,
        report: {
          create: {
            salon: { connect: { id: salon.id } },
            overallScore: item.score,
            hydrationScore: item.score - 4,
            pigmentationScore: item.score - 18,
            poreScore: item.score - 11,
            wrinkleScore: item.score - 24,
            sensitivityScore: item.score + 1,
            aiComment:
              "Mock seed raporu: cilt bariyerini destekleyen, düzenli SPF kullanımını içeren bir bakım protokolü önerilir.",
          },
        },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

