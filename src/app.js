(function () {
  const app = document.querySelector("#app");
  const isFileMode = window.location.protocol === "file:";
  const { renderLayout } = window.CiltGPTComponents;
  const { AdminLayout } = window.CiltGPTAdminComponents;
  const { authPage, firmProductsPage, firmSalonsPage, firmPackagesPage, firmSettingsPage, dashboardHome, customersPage, customerDetailPage, reportsListPage, reportPage, productsPage, protocolsPage, billingPage, teamPage, settingsPage, placeholderPage } = window.CiltGPTPages;
  const { resolve: resolveAdminPage } = window.CiltGPTAdminPages;
  const { renderAnalysisWizard, bindAnalysisWizard } = window.CiltGPTWizard;
  window.CiltGPTSubscription = window.CiltGPTSubscription || { packages: [], currentSubscription: {}, usageStats: {} };
  let authChecked = false;
  let authUser = null;
  let pendingSalonLogoUrl = "";
  const CUSTOMER_PAGE_SIZE = 10;
  const customerListState = {
    customers: [],
    query: "",
    page: 1,
  };
  const reportListState = {
    reports: [],
    query: "",
    selectedCustomerId: "",
    selectedCustomerName: "",
  };
  const PRODUCT_PAGE_SIZE = 5;
  const productListState = {
    products: [],
    query: "",
    page: 1,
  };
  const teamLimitState = {
    used: 0,
    limit: Infinity,
    isFull: false,
  };
  const protocolState = {
    protocols: [],
    query: "",
    page: 1,
  };
  const PROTOCOL_PAGE_SIZE = 5;
  const adminSalonListState = {
    salons: [],
    query: "",
  };
  const ADMIN_FIRM_PAGE_SIZE = 5;
  const adminFirmState = {
    firms: [],
    sales: [],
    firmQuery: "",
    saleQuery: "",
    firmPage: 1,
    salePage: 1,
    saleFirmQuery: "",
  };
  const adminAnalysisState = {
    analyses: [],
    query: "",
  };
  const adminProductState = {
    products: [],
    query: "",
    page: 1,
  };
  const firmProductState = {
    products: [],
    query: "",
  };

  function currentPath() {
    if (isFileMode) {
      return window.location.hash.replace(/^#/, "") || "/dashboard";
    }

    return window.location.pathname === "/" ? "/dashboard" : window.location.pathname;
  }

  function toHref(path) {
    return isFileMode ? `#${path}` : path;
  }

  function navigate(path) {
    if (isFileMode) {
      window.location.hash = path;
      return;
    }

    if (path === "/dashboard/new-analysis") {
      try {
        const saved = sessionStorage.getItem("analysisWizardState");
        const state = saved ? JSON.parse(saved) : {};
        sessionStorage.setItem("analysisWizardState", JSON.stringify({ ...state, isLoadingCustomers: true }));
      } catch {
        sessionStorage.removeItem("analysisWizardState");
      }
    }

    history.pushState({}, "", path);
    render();
  }

  function isAdminPath(path) {
    return path === "/admin" || path.startsWith("/admin/");
  }

  function isSalonPath(path) {
    return path === "/dashboard" || path.startsWith("/dashboard/");
  }

  const routePermissions = {
    "/dashboard": "dashboard",
    "/dashboard/customers": "customers",
    "/dashboard/new-analysis": "analyses",
    "/dashboard/reports": "reports",
    "/dashboard/products": "products",
    "/dashboard/protocols": "protocols",
    "/dashboard/billing": "billing",
    "/dashboard/team": "team",
    "/dashboard/settings": "settings",
  };

  const clientRolePermissions = {
    "Salon Yöneticisi": ["dashboard", "customers", "analyses", "reports", "products", "protocols", "team", "billing", "settings"],
    "Salon Yoneticisi": ["dashboard", "customers", "analyses", "reports", "products", "protocols", "team", "billing", "settings"],
    "Analiz Uzmanı": ["dashboard", "customers", "analyses", "reports"],
    "Analiz Uzmani": ["dashboard", "customers", "analyses", "reports"],
    "Satış Danışmanı": ["dashboard", "customers", "reports", "products"],
    "Satis Danismani": ["dashboard", "customers", "reports", "products"],
    Resepsiyon: ["dashboard", "customers", "reports"],
  };

  function permissionForPath(path) {
    if (path.startsWith("/dashboard/customers")) return "customers";
    if (path.startsWith("/dashboard/reports")) return "reports";
    return routePermissions[path] || "dashboard";
  }

  function canAccessPath(path) {
    if (!authUser || authUser.role === "SALON_OWNER") return true;
    const permissions = clientRolePermissions[authUser.staffRole || ""] || [];
    return permissions.includes(permissionForPath(path));
  }

  function isFirmPath(path) {
    return path === "/firm" || path.startsWith("/firm/");
  }

  async function refreshAuth() {
    try {
      const response = await fetch("/api/auth/me");
      const payload = await response.json();
      authUser = response.ok ? payload.user : null;
    } catch {
      authUser = null;
    } finally {
      authChecked = true;
    }
  }

  function authLoading() {
    return '<main class="auth-screen"><section class="auth-card"><p class="muted">Oturum kontrol ediliyor...</p></section></main>';
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatCustomerDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("tr-TR");
  }

  function formatAnalysisStatus(value) {
    const labels = {
      PENDING: "Bekliyor",
      PROCESSING: "İşleniyor",
      COMPLETED: "Tamamlandı",
      FAILED: "Hatalı",
    };
    return labels[value] || value || "-";
  }

  function customerRow(customer) {
    const detailPath = `/dashboard/customers/${customer.id}`;
    const reportPath = "/dashboard/reports";

    return `
      <tr>
        <td>${escapeHtml(customer.fullName)}</td>
        <td>${escapeHtml(customer.phone)}</td>
        <td>${escapeHtml(customer.age || "-")}</td>
        <td>${escapeHtml(customer.gender || "-")}</td>
        <td>${formatCustomerDate(customer.lastAnalysisDate)}</td>
        <td><span class="status">${escapeHtml(customer.status || "Aktif")}</span></td>
        <td>
          <div class="table-action-group">
            <a class="table-action" href="${toHref(detailPath)}" data-path="${detailPath}">Detay</a>
            <a
              class="table-action muted-action"
              href="${toHref(reportPath)}"
              data-path="${reportPath}"
              data-report-customer-id="${escapeHtml(customer.id)}"
              data-report-customer-name="${escapeHtml(customer.fullName)}"
            >Rapor</a>
          </div>
        </td>
      </tr>
    `;
  }

  function normalizeSearchText(value) {
    return String(value || "").toLocaleLowerCase("tr-TR");
  }

  function storePendingReportCustomerSelection(customerId, customerName) {
    try {
      sessionStorage.setItem(
        "pendingReportCustomerSelection",
        JSON.stringify({
          id: customerId || "",
          name: customerName || "",
        })
      );
    } catch {
      reportListState.selectedCustomerId = customerId || "";
      reportListState.selectedCustomerName = customerName || "";
      reportListState.query = customerName || "";
    }
  }

  function applyPendingReportCustomerSelection() {
    let pending = null;
    try {
      const raw = sessionStorage.getItem("pendingReportCustomerSelection");
      pending = raw ? JSON.parse(raw) : null;
      sessionStorage.removeItem("pendingReportCustomerSelection");
    } catch {
      pending = null;
    }

    if (!pending) return;
    reportListState.selectedCustomerId = String(pending.id || "");
    reportListState.selectedCustomerName = String(pending.name || "");
    reportListState.query = reportListState.selectedCustomerName;

    const search = document.querySelector("#reports-customer-search");
    if (search) search.value = reportListState.query;
  }

  function filteredCustomers() {
    const query = normalizeSearchText(customerListState.query).trim();
    if (!query) return customerListState.customers;

    return customerListState.customers.filter((customer) => {
      const haystack = [
        customer.fullName,
        customer.phone,
        customer.gender,
        customer.status,
      ]
        .map(normalizeSearchText)
        .join(" ");
      return haystack.includes(query);
    });
  }

  function renderCustomerPagination(totalItems) {
    const pagination = document.querySelector("#customers-pagination");
    if (!pagination) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / CUSTOMER_PAGE_SIZE));
    if (totalItems <= CUSTOMER_PAGE_SIZE) {
      pagination.innerHTML = "";
      return;
    }

    const pageButtons = Array.from({ length: totalPages }, (_, index) => {
      const page = index + 1;
      return `<button class="pagination-button ${page === customerListState.page ? "active" : ""}" type="button" data-customer-page="${page}">${page}</button>`;
    }).join("");

    pagination.innerHTML = `
      <button class="pagination-button" type="button" data-customer-page="${customerListState.page - 1}" ${customerListState.page === 1 ? "disabled" : ""}>Önceki</button>
      <div class="pagination-pages">${pageButtons}</div>
      <button class="pagination-button" type="button" data-customer-page="${customerListState.page + 1}" ${customerListState.page === totalPages ? "disabled" : ""}>Sonraki</button>
    `;

    pagination.querySelectorAll("[data-customer-page]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextPage = Number(button.dataset.customerPage);
        if (!Number.isFinite(nextPage)) return;
        customerListState.page = Math.min(Math.max(nextPage, 1), totalPages);
        renderCustomerList();
      });
    });
  }

  function renderCustomerList() {
    const count = document.querySelector("#customers-count");
    const tbody = document.querySelector("#customers-table-body");
    if (!tbody) return;

    const customers = filteredCustomers();
    const totalPages = Math.max(1, Math.ceil(customers.length / CUSTOMER_PAGE_SIZE));
    customerListState.page = Math.min(Math.max(customerListState.page, 1), totalPages);

    if (count) {
      count.textContent = customerListState.query
        ? `${customers.length} / ${customerListState.customers.length} kayıt`
        : `${customerListState.customers.length} kayıt`;
    }

    if (customers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">Arama kriterine uygun müşteri bulunamadı.</td></tr>';
      renderCustomerPagination(0);
      return;
    }

    const start = (customerListState.page - 1) * CUSTOMER_PAGE_SIZE;
    const pageItems = customers.slice(start, start + CUSTOMER_PAGE_SIZE);
    tbody.innerHTML = pageItems.map(customerRow).join("");
    renderCustomerPagination(customers.length);
    bindRouteLinks();
  }

  function reportRow(report) {
    const reportPath = `/dashboard/reports/${report.id}`;
    return `
      <tr>
        <td>${escapeHtml(report.id)}</td>
        <td>${escapeHtml(report.customerName)}</td>
        <td>${formatCustomerDate(report.analysisDate)}</td>
        <td>${escapeHtml(report.overallScore)}</td>
        <td>${escapeHtml(report.complaint)}</td>
        <td><span class="status">${escapeHtml(report.status)}</span></td>
        <td>
          <div class="table-action-group">
            <a class="table-action" href="${toHref(reportPath)}" data-path="${reportPath}">Detay</a>
            <button class="table-action muted-action danger-action" type="button" data-delete-report="${escapeHtml(report.id)}">Sil</button>
          </div>
        </td>
      </tr>
    `;
  }

  function uniqueReportCustomers() {
    const customers = new Map();
    reportListState.reports.forEach((report) => {
      const name = String(report.customerName || "").trim();
      if (!name || name === "-") return;
      const id = String(report.customerId || "").trim();
      const key = id || normalizeSearchText(name);
      if (!customers.has(key)) {
        customers.set(key, { id, name });
      }
    });

    return Array.from(customers.values()).sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
  }

  function selectedCustomerReports() {
    if (!reportListState.selectedCustomerId && !reportListState.selectedCustomerName) return [];
    if (reportListState.selectedCustomerId) {
      return reportListState.reports.filter((report) => String(report.customerId || "") === reportListState.selectedCustomerId);
    }
    const selected = normalizeSearchText(reportListState.selectedCustomerName);
    return reportListState.reports.filter((report) => normalizeSearchText(report.customerName) === selected);
  }

  function renderReportCustomerResults() {
    const results = document.querySelector("#reports-customer-results");
    if (!results) return;

    const query = normalizeSearchText(reportListState.query).trim();
    const customers = uniqueReportCustomers()
      .filter((customer) => !query || normalizeSearchText(customer.name).includes(query))
      .slice(0, 10);

    if (!query) {
      results.hidden = true;
      results.innerHTML = "";
      return;
    }

    results.hidden = false;
    if (!customers.length) {
      results.innerHTML = '<div class="customer-search-empty compact"><strong>Müşteri bulunamadı</strong><span>Farklı bir isim deneyin.</span></div>';
      return;
    }

    results.innerHTML = customers
      .map((customer) => {
        const reportCount = reportListState.reports.filter((report) => {
          if (customer.id) return String(report.customerId || "") === customer.id;
          return normalizeSearchText(report.customerName) === normalizeSearchText(customer.name);
        }).length;
        return `
          <button class="customer-search-result" type="button" data-report-customer-id="${escapeHtml(customer.id)}" data-report-customer="${escapeHtml(customer.name)}">
            <strong>${escapeHtml(customer.name)}</strong>
            <span>${reportCount} rapor</span>
            <small>Seç</small>
          </button>
        `;
      })
      .join("");

    results.querySelectorAll("[data-report-customer]").forEach((button) => {
      button.addEventListener("click", () => {
        reportListState.selectedCustomerId = button.dataset.reportCustomerId || "";
        reportListState.selectedCustomerName = button.dataset.reportCustomer || "";
        reportListState.query = reportListState.selectedCustomerName;
        const search = document.querySelector("#reports-customer-search");
        if (search) search.value = reportListState.selectedCustomerName;
        results.hidden = true;
        renderReportsForSelectedCustomer();
      });
    });
  }

  function renderReportsForSelectedCustomer() {
    const count = document.querySelector("#reports-count");
    const tbody = document.querySelector("#reports-table-body");
    const selectedChip = document.querySelector("#reports-selected-customer");
    if (!tbody) return;

    if (!reportListState.selectedCustomerId && !reportListState.selectedCustomerName) {
      if (count) count.textContent = `${reportListState.reports.length} rapor`;
      if (selectedChip) selectedChip.hidden = true;
      tbody.innerHTML = '<tr><td colspan="7">Raporları görüntülemek için müşteri seçin.</td></tr>';
      return;
    }

    const reports = selectedCustomerReports();
    if (count) count.textContent = `${reports.length} rapor`;
    if (selectedChip) {
      selectedChip.hidden = false;
      selectedChip.innerHTML = `
        <span>Seçili müşteri: <strong>${escapeHtml(reportListState.selectedCustomerName)}</strong></span>
        <button class="table-action muted-action" type="button" data-clear-report-customer>Temizle</button>
      `;
      selectedChip.querySelector("[data-clear-report-customer]")?.addEventListener("click", () => {
        reportListState.selectedCustomerId = "";
        reportListState.selectedCustomerName = "";
        reportListState.query = "";
        const search = document.querySelector("#reports-customer-search");
        if (search) search.value = "";
        renderReportCustomerResults();
        renderReportsForSelectedCustomer();
      });
    }

    if (!reports.length) {
      tbody.innerHTML = '<tr><td colspan="7">Bu müşteri için rapor bulunamadı.</td></tr>';
      return;
    }

    tbody.innerHTML = reports.map(reportRow).join("");
    bindReportDeleteButtons();
    bindRouteLinks();
  }

  function productRow(product) {
    const nextStatus = product.status === "Pasif" ? "Aktif" : "Pasif";
    const buttonLabel = product.status === "Pasif" ? "Aktif yap" : "Pasif yap";
    const isPassive = product.status === "Pasif";
    return `
      <tr class="${isPassive ? "product-row-passive" : ""}">
        <td>${escapeHtml(product.name)}</td>
        <td>${escapeHtml(product.brand)}</td>
        <td>${escapeHtml(product.category)}</td>
        <td>${escapeHtml(product.productType || (product.isCabinProduct ? "Kabin ürünü" : "Ev devam ürünü"))}</td>
        <td>${escapeHtml(product.purpose || product.usagePurpose)}</td>
        <td>${escapeHtml(product.time || product.usageTime)}</td>
        <td><span class="status ${product.status === "Pasif" ? "inactive" : ""}">${escapeHtml(product.status)}</span></td>
        <td>
          <button
            class="table-action ${isPassive ? "success-action" : "danger-action"}"
            type="button"
            data-toggle-salon-product="${escapeHtml(product.id)}"
            data-next-status="${escapeHtml(nextStatus)}"
          >${buttonLabel}</button>
        </td>
      </tr>
    `;
  }

  function renderProductPagination(totalItems) {
    const pagination = document.querySelector("#products-pagination");
    if (!pagination) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / PRODUCT_PAGE_SIZE));
    if (totalItems <= PRODUCT_PAGE_SIZE) {
      pagination.innerHTML = "";
      return;
    }

    const pageButtons = Array.from({ length: totalPages }, (_, index) => {
      const page = index + 1;
      return `<button class="pagination-button ${page === productListState.page ? "active" : ""}" type="button" data-product-page="${page}">${page}</button>`;
    }).join("");

    pagination.innerHTML = `
      <button class="pagination-button" type="button" data-product-page="${productListState.page - 1}" ${productListState.page === 1 ? "disabled" : ""}>Önceki</button>
      <div class="pagination-pages">${pageButtons}</div>
      <button class="pagination-button" type="button" data-product-page="${productListState.page + 1}" ${productListState.page === totalPages ? "disabled" : ""}>Sonraki</button>
    `;

    pagination.querySelectorAll("[data-product-page]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextPage = Number(button.dataset.productPage);
        if (!Number.isFinite(nextPage)) return;
        productListState.page = Math.min(Math.max(nextPage, 1), totalPages);
        renderProductList();
      });
    });
  }

  function filteredProducts() {
    const query = normalizeSearchText(productListState.query).trim();
    if (!query) return productListState.products;

    return productListState.products.filter((product) => {
      const haystack = [
        product.name,
        product.brand,
        product.category,
        product.productType,
        product.isCabinProduct ? "kabin ürünü" : "ev devam ürünü",
        product.purpose,
        product.usagePurpose,
        product.time,
        product.usageTime,
        product.status,
      ]
        .map(normalizeSearchText)
        .join(" ");
      return haystack.includes(query);
    });
  }

  function renderProductList() {
    const count = document.querySelector("#products-count");
    const tbody = document.querySelector("#products-table-body");
    if (!tbody) return;

    const products = filteredProducts();
    const totalPages = Math.max(1, Math.ceil(products.length / PRODUCT_PAGE_SIZE));
    productListState.page = Math.min(Math.max(productListState.page, 1), totalPages);
    if (count) {
      count.textContent = productListState.query
        ? `${products.length} / ${productListState.products.length} ürün`
        : `${productListState.products.length} ürün`;
    }

    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="8">Arama kriterine uygun ürün bulunamadı.</td></tr>';
      renderProductPagination(0);
      return;
    }

    const start = (productListState.page - 1) * PRODUCT_PAGE_SIZE;
    tbody.innerHTML = products.slice(start, start + PRODUCT_PAGE_SIZE).map(productRow).join("");
    renderProductPagination(products.length);
    bindSalonProductStatusButtons();
  }

  function bindSalonProductStatusButtons() {
    document.querySelectorAll("[data-toggle-salon-product]").forEach((button) => {
      if (button.dataset.boundSalonProductToggle === "true") return;
      button.dataset.boundSalonProductToggle = "true";
      button.addEventListener("click", async () => {
        const productId = button.dataset.toggleSalonProduct;
        const nextStatus = button.dataset.nextStatus || "Aktif";
        const apiMessage = document.querySelector("#products-api-message");
        if (!productId) return;

        try {
          button.disabled = true;
          const response = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message || "Ürün durumu güncellenemedi.");

          if (apiMessage) {
            apiMessage.textContent = payload.message || "Ürün durumu güncellendi.";
            apiMessage.classList.remove("error-message");
            apiMessage.hidden = false;
          }
          await loadProductsFromDatabase();
        } catch (error) {
          if (apiMessage) {
            apiMessage.textContent = error instanceof Error ? error.message : "Ürün durumu güncellenemedi.";
            apiMessage.classList.add("error-message");
            apiMessage.hidden = false;
          }
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function firmProductRow(product) {
    return `
      <tr>
        <td>${escapeHtml(product.name)}</td>
        <td>${escapeHtml(product.brand)}</td>
        <td>${escapeHtml(product.category)}</td>
        <td>${escapeHtml(product.productType || (product.isCabinProduct ? "Kabin ürünü" : "Ev devam ürünü"))}</td>
        <td>${escapeHtml(product.purpose || product.usagePurpose)}</td>
        <td>${escapeHtml(product.time || product.usageTime)}</td>
        <td><span class="status ${product.status === "Pasif" ? "inactive" : ""}">${escapeHtml(product.status)}</span></td>
        <td><button class="table-action muted-action" type="button" data-edit-product="${escapeHtml(product.id)}">Düzenle</button></td>
      </tr>
    `;
  }

  function productSearchHaystack(product) {
    return [
      product.name,
      product.brand,
      product.category,
      product.productType,
      product.purpose,
      product.usagePurpose,
      product.time,
      product.usageTime,
      product.status,
    ]
      .map(normalizeSearchText)
      .join(" ");
  }

  function filteredFirmProducts() {
    const query = normalizeSearchText(firmProductState.query).trim();
    if (!query) return firmProductState.products;
    return firmProductState.products.filter((product) => productSearchHaystack(product).includes(query));
  }

  function filteredAdminProducts() {
    const query = normalizeSearchText(adminProductState.query).trim();
    if (!query) return adminProductState.products;
    return adminProductState.products.filter((product) => productSearchHaystack(product).includes(query));
  }

  async function loadFirmProducts() {
    if (currentPath() !== "/firm") return;
    const tbody = document.querySelector("#firm-products-table-body");
    const count = document.querySelector("#firm-products-count");
    if (!tbody) return;

    try {
      const response = await fetch("/api/firm/products");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Firma ürünleri alınamadı.");
      const products = payload.products || [];
      firmProductState.products = products;
      renderFirmProducts();
    } catch (error) {
      if (count) count.textContent = "Hata";
      tbody.innerHTML = `<tr><td colspan="8">${escapeHtml(error instanceof Error ? error.message : "Firma ürünleri alınamadı.")}</td></tr>`;
    }
  }

  function renderFirmProducts() {
    const tbody = document.querySelector("#firm-products-table-body");
    const count = document.querySelector("#firm-products-count");
    if (!tbody) return;
    const products = filteredFirmProducts();
    if (count) {
      count.textContent = firmProductState.query
        ? `${products.length} / ${firmProductState.products.length} ürün`
        : `${firmProductState.products.length} ürün`;
    }
    tbody.innerHTML = products.length
      ? products.map(firmProductRow).join("")
      : '<tr><td colspan="8">Aramanıza uygun ürün bulunamadı.</td></tr>';
    bindProductEditButtons("firm");
  }

  function fillProductEditForm(form, product) {
    if (!form || !product) return;
    form.elements.id.value = product.id || "";
    form.elements.name.value = product.name || "";
    form.elements.brand.value = product.brand || "";
    form.elements.category.value = product.category || "";
    form.elements.usagePurpose.value = product.purpose || product.usagePurpose || "";
    form.elements.usageTime.value = product.time || product.usageTime || "";
    form.elements.status.value = product.status || "Aktif";
    form.elements.isCabinProduct.checked = Boolean(product.isCabinProduct);
  }

  function productEditPayload(form) {
    const formData = new FormData(form);
    return {
      name: formData.get("name") || "",
      brand: formData.get("brand") || "",
      category: formData.get("category") || "",
      usagePurpose: formData.get("usagePurpose") || "",
      usageTime: formData.get("usageTime") || "",
      status: formData.get("status") || "Aktif",
      isCabinProduct: formData.get("isCabinProduct") === "on",
    };
  }

  function bindProductEditButtons(scope) {
    document.querySelectorAll("[data-edit-product]").forEach((button) => {
      if (button.dataset.boundProductEdit === "true") return;
      button.dataset.boundProductEdit = "true";
      button.addEventListener("click", () => {
        const products = scope === "admin" ? adminProductState.products : firmProductState.products;
        const product = products.find((item) => item.id === button.dataset.editProduct);
        const form = document.querySelector(`#${scope}-product-edit-form`);
        const modal = document.querySelector(`#${scope}-product-edit-modal`);
        fillProductEditForm(form, product);
        if (modal) modal.hidden = false;
      });
    });
  }

  function bindProductEditModal(scope) {
    const modal = document.querySelector(`#${scope}-product-edit-modal`);
    const form = document.querySelector(`#${scope}-product-edit-form`);
    const message = document.querySelector(`#${scope}-product-edit-form-message`);
    const closeModal = () => {
      if (modal) modal.hidden = true;
    };

    document.querySelectorAll("[data-close-product-edit-modal]").forEach((button) => {
      if (button.dataset[`bound${scope}ProductClose`] === "true") return;
      button.dataset[`bound${scope}ProductClose`] = "true";
      button.addEventListener("click", closeModal);
    });

    if (modal && modal.dataset.boundProductBackdrop !== "true") {
      modal.dataset.boundProductBackdrop = "true";
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
    }

    if (!form || form.dataset.boundProductEditSubmit === "true") return;
    form.dataset.boundProductEditSubmit = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const productId = form.elements.id.value;
      const button = form.querySelector('button[type="submit"]');
      if (message) {
        message.hidden = true;
        message.classList.remove("error-message");
      }

      try {
        if (button) button.disabled = true;
        const endpoint = scope === "admin"
          ? `/api/admin/products/${encodeURIComponent(productId)}`
          : `/api/firm/products/${encodeURIComponent(productId)}`;
        const response = await fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productEditPayload(form)),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Ürün güncellenemedi.");
        closeModal();
        if (scope === "admin") await loadAdminProducts();
        else await loadFirmProducts();
      } catch (error) {
        if (message) {
          message.textContent = error instanceof Error ? error.message : "Ürün güncellenemedi.";
          message.classList.add("error-message");
          message.hidden = false;
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function bindFirmProductsPage() {
    if (currentPath() !== "/firm") return;
    loadFirmProducts();
    bindProductEditModal("firm");

    const search = document.querySelector("#firm-products-search");
    if (search && search.dataset.boundFirmProductSearch !== "true") {
      search.dataset.boundFirmProductSearch = "true";
      search.value = firmProductState.query;
      search.addEventListener("input", () => {
        firmProductState.query = search.value || "";
        renderFirmProducts();
      });
    }

    const form = document.querySelector("#firm-product-import-form");
    if (!form || form.dataset.boundFirmImport === "true") return;
    form.dataset.boundFirmImport = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = document.querySelector("#firm-import-message");
      const button = form.querySelector("button[type='submit']");
      const formData = new FormData(form);

      if (message) message.hidden = true;
      try {
        if (button) button.disabled = true;
        const response = await fetch("/api/firm/products/import", {
          method: "POST",
          body: formData,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Ürünler yüklenemedi.");
        form.reset();
        if (message) {
          message.textContent = payload.message || "Ürünler başarıyla yüklendi.";
          message.classList.remove("error-message");
          message.hidden = false;
        }
        await loadFirmProducts();
      } catch (error) {
        if (message) {
          message.textContent = error instanceof Error ? error.message : "Ürünler yüklenemedi.";
          message.classList.add("error-message");
          message.hidden = false;
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  async function loadAdminProducts() {
    if (currentPath() !== "/admin/products") return;
    const tbody = document.querySelector("#admin-products-table-body");
    const count = document.querySelector("#admin-products-count");
    if (!tbody) return;

    try {
      const response = await fetch("/api/admin/products");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Ürünler alınamadı.");
      const products = payload.products || [];
      adminProductState.products = products;
      adminProductState.page = Math.min(adminProductState.page, Math.max(1, Math.ceil(products.length / PRODUCT_PAGE_SIZE)));
      renderAdminProducts();
    } catch (error) {
      if (count) count.textContent = "Hata";
      tbody.innerHTML = `<tr><td colspan="8">${escapeHtml(error instanceof Error ? error.message : "Ürünler alınamadı.")}</td></tr>`;
    }
  }

  function renderAdminProducts() {
    const tbody = document.querySelector("#admin-products-table-body");
    const count = document.querySelector("#admin-products-count");
    const pagination = document.querySelector("#admin-products-pagination");
    if (!tbody) return;

    const products = filteredAdminProducts();
    const totalPages = Math.max(1, Math.ceil(products.length / PRODUCT_PAGE_SIZE));
    adminProductState.page = Math.min(Math.max(adminProductState.page, 1), totalPages);
    if (count) {
      count.textContent = adminProductState.query
        ? `${products.length} / ${adminProductState.products.length} ürün`
        : `${adminProductState.products.length} ürün`;
    }

    if (!adminProductState.products.length) {
      tbody.innerHTML = '<tr><td colspan="8">Henüz global ürün yüklenmedi.</td></tr>';
      if (pagination) pagination.innerHTML = "";
      return;
    }

    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="8">Aramanıza uygun ürün bulunamadı.</td></tr>';
      if (pagination) pagination.innerHTML = "";
      return;
    }

    const start = (adminProductState.page - 1) * PRODUCT_PAGE_SIZE;
    tbody.innerHTML = products.slice(start, start + PRODUCT_PAGE_SIZE).map(firmProductRow).join("");
    bindProductEditButtons("admin");

    if (!pagination) return;
    if (products.length <= PRODUCT_PAGE_SIZE) {
      pagination.innerHTML = "";
      return;
    }

    const buttons = Array.from({ length: totalPages }, (_, index) => index + 1)
      .map((page) => `<button class="pagination-button ${page === adminProductState.page ? "active" : ""}" type="button" data-admin-product-page="${page}">${page}</button>`)
      .join("");

    pagination.innerHTML = `
      <button class="pagination-button" type="button" data-admin-product-page="${adminProductState.page - 1}" ${adminProductState.page === 1 ? "disabled" : ""}>Önceki</button>
      <div class="pagination-pages">${buttons}</div>
      <button class="pagination-button" type="button" data-admin-product-page="${adminProductState.page + 1}" ${adminProductState.page === totalPages ? "disabled" : ""}>Sonraki</button>
    `;

    pagination.querySelectorAll("[data-admin-product-page]").forEach((button) => {
      button.addEventListener("click", () => {
        adminProductState.page = Number(button.dataset.adminProductPage);
        renderAdminProducts();
      });
    });
  }

  function bindAdminProductsPage() {
    if (currentPath() !== "/admin/products") return;
    loadAdminProducts();
    bindProductEditModal("admin");

    const search = document.querySelector("#admin-products-search");
    if (search && search.dataset.boundAdminProductSearch !== "true") {
      search.dataset.boundAdminProductSearch = "true";
      search.value = adminProductState.query;
      search.addEventListener("input", () => {
        adminProductState.query = search.value || "";
        adminProductState.page = 1;
        renderAdminProducts();
      });
    }

    const form = document.querySelector("#admin-product-import-form");
    if (!form || form.dataset.boundAdminImport === "true") return;
    form.dataset.boundAdminImport = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = document.querySelector("#admin-product-import-message");
      const button = form.querySelector("button[type='submit']");
      const formData = new FormData(form);

      if (message) {
        message.hidden = true;
        message.classList.remove("error-message");
      }

      try {
        if (button) button.disabled = true;
        const response = await fetch("/api/admin/products/import", {
          method: "POST",
          body: formData,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Ürünler yüklenemedi.");
        form.reset();
        if (message) {
          message.textContent = payload.message || "Ürünler başarıyla yüklendi.";
          message.classList.remove("error-message");
          message.hidden = false;
        }
        adminProductState.page = 1;
        await loadAdminProducts();
      } catch (error) {
        if (message) {
          message.textContent = error instanceof Error ? error.message : "Ürünler yüklenemedi.";
          message.classList.add("error-message");
          message.hidden = false;
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function firmSalonRow(salon) {
    return `
      <tr>
        <td>${escapeHtml(salon.name)}</td>
        <td>${escapeHtml(salon.ownerName)}</td>
        <td>${escapeHtml(salon.email)}</td>
        <td>${escapeHtml(salon.phone)}</td>
        <td>${escapeHtml(salon.city)}</td>
        <td>${escapeHtml(salon.createdBy || "-")}</td>
      </tr>
    `;
  }

  async function loadFirmSalons() {
    if (currentPath() !== "/firm/salons") return;
    const tbody = document.querySelector("#firm-salons-table-body");
    const count = document.querySelector("#firm-salons-count");
    if (!tbody) return;

    try {
      const response = await fetch("/api/firm/salons");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Salonlar alınamadı.");
      const salons = payload.salons || [];
      if (count) count.textContent = `${salons.length} salon`;
      tbody.innerHTML = salons.length ? salons.map(firmSalonRow).join("") : '<tr><td colspan="6">Henüz salon eklenmedi.</td></tr>';
    } catch (error) {
      if (count) count.textContent = "Hata";
      tbody.innerHTML = `<tr><td colspan="6">${escapeHtml(error instanceof Error ? error.message : "Salonlar alınamadı.")}</td></tr>`;
    }
  }

  function bindFirmSalonsPage() {
    if (currentPath() !== "/firm/salons") return;
    loadFirmSalons();
    const form = document.querySelector("#firm-salon-form");
    if (!form || form.dataset.boundFirmSalon === "true") return;
    form.dataset.boundFirmSalon = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = document.querySelector("#firm-salon-message");
      const button = form.querySelector("button[type='submit']");
      const formData = new FormData(form);
      if (message) message.hidden = true;

      try {
        if (button) button.disabled = true;
        const response = await fetch("/api/firm/salons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.get("name") || "",
            ownerName: formData.get("ownerName") || "",
            email: formData.get("email") || "",
            phone: formData.get("phone") || "",
            city: formData.get("city") || "",
            address: formData.get("address") || "",
            username: formData.get("username") || "",
            password: formData.get("password") || "",
            promoCode: formData.get("promoCode") || "",
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Salon eklenemedi.");
        form.reset();
        if (message) {
          message.textContent = payload.message || "Salon başarıyla eklendi.";
          message.classList.remove("error-message");
          message.hidden = false;
        }
        await loadFirmSalons();
      } catch (error) {
        if (message) {
          message.textContent = error instanceof Error ? error.message : "Salon eklenemedi.";
          message.classList.add("error-message");
          message.hidden = false;
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function firmPromoRow(item) {
    return `
      <tr>
        <td><strong>${escapeHtml(item.code)}</strong></td>
        <td>${escapeHtml(item.packageName)}</td>
        <td>${escapeHtml(item.monthlyLimit)}</td>
        <td>${escapeHtml(item.userLimit || "Sınırsız")}</td>
        <td><span class="status ${item.status === "Aktif" ? "" : "inactive"}">${escapeHtml(item.status)}</span></td>
        <td>${escapeHtml(item.usedBySalonName || "-")}</td>
        <td>${formatCustomerDate(item.createdAt)}</td>
      </tr>
    `;
  }

  function firmPackageCard(pack, balance) {
    const canGenerate = Number(balance.remaining || 0) >= Number(pack.analysisLimit || 0);
    return `
      <article class="panel package-comparison-card">
        <div class="section-title"><h2>${escapeHtml(pack.name)}</h2><span class="status">${escapeHtml(pack.analysisLimitLabel)}</span></div>
        <strong>${escapeHtml(pack.price)}</strong>
        <p>${escapeHtml(pack.userLimit)}</p>
        <p class="muted">Kod üretildiğinde firma bakiyesinden ${escapeHtml(pack.analysisLimit)} analiz düşer.</p>
        <button class="button ${canGenerate ? "" : "secondary disabled-button"}" type="button" data-generate-promo="${escapeHtml(pack.name)}" ${canGenerate ? "" : "disabled"}>
          ${canGenerate ? "Promosyon kodu üret" : "Bakiye yetersiz"}
        </button>
      </article>
    `;
  }

  async function loadFirmPromotions() {
    if (currentPath() !== "/firm/packages") return;
    const balanceRoot = document.querySelector("#firm-promo-balance");
    const packageGrid = document.querySelector("#firm-package-grid");
    const tbody = document.querySelector("#firm-promo-table-body");
    const count = document.querySelector("#firm-promo-count");
    const message = document.querySelector("#firm-promo-message");

    try {
      const response = await fetch("/api/firm/promotions");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Paket bilgileri alınamadı.");
      const balance = payload.balance || { totalPurchased: 0, usedByPromo: 0, remaining: 0 };
      const promoCodes = payload.promoCodes || [];
      const packages = payload.packages || [];

      if (balanceRoot) {
        balanceRoot.innerHTML = `
          <article class="stat-card"><span>Satın alınan analiz</span><strong>${escapeHtml(balance.totalPurchased)}</strong></article>
          <article class="stat-card"><span>Kodlara ayrılan analiz</span><strong>${escapeHtml(balance.usedByPromo)}</strong></article>
          <article class="stat-card"><span>Kalan analiz bakiyesi</span><strong>${escapeHtml(balance.remaining)}</strong></article>
        `;
      }
      if (packageGrid) packageGrid.innerHTML = packages.map((pack) => firmPackageCard(pack, balance)).join("");
      if (tbody) tbody.innerHTML = promoCodes.length ? promoCodes.map(firmPromoRow).join("") : '<tr><td colspan="7">Henüz promosyon kodu üretilmedi.</td></tr>';
      if (count) count.textContent = `${promoCodes.length} kod`;
      bindRouteLinks();
      bindFirmPromoButtons();
    } catch (error) {
      if (message) {
        message.textContent = error instanceof Error ? error.message : "Paket bilgileri alınamadı.";
        message.classList.add("error-message");
        message.hidden = false;
      }
    }
  }

  function bindFirmPromoButtons() {
    document.querySelectorAll("[data-generate-promo]").forEach((button) => {
      if (button.dataset.boundGeneratePromo === "true") return;
      button.dataset.boundGeneratePromo = "true";
      button.addEventListener("click", async () => {
        const message = document.querySelector("#firm-promo-message");
        const packageName = button.dataset.generatePromo || "";
        if (message) message.hidden = true;
        try {
          button.disabled = true;
          const response = await fetch("/api/firm/promotions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ packageName }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message || "Promosyon kodu üretilemedi.");
          if (message) {
            message.textContent = `${payload.message} Kod: ${payload.promoCode?.code || ""}`;
            message.classList.remove("error-message");
            message.hidden = false;
          }
          await loadFirmPromotions();
        } catch (error) {
          if (message) {
            message.textContent = error instanceof Error ? error.message : "Promosyon kodu üretilemedi.";
            message.classList.add("error-message");
            message.hidden = false;
          }
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function bindFirmPackagesPage() {
    if (currentPath() !== "/firm/packages") return;
    loadFirmPromotions();
    bindFirmPromoButtons();
  }

  let pendingFirmLogoUrl = "";

  function updateFirmLogoPreview(logoUrl) {
    const preview = document.querySelector("#firm-logo-preview");
    if (preview) {
      preview.innerHTML = logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Firma logosu" />` : "<span>Logo</span>";
    }
  }

  async function loadFirmSettings() {
    if (currentPath() !== "/firm/settings") return;
    const form = document.querySelector("#firm-settings-form");
    const message = document.querySelector("#firm-settings-message");
    if (!form) return;

    try {
      const response = await fetch("/api/firm/settings");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Firma bilgileri alınamadı.");
      const firm = payload.firm || {};
      pendingFirmLogoUrl = firm.logoUrl || "";
      form.elements.name.value = firm.name || "";
      form.elements.brandName.value = firm.brandName || "";
      form.elements.email.value = firm.email || "";
      form.elements.phone.value = firm.phone || "";
      form.elements.website.value = firm.website || "";
      form.elements.address.value = firm.address || "";
      updateFirmLogoPreview(pendingFirmLogoUrl);
    } catch (error) {
      if (message) {
        message.textContent = error instanceof Error ? error.message : "Firma bilgileri alınamadı.";
        message.classList.add("error-message");
        message.hidden = false;
      }
    }
  }

  function bindFirmSettingsPage() {
    if (currentPath() !== "/firm/settings") return;
    loadFirmSettings();
    const form = document.querySelector("#firm-settings-form");
    if (!form || form.dataset.boundFirmSettings === "true") return;
    form.dataset.boundFirmSettings = "true";

    const logoInput = form.elements.logo;
    if (logoInput) {
      logoInput.addEventListener("change", () => {
        const file = logoInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          pendingFirmLogoUrl = String(reader.result || "");
          updateFirmLogoPreview(pendingFirmLogoUrl);
        });
        reader.readAsDataURL(file);
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = document.querySelector("#firm-settings-message");
      const button = form.querySelector("button[type='submit']");
      const formData = new FormData(form);
      if (message) message.hidden = true;

      try {
        if (button) button.disabled = true;
        const response = await fetch("/api/firm/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.get("name") || "",
            brandName: formData.get("brandName") || "",
            email: formData.get("email") || "",
            phone: formData.get("phone") || "",
            website: formData.get("website") || "",
            address: formData.get("address") || "",
            logoUrl: pendingFirmLogoUrl,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Firma bilgileri güncellenemedi.");
        if (authUser && payload.firm) {
          authUser = {
            ...authUser,
            firmName: payload.firm.name || "",
            firmBrandName: payload.firm.brandName || "",
            firmLogoUrl: payload.firm.logoUrl || "",
          };
        }
        if (message) {
          message.textContent = payload.message || "Firma bilgileri başarıyla güncellendi.";
          message.classList.remove("error-message");
          message.hidden = false;
        }
        render();
      } catch (error) {
        if (message) {
          message.textContent = error instanceof Error ? error.message : "Firma bilgileri güncellenemedi.";
          message.classList.add("error-message");
          message.hidden = false;
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function teamRow(member) {
    return `
      <tr>
        <td>${escapeHtml(member.fullName || member.name)}</td>
        <td>${escapeHtml(member.email)}</td>
        <td>${escapeHtml(member.role)}</td>
        <td><span class="status ${member.status === "Pasif" ? "inactive" : ""}">${escapeHtml(member.status)}</span></td>
        <td><button class="table-action muted-action" type="button">Düzenle</button></td>
      </tr>
    `;
  }

  function parseUserLimitFromSubscription() {
    const label = window.CiltGPTSubscription?.currentSubscription?.userLimit || "";
    const match = String(label).match(/\d+/);
    return match ? Number(match[0]) : Infinity;
  }

  function renderTeamStats(members) {
    const target = document.querySelector("#team-stats");
    if (!target) return;

    const active = members.filter((member) => member.status === "Aktif").length;
    const managers = members.filter((member) => member.role === "Salon Yöneticisi" || member.role === "Salon Yöneticisi").length;
    const specialists = members.filter((member) => member.role === "Analiz Uzmanı" || member.role === "Analiz Uzmanı").length;

    target.innerHTML = `
      <article class="stat-card"><span>Toplam kullanıcı</span><strong>${members.length}</strong></article>
      <article class="stat-card"><span>Aktif kullanıcı</span><strong>${active}</strong></article>
      <article class="stat-card"><span>Yönetici</span><strong>${managers}</strong></article>
      <article class="stat-card"><span>Analiz uzmanı</span><strong>${specialists}</strong></article>
    `;
  }

  function roleKey(value) {
    return normalizeSearchText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replaceAll("ı", "i")
      .replaceAll("ş", "s")
      .replaceAll("ğ", "g")
      .replaceAll("ç", "c")
      .replaceAll("ö", "o")
      .replaceAll("ü", "u")
      .trim();
  }

  function renderRolePermissionCounts(members) {
    const root = document.querySelector("#role-permission-root");
    if (!root || !window.CiltGPTTeamComponents?.RolePermissionCards) return;

    const countsByKey = new Map();
    members.forEach((member) => {
      const key = roleKey(member.role);
      countsByKey.set(key, (countsByKey.get(key) || 0) + 1);
    });

    const roleCounts = {};
    window.CiltGPTTeamData.roles.forEach((role) => {
      roleCounts[role.name] = countsByKey.get(roleKey(role.name)) || 0;
    });

    root.innerHTML = window.CiltGPTTeamComponents.RolePermissionCards(window.CiltGPTTeamData.roles, roleCounts);
  }

  function updateTeamLimitState(members) {
    const userLimit = parseUserLimitFromSubscription();
    const isLimitFull = members.length >= userLimit;
    const badge = document.querySelector(".section-title .status");
    const form = document.querySelector("#invite-member-form");

    if (badge) {
      badge.textContent = `${members.length}/${userLimit}`;
      badge.classList.toggle("pending", isLimitFull);
    }

    if (form) {
      form.querySelectorAll("input, select, button").forEach((field) => {
        field.disabled = isLimitFull;
      });
    }

    teamLimitState.used = members.length;
    teamLimitState.limit = userLimit;
    teamLimitState.isFull = isLimitFull;

    return isLimitFull;
  }

  async function loadTeamFromDatabase() {
    const count = document.querySelector("#team-count");
    const tbody = document.querySelector("#team-table-body");
    const tableWrap = document.querySelector("#team-table-wrap");
    const emptyState = document.querySelector("#team-empty-state");
    const apiMessage = document.querySelector("#team-api-message");

    if (!tbody) return;

    try {
      const response = await fetch("/api/team");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Ekip listesi alınamadı.");

      const members = payload.members || [];
      renderTeamStats(members);
      renderRolePermissionCounts(members);
      updateTeamLimitState(members);
      if (count) count.textContent = `${members.length} kullanıcı`;

      if (members.length === 0) {
        if (tableWrap) tableWrap.hidden = true;
        if (emptyState) emptyState.hidden = false;
        return;
      }

      if (emptyState) emptyState.hidden = true;
      if (tableWrap) tableWrap.hidden = false;
      tbody.innerHTML = members.map(teamRow).join("");
    } catch (error) {
      if (count) count.textContent = "Hata";
      if (apiMessage) {
        apiMessage.textContent = error instanceof Error ? error.message : "Ekip listesi alınamadı.";
        apiMessage.hidden = false;
      }
    }
  }

  function bindTeamDatabasePage() {
    if (currentPath() !== "/dashboard/team") return;

    loadTeamFromDatabase();

    const modal = document.querySelector("#team-invite-modal");
    const openModal = () => {
      if (!modal) return;
      modal.hidden = false;
      const success = document.querySelector("#invite-success");
      const errorBox = document.querySelector("#invite-error");
      if (success) success.hidden = true;
      if (errorBox) {
        if (teamLimitState.isFull) {
          errorBox.innerHTML = `
            Mevcut paketiniz ${teamLimitState.limit} kullanıcı içerir. Yeni kullanıcı eklemek için paketinizi yükseltin.
            <a class="table-action muted-action" href="${toHref("/dashboard/billing")}" data-path="/dashboard/billing">Abonelik sayfasına git</a>
          `;
          errorBox.hidden = false;
          bindRouteLinks();
        } else {
          errorBox.hidden = true;
        }
      }
      document.querySelector("#invite-member-form input[name='fullName']")?.focus();
    };
    const closeModal = () => {
      if (!modal) return;
      modal.hidden = true;
    };

    document.querySelectorAll("[data-open-team-modal]").forEach((button) => {
      if (button.dataset.boundTeamModal === "true") return;
      button.dataset.boundTeamModal = "true";
      button.addEventListener("click", openModal);
    });

    document.querySelectorAll("[data-close-team-modal]").forEach((button) => {
      if (button.dataset.boundTeamModalClose === "true") return;
      button.dataset.boundTeamModalClose = "true";
      button.addEventListener("click", closeModal);
    });

    if (modal && modal.dataset.boundBackdropClose !== "true") {
      modal.dataset.boundBackdropClose = "true";
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
    }

    const form = document.querySelector("#invite-member-form");
    if (!form) return;

    if (form.dataset.boundTeamForm === "true") return;
    form.dataset.boundTeamForm = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const success = document.querySelector("#invite-success");
      const errorBox = document.querySelector("#invite-error");
      const button = form.querySelector("button[type='submit']");
      const apiMessage = document.querySelector("#team-api-message");
      const formData = new FormData(form);

      if (success) success.hidden = true;
      if (errorBox) errorBox.hidden = true;

      if (teamLimitState.isFull) {
        if (errorBox) {
          errorBox.innerHTML = `
            Mevcut paketiniz ${teamLimitState.limit} kullanıcı içerir. Yeni kullanıcı eklemek için paketinizi yükseltin.
            <a class="table-action muted-action" href="${toHref("/dashboard/billing")}" data-path="/dashboard/billing">Abonelik sayfasına git</a>
          `;
          errorBox.hidden = false;
          bindRouteLinks();
        }
        return;
      }

      try {
        if (button) button.disabled = true;
        const response = await fetch("/api/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: formData.get("fullName") || "",
            email: formData.get("email") || "",
            username: formData.get("username") || "",
            password: formData.get("password") || "",
            role: formData.get("role") || "",
          }),
        });
        const payload = await response.json();

        if (!response.ok) {
          if (payload.redirectTo && errorBox) {
            errorBox.innerHTML = `
              ${escapeHtml(payload.message || "Paket kullanıcı limitiniz doldu.")}
              <a class="table-action muted-action" href="${toHref(payload.redirectTo)}" data-path="${payload.redirectTo}">Abonelik sayfasına git</a>
            `;
            errorBox.hidden = false;
            bindRouteLinks();
            return;
          }
          throw new Error(payload.message || "Kullanıcı eklenirken bir hata oluştu.");
        }

        form.reset();
        if (success) {
          success.textContent = payload.message || "Kullanıcı başarıyla eklendi.";
          success.hidden = false;
        }
        await loadTeamFromDatabase();
        closeModal();
        if (apiMessage) {
          apiMessage.textContent = payload.message || "Kullanıcı başarıyla eklendi.";
          apiMessage.classList.remove("error-message");
          apiMessage.hidden = false;
        }
      } catch {
        if (errorBox) {
          errorBox.textContent = "Kullanıcı eklenirken bir hata oluştu.";
          errorBox.hidden = false;
        }
      } finally {
        if (button) button.disabled = false;
        loadTeamFromDatabase();
      }
    });
  }

  async function fetchSubscriptionFromDatabase() {
    const response = await fetch("/api/subscription");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Abonelik bilgisi alınamadı.");
    return payload.subscription;
  }

  function renderSubscriptionUsageCard(subscription) {
    const target = document.querySelector("#dashboard-subscription-card");
    if (!target) return;

    target.innerHTML = window.CiltGPTSubscriptionComponents.SubscriptionUsageCard(
      subscription,
      subscription.usage,
      toHref,
    );
    bindRouteLinks();
  }

  function renderBillingSummary(subscription) {
    const target = document.querySelector("#billing-subscription-root");
    if (!target) return;

    target.innerHTML = window.CiltGPTSubscriptionComponents.BillingSummary(subscription, subscription.usage);
  }

  async function fetchPackagePlansFromDatabase() {
    const endpoint = currentPath().startsWith("/admin") ? "/api/admin/package-plans" : "/api/package-plans";
    const response = await fetch(endpoint);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Paketler alınamadı.");
    window.CiltGPTSubscription.packages = payload.packages || [];
    return window.CiltGPTSubscription.packages;
  }

  async function renderPackagePlansFromDatabase() {
    const billingTarget = document.querySelector("#billing-package-comparison");
    const adminTarget = document.querySelector("#admin-package-grid");
    if (!billingTarget && !adminTarget) return;

    try {
      const packages = await fetchPackagePlansFromDatabase();
      const currentPackageId = window.CiltGPTSubscription.currentSubscription?.packageId || "";
      if (billingTarget) {
        billingTarget.innerHTML = packages
          .map((pack) => window.CiltGPTSubscriptionComponents.PackageComparisonCard(pack, currentPackageId))
          .join("");
      }
      if (adminTarget) {
        adminTarget.innerHTML = packages
          .map((pack) => window.CiltGPTAdminComponents.AdminPackageCard(pack))
          .join("");
        bindAdminPackageModals();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Paketler alınamadı.";
      if (billingTarget) billingTarget.innerHTML = `<article class="panel empty-state"><p>${escapeHtml(message)}</p></article>`;
      if (adminTarget) adminTarget.innerHTML = `<article class="panel empty-state"><p>${escapeHtml(message)}</p></article>`;
    }
  }

  function renderBillingPackageComparison(subscription) {
    const target = document.querySelector("#billing-package-comparison");
    if (!target) return;
    const currentPackageId = subscription?.packageId || "";
    target.innerHTML = window.CiltGPTSubscription.packages
      .map((pack) => window.CiltGPTSubscriptionComponents.PackageComparisonCard(pack, currentPackageId))
      .join("");
  }

  function packageFormPayload(form) {
    const formData = new FormData(form);
    return {
      id: formData.get("id") || "",
      name: formData.get("name") || "",
      slug: formData.get("slug") || "",
      monthlyPriceLabel: formData.get("monthlyPriceLabel") || "",
      monthlyPriceValue: formData.get("monthlyPriceValue") || "",
      currency: "TL",
      analysisLimit: formData.get("analysisLimit") || "",
      analysisLimitLabel: formData.get("analysisLimitLabel") || "",
      userLimit: formData.get("userLimit") || "",
      userLimitLabel: formData.get("userLimitLabel") || "",
      status: formData.get("status") || "Aktif",
      sortOrder: formData.get("sortOrder") || "0",
      features: String(formData.get("features") || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }

  function fillPackageManageForm(pack) {
    const form = document.querySelector("#admin-package-manage-form");
    if (!form || !pack) return;
    form.elements.id.value = pack.id || pack.slug || "";
    form.elements.name.value = pack.name || "";
    form.elements.slug.value = pack.slug || pack.id || "";
    form.elements.monthlyPriceLabel.value = pack.monthlyPrice || pack.price || "";
    form.elements.monthlyPriceValue.value = pack.monthlyPriceValue ?? "";
    form.elements.analysisLimit.value = pack.analysisLimit ?? "";
    form.elements.analysisLimitLabel.value = pack.analysisLimitLabel || "";
    form.elements.userLimit.value = pack.userLimitValue ?? "";
    form.elements.userLimitLabel.value = pack.userLimit || "";
    form.elements.status.value = pack.status || "Aktif";
    form.elements.sortOrder.value = pack.sortOrder ?? "";
    form.elements.features.value = Array.isArray(pack.features) ? pack.features.join("\n") : "";
  }

  function closePackageModals() {
    document.querySelectorAll("#admin-package-manage-modal, #admin-package-create-modal").forEach((modal) => {
      modal.hidden = true;
    });
  }

  async function loadAdminPromotions() {
    if (currentPath() !== "/admin/packages") return;
    const tbody = document.querySelector("#admin-promo-table-body");
    const count = document.querySelector("#admin-promo-count");
    const message = document.querySelector("#admin-promo-message");
    if (!tbody) return;

    try {
      const response = await fetch("/api/admin/promotions");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Admin promosyon kodları alınamadı.");
      const promoCodes = payload.promoCodes || [];
      tbody.innerHTML = promoCodes.length
        ? promoCodes.map(firmPromoRow).join("")
        : '<tr><td colspan="7">Henüz admin promosyon kodu üretilmedi.</td></tr>';
      if (count) count.textContent = `${promoCodes.length} kod`;
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="7">Admin promosyon kodları alınamadı.</td></tr>';
      if (count) count.textContent = "Hata";
      if (message) {
        message.textContent = error instanceof Error ? error.message : "Admin promosyon kodları alınamadı.";
        message.classList.add("error-message");
        message.hidden = false;
      }
    }
  }

  function bindAdminPackageModals() {
    if (currentPath() !== "/admin/packages") return;
    const message = document.querySelector("#admin-package-message");

    document.querySelectorAll("[data-manage-package]").forEach((button) => {
      if (button.dataset.boundPackageManage === "true") return;
      button.dataset.boundPackageManage = "true";
      button.addEventListener("click", () => {
        const pack = window.CiltGPTSubscription.packages.find((item) => item.id === button.dataset.managePackage);
        fillPackageManageForm(pack);
        const modal = document.querySelector("#admin-package-manage-modal");
        if (modal) modal.hidden = false;
      });
    });

    document.querySelectorAll("[data-admin-generate-promo]").forEach((button) => {
      if (button.dataset.boundAdminGeneratePromo === "true") return;
      button.dataset.boundAdminGeneratePromo = "true";
      button.addEventListener("click", async () => {
        const packageName = button.dataset.adminGeneratePromo || "";
        if (message) {
          message.hidden = true;
          message.classList.remove("error-message");
        }

        try {
          button.disabled = true;
          const response = await fetch("/api/admin/promotions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ packageName }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message || "Promosyon kodu üretilemedi.");
          if (message) {
            message.textContent = `${payload.message} Kod: ${payload.promoCode?.code || ""}`;
            message.classList.remove("error-message");
            message.hidden = false;
          }
          await loadAdminPromotions();
        } catch (error) {
          if (message) {
            message.textContent = error instanceof Error ? error.message : "Promosyon kodu üretilemedi.";
            message.classList.add("error-message");
            message.hidden = false;
          }
        } finally {
          button.disabled = false;
        }
      });
    });

    const createButton = document.querySelector("[data-open-package-create-modal]");
    if (createButton && createButton.dataset.boundPackageCreateOpen !== "true") {
      createButton.dataset.boundPackageCreateOpen = "true";
      createButton.addEventListener("click", () => {
        const form = document.querySelector("#admin-package-create-form");
        if (form) form.reset();
        const modal = document.querySelector("#admin-package-create-modal");
        if (modal) modal.hidden = false;
      });
    }

    document.querySelectorAll("[data-close-package-modal]").forEach((button) => {
      if (button.dataset.boundPackageClose === "true") return;
      button.dataset.boundPackageClose = "true";
      button.addEventListener("click", closePackageModals);
    });

    document.querySelectorAll("#admin-package-manage-modal, #admin-package-create-modal").forEach((modal) => {
      if (modal.dataset.boundPackageBackdrop === "true") return;
      modal.dataset.boundPackageBackdrop = "true";
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closePackageModals();
      });
    });

    const bindPackageForm = (selector, method) => {
      const form = document.querySelector(selector);
      if (!form || form.dataset.boundPackageSubmit === "true") return;
      form.dataset.boundPackageSubmit = "true";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        if (message) {
          message.hidden = true;
          message.classList.remove("error-message");
        }

        try {
          if (button) button.disabled = true;
          const response = await fetch("/api/admin/package-plans", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(packageFormPayload(form)),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message || "Paket kaydedilemedi.");
          window.CiltGPTSubscription.packages = payload.packages || [];
          closePackageModals();
          if (message) {
            message.textContent = payload.message || "Paket kaydedildi.";
            message.classList.remove("error-message");
            message.hidden = false;
          }
          await renderPackagePlansFromDatabase();
        } catch (error) {
          if (message) {
            message.textContent = error instanceof Error ? error.message : "Paket kaydedilemedi.";
            message.classList.add("error-message");
            message.hidden = false;
          }
        } finally {
          if (button) button.disabled = false;
        }
      });
    };

    bindPackageForm("#admin-package-manage-form", "PUT");
    bindPackageForm("#admin-package-create-form", "POST");
  }

  function renderMissingSubscription(target) {
    target.innerHTML = `
      <section class="panel empty-state">
        <h2>Aktif abonelik bulunamadı.</h2>
        <p>Salon hesabınız için henüz paket tanımlı değil. Promosyon kodu ile paketinizi aktifleştirebilirsiniz.</p>
      </section>
    `;
    renderBillingPackageComparison(null);
  }

  function bindBillingPromoForm() {
    if (currentPath() !== "/dashboard/billing") return;
    const form = document.querySelector("#billing-promo-form");
    if (!form || form.dataset.boundBillingPromo === "true") return;
    form.dataset.boundBillingPromo = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = document.querySelector("#billing-promo-message");
      const button = form.querySelector("button[type='submit']");
      const formData = new FormData(form);
      if (message) message.hidden = true;

      try {
        if (button) button.disabled = true;
        const response = await fetch("/api/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promoCode: formData.get("promoCode") || "" }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Promosyon kodu kullanılamadı.");
        form.reset();
        if (message) {
          message.textContent = payload.message || "Promosyon kodu başarıyla kullanıldı.";
          message.classList.remove("error-message");
          message.hidden = false;
        }
        window.CiltGPTSubscription.currentSubscription = payload.subscription;
        window.CiltGPTSubscription.usageStats = payload.subscription?.usage || {};
        if (payload.subscription) {
          renderBillingSummary(payload.subscription);
          renderBillingPackageComparison(payload.subscription);
          const dashboardTarget = document.querySelector("#dashboard-subscription-card");
          if (dashboardTarget) renderSubscriptionUsageCard(payload.subscription);
        }
      } catch (error) {
        if (message) {
          message.textContent = error instanceof Error ? error.message : "Promosyon kodu kullanılamadı.";
          message.classList.add("error-message");
          message.hidden = false;
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function renderDashboardLatestAnalyses(items) {
    const target = document.querySelector("#dashboard-latest-analyses");
    if (!target) return;

    if (!items.length) {
      target.innerHTML = '<p class="muted">Henüz analiz oluşturulmadı.</p>';
      return;
    }

    const rows = items
      .map((item) => {
        const detailPath = item.reportId ? `/dashboard/reports/${item.reportId}` : "/dashboard/reports";
        const score = item.overallScore === null || item.overallScore === undefined ? "-" : item.overallScore;
        return `
          <tr>
            <td>${escapeHtml(item.customerName)}</td>
            <td>${formatCustomerDate(item.createdAt)}</td>
            <td>${escapeHtml(item.mainConcern)}</td>
            <td>${score}</td>
            <td><span class="status ${item.status === "COMPLETED" ? "" : "pending"}">${formatAnalysisStatus(item.status)}</span></td>
            <td><a class="table-action" href="${toHref(detailPath)}" data-path="${detailPath}">Detay</a></td>
          </tr>
        `;
      })
      .join("");

    target.innerHTML = `
      <div class="table-wrap compact-table">
        <table>
          <thead><tr><th>Müşteri</th><th>Tarih</th><th>Ana şikayet</th><th>Skor</th><th>Durum</th><th>İşlem</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    bindRouteLinks();
  }

  function renderDashboardLatestCustomers(items) {
    const target = document.querySelector("#dashboard-latest-customers");
    if (!target) return;

    if (!items.length) {
      target.innerHTML = '<p class="muted">Henüz müşteri kaydı yok.</p>';
      return;
    }

    const rows = items
      .map((item) => {
        const detailPath = `/dashboard/customers/${item.id}`;
        return `
          <tr>
            <td>${escapeHtml(item.fullName)}</td>
            <td>${escapeHtml(item.phone)}</td>
            <td>${formatCustomerDate(item.createdAt)}</td>
            <td><a class="table-action" href="${toHref(detailPath)}" data-path="${detailPath}">Detay</a></td>
          </tr>
        `;
      })
      .join("");

    target.innerHTML = `
      <div class="table-wrap compact-table">
        <table>
          <thead><tr><th>Ad Soyad</th><th>Telefon</th><th>Kayıt tarihi</th><th>İşlem</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    bindRouteLinks();
  }

  async function loadDashboardFromDatabase() {
    if (currentPath() !== "/dashboard" && currentPath() !== "/") return;

    try {
      const response = await fetch("/api/dashboard");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Dashboard verileri alınamadı.");

      const total = document.querySelector("#dashboard-stat-total");
      const monthly = document.querySelector("#dashboard-stat-monthly");
      const average = document.querySelector("#dashboard-stat-average");

      if (total) total.textContent = payload.stats.totalCustomers;
      if (monthly) monthly.textContent = payload.stats.monthlyAnalyses;
      if (average) average.textContent = payload.stats.averageScore;
      renderDashboardLatestAnalyses(payload.latestAnalyses || []);
      renderDashboardLatestCustomers(payload.latestCustomers || []);
    } catch {
      renderDashboardLatestAnalyses([]);
      renderDashboardLatestCustomers([]);
    }
  }

  async function bindSubscriptionDatabasePages() {
    const path = currentPath();
    const dashboardTarget = document.querySelector("#dashboard-subscription-card");
    const billingTarget = document.querySelector("#billing-subscription-root");
    if (!dashboardTarget && !billingTarget) return;

    try {
      const subscription = await fetchSubscriptionFromDatabase();
      window.CiltGPTSubscription.currentSubscription = subscription;
      window.CiltGPTSubscription.usageStats = subscription.usage;

      if (path === "/dashboard" || path === "/") {
        renderSubscriptionUsageCard(subscription);
      }

      if (path === "/dashboard/billing") {
        renderBillingSummary(subscription);
        renderBillingPackageComparison(subscription);
        await renderPackagePlansFromDatabase();
      }
    } catch {
      if (dashboardTarget) renderMissingSubscription(dashboardTarget);
      if (billingTarget) renderMissingSubscription(billingTarget);
      if (path === "/dashboard/billing") await renderPackagePlansFromDatabase();
    }
  }

  function protocolRow(protocol) {
    return `
      <tr>
        <td>${escapeHtml(protocol.name)}</td>
        <td><button class="table-action muted-action" type="button" data-protocol-detail="${escapeHtml(protocol.id)}">Detay</button></td>
      </tr>
    `;
  }

  function filteredProtocols() {
    const query = normalizeSearchText(protocolState.query).trim();
    if (!query) return protocolState.protocols;

    return protocolState.protocols.filter((protocol) =>
      [protocol.name, protocol.frequency, protocol.controlPeriod, protocol.status, protocol.notes]
        .map(normalizeSearchText)
        .join(" ")
        .includes(query),
    );
  }

  function renderProtocolPagination(totalItems) {
    const pagination = document.querySelector("#protocols-pagination");
    if (!pagination) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / PROTOCOL_PAGE_SIZE));
    if (totalItems <= PROTOCOL_PAGE_SIZE) {
      pagination.innerHTML = "";
      return;
    }

    const buttons = Array.from({ length: totalPages }, (_, index) => {
      const page = index + 1;
      return `<button class="pagination-button ${page === protocolState.page ? "active" : ""}" type="button" data-protocol-page="${page}">${page}</button>`;
    }).join("");

    pagination.innerHTML = `
      <button class="pagination-button" type="button" data-protocol-page="${protocolState.page - 1}" ${protocolState.page === 1 ? "disabled" : ""}>Önceki</button>
      <div class="pagination-pages">${buttons}</div>
      <button class="pagination-button" type="button" data-protocol-page="${protocolState.page + 1}" ${protocolState.page === totalPages ? "disabled" : ""}>Sonraki</button>
    `;

    pagination.querySelectorAll("[data-protocol-page]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextPage = Number(button.dataset.protocolPage);
        if (!Number.isFinite(nextPage)) return;
        protocolState.page = Math.min(Math.max(nextPage, 1), totalPages);
        renderProtocols();
      });
    });
  }

  function bindProtocolDetailButtons() {
    const modal = document.querySelector("#protocol-detail-modal");
    const title = document.querySelector("#protocol-detail-title");
    const content = document.querySelector("#protocol-detail-content");
    const closeModal = () => {
      if (modal) modal.hidden = true;
    };

    document.querySelectorAll("[data-close-protocol-detail-modal]").forEach((button) => {
      if (button.dataset.boundProtocolDetailClose === "true") return;
      button.dataset.boundProtocolDetailClose = "true";
      button.addEventListener("click", closeModal);
    });

    if (modal && modal.dataset.boundProtocolDetailBackdrop !== "true") {
      modal.dataset.boundProtocolDetailBackdrop = "true";
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
    }

    document.querySelectorAll("[data-protocol-detail]").forEach((button) => {
      if (button.dataset.boundProtocolDetail === "true") return;
      button.dataset.boundProtocolDetail = "true";
      button.addEventListener("click", () => {
        const protocol = protocolState.protocols.find((item) => item.id === button.dataset.protocolDetail);
        if (!protocol || !modal || !content) return;
        if (title) title.textContent = protocol.name || "Protokol";
        content.innerHTML = `
          <div class="report-facts">
            <p><span>Protokol adı</span><strong>${escapeHtml(protocol.name)}</strong></p>
            <p><span>Seans sayısı</span><strong>${escapeHtml(protocol.sessionCount)}</strong></p>
            <p><span>Uygulama sıklığı</span><strong>${escapeHtml(protocol.frequency)}</strong></p>
            <p><span>Durum</span><strong>${escapeHtml(protocol.status)}</strong></p>
            <p><span>Not</span><strong>${escapeHtml(protocol.notes || "-")}</strong></p>
          </div>
        `;
        modal.hidden = false;
      });
    });
  }

  function renderProtocols() {
    const tbody = document.querySelector("#protocol-table-body");
    const count = document.querySelector("#protocols-count");
    if (!tbody) return;

    const protocols = filteredProtocols();
    const totalPages = Math.max(1, Math.ceil(protocols.length / PROTOCOL_PAGE_SIZE));
    protocolState.page = Math.min(Math.max(protocolState.page, 1), totalPages);
    if (count) {
      count.textContent = protocolState.query
        ? `${protocols.length} / ${protocolState.protocols.length} protokol`
        : `${protocolState.protocols.length} protokol`;
    }

    if (!protocols.length) {
      tbody.innerHTML = '<tr><td colspan="2">Arama kriterine uygun protokol bulunamadı.</td></tr>';
      renderProtocolPagination(0);
      return;
    }

    const start = (protocolState.page - 1) * PROTOCOL_PAGE_SIZE;
    tbody.innerHTML = protocols.slice(start, start + PROTOCOL_PAGE_SIZE).map(protocolRow).join("");
    renderProtocolPagination(protocols.length);
    bindProtocolDetailButtons();
  }

  async function loadProtocolsFromDatabase() {
    const apiMessage = document.querySelector("#protocols-api-message");
    const tbody = document.querySelector("#protocol-table-body");
    if (!tbody) return;

    try {
      const response = await fetch("/api/protocols");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Protokoller alınamadı.");

      protocolState.protocols = payload.protocols || [];
      renderProtocols();
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="2">Protokoller alınamadı.</td></tr>';
      if (apiMessage) {
        apiMessage.textContent = error instanceof Error ? error.message : "Protokoller alınamadı.";
        apiMessage.classList.add("error-message");
        apiMessage.hidden = false;
      }
    }
  }

  function bindProtocolsPage() {
    if (currentPath() !== "/dashboard/protocols") return;

    loadProtocolsFromDatabase();

    const search = document.querySelector("#protocol-search");
    if (search && search.dataset.boundProtocolSearch !== "true") {
      search.dataset.boundProtocolSearch = "true";
      search.addEventListener("input", () => {
        protocolState.query = search.value || "";
        protocolState.page = 1;
        renderProtocols();
      });
    }

    const modal = document.querySelector("#protocol-create-modal");
    const openButtons = document.querySelectorAll("[data-open-protocol-modal]");
    const closeButtons = document.querySelectorAll("[data-close-protocol-modal]");
    const openModal = () => {
      if (modal) modal.hidden = false;
    };
    const closeModal = () => {
      if (modal) modal.hidden = true;
    };

    openButtons.forEach((button) => {
      if (button.dataset.boundProtocolOpen === "true") return;
      button.dataset.boundProtocolOpen = "true";
      button.addEventListener("click", openModal);
    });
    closeButtons.forEach((button) => {
      if (button.dataset.boundProtocolClose === "true") return;
      button.dataset.boundProtocolClose = "true";
      button.addEventListener("click", closeModal);
    });
    if (modal && modal.dataset.boundProtocolBackdrop !== "true") {
      modal.dataset.boundProtocolBackdrop = "true";
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
    }

    const form = document.querySelector("#protocol-form");
    if (!form || form.dataset.boundProtocolForm === "true") return;
    form.dataset.boundProtocolForm = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const apiMessage = document.querySelector("#protocols-api-message");
      const button = form.querySelector("button[type='submit']");
      const formData = new FormData(form);

      try {
        if (button) button.disabled = true;
        const response = await fetch("/api/protocols", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.get("name") || "",
            sessionCount: formData.get("sessionCount") || "",
            frequency: formData.get("frequency") || "",
            controlPeriod: formData.get("controlPeriod") || "",
            status: formData.get("status") || "Aktif",
            notes: formData.get("notes") || "",
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Protokol eklenemedi.");

        form.reset();
        closeModal();
        if (apiMessage) {
          apiMessage.textContent = payload.message || "Protokol başarıyla eklendi.";
          apiMessage.classList.remove("error-message");
          apiMessage.hidden = false;
        }
        await loadProtocolsFromDatabase();
      } catch (error) {
        if (apiMessage) {
          apiMessage.textContent = error instanceof Error ? error.message : "Protokol eklenemedi.";
          apiMessage.classList.add("error-message");
          apiMessage.hidden = false;
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function renderSettingsStats(summary) {
    const target = document.querySelector("#settings-stats");
    if (!target) return;

    target.innerHTML = `
      <article class="stat-card"><span>Aktif salon</span><strong>${summary.activeSalon}</strong></article>
      <article class="stat-card"><span>Tanımlı ürün</span><strong>${summary.productCount}</strong></article>
      <article class="stat-card"><span>Rapor şablonu</span><strong>${escapeHtml(summary.reportTemplate)}</strong></article>
    `;
  }

  function fillSalonSettingsForm(salon) {
    const form = document.querySelector("#settings-form");
    if (!form) return;

    form.elements.salonName.value = salon.name || "";
    form.elements.ownerName.value = salon.ownerName || "";
    form.elements.phone.value = salon.phone || "";
    form.elements.email.value = salon.email || "";
    form.elements.city.value = salon.city || "";
    form.elements.address.value = salon.address || "";
    pendingSalonLogoUrl = salon.logoUrl || "";
    updateSalonLogoViews(pendingSalonLogoUrl);
  }

  function updateSalonLogoViews(logoUrl) {
    const sidebarLogo = document.querySelector("[data-sidebar-logo]");
    const settingsPreview = document.querySelector("#settings-logo-preview");
    const markup = logoUrl ? `<img src="${logoUrl}" alt="Salon logosu" />` : "<span>Logo</span>";

    if (sidebarLogo) sidebarLogo.innerHTML = markup;
    if (settingsPreview) settingsPreview.innerHTML = markup;
    if (window.CiltGPTSalonBranding) window.CiltGPTSalonBranding.logoUrl = logoUrl || "";
  }

  function collectSettingsFormValues(form, formData) {
    return {
      reportSalonName: String(formData.get("reportSalonName") || ""),
      logoUrl: pendingSalonLogoUrl,
      whatsapp: String(formData.get("whatsapp") || ""),
      reportFooter: String(formData.get("reportFooter") || ""),
      defaultProtocol: String(formData.get("defaultProtocol") || ""),
      defaultSessionCount: String(formData.get("defaultSessionCount") || ""),
      defaultControlPeriod: String(formData.get("defaultControlPeriod") || ""),
      activeProductsOnly: Boolean(form.elements.activeProductsOnly?.checked),
      notifyAnalysisDone: Boolean(form.elements.notifyAnalysisDone?.checked),
      notifyControlTime: Boolean(form.elements.notifyControlTime?.checked),
      notifyProductRenewal: Boolean(form.elements.notifyProductRenewal?.checked),
    };
  }

  function fillDatabaseSettingsForm(form, salon) {
    if (window.CiltGPTSalonBranding) {
      window.CiltGPTSalonBranding.reportSalonName = salon.reportSalonName || salon.name || "";
      window.CiltGPTSalonBranding.whatsapp = salon.whatsapp || "";
      window.CiltGPTSalonBranding.reportFooter = salon.reportFooter || "";
      window.CiltGPTSalonBranding.logoUrl = salon.logoUrl || "";
    }

    if (form.elements.reportSalonName) form.elements.reportSalonName.value = salon.reportSalonName || salon.name || "";
    if (form.elements.whatsapp) form.elements.whatsapp.value = salon.whatsapp || "";
    if (form.elements.reportFooter) form.elements.reportFooter.value = salon.reportFooter || "";
    if (form.elements.defaultProtocol) form.elements.defaultProtocol.value = salon.defaultProtocol || "";
    if (form.elements.defaultSessionCount) form.elements.defaultSessionCount.value = salon.defaultSessionCount || 6;
    if (form.elements.defaultControlPeriod) form.elements.defaultControlPeriod.value = salon.defaultControlPeriod || "";

    if (form.elements.activeProductsOnly) form.elements.activeProductsOnly.checked = salon.activeProductsOnly !== false;
    if (form.elements.notifyAnalysisDone) form.elements.notifyAnalysisDone.checked = salon.notifyAnalysisDone !== false;
    if (form.elements.notifyControlTime) form.elements.notifyControlTime.checked = salon.notifyControlTime !== false;
    if (form.elements.notifyProductRenewal) form.elements.notifyProductRenewal.checked = Boolean(salon.notifyProductRenewal);
  }

  function bindSalonLogoInput(form) {
    const input = form.elements.logo;
    if (!input || input.dataset.boundLogoInput === "true") return;

    input.dataset.boundLogoInput = "true";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const logoUrl = String(reader.result || "");
        pendingSalonLogoUrl = logoUrl;
        updateSalonLogoViews(logoUrl);
      });
      reader.readAsDataURL(file);
    });
  }

  async function loadSettingsFromDatabase() {
    const form = document.querySelector("#settings-form");
    const emptyState = document.querySelector("#settings-empty-state");
    const errorBox = document.querySelector("#settings-error");
    if (!form) return;

    try {
      const response = await fetch("/api/settings");
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.message || "Salon profili bulunamadı.");

      renderSettingsStats(payload.summary);
      fillSalonSettingsForm(payload.salon);
      fillDatabaseSettingsForm(form, payload.salon);
      if (emptyState) emptyState.hidden = true;
      form.hidden = false;
    } catch (error) {
      if (emptyState) emptyState.hidden = false;
      form.hidden = true;
      if (errorBox) {
        errorBox.textContent = error instanceof Error ? error.message : "Salon bilgileri güncellenirken bir hata oluştu.";
        errorBox.hidden = false;
      }
    }
  }

  function bindSettingsDatabasePage() {
    if (currentPath() !== "/dashboard/settings") return;

    loadSettingsFromDatabase();

    const form = document.querySelector("#settings-form");
    if (!form) return;
    bindSalonLogoInput(form);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const success = document.querySelector("#settings-success");
      const errorBox = document.querySelector("#settings-error");
      const button = form.querySelector("button");
      const formData = new FormData(form);

      if (success) success.hidden = true;
      if (errorBox) errorBox.hidden = true;

      try {
        if (button) button.disabled = true;
        const response = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.get("salonName") || "",
            ownerName: formData.get("ownerName") || "",
            phone: formData.get("phone") || "",
            email: formData.get("email") || "",
            city: formData.get("city") || "",
            address: formData.get("address") || "",
            ...collectSettingsFormValues(form, formData),
          }),
        });
        const payload = await response.json();

        if (!response.ok) throw new Error(payload.message || "Salon bilgileri güncellenirken bir hata oluştu.");

        fillSalonSettingsForm(payload.salon);
        fillDatabaseSettingsForm(form, payload.salon);
        if (authUser) {
          authUser = {
            ...authUser,
            salonName: payload.salon.name,
            salonLogoUrl: payload.salon.logoUrl || "",
          };
        }
        if (success) {
          success.textContent = "Ayarlar başarıyla kaydedildi.";
          success.hidden = false;
        }
      } catch {
        if (errorBox) {
          errorBox.textContent = "Salon bilgileri güncellenirken bir hata oluştu.";
          errorBox.hidden = false;
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function adminSalonRow(salon) {
    return `
      <tr>
        <td>${escapeHtml(salon.name)}</td>
        <td>${escapeHtml(salon.createdBy || "Sistem")}</td>
        <td><button class="table-action muted-action" type="button" data-admin-salon-detail="${escapeHtml(salon.id)}">İncele</button></td>
      </tr>
    `;
  }

  function adminSalonDetails(salon) {
    const details = [
      ["Salon adı", salon.name],
      ["Yetkili", salon.owner],
      ["Şehir", salon.city],
      ["Paket", salon.packageName],
      ["Durum", salon.status],
      ["Kullanıcı sayısı", salon.userCount],
      ["Bu ay analiz", salon.monthlyAnalyses],
      ["Aylık analiz limiti", salon.monthlyAnalysisLimit],
      ["Kullanılan analiz", salon.usedAnalyses],
      ["Kalan analiz", salon.remainingAnalyses],
      ["Ekleyen", salon.createdBy || "Sistem"],
    ];

    return `
      <div class="detail-grid admin-salon-detail-grid">
        ${details
          .map(
            ([label, value]) => `
              <div class="detail-item">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value ?? "-")}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function filteredAdminSalons() {
    const query = normalizeSearchText(adminSalonListState.query).trim();
    if (!query) return adminSalonListState.salons;

    return adminSalonListState.salons.filter((salon) => {
      const haystack = [salon.name, salon.createdBy]
        .map(normalizeSearchText)
        .join(" ");
      return haystack.includes(query);
    });
  }

  function bindAdminSalonDetailButtons() {
    const modal = document.querySelector("#admin-salon-detail-modal");
    const content = document.querySelector("#admin-salon-detail-content");
    const closeModal = () => {
      if (modal) modal.hidden = true;
    };

    document.querySelectorAll("[data-admin-salon-detail]").forEach((button) => {
      if (button.dataset.boundAdminSalonDetail === "true") return;
      button.dataset.boundAdminSalonDetail = "true";
      button.addEventListener("click", () => {
        const salon = adminSalonListState.salons.find((item) => item.id === button.dataset.adminSalonDetail);
        if (!salon || !modal || !content) return;
        content.innerHTML = adminSalonDetails(salon);
        modal.hidden = false;
      });
    });

    document.querySelectorAll("[data-close-admin-salon-modal]").forEach((button) => {
      if (button.dataset.boundAdminSalonClose === "true") return;
      button.dataset.boundAdminSalonClose = "true";
      button.addEventListener("click", closeModal);
    });

    if (modal && modal.dataset.boundAdminSalonBackdrop !== "true") {
      modal.dataset.boundAdminSalonBackdrop = "true";
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
    }
  }

  function renderAdminSalonList() {
    const tbody = document.querySelector("#admin-salons-table-body");
    const tableWrap = document.querySelector("#admin-salons-table-wrap");
    const emptyState = document.querySelector("#admin-salons-empty-state");
    const count = document.querySelector("#admin-salons-count");
    if (!tbody) return;

    const salons = filteredAdminSalons();
    const total = adminSalonListState.salons.length;
    if (count) count.textContent = adminSalonListState.query ? `${salons.length} / ${total} salon` : `${total} salon`;

    if (total === 0) {
      if (tableWrap) tableWrap.hidden = true;
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;
    if (tableWrap) tableWrap.hidden = false;

    tbody.innerHTML = salons.length
      ? salons.map(adminSalonRow).join("")
      : '<tr><td colspan="3">Aramanıza uygun salon bulunamadı.</td></tr>';
    bindAdminSalonDetailButtons();
  }

  function bindAdminSalonSearch() {
    const search = document.querySelector("#admin-salons-search");
    if (!search || search.dataset.boundAdminSalonSearch === "true") return;
    search.dataset.boundAdminSalonSearch = "true";
    search.value = adminSalonListState.query;
    search.addEventListener("input", () => {
      adminSalonListState.query = search.value || "";
      renderAdminSalonList();
    });
  }

  function bindAdminSalonCreateModal() {
    const modal = document.querySelector("#admin-salon-create-modal");
    const form = document.querySelector("#admin-salon-create-form");
    const message = document.querySelector("#admin-salon-create-message");
    const apiMessage = document.querySelector("#admin-salons-api-message");
    const openModal = () => {
      if (!modal) return;
      if (message) {
        message.hidden = true;
        message.classList.remove("error-message");
      }
      modal.hidden = false;
    };
    const closeModal = () => {
      if (!modal) return;
      modal.hidden = true;
    };

    document.querySelectorAll("[data-open-admin-salon-modal]").forEach((button) => {
      if (button.dataset.boundAdminSalonCreateOpen === "true") return;
      button.dataset.boundAdminSalonCreateOpen = "true";
      button.addEventListener("click", openModal);
    });

    document.querySelectorAll("[data-close-admin-salon-create-modal]").forEach((button) => {
      if (button.dataset.boundAdminSalonCreateClose === "true") return;
      button.dataset.boundAdminSalonCreateClose = "true";
      button.addEventListener("click", closeModal);
    });

    if (modal && modal.dataset.boundAdminSalonCreateBackdrop !== "true") {
      modal.dataset.boundAdminSalonCreateBackdrop = "true";
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
    }

    if (!form || form.dataset.boundAdminSalonCreateSubmit === "true") return;
    form.dataset.boundAdminSalonCreateSubmit = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);
      if (message) {
        message.hidden = true;
        message.classList.remove("error-message");
      }

      try {
        if (button) button.disabled = true;
        const response = await fetch("/api/admin/salons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.get("name") || "",
            ownerName: formData.get("ownerName") || "",
            email: formData.get("email") || "",
            phone: formData.get("phone") || "",
            city: formData.get("city") || "",
            address: formData.get("address") || "",
            username: formData.get("username") || "",
            password: formData.get("password") || "",
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Salon oluşturulurken bir hata oluştu.");

        form.reset();
        adminSalonListState.salons = payload.salons || [];
        renderAdminSalonList();
        closeModal();
        if (apiMessage) {
          apiMessage.textContent = payload.message || "Salon başarıyla oluşturuldu.";
          apiMessage.classList.remove("error-message");
          apiMessage.hidden = false;
        }
      } catch (error) {
        if (message) {
          message.textContent = error instanceof Error ? error.message : "Salon oluşturulurken bir hata oluştu.";
          message.classList.add("error-message");
          message.hidden = false;
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  async function fillAdminSalonPackageOptions() {
    const salonSelect = document.querySelector("#admin-salon-package-salon-select");
    const packageSelect = document.querySelector("#admin-salon-package-package-select");
    if (!salonSelect || !packageSelect) return;

    const adminSalons = adminSalonListState.salons.filter((salon) => salon.isAdminCreated);
    salonSelect.innerHTML =
      '<option value="">Salon seçin</option>' +
      adminSalons
        .map((salon) => `<option value="${escapeHtml(salon.id)}">${escapeHtml(salon.name)}${salon.packageName && salon.packageName !== "-" ? ` - mevcut: ${escapeHtml(salon.packageName)}` : ""}</option>`)
        .join("");

    try {
      const packages = window.CiltGPTSubscription.packages?.length
        ? window.CiltGPTSubscription.packages
        : await fetchPackagePlansFromDatabase();
      packageSelect.innerHTML =
        '<option value="">Paket seçin</option>' +
        packages
          .map((pack) => `<option value="${escapeHtml(pack.name)}">${escapeHtml(pack.name)} - ${escapeHtml(pack.analysisLimitLabel || pack.analysisLimit)}</option>`)
          .join("");
    } catch {
      packageSelect.innerHTML = '<option value="">Paketler alınamadı</option>';
    }
  }

  function bindAdminSalonPackageModal() {
    const modal = document.querySelector("#admin-salon-package-modal");
    const form = document.querySelector("#admin-salon-package-form");
    const message = document.querySelector("#admin-salon-package-message");
    const apiMessage = document.querySelector("#admin-salons-api-message");
    const openModal = () => {
      if (!modal) return;
      if (message) {
        message.hidden = true;
        message.classList.remove("error-message");
      }
      fillAdminSalonPackageOptions();
      modal.hidden = false;
    };
    const closeModal = () => {
      if (modal) modal.hidden = true;
    };

    document.querySelectorAll("[data-open-admin-salon-package-modal]").forEach((button) => {
      if (button.dataset.boundAdminSalonPackageOpen === "true") return;
      button.dataset.boundAdminSalonPackageOpen = "true";
      button.addEventListener("click", openModal);
    });

    document.querySelectorAll("[data-close-admin-salon-package-modal]").forEach((button) => {
      if (button.dataset.boundAdminSalonPackageClose === "true") return;
      button.dataset.boundAdminSalonPackageClose = "true";
      button.addEventListener("click", closeModal);
    });

    if (modal && modal.dataset.boundAdminSalonPackageBackdrop !== "true") {
      modal.dataset.boundAdminSalonPackageBackdrop = "true";
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
    }

    if (!form || form.dataset.boundAdminSalonPackageSubmit === "true") return;
    form.dataset.boundAdminSalonPackageSubmit = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);
      if (message) {
        message.hidden = true;
        message.classList.remove("error-message");
      }

      try {
        if (button) button.disabled = true;
        const response = await fetch("/api/admin/salon-package", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salonId: formData.get("salonId") || "",
            packageName: formData.get("packageName") || "",
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Paket tanımlanamadı.");

        adminSalonListState.salons = payload.salons || [];
        renderAdminSalonList();
        closeModal();
        if (apiMessage) {
          apiMessage.textContent = payload.message || "Paket tanımlandı.";
          apiMessage.classList.remove("error-message");
          apiMessage.hidden = false;
        }
      } catch (error) {
        if (message) {
          message.textContent = error instanceof Error ? error.message : "Paket tanımlanamadı.";
          message.classList.add("error-message");
          message.hidden = false;
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function adminSalonTable(salons) {
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Salon adı</th><th>Ekleyen</th><th>İşlem</th></tr></thead>
          <tbody>${salons.map(adminSalonRow).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function adminAnalysisTable(analyses) {
    if (!analyses.length) {
      return '<div class="empty-state"><h2>Hen&uuml;z analiz kayd&#305; yok.</h2><p>Analizler olu&#351;turuldu&#287;unda burada g&ouml;r&uuml;nt&uuml;lenecek.</p></div>';
    }

    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Analiz ID</th><th>Salon</th><th>M&uuml;&#351;teri</th><th>Tarih</th><th>Durum</th><th>Skor</th><th>&#304;&#351;lem</th></tr></thead>
          <tbody>
            ${analyses
              .map(
                (analysis) => `
                  <tr>
                    <td>${escapeHtml(analysis.id)}</td>
                    <td>${escapeHtml(analysis.salon)}</td>
                    <td>${escapeHtml(analysis.customer)}</td>
                    <td>${formatCustomerDate(analysis.date)}</td>
                    <td><span class="status ${analysis.status === "Bekliyor" ? "pending" : ""}">${escapeHtml(analysis.status)}</span></td>
                    <td>${escapeHtml(analysis.score)}</td>
                    <td><button class="table-action muted-action" type="button">&#304;ncele</button></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function adminAnalysisRow(analysis) {
    return `
      <tr>
        <td><span class="status ${analysis.status === "Bekliyor" ? "pending" : ""}">${escapeHtml(analysis.status)}</span></td>
        <td>${escapeHtml(analysis.salon)}</td>
        <td>${escapeHtml(analysis.firm || "Sistem")}</td>
        <td><button class="table-action muted-action" type="button" data-admin-analysis-detail="${escapeHtml(analysis.id)}">Detay</button></td>
        <td>
          ${
            analysis.reportId
              ? `<a class="table-action" href="${toHref(`/admin/reports/${analysis.reportId}`)}" data-path="/admin/reports/${escapeHtml(analysis.reportId)}">Rapor</a>`
              : '<button class="table-action muted-action" type="button" disabled>Rapor yok</button>'
          }
        </td>
      </tr>
    `;
  }

  function adminAnalysisDetails(analysis) {
    const details = [
      ["Analiz ID", analysis.id],
      ["Rapor ID", analysis.reportId || "-"],
      ["Salon adı", analysis.salon],
      ["Firma adı", analysis.firm || "Sistem"],
      ["Müşteri", analysis.customer],
      ["Tarih", formatCustomerDate(analysis.date)],
      ["Durum", analysis.status],
      ["Skor", analysis.score],
      ["Cilt tipi", analysis.skinType],
      ["Ana şikayet", analysis.mainConcern],
    ];

    return `
      <div class="detail-grid">
        ${details
          .map(
            ([label, value]) => `
              <div class="detail-item">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value ?? "-")}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function filteredAdminAnalyses() {
    const query = normalizeSearchText(adminAnalysisState.query).trim();
    if (!query) return adminAnalysisState.analyses;
    return adminAnalysisState.analyses.filter((analysis) =>
      [analysis.status, analysis.salon, analysis.firm, analysis.customer, analysis.id]
        .map(normalizeSearchText)
        .join(" ")
        .includes(query),
    );
  }

  function bindAdminAnalysisDetailButtons() {
    const modal = document.querySelector("#admin-analysis-detail-modal");
    const content = document.querySelector("#admin-analysis-detail-content");
    const closeModal = () => {
      if (modal) modal.hidden = true;
    };

    document.querySelectorAll("[data-admin-analysis-detail]").forEach((button) => {
      if (button.dataset.boundAdminAnalysisDetail === "true") return;
      button.dataset.boundAdminAnalysisDetail = "true";
      button.addEventListener("click", () => {
        const analysis = adminAnalysisState.analyses.find((item) => item.id === button.dataset.adminAnalysisDetail);
        if (!analysis || !modal || !content) return;
        content.innerHTML = adminAnalysisDetails(analysis);
        modal.hidden = false;
      });
    });

    document.querySelectorAll("[data-close-admin-analysis-modal]").forEach((button) => {
      if (button.dataset.boundAdminAnalysisClose === "true") return;
      button.dataset.boundAdminAnalysisClose = "true";
      button.addEventListener("click", closeModal);
    });

    if (modal && modal.dataset.boundAdminAnalysisBackdrop !== "true") {
      modal.dataset.boundAdminAnalysisBackdrop = "true";
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
    }
  }

  function renderAdminAnalysesList() {
    const tbody = document.querySelector("#admin-analyses-table-body");
    const count = document.querySelector("#admin-analyses-count");
    if (!tbody) return;

    const analyses = filteredAdminAnalyses();
    const total = adminAnalysisState.analyses.length;
    if (count) count.textContent = adminAnalysisState.query ? `${analyses.length} / ${total} kayıt` : `${total} kayıt`;
    if (total === 0) {
      tbody.innerHTML = '<tr><td colspan="5">Henüz analiz kaydı yok.</td></tr>';
      return;
    }
    tbody.innerHTML = analyses.length
      ? analyses.map(adminAnalysisRow).join("")
      : '<tr><td colspan="5">Aramanıza uygun analiz bulunamadı.</td></tr>';
    bindAdminAnalysisDetailButtons();
    bindRouteLinks();
  }

  function bindAdminAnalysesSearch() {
    const search = document.querySelector("#admin-analyses-search");
    if (!search || search.dataset.boundAdminAnalysesSearch === "true") return;
    search.dataset.boundAdminAnalysesSearch = "true";
    search.value = adminAnalysisState.query;
    search.addEventListener("input", () => {
      adminAnalysisState.query = search.value || "";
      renderAdminAnalysesList();
    });
  }

  async function loadAdminAnalysesFromDatabase() {
    const overviewTarget = document.querySelector("#admin-overview-analyses");
    const tbody = document.querySelector("#admin-analyses-table-body");
    const message = document.querySelector("#admin-analyses-api-message");
    if (!overviewTarget && !tbody) return;

    try {
      const response = await fetch("/api/admin/analyses");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Analiz listesi alınamadı.");
      adminAnalysisState.analyses = payload.analyses || [];
      if (overviewTarget) overviewTarget.innerHTML = adminAnalysisTable(adminAnalysisState.analyses.slice(0, 3));
      if (tbody) {
        bindAdminAnalysesSearch();
        renderAdminAnalysesList();
      }
    } catch (error) {
      if (overviewTarget) {
        overviewTarget.innerHTML = `<div class="empty-state"><h2>Analiz listesi al&#305;namad&#305;.</h2><p>${escapeHtml(error instanceof Error ? error.message : "Beklenmeyen hata")}</p></div>`;
      }
      if (message) {
        message.textContent = error instanceof Error ? error.message : "Analiz listesi alınamadı.";
        message.hidden = false;
      }
    }
  }

  function renderAdminSummary(stats) {
    const root = document.querySelector("#admin-summary-root");
    if (!root) return;

    const cards = [
      ["Toplam salon", stats.totalSalons],
      ["Aktif salon", stats.activeSalons],
      ["Bu ay yapılan analiz", stats.monthlyAnalyses],
      ["Bekleyen analiz", stats.pendingAnalyses],
      ["Tamamlanan rapor", stats.completedReports],
      ["Aylık tahmini gelir", stats.estimatedRevenue],
    ];

    root.innerHTML = `
      <section class="stats-grid admin-summary-grid">
        ${cards.map(([label, value]) => `<article class="stat-card admin-stat"><span>${label}</span><strong>${value}</strong></article>`).join("")}
      </section>
    `;
  }

  async function loadAdminStatsFromDatabase() {
    const root = document.querySelector("#admin-summary-root");
    if (!root) return;

    try {
      const response = await fetch("/api/admin/stats");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Admin istatistikleri alınamadı.");
      renderAdminSummary(payload.stats);
    } catch (error) {
      root.innerHTML = `<section class="panel empty-state"><h2>Admin istatistikleri alınamadı.</h2><p>${escapeHtml(error instanceof Error ? error.message : "Beklenmeyen hata")}</p></section>`;
    }
  }

  async function loadAdminSalonsFromDatabase() {
    const tbody = document.querySelector("#admin-salons-table-body");
    const tableWrap = document.querySelector("#admin-salons-table-wrap");
    const emptyState = document.querySelector("#admin-salons-empty-state");
    const count = document.querySelector("#admin-salons-count");
    const message = document.querySelector("#admin-salons-api-message");
    const overviewTarget = document.querySelector("#admin-overview-salons");

    if (!tbody && !overviewTarget) return;

    try {
      const response = await fetch("/api/admin/salons");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Salon listesi alınamadı.");
      const salons = payload.salons || [];
      adminSalonListState.salons = salons;

      if (overviewTarget) {
        overviewTarget.innerHTML = salons.length
          ? adminSalonTable(salons.slice(0, 3))
          : '<div class="empty-state"><h2>Henüz salon bulunmuyor.</h2><p>İlk salon kaydı oluşturulduğunda burada görüntülenecek.</p></div>';
        bindAdminSalonDetailButtons();
      }

      if (!tbody) return;
      bindAdminSalonSearch();
      bindAdminSalonCreateModal();
      bindAdminSalonPackageModal();
      renderAdminSalonList();
    } catch (error) {
      if (count) count.textContent = "Hata";
      if (message) {
        message.textContent = error instanceof Error ? error.message : "Salon listesi alınamadı.";
        message.hidden = false;
      }
      if (overviewTarget) {
        overviewTarget.innerHTML = `<div class="empty-state"><h2>Salon listesi alınamadı.</h2><p>${escapeHtml(error instanceof Error ? error.message : "Beklenmeyen hata")}</p></div>`;
      }
    }
  }

  function adminFirmRow(firm) {
    return `
      <tr>
        <td>${escapeHtml(firm.name)}</td>
        <td>${escapeHtml(firm.brandName)}</td>
        <td>${escapeHtml(firm.balance?.totalPurchased ?? 0)}</td>
        <td>${escapeHtml(firm.balance?.usedByPromo ?? 0)}</td>
        <td><strong>${escapeHtml(firm.balance?.remaining ?? 0)}</strong></td>
        <td><span class="status ${firm.isActive ? "" : "inactive"}">${firm.isActive ? "Aktif" : "Pasif"}</span></td>
      </tr>
    `;
  }

  function adminSaleRow(sale) {
    return `
      <tr>
        <td>${escapeHtml(sale.firmName)}</td>
        <td>${escapeHtml(sale.quantity)}</td>
        <td>${escapeHtml(sale.unitPrice)} ${escapeHtml(sale.currency)}</td>
        <td><strong>${escapeHtml(sale.totalAmount)} ${escapeHtml(sale.currency)}</strong></td>
        <td>${escapeHtml(sale.note || "-")}</td>
        <td>${formatCustomerDate(sale.createdAt)}</td>
      </tr>
    `;
  }

  function paginateItems(items, page, pageSize) {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    return {
      page: safePage,
      totalPages,
      items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    };
  }

  function filteredAdminFirms() {
    const query = normalizeSearchText(adminFirmState.firmQuery).trim();
    if (!query) return adminFirmState.firms;
    return adminFirmState.firms.filter((firm) =>
      [firm.name, firm.brandName, firm.email, firm.phone]
        .map(normalizeSearchText)
        .join(" ")
        .includes(query),
    );
  }

  function filteredAdminSales() {
    const query = normalizeSearchText(adminFirmState.saleQuery).trim();
    if (!query) return adminFirmState.sales;
    return adminFirmState.sales.filter((sale) =>
      [sale.firmName, sale.note, sale.quantity, sale.totalAmount, formatCustomerDate(sale.createdAt)]
        .map(normalizeSearchText)
        .join(" ")
        .includes(query),
    );
  }

  function renderSimplePagination(targetId, page, totalPages, actionName) {
    const target = document.querySelector(targetId);
    if (!target) return;
    target.innerHTML = `
      <button class="table-action muted-action" type="button" data-page-action="${actionName}" data-page-direction="prev" ${page <= 1 ? "disabled" : ""}>Önceki</button>
      <span class="muted">${page} / ${totalPages}</span>
      <button class="table-action muted-action" type="button" data-page-action="${actionName}" data-page-direction="next" ${page >= totalPages ? "disabled" : ""}>Sonraki</button>
    `;

    target.querySelectorAll("[data-page-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const direction = button.dataset.pageDirection === "next" ? 1 : -1;
        if (actionName === "admin-firms") {
          adminFirmState.firmPage += direction;
          renderAdminFirmTables();
        } else {
          adminFirmState.salePage += direction;
          renderAdminFirmTables();
        }
      });
    });
  }

  function renderAdminFirmTables() {
    const firmsBody = document.querySelector("#admin-firms-table-body");
    const salesBody = document.querySelector("#admin-sales-table-body");
    const firmsCount = document.querySelector("#admin-firms-count");
    const salesCount = document.querySelector("#admin-sales-count");

    const firms = filteredAdminFirms();
    const firmPage = paginateItems(firms, adminFirmState.firmPage, ADMIN_FIRM_PAGE_SIZE);
    adminFirmState.firmPage = firmPage.page;
    if (firmsBody) {
      firmsBody.innerHTML = firmPage.items.length
        ? firmPage.items.map(adminFirmRow).join("")
        : '<tr><td colspan="6">Aramanıza uygun firma bulunamadı.</td></tr>';
    }
    if (firmsCount) firmsCount.textContent = adminFirmState.firmQuery ? `${firms.length} / ${adminFirmState.firms.length} firma` : `${adminFirmState.firms.length} firma`;
    renderSimplePagination("#admin-firms-pagination", firmPage.page, firmPage.totalPages, "admin-firms");

    const sales = filteredAdminSales();
    const salePage = paginateItems(sales, adminFirmState.salePage, ADMIN_FIRM_PAGE_SIZE);
    adminFirmState.salePage = salePage.page;
    if (salesBody) {
      salesBody.innerHTML = salePage.items.length
        ? salePage.items.map(adminSaleRow).join("")
        : '<tr><td colspan="6">Aramanıza uygun satış bulunamadı.</td></tr>';
    }
    if (salesCount) salesCount.textContent = adminFirmState.saleQuery ? `${sales.length} / ${adminFirmState.sales.length} satış` : `${adminFirmState.sales.length} satış`;
    renderSimplePagination("#admin-sales-pagination", salePage.page, salePage.totalPages, "admin-sales");
  }

  function renderAdminSaleFirmResults() {
    const results = document.querySelector("#admin-sale-firm-results");
    if (!results) return;
    const query = normalizeSearchText(adminFirmState.saleFirmQuery).trim();
    if (!query) {
      results.hidden = true;
      results.innerHTML = "";
      return;
    }

    const firms = adminFirmState.firms
      .filter((firm) => [firm.name, firm.brandName].map(normalizeSearchText).join(" ").includes(query))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "tr-TR"))
      .slice(0, 10);

    results.hidden = false;
    results.innerHTML = firms.length
      ? firms
          .map(
            (firm) => `
              <button class="customer-search-result" type="button" data-sale-firm-id="${escapeHtml(firm.id)}">
                <strong>${escapeHtml(firm.name)}</strong>
                <span>${escapeHtml(firm.brandName || "-")}</span>
                <small>Kalan ${escapeHtml(firm.balance?.remaining ?? 0)} analiz</small>
              </button>
            `,
          )
          .join("")
      : '<div class="customer-search-empty compact"><strong>Firma bulunamadı</strong><span>Farklı bir isim deneyin.</span></div>';

    results.querySelectorAll("[data-sale-firm-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const firm = adminFirmState.firms.find((item) => item.id === button.dataset.saleFirmId);
        const firmIdInput = document.querySelector("#admin-analysis-sale-form input[name='firmId']");
        const selectedFirmInput = document.querySelector("#admin-sale-selected-firm");
        const searchInput = document.querySelector("#admin-sale-firm-search");
        if (!firm || !firmIdInput || !selectedFirmInput) return;
        firmIdInput.value = firm.id;
        selectedFirmInput.value = `${firm.name} - kalan ${firm.balance?.remaining ?? 0}`;
        if (searchInput) searchInput.value = firm.name;
        results.hidden = true;
      });
    });
  }

  function openAdminFirmModal(type) {
    const modal = document.querySelector(`#admin-firm-${type}-modal`);
    if (modal) modal.hidden = false;
  }

  function closeAdminFirmModals() {
    document.querySelectorAll("#admin-firm-price-modal, #admin-firm-sale-modal, #admin-firm-create-modal").forEach((modal) => {
      modal.hidden = true;
    });
  }

  async function loadAdminFirmsFromDatabase() {
    if (currentPath() !== "/admin/firms") return;
    const unitPriceForm = document.querySelector("#admin-unit-price-form");
    const message = document.querySelector("#admin-analysis-sale-message");

    try {
      const response = await fetch("/api/admin/analysis-sales");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Firma satış bilgileri alınamadı.");
      const firms = payload.firms || [];
      const sales = payload.sales || [];
      const unitPrice = payload.unitPrice || {};
      adminFirmState.firms = firms;
      adminFirmState.sales = sales;

      if (unitPriceForm) {
        unitPriceForm.elements.pricePerAnalysis.value = unitPrice.pricePerAnalysis || "";
        unitPriceForm.elements.currency.value = unitPrice.currency || "TL";
      }
      renderAdminFirmTables();
    } catch (error) {
      if (message) {
        message.textContent = error instanceof Error ? error.message : "Firma satış bilgileri alınamadı.";
        message.classList.add("error-message");
        message.hidden = false;
      }
    }
  }

  function bindAdminFirmsPage() {
    if (currentPath() !== "/admin/firms") return;
    loadAdminFirmsFromDatabase();

    document.querySelectorAll("[data-open-admin-firm-modal]").forEach((button) => {
      if (button.dataset.boundAdminFirmOpen === "true") return;
      button.dataset.boundAdminFirmOpen = "true";
      button.addEventListener("click", () => openAdminFirmModal(button.dataset.openAdminFirmModal));
    });

    document.querySelectorAll("[data-close-admin-firm-modal]").forEach((button) => {
      if (button.dataset.boundAdminFirmClose === "true") return;
      button.dataset.boundAdminFirmClose = "true";
      button.addEventListener("click", closeAdminFirmModals);
    });

    document.querySelectorAll("#admin-firm-price-modal, #admin-firm-sale-modal, #admin-firm-create-modal").forEach((modal) => {
      if (modal.dataset.boundAdminFirmBackdrop === "true") return;
      modal.dataset.boundAdminFirmBackdrop = "true";
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeAdminFirmModals();
      });
    });

    const firmSearch = document.querySelector("#admin-firms-search");
    if (firmSearch && firmSearch.dataset.boundAdminFirmSearch !== "true") {
      firmSearch.dataset.boundAdminFirmSearch = "true";
      firmSearch.value = adminFirmState.firmQuery;
      firmSearch.addEventListener("input", () => {
        adminFirmState.firmQuery = firmSearch.value || "";
        adminFirmState.firmPage = 1;
        renderAdminFirmTables();
      });
    }

    const saleSearch = document.querySelector("#admin-sales-search");
    if (saleSearch && saleSearch.dataset.boundAdminSaleSearch !== "true") {
      saleSearch.dataset.boundAdminSaleSearch = "true";
      saleSearch.value = adminFirmState.saleQuery;
      saleSearch.addEventListener("input", () => {
        adminFirmState.saleQuery = saleSearch.value || "";
        adminFirmState.salePage = 1;
        renderAdminFirmTables();
      });
    }

    const saleFirmSearch = document.querySelector("#admin-sale-firm-search");
    if (saleFirmSearch && saleFirmSearch.dataset.boundAdminSaleFirmSearch !== "true") {
      saleFirmSearch.dataset.boundAdminSaleFirmSearch = "true";
      saleFirmSearch.addEventListener("input", () => {
        adminFirmState.saleFirmQuery = saleFirmSearch.value || "";
        const firmIdInput = document.querySelector("#admin-analysis-sale-form input[name='firmId']");
        const selectedFirmInput = document.querySelector("#admin-sale-selected-firm");
        if (firmIdInput) firmIdInput.value = "";
        if (selectedFirmInput) selectedFirmInput.value = "Firma seçilmedi";
        renderAdminSaleFirmResults();
      });
      saleFirmSearch.addEventListener("focus", () => {
        adminFirmState.saleFirmQuery = saleFirmSearch.value || "";
        renderAdminSaleFirmResults();
      });
    }

    const unitPriceForm = document.querySelector("#admin-unit-price-form");
    if (unitPriceForm && unitPriceForm.dataset.boundUnitPrice !== "true") {
      unitPriceForm.dataset.boundUnitPrice = "true";
      unitPriceForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = document.querySelector("#admin-analysis-sale-message");
        const formData = new FormData(unitPriceForm);
        if (message) message.hidden = true;
        try {
          const response = await fetch("/api/admin/analysis-unit-price", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pricePerAnalysis: formData.get("pricePerAnalysis") || "",
              currency: formData.get("currency") || "TL",
            }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message || "Fiyat kaydedilemedi.");
          if (message) {
            message.textContent = payload.message || "Fiyat kaydedildi.";
            message.classList.remove("error-message");
            message.hidden = false;
          }
          closeAdminFirmModals();
          await loadAdminFirmsFromDatabase();
        } catch (error) {
          if (message) {
            message.textContent = error instanceof Error ? error.message : "Fiyat kaydedilemedi.";
            message.classList.add("error-message");
            message.hidden = false;
          }
        }
      });
    }

    const saleForm = document.querySelector("#admin-analysis-sale-form");
    if (saleForm && saleForm.dataset.boundAnalysisSale !== "true") {
      saleForm.dataset.boundAnalysisSale = "true";
      saleForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = document.querySelector("#admin-analysis-sale-message");
        const formData = new FormData(saleForm);
        if (message) message.hidden = true;
        try {
          const response = await fetch("/api/admin/analysis-sales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              firmId: formData.get("firmId") || "",
              quantity: formData.get("quantity") || "",
              note: formData.get("note") || "",
            }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message || "Toplu satış kaydedilemedi.");
          saleForm.reset();
          const selectedFirmInput = document.querySelector("#admin-sale-selected-firm");
          if (selectedFirmInput) selectedFirmInput.value = "Firma seçilmedi";
          if (message) {
            message.textContent = payload.message || "Toplu satış kaydedildi.";
            message.classList.remove("error-message");
            message.hidden = false;
          }
          closeAdminFirmModals();
          await loadAdminFirmsFromDatabase();
        } catch (error) {
          if (message) {
            message.textContent = error instanceof Error ? error.message : "Toplu satış kaydedilemedi.";
            message.classList.add("error-message");
            message.hidden = false;
          }
        }
      });
    }

    const firmCreateForm = document.querySelector("#admin-firm-create-form");
    if (firmCreateForm && firmCreateForm.dataset.boundAdminFirmCreate !== "true") {
      firmCreateForm.dataset.boundAdminFirmCreate = "true";
      firmCreateForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = document.querySelector("#admin-analysis-sale-message");
        const formData = new FormData(firmCreateForm);
        if (message) message.hidden = true;
        try {
          const response = await fetch("/api/admin/firms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: formData.get("name") || "",
              brandName: formData.get("brandName") || "",
              email: formData.get("email") || "",
              phone: formData.get("phone") || "",
              website: formData.get("website") || "",
              address: formData.get("address") || "",
              username: formData.get("username") || "",
              password: formData.get("password") || "",
            }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message || "Firma oluşturulamadı.");
          firmCreateForm.reset();
          if (message) {
            message.textContent = payload.message || "Firma başarıyla oluşturuldu.";
            message.classList.remove("error-message");
            message.hidden = false;
          }
          closeAdminFirmModals();
          await loadAdminFirmsFromDatabase();
        } catch (error) {
          if (message) {
            message.textContent = error instanceof Error ? error.message : "Firma oluşturulamadı.";
            message.classList.add("error-message");
            message.hidden = false;
          }
        }
      });
    }
  }

  function bindAdminDatabasePages() {
    const path = currentPath();
    if (path === "/admin") {
      loadAdminStatsFromDatabase();
      loadAdminSalonsFromDatabase();
      loadAdminAnalysesFromDatabase();
    }

    if (path === "/admin/salons") {
      loadAdminSalonsFromDatabase();
    }

    if (path === "/admin/analyses") {
      loadAdminAnalysesFromDatabase();
    }

    if (path === "/admin/firms") {
      bindAdminFirmsPage();
    }

    if (path === "/admin/packages") {
      renderPackagePlansFromDatabase();
      loadAdminPromotions();
    }

    if (path === "/admin/products") {
      bindAdminProductsPage();
    }
  }

  function renderProductStats(products) {
    const target = document.querySelector("#product-stats");
    if (!target) return;

    const total = products.length;
    const active = products.filter((product) => product.status === "Aktif").length;
    const passive = products.filter((product) => product.status === "Pasif").length;
    const recommended = products.filter((product) => product.recommendedInReports).length;

    target.innerHTML = `
      <article class="stat-card product-stat-card"><span>Toplam ürün</span><strong>${total}</strong></article>
      <article class="stat-card product-stat-card"><span>Aktif ürün</span><strong>${active}</strong></article>
      <article class="stat-card product-stat-card"><span>Raporlarda önerilen ürün</span><strong>${recommended}</strong></article>
      <article class="stat-card product-stat-card"><span>Pasif ürün</span><strong>${passive}</strong></article>
    `;
  }

  async function loadProductsFromDatabase() {
    const count = document.querySelector("#products-count");
    const tbody = document.querySelector("#products-table-body");
    const tableWrap = document.querySelector("#products-table-wrap");
    const emptyState = document.querySelector("#products-empty-state");
    const apiMessage = document.querySelector("#products-api-message");

    if (!tbody) return;

    try {
      const response = await fetch("/api/products");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Ürün listesi alınamadı.");

      const products = payload.products || [];
      productListState.products = products;
      productListState.page = 1;
      renderProductStats(products);
      if (products.length === 0) {
        if (count) count.textContent = "0 ürün";
        if (tableWrap) tableWrap.hidden = true;
        if (emptyState) emptyState.hidden = false;
        return;
      }

      if (emptyState) emptyState.hidden = true;
      if (tableWrap) tableWrap.hidden = false;
      renderProductList();
    } catch (error) {
      if (count) count.textContent = "Hata";
      if (apiMessage) {
        apiMessage.textContent = error instanceof Error ? error.message : "Ürün listesi alınamadı.";
        apiMessage.hidden = false;
      }
    }
  }

  async function loadProductBrandsFromDatabase() {
    const select = document.querySelector("#product-brand-select");
    const message = document.querySelector("#product-library-message");
    if (!select) return;

    try {
      const response = await fetch("/api/product-library/brands");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Marka listesi alınamadı.");

      const brands = payload.brands || [];
      select.innerHTML = brands.length
        ? '<option value="">Marka seçin</option>' +
          brands
            .map((item) => `<option value="${escapeHtml(item.brand)}">${escapeHtml(item.brand)} (${item.count} ürün)</option>`)
            .join("")
        : '<option value="">Global kütüphanede marka yok</option>';
    } catch (error) {
      select.innerHTML = '<option value="">Markalar alınamadı</option>';
      if (message) {
        message.textContent = error instanceof Error ? error.message : "Marka listesi alınamadı.";
        message.classList.add("error-message");
        message.hidden = false;
      }
    }
  }

  function bindProductsDatabasePage() {
    if (currentPath() !== "/dashboard/products") return;

    loadProductsFromDatabase();
    loadProductBrandsFromDatabase();

    const modal = document.querySelector("#products-create-modal");
    const openModal = () => {
      if (!modal) return;
      modal.hidden = false;
      const success = document.querySelector("#product-form-success");
      const errorBox = document.querySelector("#product-form-error");
      if (success) success.hidden = true;
      if (errorBox) errorBox.hidden = true;
      document.querySelector("#product-form input[name='name']")?.focus();
    };
    const closeModal = () => {
      if (!modal) return;
      modal.hidden = true;
    };

    document.querySelectorAll("[data-open-products-modal]").forEach((button) => {
      if (button.dataset.boundProductsModal === "true") return;
      button.dataset.boundProductsModal = "true";
      button.addEventListener("click", openModal);
    });

    const searchInput = document.querySelector("#products-search");
    if (searchInput && searchInput.dataset.boundProductSearch !== "true") {
      searchInput.dataset.boundProductSearch = "true";
      searchInput.value = productListState.query;
      searchInput.addEventListener("input", () => {
        productListState.query = searchInput.value;
        productListState.page = 1;
        renderProductList();
      });
    }

    document.querySelectorAll("[data-close-products-modal]").forEach((button) => {
      if (button.dataset.boundProductsModalClose === "true") return;
      button.dataset.boundProductsModalClose = "true";
      button.addEventListener("click", closeModal);
    });

    if (modal && modal.dataset.boundBackdropClose !== "true") {
      modal.dataset.boundBackdropClose = "true";
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
    }

    const importButton = document.querySelector("[data-import-product-brand]");
    if (importButton && importButton.dataset.boundImportBrand !== "true") {
      importButton.dataset.boundImportBrand = "true";
      importButton.addEventListener("click", async () => {
        const select = document.querySelector("#product-brand-select");
        const message = document.querySelector("#product-library-message");
        const brand = select?.value || "";
        if (!brand) {
          if (message) {
            message.textContent = "Lütfen aktarılacak markayı seçin.";
            message.classList.add("error-message");
            message.hidden = false;
          }
          return;
        }

        try {
          importButton.disabled = true;
          const response = await fetch("/api/product-library/import-brand", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brand }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message || "Marka ürünleri aktarılamadı.");

          if (message) {
            message.textContent = payload.message || "Marka ürünleri salona aktarıldı.";
            message.classList.remove("error-message");
            message.hidden = false;
          }
          await loadProductsFromDatabase();
        } catch (error) {
          if (message) {
            message.textContent = error instanceof Error ? error.message : "Marka ürünleri aktarılamadı.";
            message.classList.add("error-message");
            message.hidden = false;
          }
        } finally {
          importButton.disabled = false;
        }
      });
    }

    const form = document.querySelector("#product-form");
    if (!form) return;

    if (form.dataset.boundProductForm === "true") return;
    form.dataset.boundProductForm = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const success = document.querySelector("#product-form-success");
      const errorBox = document.querySelector("#product-form-error");
      const button = form.querySelector("button[type='submit']");
      const apiMessage = document.querySelector("#products-api-message");
      const formData = new FormData(form);

      if (success) success.hidden = true;
      if (errorBox) errorBox.hidden = true;

      try {
        if (button) button.disabled = true;
        const response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.get("name") || "",
            brand: formData.get("brand") || "",
            category: formData.get("category") || "",
            usagePurpose: formData.get("purpose") || "",
            usageTime: formData.get("time") || "",
            status: formData.get("status") || "Aktif",
            isCabinProduct: formData.get("isCabinProduct") === "on",
          }),
        });
        const payload = await response.json();

        if (!response.ok) throw new Error(payload.message || "Ürün kaydedilirken bir hata oluştu.");

        form.reset();
        if (success) {
          success.textContent = payload.message || "Ürün başarıyla oluşturuldu.";
          success.hidden = false;
        }
        await loadProductsFromDatabase();
        closeModal();
        if (apiMessage) {
          apiMessage.textContent = payload.message || "Ürün başarıyla oluşturuldu.";
          apiMessage.classList.remove("error-message");
          apiMessage.hidden = false;
        }
      } catch {
        if (errorBox) {
          errorBox.textContent = "Ürün kaydedilirken bir hata oluştu.";
          errorBox.hidden = false;
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function bindReportActionButtons() {
    const previewButton = document.querySelector("[data-preview-report]");
    if (previewButton && previewButton.dataset.boundReportAction !== "true") {
      previewButton.dataset.boundReportAction = "true";
      previewButton.addEventListener("click", () => {
        document.querySelector("#report-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    const downloadButton = document.querySelector("[data-download-pdf]");
    if (downloadButton && downloadButton.dataset.boundReportAction !== "true") {
      downloadButton.dataset.boundReportAction = "true";
      downloadButton.addEventListener("click", async () => {
        const reportId = document.querySelector("#report-detail-root")?.dataset.reportId;
        const message = document.querySelector("#report-action-message");
        if (!reportId) return;

        try {
          downloadButton.disabled = true;
          const endpoint = currentPath().startsWith("/admin/reports/")
            ? `/api/admin/reports/${encodeURIComponent(reportId)}/pdf`
            : `/api/reports/${encodeURIComponent(reportId)}/pdf`;
          const response = await fetch(endpoint);
          if (!response.ok) {
            const payload = await response.json();
            throw new Error(payload.message || "PDF indirilemedi.");
          }

          const blob = await response.blob();
          const disposition = response.headers.get("Content-Disposition") || "";
          const filenameMatch = disposition.match(/filename="([^"]+)"/);
          const filename = filenameMatch?.[1] || "ciltgpt-analiz-raporu.pdf";
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
        } catch (error) {
          if (message) {
            message.textContent = error instanceof Error ? error.message : "PDF indirilemedi.";
            message.hidden = false;
          }
        } finally {
          downloadButton.disabled = false;
        }
      });
    }

    document.querySelectorAll("[data-soon-action]").forEach((button) => {
      if (button.dataset.boundReportAction === "true") return;
      button.dataset.boundReportAction = "true";
      button.addEventListener("click", () => {
        const message = document.querySelector("#report-action-message");
        if (message) {
          message.hidden = false;
          setTimeout(() => {
            message.hidden = true;
          }, 2200);
        }
      });
    });

    const photoModal = document.querySelector("#analysis-photo-modal");
    const photoModalImage = document.querySelector("#analysis-photo-modal-image");
    const photoModalTitle = document.querySelector("#analysis-photo-modal-title");
    const closePhotoModal = () => {
      if (photoModal) photoModal.hidden = true;
      if (photoModalImage) photoModalImage.removeAttribute("src");
    };

    document.querySelectorAll("[data-open-photo-modal]").forEach((button) => {
      if (button.dataset.boundPhotoModal === "true") return;
      button.dataset.boundPhotoModal = "true";
      button.addEventListener("click", () => {
        if (!photoModal || !photoModalImage) return;
        const title = button.dataset.photoTitle || "Analiz fotoğrafı";
        photoModalImage.src = button.dataset.photoSrc || "";
        photoModalImage.alt = title;
        if (photoModalTitle) photoModalTitle.textContent = title;
        photoModal.hidden = false;
      });
    });

    document.querySelectorAll("[data-close-photo-modal]").forEach((button) => {
      if (button.dataset.boundPhotoModalClose === "true") return;
      button.dataset.boundPhotoModalClose = "true";
      button.addEventListener("click", closePhotoModal);
    });

    if (photoModal && photoModal.dataset.boundPhotoModalBackdrop !== "true") {
      photoModal.dataset.boundPhotoModalBackdrop = "true";
      photoModal.addEventListener("click", (event) => {
        if (event.target === photoModal) closePhotoModal();
      });
    }
  }

  async function loadReportsFromDatabase() {
    const count = document.querySelector("#reports-count");
    const tbody = document.querySelector("#reports-table-body");
    const tableWrap = document.querySelector("#reports-table-wrap");
    const emptyState = document.querySelector("#reports-empty-state");
    const apiMessage = document.querySelector("#reports-api-message");

    if (!tbody) return;

    try {
      const response = await fetch("/api/reports");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Rapor listesi alınamadı.");

      const reports = payload.reports || [];
      reportListState.reports = reports;
      applyPendingReportCustomerSelection();

      if (reports.length === 0) {
        if (count) count.textContent = "0 rapor";
        if (tableWrap) tableWrap.hidden = true;
        if (emptyState) emptyState.hidden = false;
        return;
      }

      if (emptyState) emptyState.hidden = true;
      if (tableWrap) tableWrap.hidden = false;
      const filter = document.querySelector("#reports-customer-filter");
      if (filter) filter.hidden = false;
      renderReportCustomerResults();
      renderReportsForSelectedCustomer();
    } catch (error) {
      if (count) count.textContent = "Hata";
      if (apiMessage) {
        apiMessage.textContent = error instanceof Error ? error.message : "Rapor listesi alınamadı.";
        apiMessage.hidden = false;
      }
    }
  }

  function bindReportDeleteButtons() {
    document.querySelectorAll("[data-delete-report]").forEach((button) => {
      if (button.dataset.boundDeleteReport === "true") return;
      button.dataset.boundDeleteReport = "true";
      button.addEventListener("click", async () => {
        const reportId = button.dataset.deleteReport;
        const apiMessage = document.querySelector("#reports-api-message");
        if (!reportId) return;
        if (!window.confirm("Bu raporu silmek istediğinizden emin misiniz?")) return;

        try {
          button.disabled = true;
          const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
            method: "DELETE",
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message || "Rapor silinemedi.");

          if (apiMessage) {
            apiMessage.textContent = payload.message || "Rapor başarıyla silindi.";
            apiMessage.classList.remove("error-message");
            apiMessage.hidden = false;
          }
          await loadReportsFromDatabase();
        } catch (error) {
          if (apiMessage) {
            apiMessage.textContent = error instanceof Error ? error.message : "Rapor silinemedi.";
            apiMessage.classList.add("error-message");
            apiMessage.hidden = false;
          }
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function renderReportDetail(report) {
    const root = document.querySelector("#report-detail-root");
    if (!root) return;

    const {
      ReportSummary,
      ScoreCards,
      ProtocolCard,
      ProductRecommendationCard,
      ReportPreview,
      AnalysisPhotoGallery,
    } = window.CiltGPTReportComponents;
    const { protocol, aiComment } = window.CiltGPTReports;
    const branding = report.salonBranding || window.CiltGPTSalonBranding;
    const reportAiComment = report.aiComment || aiComment;
    const reportProtocol = report.recommendedProtocol || protocol;
    const products =
      Array.isArray(report.recommendedProducts) && report.recommendedProducts.length
        ? report.recommendedProducts
        : window.CiltGPTProductRecommendations;
    const rawAiResponseText = report.rawAiResponse
      ? escapeHtml(JSON.stringify(report.rawAiResponse, null, 2))
      : "Bu rapor oluşturulurken ham OpenAI cevabı henüz saklanmamış.";

    root.innerHTML = `
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
            <p><span>Cilt tipi</span><strong>${escapeHtml(report.skinType)}</strong></p>
            <p><span>Ana şikayet</span><strong>${escapeHtml(report.complaint)}</strong></p>
            <p><span>Salon notu</span><strong>${escapeHtml(report.salonNote || reportProtocol.salonNote)}</strong></p>
          </div>
        </article>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Ev devam ürünleri</h2></div>
        <div class="product-card-grid">
          ${products.map((product) => ProductRecommendationCard(product)).join("")}
        </div>
      </section>
      ${AnalysisPhotoGallery(report.analysisPhotos)}
      <section class="panel raw-ai-response-panel">
        <div class="section-title"><h2>Ham OpenAI cevabı</h2><span class="muted">Geçici kontrol alanı</span></div>
        <pre class="raw-ai-response">${rawAiResponseText}</pre>
      </section>
      ${ReportPreview(report, { ...reportProtocol, salonNote: report.salonNote || reportProtocol.salonNote }, products, branding, reportAiComment)}
    `;
    bindReportActionButtons();
  }

  async function loadReportDetailFromDatabase() {
    const root = document.querySelector("#report-detail-root");
    const apiMessage = document.querySelector("#report-detail-api-message");
    if (!root) return;

    const reportId = root.dataset.reportId;
    try {
      const endpoint = currentPath().startsWith("/admin/reports/")
        ? `/api/admin/reports/${encodeURIComponent(reportId)}`
        : `/api/reports/${encodeURIComponent(reportId)}`;
      const response = await fetch(endpoint);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Rapor bulunamadı.");
      renderReportDetail(payload.report);
    } catch (error) {
      root.innerHTML = '<section class="panel empty-state"><h2>Rapor bulunamadı.</h2><p>Rapor silinmiş veya henüz oluşturulmamış olabilir.</p></section>';
      if (apiMessage) {
        apiMessage.textContent = error instanceof Error ? error.message : "Rapor bulunamadı.";
        apiMessage.hidden = false;
      }
    }
  }

  function bindReportsDatabasePages() {
    const path = currentPath();
    if (path === "/dashboard/reports") {
      loadReportsFromDatabase();
      const search = document.querySelector("#reports-customer-search");
      if (search && search.dataset.boundReportCustomerSearch !== "true") {
        search.dataset.boundReportCustomerSearch = "true";
        search.value = reportListState.query;
        search.addEventListener("input", () => {
          reportListState.query = search.value;
          reportListState.selectedCustomerId = "";
          reportListState.selectedCustomerName = "";
          renderReportCustomerResults();
          renderReportsForSelectedCustomer();
        });
        search.addEventListener("focus", () => {
          renderReportCustomerResults();
        });
      }
    }

    if (path.startsWith("/dashboard/reports/") || path.startsWith("/admin/reports/")) {
      bindReportActionButtons();
      loadReportDetailFromDatabase();
    }
  }

  async function loadCustomersFromDatabase() {
    const count = document.querySelector("#customers-count");
    const tbody = document.querySelector("#customers-table-body");
    const tableWrap = document.querySelector("#customers-table-wrap");
    const emptyState = document.querySelector("#customers-empty-state");
    const apiMessage = document.querySelector("#customers-api-message");

    if (!tbody) return;

    if (isFileMode) {
      if (apiMessage) {
        apiMessage.textContent = "Veritabanı bağlantısı için uygulamayı localhost üzerinden açın.";
        apiMessage.hidden = false;
      }
      return;
    }

    try {
      const response = await fetch("/api/customers");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Müşteri listesi alınamadı.");
      }

      const customers = payload.customers || [];
      customerListState.customers = customers;
      customerListState.page = 1;

      if (customers.length === 0) {
        if (count) count.textContent = "0 kayıt";
        if (tableWrap) tableWrap.hidden = true;
        if (emptyState) emptyState.hidden = false;
        return;
      }

      if (emptyState) emptyState.hidden = true;
      if (tableWrap) tableWrap.hidden = false;
      renderCustomerList();
    } catch (error) {
      if (count) count.textContent = "Hata";
      if (apiMessage) {
        apiMessage.textContent = error instanceof Error ? error.message : "Müşteri listesi alınamadı.";
        apiMessage.hidden = false;
      }
    }
  }

  function customerAnalysisRows(reports) {
    if (!reports.length) {
      return '<tr><td colspan="6">Hen&uuml;z analiz raporu yok.</td></tr>';
    }

    return reports
      .map(
        (report) => `
          <tr>
            <td>${escapeHtml(report.id)}</td>
            <td>${formatCustomerDate(report.date)}</td>
            <td>${escapeHtml(report.overallScore)}</td>
            <td>${escapeHtml(report.mainConcern)}</td>
            <td><span class="status">${escapeHtml(report.status)}</span></td>
            <td><a class="table-action" href="${toHref(`/dashboard/reports/${report.id}`)}" data-path="/dashboard/reports/${report.id}">Detay</a></td>
          </tr>
        `,
      )
      .join("");
  }

  function renderCustomerDetail(customer) {
    const root = document.querySelector("#customer-detail-root");
    const whatsapp = document.querySelector("#customer-whatsapp-message");
    if (!root) return;

    if (whatsapp) whatsapp.textContent = customer.whatsappMessage;

    root.innerHTML = `
      <section class="panel">
        <div class="section-title"><h2>M&uuml;&#351;teri Profili</h2><span class="status">${escapeHtml(customer.status)}</span></div>
        <div class="report-facts">
          <p><span>Ad soyad</span><strong>${escapeHtml(customer.fullName)}</strong></p>
          <p><span>Telefon</span><strong>${escapeHtml(customer.phone)}</strong></p>
          <p><span>Ya&#351;</span><strong>${escapeHtml(customer.age)}</strong></p>
          <p><span>Cinsiyet</span><strong>${escapeHtml(customer.gender)}</strong></p>
          <p><span>&#304;lk kay&#305;t tarihi</span><strong>${formatCustomerDate(customer.createdAt)}</strong></p>
          <p><span>Son analiz tarihi</span><strong>${formatCustomerDate(customer.lastAnalysisDate)}</strong></p>
        </div>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Cilt &Ouml;zeti</h2></div>
        <div class="score-grid">
          <article class="score-card"><span>Son genel skor</span><strong>${escapeHtml(customer.skinSummary.lastScore)}</strong></article>
          <article class="score-card"><span>Cilt tipi</span><strong>${escapeHtml(customer.skinSummary.skinType)}</strong></article>
          <article class="score-card"><span>Ana &#351;ikayet</span><strong>${escapeHtml(customer.skinSummary.mainConcern)}</strong></article>
          <article class="score-card"><span>Hassasiyet</span><strong>${escapeHtml(customer.skinSummary.sensitivity)}</strong></article>
        </div>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Analiz Ge&ccedil;mi&#351;i</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Rapor ID</th><th>Tarih</th><th>Genel skor</th><th>Ana &#351;ikayet</th><th>Durum</th><th>&#304;&#351;lem</th></tr></thead>
            <tbody>${customerAnalysisRows(customer.reports || [])}</tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <div class="section-title"><h2>Takip Hat&#305;rlatmalar&#305;</h2></div>
        <div class="follow-up-list">
          ${(customer.reminders || [])
            .map(
              (reminder) => `
                <div class="follow-up-row">
                  <strong>${escapeHtml(reminder.title)}</strong>
                  <span>${escapeHtml(reminder.detail)}</span>
                  <em class="status">${escapeHtml(reminder.status)}</em>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
    bindRouteLinks();
  }

  async function loadCustomerDetailFromDatabase() {
    const root = document.querySelector("#customer-detail-root");
    const message = document.querySelector("#customer-detail-api-message");
    if (!root) return;

    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(root.dataset.customerId)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "M&uuml;&#351;teri bulunamad&#305;.");
      renderCustomerDetail(payload.customer);
    } catch (error) {
      root.innerHTML = '<section class="panel empty-state"><h2>M&uuml;&#351;teri bulunamad&#305;.</h2><p>Kay&#305;t silinmi&#351; veya farkl&#305; bir salona ait olabilir.</p></section>';
      if (message) {
        message.textContent = error instanceof Error ? error.message : "Müşteri bulunamadı.";
        message.hidden = false;
      }
    }
  }

  function bindCustomerDetailDatabasePage() {
    if (!currentPath().startsWith("/dashboard/customers/")) return;
    loadCustomerDetailFromDatabase();
  }

  function bindRouteLinks() {
    document.querySelectorAll("[data-path]").forEach((link) => {
      if (link.dataset.boundRoute === "true") return;
      link.dataset.boundRoute = "true";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        if (link.dataset.reportCustomerId || link.dataset.reportCustomerName) {
          storePendingReportCustomerSelection(link.dataset.reportCustomerId || "", link.dataset.reportCustomerName || "");
        }
        if (link.dataset.path === "/dashboard/new-analysis") {
          try {
            const saved = sessionStorage.getItem("analysisWizardState");
            const state = saved ? JSON.parse(saved) : {};
            sessionStorage.setItem("analysisWizardState", JSON.stringify({ ...state, isLoadingCustomers: true }));
          } catch {
            sessionStorage.removeItem("analysisWizardState");
          }
        }
        navigate(link.dataset.path);
      });
    });
  }

  function bindMobileMenu() {
    const shell = document.querySelector(".shell");
    const toggle = document.querySelector("[data-mobile-menu-toggle]");
    if (!shell || !toggle || toggle.dataset.boundMobileMenu === "true") return;

    const setOpen = (isOpen) => {
      shell.classList.toggle("mobile-menu-open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Menüyü kapat" : "Menüyü aç");
    };

    toggle.dataset.boundMobileMenu = "true";
    toggle.addEventListener("click", () => {
      setOpen(!shell.classList.contains("mobile-menu-open"));
    });

    document.querySelectorAll("[data-mobile-menu-close], .sidebar [data-path]").forEach((target) => {
      if (target.dataset.boundMobileMenuClose === "true") return;
      target.dataset.boundMobileMenuClose = "true";
      target.addEventListener("click", () => setOpen(false));
    });
  }

  function bindCustomersDatabasePage() {
    if (currentPath() !== "/dashboard/customers") return;

    loadCustomersFromDatabase();

    const modal = document.querySelector("#customers-create-modal");
    const openModal = () => {
      if (!modal) return;
      modal.hidden = false;
      const success = document.querySelector("#customer-form-success");
      const errorBox = document.querySelector("#customer-form-error");
      if (success) success.hidden = true;
      if (errorBox) errorBox.hidden = true;
      document.querySelector("#customer-form input[name='fullName']")?.focus();
    };
    const closeModal = () => {
      if (!modal) return;
      modal.hidden = true;
    };

    document.querySelectorAll("[data-open-customers-modal]").forEach((button) => {
      if (button.dataset.boundCustomersModal === "true") return;
      button.dataset.boundCustomersModal = "true";
      button.addEventListener("click", openModal);
    });

    const searchInput = document.querySelector("#customers-search");
    if (searchInput && searchInput.dataset.boundCustomerSearch !== "true") {
      searchInput.dataset.boundCustomerSearch = "true";
      searchInput.value = customerListState.query;
      searchInput.addEventListener("input", () => {
        customerListState.query = searchInput.value;
        customerListState.page = 1;
        renderCustomerList();
      });
    }

    document.querySelectorAll("[data-close-customers-modal]").forEach((button) => {
      if (button.dataset.boundCustomersModalClose === "true") return;
      button.dataset.boundCustomersModalClose = "true";
      button.addEventListener("click", closeModal);
    });

    if (modal && modal.dataset.boundBackdropClose !== "true") {
      modal.dataset.boundBackdropClose = "true";
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
    }

    const form = document.querySelector("#customer-form");
    if (!form) return;

    if (form.dataset.boundCustomerForm === "true") return;
    form.dataset.boundCustomerForm = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const success = document.querySelector("#customer-form-success");
      const errorBox = document.querySelector("#customer-form-error");
      const button = form.querySelector("button[type='submit']");
      const apiMessage = document.querySelector("#customers-api-message");
      const formData = new FormData(form);
      const fullName = String(formData.get("fullName") || "").trim();
      const phone = String(formData.get("phone") || "").trim();

      if (success) success.hidden = true;
      if (errorBox) errorBox.hidden = true;

      if (!fullName || !phone) {
        if (errorBox) {
          errorBox.textContent = "Ad soyad ve telefon zorunludur.";
          errorBox.hidden = false;
        }
        return;
      }

      try {
        if (button) button.disabled = true;

        const response = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName,
            phone,
            age: formData.get("age") || "",
            gender: formData.get("gender") || "",
            notes: formData.get("notes") || "",
          }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || "Müşteri kaydedilirken bir hata oluştu.");
        }

        form.reset();
        if (success) {
          success.textContent = payload.message || "Müşteri başarıyla eklendi.";
          success.hidden = false;
        }
        await loadCustomersFromDatabase();
        closeModal();
        if (apiMessage) {
          apiMessage.textContent = payload.message || "Müşteri başarıyla eklendi.";
          apiMessage.classList.remove("error-message");
          apiMessage.hidden = false;
        }
      } catch {
        if (errorBox) {
          errorBox.textContent = "Müşteri kaydedilirken bir hata oluştu.";
          errorBox.hidden = false;
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function bindAuthForms() {
    document.querySelectorAll("[data-toggle-password]").forEach((button) => {
      if (button.dataset.boundPasswordToggle === "true") return;
      button.dataset.boundPasswordToggle = "true";
      button.addEventListener("click", () => {
        const field = button.closest(".password-field");
        const input = field?.querySelector("input");
        if (!input) return;
        const shouldShow = input.type === "password";
        input.type = shouldShow ? "text" : "password";
        button.setAttribute("aria-label", shouldShow ? "Şifreyi gizle" : "Şifreyi göster");
        button.setAttribute("aria-pressed", String(shouldShow));
        button.innerHTML = shouldShow
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="3"></circle><path d="M4 4l16 16"></path></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
      });
    });

    const forms = [
      { selector: "#salon-login-form", endpoint: "/api/auth/login" },
      { selector: "#admin-login-form", endpoint: "/api/auth/admin-login" },
      { selector: "#firm-login-form", endpoint: "/api/auth/firm-login" },
    ];

    forms.forEach(({ selector, endpoint }) => {
      const form = document.querySelector(selector);
      if (!form || form.dataset.boundAuthForm === "true") return;
      form.dataset.boundAuthForm = "true";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button[type='submit']");
        const message = document.querySelector("#auth-message");
        const formData = new FormData(form);

        if (message) message.hidden = true;

        try {
          if (button) button.disabled = true;
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formData.get("email") || "",
              password: formData.get("password") || "",
            }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message || "Giriş yapılamadı.");
          authUser = payload.user;
          authChecked = true;
          navigate(payload.redirectTo || (endpoint.includes("admin") ? "/admin" : endpoint.includes("firm") ? "/firm" : "/dashboard"));
        } catch (error) {
          if (message) {
            message.textContent = error instanceof Error ? error.message : "Giriş yapılamadı.";
            message.hidden = false;
          }
        } finally {
          if (button) button.disabled = false;
        }
      });
    });

    document.querySelectorAll("[data-logout]").forEach((button) => {
      if (button.dataset.boundLogout === "true") return;
      button.dataset.boundLogout = "true";
      button.addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        authUser = null;
        authChecked = true;
        navigate("/login");
      });
    });
  }

  function routeContent(path) {
    if (path === "/login") return authPage("salon");
    if (path === "/admin-login") return authPage("admin");
    if (path === "/firm-login") return authPage("firm");
    if (path === "/firm") return firmProductsPage(authUser);
    if (path === "/firm/salons") return firmSalonsPage(authUser);
    if (path === "/firm/packages") return firmPackagesPage(authUser);
    if (path === "/firm/settings") return firmSettingsPage(authUser);
    if (path.startsWith("/admin/reports/")) return reportPage(path.split("/").filter(Boolean).pop(), toHref);
    if (path === "/admin" || path.startsWith("/admin/")) return resolveAdminPage(path);
    if (path === "/" || path === "/dashboard") return dashboardHome(toHref);
    if (path === "/dashboard/customers") return customersPage(toHref);
    if (path.startsWith("/dashboard/customers/")) return customerDetailPage(path.split("/").filter(Boolean).pop(), toHref);
    if (path === "/dashboard/new-analysis") return renderAnalysisWizard();
    if (path === "/dashboard/reports") return reportsListPage(toHref);
    if (path.startsWith("/dashboard/reports/")) return reportPage(path.split("/").filter(Boolean).pop(), toHref);
    if (path === "/dashboard/products") return productsPage();
    if (path === "/dashboard/protocols") return protocolsPage();
    if (path === "/dashboard/billing") return billingPage();
    if (path === "/dashboard/team") return teamPage();
    if (path === "/dashboard/settings") return settingsPage();
    return placeholderPage("Raporlar");
  }

  function captureFocusedField() {
    const active = document.activeElement;
    if (!active || !["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return null;

    const selector = active.id
      ? `#${CSS.escape(active.id)}`
      : active.name
        ? `${active.tagName.toLowerCase()}[name="${CSS.escape(active.name)}"]`
        : null;

    if (!selector) return null;

    return {
      selector,
      value: active.value,
      selectionStart: typeof active.selectionStart === "number" ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
    };
  }

  function restoreFocusedField(snapshot) {
    if (!snapshot) return;
    const field = document.querySelector(snapshot.selector);
    if (!field || !["INPUT", "TEXTAREA", "SELECT"].includes(field.tagName)) return;

    if (field.value !== snapshot.value) {
      field.value = snapshot.value;
    }

    field.focus({ preventScroll: true });
    if (
      snapshot.selectionStart !== null &&
      snapshot.selectionEnd !== null &&
      typeof field.setSelectionRange === "function"
    ) {
      try {
        field.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
      } catch {
        // Some input types do not support selection ranges.
      }
    }
  }

  function bindEvents() {
    bindRouteLinks();
    bindMobileMenu();
    bindAuthForms();
    loadDashboardFromDatabase();
    bindCustomersDatabasePage();
    bindCustomerDetailDatabasePage();
    bindReportsDatabasePages();
    bindProductsDatabasePage();
    bindProtocolsPage();
    bindTeamDatabasePage();
    bindSubscriptionDatabasePages();
    bindBillingPromoForm();
    bindSettingsDatabasePage();
    bindAdminDatabasePages();
    bindFirmProductsPage();
    bindFirmSalonsPage();
    bindFirmPackagesPage();
    bindFirmSettingsPage();

    document.querySelectorAll("#customer-form").forEach((form) => {
      if (currentPath() === "/dashboard/customers") return;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        form.reset();
        const button = form.querySelector("button");
        const original = button.textContent;
        button.textContent = "Kaydedildi";
        setTimeout(() => {
          button.textContent = original;
        }, 1200);
      });
    });

    document.querySelectorAll("#product-form").forEach((form) => {
      if (currentPath() === "/dashboard/products") return;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        form.reset();
        const button = form.querySelector("button");
        const original = button.textContent;
        button.textContent = "Mock ürün eklendi";
        setTimeout(() => {
          button.textContent = original;
        }, 1200);
      });
    });

    const settingsForm = document.querySelector("#settings-form");
    if (settingsForm) {
      if (currentPath() === "/dashboard/settings") return;
      settingsForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const message = settingsForm.querySelector("#settings-success");
        if (message) {
          message.hidden = false;
          setTimeout(() => {
            message.hidden = true;
          }, 2400);
        }
      });
    }

    const adminSettingsForm = document.querySelector("#admin-settings-form");
    if (adminSettingsForm) {
      adminSettingsForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const message = document.querySelector("#admin-settings-success");
        if (message) {
          message.hidden = false;
          setTimeout(() => {
            message.hidden = true;
          }, 2200);
        }
      });
    }

    bindReportActionButtons();

    const customerWhatsappButton = document.querySelector("[data-customer-whatsapp]");
    if (customerWhatsappButton) {
      customerWhatsappButton.addEventListener("click", () => {
        const message = document.querySelector("#customer-whatsapp-message");
        if (message) {
          message.hidden = false;
        }
      });
    }

    const inviteMemberForm = document.querySelector("#invite-member-form");
    if (inviteMemberForm && currentPath() !== "/dashboard/team") {
      inviteMemberForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const message = document.querySelector("#invite-success");
        if (message) {
          message.hidden = false;
          setTimeout(() => {
            message.hidden = true;
          }, 2400);
        }
      });
    }

    bindAnalysisWizard(navigate);
  }

  function render() {
    const path = currentPath();
    const focusedField = captureFocusedField();

    if ((isSalonPath(path) || isAdminPath(path) || isFirmPath(path)) && !authChecked) {
      app.innerHTML = authLoading();
      refreshAuth().then(render);
      return;
    }

    if (isSalonPath(path) && (!authUser || authUser.role === "ADMIN")) {
      app.innerHTML = authPage("salon");
      bindAuthForms();
      return;
    }

    if (isSalonPath(path) && !canAccessPath(path)) {
      app.innerHTML = renderLayout(
        '<section class="panel empty-state"><h2>Yetkiniz bulunmuyor.</h2><p>Bu sayfaya erişmek için salon yöneticisi yetkisi gerekir.</p></section>',
        path,
        toHref,
        authUser,
      );
      bindEvents();
      return;
    }

    if (isAdminPath(path) && (!authUser || authUser.role !== "ADMIN")) {
      app.innerHTML = authPage("admin");
      bindAuthForms();
      return;
    }

    if (isFirmPath(path) && (!authUser || authUser.role !== "FIRM")) {
      app.innerHTML = authPage("firm");
      bindAuthForms();
      return;
    }

    const content = routeContent(path);
    app.innerHTML = isAdminPath(path)
      ? AdminLayout(content, path, toHref)
      : isFirmPath(path)
        ? content
        : path === "/login" || path === "/admin-login" || path === "/firm-login"
        ? content
        : renderLayout(content, path, toHref, authUser);
    bindEvents();
    restoreFocusedField(focusedField);
  }

  window.CiltGPTRender = render;
  window.addEventListener("popstate", render);
  window.addEventListener("hashchange", render);
  render();
})();

