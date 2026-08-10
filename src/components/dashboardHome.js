import { customers, mockScores } from "../data/mockData.js";
import { pageHeader } from "./layout.js";
import { scoreCards } from "./scoreCards.js";

export function dashboardHome() {
  return `
    ${pageHeader("Dashboard", "Salon müşterileri, analizler ve öneri akışları için genel görünüm.")}
    <section class="stats-grid">
      <article class="stat-card">
        <span>Toplam müşteri</span>
        <strong>${customers.length}</strong>
      </article>
      <article class="stat-card">
        <span>Bu ay analiz</span>
        <strong>18</strong>
      </article>
      <article class="stat-card">
        <span>Ortalama skor</span>
        <strong>72</strong>
      </article>
    </section>
    <section class="panel">
      <div class="section-title">
        <h2>Son mock analiz özeti</h2>
        <a class="button ghost" href="/dashboard/new-analysis" data-link>Yeni analiz</a>
      </div>
      ${scoreCards(mockScores)}
    </section>
  `;
}
