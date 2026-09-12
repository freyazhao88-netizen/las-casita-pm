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
    const [projects, monthAttendance, monthMaterials, allMaterials, allExpenses, allStages, openTodos] = await Promise.all([
      A.api("/projects?summary=1"),
      A.api("/attendance?month=" + month),
      A.api("/materials?month=" + month),
      A.api("/materials"),
      A.api("/expenses"),
      A.api("/stages"),
      A.api("/site-logs/open-todos")
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

    const scheduledCount = allStages.filter((s) => activeIds.has(s.projectId) && s.status === "scheduled").length;
    const failedCount = allStages.filter((s) => activeIds.has(s.projectId) && s.status === "failed").length;

    let stagesNote, stagesTone;
    if (failedCount > 0) { stagesNote = failedCount + " failed inspection" + (failedCount === 1 ? "" : "s"); stagesTone = "warn"; }
    else if (scheduledCount > 0) { stagesNote = "awaiting inspection"; stagesTone = ""; }
    else { stagesNote = "all caught up"; stagesTone = "good"; }

    const monthLabel = monthLabelOf(month);
    document.getElementById("dashStats").innerHTML = [
      tile("Active projects", activeProjects.length, "", "▣", projects.length + " total"),
      tile("Labor cost (" + monthLabel + ")", A.fmtMoney(monthLabor), "", "◷", "click for breakdown", "", "labor"),
      tile("Material cost (" + monthLabel + ")", A.fmtMoney(monthMaterialTotal), "", "▤", "click for breakdown", "", "material"),
      tile("Other expenses (" + monthLabel + ")", A.fmtMoney(monthExpenseTotal), "", "◈", "incl. warranty / repairs"),
      tile("应付款 Payables", A.fmtMoney(payablesTotal), "warm", "↥", "click for breakdown", "", "payables"),
      tile("应收款 Receivables", A.fmtMoney(receivablesTotal), "warm", "↧", "click for breakdown", "", "receivables"),
      tile("Inspections scheduled", String(scheduledCount), failedCount > 0 ? "warm" : "", "✓", stagesNote, stagesTone)
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

    const cardsHost = document.getElementById("dashProjectCards");
    if (!activeProjects.length) {
      cardsHost.innerHTML = '<div class="empty-state">No active projects. Create one, or check On hold / Completed in the Projects tab.</div>';
    } else {
      cardsHost.innerHTML = activeProjects.map((p) => cardHtml(p)).join("");
      cardsHost.querySelectorAll("[data-open-project]").forEach((card) => {
        card.addEventListener("click", () => {
          window.ProjectsTab.selectOnly(Number(card.getAttribute("data-open-project")));
          A.switchTab("projects");
        });
      });
    }

    renderUpcomingInspections(allStages, activeIds);
    renderOpenTodos(openTodos);
  }

  function showPayablesDetail(unpaidMaterials, unpaidExpenses, total) {
    const matTotal = unpaidMaterials.reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const expTotal = unpaidExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const matRows = unpaidMaterials.slice().sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate)).map((m) => (
      '<tr><td>' + m.purchaseDate + '</td><td>' + A.esc(A.projectName(m.projectId)) + '</td><td>' + A.esc(m.vendor) + '</td>' +
      '<td>' + A.esc(m.category) + '</td><td class="amt num">' + A.fmtMoney(m.amount) + '</td></tr>'
    )).join("") || '<tr><td colspan="5" style="color:var(--muted);">No unpaid materials.</td></tr>';
    const expRows = unpaidExpenses.slice().sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)).map((e) => (
      '<tr><td>' + e.expenseDate + '</td><td>' + A.esc(A.projectName(e.projectId)) + '</td><td>' + A.esc(e.category) + '</td>' +
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
    const byProject = {};
    entries.forEach((e) => { byProject[e.projectId] = (byProject[e.projectId] || 0) + amountOf(e); });
    const rows = Object.keys(byProject)
      .map((pid) => ({ name: A.projectName(pid), amount: byProject[pid] }))
      .sort((a, b) => b.amount - a.amount)
      .map((r) => '<tr><td>' + A.esc(r.name) + '</td><td class="amt num">' + A.fmtMoney(r.amount) + '</td></tr>')
      .join("") || '<tr><td colspan="2" style="color:var(--muted);">Nothing logged this month.</td></tr>';

    const html =
      '<p style="margin:0 0 14px;font-size:13px;">Total: <strong class="num">' + A.fmtMoney(total) + '</strong></p>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Project</th><th>Amount</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';

    A.showDetailModal(title, html);
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

  function cardHtml(p) {
    const s = p.summary;
    const pct = s.stageProgress.percent;
    const varianceTone = s.variance < 0 ? "color:var(--bad)" : "color:var(--good)";
    return (
      '<div class="proj-card" data-open-project="' + p.id + '">' +
        '<h4>' + A.esc(p.name) + ' <span class="status-pill ' + p.status + '">' + A.esc(p.status.replace("_", " ")) + '</span></h4>' +
        '<div class="addr">' + A.esc(p.address || "No address") + '</div>' +
        '<div class="row"><span class="k">Labor cost</span><span class="v num">' + A.fmtMoney(s.laborTotal) + '</span></div>' +
        '<div class="row"><span class="k">Material cost</span><span class="v num">' + A.fmtMoney(s.materialsTotal) + '</span></div>' +
        '<div class="row"><span class="k">Other expenses</span><span class="v num">' + A.fmtMoney(s.otherExpensesTotal) + '</span></div>' +
        '<div class="row total"><span class="k">Total spend</span><span class="v num">' + A.fmtMoney(s.grandTotal) + '</span></div>' +
        '<div class="row"><span class="k">Quote / Contract total</span><span class="v num">' + A.fmtMoney(s.quotedTotal) + '</span></div>' +
        '<div class="row"><span class="k">Change orders</span><span class="v num">' + (s.approvedChangeOrdersTotal >= 0 ? "+" : "") + A.fmtMoney(s.approvedChangeOrdersTotal) + '</span></div>' +
        '<div class="row total"><span class="k">Total contract amount</span><span class="v num">' + A.fmtMoney(s.effectiveQuotedTotal) + '</span></div>' +
        '<div class="row"><span class="k">Profit margin</span><span class="v num" style="' + varianceTone + '">' + (s.profitMargin >= 0 ? "+" : "") + A.fmtMoney(s.profitMargin) + '</span></div>' +
        '<div class="row"><span class="k">Received from client</span><span class="v num">' + A.fmtMoney(s.amountReceived) + '</span></div>' +
        '<div class="row"><span class="k">Outstanding balance</span><span class="v num">' + A.fmtMoney(s.outstandingBalance) + '</span></div>' +
        '<div class="progress-bar"><div class="fill" style="width:' + pct + '%"></div></div>' +
        '<div class="row"><span class="k">Stage progress</span><span class="v">' + s.stageProgress.passed + ' / ' + s.stageProgress.total + ' (' + pct + '%)</span></div>' +
      '</div>'
    );
  }

  return { render };
})();
