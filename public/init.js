"use strict";
(function () {
  const A = window.App;

  async function checkSession() {
    const res = await fetch("/api/session", { credentials: "same-origin" });
    return res.json();
  }

  async function boot() {
    const session = await checkSession();
    if (session.loggedIn) { showApp(session.email); }
    else { showLogin(); }
  }

  function showLogin() {
    document.getElementById("loginScreen").hidden = false;
    document.getElementById("app").hidden = true;
  }

  async function showApp(email) {
    document.getElementById("loginScreen").hidden = true;
    document.getElementById("app").hidden = false;
    if (email) document.getElementById("sidebarUserEmail").textContent = email;
    await A.loadCoreData();
    const savedTab = (function () { try { return localStorage.getItem("lc-active-tab"); } catch (e) { return null; } })();
    A.switchTab(savedTab || "dashboard");
  }

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const pw = document.getElementById("loginPassword").value;
    const errEl = document.getElementById("loginError");
    errEl.hidden = true;
    try {
      const res = await fetch("/api/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }), credentials: "same-origin"
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Incorrect email or password");
      document.getElementById("loginPassword").value = "";
      showApp(data.email);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });

  document.getElementById("btnLogout").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    showLogin();
  });

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => A.switchTab(btn.dataset.tab));
  });

  /* ---------------- Settings modal ---------------- */
  const modal = document.getElementById("settingsModal");
  document.getElementById("btnSettings").addEventListener("click", async () => {
    const s = await A.api("/settings");
    document.getElementById("setCompanyName").value = s.companyName || "";
    document.getElementById("setAddr1").value = s.companyAddr1 || "";
    document.getElementById("setAddr2").value = s.companyAddr2 || "";
    document.getElementById("setEmail").value = s.companyEmail || "";
    document.getElementById("setContact1").value = s.contact1 || "";
    document.getElementById("setContact2").value = s.contact2 || "";
    modal.hidden = false;
  });
  document.getElementById("btnCloseSettings").addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });

  document.getElementById("settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await A.api("/settings", { method: "PUT", body: {
      companyName: document.getElementById("setCompanyName").value,
      companyAddr1: document.getElementById("setAddr1").value,
      companyAddr2: document.getElementById("setAddr2").value,
      companyEmail: document.getElementById("setEmail").value,
      contact1: document.getElementById("setContact1").value,
      contact2: document.getElementById("setContact2").value
    }});
    A.toast("Settings saved");
    modal.hidden = true;
  });

  document.getElementById("passwordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById("pwMsg");
    try {
      await A.api("/change-password", { method: "POST", body: {
        currentPassword: document.getElementById("pwCurrent").value,
        newPassword: document.getElementById("pwNew").value
      }});
      msgEl.textContent = "Password updated";
      document.getElementById("passwordForm").reset();
    } catch (err) {
      msgEl.textContent = err.message;
    }
  });

  boot();
})();
