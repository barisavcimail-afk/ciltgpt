(function () {
  const icons = {
    dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z"/></svg>',
    customers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3ZM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z"/></svg>',
    analysis: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 3h4v15H4V6h4l1-3Zm3 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z"/></svg>',
    reports: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5V3Zm3 4v2h8V7H8Zm0 4v2h8v-2H8Zm0 4v2h5v-2H8Z"/></svg>',
    products: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7 12 3l8 4v10l-8 4-8-4V7Zm8 2.2L16.7 7 12 4.8 7.3 7 12 9.2Zm-6 6.6 5 2.5v-7.4l-5-2.5v7.4Zm7 2.5 5-2.5V8.4l-5 2.5v7.4Z"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A7.4 7.4 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5c-.1.5-.1 1-.1 1.5s0 1 .1 1.5l-2 1.5 2 3.4 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"/></svg>',
  };

  const navItems = [
    { label: "Dashboard", path: "/dashboard", icon: icons.dashboard, permission: "dashboard" },
    { label: "Müşteriler", path: "/dashboard/customers", icon: icons.customers, permission: "customers" },
    { label: "Yeni Analiz", path: "/dashboard/new-analysis", icon: icons.analysis, permission: "analyses" },
    { label: "Raporlar", path: "/dashboard/reports", icon: icons.reports, permission: "reports" },
    { label: "Ürünler", path: "/dashboard/products", icon: icons.products, permission: "products" },
    { label: "Protokoller", path: "/dashboard/protocols", icon: icons.reports, permission: "protocols" },
    { label: "Abonelik", path: "/dashboard/billing", icon: icons.reports, permission: "billing" },
    { label: "Ekip", path: "/dashboard/team", icon: icons.customers, permission: "team" },
    { label: "Ayarlar", path: "/dashboard/settings", icon: icons.settings, permission: "settings" },
  ];

  const rolePermissions = {
    "Salon Yöneticisi": ["dashboard", "customers", "analyses", "reports", "products", "protocols", "team", "billing", "settings"],
    "Salon Yoneticisi": ["dashboard", "customers", "analyses", "reports", "products", "protocols", "team", "billing", "settings"],
    "Analiz Uzmanı": ["dashboard", "customers", "analyses", "reports"],
    "Analiz Uzmani": ["dashboard", "customers", "analyses", "reports"],
    "Satış Danışmanı": ["dashboard", "customers", "reports", "products"],
    "Satis Danismani": ["dashboard", "customers", "reports", "products"],
    Resepsiyon: ["dashboard", "customers", "reports"],
  };

  function canSee(user, permission) {
    if (!user || user.role === "SALON_OWNER") return true;
    const permissions = rolePermissions[user.staffRole || ""] || [];
    return permissions.includes(permission);
  }

  function pageHeader(title, description, action = "") {
    return `
      <div class="page-header">
        <div>
          <p class="eyebrow">Cilt analiz paneli</p>
          <h1>${title}</h1>
          <p>${description}</p>
        </div>
        ${action}
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderLayout(content, route, toHref, user) {
    const nav = navItems
      .filter((item) => canSee(user, item.permission))
      .map((item) => {
        const active = route === item.path || (item.path !== "/dashboard" && route.startsWith(item.path.replace("mock-report-001", "")));
        return `
          <a class="sidebar-link ${active ? "active" : ""}" href="${toHref(item.path)}" data-path="${item.path}">
            <span class="sidebar-icon">${item.icon}</span>
            <span>${item.label}</span>
          </a>
        `;
      })
      .join("");
    const salonName = escapeHtml(user?.salonName || "Salon");
    const userName = escapeHtml(user?.name || user?.username || "Kullanıcı");
    const roleLabel = escapeHtml(user?.staffRole || (user?.role === "SALON_OWNER" ? "Salon Yöneticisi" : "Kullanıcı"));
    const storedLogo = user?.salonLogoUrl || window.CiltGPTSalonBranding?.logoUrl || "";
    const logoMarkup = storedLogo
      ? `<img src="${escapeHtml(storedLogo)}" alt="Salon logosu" />`
      : `<span>Logo</span>`;

    return `
      <div class="shell">
        <button class="mobile-menu-toggle" type="button" data-mobile-menu-toggle aria-label="Menüyü aç" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <div class="mobile-menu-backdrop" data-mobile-menu-close></div>
        <aside class="sidebar">
          <a class="brand logo-brand" href="${toHref("/dashboard")}" data-path="/dashboard">
            <img class="brand-wordmark" src="/assets/ciltgpt-logo.svg?v=20260821-4" alt="CiltGPT" />
            <small class="brand-subtitle">SaaS MVP</small>
          </a>
          <nav>${nav}</nav>
          <div class="sidebar-user-card">
            <div class="sidebar-user-logo" data-sidebar-logo>${logoMarkup}</div>
            <span class="sidebar-user-salon">${salonName}</span>
            <strong>${userName}</strong>
            <small>${roleLabel}</small>
          </div>
          <button class="sidebar-link logout-link" type="button" data-logout>
            <span class="sidebar-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17v-2h4V9h-4V7h6v10h-6Zm-2 4H4V3h4v2H6v14h2v2Zm1.6-5.4L8.2 14.2 10.4 12 8.2 9.8l1.4-1.4L14.2 12l-4.6 3.6Z"/></svg>
            </span>
            <span>Çıkış yap</span>
          </button>
        </aside>
        <main class="main">${content}</main>
      </div>
    `;
  }

  function scoreCards(scores) {
    return `
      <div class="score-grid">
        ${Object.entries(scores)
          .map(
            ([label, value]) => `
              <article class="score-card">
                <span>${label}</span>
                <strong>${value}/100</strong>
                <div class="meter"><i style="width:${value}%"></i></div>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function customerFields(required = false) {
    const requiredAttr = required ? "required" : "";
    return `
      <div class="form-grid">
        <label><span>Ad Soyad</span><input name="fullName" type="text" placeholder="Örn. Deniz Arslan" ${requiredAttr} /></label>
        <label><span>Telefon</span><input name="phone" type="tel" placeholder="05xx xxx xx xx" ${requiredAttr} /></label>
        <label><span>Yaş</span><input name="age" type="number" min="12" max="100" placeholder="32" ${requiredAttr} /></label>
        <label>
          <span>Cinsiyet</span>
          <select name="gender" ${requiredAttr}>
            <option value="">Seçiniz</option>
            <option>Kadın</option>
            <option>Erkek</option>
            <option>Belirtmek istemiyor</option>
          </select>
        </label>
      </div>
      <label><span>Notlar</span><textarea name="notes" rows="4" placeholder="Cilt hassasiyeti, geçmiş uygulamalar veya bakım hedefleri"></textarea></label>
    `;
  }

  window.CiltGPTComponents = {
    pageHeader,
    renderLayout,
    scoreCards,
    customerFields,
  };
})();





