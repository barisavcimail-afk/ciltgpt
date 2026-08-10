(function () {
  window.CiltGPTTeamData = {
    members: [
      {
        id: "ayse-demir",
        fullName: "Ayşe Demir",
        email: "ayse@bellabeauty.com",
        role: "Salon Yöneticisi",
        status: "Aktif",
        lastLogin: "Bugün",
      },
      {
        id: "elif-kaya",
        fullName: "Elif Kaya",
        email: "elif@bellabeauty.com",
        role: "Analiz Uzmanı",
        status: "Aktif",
        lastLogin: "Dün",
      },
      {
        id: "zeynep-arslan",
        fullName: "Zeynep Arslan",
        email: "zeynep@bellabeauty.com",
        role: "Satış Danışmanı",
        status: "Aktif",
        lastLogin: "3 gün önce",
      },
      {
        id: "merve-yildiz",
        fullName: "Merve Yıldız",
        email: "merve@bellabeauty.com",
        role: "Resepsiyon",
        status: "Pasif",
        lastLogin: "12 gün önce",
      },
    ],
    roles: [
      {
        name: "Salon Yöneticisi",
        permissions: ["Tüm modüllere erişebilir", "Ayarları yönetebilir", "Ekip üyelerini yönetebilir"],
      },
      {
        name: "Analiz Uzmanı",
        permissions: ["Yeni analiz başlatabilir", "Raporları görüntüleyebilir", "Müşteri bilgilerini güncelleyebilir"],
      },
      {
        name: "Satış Danışmanı",
        permissions: ["Ürün önerilerini görüntüleyebilir", "Müşteri takiplerini görebilir", "WhatsApp mesajı hazırlayabilir"],
      },
      {
        name: "Resepsiyon",
        permissions: ["Müşteri oluşturabilir", "Randevu/takip notlarını görebilir", "Analiz geçmişini görüntüleyebilir"],
      },
    ],
  };
})();

