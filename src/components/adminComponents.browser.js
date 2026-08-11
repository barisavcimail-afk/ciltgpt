(function () {
  const adminNav = [
    { label: "Genel Bakış", path: "/admin" },
    { label: "Salonlar", path: "/admin/salons" },
    { label: "Firmalar", path: "/admin/firms" },
    { label: "Analizler", path: "/admin/analyses" },
    { label: "Paketler", path: "/admin/packages" },
    { label: "Ürün Kütüphanesi", path: "/admin/products" },
    { label: "Sistem Ayarları", path: "/admin/settings" },
  ];

  function AdminSidebar(route, toHref) {
    const nav = adminNav
      .map((item) => {
        const active = route === item.path || (item.path !== "/admin" && route.startsWith(item.path));
        return `<a class="sidebar-link ${active ? "active" : ""}" href="${toHref(item.path)}" data-path="${item.path}"><span>${item.label}</span></a>`;
      })
      .join("");

    return `
      <aside class="sidebar admin-sidebar">
        <a class="brand" href="${toHref("/admin")}" data-path="/admin">
          <span class="brand-mark admin-mark">A</span>
          <span><strong>CiltGPT Admin</strong><small>Platform yönetimi</small></span>
        </a>
        <nav>${nav}</nav>
        <button class="admin-back-link" type="button" data-logout>Çıkış yap</button>
      </aside>
    `;
  }

  function AdminLayout(content, route, toHref) {
    return `
      <div class="shell admin-shell">
        <button class="mobile-menu-toggle" type="button" data-mobile-menu-toggle aria-label="Menüyü aç" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <div class="mobile-menu-backdrop" data-mobile-menu-close></div>
        ${AdminSidebar(route, toHref)}
        <main class="main admin-main">${content}</main>
      </div>
    `;
  }

  function AdminSummaryCards(summary) {
    const cards = [
      ["Toplam salon", summary.totalSalons],
      ["Aktif salon", summary.activeSalons],
      ["Bu ay yapılan analiz", summary.monthlyAnalyses],
      ["Bekleyen analiz", summary.pendingAnalyses],
      ["Tamamlanan rapor", summary.completedReports],
      ["Aylık tahmini gelir", summary.estimatedRevenue],
    ];

    return `
      <section class="stats-grid admin-summary-grid">
        ${cards.map(([label, value]) => `<article class="stat-card admin-stat"><span>${label}</span><strong>${value}</strong></article>`).join("")}
      </section>
    `;
  }

  function AdminSalonTable(salons) {
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Salon adı</th><th>Ekleyen</th><th>İşlem</th></tr></thead>
          <tbody>
            ${salons
              .map(
                (salon) => `
                  <tr>
                    <td>${salon.name}</td>
                    <td>${salon.createdBy || "Sistem"}</td>
                    <td><button class="table-action muted-action" type="button" data-admin-salon-detail="${salon.id}">İncele</button></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function AdminAnalysisTable(analyses) {
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Analiz ID</th><th>Salon</th><th>Müşteri</th><th>Tarih</th><th>Durum</th><th>Skor</th><th>İşlem</th></tr></thead>
          <tbody>
            ${analyses
              .map(
                (analysis) => `
                  <tr>
                    <td>${analysis.id}</td>
                    <td>${analysis.salon}</td>
                    <td>${analysis.customer}</td>
                    <td>${new Date(analysis.date).toLocaleDateString("tr-TR")}</td>
                    <td><span class="status ${analysis.status !== "Tamamlandı" ? "pending" : ""}">${analysis.status}</span></td>
                    <td>${analysis.score}</td>
                    <td><button class="table-action muted-action" type="button">Detay</button></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function AdminPackageCard(pack) {
    return `
      <article class="panel admin-package-card">
        <div class="section-title"><h2>${pack.name}</h2><span class="status">${pack.status}</span></div>
        <strong>${pack.price}</strong>
        <p>${pack.analysisLimitLabel}</p>
        <p>${pack.userLimit}</p>
        <button class="button ghost" type="button" data-manage-package="${pack.id}">Paketi yönet</button>
        <button class="button" type="button" data-admin-generate-promo="${pack.name}">Promosyon kodu üret</button>
      </article>
    `;
  }

  function AdminSettingsForm(settings) {
    return `
      <form id="admin-settings-form" class="customer-form">
        <div class="form-grid">
          <label><span>Varsayılan analiz limiti</span><input name="defaultAnalysisLimit" type="number" value="${settings.defaultAnalysisLimit}" /></label>
          <label><span>Varsayılan para birimi</span><input name="defaultCurrency" type="text" value="${settings.defaultCurrency}" /></label>
          <label class="checkbox-row settings-checkbox"><input name="reportPdfEnabled" type="checkbox" ${settings.reportPdfEnabled ? "checked" : ""} /><span>Rapor PDF aktif mi?</span></label>
          <label class="checkbox-row settings-checkbox"><input name="whatsappShareEnabled" type="checkbox" ${settings.whatsappShareEnabled ? "checked" : ""} /><span>WhatsApp paylaşım aktif mi?</span></label>
          <label><span>AI entegrasyonu durumu</span><input name="aiIntegrationStatus" type="text" value="${settings.aiIntegrationStatus}" readonly /></label>
        </div>
        <button class="button" type="submit">Sistem ayarlarını kaydet</button>
      </form>
    `;
  }

  window.CiltGPTAdminComponents = {
    AdminLayout,
    AdminSidebar,
    AdminSummaryCards,
    AdminSalonTable,
    AdminAnalysisTable,
    AdminPackageCard,
    AdminSettingsForm,
  };
})();

