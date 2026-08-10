(function () {
  function usageBadge(remaining, percent) {
    if (remaining <= 0) return "Limit doldu";
    if (percent >= 85) return "Limit dolmak üzere";
    return "Aktif";
  }

  function UsageProgressBar(percent) {
    return `<div class="usage-progress"><i style="width:${Math.min(percent, 100)}%"></i></div>`;
  }

  function SubscriptionUsageCard(subscription, usage, toHref) {
    const badge = usageBadge(usage.remainingAnalyses, usage.usagePercent);
    return `
      <section class="panel subscription-card">
        <div class="section-title">
          <h2>Paket ve Kullanım</h2>
          <span class="status ${badge === "Aktif" ? "" : "pending"}">${badge}</span>
        </div>
        <div class="subscription-main">
          <div>
            <span class="muted">Mevcut paket</span>
            <strong>${subscription.packageName}</strong>
          </div>
          <div>
            <span class="muted">Paket yenileme tarihi</span>
            <strong>${new Date(subscription.renewalDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}</strong>
          </div>
        </div>
        <div class="usage-metrics">
          <article><span>Aylık analiz hakkı</span><strong>${usage.analysisLimit}</strong></article>
          <article><span>Bu ay kullanılan analiz</span><strong>${usage.usedAnalyses}</strong></article>
          <article><span>Kalan analiz hakkı</span><strong>${usage.remainingAnalyses}</strong></article>
          <article><span>Kullanım yüzdesi</span><strong>%${usage.usagePercent}</strong></article>
        </div>
        ${UsageProgressBar(usage.usagePercent)}
        <a class="button ghost" href="${toHref("/dashboard/billing")}" data-path="/dashboard/billing">Abonelik detayları</a>
      </section>
    `;
  }

  function BillingSummary(subscription, usage) {
    return `
      <section class="two-column billing-grid">
        <article class="panel">
          <div class="section-title"><h2>Mevcut Paket</h2><span class="status">${subscription.status}</span></div>
          <div class="report-facts">
            <p><span>Paket adı</span><strong>${subscription.packageName}</strong></p>
            <p><span>Aylık ücret</span><strong>${subscription.monthlyPrice}</strong></p>
            <p><span>Analiz limiti</span><strong>${subscription.analysisLimit}</strong></p>
            <p><span>Kullanıcı limiti</span><strong>${subscription.userLimit}</strong></p>
            <p><span>Yenileme tarihi</span><strong>${new Date(subscription.renewalDate).toLocaleDateString("tr-TR")}</strong></p>
          </div>
        </article>
        <article class="panel">
          <div class="section-title"><h2>Kullanım Özeti</h2></div>
          <div class="usage-metrics billing-usage">
            <article><span>Bu ay kullanılan analiz</span><strong>${usage.usedAnalyses}</strong></article>
            <article><span>Kalan analiz</span><strong>${usage.remainingAnalyses}</strong></article>
            <article><span>Toplam analiz limiti</span><strong>${usage.analysisLimit}</strong></article>
            <article><span>Kullanım yüzdesi</span><strong>%${usage.usagePercent}</strong></article>
          </div>
          ${UsageProgressBar(usage.usagePercent)}
        </article>
      </section>
    `;
  }

  function PackageComparisonCard(pack, currentPackageId) {
    const isCurrent = pack.id === currentPackageId;
    const buttonLabel = isCurrent ? "Mevcut paket" : pack.id === "enterprise" ? "Teklif al" : "Paketi yükselt";
    return `
      <article class="panel package-comparison-card ${isCurrent ? "current" : ""}">
        <div class="section-title"><h2>${pack.name}</h2>${isCurrent ? '<span class="status">Mevcut</span>' : ""}</div>
        <strong>${pack.price}</strong>
        <p>${pack.analysisLimitLabel}</p>
        <p>${pack.userLimit}</p>
        <ul>
          ${pack.features.map((feature) => `<li>${feature}</li>`).join("")}
        </ul>
        <button class="button ${isCurrent ? "secondary disabled-button" : "ghost"}" type="button" ${isCurrent ? "disabled" : ""}>${buttonLabel}</button>
      </article>
    `;
  }

  window.CiltGPTSubscriptionComponents = {
    SubscriptionUsageCard,
    BillingSummary,
    PackageComparisonCard,
    UsageProgressBar,
    usageBadge,
  };
})();
