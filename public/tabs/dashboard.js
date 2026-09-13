"use strict";
window.DashboardTab = (function () {
  const A = window.App;
  let bound = false;

  function bindOnce() {
    if (bound) return;
    bound = true;
    A.populateMonthSelect(document.getElementById("dashMonth"), 24);
    document.getElementById("dashMonth").addEventListener("change", render);
  }

  async function render() {
    bindOnce();
    const month = document.getElementById("dashMonth").value || A.currentMonth();
    const [projects, monthAttendance, monthMaterials, allMaterials, allExpenses, allStages, openTodos, paymentReminders] = await Promise.all([
      A.api("/projects?summary=1"),
      A.api("/attendance?month=" + month),
      A.api("/materials?month=" + month),
      A.api("/materials"),
      A.api("/expenses"),
      A.api("/stages"),
      A.api("/site-logs/open-todos"),
      A.api("/quotes/payment-reminders")
    ]);
    A.state.projects = projects;
    A.populateProjectSelects();

    const activeProjects = projects.filter((p) => p.status === "active");
    const activeIds = new Set(activeProjects.map((p) => p.id));

    // Deliberately NOT filtered to active projects — "money spent this month" is a cash-flow
    // question that includes things like warranty repairs billed against a completed project.
    const monthLabor = monthAttendance.reduce((s, a) => s + (Number(a.days) || 0) * (Number(a.rate) || 0), 0);
    const monthMaterialTotal = monthMaterials.reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const monthExpenseTotal = allExpenses
      .filter((e) => e.expenseDate && e.expenseDate.slice(0, 7) === month)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const unpaidMaterials = allMaterials.filter((m) => m.paymentStatus !== "paid");
    const unpaidExpenses = allExpenses.filter((e) => e.status !== "reimbursed");
    const payablesTotal = unpaidMaterials.reduce((s, m) => s + (Number(m.amount) || 0), 0)
      + unpaidExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const receivablesTotal = projects.reduce((s, p) => s + p.summary.outstandingBalance, 0);

    const monthLabel = monthLabelOf(month);
    document.getElementById("dashStats").innerHTML = [
      tile("Labor cost (" + monthLabel + ")", A.fmtMoney(monthLabor), "", "◷", "click for breakdown", "", "labor"),
      tile("Material cost (" + monthLabel + ")", A.fmtMoney(monthMaterialTotal), "", "▤", "click for breakdown", "", "material"),
      tile("Other expenses (" + monthLabel + ")", A.fmtMoney(monthExpenseTotal), "", "◈", "incl. warranty / repairs"),
      tile("应付款 Payables", A.fmtMoney(payablesTotal), "warm", "↥", "click for breakdown", "", "payables"),
      tile("应收款 Receivables", A.fmtMoney(receivablesTotal), "warm", "↧", "click for breakdown", "", "receivables")
    ].join("");

    document.getElementById("dashStats").querySelectorAll("[data-detail]").forEach((el) => {
      el.addEventListener("click", () => {
        const kind = el.getAttribute("data-detail");
        if (kind === "payables") showPayablesDetail(unpaidMaterials, unpaidExpenses, payablesTotal);
        else if (kind === "receivables") showReceivablesDetail(projects, receivablesTotal);
        else if (kind === "labor") showByProjectDetail("Labor cost — " + monthLabel, monthAttendance, (a) => (Number(a.days) || 0) * (Number(a.rate) || 0), monthLabor);
        else if (kind === "material") showByProjectDetail("Material cost — " + monthLabel, monthMaterials, (m) => Number(m.amount) || 0, monthMaterialTotal);
      });
    });

    renderProjectTimeline(activeProjects);
    renderUpcomingInspections(allStages, activeIds);
    renderOpenTodos(openTodos);
    renderUpcomingPayments(paymentReminders);
  }

  function showPayablesDetail(unpaidMaterials, unpaidExpenses, total) {
    const matTotal = unpaidMaterials.reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const expTotal = unpaidExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const matRows = unpaidMaterials.slice().sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate)).map((m) => (
      '<tr><td>' + m.purchaseDate + '</td><td>' + A.esc(A.projectNameOf(m)) + '</td><td>' + A.esc(m.vendor) + '</td>' +
      '<td>' + A.esc(m.category) + '</td><td class="amt num">' + A.fmtMoney(m.amount) + '</td></tr>'
    )).join("") || '<tr><td colspan="5" style="color:var(--muted);">No unpaid materials.</td></tr>';
    const expRows = unpaidExpenses.slice().sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)).map((e) => (
      '<tr><td>' + e.expenseDate + '</td><td>' + A.esc(A.projectNameOf(e)) + '</td><td>' + A.esc(e.category) + '</td>' +
      '<td>' + A.esc(e.description) + '</td><td class="amt num">' + A.fmtMoney(e.amount) + '</td></tr>'
    )).join("") || '<tr><td colspan="5" style="color:var(--muted);">No unreimbursed expenses.</td></tr>';

    const html =
      '<p style="margin:0 0 14px;font-size:13px;">Total owed: <strong class="num">' + A.fmtMoney(total) + '</strong></p>' +
      '<h4 style="margin:0 0 8px;font-size:13px;">Unpaid materials — ' + A.fmtMoney(matTotal) + '</h4>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Project</th><th>Vendor</th><th>Category</th><th>Amount</th></tr></thead>' +
      '<tbody>' + matRows + '</tbody></table></div>' +
      '<h4 style="margin:18px 0 8px;font-size:13px;">Unreimbursed other expenses — ' + A.fmtMoney(expTotal) + '</h4>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Project</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>' +
      '<tbody>' + expRows + '</tbody></table></div>';

    A.showDetailModal("应付款明细 Payables breakdown", html);
  }

  function showReceivablesDetail(projects, total) {
    const rows = projects.slice()
      .sort((a, b) => b.summary.outstandingBalance - a.summary.outstandingBalance)
      .map((p) => (
        '<tr><td>' + A.esc(p.name) + '</td><td class="amt num">' + A.fmtMoney(p.summary.effectiveQuotedTotal) + '</td>' +
        '<td class="amt num">' + A.fmtMoney(p.summary.amountReceived) + '</td>' +
        '<td class="amt num" style="font-weight:600;">' + A.fmtMoney(p.summary.outstandingBalance) + '</td></tr>'
      )).join("");

    const html =
      '<p style="margin:0 0 14px;font-size:13px;">Total outstanding: <strong class="num">' + A.fmtMoney(total) + '</strong></p>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Project</th><th>Total contract amount</th><th>Received</th><th>Outstanding</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';

    A.showDetailModal("应收款明细 Receivables breakdown", html);
  }

  function showByProjectDetail(title, entries, amountOf, total) {
    const byName = {};
    entries.forEach((e) => {
      const name = A.projectNameOf(e);
      byName[name] = (byName[name] || 0) + amountOf(e);
    });
    const rows = Object.keys(byName)
      .map((name) => ({ name, amount: byName[name] }))
      .sort((a, b) => b.amount - a.amount)
      .map((r) => '<tr><td>' + A.esc(r.name) + '</td><td class="amt num">' + A.fmtMoney(r.amount) + '</td></tr>')
      .join("") || '<tr><td colspan="2" style="color:var(--muted);">Nothing logged this month.</td></tr>';

    const html =
      '<p style="margin:0 0 14px;font-size:13px;">Total: <strong class="num">' + A.fmtMoney(total) + '</strong></p>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Project</th><th>Amount</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';

    A.showDetailModal(title, html);
  }

  function renderUpcomingPayments(reminders) {
    const host = document.getElementById("dashUpcomingPayments");
    if (!reminders.length) {
      host.innerHTML = '<div class="empty-state">Nothing due in the next 10 days.</div>';
      return;
    }
    host.innerHTML = reminders.map((r) => {
      const overdue = r.daysUntil < 0;
      const dueNote = overdue ? (Math.abs(r.daysUntil) + " day" + (Math.abs(r.daysUntil) === 1 ? "" : "s") + " overdue")
        : (r.daysUntil === 0 ? "due today" : "due in " + r.daysUntil + " day" + (r.daysUntil === 1 ? "" : "s"));
      return (
        '<div class="inspect-row" data-open-project="' + r.projectId + '" style="cursor:pointer;">' +
          '<div class="inspect-dot ' + (overdue ? "failed" : "scheduled") + '">' + (overdue ? "✕" : "!") + '</div>' +
          '<div class="inspect-text"><strong>' + A.esc(r.projectName) + ' — ' + A.esc(r.label) + '</strong>' +
          '<small>' + A.fmtMoney(r.amount) + ' · ' + A.esc(A.fmtDate(r.dueDate)) + '</small></div>' +
          '<span class="badge ' + (overdue ? "failed" : "scheduled") + '">' + A.esc(dueNote) + '</span>' +
        '</div>'
      );
    }).join("");
    host.querySelectorAll("[data-open-project]").forEach((row) => {
      row.addEventListener("click", () => {
        window.ProjectsTab.selectOnly(Number(row.getAttribute("data-open-project")));
        A.switchTab("projects");
      });
    });
  }

  function renderOpenTodos(openTodos) {
    const host = document.getElementById("dashOpenTodos");
    if (!openTodos.length) {
      host.innerHTML = '<div class="empty-state">Nothing pending — all site-log to-dos are checked off.</div>';
      return;
    }
    host.innerHTML = openTodos.slice(0, 10).map((t) => (
      '<label class="todo-list" style="display:block;">' +
        '<span style="display:flex;align-items:center;gap:7px;">' +
          '<input type="checkbox" data-todo-toggle="' + t.logId + ':' + t.todoIndex + '">' +
          '<span><strong>' + A.esc(t.projectName) + '</strong> — ' + A.esc(t.text) + ' <small style="color:var(--muted);">(' + A.esc(A.fmtDate(t.logDate)) + ')</small></span>' +
        '</span>' +
      '</label>'
    )).join("");
    host.querySelectorAll("[data-todo-toggle]").forEach((cb) => {
      cb.addEventListener("change", async () => {
        const [logId, idx] = cb.getAttribute("data-todo-toggle").split(":");
        await A.api("/site-logs/" + logId + "/todos/" + idx, { method: "PUT", body: { done: true } });
        render();
      });
    });
  }

  function renderUpcomingInspections(allStages, activeIds) {
    const host = document.getElementById("dashRecentStages");
    const stages = allStages.filter((s) => activeIds.has(s.projectId));
    const failed = stages.filter((s) => s.status === "failed");
    const scheduled = stages.filter((s) => s.status === "scheduled")
      .sort((a, b) => (a.inspectionDate || "9999").localeCompare(b.inspectionDate || "9999"));
    const upcoming = failed.concat(scheduled).slice(0, 8);

    if (!upcoming.length) {
      host.innerHTML = '<div class="empty-state">Nothing scheduled — all inspections are passed or none logged yet.</div>';
      return;
    }
    const dotGlyph = { passed: "✓", scheduled: "!", failed: "✕" };
    host.innerHTML = upcoming.map((s) => (
      '<div class="inspect-row">' +
        '<div class="inspect-dot ' + s.status + '">' + dotGlyph[s.status] + '</div>' +
        '<div class="inspect-text"><strong>' + A.esc(s.name) + ' — ' + A.esc(s.projectName) + '</strong>' +
        '<small>' + (s.inspectionDate ? A.esc(A.fmtDate(s.inspectionDate)) : "No date set") + (s.department ? " · " + A.esc(s.department) : "") + '</small></div>' +
        '<span class="badge ' + s.status + '">' + s.status + '</span>' +
      '</div>'
    )).join("");
  }

  function monthLabelOf(month) {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { year: "numeric", month: "short" });
  }

  function tile(label, value, tone, icon, note, noteTone, dataDetail) {
    return (
      '<div class="stat-tile' + (dataDetail ? " stat-tile-clickable" : "") + '"' + (dataDetail ? ' data-detail="' + dataDetail + '"' : "") + '>' +
        '<div class="stat-tile-head"><span class="label">' + A.esc(label) + '</span><span class="icon">' + icon + '</span></div>' +
        '<div class="value ' + (tone || "") + '">' + value + '</div>' +
        (note ? '<div class="note ' + (noteTone || "") + '">' + A.esc(note) + '</div>' : "") +
      '</div>'
    );
  }

  function renderProjectTimeline(activeProjects) {
    const host = document.getElementById("dashProjectTimeline");
    if (!activeProjects.length) {
      host.innerHTML = '<div class="empty-state">No active projects. Create one, or check On hold / Completed in the Projects tab.</div>';
      return;
    }
    const today = new Date();
    host.innerHTML = activeProjects.map((p) => {
      const header =
        '<h4>' + A.esc(p.name) + ' <span class="status-pill ' + p.status + '">' + A.esc(p.status.replace("_", " ")) + '</span></h4>' +
        '<div class="addr">' + A.esc(p.address || "No address") + '</div>';

      if (!p.startDate || !p.estEndDate) {
        return '<div class="proj-card" data-open-project="' + p.id + '">' + header +
          '<p class="hint" style="margin-top:10px;">No start / est. completion date set — add one on the project to see timeline progress.</p>' +
        '</div>';
      }

      const start = new Date(p.startDate);
      const end = new Date(p.estEndDate);
      const totalDays = Math.max(1, Math.round((end - start) / 86400000));
      const elapsedDays = Math.round((today - start) / 86400000);
      const pct = Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100)));
      const overdue = today > end;
      const dayLabel = overdue
        ? Math.round((today - end) / 86400000) + " day" + (Math.round((today - end) / 86400000) === 1 ? "" : "s") + " past est. completion"
        : "Day " + Math.max(0, elapsedDays) + " of " + totalDays;

      return '<div class="proj-card" data-open-project="' + p.id + '">' + header +
        '<div class="progress-bar" style="margin-top:10px;"><div class="fill" style="width:' + pct + '%;' + (overdue ? "background:var(--bad);" : "") + '"></div></div>' +
        '<div class="row"><span class="k" style="' + (overdue ? "color:var(--bad);" : "") + '">' + A.esc(dayLabel) + '</span><span class="v">' + pct + '%</span></div>' +
      '</div>';
    }).join("");
    host.querySelectorAll("[data-open-project]").forEach((card) => {
      card.addEventListener("click", () => {
        window.ProjectsTab.selectOnly(Number(card.getAttribute("data-open-project")));
        A.switchTab("projects");
      });
    });
  }

  return { render };
})();
