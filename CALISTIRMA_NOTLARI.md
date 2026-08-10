# CiltGPT Calistirma Notlari

## En kolay calistirma

Proje klasorundeki `index.html` dosyasini cift tiklayarak da acabilirsiniz.
Bu modda sayfa gecisleri adres cubugunda `#` ile calisir.

## Yerel sunucu ile calistirma

Windows'ta proje klasorundeki dosyayi acin:

```bat
BASLAT_CILTGPT.bat
```

Bu dosya paneli su adreste acar:

```text
http://localhost:3000/dashboard
```

## Komutla calistirma

Bilgisayarda Node.js kuruluysa:

```bash
node server.js
```

Node.js PATH icinde degilse, Codex runtime Node yolu:

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

## Sayfalar

- Dashboard: `/dashboard`
- Musteriler: `/dashboard/customers`
- Musteri Detay: `/dashboard/customers/ayse-yilmaz`
- Yeni Analiz: `/dashboard/new-analysis`
- Mock Rapor: `/dashboard/reports/mock-report-001`
- Rapor Onizleme: `/dashboard/reports/mock-report-001` icinde `Rapor Onizleme` bolumu
- Urunler: `/dashboard/products`
- Abonelik: `/dashboard/billing`
- Ekip: `/dashboard/team`
- Ayarlar: `/dashboard/settings`
- Admin Genel Bakis: `/admin`
- Admin Salonlar: `/admin/salons`
- Admin Analizler: `/admin/analyses`
- Admin Paketler: `/admin/packages`
- Admin Urun Kutuphanesi: `/admin/products`
- Admin Sistem Ayarlari: `/admin/settings`
