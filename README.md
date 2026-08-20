# CiltGPT SaaS MVP

Mock data ile çalışan CiltGPT SaaS MVP paneli.

## Database Setup

PostgreSQL ve Prisma ORM için hazırlanan şema `prisma/schema.prisma` içindedir.

`.env` dosyanızda veritabanı bağlantısını tanımlayın:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/ciltgpt"
```

Prisma komutları:

```bash
npx prisma generate
npx prisma migrate dev
npm run seed
```

Not: Mevcut ekranlar henüz veritabanına bağlanmadı; mock data dosyaları çalışmaya devam eder.

## Online Environment Setup

GitHub'a `.env` dosyası gönderilmez. Lokal çalışan OpenAI anahtarı online ortamda otomatik gelmez.

Vercel veya sunucuda Environment Variables bölümüne şu değerler eklenmelidir:

```env
ANALYSIS_PROVIDER=openaiVision
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-5-mini
DATABASE_URL=YOUR_PRODUCTION_DATABASE_URL
SESSION_SECRET=CHANGE_ME_LONG_RANDOM_VALUE
SALON_LOGIN_PASSWORD=CHANGE_ME
ADMIN_LOGIN_PASSWORD=CHANGE_ME
```

Bu değerler eklenmeden online analiz ekranında `OPENAI_API_KEY is not configured` hatası alınır.

## Data Access Layer

Mock data su an arayuzu beslemeye devam eder.

Repository katmani gercek veritabanina gecis icin hazirlandi. Prisma Client `src/lib/prisma.ts` icinde singleton olarak tutulur ve veri erisim fonksiyonlari `src/lib/repositories/` altindadir.

UI baglantisi sonraki asamada yapilacaktir.

## First Database Connected Page: Customers

`/dashboard/customers` sayfasi ilk veritabani baglantisi hazirlanan ekrandir.

Musteri listesi artik server tarafindaki Prisma repository katmani uzerinden `/api/customers` endpoint'i ile okunur. Yeni musteri formu ayni endpoint'e kayit gonderir. Mevcut mock data dosyalari diger ekranlari beslemeye devam eder.

## Database Connected Analysis Flow

`/dashboard/new-analysis` sayfasinda musteri secimi PostgreSQL verisinden okunur.

Analiz baslatildiginda server tarafinda `Analysis` kaydi olusturulur, mock analiz servisi sonuc uretir ve `Report` kaydi veritabanina yazilir. Fotograf dosyalari bu asamada storage'a yuklenmez; wizard icinde sadece dosya adi tutulur.

## Database Connected Reports

`/dashboard/reports` ve `/dashboard/reports/[id]` sayfalari PostgreSQL uzerindeki rapor verisini okur.

Rapor listesi `Report`, `Analysis` ve `Customer` iliskileriyle beslenir. Rapor detayinda musteri bilgisi, analiz tarihi, cilt tipi, ana sikayet, skorlar ve AI yorum veritabanindan gelir. Kabin protokolu ve ev devam urunleri bu asamada mock kalir.

## Database Connected Products

`/dashboard/products` sayfasi urun listesini PostgreSQL uzerindeki `Product` kayitlarindan okur.

Yeni urun formu `name`, `brand`, `category`, `usagePurpose`, `usageTime` ve `isActive` alanlariyla veritabanina kayit olusturur. Rapor ekranindaki otomatik urun onerileri bu asamada mock veriyle calismaya devam eder.

## Database Connected Team

`/dashboard/team` sayfasi ekip uyelerini PostgreSQL uzerindeki `TeamMember` kayitlarindan okur.

Yeni kullanici davet formu `salonId`, `name`, `email`, `role` ve `isActive` alanlariyla veritabanina ekip uyesi olusturur. Kullanici limiti kontrolu bu asamada mevcut mock abonelik verisiyle calismaya devam eder.

## Database Connected Billing

`/dashboard/billing` ve dashboard uzerindeki paket/kullanim karti PostgreSQL uzerindeki `Subscription` kaydindan beslenir.

Kalan analiz `monthlyLimit - currentUsage` olarak, kullanim yuzdesi `(currentUsage / monthlyLimit) * 100` olarak hesaplanir. Yeni analiz basarili olustugunda `currentUsage` degeri 1 artirilir.

## Database Connected Settings

`/dashboard/settings` sayfasindaki Salon Bilgileri bolumu PostgreSQL uzerindeki `Salon` kaydindan okunur ve guncellenir.

Ozet kartlarda aktif salon bilgisi salon kaydindan, tanimli urun sayisi `Product` kayitlarindan hesaplanir. Rapor marka ayarlari, analiz ayarlari ve bildirim ayarlari bu asamada mock kalir.

## Database Connected Admin

`/admin` ve `/admin/salons` ekranlari PostgreSQL verilerinden beslenir.

Admin dashboard kartlari salon, abonelik, analiz ve rapor kayitlarindan hesaplanir. Salon listesi `Salon`, `Subscription`, `TeamMember` ve `Analysis` iliskileriyle okunur. Diger admin ekranlari bu asamada mock veriyle calismaya devam eder.
