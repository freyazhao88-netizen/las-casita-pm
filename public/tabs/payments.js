"use strict";
window.PaymentsTab = (function () {
  const A = window.App;
  let bound = false;
  let companySettings = null;

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.getElementById("payDate").value = A.todayISO();
    document.getElementById("payProjectFilter").addEventListener("change", render);

    document.getElementById("payForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const projectInput = A.resolveProjectInput(document.getElementById("payProject").value);
      if (!projectInput.projectId && !projectInput.adhocProjectName) { A.toast("Pick or type a project"); return; }
      const body = Object.assign({
        paymentDate: document.getElementById("payDate").value,
        amount: document.getElementById("payAmount").value,
        method: document.getElementById("payMethod").value,
        reference: document.getElementById("payReference").value,
        notes: document.getElementById("payNotes").value
      }, projectInput);
      await A.api("/payments", { method: "POST", body });
      document.getElementById("payProject").value = "";
      document.getElementById("payAmount").value = "";
      document.getElementById("payMethod").value = "";
      document.getElementById("payReference").value = "";
      document.getElementById("payNotes").value = "";
      A.toast("Payment logged");
      render();
    });

    document.getElementById("wageDate").value = A.todayISO();
    document.getElementById("wageEmployeeFilter").addEventListener("change", render);
    A.populateMonthSelect(document.getElementById("wageBalanceMonth"), 24);
    document.getElementById("wageBalanceMonth").addEventListener("change", render);

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
          '<td>' + A.esc(A.projectNameOf(p)) + '</td>' +
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
    const balanceMonth = document.getElementById("wageBalanceMonth").value || A.currentMonth();
    const [list, balances] = await Promise.all([
      A.api("/wage-payments" + (employeeId ? "?employeeId=" + employeeId : "")),
      A.api("/payroll-balances?month=" + balanceMonth)
    ]);

    const monthLabel = monthLabelOf(balanceMonth);
    const balHost = document.getElementById("wageBalances");
    if (!balances.length) {
      balHost.innerHTML = '<div class="empty-state">No employees yet.</div>';
    } else {
      balHost.innerHTML = balances.map((b) => (
        '<div class="emp-summary-block">' +
          '<div class="head"><span>' + A.esc(b.employeeName) + '</span><span class="wage num" style="' + (b.balanceCarriedForward > 0.005 ? 'color:var(--bad)' : 'color:var(--good)') + '">' + A.fmtMoney(b.balanceCarriedForward) + '</span></div>' +
          '<div class="proj-line"><span>Balance brought forward</span><span class="num">' + A.fmtMoney(b.balanceBroughtForward) + '</span></div>' +
          '<div class="proj-line"><span>Earned in ' + A.esc(monthLabel) + '</span><span class="num">+' + A.fmtMoney(b.thisMonthOwed) + '</span></div>' +
          '<div class="proj-line"><span>Paid in ' + A.esc(monthLabel) + '</span><span class="num">−' + A.fmtMoney(b.thisMonthPaid) + '</span></div>' +
          '<div class="proj-line" style="font-weight:600;border-top:1px solid var(--line);padding-top:6px;margin-top:4px;"><span>Balance carried forward</span><span class="num">' + A.fmtMoney(b.balanceCarriedForward) + '</span></div>' +
          '<button class="btn btn-sm" data-wage-statement="' + b.employeeId + '" style="margin-top:9px;width:100%;">🖨 Print ' + A.esc(monthLabel) + ' statement</button>' +
        '</div>'
      )).join("");
      balHost.querySelectorAll("[data-wage-statement]").forEach((btn) => {
        btn.addEventListener("click", () => printWageStatement(Number(btn.getAttribute("data-wage-statement")), balanceMonth));
      });
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

  function monthLabelOf(month) {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { year: "numeric", month: "long" });
  }

  async function printWageStatement(employeeId, month) {
    if (!companySettings) companySettings = await A.api("/settings");
    const [attendance, wagePayments, balances] = await Promise.all([
      A.api("/attendance?employeeId=" + employeeId),
      A.api("/wage-payments?employeeId=" + employeeId),
      A.api("/payroll-balances?month=" + month)
    ]);
    const employee = A.state.employees.find((e) => e.id === employeeId);
    const bal = balances.find((b) => b.employeeId === employeeId) ||
      { balanceBroughtForward: 0, balanceCarriedForward: 0 };

    const inMonth = (dateStr) => !!dateStr && dateStr.slice(0, 7) === month;
    const lines = [];
    attendance.filter((a) => inMonth(a.workDate)).forEach((a) => lines.push({
      date: a.workDate,
      description: "Worked — " + A.projectName(a.projectId) + " (" + a.days + " d × " + A.fmtMoney(a.rate) + ")",
      amount: a.cost
    }));
    wagePayments.filter((p) => inMonth(p.paymentDate)).forEach((p) => lines.push({
      date: p.paymentDate,
      description: "Payment" + (p.method ? " — " + p.method : "") + (p.notes ? " (" + p.notes + ")" : ""),
      amount: -(Number(p.amount) || 0)
    }));
    lines.sort((a, b) => a.date.localeCompare(b.date));

    let running = bal.balanceBroughtForward;
    const rowsHtml = lines.map((l) => {
      running += l.amount;
      return '<tr><td class="cat">' + A.esc(A.fmtDate(l.date)) + '</td>' +
        '<td class="desc">' + A.esc(l.description) + '</td>' +
        '<td class="amt num">' + (l.amount >= 0 ? "+" : "") + A.fmtMoney(l.amount) + '</td>' +
        '<td class="amt num">' + A.fmtMoney(running) + '</td></tr>';
    }).join("") || '<tr><td colspan="4" style="padding:16px 0;color:var(--muted);font-size:12px;">No activity this month.</td></tr>';

    const monthLabel = monthLabelOf(month);
    const c = companySettings;
    const html =
      '<div class="qs-head">' +
        '<div class="qs-logo"><img src="/logo.jpg" alt="' + A.esc(c.companyName || "Las Casita Inc.") + '" class="qs-logo-img"></div>' +
        '<div class="qs-title"><h3>Wage Statement</h3></div>' +
      '</div>' +
      '<div class="qs-meta">' +
        '<div class="col"><p><strong>' + A.esc(c.companyName || "") + '</strong></p><p class="muted">' + A.esc(c.companyAddr1 || "") + '</p><p class="muted">' + A.esc(c.companyAddr2 || "") + '</p></div>' +
        '<div class="col right"><p><span class="muted">For:</span> ' + A.esc(monthLabel) + '</p><p><span class="muted">Employee:</span> ' + A.esc(employee ? employee.name : "") + '</p></div>' +
      '</div>' +
      '<table class="qs-table"><thead><tr><th>Date</th><th>Description</th><th class="amt">Amount</th><th class="amt">Balance</th></tr></thead>' +
      '<tbody>' +
      '<tr><td class="cat">' + A.esc(A.fmtDate(month + "-01")) + '</td><td class="desc">Balance brought forward</td><td class="amt num"></td><td class="amt num">' + A.fmtMoney(bal.balanceBroughtForward) + '</td></tr>' +
      rowsHtml +
      '<tr class="qs-total-row"><td colspan="3">Balance carried forward (end of ' + A.esc(monthLabel) + ')</td><td class="amt num">' + A.fmtMoney(bal.balanceCarriedForward) + '</td></tr>' +
      '</tbody></table>' +
      '<p class="qs-auth">This statement lists the balance brought forward plus every day worked and every payment made during ' + A.esc(monthLabel) + '. I confirm the entries above are accurate.</p>' +
      '<div class="qs-sign"><div class="line"><hr class="rule"><div class="cap"><span>' + A.esc(employee ? employee.name : "Employee") + '</span><span>Date</span></div></div>' +
        '<div class="line"><hr class="rule"><div class="cap"><span>' + A.esc((c.companyName || "").replace(/ Inc\.?$/, "")) + '</span><span>Date</span></div></div></div>';

    A.showPrintSheet(html);
  }

  return { render };
})();
