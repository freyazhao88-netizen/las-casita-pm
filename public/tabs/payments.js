"use strict";
window.PaymentsTab = (function () {
  const A = window.App;
  let bound = false;

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.getElementById("payDate").value = A.todayISO();
    document.getElementById("payProjectFilter").addEventListener("change", render);

    document.getElementById("payForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        paymentDate: document.getElementById("payDate").value,
        projectId: document.getElementById("payProject").value,
        amount: document.getElementById("payAmount").value,
        method: document.getElementById("payMethod").value,
        reference: document.getElementById("payReference").value,
        notes: document.getElementById("payNotes").value
      };
      if (!body.projectId) { A.toast("Pick a project"); return; }
      await A.api("/payments", { method: "POST", body });
      document.getElementById("payAmount").value = "";
      document.getElementById("payMethod").value = "";
      document.getElementById("payReference").value = "";
      document.getElementById("payNotes").value = "";
      A.toast("Payment logged");
      render();
    });

    document.getElementById("wageDate").value = A.todayISO();
    document.getElementById("wageEmployeeFilter").addEventListener("change", render);

    document.getElementById("wageForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        paymentDate: document.getElementById("wageDate").value,
        employeeId: document.getElementById("wageEmployee").value,
        amount: document.getElementById("wageAmount").value,
        method: document.getElementById("wageMethod").value,
        notes: document.getElementById("wageNotes").value
      };
      if (!body.employeeId) { A.toast("Pick an employee"); return; }
      await A.api("/wage-payments", { method: "POST", body });
      document.getElementById("wageAmount").value = "";
      document.getElementById("wageMethod").value = "";
      document.getElementById("wageNotes").value = "";
      A.toast("Payment logged");
      render();
    });
  }

  async function render() {
    bindOnce();
    await Promise.all([renderClientPayments(), renderPayroll()]);
  }

  async function renderClientPayments() {
    const projectId = document.getElementById("payProjectFilter").value;
    const list = await A.api("/payments" + (projectId ? "?projectId=" + projectId : ""));
    const tbody = document.querySelector("#payTable tbody");
    if (!list.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No payments logged yet.</td></tr>';
    } else {
      tbody.innerHTML = list.map((p) => (
        '<tr>' +
          '<td>' + p.paymentDate + '</td>' +
          '<td>' + A.esc(A.projectName(p.projectId)) + '</td>' +
          '<td class="amt num">' + A.fmtMoney(p.amount) + '</td>' +
          '<td>' + A.esc(p.method) + '</td>' +
          '<td>' + A.esc(p.reference) + '</td>' +
          '<td>' + A.esc(p.notes) + '</td>' +
          '<td><button class="row-del" data-id="' + p.id + '" title="Delete">✕</button></td>' +
        '</tr>'
      )).join("");
      tbody.querySelectorAll(".row-del").forEach((btn) => {
        btn.addEventListener("click", async () => {
          await A.api("/payments/" + btn.getAttribute("data-id"), { method: "DELETE" });
          render();
        });
      });
    }
    const total = list.reduce((s, p) => s + p.amount, 0);
    document.getElementById("payTotalHint").textContent = list.length ? ("Total received: " + A.fmtMoney(total)) : "";
  }

  async function renderPayroll() {
    const employeeId = document.getElementById("wageEmployeeFilter").value;
    const [list, balances] = await Promise.all([
      A.api("/wage-payments" + (employeeId ? "?employeeId=" + employeeId : "")),
      A.api("/payroll-balances")
    ]);

    const balHost = document.getElementById("wageBalances");
    if (!balances.length) {
      balHost.innerHTML = '<div class="empty-state">No employees yet.</div>';
    } else {
      balHost.innerHTML = balances.map((b) => (
        '<div class="emp-summary-block">' +
          '<div class="head"><span>' + A.esc(b.employeeName) + '</span><span class="wage num" style="' + (b.balance > 0.005 ? 'color:var(--bad)' : 'color:var(--good)') + '">' + A.fmtMoney(b.balance) + '</span></div>' +
          '<div class="proj-line"><span>Earned to date</span><span class="num">' + A.fmtMoney(b.totalOwed) + '</span></div>' +
          '<div class="proj-line"><span>Paid to date</span><span class="num">' + A.fmtMoney(b.totalPaid) + '</span></div>' +
          '<div class="proj-line"><span>Earned this month</span><span class="num">' + A.fmtMoney(b.thisMonthOwed) + '</span></div>' +
        '</div>'
      )).join("");
    }

    const tbody = document.querySelector("#wageTable tbody");
    if (!list.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No payroll payments logged yet.</td></tr>';
    } else {
      tbody.innerHTML = list.map((p) => (
        '<tr>' +
          '<td>' + p.paymentDate + '</td>' +
          '<td>' + A.esc(A.employeeName(p.employeeId)) + '</td>' +
          '<td class="amt num">' + A.fmtMoney(p.amount) + '</td>' +
          '<td>' + A.esc(p.method) + '</td>' +
          '<td>' + A.esc(p.notes) + '</td>' +
          '<td><button class="row-del" data-id="' + p.id + '" title="Delete">✕</button></td>' +
        '</tr>'
      )).join("");
      tbody.querySelectorAll(".row-del").forEach((btn) => {
        btn.addEventListener("click", async () => {
          await A.api("/wage-payments/" + btn.getAttribute("data-id"), { method: "DELETE" });
          render();
        });
      });
    }
    const total = list.reduce((s, p) => s + p.amount, 0);
    document.getElementById("wageTotalHint").textContent = list.length ? ("Total paid: " + A.fmtMoney(total)) : "";
  }

  return { render };
})();
