import { customers, mockHomeCareProducts, mockProtocol, mockScores } from "../data/mockData.js";
import { pageHeader } from "./layout.js";
import { scoreCards } from "./scoreCards.js";

function getCustomer(id) {
  return customers.find((customer) => customer.id === id) || customers[0];
}

export function reportPage(id) {
  const customer = getCustomer(id);
  const date = new Date().toLocaleDateString("tr-TR");

  return `
    ${pageHeader(
      "Analiz Raporu",
      "Mock analiz sonucu, kabin protokolü ve ev devam ürünleri tek ekranda.",
      `<button class="button secondary" type="button" id="download-pdf">PDF indir</button>`,
    )}
    <section class="panel">
      <div class="customer-summary">
        <div>
          <span class="muted">Müşteri</span>
          <strong>${customer.fullName}</strong>
        </div>
        <div>
          <span class="muted">Telefon</span>
          <strong>${customer.phone}</strong>
        </div>
        <div>
          <span class="muted">Yaş / Cinsiyet</span>
          <strong>${customer.age} / ${customer.gender}</strong>
        </div>
        <div>
          <span class="muted">Analiz tarihi</span>
          <strong>${date}</strong>
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="section-title">
        <h2>Skor kartları</h2>
      </div>
      ${scoreCards(mockScores)}
    </section>
    <section class="two-column">
      <article class="panel">
        <div class="section-title">
          <h2>Önerilen kabin protokolü</h2>
        </div>
        <div class="recommendation">
          <strong>${mockProtocol.name}</strong>
          <p>Önerilen seans: ${mockProtocol.sessions}</p>
          <p>Uygulama sıklığı: ${mockProtocol.frequency}</p>
        </div>
      </article>
      <article class="panel">
        <div class="section-title">
          <h2>Önerilen ev devam ürünleri</h2>
        </div>
        <ul class="product-list">
          ${mockHomeCareProducts.map((product) => `<li>${product}</li>`).join("")}
        </ul>
      </article>
    </section>
  `;
}
