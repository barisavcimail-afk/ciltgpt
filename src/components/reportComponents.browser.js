(function () {
  function reportSummary(report) {
    const score = Math.min(Math.max(Number(report.overallScore) || 0, 0), 100);
    return `
      <section class="panel report-hero">
        <div>
          <span class="muted">Müşteri</span>
          <h2>${report.customerName}</h2>
          <p>${report.age} yaş · ${report.skinType} cilt · ${report.complaint}</p>
        </div>
        <div class="report-score-ring" style="--score:${score}">
          <span>Genel cilt skoru</span>
          <strong>${report.overallScore}</strong>
          <small>/100</small>
        </div>
        <div class="report-summary-grid">
          <article><span>Analiz tarihi</span><strong>${new Date(report.analysisDate).toLocaleDateString("tr-TR")}</strong></article>
          <article><span>Durum</span><strong>${report.status}</strong></article>
          <article><span>Ana şikayet</span><strong>${report.complaint}</strong></article>
        </div>
      </section>
    `;
  }

  function scoreCards(scores) {
    return window.CiltGPTComponents.scoreCards(scores);
  }

  function protocolCard(protocol) {
    return `
      <article class="panel protocol-card">
        <div class="section-title"><h2>Kabin protokolü</h2></div>
        <div class="protocol-lines">
          <p><span>Protokol adı</span><strong>${protocol.name}</strong></p>
          <p><span>Seans sayısı</span><strong>${protocol.sessions}</strong></p>
          <p><span>Sıklık</span><strong>${protocol.frequency}</strong></p>
          <p><span>Salon notu</span><strong>${protocol.salonNote}</strong></p>
        </div>
        <p class="protocol-warning">Cilt skorları ve uzman değerlendirmesi doğrultusunda, önerilen kabin protokolü salon uzmanınız tarafından kişiye özel olarak güncellenebilir.</p>
      </article>
    `;
  }

  function productRecommendationCard(product) {
    return `
      <article class="product-card">
        <strong>${product.name}</strong>
        <p><span>Kullanım zamanı</span>${product.time}</p>
        <p><span>Kullanım amacı</span>${product.purpose}</p>
        <p><span>Salon satış notu</span>${product.salesNote}</p>
      </article>
    `;
  }

  function photoGrid(photos) {
    const labels = {
      front: "Ön yüz",
      left: "Sol profil",
      right: "Sağ profil",
      close: "Yakın plan",
    };
    const entries = Object.entries(labels).filter(([key]) => {
      const value = photos?.[key];
      return typeof value === "string" && value.startsWith("data:image/");
    });

    if (!entries.length) return "";

    return `
      <div class="analysis-photo-grid">
        ${entries
          .map(
            ([key, label]) => `
              <button class="analysis-photo-card" type="button" data-open-photo-modal data-photo-src="${photos[key]}" data-photo-title="${label}">
                <img src="${photos[key]}" alt="${label}" />
                <strong>${label}</strong>
              </button>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function analysisPhotoGallery(photos) {
    const normalGrid = photoGrid(photos);
    if (!normalGrid) return "";

    return `
      <section class="panel">
        <div class="section-title"><h2>Analiz fotoğrafları</h2></div>
        <h3 class="photo-section-title">Normal fotoğraflar</h3>
        ${normalGrid}
        <div class="modal-backdrop photo-modal-backdrop" id="analysis-photo-modal" hidden>
          <section class="photo-modal" role="dialog" aria-modal="true" aria-labelledby="analysis-photo-modal-title">
            <div class="modal-header">
              <h2 id="analysis-photo-modal-title">Analiz fotoğrafı</h2>
              <button class="icon-button" type="button" aria-label="Kapat" data-close-photo-modal>&times;</button>
            </div>
            <img id="analysis-photo-modal-image" alt="Analiz fotoğrafı büyük görünüm" />
          </section>
        </div>
      </section>
    `;
  }

  function reportActions(toHref) {
    return `
      <div class="report-actions">
        <button class="button ghost" type="button" data-preview-report>PDF Önizle</button>
        <button class="button secondary" type="button" data-download-pdf>PDF İndir</button>
        <button class="button secondary" type="button" data-soon-action>WhatsApp ile Paylaş</button>
        <a class="button" href="${toHref("/dashboard/new-analysis")}" data-path="/dashboard/new-analysis">Yeni Analiz Başlat</a>
      </div>
    `;
  }

  function printableScoreCards(report) {
    return `
      <div class="print-score-grid">
        <article><span>Genel cilt skoru</span><strong>${report.overallScore}/100</strong></article>
        ${Object.entries(report.scores)
          .map(([label, value]) => `<article><span>${label}</span><strong>${value}/100</strong></article>`)
          .join("")}
      </div>
    `;
  }

  function PrintableReportSection(report, protocol, products, branding, aiComment) {
    const date = new Date(report.analysisDate).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    return `
      <section class="printable-report">
        <header class="print-header">
          <div class="print-logo">${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="Salon logosu" />` : "Logo"}</div>
          <div>
            <h2>${branding.reportSalonName || branding.salonName}</h2>
            <p>${branding.city} · ${branding.phone}</p>
          </div>
        </header>

        <div class="print-title-row">
          <div>
            <span>Müşteri</span>
            <strong>${report.customerName}</strong>
          </div>
          <div>
            <span>Analiz tarihi</span>
            <strong>${date}</strong>
          </div>
          <div>
            <span>Genel cilt skoru</span>
            <strong>${report.overallScore}/100</strong>
          </div>
        </div>

        <div class="print-section">
          <h3>Skor Kartları</h3>
          ${printableScoreCards(report)}
        </div>

        <div class="print-section">
          <h3>AI Yorum</h3>
          <p>${aiComment}</p>
        </div>

        <div class="print-section">
          <h3>Önerilen Kabin Protokolü</h3>
          <p><strong>${protocol.name}</strong></p>
          <p>Seans sayısı: ${protocol.sessions} · Sıklık: ${protocol.frequency}</p>
          <p>${protocol.salonNote}</p>
        </div>

        <div class="print-section">
          <h3>Önerilen Ev Devam Ürünleri</h3>
          <p>Bu ürünler salonunuz tarafından müşteriye ev devam bakımı olarak önerilebilir.</p>
          <ul class="print-product-list">
            ${products.map((product) => `<li><strong>${product.name}</strong><span>${product.time} · ${product.purpose}</span></li>`).join("")}
          </ul>
        </div>

        <footer class="print-footer">
          <div>
            <strong>Salon iletişim</strong>
            <p>WhatsApp: ${branding.whatsapp} · ${branding.email}</p>
            <p>${branding.address}</p>
          </div>
          <p>${branding.reportFooter}</p>
        </footer>
      </section>
    `;
  }

  function ReportPreview(report, protocol, products, branding, aiComment) {
    return `
      <section class="panel report-preview-panel" id="report-preview">
        <div class="section-title">
          <h2>Rapor Önizleme</h2>
          <span class="muted">A4 yazdırılabilir taslak</span>
        </div>
        ${PrintableReportSection(report, protocol, products, branding, aiComment)}
      </section>
    `;
  }

  window.CiltGPTReportComponents = {
    ReportSummary: reportSummary,
    ScoreCards: scoreCards,
    ProtocolCard: protocolCard,
    ProductRecommendationCard: productRecommendationCard,
    AnalysisPhotoGallery: analysisPhotoGallery,
    ReportActions: reportActions,
    ReportPreview,
    PrintableReportSection,
  };
})();

