(function () {
  function badge(label) {
    const className = label.includes("yenileme") || label.includes("önerilir") || label.includes("gerekiyor") ? "pending" : "";
    return `<span class="status ${className}">${label}</span>`;
  }

  function CustomerProfileCard(customer) {
    return `
      <section class="panel customer-detail-hero">
        <div>
          <span class="muted">Müşteri Profili</span>
          <h2>${customer.fullName}</h2>
          <p>${customer.phone}</p>
        </div>
        <div class="customer-badge-row">
          ${(customer.crm?.badges || [customer.status]).map((item) => badge(item)).join("")}
        </div>
        <div class="customer-profile-grid">
          <article><span>Yaş</span><strong>${customer.age}</strong></article>
          <article><span>Cinsiyet</span><strong>${customer.gender}</strong></article>
          <article><span>İlk kayıt tarihi</span><strong>${new Date(customer.firstRegistrationDate).toLocaleDateString("tr-TR")}</strong></article>
          <article><span>Son analiz tarihi</span><strong>${new Date(customer.lastAnalysisDate).toLocaleDateString("tr-TR")}</strong></article>
          <article><span>Durum</span><strong>${customer.status}</strong></article>
        </div>
      </section>
    `;
  }

  function CustomerSkinSummary(customer) {
    const crm = customer.crm;
    return `
      <section class="panel">
        <div class="section-title"><h2>Cilt Özeti</h2></div>
        <div class="summary-grid crm-summary-grid">
          <article><span>Son genel skor</span><strong>${crm.lastScore}/100</strong></article>
          <article><span>Cilt tipi</span><strong>${crm.skinType}</strong></article>
          <article><span>Ana şikayet</span><strong>${crm.complaint}</strong></article>
          <article><span>Hassasiyet durumu</span><strong>${crm.sensitivity}</strong></article>
          <article><span>SPF kullanımı</span><strong>${crm.spf}</strong></article>
          <article><span>Ev bakım rutini</span><strong>${crm.routine}</strong></article>
        </div>
      </section>
    `;
  }

  function CustomerAnalysisHistory(reports, toHref) {
    const rows = reports
      .map(
        (report) => `
          <tr>
            <td>${report.id}</td>
            <td>${new Date(report.analysisDate).toLocaleDateString("tr-TR")}</td>
            <td>${report.overallScore}</td>
            <td>${report.complaint}</td>
            <td><span class="status ${report.status === "Analiz bekliyor" ? "pending" : ""}">${report.status}</span></td>
            <td><a class="table-action" href="${toHref(`/dashboard/reports/${report.id}`)}" data-path="/dashboard/reports/${report.id}">Rapor</a></td>
          </tr>
        `,
      )
      .join("");

    return `
      <section class="panel">
        <div class="section-title"><h2>Analiz Geçmişi</h2><span class="muted">${reports.length} kayıt</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Rapor ID</th><th>Tarih</th><th>Genel skor</th><th>Ana şikayet</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function CustomerProductHistory(products) {
    const rows = products.length
      ? products
          .map(
            (product) => `
              <tr>
                <td>${product.productName}</td>
                <td>${new Date(product.recommendedDate).toLocaleDateString("tr-TR")}</td>
                <td>${product.purpose}</td>
                <td>${product.renewalEstimate}</td>
                <td>${badge(product.status)}</td>
              </tr>
            `,
          )
          .join("")
      : '<tr><td colspan="5">Henüz ürün önerisi bulunmuyor.</td></tr>';

    return `
      <section class="panel">
        <div class="section-title"><h2>Önerilen Ürün Geçmişi</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Ürün adı</th><th>Önerildiği tarih</th><th>Kullanım amacı</th><th>Yenileme tahmini</th><th>Durum</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function CustomerFollowUpReminders(reminders) {
    return `
      <section class="panel">
        <div class="section-title"><h2>Takip Hatırlatmaları</h2></div>
        <div class="reminder-grid">
          ${reminders
            .map(
              (item) => `
                <article class="reminder-card">
                  ${badge(item.status)}
                  <strong>${item.title}</strong>
                  <p>${item.detail}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function FollowUpCustomersCard(items, toHref) {
    return `
      <section class="panel">
        <div class="section-title"><h2>Takip Gereken Müşteriler</h2><span class="muted">${items.length} kayıt</span></div>
        <div class="followup-list">
          ${items
            .map(
              (item) => `
                <a href="${toHref(`/dashboard/customers/${item.customerId}`)}" data-path="/dashboard/customers/${item.customerId}">
                  <strong>${item.name}</strong>
                  <span>${item.reason}</span>
                </a>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  window.CiltGPTCustomerCrmComponents = {
    CustomerProfileCard,
    CustomerSkinSummary,
    CustomerAnalysisHistory,
    CustomerProductHistory,
    CustomerFollowUpReminders,
    FollowUpCustomersCard,
  };
})();
