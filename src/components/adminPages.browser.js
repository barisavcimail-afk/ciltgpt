(function () {
  const data = window.CiltGPTAdminData;
  const products = window.CiltGPTProducts;
  window.CiltGPTSubscription = window.CiltGPTSubscription || { packages: [], currentSubscription: {}, usageStats: {} };
  const {
    AdminAnalysisTable,
    AdminPackageCard,
    AdminSettingsForm,
  } = window.CiltGPTAdminComponents;

  function adminHeader(title, description) {
    return `
      <div class="page-header admin-header">
        <div>
          <p class="eyebrow">Admin panel</p>
          <h1>${title}</h1>
          <p>${description}</p>
        </div>
      </div>
    `;
  }

  function overview() {
    return `
      ${adminHeader("Genel Bakış", "Platform durumu, salon kullanımı ve aylık performans özeti.")}
      <div id="admin-summary-root">
        <section class="stats-grid admin-summary-grid">
          <article class="stat-card admin-stat"><span>Toplam salon</span><strong>-</strong></article>
          <article class="stat-card admin-stat"><span>Aktif salon</span><strong>-</strong></article>
          <article class="stat-card admin-stat"><span>Bu ay yapılan analiz</span><strong>-</strong></article>
          <article class="stat-card admin-stat"><span>Bekleyen analiz</span><strong>-</strong></article>
          <article class="stat-card admin-stat"><span>Tamamlanan rapor</span><strong>-</strong></article>
          <article class="stat-card admin-stat"><span>Aylık tahmini gelir</span><strong>-</strong></article>
        </section>
      </div>
      <section class="two-column">
        <article class="panel">
          <div class="section-title"><h2>Son salonlar</h2></div>
          <div id="admin-overview-salons"><p class="muted">Salonlar yükleniyor...</p></div>
        </article>
        <article class="panel">
          <div class="section-title"><h2>Analiz kuyruğu</h2></div>
          ${AdminAnalysisTable(data.analyses.slice(0, 3))}
        </article>
      </section>
    `;
  }

  function salons() {
    return `
      ${adminHeader("Salonlar", "Platforma bağlı salonları, paketlerini ve analiz kullanımını yönetin.")}
      <section class="panel">
        <div class="section-title">
          <h2>Salon listesi</h2>
          <div class="section-actions">
            <span class="muted" id="admin-salons-count">Yükleniyor</span>
            <button class="button" type="button" data-open-admin-salon-modal>Yeni salon ekle</button>
          </div>
        </div>
        <div class="table-toolbar">
          <label class="table-search" for="admin-salons-search">
            <span>Salon ara</span>
            <input id="admin-salons-search" type="search" placeholder="Salon adı veya ekleyen kişi" autocomplete="off" />
          </label>
        </div>
        <div id="admin-salons-api-message" class="success-message error-message" hidden></div>
        <div id="admin-salons-empty-state" class="empty-state" hidden>
          <h2>Henüz salon bulunmuyor.</h2>
          <p>İlk salon kaydı oluşturulduğunda burada görüntülenecek.</p>
        </div>
        <div class="table-wrap" id="admin-salons-table-wrap">
          <table>
            <thead><tr><th>Salon adı</th><th>Ekleyen</th><th>İşlem</th></tr></thead>
            <tbody id="admin-salons-table-body">
              <tr><td colspan="3">Salonlar yükleniyor...</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <div class="modal-backdrop" id="admin-salon-detail-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="admin-salon-detail-title">
          <div class="modal-header">
            <div>
              <p class="eyebrow">Salon detayı</p>
              <h2 id="admin-salon-detail-title">Salon bilgileri</h2>
            </div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-admin-salon-modal>&times;</button>
          </div>
          <div id="admin-salon-detail-content"></div>
        </section>
      </div>
      <div class="modal-backdrop" id="admin-salon-create-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="admin-salon-create-title">
          <div class="modal-header">
            <div>
              <p class="eyebrow">Yeni salon</p>
              <h2 id="admin-salon-create-title">Salon ekle</h2>
            </div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-admin-salon-create-modal>&times;</button>
          </div>
          <form id="admin-salon-create-form" class="modal-form">
            <div id="admin-salon-create-message" class="success-message" hidden></div>
            <div class="form-grid">
              <label><span>Salon adı</span><input name="name" type="text" required /></label>
              <label><span>Yetkili kişi</span><input name="ownerName" type="text" required /></label>
              <label><span>E-posta</span><input name="email" type="email" required /></label>
              <label><span>Telefon</span><input name="phone" type="tel" required /></label>
              <label><span>Şehir</span><input name="city" type="text" required /></label>
              <label><span>Adres</span><input name="address" type="text" required /></label>
              <label><span>Salon kullanıcı adı</span><input name="username" type="text" required /></label>
              <label><span>Geçici şifre</span><input name="password" type="text" value="123456" required /></label>
              <label>
                <span>Bağlı firma</span>
                <select name="firmId" id="admin-salon-firm-select">
                  <option value="">Firma seçmeden aç</option>
                </select>
              </label>
            </div>
            <div class="modal-actions">
              <button class="button ghost" type="button" data-close-admin-salon-create-modal>Vazgeç</button>
              <button class="button" type="submit">Salon ekle</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }
  function analyses() {
    return `
      ${adminHeader("Analizler", "Salonlardan gelen analiz kayıtlarını ve durumlarını takip edin.")}
      <section class="panel">
        <div class="section-title"><h2>Analiz kayıtları</h2><span class="muted" id="admin-analyses-count">Yükleniyor</span></div>
        <div class="table-toolbar">
          <label class="table-search" for="admin-analyses-search">
            <span>Analiz ara</span>
            <input id="admin-analyses-search" type="search" placeholder="Durum, salon veya firma adı" autocomplete="off" />
          </label>
        </div>
        <div id="admin-analyses-api-message" class="success-message error-message" hidden></div>
        <div class="table-wrap" id="admin-analyses-table-wrap">
          <table>
            <thead><tr><th>Durum</th><th>Salon adı</th><th>Firma adı</th><th>İşlem</th><th>Rapor</th></tr></thead>
            <tbody id="admin-analyses-table-body"><tr><td colspan="5">Analizler yükleniyor...</td></tr></tbody>
          </table>
        </div>
      </section>
      <div class="modal-backdrop" id="admin-analysis-detail-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="admin-analysis-detail-title">
          <div class="modal-header">
            <div>
              <p class="eyebrow">Analiz detayı</p>
              <h2 id="admin-analysis-detail-title">Analiz bilgileri</h2>
            </div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-admin-analysis-modal>&times;</button>
          </div>
          <div id="admin-analysis-detail-content"></div>
        </section>
      </div>
    `;
  }

  function firmsPage() {
    return `
      ${adminHeader("Firmalar", "Tedarikçi firmaların analiz bakiyelerini, promosyon kodlarını ve toplu analiz satışlarını yönetin.")}
      <section class="panel">
        <div class="admin-action-bar">
          <button class="button" type="button" data-open-admin-firm-modal="price">Analiz fiyatı</button>
          <button class="button" type="button" data-open-admin-firm-modal="sale">Analiz sat</button>
          <button class="button" type="button" data-open-admin-firm-modal="create">Yeni firma ekle</button>
        </div>
        <div id="admin-analysis-sale-message" class="success-message" hidden></div>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Firma bakiyeleri</h2><span class="muted" id="admin-firms-count">Yükleniyor</span></div>
        <div class="table-toolbar">
          <label class="table-search" for="admin-firms-search">
            <span>Firma ara</span>
            <input id="admin-firms-search" type="search" placeholder="Firma veya marka adı" autocomplete="off" />
          </label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Firma</th><th>Marka</th><th>Satın alınan</th><th>Kodlara ayrılan</th><th>Kalan</th><th>Durum</th></tr></thead>
            <tbody id="admin-firms-table-body"><tr><td colspan="6">Firmalar yükleniyor...</td></tr></tbody>
          </table>
        </div>
        <div class="pagination" id="admin-firms-pagination"></div>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Son toplu satışlar</h2><span class="muted" id="admin-sales-count">Yükleniyor</span></div>
        <div class="table-toolbar">
          <label class="table-search" for="admin-sales-search">
            <span>Satış ara</span>
            <input id="admin-sales-search" type="search" placeholder="Firma, not veya tarih" autocomplete="off" />
          </label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Firma</th><th>Adet</th><th>Birim fiyat</th><th>Toplam</th><th>Not</th><th>Tarih</th></tr></thead>
            <tbody id="admin-sales-table-body"><tr><td colspan="6">Satışlar yükleniyor...</td></tr></tbody>
          </table>
        </div>
        <div class="pagination" id="admin-sales-pagination"></div>
      </section>
      <div class="modal-backdrop" id="admin-firm-price-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="admin-firm-price-title">
          <div class="modal-header">
            <div><p class="eyebrow">Analiz fiyatı</p><h2 id="admin-firm-price-title">Analiz başı fiyat</h2></div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-admin-firm-modal>&times;</button>
          </div>
          <form id="admin-unit-price-form" class="modal-form">
            <div class="form-grid">
              <label><span>Analiz başı bedel</span><input name="pricePerAnalysis" type="number" min="1" step="0.01" required /></label>
              <label><span>Para birimi</span><input name="currency" type="text" value="TL" required /></label>
            </div>
            <div class="modal-actions">
              <button class="button ghost" type="button" data-close-admin-firm-modal>Vazgeç</button>
              <button class="button" type="submit">Fiyatı kaydet</button>
            </div>
          </form>
        </section>
      </div>
      <div class="modal-backdrop" id="admin-firm-sale-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="admin-firm-sale-title">
          <div class="modal-header">
            <div><p class="eyebrow">Analiz satışı</p><h2 id="admin-firm-sale-title">Firmaya toplu analiz sat</h2></div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-admin-firm-modal>&times;</button>
          </div>
          <form id="admin-analysis-sale-form" class="modal-form">
            <div class="customer-search-box">
              <label for="admin-sale-firm-search">
                <span>Analiz satılacak firma</span>
                <input id="admin-sale-firm-search" type="search" placeholder="Firma adı yazın" autocomplete="off" />
              </label>
              <div class="customer-search-results" id="admin-sale-firm-results" hidden></div>
            </div>
            <input name="firmId" type="hidden" required />
            <div class="form-grid">
              <label><span>Seçilen firma</span><input id="admin-sale-selected-firm" type="text" value="Firma seçilmedi" disabled /></label>
              <label><span>Analiz adedi</span><input name="quantity" type="number" min="1" step="1" required /></label>
            </div>
            <label><span>Not</span><textarea name="note" rows="3" placeholder="Örn. Temmuz toplu analiz satışı"></textarea></label>
            <div class="modal-actions">
              <button class="button ghost" type="button" data-close-admin-firm-modal>Vazgeç</button>
              <button class="button" type="submit">Satışı kaydet</button>
            </div>
          </form>
        </section>
      </div>
      <div class="modal-backdrop" id="admin-firm-create-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="admin-firm-create-title">
          <div class="modal-header">
            <div><p class="eyebrow">Yeni firma</p><h2 id="admin-firm-create-title">Firma ekle</h2></div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-admin-firm-modal>&times;</button>
          </div>
          <form id="admin-firm-create-form" class="modal-form">
            <div class="form-grid">
              <label><span>Firma adı</span><input name="name" type="text" required /></label>
              <label><span>Marka adı</span><input name="brandName" type="text" required /></label>
              <label><span>E-posta</span><input name="email" type="email" required /></label>
              <label><span>Telefon</span><input name="phone" type="tel" /></label>
              <label><span>Website</span><input name="website" type="url" /></label>
              <label><span>Kullanıcı adı</span><input name="username" type="text" required /></label>
              <label><span>Geçici şifre</span><input name="password" type="text" value="firm123" required /></label>
            </div>
            <label><span>Adres</span><textarea name="address" rows="3"></textarea></label>
            <div class="modal-actions">
              <button class="button ghost" type="button" data-close-admin-firm-modal>Vazgeç</button>
              <button class="button" type="submit">Firma ekle</button>
            </div>
          </form>
        </section>
      </div>
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

  function packagesPage() {
    return `
      ${adminHeader("Paketler", "Salon abonelik paketlerini ve analiz limitlerini yönetin.")}
      <section class="panel">
        <div class="section-title">
          <h2>Paket yönetimi</h2>
          <button class="button" type="button" data-open-package-create-modal>Yeni paket oluştur</button>
        </div>
        <div id="admin-package-message" class="success-message" hidden></div>
      </section>
      <section class="admin-package-grid" id="admin-package-grid">
        <article class="panel"><p class="muted">Paketler yükleniyor...</p></article>
      </section>
      <div class="modal-backdrop" id="admin-package-manage-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="admin-package-manage-title">
          <div class="modal-header">
            <div>
              <p class="eyebrow">Paket düzenle</p>
              <h2 id="admin-package-manage-title">Paketi yönet</h2>
            </div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-package-modal>&times;</button>
          </div>
          <form id="admin-package-manage-form" class="modal-form">
            <input name="id" type="hidden" />
            <div class="form-grid">
              <label><span>Paket adı</span><input name="name" type="text" required /></label>
              <label><span>Slug</span><input name="slug" type="text" required /></label>
              <label><span>Aylık fiyat etiketi</span><input name="monthlyPriceLabel" type="text" required /></label>
              <label><span>Aylık fiyat değeri</span><input name="monthlyPriceValue" type="number" min="0" step="0.01" /></label>
              <label><span>Analiz limiti</span><input name="analysisLimit" type="number" min="0" step="1" required /></label>
              <label><span>Analiz limiti etiketi</span><input name="analysisLimitLabel" type="text" required /></label>
              <label><span>Kullanıcı limiti</span><input name="userLimit" type="number" min="0" step="1" /></label>
              <label><span>Kullanıcı limiti etiketi</span><input name="userLimitLabel" type="text" required /></label>
              <label><span>Durum</span><select name="status"><option>Aktif</option><option>Pasif</option></select></label>
              <label><span>Sıralama</span><input name="sortOrder" type="number" step="1" /></label>
            </div>
            <label><span>Özellikler</span><textarea name="features" rows="4" placeholder="Her satıra bir özellik yazın"></textarea></label>
            <div class="modal-actions">
              <button class="button ghost" type="button" data-close-package-modal>Vazgeç</button>
              <button class="button" type="submit">Paketi kaydet</button>
            </div>
          </form>
        </section>
      </div>
      <div class="modal-backdrop" id="admin-package-create-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="admin-package-create-title">
          <div class="modal-header">
            <div>
              <p class="eyebrow">Yeni paket</p>
              <h2 id="admin-package-create-title">Paket oluştur</h2>
            </div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-package-modal>&times;</button>
          </div>
          <form id="admin-package-create-form" class="modal-form">
            <div class="form-grid">
              <label><span>Paket adı</span><input name="name" type="text" required /></label>
              <label><span>Slug</span><input name="slug" type="text" placeholder="ornek-paket" required /></label>
              <label><span>Aylık fiyat etiketi</span><input name="monthlyPriceLabel" type="text" placeholder="1.490 TL / ay" required /></label>
              <label><span>Aylık fiyat değeri</span><input name="monthlyPriceValue" type="number" min="0" step="0.01" /></label>
              <label><span>Analiz limiti</span><input name="analysisLimit" type="number" min="0" step="1" required /></label>
              <label><span>Analiz limiti etiketi</span><input name="analysisLimitLabel" type="text" placeholder="50 analiz" required /></label>
              <label><span>Kullanıcı limiti</span><input name="userLimit" type="number" min="0" step="1" /></label>
              <label><span>Kullanıcı limiti etiketi</span><input name="userLimitLabel" type="text" placeholder="1 kullanıcı" required /></label>
              <label><span>Durum</span><select name="status"><option>Aktif</option><option>Pasif</option></select></label>
              <label><span>Sıralama</span><input name="sortOrder" type="number" step="1" value="10" /></label>
            </div>
            <label><span>Özellikler</span><textarea name="features" rows="4" placeholder="Her satıra bir özellik yazın"></textarea></label>
            <div class="modal-actions">
              <button class="button ghost" type="button" data-close-package-modal>Vazgeç</button>
              <button class="button" type="submit">Paket oluştur</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function productsPage() {
    return `
      ${adminHeader("Ürün Kütüphanesi", "Global ürün kütüphanesine toplu ürün ekleyin ve ürünleri yönetin.")}
      <section class="panel">
        <div class="section-title">
          <h2>Toplu ürün ekleme</h2>
          <a class="button ghost" href="/api/admin/product-template" target="_blank" rel="noopener">Excel şablonunu indir</a>
        </div>
        <div id="admin-product-import-message" class="success-message" hidden></div>
        <form id="admin-product-import-form" class="customer-form">
          <label>
            <span>Doldurulmuş şablon</span>
            <input name="file" type="file" accept=".csv,.xls,.txt" required />
          </label>
          <p class="muted">Şablon Excel ile ayrı sütunlar halinde açılır. Doldurduktan sonra CSV olarak kaydedip geri yükleyin.</p>
          <button class="button" type="submit">Toplu ürün yükle</button>
        </form>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Global ürünler</h2><span class="muted" id="admin-products-count">Yükleniyor</span></div>
        <div class="table-toolbar">
          <label class="table-search" for="admin-products-search">
            <span>Ürün ara</span>
            <input id="admin-products-search" type="search" placeholder="Ürün, marka, kategori veya kullanım amacı" autocomplete="off" />
          </label>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Ürün adı</th><th>Marka</th><th>Kategori</th><th>Ürün tipi</th><th>Kullanım amacı</th><th>Kullanım zamanı</th><th>Durum</th><th>İşlem</th></tr>
            </thead>
            <tbody id="admin-products-table-body"><tr><td colspan="8">Ürünler yükleniyor...</td></tr></tbody>
          </table>
        </div>
        <div class="pagination" id="admin-products-pagination"></div>
      </section>
      <div class="modal-backdrop" id="admin-product-edit-modal" hidden>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="admin-product-edit-title">
          <div class="modal-header">
            <div><p class="eyebrow">Ürün düzenle</p><h2 id="admin-product-edit-title">Ürün bilgileri</h2></div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-product-edit-modal>&times;</button>
          </div>
          ${productEditForm("admin-product-edit-form")}
        </section>
      </div>
    `;
  }

  function settings() {
    return `
      ${adminHeader("Sistem Ayarları", "Platform varsayılanları ve entegrasyon durumları.")}
      <section class="panel">
        <div id="admin-settings-success" class="success-message" hidden>Sistem ayarları mock olarak kaydedildi.</div>
        ${AdminSettingsForm(data.settings)}
      </section>
    `;
  }

  function databaseOverview() {
    return `
      ${adminHeader("Genel Bakış", "Platform durumu, salon kullanımı ve aylık performans özeti.")}
      <div id="admin-summary-root">
        <section class="stats-grid admin-summary-grid">
          <article class="stat-card admin-stat"><span>Toplam salon</span><strong>-</strong></article>
          <article class="stat-card admin-stat"><span>Aktif salon</span><strong>-</strong></article>
          <article class="stat-card admin-stat"><span>Bu ay yapılan analiz</span><strong>-</strong></article>
          <article class="stat-card admin-stat"><span>Bekleyen analiz</span><strong>-</strong></article>
          <article class="stat-card admin-stat"><span>Tamamlanan rapor</span><strong>-</strong></article>
          <article class="stat-card admin-stat"><span>Aylık tahmini gelir</span><strong>-</strong></article>
        </section>
      </div>
      <section class="two-column">
        <article class="panel">
          <div class="section-title"><h2>Son salonlar</h2></div>
          <div id="admin-overview-salons"><p class="muted">Salonlar yükleniyor...</p></div>
        </article>
        <article class="panel">
          <div class="section-title"><h2>Analiz kuyruğu</h2></div>
          <div id="admin-overview-analyses"><p class="muted">Analizler yükleniyor...</p></div>
        </article>
      </section>
    `;
  }

  function resolve(path) {
    if (path === "/admin") return databaseOverview();
    if (path === "/admin/salons") return salons();
    if (path === "/admin/firms") return firmsPage();
    if (path === "/admin/analyses") return analyses();
    if (path === "/admin/packages") return packagesPage();
    if (path === "/admin/products") return productsPage();
    if (path === "/admin/settings") return settings();
    return overview();
  }

  window.CiltGPTAdminPages = { resolve };
})();

