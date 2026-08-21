(function () {
  const { customers, followUpCustomers, mockScores } = window.CiltGPTData;
  const { reports, protocol, aiComment } = window.CiltGPTReports;
  const products = window.CiltGPTProducts;
  const productOptions = window.CiltGPTProductOptions;
  const productRecommendations = window.CiltGPTProductRecommendations;
  window.CiltGPTSubscription = window.CiltGPTSubscription || { packages: [], currentSubscription: {}, usageStats: {} };
  const subscriptionState = window.CiltGPTSubscription;
  const teamData = window.CiltGPTTeamData;
  const { pageHeader, scoreCards, customerFields } = window.CiltGPTComponents;
  const {
    ReportSummary,
    ScoreCards,
    ProtocolCard,
    ProductRecommendationCard,
    ReportActions,
    ReportPreview,
  } = window.CiltGPTReportComponents;
  const salonBranding = window.CiltGPTSalonBranding;
  const { ProductCard, ProductTable, ProductForm } = window.CiltGPTProductComponents;
  const {
    SettingsSummaryCards,
    SalonProfileForm,
    ReportBrandingForm,
    NotificationSettingsForm,
  } = window.CiltGPTSettingsComponents;
  const { SubscriptionUsageCard, BillingSummary, PackageComparisonCard } = window.CiltGPTSubscriptionComponents;
  const {
    CustomerProfileCard,
    CustomerSkinSummary,
    CustomerAnalysisHistory,
    CustomerProductHistory,
    CustomerFollowUpReminders,
    FollowUpCustomersCard,
  } = window.CiltGPTCustomerCrmComponents;
  const { TeamSummaryCards, TeamMemberTable, RolePermissionCards, InviteMemberForm } = window.CiltGPTTeamComponents;

  function escapePageHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function dashboardHome(toHref) {
    return `
      ${pageHeader("Dashboard", "Salon müşterileri, analizler ve öneri akışları için genel görünüm.")}
      <section class="stats-grid">
        <article class="stat-card"><span>Toplam müşteri</span><strong>${customers.length}</strong></article>
        <article class="stat-card"><span>Bu ay analiz</span><strong>18</strong></article>
        <article class="stat-card"><span>Ortalama skor</span><strong>72</strong></article>
      </section>
      <div id="dashboard-subscription-card">
        <section class="panel subscription-card"><p class="muted">Paket ve kullanım bilgisi yükleniyor...</p></section>
      </div>
      ${FollowUpCustomersCard(followUpCustomers, toHref)}
      <section class="panel">
        <div class="section-title">
          <h2>Son mock analiz özeti</h2>
          <a class="button ghost" href="${toHref("/dashboard/new-analysis")}" data-path="/dashboard/new-analysis">Yeni analiz</a>
        </div>
        ${scoreCards(mockScores)}
      </section>
    `;
  }

  function reportPathForCustomer(customerId) {
    const report = reports.find((item) => item.customerId === customerId);
    return report ? `/dashboard/reports/${report.id}` : "/dashboard/reports";
  }

  function customersPage(toHref) {
    const rows = customers
      .map((customer) => {
        const reportPath = reportPathForCustomer(customer.id);
        return `
          <tr>
            <td>${customer.fullName}</td>
            <td>${customer.phone}</td>
            <td>${customer.age}</td>
            <td>${customer.gender}</td>
            <td>${new Date(customer.lastAnalysisDate).toLocaleDateString("tr-TR")}</td>
            <td><span class="status">${customer.status}</span></td>
            <td>
              <div class="table-action-group">
                <a class="table-action" href="${toHref(`/dashboard/customers/${customer.id}`)}" data-path="/dashboard/customers/${customer.id}">Detay</a>
                <a class="table-action muted-action" href="${toHref(reportPath)}" data-path="${reportPath}">Rapor</a>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    return `
      ${pageHeader("Müşteriler", "Analiz yapılacak salon müşterilerini takip edin ve yeni müşteri ekleyin.")}
      <section class="panel">
        <div class="section-title"><h2>Müşteri listesi</h2><span class="muted">${customers.length} kayıt</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Ad Soyad</th><th>Telefon</th><th>Yaş</th><th>Cinsiyet</th><th>Son analiz tarihi</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Yeni müşteri ekle</h2></div>
        <form class="customer-form" id="customer-form">
          ${customerFields(true)}
          <button class="button" type="submit">Müşteri ekle</button>
        </form>
      </section>
    `;
  }

  function customerDetailPage(id, toHref) {
    const customer = customers.find((item) => item.id === id) || customers[0];
    const customerReports = reports.filter((report) => report.customerId === customer.id);

    return `
      ${pageHeader(
        customer.fullName,
        "Müşteri profili, cilt özeti, analiz geçmişi ve takip hatırlatmaları.",
        `<div class="report-actions">
          <a class="button" href="${toHref("/dashboard/new-analysis")}" data-path="/dashboard/new-analysis">Yeni analiz başlat</a>
          <a class="button ghost" href="${toHref("/dashboard/reports")}" data-path="/dashboard/reports">Raporları görüntüle</a>
          <button class="button secondary" type="button" data-customer-whatsapp>WhatsApp mesajı hazırla</button>
        </div>`,
      )}
      <div id="customer-whatsapp-message" class="success-message crm-message" hidden>${customer.crm.whatsappMessage}</div>
      ${CustomerProfileCard(customer)}
      ${CustomerSkinSummary(customer)}
      ${CustomerAnalysisHistory(customerReports, toHref)}
      ${CustomerProductHistory(customer.crm.recommendedProducts)}
      ${CustomerFollowUpReminders(customer.crm.reminders)}
    `;
  }

  function reportsListPage(toHref) {
    const rows = reports
      .map(
        (report) => `
          <tr>
            <td>${report.id}</td>
            <td>${report.customerName}</td>
            <td>${new Date(report.analysisDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</td>
            <td>${report.overallScore}</td>
            <td>${report.complaint}</td>
            <td><span class="status ${report.status === "Analiz bekliyor" ? "pending" : ""}">${report.status}</span></td>
            <td><a class="table-action" href="${toHref(`/dashboard/reports/${report.id}`)}" data-path="/dashboard/reports/${report.id}">Detay</a></td>
          </tr>
        `,
      )
      .join("");

    return `
      ${pageHeader("Raporlar", "Tüm analiz raporlarını ve durumlarını tek listede takip edin.")}
      <section class="panel">
        <div class="section-title"><h2>Analiz raporları</h2><span class="muted">${reports.length} rapor</span></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rapor ID</th>
                <th>Müşteri</th>
                <th>Analiz tarihi</th>
                <th>Genel skor</th>
                <th>Ana şikayet</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function readReport(id) {
    const latest = sessionStorage.getItem("latestAnalysisReport");
    if (latest) {
      const parsed = JSON.parse(latest);
      if (parsed.reportId === id) {
        return {
          ...reports[0],
          id: parsed.reportId,
          customerId: parsed.customerId,
          customerName: parsed.customerName,
          analysisDate: parsed.createdAt,
          overallScore: parsed.overallScore,
          age: reports[0].age,
          skinType: parsed.skinType,
          complaint: parsed.mainConcern,
          salonNote: parsed.recommendedProtocol?.salonNote || reports[0].salonNote,
          aiComment: parsed.aiComment,
          scores: {
            Nem: parsed.scores.hydration,
            Leke: parsed.scores.pigmentation,
            "Gözenek": parsed.scores.pores,
            "Kırışıklık": parsed.scores.wrinkles,
            Hassasiyet: parsed.scores.sensitivity,
          },
          recommendedProtocol: parsed.recommendedProtocol,
          recommendedProducts: parsed.recommendedProducts,
        };
      }
    }

    if (id === "mock-report-001") {
      const saved = sessionStorage.getItem("mockReport001");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...reports[0],
          id: parsed.reportId,
          customerId: parsed.customerId,
          customerName: parsed.customerName,
          analysisDate: parsed.createdAt,
          overallScore: parsed.overallScore,
          age: customers.find((customer) => customer.id === parsed.customerId)?.age || reports[0].age,
          skinType: parsed.skinType,
          complaint: parsed.mainConcern,
          salonNote: parsed.recommendedProtocol?.salonNote || reports[0].salonNote,
          aiComment: parsed.aiComment,
          scores: {
            Nem: parsed.scores.hydration,
            Leke: parsed.scores.pigmentation,
            Gözenek: parsed.scores.pores,
            Kırışıklık: parsed.scores.wrinkles,
            Hassasiyet: parsed.scores.sensitivity,
          },
          recommendedProtocol: parsed.recommendedProtocol,
          recommendedProducts: parsed.recommendedProducts,
        };
      }
    }

    return reports.find((report) => report.id === id) || reports[0];
  }

  function reportPage(id, toHref) {
    const report = readReport(id);
    const reportAiComment = report.aiComment || aiComment;
    const reportProtocol = report.recommendedProtocol || protocol;
    const reportProducts = report.recommendedProducts || productRecommendations;

    return `
      ${pageHeader("Analiz Raporu", "Profesyonel skor özeti, AI yorumu, kabin protokolü ve ürün önerileri.", ReportActions(toHref))}
      <div id="report-action-message" class="success-message" hidden>Bu özellik yakında aktif olacak.</div>
      ${ReportSummary(report)}
      <section class="panel">
        <div class="section-title"><h2>Skor kartları</h2></div>
        ${ScoreCards(report.scores)}
      </section>
      <section class="panel ai-comment">
        <div class="section-title"><h2>AI yorum alanı</h2></div>
        <p>${reportAiComment}</p>
      </section>
      <section class="two-column report-detail-grid">
        ${ProtocolCard({ ...reportProtocol, salonNote: report.salonNote || reportProtocol.salonNote })}
        <article class="panel">
          <div class="section-title"><h2>Rapor bilgileri</h2></div>
          <div class="report-facts">
            <p><span>Cilt tipi</span><strong>${report.skinType}</strong></p>
            <p><span>Ana şikayet</span><strong>${report.complaint}</strong></p>
            <p><span>Salon notu</span><strong>${report.salonNote}</strong></p>
          </div>
        </article>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Ev devam ürünleri</h2></div>
        <div class="product-card-grid">
          ${reportProducts.map((product) => ProductRecommendationCard(product)).join("")}
        </div>
      </section>
      ${ReportPreview(report, { ...reportProtocol, salonNote: report.salonNote || reportProtocol.salonNote }, reportProducts, salonBranding, reportAiComment)}
    `;
  }

  function productsPage() {
    return `
      ${pageHeader("Ürünler", "Raporlarda önerilecek ev devam ürünlerini ve satış notlarını yönetin.")}
      <section class="stats-grid product-stats" id="product-stats">
        ${ProductCard("Toplam ürün", "-")}
        ${ProductCard("Aktif ürün", "-")}
        ${ProductCard("Raporlarda önerilen ürün", "-")}
        ${ProductCard("Pasif ürün", "-")}
      </section>
      <section class="panel">
        <div class="section-title">
          <h2>Global ürün kütüphanesi</h2>
          <span class="muted">Marka ürünlerini salon listesine aktar</span>
        </div>
        <div id="product-library-message" class="success-message" hidden></div>
        <div class="toolbar-row">
          <label class="search-field">
            <span>Marka seç</span>
            <select id="product-brand-select">
              <option value="">Markalar yükleniyor...</option>
            </select>
          </label>
          <button class="button" type="button" data-import-product-brand>Seçili markayı yükle</button>
        </div>
      </section>
      <section class="panel">
        <div class="section-title">
          <h2>Ürün listesi</h2>
          <div class="section-actions">
            <span class="muted" id="products-count">Yükleniyor</span>
            <button class="button" type="button" data-open-products-modal>Yeni Ürün Ekle</button>
          </div>
        </div>
        <div id="products-api-message" class="success-message error-message" hidden></div>
        <div id="products-empty-state" class="empty-state" hidden>
          <h2>Henüz ürün bulunmuyor.</h2>
          <p>İlk ürününüzü oluşturarak öneri kütüphanenizi oluşturmaya başlayın.</p>
          <button class="button" type="button" data-open-products-modal>Yeni Ürün Ekle</button>
        </div>
        <div class="table-wrap" id="products-table-wrap">
          <div class="table-toolbar">
            <label class="table-search">
              <span>Ürün ara</span>
              <input id="products-search" type="search" placeholder="Ürün adı, marka veya kullanım amacı ile ara" autocomplete="off" />
            </label>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ürün adı</th>
                <th>Marka</th>
                <th>Kategori</th>
                <th>Ürün tipi</th>
                <th>Kullanım amacı</th>
                <th>Kullanım zamanı</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody id="products-table-body">
              <tr><td colspan="8">Ürünler yükleniyor...</td></tr>
            </tbody>
          </table>
          <div class="pagination" id="products-pagination" aria-label="Ürün sayfaları"></div>
        </div>
      </section>
      <div class="modal-backdrop" id="products-create-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="products-modal-title">
          <div class="modal-header">
            <div>
              <p class="eyebrow">Yeni ürün</p>
              <h2 id="products-modal-title">Ürün ekle</h2>
            </div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-products-modal>&times;</button>
          </div>
        <div id="product-form-success" class="success-message" hidden>Ürün başarıyla oluşturuldu.</div>
        <div id="product-form-error" class="success-message error-message" hidden>Ürün kaydedilirken bir hata oluştu.</div>
        ${ProductForm(productOptions)}
        </section>
      </div>
    `;
  }

  function billingPage() {
    return `
      ${pageHeader("Abonelik", "Paket bilgisi, aylık analiz hakkı ve paket karşılaştırması.")}
      <div id="billing-subscription-root">
        <section class="panel"><p class="muted">Abonelik bilgisi yükleniyor...</p></section>
      </div>
      <section class="panel">
        <div class="section-title"><h2>Promosyon kodu ile paket al</h2><span class="muted">Firmanızın oluşturduğu tek kullanımlık kodu girin.</span></div>
        <div id="billing-promo-message" class="success-message" hidden></div>
        <form id="billing-promo-form" class="customer-form">
          <div class="form-grid">
            <label><span>Promosyon kodu</span><input name="promoCode" type="text" placeholder="Örn. PRO-ABC123-45DE" required /></label>
          </div>
          <button class="button" type="submit">Kodu kullan ve paketi aktifleştir</button>
        </form>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Paket Karşılaştırma</h2><span class="muted">Mock paketler</span></div>
        <div class="package-comparison-grid" id="billing-package-comparison">
          ${subscriptionState.packages.map((pack) => PackageComparisonCard(pack, "")).join("")}
        </div>
      </section>
    `;
  }

  function parseUserLimit(limitLabel) {
    const match = String(limitLabel).match(/\d+/);
    return match ? Number(match[0]) : Infinity;
  }

  function teamPage() {
    const userLimit = parseUserLimit(subscriptionState.currentSubscription?.userLimit);
    const usedUsers = "-";
    const isLimitFull = false;

    return `
      ${pageHeader("Ekip", "Salon içi kullanıcıları, rollerini ve davet akışını yönetin.")}
      <section class="panel">
        <div class="section-title">
          <h2>Kullanıcı listesi</h2>
          <div class="section-actions">
            <span class="muted" id="team-count">Yükleniyor</span>
            <button class="button" type="button" data-open-team-modal>Yeni Kullanıcı Davet Et</button>
          </div>
        </div>
        <div id="team-api-message" class="success-message error-message" hidden></div>
        <div id="team-empty-state" class="empty-state" hidden>
          <h2>Henüz ekip üyesi yok.</h2>
          <p>Salon hesabınız için ekip üyeleri ekleyerek görev paylaşımı yapabilirsiniz.</p>
          <button class="button" type="button" data-open-team-modal>Yeni Kullanıcı Davet Et</button>
        </div>
        <div class="table-wrap" id="team-table-wrap">
          <table>
            <thead><tr><th>Ad Soyad</th><th>E-posta</th><th>Rol</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody id="team-table-body">
              <tr><td colspan="5">Ekip üyeleri yükleniyor...</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Rol açıklamaları</h2></div>
        <div id="role-permission-root">${RolePermissionCards(teamData.roles)}</div>
      </section>
      <div class="modal-backdrop" id="team-invite-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
          <div class="modal-header">
            <div>
              <p class="eyebrow">Ekip daveti</p>
              <h2 id="team-modal-title">Yeni kullanıcı davet et</h2>
            </div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-team-modal>&times;</button>
          </div>
        <div id="invite-success" class="success-message" hidden>Kullanıcı başarıyla eklendi.</div>
        <div id="invite-error" class="success-message error-message" hidden>Kullanıcı eklenirken bir hata oluştu.</div>
        ${InviteMemberForm(teamData.roles, isLimitFull)}
        </section>
      </div>
    `;
  }

  function protocolsPage() {
    return `
      ${pageHeader("Protokoller", "Salonunuzda kullanılan kabin protokollerini yönetin, arayın ve yeni protokol ekleyin.")}
      <div id="protocols-api-message" class="success-message" hidden></div>
      <section class="panel">
        <div class="section-title">
          <h2>Protokol listesi</h2>
          <div class="section-actions">
            <span class="muted" id="protocols-count">-</span>
            <button class="button" type="button" data-open-protocol-modal>Yeni protokol ekle</button>
          </div>
        </div>
        <div class="toolbar-row">
          <label class="search-field">
            <span>Protokol ara</span>
            <input id="protocol-search" type="search" placeholder="Protokol adı veya not yazın" autocomplete="off" />
          </label>
        </div>
        <div class="table-wrap" id="protocol-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Protokol adı</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody id="protocol-table-body">
              <tr><td colspan="2">Protokoller yükleniyor...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="pagination" id="protocols-pagination"></div>
      </section>
      <div class="modal-backdrop" id="protocol-detail-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="protocol-detail-title">
          <div class="modal-header">
            <div>
              <p class="eyebrow">Protokol detayı</p>
              <h2 id="protocol-detail-title">Protokol</h2>
            </div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-protocol-detail-modal>&times;</button>
          </div>
          <div id="protocol-detail-content" class="modal-form"></div>
        </section>
      </div>
      <div class="modal-backdrop" id="protocol-create-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="protocol-modal-title">
          <div class="modal-header">
            <div>
              <p class="eyebrow">Yeni protokol</p>
              <h2 id="protocol-modal-title">Protokol ekle</h2>
            </div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-protocol-modal>&times;</button>
          </div>
          <form id="protocol-form" class="modal-form">
          <div class="form-grid">
            <label><span>Protokol adı</span><input name="name" type="text" required placeholder="HydraCare Leke Protokolü" /></label>
            <label><span>Seans sayısı</span><input name="sessionCount" type="number" min="1" value="6" required /></label>
            <label><span>Uygulama sıklığı</span><input name="frequency" type="text" required placeholder="Haftada 1" /></label>
            <label><span>Kontrol süresi</span><input name="controlPeriod" type="text" required placeholder="14 gün" /></label>
            <label>
              <span>Durum</span>
              <select name="status">
                <option>Aktif</option>
                <option>Pasif</option>
              </select>
            </label>
          </div>
          <label><span>Not</span><textarea name="notes" rows="4" placeholder="Bu protokol hangi cilt ihtiyacında tercih edilir?"></textarea></label>
          <div class="modal-actions">
            <button class="button ghost" type="button" data-close-protocol-modal>Vazgeç</button>
            <button class="button" type="submit">Kaydet</button>
          </div>
        </form>
        </section>
      </div>
    `;
  }

  function settingsPage() {
    return `
      ${pageHeader("Ayarlar", "Salon profili, rapor marka bilgileri, analiz varsayılanları ve bildirim tercihleri.")}
      <section class="stats-grid settings-stats" id="settings-stats">
        <article class="stat-card"><span>Aktif salon</span><strong>-</strong></article>
        <article class="stat-card"><span>Tanımlı ürün</span><strong>-</strong></article>
        <article class="stat-card"><span>Rapor şablonu</span><strong>Aktif</strong></article>
      </section>
      <div id="settings-empty-state" class="panel empty-state" hidden>
        <h2>Salon profili bulunamadı.</h2>
        <p>Bu hesap için salon kaydı oluşturulmalıdır.</p>
      </div>
      <form id="settings-form" class="settings-form">
        <div id="settings-success" class="success-message" hidden>Salon bilgileri başarıyla güncellendi.</div>
        <div id="settings-error" class="success-message error-message" hidden>Salon bilgileri güncellenirken bir hata oluştu.</div>
        <section class="panel settings-section">
          <div class="section-title"><h2>Salon Bilgileri</h2></div>
          <div class="form-grid">
            <label><span>Salon adı</span><input name="salonName" type="text" required /></label>
            <label><span>Yetkili kişi</span><input name="ownerName" type="text" required /></label>
            <label><span>Telefon</span><input name="phone" type="tel" required /></label>
            <label><span>E-posta</span><input name="email" type="email" required /></label>
            <label><span>Şehir</span><input name="city" type="text" required /></label>
            <label><span>Adres</span><input name="address" type="text" required /></label>
          </div>
        </section>
        <!-- TODO: Move report branding settings to database. -->
        ${ReportBrandingForm()}
        <!-- TODO: Persist notification settings. -->
        ${NotificationSettingsForm()}
        <div class="settings-actions">
          <button class="button large" type="submit">Ayarları kaydet</button>
        </div>
      </form>
    `;
  }

  function placeholderPage(title) {
    return `
      ${pageHeader(title, "Bu bölüm MVP içinde menüye eklendi; detay ekranları sonraki aşamada genişletilebilir.")}
      <section class="panel empty-state"><h2>${title}</h2><p>Mevcut çalışan yapıyı bozmadan sol menü navigasyonuna bağlandı.</p></section>
    `;
  }

  function authPage(mode = "salon") {
    const isAdmin = mode === "admin";
    const isFirm = mode === "firm";
    const subtitle = isAdmin ? "Platform yönetimi" : isFirm ? "Tedarikçi paneli" : "Salon paneli";
    const heading = isAdmin ? "Admin paneline giriş" : isFirm ? "Firma paneline giriş" : "Salon paneline giriş";
    const eyebrow = isAdmin ? "Admin girişi" : isFirm ? "Firma girişi" : "Salon girişi";
    const formId = isAdmin ? "admin-login-form" : isFirm ? "firm-login-form" : "salon-login-form";
    const placeholder = isAdmin ? "admin@ciltgpt.com" : isFirm ? "firm@hedracare.com" : "ayse@bellabeauty.com";
    const primaryCopy = isAdmin
      ? "Salonları, firmaları, paketleri ve platform kullanımını tek ekrandan yönetin."
      : isFirm
        ? "Ürünlerinizi global kütüphaneye ekleyin, salonlarınızı ve promosyon kodlarınızı takip edin."
        : "Müşterilerinizi seçin, 4 fotoğrafla analiz oluşturun ve profesyonel öneri akışını başlatın.";
    const metrics = isAdmin
      ? [{ label: "Salon", value: "12+" }, { label: "Rapor", value: "152" }, { label: "Kontrol", value: "Canlı" }]
      : isFirm
        ? [{ label: "Ürün", value: "Toplu" }, { label: "Kod", value: "Tek kullanımlık" }, { label: "Salon", value: "Takip" }]
        : [{ label: "Analiz", value: "4 fotoğraf" }, { label: "Öneri", value: "Ürün + protokol" }, { label: "Rapor", value: "PDF" }];
    const formTitle = isAdmin ? "Yönetim hesabı" : isFirm ? "Firma hesabı" : "Salon hesabı";
    const submitText = isAdmin ? "Admin girişi yap" : isFirm ? "Firma girişi yap" : "Giriş yap";
    return `
      <main class="auth-screen auth-screen-${mode}">
        <section class="auth-shell">
          <aside class="auth-showcase" aria-label="CiltGPT tanıtım alanı">
            <a class="brand auth-showcase-brand logo-brand" href="/" data-path="/">
              <img class="brand-wordmark" src="/assets/ciltgpt-logo.svg?v=20260821-1" alt="CiltGPT" />
              <small class="brand-subtitle">${subtitle}</small>
            </a>
            <div class="auth-copy">
              <p class="auth-pill"><span></span>${eyebrow}</p>
              <h1>Analiz eder, önerir, sattırır.</h1>
              <p>${primaryCopy}</p>
            </div>
            <div class="auth-visual-card">
              <div class="auth-visual-top">
                <strong>Profesyonel analiz</strong>
                <span>Canlı</span>
              </div>
              <div class="auth-photo-grid">
                <article><span>Ön Yüz</span><small>Frontal</small></article>
                <article><span>Sol Profil</span><small>Sol 45°</small></article>
                <article><span>Sağ Profil</span><small>Sağ 45°</small></article>
                <article><span>Yakın Plan</span><small>Makro detay</small></article>
              </div>
            </div>
            <div class="auth-metrics">
              ${metrics.map((metric) => `<article><strong>${metric.value}</strong><span>${metric.label}</span></article>`).join("")}
            </div>
          </aside>

          <section class="auth-card">
            <div class="brand auth-brand logo-brand">
              <img class="brand-wordmark" src="/assets/ciltgpt-logo.svg?v=20260821-1" alt="CiltGPT" />
              <small class="brand-subtitle">${subtitle}</small>
            </div>
            <div class="auth-card-heading">
              <p class="eyebrow">${eyebrow}</p>
              <h2>${heading}</h2>
              <p>${formTitle} bilgilerinizi girerek devam edin.</p>
            </div>
            <div id="auth-message" class="success-message error-message" hidden></div>
            <form class="customer-form auth-form" id="${formId}">
              <label><span>Kullanıcı adı / E-posta</span><input name="email" type="text" placeholder="${placeholder}" autocomplete="username" required /></label>
              <label>
                <span>Şifre</span>
                <div class="password-field">
                  <input name="password" type="password" placeholder="Şifre" autocomplete="current-password" required />
                  <button class="password-toggle" type="button" data-toggle-password aria-label="Şifreyi göster" aria-pressed="false">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
              </label>
              <button class="button large auth-submit" type="submit">${submitText}</button>
            </form>
          </section>
        </section>
      </main>
    `;
  }
  function productEditForm(formId) {
    return `
      <form id="${formId}" class="modal-form">
        <input name="id" type="hidden" />
        <div id="${formId}-message" class="success-message" hidden></div>
        <div class="form-grid">
          <label><span>Ürün adı</span><input name="name" type="text" required /></label>
          <label><span>Marka</span><input name="brand" type="text" required /></label>
          <label><span>Kategori</span><input name="category" type="text" required /></label>
          <label><span>Kullanım amacı</span><input name="usagePurpose" type="text" required /></label>
          <label><span>Kullanım zamanı</span><input name="usageTime" type="text" required /></label>
          <label><span>Durum</span><select name="status"><option>Aktif</option><option>Pasif</option></select></label>
        </div>
        <label class="checkbox-row settings-checkbox">
          <input name="isCabinProduct" type="checkbox" />
          <span>Kabin ürünü olarak işaretle</span>
        </label>
        <div class="modal-actions">
          <button class="button ghost" type="button" data-close-product-edit-modal>Vazgeç</button>
          <button class="button" type="submit">Ürünü kaydet</button>
        </div>
      </form>
    `;
  }

  function firmLayout(activePath, content, authUser = {}) {
    const firmName = authUser.firmName || authUser.firmBrandName || "CiltGPT Firma";
    const firmBrandName = authUser.firmBrandName || "Tedarikçi paneli";
    const firmLogoUrl = authUser.firmLogoUrl || "";
    const firmMark = firmName.trim().charAt(0).toUpperCase() || "F";
    const item = (path, label) => `<a class="${activePath === path ? "active" : ""}" href="${path}" data-path="${path}">${label}</a>`;
    return `
      <div class="shell firm-shell">
        <button class="mobile-menu-toggle" type="button" data-mobile-menu-toggle aria-label="Menüyü aç" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <div class="mobile-menu-backdrop" data-mobile-menu-close></div>
        <aside class="sidebar firm-sidebar">
          <div class="brand firm-brand">
            <span class="brand-mark firm-brand-logo">${firmLogoUrl ? `<img src="${escapePageHtml(firmLogoUrl)}" alt="Firma logosu" />` : escapePageHtml(firmMark)}</span>
            <span><strong>${escapePageHtml(firmName)}</strong><small>${escapePageHtml(firmBrandName)}</small></span>
          </div>
          <nav class="nav">
            ${item("/firm", "Ürünler")}
            ${item("/firm/salons", "Salonlar")}
            ${item("/firm/packages", "Paketler")}
            ${item("/firm/settings", "Ayarlar")}
          </nav>
          <button class="logout-button" type="button" data-logout>Çıkış yap</button>
        </aside>
        <main class="main firm-main">${content}</main>
      </div>
    `;
  }

  function firmProductsPage(authUser) {
    return firmLayout(
      "/firm",
      `
      ${pageHeader("Firma Ürün Paneli", "Ürün gruplarınızı global ürün kütüphanesine toplu olarak ekleyin.")}
      <section class="panel">
        <div class="section-title">
          <h2>Toplu ürün ekleme</h2>
          <a class="button ghost" href="/api/firm/product-template" target="_blank" rel="noopener">Excel şablonunu indir</a>
        </div>
        <div id="firm-import-message" class="success-message" hidden></div>
        <form id="firm-product-import-form" class="customer-form">
          <label>
            <span>Doldurulmuş şablon</span>
            <input name="file" type="file" accept=".csv,.xls,.txt" required />
          </label>
          <p class="muted">Şablon Excel ile ayrı sütunlar halinde açılır. Doldurduktan sonra CSV olarak kaydedip geri yükleyin.</p>
          <button class="button" type="submit">Toplu ürün yükle</button>
        </form>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Firmanın ürünleri</h2><span class="muted" id="firm-products-count">Yükleniyor</span></div>
        <div class="table-toolbar">
          <label class="table-search" for="firm-products-search">
            <span>Ürün ara</span>
            <input id="firm-products-search" type="search" placeholder="Ürün, marka, kategori veya kullanım amacı" autocomplete="off" />
          </label>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Ürün adı</th><th>Marka</th><th>Kategori</th><th>Ürün tipi</th><th>Kullanım amacı</th><th>Kullanım zamanı</th><th>Durum</th><th>İşlem</th></tr>
            </thead>
            <tbody id="firm-products-table-body"><tr><td colspan="8">Ürünler yükleniyor...</td></tr></tbody>
          </table>
        </div>
      </section>
      <div class="modal-backdrop" id="firm-product-edit-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="firm-product-edit-title">
          <div class="modal-header">
            <div><p class="eyebrow">Ürün düzenle</p><h2 id="firm-product-edit-title">Ürün bilgileri</h2></div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-product-edit-modal>&times;</button>
          </div>
          ${productEditForm("firm-product-edit-form")}
        </section>
      </div>
    `,
      authUser,
    );
  }

  function firmSalonsPage(authUser) {
    return firmLayout(
      "/firm/salons",
      `
      ${pageHeader("Firma Salonları", "Firma tarafından sisteme eklenen salonları oluşturun ve takip edin.")}
      <section class="panel">
        <div class="section-title"><h2>Yeni salon ekle</h2></div>
        <div id="firm-salon-message" class="success-message" hidden></div>
        <form id="firm-salon-form" class="customer-form">
          <div class="form-grid">
            <label><span>Salon adı</span><input name="name" type="text" required /></label>
            <label><span>Yetkili kişi</span><input name="ownerName" type="text" required /></label>
            <label><span>E-posta</span><input name="email" type="email" required /></label>
            <label><span>Telefon</span><input name="phone" type="tel" required /></label>
            <label><span>Şehir</span><input name="city" type="text" required /></label>
            <label><span>Adres</span><input name="address" type="text" required /></label>
            <label><span>Salon kullanıcı adı</span><input name="username" type="text" required /></label>
            <label><span>Geçici şifre</span><input name="password" type="text" value="123456" required /></label>
            <label><span>Promosyon kodu</span><input name="promoCode" type="text" placeholder="Opsiyonel" /></label>
          </div>
          <button class="button" type="submit">Salon ekle</button>
        </form>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Eklenen salonlar</h2><span class="muted" id="firm-salons-count">Yükleniyor</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Salon adı</th><th>Yetkili</th><th>E-posta</th><th>Telefon</th><th>Şehir</th><th>Ekleyen</th></tr></thead>
            <tbody id="firm-salons-table-body"><tr><td colspan="6">Salonlar yükleniyor...</td></tr></tbody>
          </table>
        </div>
      </section>
    `,
      authUser,
    );
  }

  function firmPackagesPage(authUser) {
    return firmLayout(
      "/firm/packages",
      `
      ${pageHeader("Firma Paketleri", "Salonlar için paket seçin, tek kullanımlık promosyon kodu üretin ve analiz bakiyenizi takip edin.")}
      <section class="stats-grid" id="firm-promo-balance">
        <article class="stat-card"><span>Satın alınan analiz</span><strong>-</strong></article>
        <article class="stat-card"><span>Kodlara ayrılan analiz</span><strong>-</strong></article>
        <article class="stat-card"><span>Kalan analiz bakiyesi</span><strong>-</strong></article>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Paket seç ve kod üret</h2><span class="muted">Her kod yalnızca 1 salon için kullanılabilir.</span></div>
        <div id="firm-promo-message" class="success-message" hidden></div>
        <div class="package-comparison-grid" id="firm-package-grid">
          <article class="panel empty-state"><p>Paketler yükleniyor...</p></article>
        </div>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Üretilen promosyon kodları</h2><span class="muted" id="firm-promo-count">Yükleniyor</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Kod</th><th>Paket</th><th>Analiz</th><th>Kullanıcı</th><th>Durum</th><th>Kullanan salon</th><th>Oluşturma tarihi</th></tr></thead>
            <tbody id="firm-promo-table-body"><tr><td colspan="7">Kodlar yükleniyor...</td></tr></tbody>
          </table>
        </div>
      </section>
    `,
      authUser,
    );
  }

  function firmSettingsPage(authUser) {
    return firmLayout(
      "/firm/settings",
      `
      ${pageHeader("Firma Ayarları", "Firma profilinizi, marka bilginizi ve logonuzu yönetin.")}
      <section class="panel">
        <div class="section-title"><h2>Firma bilgileri</h2></div>
        <div id="firm-settings-message" class="success-message" hidden></div>
        <form id="firm-settings-form" class="customer-form">
          <div class="settings-logo-preview" id="firm-logo-preview"><span>Logo</span></div>
          <div class="form-grid">
            <label><span>Firma adı</span><input name="name" type="text" required /></label>
            <label><span>Marka adı</span><input name="brandName" type="text" required /></label>
            <label><span>E-posta</span><input name="email" type="email" required /></label>
            <label><span>Telefon</span><input name="phone" type="tel" /></label>
            <label><span>Web sitesi</span><input name="website" type="text" placeholder="https://..." /></label>
            <label><span>Logo</span><input name="logo" type="file" accept="image/*" /></label>
          </div>
          <label><span>Adres</span><textarea name="address" rows="4"></textarea></label>
          <button class="button" type="submit">Firma ayarlarını kaydet</button>
        </form>
      </section>
    `,
      authUser,
    );
  }

  function customersDatabasePage(toHref) {
    return `
      ${pageHeader("Müşteriler", "Analiz yapılacak salon müşterilerini takip edin ve yeni müşteri ekleyin.")}
      <section class="panel">
        <div class="section-title"><h2>Müşteri listesi</h2><span class="muted" id="customers-count">Yükleniyor</span></div>
        <div id="customers-api-message" class="success-message error-message" hidden></div>
        <div id="customers-empty-state" class="empty-state" hidden>
          <h2>Hen&uuml;z m&uuml;&#351;teri kayd&#305; yok.</h2>
          <p>&#304;lk m&uuml;&#351;teri kayd&#305;n&#305; olu&#351;turarak analiz ak&#305;&#351;&#305;na ba&#351;lay&#305;n.</p>
          <button class="button" type="button" data-open-customers-modal>Yeni m&uuml;&#351;teri ekle</button>
        </div>
        <div class="table-wrap" id="customers-table-wrap">
          <div class="table-toolbar">
            <label class="table-search">
              <span>M&uuml;&#351;teri ara</span>
              <input id="customers-search" type="search" placeholder="Ad soyad veya telefon ile ara" autocomplete="off" />
            </label>
          </div>
          <table>
            <thead><tr><th>Ad Soyad</th><th>Telefon</th><th>Yaş</th><th>Cinsiyet</th><th>Son analiz tarihi</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody id="customers-table-body">
              <tr><td colspan="7">M&uuml;&#351;teriler y&uuml;kleniyor...</td></tr>
            </tbody>
          </table>
          <div class="pagination" id="customers-pagination" aria-label="M&uuml;&#351;teri sayfalar&#305;"></div>
        </div>
      </section>
      <div class="modal-backdrop" id="customers-create-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="customers-modal-title">
          <div class="modal-header">
            <div>
              <p class="eyebrow">Yeni m&uuml;&#351;teri</p>
              <h2 id="customers-modal-title">M&uuml;&#351;teri ekle</h2>
            </div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-customers-modal>&times;</button>
          </div>
          <div id="customer-form-success" class="success-message" hidden>M&uuml;&#351;teri ba&#351;ar&#305;yla eklendi.</div>
          <div id="customer-form-error" class="success-message error-message" hidden>M&uuml;&#351;teri kaydedilirken bir hata olu&#351;tu.</div>
          <form class="modal-form" id="customer-form">
            <div class="form-grid">
              <label><span>Ad Soyad</span><input name="fullName" type="text" placeholder="&Ouml;rn. Deniz Arslan" required /></label>
              <label><span>Telefon</span><input name="phone" type="tel" placeholder="05xx xxx xx xx" required /></label>
              <label><span>Ya&#351;</span><input name="age" type="number" min="12" max="100" placeholder="32" /></label>
              <label>
                <span>Cinsiyet</span>
                <select name="gender">
                  <option value="">Se&ccedil;iniz</option>
                  <option>Kad&#305;n</option>
                  <option>Erkek</option>
                  <option>Belirtmek istemiyor</option>
                </select>
              </label>
            </div>
            <label><span>Notlar</span><textarea name="notes" rows="4" placeholder="Cilt hassasiyeti, ge&ccedil;mi&#351; uygulamalar veya bak&#305;m hedefleri"></textarea></label>
            <div class="modal-actions">
              <button class="button ghost" type="button" data-close-customers-modal>Vazge&ccedil;</button>
              <button class="button" type="submit">Kaydet</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function reportsDatabaseListPage(toHref) {
    return `
      ${pageHeader("Raporlar", "Tüm analiz raporlarını ve durumlarını tek listede takip edin.")}
      <section class="panel">
        <div class="section-title"><h2>Analiz raporları</h2><span class="muted" id="reports-count">Yükleniyor</span></div>
        <div id="reports-api-message" class="success-message error-message" hidden></div>
        <div id="reports-empty-state" class="empty-state" hidden>
          <h2>Henüz rapor oluşturulmadı.</h2>
          <p>Yeni analiz başlatarak ilk raporu oluşturabilirsiniz.</p>
          <a class="button" href="${toHref("/dashboard/new-analysis")}" data-path="/dashboard/new-analysis">Yeni analiz başlat</a>
        </div>
        <div class="report-customer-filter" id="reports-customer-filter" hidden>
          <label class="customer-search-control">
            <span>M&uuml;&#351;teri ara</span>
            <input id="reports-customer-search" type="search" placeholder="M&uuml;&#351;teri ad&#305; yaz&#305;n" autocomplete="off" />
          </label>
          <div class="customer-search-results" id="reports-customer-results" hidden></div>
          <div class="selected-customer-chip" id="reports-selected-customer" hidden></div>
        </div>
        <div class="table-wrap" id="reports-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rapor ID</th>
                <th>Müşteri</th>
                <th>Analiz tarihi</th>
                <th>Genel skor</th>
                <th>Ana şikayet</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody id="reports-table-body">
              <tr><td colspan="7">Raporlar yükleniyor...</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function reportDatabaseDetailPage(id, toHref) {
    return `
      ${pageHeader("Analiz Raporu", "Profesyonel skor özeti, AI yorumu, kabin protokolü ve ürün önerileri.", ReportActions(toHref))}
      <div id="report-action-message" class="success-message" hidden>Bu özellik yakında aktif olacak.</div>
      <div id="report-detail-api-message" class="success-message error-message" hidden></div>
      <div id="report-detail-root" data-report-id="${id}">
        <section class="panel"><p class="muted">Rapor yükleniyor...</p></section>
      </div>
    `;
  }
  function dashboardDatabaseHome(toHref) {
    return `
      ${pageHeader("Dashboard", "Salon m&uuml;&#351;terileri, analizler ve &ouml;neri ak&#305;&#351;lar&#305; i&ccedil;in genel g&ouml;r&uuml;n&uuml;m.")}
      <section class="stats-grid">
        <article class="stat-card"><span>Toplam m&uuml;&#351;teri</span><strong id="dashboard-stat-total">-</strong></article>
        <article class="stat-card"><span>Bu ay analiz</span><strong id="dashboard-stat-monthly">-</strong></article>
        <article class="stat-card"><span>Ortalama skor</span><strong id="dashboard-stat-average">-</strong></article>
      </section>
      <div class="dashboard-list-grid">
        <section class="panel">
          <div class="section-title"><h2>Yap&#305;lan son 5 analiz</h2></div>
          <div id="dashboard-latest-analyses"><p class="muted">Analiz listesi y&uuml;kleniyor...</p></div>
        </section>
        <section class="panel">
          <div class="section-title"><h2>Son kaydedilen 5 m&uuml;&#351;teri</h2></div>
          <div id="dashboard-latest-customers"><p class="muted">M&uuml;&#351;teri listesi y&uuml;kleniyor...</p></div>
        </section>
      </div>
      <div id="dashboard-subscription-card">
        <section class="panel subscription-card"><p class="muted">Paket ve kullan&#305;m bilgisi y&uuml;kleniyor...</p></section>
      </div>
    `;
  }

  function customerDatabaseDetailPage(id, toHref) {
    return `
      ${pageHeader(
        "M&uuml;&#351;teri Detay&#305;",
        "M&uuml;&#351;teri profili, cilt &ouml;zeti, analiz ge&ccedil;mi&#351;i ve takip hat&#305;rlatmalar&#305;.",
        `<div class="report-actions">
          <a class="button" href="${toHref("/dashboard/new-analysis")}" data-path="/dashboard/new-analysis">Yeni analiz ba&#351;lat</a>
          <a class="button ghost" href="${toHref("/dashboard/reports")}" data-path="/dashboard/reports">Raporlar&#305; g&ouml;r&uuml;nt&uuml;le</a>
          <button class="button secondary" type="button" data-customer-whatsapp>WhatsApp mesaj&#305; haz&#305;rla</button>
        </div>`,
      )}
      <div id="customer-detail-api-message" class="success-message error-message" hidden></div>
      <div id="customer-whatsapp-message" class="success-message crm-message" hidden></div>
      <div id="customer-detail-root" data-customer-id="${id}">
        <section class="panel"><p class="muted">M&uuml;&#351;teri bilgileri y&uuml;kleniyor...</p></section>
      </div>
    `;
  }

  window.CiltGPTPages = {
    authPage,
    firmProductsPage,
    firmSalonsPage,
    firmPackagesPage,
    firmSettingsPage,
    dashboardHome: dashboardDatabaseHome,
    customersPage: customersDatabasePage,
    customerDetailPage: customerDatabaseDetailPage,
    reportsListPage: reportsDatabaseListPage,
    reportPage: reportDatabaseDetailPage,
    productsPage,
    protocolsPage,
    billingPage,
    teamPage,
    settingsPage,
    placeholderPage,
  };
})();




