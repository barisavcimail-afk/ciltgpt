(function () {
  function productCard(label, value) {
    return `
      <article class="stat-card product-stat-card">
        <span>${label}</span>
        <strong>${value}</strong>
      </article>
    `;
  }

  function productTable(products) {
    const rows = products
      .map(
        (product) => `
          <tr>
            <td>${product.name}</td>
            <td>${product.brand}</td>
            <td>${product.category}</td>
            <td>${product.productType || (product.isCabinProduct ? "Kabin ürünü" : "Ev devam ürünü")}</td>
            <td>${product.purpose}</td>
            <td>${product.time}</td>
            <td><span class="status ${product.status === "Pasif" ? "inactive" : ""}">${product.status}</span></td>
            <td><button class="table-action muted-action" type="button">Düzenle</button></td>
          </tr>
        `,
      )
      .join("");

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ürün adı</th>
              <th>Marka</th>
              <th>Kategori</th>
              <th>Ürün tipi</th>
              <th>Kullanım amacı</th>
              <th>Kullanım zamanı</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function options(items) {
    return items.map((item) => `<option>${item}</option>`).join("");
  }

  function productForm(config) {
    return `
      <form class="customer-form product-form" id="product-form">
        <div class="form-grid">
          <label><span>Ürün adı</span><input name="name" type="text" placeholder="HydraCare ürün adı" required /></label>
          <label><span>Marka</span><input name="brand" type="text" value="HydraCare" required /></label>
          <label><span>Kategori</span><select name="category" required>${options(config.categories)}</select></label>
          <label><span>Kullanım amacı</span><select name="purpose" required>${options(config.purposes)}</select></label>
          <label><span>Kullanım zamanı</span><select name="time" required>${options(config.times)}</select></label>
          <label><span>Durum</span><select name="status" required>${options(config.statuses)}</select></label>
        </div>
        <label class="checkbox-line">
          <input name="isCabinProduct" type="checkbox" />
          <span>Kabin ürünü olarak işaretle</span>
        </label>
        <label><span>Salon satış notu</span><textarea name="salesNote" rows="4" placeholder="Salon ekibinin müşteriye aktaracağı kısa satış notu"></textarea></label>
        <button class="button" type="submit">Ürün ekle</button>
      </form>
    `;
  }

  window.CiltGPTProductComponents = {
    ProductCard: productCard,
    ProductTable: productTable,
    ProductForm: productForm,
  };
})();
