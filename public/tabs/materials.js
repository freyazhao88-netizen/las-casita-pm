"use strict";
window.MaterialsTab = (function () {
  const A = window.App;
  let bound = false;

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.getElementById("matDate").value = A.todayISO();
    document.getElementById("matProjectFilter").addEventListener("change", renderMaterials);
    document.getElementById("matStatusFilter").addEventListener("change", renderMaterials);

    document.getElementById("matMode").addEventListener("change", (e) => {
      const isQty = e.target.value === "qty";
      document.getElementById("matFlatField").hidden = isQty;
      document.getElementById("matQtyField").hidden = !isQty;
      document.getElementById("matUnitPriceField").hidden = !isQty;
    });

    document.getElementById("matForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        purchaseDate: document.getElementById("matDate").value,
        projectId: document.getElementById("matProject").value,
        vendor: document.getElementById("matVendor").value,
        category: document.getElementById("matCategory").value,
        description: document.getElementById("matDescription").value,
        mode: document.getElementById("matMode").value,
        amount: document.getElementById("matAmount").value,
        qty: document.getElementById("matQty").value,
        unitPrice: document.getElementById("matUnitPrice").value,
        paymentStatus: document.getElementById("matPaymentStatus").value,
        paymentMethod: document.getElementById("matPaymentMethod").value,
        invoiceNumber: document.getElementById("matInvoice").value
      };
      if (!body.projectId) { A.toast("Pick a project"); return; }
      await A.api("/materials", { method: "POST", body });
      document.getElementById("matVendor").value = "";
      document.getElementById("matCategory").value = "";
      document.getElementById("matDescription").value = "";
      document.getElementById("matAmount").value = "";
      document.getElementById("matQty").value = "";
      document.getElementById("matUnitPrice").value = "";
      document.getElementById("matPaymentMethod").value = "";
      document.getElementById("matInvoice").value = "";
      A.toast("Purchase logged");
      renderMaterials();
    });

    document.getElementById("expDate").value = A.todayISO();
    document.getElementById("expProjectFilter").addEventListener("change", renderExpenses);

    document.getElementById("expStatus").addEventListener("change", (e) => {
      document.getElementById("expPaymentMethodField").hidden = e.target.value !== "reimbursed";
    });

    document.getElementById("expForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        expenseDate: document.getElementById("expDate").value,
        projectId: document.getElementById("expProject").value,
        category: document.getElementById("expCategory").value,
        description: document.getElementById("expDescription").value,
        amount: document.getElementById("expAmount").value,
        status: document.getElementById("expStatus").value,
        paymentMethod: document.getElementById("expPaymentMethod").value,
        notes: document.getElementById("expNotes").value
      };
      if (!body.projectId) { A.toast("Pick a project"); return; }
      await A.api("/expenses", { method: "POST", body });
      document.getElementById("expCategory").value = "";
      document.getElementById("expDescription").value = "";
      document.getElementById("expAmount").value = "";
      document.getElementById("expPaymentMethod").value = "";
      document.getElementById("expNotes").value = "";
      A.toast("Expense logged");
      renderExpenses();
    });
  }

  async function render() {
    bindOnce();
    await Promise.all([renderMaterials(), renderExpenses()]);
  }

  async function renderMaterials() {
    const catList = document.getElementById("matCategoryList");
    if (!catList.childElementCount) {
      const cats = await A.api("/category-library");
      catList.innerHTML = cats.map((c) => '<option value="' + A.esc(c) + '">').join("");
    }
    const projectId = document.getElementById("matProjectFilter").value;
    const projectStatus = document.getElementById("matStatusFilter").value;
    const params = [];
    if (projectId) params.push("projectId=" + projectId);
    if (projectStatus) params.push("projectStatus=" + projectStatus);
    const list = await A.api("/materials" + (params.length ? "?" + params.join("&") : ""));
    const tbody = document.querySelector("#matTable tbody");
    if (!list.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No purchases logged yet.</td></tr>';
    } else {
      tbody.innerHTML = list.map((m) => (
        '<tr>' +
          '<td>' + m.purchaseDate + '</td>' +
          '<td>' + A.esc(A.projectName(m.projectId)) + '</td>' +
          '<td>' + A.esc(m.vendor) + '</td>' +
          '<td>' + A.esc(m.category) + '</td>' +
          '<td>' + A.esc(m.description) + (m.mode === "qty" ? ' <span style="color:var(--muted)">(' + m.qty + ' × ' + A.fmtMoney(m.unitPrice) + ')</span>' : '') + '</td>' +
          '<td class="amt num">' + A.fmtMoney(m.amount) + '</td>' +
          '<td><button class="payment-pill ' + (m.paymentStatus === "paid" ? "paid" : "unpaid") + '" data-id="' + m.id + '">' + (m.paymentStatus === "paid" ? "Paid" : "Unpaid") + (m.paymentMethod ? " · " + A.esc(m.paymentMethod) : "") + '</button></td>' +
          '<td><button class="row-del" data-id="' + m.id + '" title="Delete">✕</button></td>' +
        '</tr>'
      )).join("");
      tbody.querySelectorAll(".row-del").forEach((btn) => {
        btn.addEventListener("click", async () => {
          await A.api("/materials/" + btn.getAttribute("data-id"), { method: "DELETE" });
          renderMaterials();
        });
      });
      tbody.querySelectorAll(".payment-pill").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const next = btn.classList.contains("paid") ? "unpaid" : "paid";
          await A.api("/materials/" + btn.getAttribute("data-id"), { method: "PUT", body: { paymentStatus: next } });
          renderMaterials();
        });
      });
    }
    const total = list.reduce((s, m) => s + m.amount, 0);
    const unpaid = list.filter((m) => m.paymentStatus !== "paid").reduce((s, m) => s + m.amount, 0);
    document.getElementById("matTotalHint").textContent = list.length
      ? ("Total: " + A.fmtMoney(total) + (unpaid > 0.005 ? "  ·  Unpaid: " + A.fmtMoney(unpaid) : ""))
      : "";
  }

  async function renderExpenses() {
    const catList = document.getElementById("expCategoryList");
    if (!catList.childElementCount) {
      const cats = await A.api("/expense-category-library");
      catList.innerHTML = cats.map((c) => '<option value="' + A.esc(c) + '">').join("");
    }
    const projectId = document.getElementById("expProjectFilter").value;
    const list = await A.api("/expenses" + (projectId ? "?projectId=" + projectId : ""));
    const tbody = document.querySelector("#expTable tbody");
    if (!list.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No expenses logged yet.</td></tr>';
    } else {
      tbody.innerHTML = list.map((e) => (
        '<tr>' +
          '<td>' + e.expenseDate + '</td>' +
          '<td>' + A.esc(A.projectName(e.projectId)) + '</td>' +
          '<td>' + A.esc(e.category) + '</td>' +
          '<td>' + A.esc(e.description) + '</td>' +
          '<td class="amt num">' + A.fmtMoney(e.amount) + '</td>' +
          '<td><button class="payment-pill ' + (e.status === "reimbursed" ? "paid" : "unpaid") + '" data-id="' + e.id + '">' + (e.status === "reimbursed" ? "Reimbursed" : "Unreimbursed") + (e.status === "reimbursed" && e.paymentMethod ? " · " + A.esc(e.paymentMethod) : "") + '</button></td>' +
          '<td>' + A.esc(e.notes) + '</td>' +
          '<td><button class="row-del" data-id="' + e.id + '" title="Delete">✕</button></td>' +
        '</tr>'
      )).join("");
      tbody.querySelectorAll(".row-del").forEach((btn) => {
        btn.addEventListener("click", async () => {
          await A.api("/expenses/" + btn.getAttribute("data-id"), { method: "DELETE" });
          renderExpenses();
        });
      });
      tbody.querySelectorAll(".payment-pill").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const next = btn.classList.contains("paid") ? "unreimbursed" : "reimbursed";
          await A.api("/expenses/" + btn.getAttribute("data-id"), { method: "PUT", body: { status: next } });
          renderExpenses();
        });
      });
    }
    const total = list.reduce((s, e) => s + e.amount, 0);
    const unreimbursed = list.filter((e) => e.status !== "reimbursed").reduce((s, e) => s + e.amount, 0);
    document.getElementById("expTotalHint").textContent = list.length
      ? ("Total: " + A.fmtMoney(total) + (unreimbursed > 0.005 ? "  ·  Unreimbursed: " + A.fmtMoney(unreimbursed) : ""))
      : "";
  }

  return { render };
})();
