"use strict";
window.AttendanceTab = (function () {
  const A = window.App;
  let bound = false;
  let companySettings = null;

  function bindOnce() {
    if (bound) return;
    bound = true;

    A.populateMonthSelect(document.getElementById("attMonth"), 24);
    document.getElementById("attMonth").addEventListener("change", render);

    document.getElementById("attDateFilter").addEventListener("change", render);
    document.getElementById("attEmployeeFilter").addEventListener("change", render);
    document.getElementById("attProjectFilter").addEventListener("input", render);

    document.getElementById("attDate").value = A.todayISO();

    document.getElementById("attForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const employeeInput = document.getElementById("attEmployee").value.trim();
      const projectInput = A.resolveProjectInput(document.getElementById("attProject").value);
      if (!employeeInput) { A.toast("Pick or type an employee"); return; }
      if (!projectInput.projectId && !projectInput.adhocProjectName) { A.toast("Pick or type a project"); return; }

      const days = Number(document.getElementById("attDays").value) || 0;
      const amount = Number(document.getElementById("attAmount").value) || 0;
      const rate = days > 0 ? amount / days : amount;

      const match = A.findEmployeeByName(employeeInput);
      const body = Object.assign({
        workDate: document.getElementById("attDate").value,
        employeeId: match ? match.id : null,
        adhocEmployeeName: match ? "" : employeeInput,
        days,
        rate,
        notes: document.getElementById("attNotes").value
      }, projectInput);
      await A.api("/attendance", { method: "POST", body });
      document.getElementById("attEmployee").value = "";
      document.getElementById("attProject").value = "";
      document.getElementById("attNotes").value = "";
      document.getElementById("attAmount").value = "";
      A.toast("Entry added");
      render();
    });
  }

  async function render() {
    bindOnce();
    const month = document.getElementById("attMonth").value || A.currentMonth();
    const dateFilter = document.getElementById("attDateFilter").value;
    const employeeFilter = document.getElementById("attEmployeeFilter").value;
    const projectKeyword = document.getElementById("attProjectFilter").value.trim().toLowerCase();
    const params = ["month=" + month];
    if (dateFilter) params.push("date=" + dateFilter);
    if (employeeFilter) params.push("employeeId=" + employeeFilter);
    const [rawEntries, summary] = await Promise.all([
      A.api("/attendance?" + params.join("&")),
      A.api("/attendance/summary?month=" + month)
    ]);
    const entries = projectKeyword
      ? rawEntries.filter((a) => A.projectNameOf(a).toLowerCase().includes(projectKeyword))
      : rawEntries;
    renderTable(entries);
    renderSummary(summary);
    if (window.EmployeesTab) window.EmployeesTab.render();
    if (window.SiteLogsTab) window.SiteLogsTab.render();
  }

  function renderTable(entries) {
    const tbody = document.querySelector("#attTable tbody");
    if (!entries.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No attendance logged this month yet.</td></tr>';
      return;
    }
    tbody.innerHTML = entries.map((a) => (
      '<tr>' +
        '<td>' + A.fmtDate(a.workDate) + '</td>' +
        '<td>' + A.esc(a.employeeId ? A.employeeName(a.employeeId) : (a.adhocEmployeeName || "One-off helper")) + '</td>' +
        '<td>' + A.esc(A.projectNameOf(a)) + '</td>' +
        '<td class="num">' + a.days + '</td>' +
        '<td><button class="row-del" data-id="' + a.id + '" title="Delete">✕</button></td>' +
      '</tr>'
    )).join("");
    tbody.querySelectorAll(".row-del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await A.api("/attendance/" + btn.getAttribute("data-id"), { method: "DELETE" });
        render();
      });
    });
  }

  function renderSummary(summary) {
    const host = document.getElementById("attSummary");
    if (!summary.employees.length) {
      host.innerHTML = '<div class="empty-state">Nothing to summarize yet.</div>';
      return;
    }
    host.innerHTML = summary.employees.map((e) => (
      '<div class="emp-summary-block">' +
        '<div class="head"><span>' + A.esc(e.employeeName) + ' — ' + e.totalDays + ' day' + (e.totalDays === 1 ? "" : "s") + '</span><span class="wage num">' + A.fmtMoney(e.totalWage) + '</span></div>' +
        e.byProject.map((bp) => (
          '<div class="proj-line"><span>' + A.esc(bp.projectName) + ' (' + bp.days + ' d)</span><span class="num">' + A.fmtMoney(bp.wage) + '</span></div>'
        )).join("") +
        (e.employeeId
          ? '<button class="btn btn-sm" data-stub-emp="' + e.employeeId + '" style="margin-top:9px;width:100%;">🖨 Print pay stub</button>'
          : '<button class="btn btn-sm" data-stub-adhoc="' + A.esc(e.employeeName) + '" style="margin-top:9px;width:100%;">🖨 Print wage summary</button>') +
      '</div>'
    )).join("") + (
      '<div class="emp-summary-block" style="background:transparent;border-style:dashed;">' +
        '<div class="head"><span>Total (' + summary.grandTotalDays + ' days)</span><span class="wage num">' + A.fmtMoney(summary.grandTotalWage) + '</span></div>' +
      '</div>'
    ) + '<p class="hint" style="margin-top:8px;">Who\'s actually been paid (including advances) is tracked on the Payments page.</p>';
    host.querySelectorAll("[data-stub-emp]").forEach((btn) => {
      btn.addEventListener("click", () => openPayStub(Number(btn.getAttribute("data-stub-emp"))));
    });
    host.querySelectorAll("[data-stub-adhoc]").forEach((btn) => {
      btn.addEventListener("click", () => openCasualStub(btn.getAttribute("data-stub-adhoc")));
    });
  }

  async function openPayStub(employeeId) {
    const month = document.getElementById("attMonth").value || A.currentMonth();
    if (!companySettings) companySettings = await A.api("/settings");
    const [entries, balances] = await Promise.all([
      A.api("/attendance?month=" + month + "&employeeId=" + employeeId),
      A.api("/payroll-balances")
    ]);
    const employee = A.state.employees.find((e) => e.id === employeeId);
    const balance = balances.find((b) => b.employeeId === employeeId);
    entries.sort((a, b) => a.workDate.localeCompare(b.workDate));

    const total = entries.reduce((s, e) => s + e.cost, 0);
    const totalDays = entries.reduce((s, e) => s + (Number(e.days) || 0), 0);
    const monthLabel = month.slice(5, 7) + "/" + month.slice(0, 4);

    const rowsHtml = entries.map((e) => (
      '<tr><td class="cat">' + A.esc(A.fmtDate(e.workDate)) + '</td>' +
        '<td class="desc">' + A.esc(A.projectNameOf(e)) + '</td>' +
        '<td class="amt num">' + e.days + '</td>' +
        '<td class="amt num">' + A.fmtMoney(e.rate) + '</td>' +
        '<td class="amt num">' + A.fmtMoney(e.cost) + '</td>' +
      '</tr>'
    )).join("") || '<tr><td colspan="5" style="padding:16px 0;color:var(--muted);font-size:12px;">No attendance logged this month.</td></tr>';

    const c = companySettings;
    const html =
      '<div class="qs-head">' +
        '<div class="qs-logo"><img src="/logo.jpg" alt="' + A.esc(c.companyName || "Las Casita Inc.") + '" class="qs-logo-img"></div>' +
        '<div class="qs-title"><h3>Pay Stub</h3></div>' +
      '</div>' +
      '<div class="qs-meta">' +
        '<div class="col"><p><strong>' + A.esc(c.companyName || "") + '</strong></p><p class="muted">' + A.esc(c.companyAddr1 || "") + '</p><p class="muted">' + A.esc(c.companyAddr2 || "") + '</p></div>' +
        '<div class="col right"><p><span class="muted">Pay period:</span> ' + A.esc(monthLabel) + '</p><p><span class="muted">Employee:</span> ' + A.esc(employee ? employee.name : "") + '</p></div>' +
      '</div>' +
      '<table class="qs-table"><thead><tr><th>Date</th><th>Project</th><th class="amt">Days</th><th class="amt">Rate</th><th class="amt">Amount</th></tr></thead>' +
      '<tbody>' + rowsHtml +
      '<tr class="qs-total-row"><td colspan="2">Total this period</td><td class="amt num">' + totalDays + '</td><td></td><td class="amt num">' + A.fmtMoney(total) + '</td></tr>' +
      '</tbody></table>' +
      (balance ? '<p class="qs-term">Balance owed as of today (all wages earned minus all payments and advances made, all-time): <strong class="num">' + A.fmtMoney(balance.balance) + '</strong></p>' : '') +
      '<p class="qs-auth">I confirm the days, projects, and amounts listed above are accurate for this pay period.</p>' +
      '<div class="qs-sign"><div class="line"><hr class="rule"><div class="cap"><span>' + A.esc(employee ? employee.name : "Employee") + '</span><span>Date</span></div></div>' +
        '<div class="line"><hr class="rule"><div class="cap"><span>' + A.esc((c.companyName || "").replace(/ Inc\.?$/, "")) + '</span><span>Date</span></div></div></div>';

    A.showPrintSheet(html);
  }

  // Casual/day laborers have no employee record or day rate — each entry's amount
  // was typed by hand, so this summarizes their logged days for the month instead
  // of a payroll pay stub (no wage-balance ledger exists for a one-off name).
  async function openCasualStub(name) {
    const month = document.getElementById("attMonth").value || A.currentMonth();
    if (!companySettings) companySettings = await A.api("/settings");
    const normKey = (s) => (s || "").trim().toLowerCase();
    const entries = (await A.api("/attendance?month=" + month))
      .filter((a) => !a.employeeId && normKey(a.adhocEmployeeName) === normKey(name))
      .sort((a, b) => a.workDate.localeCompare(b.workDate));

    const total = entries.reduce((s, e) => s + e.cost, 0);
    const totalDays = entries.reduce((s, e) => s + (Number(e.days) || 0), 0);
    const monthLabel = month.slice(5, 7) + "/" + month.slice(0, 4);

    const rowsHtml = entries.map((e) => (
      '<tr><td class="cat">' + A.esc(A.fmtDate(e.workDate)) + '</td>' +
        '<td class="desc">' + A.esc(A.projectNameOf(e)) + '</td>' +
        '<td class="amt num">' + e.days + '</td>' +
        '<td class="amt num">' + A.fmtMoney(e.cost) + '</td>' +
      '</tr>'
    )).join("") || '<tr><td colspan="4" style="padding:16px 0;color:var(--muted);font-size:12px;">No attendance logged this month.</td></tr>';

    const c = companySettings;
    const html =
      '<div class="qs-head">' +
        '<div class="qs-logo"><img src="/logo.jpg" alt="' + A.esc(c.companyName || "Las Casita Inc.") + '" class="qs-logo-img"></div>' +
        '<div class="qs-title"><h3>Casual Labor Wage Summary</h3></div>' +
      '</div>' +
      '<div class="qs-meta">' +
        '<div class="col"><p><strong>' + A.esc(c.companyName || "") + '</strong></p><p class="muted">' + A.esc(c.companyAddr1 || "") + '</p><p class="muted">' + A.esc(c.companyAddr2 || "") + '</p></div>' +
        '<div class="col right"><p><span class="muted">Pay period:</span> ' + A.esc(monthLabel) + '</p><p><span class="muted">Worker:</span> ' + A.esc(name) + '</p></div>' +
      '</div>' +
      '<table class="qs-table"><thead><tr><th>Date</th><th>Project</th><th class="amt">Days</th><th class="amt">Amount</th></tr></thead>' +
      '<tbody>' + rowsHtml +
      '<tr class="qs-total-row"><td colspan="2">Total this period</td><td class="amt num">' + totalDays + '</td><td class="amt num">' + A.fmtMoney(total) + '</td></tr>' +
      '</tbody></table>' +
      '<p class="qs-auth">I confirm the days, projects, and amounts listed above are accurate for this pay period.</p>' +
      '<div class="qs-sign"><div class="line"><hr class="rule"><div class="cap"><span>' + A.esc(name) + '</span><span>Date</span></div></div>' +
        '<div class="line"><hr class="rule"><div class="cap"><span>' + A.esc((c.companyName || "").replace(/ Inc\.?$/, "")) + '</span><span>Date</span></div></div></div>';

    A.showPrintSheet(html);
  }

  return { render };
})();
