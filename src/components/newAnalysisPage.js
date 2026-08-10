import { customers } from "../data/mockData.js";
import { customerFields } from "./customerForm.js";
import { pageHeader } from "./layout.js";

const photoFields = ["Ön yüz", "Sol profil", "Sağ profil", "Yakın plan"];

export function newAnalysisPage() {
  const options = customers
    .map((customer) => `<option value="${customer.id}">${customer.fullName}</option>`)
    .join("");

  return `
    ${pageHeader("Yeni Analiz", "Dört adımlı analiz akışı ile müşteri rızasını, fotoğrafları ve mock sonucu yönetin.")}
    <form class="analysis-flow" id="analysis-form">
      <section class="step-card">
        <div class="step-badge">1</div>
        <div class="step-content">
          <h2>Müşteri seç veya yeni müşteri oluştur</h2>
          <label>
            <span>Kayıtlı müşteri</span>
            <select name="customerId" required>
              <option value="">Müşteri seçiniz</option>
              ${options}
            </select>
          </label>
          <details>
            <summary>Yeni müşteri formu</summary>
            <div class="customer-form nested-fields">
              ${customerFields()}
            </div>
          </details>
        </div>
      </section>

      <section class="step-card">
        <div class="step-badge">2</div>
        <div class="step-content">
          <h2>KVKK / açık rıza onayı</h2>
          <label class="checkbox-row">
            <input name="consent" type="checkbox" required />
            <span>Müşteri fotoğraf ve analiz verilerinin işlenmesine açık rıza verdi.</span>
          </label>
        </div>
      </section>

      <section class="step-card">
        <div class="step-badge">3</div>
        <div class="step-content">
          <h2>Fotoğraf yükleme</h2>
          <div class="upload-grid">
            ${photoFields
              .map(
                (field) => `
                  <label class="upload-box">
                    <input type="file" accept="image/*" aria-label="${field}" />
                    <strong>${field}</strong>
                    <span>Fotoğraf seç</span>
                  </label>
                `,
              )
              .join("")}
          </div>
        </div>
      </section>

      <section class="step-card">
        <div class="step-badge">4</div>
        <div class="step-content action-step">
          <h2>Analizi başlat</h2>
          <p>Bu MVP aşamasında gerçek yapay zekâ bağlantısı yerine mock analiz sonucu üretilecek.</p>
          <button class="button large" type="submit">Analizi başlat</button>
        </div>
      </section>
    </form>
  `;
}
