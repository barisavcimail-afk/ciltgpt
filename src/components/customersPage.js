import { customers } from "../data/mockData.js";
import { customerForm } from "./customerForm.js";
import { pageHeader } from "./layout.js";

function customerRows() {
  return customers
    .map(
      (customer) => `
        <tr>
          <td>${customer.fullName}</td>
          <td>${customer.phone}</td>
          <td>${customer.age}</td>
          <td>${customer.gender}</td>
          <td>${new Date(customer.lastAnalysisDate).toLocaleDateString("tr-TR")}</td>
          <td><span class="status">${customer.status}</span></td>
          <td><a class="table-action" href="/dashboard/reports/${customer.id}" data-link>Rapor</a></td>
        </tr>
      `,
    )
    .join("");
}

export function customersPage() {
  return `
    ${pageHeader("Müşteriler", "Analiz yapılacak salon müşterilerini takip edin ve yeni müşteri ekleyin.")}
    <section class="panel">
      <div class="section-title">
        <h2>Müşteri listesi</h2>
        <span class="muted">${customers.length} kayıt</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>Telefon</th>
              <th>Yaş</th>
              <th>Cinsiyet</th>
              <th>Son analiz tarihi</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>${customerRows()}</tbody>
        </table>
      </div>
    </section>
    <section class="panel">
      <div class="section-title">
        <h2>Yeni müşteri ekle</h2>
      </div>
      ${customerForm()}
    </section>
  `;
}
