(function () {
  function TeamSummaryCards(members) {
    const active = members.filter((member) => member.status === "Aktif").length;
    const managers = members.filter((member) => member.role === "Salon Yöneticisi").length;
    const specialists = members.filter((member) => member.role === "Analiz Uzmanı").length;

    return `
      <section class="stats-grid team-stats">
        <article class="stat-card"><span>Toplam kullanıcı</span><strong>${members.length}</strong></article>
        <article class="stat-card"><span>Aktif kullanıcı</span><strong>${active}</strong></article>
        <article class="stat-card"><span>Yönetici</span><strong>${managers}</strong></article>
        <article class="stat-card"><span>Analiz uzmanı</span><strong>${specialists}</strong></article>
      </section>
    `;
  }

  function TeamMemberTable(members) {
    const rows = members
      .map(
        (member) => `
          <tr>
            <td>${member.fullName}</td>
            <td>${member.email}</td>
            <td>${member.role}</td>
            <td><span class="status ${member.status === "Pasif" ? "inactive" : ""}">${member.status}</span></td>
            <td>${member.lastLogin}</td>
            <td><button class="table-action muted-action" type="button">Düzenle</button></td>
          </tr>
        `,
      )
      .join("");

    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ad Soyad</th><th>E-posta</th><th>Rol</th><th>Durum</th><th>Son giriş</th><th>İşlem</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function RolePermissionCards(roles, roleCounts = {}) {
    return `
      <div class="role-card-grid">
        ${roles
          .map(
            (role) => `
              <article class="role-card">
                <h3>${role.name}</h3>
                <p class="role-count">${roleCounts[role.name] ? `${roleCounts[role.name]} adet mevcut` : "Henüz ekip üyesi yok"}</p>
                <ul>${role.permissions.map((permission) => `<li>${permission}</li>`).join("")}</ul>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function InviteMemberForm(roles, isLimitFull) {
    return `
      <form class="customer-form" id="invite-member-form">
        <div class="form-grid">
          <label><span>Ad Soyad</span><input name="fullName" type="text" placeholder="Yeni ekip üyesi" ${isLimitFull ? "disabled" : "required"} /></label>
          <label><span>E-posta</span><input name="email" type="email" placeholder="ornek@salon.com" ${isLimitFull ? "disabled" : "required"} /></label>
          <label><span>Kullanıcı adı</span><input name="username" type="text" placeholder="ornek.kullanici" ${isLimitFull ? "disabled" : "required"} /></label>
          <label><span>Şifre</span><input name="password" type="password" placeholder="En az 6 karakter" minlength="6" ${isLimitFull ? "disabled" : "required"} /></label>
          <label>
            <span>Rol</span>
            <select name="role" ${isLimitFull ? "disabled" : "required"}>
              ${roles.map((role) => `<option>${role.name}</option>`).join("")}
            </select>
          </label>
        </div>
        <button class="button" type="submit" ${isLimitFull ? "disabled" : ""}>Davet gönder</button>
      </form>
    `;
  }

  window.CiltGPTTeamComponents = {
    TeamSummaryCards,
    TeamMemberTable,
    RolePermissionCards,
    InviteMemberForm,
  };
})();

