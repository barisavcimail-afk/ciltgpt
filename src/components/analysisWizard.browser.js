(function () {
  const { customers } = window.CiltGPTData;
  const { pageHeader, customerFields } = window.CiltGPTComponents;
  window.CiltGPTSubscription = window.CiltGPTSubscription || { packages: [], currentSubscription: {}, usageStats: {} };
  const usageStats = window.CiltGPTSubscription.usageStats || {};

  const steps = [
    "Müşteri Seçimi",
    "Onay",
    "Fotoğraf Yükleme",
    "Cilt Soruları",
    "Analiz Özeti",
  ];

  const photoFields = [
    { key: "front", label: "Ön yüz" },
    { key: "left", label: "Sol profil" },
    { key: "right", label: "Sağ profil" },
    { key: "close", label: "Yakın plan" },
  ];

  const defaultState = {
    step: 0,
    selectedCustomerId: "",
    customerSearch: "",
    customerModalOpen: false,
    newCustomer: {},
    dbCustomers: [],
    isLoadingCustomers: true,
    customersError: "",
    subscription: null,
    isLoadingSubscription: true,
    consent: false,
    photos: {},
    skinType: "Karma",
    complaint: "Leke",
    spf: "Evet",
    routine: "Hayır",
    notes: "",
    warning: "",
  };

  function getState() {
    const saved = sessionStorage.getItem("analysisWizardState");
    return saved ? { ...defaultState, ...JSON.parse(saved) } : { ...defaultState };
  }

  function setState(next) {
    sessionStorage.setItem("analysisWizardState", JSON.stringify({ ...getState(), ...next }));
  }

  function availableCustomers(state) {
    return state.dbCustomers && state.dbCustomers.length ? state.dbCustomers : [];
  }

  function normalizeSearchValue(value) {
    return String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ")
      .trim();
  }

  function filteredCustomers(state) {
    const databaseCustomers = availableCustomers(state);
    const query = normalizeSearchValue(state.customerSearch);
    if (!query) return databaseCustomers;

    return databaseCustomers.filter((customer) => {
      const haystack = normalizeSearchValue(
        `${customer.fullName || ""} ${customer.phone || ""} ${customer.age || ""} ${customer.gender || ""}`,
      );
      return haystack.includes(query);
    });
  }

  function customerResultListHtml(state) {
    const query = normalizeSearchValue(state.customerSearch);
    if (!query) return "";

    const visibleCustomers = filteredCustomers(state);
    if (!visibleCustomers.length) {
      return `<div class="customer-search-results"><div class="customer-search-empty compact"><strong>Sonuç bulunamadı.</strong><span>Aramayı değiştir veya yeni müşteri oluştur.</span></div></div>`;
    }

    return `
      <div class="customer-search-results">
        ${visibleCustomers
          .slice()
          .sort((first, second) => String(first.fullName || "").localeCompare(String(second.fullName || ""), "tr-TR"))
          .slice(0, 10)
          .map(
            (customer) => `
              <button class="customer-search-result ${state.selectedCustomerId === customer.id ? "selected" : ""}" type="button" data-customer-result="${customer.id}">
                <strong>${customer.fullName}</strong>
                <span>${customer.phone}</span>
                <small>${customer.age || "-"} yaş / ${customer.gender || "-"}</small>
              </button>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function selectedCustomer(state) {
    if (state.selectedCustomerId === "new") {
      return {
        id: "new",
        fullName: state.newCustomer.fullName || "Yeni müşteri",
        phone: state.newCustomer.phone || "-",
        age: state.newCustomer.age || "-",
        gender: state.newCustomer.gender || "-",
      };
    }

    const databaseCustomers = availableCustomers(state);
    return databaseCustomers.find((customer) => customer.id === state.selectedCustomerId) || null;
  }

  function validateAnalysisStart(state, customer) {
    if (!customer) {
      return "Analiz için geçerli bir müşteri seçin.";
    }

    if (state.selectedCustomerId === "new") {
      const fullName = String(state.newCustomer.fullName || "").trim();
      const phone = String(state.newCustomer.phone || "").trim();

      if (!fullName || !phone) {
        return "Yeni müşteri için ad soyad ve telefon zorunludur.";
      }
    }

    if (!state.consent) {
      return "KVKK / açık rıza onayı zorunludur.";
    }

    if (!hasAllRequiredPhotos(state)) {
      return "Analiz başlatmak için 4 fotoğrafın tamamını yükleyin.";
    }

    return "";
  }

  function hasPhotoValue(photo) {
      if (!photo) return false;
      if (typeof photo === "string") return photo.trim().length > 0;
      return Boolean(photo.name || photo.preview);
  }

  function hasAllRequiredPhotos(state) {
    return photoFields.every((field) => hasPhotoValue((state.photos || {})[field.key]));
  }

  function resizePhotoFile(file, maxSize = 900, quality = 0.68) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("error", reject);
      reader.addEventListener("load", () => {
        const image = new Image();
        image.addEventListener("error", reject);
        image.addEventListener("load", () => {
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        });
        image.src = String(reader.result || "");
      });
      reader.readAsDataURL(file);
    });
  }

  function progress(state) {
    return `
      <div class="wizard-progress">
        ${steps
          .map(
            (label, index) => `
              <button class="wizard-step ${index === state.step ? "active" : ""} ${index < state.step ? "done" : ""}" type="button" data-wizard-jump="${index}">
                <span>${index + 1}</span>
                <strong>${label}</strong>
              </button>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function customerStep(state) {
    const databaseCustomers = availableCustomers(state);
    const searchValue = String(state.customerSearch || "").replace(/"/g, "&quot;");

    if (state.isLoadingCustomers) {
      return `
        <section class="panel wizard-panel">
          <div class="section-title"><h2>Müşteri Seçimi</h2></div>
          <p class="muted">Müşteriler yükleniyor...</p>
        </section>
      `;
    }

    if (databaseCustomers.length === 0) {
      return `
        <section class="panel wizard-panel empty-state">
          <h2>Analiz başlatmak için önce müşteri ekleyin.</h2>
          <p>${state.customersError || "Veritabanında kayıtlı müşteri bulunamadı."}</p>
        </section>
      `;
    }

    return `
      <section class="panel wizard-panel">
        <div class="section-title"><h2>Müşteri Seçimi</h2></div>
        <div class="customer-search-box">
          <label>
            <span>Müşteri ara</span>
            <input type="search" name="customerSearch" value="${searchValue}" placeholder="Ad, soyad, telefon veya yaş ile ara" autocomplete="off" data-customer-search />
          </label>
          <small>${databaseCustomers.length} kayıt</small>
          <input type="hidden" name="selectedCustomerId" value="${state.selectedCustomerId || ""}" />
          <div data-customer-search-results>
            ${customerResultListHtml(state)}
          </div>
        </div>
      </section>
    `;
  }

  function customerModal() {
    return `
      <div class="modal-backdrop" data-customer-modal>
        <section class="customer-modal" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title">
          <div class="modal-header">
            <div>
              <span class="eyebrow">Yeni analiz</span>
              <h2 id="customer-modal-title">Yeni müşteri oluştur</h2>
            </div>
            <button class="icon-button" type="button" aria-label="Kapat" data-close-customer-modal>×</button>
          </div>
          <form id="analysis-customer-modal-form" class="modal-form">
            <div id="analysis-customer-modal-message" class="error-message" hidden></div>
            ${customerFields(true)}
            <div class="modal-actions">
              <button class="button ghost" type="button" data-close-customer-modal>Vazgeç</button>
              <button class="button" type="submit">Kaydet ve tamam</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function consentStep(state) {
    return `
      <section class="panel wizard-panel">
        <div class="section-title"><h2>Onay</h2></div>
        <div class="consent-box">
          <strong>KVKK ve açık rıza metni</strong>
          <p>Müşteriye ait fotoğraflar ve analiz sırasında girilen bilgiler yalnızca cilt analizi, raporlama ve salon içi bakım önerisi oluşturma amacıyla işlenir. Veriler müşteri onayı olmadan farklı bir amaçla kullanılmaz.</p>
        </div>
        <label class="checkbox-row consent-check">
          <input name="consent" type="checkbox" ${state.consent ? "checked" : ""} />
          <span>Müşteri, fotoğraflarının cilt analizi amacıyla işlenmesine açık rıza vermiştir.</span>
        </label>
      </section>
    `;
  }

  function photosStep(state) {
    // TODO: Store uploaded photos in S3-compatible storage.
    return `
      <section class="panel wizard-panel">
        <div class="section-title"><h2>Fotoğraf Yükleme</h2></div>
        <div class="upload-grid wizard-upload-grid">
          ${photoFields
            .map((field) => {
              const photo = state.photos[field.key] || "";
              const fileName = typeof photo === "string" ? photo : photo.name || "";
              const preview = typeof photo === "string" ? "" : photo.preview || "";
              return `
                <label class="upload-box ${fileName ? "uploaded" : ""}">
                  <input type="file" accept="image/*" data-photo-key="${field.key}" aria-label="${field.label}" />
                  ${preview ? `<img class="upload-preview" src="${preview}" alt="${field.label} önizleme" />` : ""}
                  <strong>${field.label}</strong>
                  <span>${fileName || "Fotoğraf seç"}</span>
                  ${fileName ? "<em>Yüklendi</em>" : ""}
                </label>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function questionsStep(state) {
    return `
      <section class="panel wizard-panel">
        <div class="section-title"><h2>Cilt Soruları</h2></div>
        <div class="form-grid">
          <label>
            <span>Cilt tipi</span>
            <select name="skinType">
              ${["Kuru", "Yağlı", "Karma", "Normal", "Hassas"].map((item) => `<option ${state.skinType === item ? "selected" : ""}>${item}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Ana şikayet</span>
            <select name="complaint">
              ${["Leke", "Akne", "Kırışıklık", "Gözenek", "Kuruluk", "Hassasiyet"].map((item) => `<option ${state.complaint === item ? "selected" : ""}>${item}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Günlük SPF kullanıyor mu?</span>
            <select name="spf">
              <option ${state.spf === "Evet" ? "selected" : ""}>Evet</option>
              <option ${state.spf === "Hayır" ? "selected" : ""}>Hayır</option>
            </select>
          </label>
          <label>
            <span>Ev bakım rutini var mı?</span>
            <select name="routine">
              <option ${state.routine === "Evet" ? "selected" : ""}>Evet</option>
              <option ${state.routine === "Hayır" ? "selected" : ""}>Hayır</option>
            </select>
          </label>
        </div>
        <label>
          <span>Notlar</span>
          <textarea name="notes" rows="5" placeholder="Salon uzmanı için kısa değerlendirme">${state.notes || ""}</textarea>
        </label>
      </section>
    `;
  }

  function summaryStep(state) {
    const customer = selectedCustomer(state);
    const uploaded = photoFields.filter((field) => state.photos[field.key]);
    if (!customer) {
      return `
        <section class="panel wizard-panel empty-state">
          <h2>Analiz özeti oluşturulamadı.</h2>
          <p>Analiz başlatmak için geçerli bir müşteri seçin.</p>
        </section>
      `;
    }
    return `
      <section class="panel wizard-panel">
        <div class="section-title"><h2>Analiz Özeti</h2></div>
        <div class="summary-grid">
          <article><span>Müşteri</span><strong>${customer.fullName}</strong><p>${customer.phone}</p></article>
          <article><span>Onay durumu</span><strong>${state.consent ? "Onaylandı" : "Onay bekliyor"}</strong><p>KVKK / açık rıza</p></article>
          <article><span>Yüklenen fotoğraflar</span><strong>${uploaded.length}/4</strong><p>${uploaded.map((field) => field.label).join(", ") || "Henüz yok"}</p></article>
          <article><span>Cilt tipi</span><strong>${state.skinType}</strong><p>Ana şikayet: ${state.complaint}</p></article>
          <article><span>SPF</span><strong>${state.spf}</strong><p>Ev rutini: ${state.routine}</p></article>
          <article><span>Notlar</span><strong>Salon notu</strong><p>${state.notes || "Not girilmedi"}</p></article>
        </div>
      </section>
    `;
  }

  function stepContent(state) {
    return [customerStep, consentStep, photosStep, questionsStep, summaryStep][state.step](state);
  }

  function renderAnalysisWizard() {
    const state = getState();
    const databaseCustomers = availableCustomers(state);
    const subscriptionUsage = state.subscription?.usage || usageStats;
    const isLimitReached = subscriptionUsage.remainingAnalyses <= 0;
    const hasNoCustomers = !state.isLoadingCustomers && databaseCustomers.length === 0;

    if (state.step === 0 && state.selectedCustomerId && state.selectedCustomerId !== "new" && !state.customerSearch) {
      setState({ selectedCustomerId: "" });
      return renderAnalysisWizard();
    }

    return `
      ${pageHeader("Yeni Analiz", "Müşteri seçimi, onay, fotoğraflar, cilt soruları ve özet adımlarından oluşan analiz akışı.")}
      <div class="wizard-reset-row">
        <a class="button" href="/dashboard/customers" data-link>Yeni müşteri oluştur</a>
        <button class="button ghost" type="button" data-reset-analysis>Tercihleri s&#305;f&#305;rla</button>
      </div>
      <form id="analysis-wizard" class="analysis-wizard">
        ${isLimitReached ? '<div class="form-warning">Bu ayki analiz limitiniz dolmuştur. Paketinizi yükseltin.</div>' : ""}
        ${progress(state)}
        ${state.warning ? `<div class="form-warning">${state.warning}</div>` : ""}
        ${stepContent(state)}
        <div class="wizard-actions">
          <button class="button ghost" type="button" data-wizard-prev ${state.step === 0 ? "disabled" : ""}>Geri</button>
          ${
            state.step === steps.length - 1
              ? `<button class="button large" type="button" data-start-analysis ${isLimitReached || hasNoCustomers ? "disabled" : ""}>Analizi Başlat</button>`
              : `<button class="button large" type="button" data-wizard-next ${hasNoCustomers ? "disabled" : ""}>Devam</button>`
          }
        </div>
      </form>
    `;
  }

  function readWizardForm() {
    const form = document.querySelector("#analysis-wizard");
    if (!form) return;
    const currentState = getState();
    const data = new FormData(form);
    const consentInput = form.querySelector('input[name="consent"]');
    const hasCustomerFields = data.has("fullName") || data.has("phone");
    const hasSkinQuestionFields = data.has("skinType") || data.has("complaint");
    const selectedCustomerId = data.get("selectedCustomerId") || currentState.selectedCustomerId;
    setState({
      selectedCustomerId,
      newCustomer: hasCustomerFields
        ? {
            fullName: data.get("fullName") || "",
            phone: data.get("phone") || "",
            age: data.get("age") || "",
            gender: data.get("gender") || "",
            notes: data.get("notes") || "",
          }
        : currentState.newCustomer,
      consent: consentInput ? consentInput.checked : currentState.consent,
      skinType: data.get("skinType") || currentState.skinType,
      customerSearch: data.get("customerSearch") ?? currentState.customerSearch,
      complaint: data.get("complaint") || currentState.complaint,
      spf: data.get("spf") || currentState.spf,
      routine: data.get("routine") || currentState.routine,
      notes: hasSkinQuestionFields ? data.get("notes") || "" : currentState.notes,
      warning: "",
    });
  }

  function bindAnalysisWizard(navigate) {
    const form = document.querySelector("#analysis-wizard");

    const resetButton = document.querySelector("[data-reset-analysis]");
    if (resetButton && resetButton.dataset.boundResetAnalysis !== "true") {
      resetButton.dataset.boundResetAnalysis = "true";
      resetButton.addEventListener("click", () => {
        sessionStorage.removeItem("analysisWizardState");
        setState({ isLoadingCustomers: true, isLoadingSubscription: true });
        window.CiltGPTRender();
      });
    }

    const openCustomerModalButton = document.querySelector("[data-open-customer-modal]");
    if (openCustomerModalButton && openCustomerModalButton.dataset.boundCustomerModal !== "true") {
      openCustomerModalButton.dataset.boundCustomerModal = "true";
      openCustomerModalButton.addEventListener("click", () => {
        setState({ customerModalOpen: true, warning: "" });
        window.CiltGPTRender();
      });
    }

    document.querySelectorAll("[data-close-customer-modal]").forEach((button) => {
      if (button.dataset.boundCloseCustomerModal === "true") return;
      button.dataset.boundCloseCustomerModal = "true";
      button.addEventListener("click", () => {
        setState({ customerModalOpen: false });
        window.CiltGPTRender();
      });
    });

    const customerModal = document.querySelector("[data-customer-modal]");
    if (customerModal && customerModal.dataset.boundBackdropClose !== "true") {
      customerModal.dataset.boundBackdropClose = "true";
      customerModal.addEventListener("click", (event) => {
        if (event.target !== customerModal) return;
        setState({ customerModalOpen: false });
        window.CiltGPTRender();
      });
    }

    const modalForm = document.querySelector("#analysis-customer-modal-form");
    if (modalForm && modalForm.dataset.boundCustomerSubmit !== "true") {
      modalForm.dataset.boundCustomerSubmit = "true";
      modalForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = modalForm.querySelector('button[type="submit"]');
        const message = modalForm.querySelector("#analysis-customer-modal-message");
        const formData = new FormData(modalForm);
        const fullName = String(formData.get("fullName") || "").trim();
        const phone = String(formData.get("phone") || "").trim();

        if (message) message.hidden = true;

        if (!fullName || !phone) {
          if (message) {
            message.textContent = "Ad soyad ve telefon zorunludur.";
            message.hidden = false;
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
          if (!response.ok) throw new Error(payload.message || "Müşteri kaydedilirken bir hata oluştu.");

          const createdCustomer = payload.customer;
          const state = getState();
          const dbCustomers = [createdCustomer, ...availableCustomers(state).filter((customer) => customer.id !== createdCustomer.id)];
          setState({
            dbCustomers,
            selectedCustomerId: createdCustomer.id,
            customerSearch: createdCustomer.fullName,
            customerModalOpen: false,
            warning: "",
          });
          window.CiltGPTRender();
        } catch (error) {
          if (message) {
            message.textContent = error instanceof Error ? error.message : "Müşteri kaydedilirken bir hata oluştu.";
            message.hidden = false;
          }
        } finally {
          if (button) button.disabled = false;
        }
      });
    }

    if (!form) return;

    function renderWizardWithoutStealingFocus() {
      const active = document.activeElement;
      const isEditing =
        active &&
        form &&
        form.contains(active) &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);

      if (!isEditing) {
        window.CiltGPTRender();
        return;
      }

      const results = form.querySelector("[data-customer-search-results]");
      if (results) {
        results.innerHTML = customerResultListHtml(getState());
      }
    }

    async function loadCustomers() {
      const state = getState();
      if (!state.isLoadingCustomers && state.dbCustomers && state.dbCustomers.length) return;

      try {
        const response = await fetch("/api/customers");
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Müşteri listesi alınamadı.");
        const dbCustomers = payload.customers || [];
        const selectedStillExists =
          state.selectedCustomerId === "new" || dbCustomers.some((customer) => customer.id === state.selectedCustomerId);
        setState({
          dbCustomers,
          isLoadingCustomers: false,
          customersError: "",
          selectedCustomerId: selectedStillExists ? state.selectedCustomerId : "",
        });
      } catch (error) {
        setState({
          dbCustomers: [],
          isLoadingCustomers: false,
          customersError: error instanceof Error ? error.message : "Müşteri listesi alınamadı.",
        });
      }

      renderWizardWithoutStealingFocus();
    }

    async function loadSubscription() {
      const state = getState();
      if (!state.isLoadingSubscription && state.subscription) return;

      try {
        const response = await fetch("/api/subscription");
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Abonelik bilgisi alınamadı.");
        setState({ subscription: payload.subscription, isLoadingSubscription: false });
        window.CiltGPTSubscription.currentSubscription = payload.subscription;
        window.CiltGPTSubscription.usageStats = payload.subscription.usage;
      } catch {
        setState({ subscription: null, isLoadingSubscription: false });
      }

      renderWizardWithoutStealingFocus();
    }

    loadCustomers();
    loadSubscription();

    form.addEventListener("change", async (event) => {
      const state = getState();
      if (event.target.matches("[data-photo-key]")) {
        const key = event.target.dataset.photoKey;
        const file = event.target.files[0];
        if (!file) {
          setState({ photos: { ...state.photos, [key]: "" }, warning: "" });
          window.CiltGPTRender();
          return;
        }

        try {
          const preview = await resizePhotoFile(file);
          setState({
            photos: {
              ...getState().photos,
              [key]: {
                name: file.name,
                preview,
              },
            },
            warning: "",
          });
          window.CiltGPTRender();
        } catch (error) {
          console.error(error);
          setState({ warning: "Fotoğraf hazırlanırken bir hata oluştu." });
          window.CiltGPTRender();
        }
        return;
      }

      readWizardForm();
      if (event.target.name === "selectedCustomerId" || event.target.name === "consent") {
        window.CiltGPTRender();
      }
    });

    form.addEventListener("input", (event) => {
      if (!event.target.matches("[data-customer-search]")) return;

      const nextState = {
        ...getState(),
        customerSearch: event.target.value,
        selectedCustomerId: "",
        warning: "",
      };
      setState({ customerSearch: event.target.value, selectedCustomerId: "", warning: "" });

      const results = form.querySelector("[data-customer-search-results]");
      if (results) {
        results.innerHTML = customerResultListHtml(nextState);
      }
    });

    form.addEventListener("click", (event) => {
      const resultButton = event.target.closest("[data-customer-result]");
      if (!resultButton) return;

      const customerId = resultButton.dataset.customerResult;
      const state = getState();
      const customer = availableCustomers(state).find((item) => item.id === customerId);

      setState({
        selectedCustomerId: customerId,
        customerSearch: customer?.fullName || "",
        warning: "",
      });
      window.CiltGPTRender();
    });

    form.querySelectorAll("[data-wizard-jump]").forEach((button) => {
      button.addEventListener("click", () => {
        readWizardForm();
        const target = Number(button.dataset.wizardJump);
        const state = getState();
        if (target > 0 && !selectedCustomer(state)) {
          setState({ warning: "Devam etmek için listeden bir müşteri seçin.", step: 0 });
        } else if (target > 1 && !state.consent) {
          setState({ warning: "Sonraki adıma geçmek için KVKK / açık rıza onayı zorunludur.", step: 1 });
        } else if (target > 2 && !hasAllRequiredPhotos(state)) {
          setState({ warning: "Devam etmek için 4 fotoğrafın tamamını yükleyin.", step: 2 });
        } else {
          setState({ step: target, warning: "" });
        }
        window.CiltGPTRender();
      });
    });

    const prev = form.querySelector("[data-wizard-prev]");
    if (prev) {
      prev.addEventListener("click", () => {
        readWizardForm();
        setState({ step: Math.max(0, getState().step - 1), warning: "" });
        window.CiltGPTRender();
      });
    }

    const next = form.querySelector("[data-wizard-next]");
    if (next) {
      next.addEventListener("click", () => {
        readWizardForm();
        const state = getState();
        if (state.step === 0 && !selectedCustomer(state)) {
          setState({ warning: "Devam etmek için listeden bir müşteri seçin.", step: 0 });
        } else if (state.step === 1 && !state.consent) {
          setState({ warning: "Sonraki adıma geçmek için KVKK / açık rıza onayı zorunludur." });
        } else if (state.step === 2 && !hasAllRequiredPhotos(state)) {
          setState({ warning: "Devam etmek için 4 fotoğrafın tamamını yükleyin.", step: 2 });
        } else {
          setState({ step: Math.min(steps.length - 1, state.step + 1), warning: "" });
        }
        window.CiltGPTRender();
      });
    }

    const start = form.querySelector("[data-start-analysis]");
    if (start) {
      start.addEventListener("click", async () => {
        const usage = getState().subscription?.usage || window.CiltGPTSubscription.usageStats;
        if (usage.remainingAnalyses <= 0) {
          setState({ warning: "Bu ayki analiz limitiniz dolmuştur. Paketinizi yükseltin." });
          window.CiltGPTRender();
          return;
        }

        readWizardForm();
        const state = getState();
        const customer = selectedCustomer(state);
        const validationError = validateAnalysisStart(state, customer);

        if (validationError) {
          setState({
            warning: validationError,
            step: state.selectedCustomerId === "new" || !customer ? 0 : !hasAllRequiredPhotos(state) ? 2 : state.step,
          });
          window.CiltGPTRender();
          return;
        }

        try {
          start.disabled = true;
          const response = await fetch("/api/analyses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerId: customer.id === "new" ? "new" : customer.id,
              customerName: customer.fullName,
              newCustomer: state.newCustomer,
              consentAccepted: state.consent,
              age: customer.age,
              gender: customer.gender,
              photos: Object.fromEntries(
                Object.entries(state.photos || {}).map(([key, photo]) => [
                  key,
                  typeof photo === "string" ? photo : photo?.preview || "",
                ]),
              ),
              skinType: state.skinType,
              mainConcern: state.complaint,
              spfUsage: state.spf,
              homeCareRoutine: state.routine,
              notes: state.notes,
            }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.detail || payload.message || "Analiz oluşturulurken bir hata oluştu.");

          if (payload.subscription) {
            setState({ subscription: payload.subscription, isLoadingSubscription: false });
            window.CiltGPTSubscription.currentSubscription = payload.subscription;
            window.CiltGPTSubscription.usageStats = payload.subscription.usage;
          }
          sessionStorage.setItem("latestAnalysisReport", JSON.stringify(payload.report));
          navigate(`/dashboard/reports/${payload.reportId}`);
        } catch (error) {
          console.error(error);
          setState({ warning: error instanceof Error ? error.message : "Analiz oluşturulurken bir hata oluştu." });
          window.CiltGPTRender();
        } finally {
          start.disabled = false;
        }
      });
    }
  }

  window.CiltGPTWizard = {
    renderAnalysisWizard,
    bindAnalysisWizard,
    getState,
    selectedCustomer,
  };
})();

