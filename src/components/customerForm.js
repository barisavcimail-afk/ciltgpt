export function customerFields({ required = false } = {}) {
  const requiredAttr = required ? "required" : "";

  return `
    <div class="form-grid">
      <label>
        <span>Ad Soyad</span>
        <input name="fullName" type="text" placeholder="Örn. Deniz Arslan" ${requiredAttr} />
      </label>
      <label>
        <span>Telefon</span>
        <input name="phone" type="tel" placeholder="05xx xxx xx xx" ${requiredAttr} />
      </label>
      <label>
        <span>Yaş</span>
        <input name="age" type="number" min="12" max="100" placeholder="32" ${requiredAttr} />
      </label>
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
    <label>
      <span>Notlar</span>
      <textarea name="notes" rows="4" placeholder="Cilt hassasiyeti, geçmiş uygulamalar veya bakım hedefleri"></textarea>
    </label>
  `;
}

export function customerForm() {
  return `
    <form class="customer-form" id="customer-form">
      ${customerFields({ required: true })}
      <button class="button" type="submit">Müşteri ekle</button>
    </form>
  `;
}
