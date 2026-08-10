import { pageHeader } from "./layout.js";

export function placeholderPage(title) {
  return `
    ${pageHeader(title, "Bu bölüm MVP içinde menüye eklendi; detay ekranları sonraki aşamada genişletilebilir.")}
    <section class="panel empty-state">
      <h2>${title}</h2>
      <p>Mevcut çalışan yapıyı bozmadan sol menü navigasyonuna bağlandı.</p>
    </section>
  `;
}
