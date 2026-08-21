import { icons } from "./icons.js";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: icons.dashboard },
  { label: "Müşteriler", path: "/dashboard/customers", icon: icons.customers },
  { label: "Yeni Analiz", path: "/dashboard/new-analysis", icon: icons.analysis },
  { label: "Raporlar", path: "/dashboard/reports/demo", icon: icons.reports },
  { label: "Ürünler", path: "/dashboard/products", icon: icons.products },
  { label: "Ayarlar", path: "/dashboard/settings", icon: icons.settings },
];

export function renderLayout(content, route) {
  const nav = navItems
    .map((item) => {
      const isActive = route === item.path || (item.path !== "/dashboard" && route.startsWith(item.path));
      return `
        <a class="sidebar-link ${isActive ? "active" : ""}" href="${item.path}" data-link>
          <span class="sidebar-icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `;
    })
    .join("");

  return `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand logo-brand" href="/dashboard" data-link>
          <img class="brand-wordmark" src="/assets/ciltgpt-logo.svg" alt="CiltGPT" />
          <small class="brand-subtitle">SaaS MVP</small>
        </a>
        <nav>${nav}</nav>
      </aside>
      <main class="main">
        ${content}
      </main>
    </div>
  `;
}

export function pageHeader(title, description, action = "") {
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

