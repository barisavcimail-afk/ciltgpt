(function () {
  function SettingsSummaryCards(productCount) {
    return `
      <section class="stats-grid settings-stats">
        <article class="stat-card"><span>Aktif salon</span><strong>1</strong></article>
        <article class="stat-card"><span>Tanımlı ürün</span><strong>${productCount}</strong></article>
        <article class="stat-card"><span>Rapor şablonu</span><strong>Aktif</strong></article>
      </section>
    `;
  }

  function SalonProfileForm() {
    return `
      <section class="panel settings-section">
        <div class="section-title"><h2>Salon Bilgileri</h2></div>
        <div class="form-grid">
          <label><span>Salon adı</span><input name="salonName" type="text" value="CiltGPT Beauty Studio" /></label>
          <label><span>Yetkili kişi</span><input name="ownerName" type="text" value="Deniz Arslan" /></label>
          <label><span>Telefon</span><input name="phone" type="tel" value="0532 000 00 00" /></label>
          <label><span>E-posta</span><input name="email" type="email" value="info@ciltgptstudio.com" /></label>
          <label><span>Şehir</span><input name="city" type="text" value="İstanbul" /></label>
          <label><span>Adres</span><input name="address" type="text" value="Bağdat Caddesi No: 120 Kadıköy" /></label>
        </div>
      </section>
    `;
  }

  function ReportBrandingForm() {
    const logoUrl = window.CiltGPTSalonBranding?.logoUrl || "";

    return `
      <section class="panel settings-section">
        <div class="section-title"><h2>Rapor Marka Ayarları</h2></div>
        <div class="settings-logo-preview" id="settings-logo-preview">
          ${logoUrl ? `<img src="${logoUrl}" alt="Salon logosu" />` : "<span>Logo</span>"}
        </div>
        <div class="form-grid">
          <label><span>Rapor üzerinde görünecek salon adı</span><input name="reportSalonName" type="text" value="CiltGPT Beauty Studio" /></label>
          <label class="file-field"><span>Logo yükleme alanı</span><input name="logo" type="file" accept="image/*" /></label>
          <label><span>WhatsApp iletişim numarası</span><input name="whatsapp" type="tel" value="905320000000" /></label>
          <label><span>Rapor alt notu</span><textarea name="reportFooter" rows="4">Bu rapor salon uzmanı değerlendirmesiyle birlikte yorumlanmalıdır.</textarea></label>
        </div>
      </section>
    `;
  }

  function NotificationSettingsForm() {
    return `
      <section class="panel settings-section">
        <div class="section-title"><h2>Bildirim Ayarları</h2></div>
        <div class="settings-check-list">
          <label class="checkbox-row settings-checkbox">
            <input name="notifyAnalysisDone" type="checkbox" checked />
            <span>Yeni analiz tamamlandığında bildirim gönder</span>
          </label>
          <label class="checkbox-row settings-checkbox">
            <input name="notifyControlTime" type="checkbox" checked />
            <span>Müşteri kontrol zamanı geldiğinde hatırlatma oluştur</span>
          </label>
          <label class="checkbox-row settings-checkbox">
            <input name="notifyProductRenewal" type="checkbox" />
            <span>Ev devam ürünü yenileme zamanı geldiğinde hatırlatma oluştur</span>
          </label>
        </div>
      </section>
    `;
  }

  window.CiltGPTSettingsComponents = {
    SettingsSummaryCards,
    SalonProfileForm,
    ReportBrandingForm,
    NotificationSettingsForm,
  };
})();
