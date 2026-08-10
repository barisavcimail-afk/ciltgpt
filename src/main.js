import { customers, mockScores } from "./data/mockData.js";
import { customersPage } from "./components/customersPage.js";
import { dashboardHome } from "./components/dashboardHome.js";
import { renderLayout } from "./components/layout.js";
import { newAnalysisPage } from "./components/newAnalysisPage.js";
import { placeholderPage } from "./components/placeholderPage.js";
import { reportPage } from "./components/reportPage.js";

const app = document.querySelector("#app");

function navigate(path) {
  history.pushState({}, "", path);
  render();
}

function routeContent(path) {
  if (path === "/" || path === "/dashboard") return dashboardHome();
  if (path === "/dashboard/customers") return customersPage();
  if (path === "/dashboard/new-analysis") return newAnalysisPage();
  if (path.startsWith("/dashboard/reports/")) {
    const id = path.split("/").filter(Boolean).at(-1);
    return reportPage(id);
  }
  if (path === "/dashboard/products") return placeholderPage("Ürünler");
  if (path === "/dashboard/settings") return placeholderPage("Ayarlar");
  return placeholderPage("Raporlar");
}

function bindGlobalEvents() {
  document.querySelectorAll("[data-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.getAttribute("href"));
    });
  });

  const analysisForm = document.querySelector("#analysis-form");
  if (analysisForm) {
    analysisForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(analysisForm);
      const customerId = formData.get("customerId") || customers[0].id;
      sessionStorage.setItem(
        "lastMockAnalysis",
        JSON.stringify({
          customerId,
          scores: mockScores,
          createdAt: new Date().toISOString(),
        }),
      );
      navigate(`/dashboard/reports/${customerId}`);
    });
  }

  document.querySelectorAll("#customer-form").forEach((form) => {
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

  const pdfButton = document.querySelector("#download-pdf");
  if (pdfButton) {
    pdfButton.addEventListener("click", () => {
      window.print();
    });
  }
}

function render() {
  const path = window.location.pathname;
  app.innerHTML = renderLayout(routeContent(path), path);
  bindGlobalEvents();
}

window.addEventListener("popstate", render);
render();
