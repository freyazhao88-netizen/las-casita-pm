"use strict";
window.MaterialsTab = (function () {
  const A = window.App;
  let bound = false;
  let pendingReceiptTarget = null;

  function receiptCell(collection, id, hasReceipt) {
    return hasReceipt
      ? '<button class="receipt-btn" data-action="view" data-collection="' + collection + '" data-id="' + id + '">📎 View</button>' +
        '<button class="receipt-btn" data-action="replace" data-collection="' + collection + '" data-id="' + id + '" title="Replace">⟳</button>'
      : '<button class="receipt-btn" data-action="add" data-collection="' + collection + '" data-id="' + id + '">+ Add</button>';
  }

  function bindReceiptCell(tbody) {
    tbody.querySelectorAll(".receipt-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const collection = btn.getAttribute("data-collection");
        const id = btn.getAttribute("data-id");
        const action = btn.getAttribute("data-action");
        if (action === "view") {
          try {
            const data = await A.api("/" + collection + "/" + id + "/receipt");
            window.open(data.url, "_blank");
          } catch (e) { /* A.api already shows a toast */ }
        } else {
          pendingReceiptTarget = { collection, id };
          document.getElementById(collection === "materials" ? "matReceiptInput" : "expReceiptInput").click();
        }
      });
    });
  }

  async function handleReceiptFileChosen(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file || !pendingReceiptTarget) return;
    const { collection, id } = pendingReceiptTarget;
    pendingReceiptTarget = null;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/" + collection + "/" + id + "/receipt", { method: "POST", body: fd, credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { A.toast(data.error || "Upload failed"); return; }
    A.toast("Receipt uploaded");
    if (collection === "materials") renderMaterials(); else renderExpenses();
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.getElementById("matDate").value = A.todayISO();
    document.getElementById("matProjectFilter").addEventListener("change", renderMaterials);
    document.getElementById("matStatusFilter").addEventListener("change", renderMaterials);

    document.getElementById("matReceiptInput").addEventListener("change", handleReceiptFileChosen);
    document.getElementById("expReceiptInput").addEventListener("change", handleReceiptFileChosen);

    document.getElementById("matMode").addEventListener("change", (e) => {
      const isQty = e.target.value === "qty";
      document.getElementById("matFlatField").hidden = isQty;
      document.getElementById("matQtyField").hidden = !isQty;
      document.getElementById("matUnitPriceField").hidden = !isQty;
    });

    document.getElementById("matForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const projectInput = A.resolveProjectInput(document.getElementById("matProject").value);
      if (!projectInput.projectId && !projectInput.adhocProjectName) { A.toast("Pick or type a project"); return; }
      const body = Object.assign({
        purchaseDate: document.getElementById("matDate").value,
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
      }, projectInput);
      await A.api("/materials", { method: "POST", body });
      document.getElementById("matProject").value = "";
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
      const projectInput = A.resolveProjectInput(document.getElementById("expProject").value);
      if (!projectInput.projectId && !projectInput.adhocProjectName) { A.toast("Pick or type a project"); return; }
      const body = Object.assign({
        expenseDate: document.getElementById("expDate").value,
        category: document.getElementById("expCategory").value,
        description: document.getElementById("expDescription").value,
        amount: document.getElementById("expAmount").value,
        status: document.getElementById("expStatus").value,
        paymentMethod: document.getElementById("expPaymentMethod").value,
        notes: document.getElementById("expNotes").value
      }, projectInput);
      await A.api("/expenses", { method: "POST", body });
      document.getElementById("expProject").value = "";
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
      tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No purchases logged yet.</td></tr>';
    } else {
      tbody.innerHTML = list.map((m) => (
        '<tr>' +
          '<td>' + m.purchaseDate + '</td>' +
          '<td>' + A.esc(A.projectNameOf(m)) + '</td>' +
          '<td>' + A.esc(m.vendor) + '</td>' +
          '<td>' + A.esc(m.category) + '</td>' +
          '<td>' + A.esc(m.description) + (m.mode === "qty" ? ' <span style="color:var(--muted)">(' + m.qty + ' × ' + A.fmtMoney(m.unitPrice) + ')</span>' : '') + '</td>' +
          '<td class="amt num">' + A.fmtMoney(m.amount) + '</td>' +
          '<td><button class="payment-pill ' + (m.paymentStatus === "paid" ? "paid" : "unpaid") + '" data-id="' + m.id + '">' + (m.paymentStatus === "paid" ? "Paid" : "Unpaid") + (m.paymentMethod ? " · " + A.esc(m.paymentMethod) : "") + '</button></td>' +
          '<td>' + receiptCell("materials", m.id, !!m.receiptPath) + '</td>' +
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
      bindReceiptCell(tbody);
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
      tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No expenses logged yet.</td></tr>';
    } else {
      tbody.innerHTML = list.map((e) => (
        '<tr>' +
          '<td>' + e.expenseDate + '</td>' +
          '<td>' + A.esc(A.projectNameOf(e)) + '</td>' +
          '<td>' + A.esc(e.category) + '</td>' +
          '<td>' + A.esc(e.description) + '</td>' +
          '<td class="amt num">' + A.fmtMoney(e.amount) + '</td>' +
          '<td><button class="payment-pill ' + (e.status === "reimbursed" ? "paid" : "unpaid") + '" data-id="' + e.id + '">' + (e.status === "reimbursed" ? "Paid" : "Unpaid") + (e.status === "reimbursed" && e.paymentMethod ? " · " + A.esc(e.paymentMethod) : "") + '</button></td>' +
          '<td>' + A.esc(e.notes) + '</td>' +
          '<td>' + receiptCell("expenses", e.id, !!e.receiptPath) + '</td>' +
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
      bindReceiptCell(tbody);
    }
    const total = list.reduce((s, e) => s + e.amount, 0);
    const unreimbursed = list.filter((e) => e.status !== "reimbursed").reduce((s, e) => s + e.amount, 0);
    document.getElementById("expTotalHint").textContent = list.length
      ? ("Total: " + A.fmtMoney(total) + (unreimbursed > 0.005 ? "  ·  Unpaid: " + A.fmtMoney(unreimbursed) : ""))
      : "";
  }

  return { render };
})();
