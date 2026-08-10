export function scoreCards(scores) {
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
