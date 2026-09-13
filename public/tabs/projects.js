"use strict";
window.ProjectsTab = (function () {
  const A = window.App;
  let selectedId = null;
  let creating = false;
  let bound = false;
  let renderToken = 0;

  function bindOnce() {
    if (bound) return;
    bound = true;
    document.getElementById("projStatusFilter").addEventListener("change", render);
    document.getElementById("projClientFilter").addEventListener("input", render);
  }

  async function render() {
    bindOnce();
    const myToken = ++renderToken;

    let allProjects;
    try {
      allProjects = await A.api("/projects?summary=1");
    } catch (e) {
      if (myToken !== renderToken) return; // a newer render started while this one failed
      document.getElementById("projectsList").innerHTML =
        '<div class="empty-state">Couldn\'t load projects.<br><button class="btn btn-sm" id="btnRetryProjects" style="margin-top:8px;">Retry</button></div>';
      const retryBtn = document.getElementById("btnRetryProjects");
      if (retryBtn) retryBtn.addEventListener("click", render);
      return;
    }
    if (myToken !== renderToken) return; // a newer render superseded this one — drop stale results

    A.state.projects = allProjects;
    A.populateProjectSelects();

    const statusFilter = document.getElementById("projStatusFilter").value;
    const clientFilter = document.getElementById("projClientFilter").value.trim().toLowerCase();
    let projects = statusFilter ? allProjects.filter((p) => p.status === statusFilter) : allProjects;
    if (clientFilter) projects = projects.filter((p) => (p.clientName || "").toLowerCase().includes(clientFilter));

    const listHost = document.getElementById("projectsList");
    if (!projects.length) {
      listHost.innerHTML = '<div class="empty-state">No projects match this filter.</div>';
    } else {
      listHost.innerHTML = projects.map((p) => (
        '<div class="proj-list-item' + (p.id === selectedId ? " active" : "") + '" data-id="' + p.id + '">' +
          '<div class="name">' + A.esc(p.name) + '</div>' +
          '<div class="addr">' + A.esc(p.address || "") + (p.clientName ? " — " + A.esc(p.clientName) : "") + '</div>' +
        '</div>'
      )).join("");
      listHost.querySelectorAll("[data-id]").forEach((el) => {
        el.addEventListener("click", () => { selectedId = Number(el.getAttribute("data-id")); creating = false; render(); });
      });
    }

    const detailHost = document.getElementById("projectDetail");
    if (creating) {
      detailHost.innerHTML = newProjectFormHtml();
      bindNewProjectForm();
      return;
    }
    const project = allProjects.find((p) => p.id === selectedId);
    if (!project) {
      detailHost.innerHTML = '<div class="empty-state">Select a project on the left, or create a new one.</div>';
      return;
    }
    let stages, warranties, quotesForProject, changeOrdersForProject;
    try {
      [stages, warranties, quotesForProject, changeOrdersForProject] = await Promise.all([
        A.api("/projects/" + project.id + "/stages"),
        A.api("/warranties?projectId=" + project.id),
        A.api("/quotes?projectId=" + project.id),
        A.api("/change-orders?projectId=" + project.id)
      ]);
    } catch (e) {
      if (myToken !== renderToken) return;
      detailHost.innerHTML = '<div class="empty-state">Couldn\'t load this project.<br><button class="btn btn-sm" id="btnRetryDetail" style="margin-top:8px;">Retry</button></div>';
      const retryBtn = document.getElementById("btnRetryDetail");
      if (retryBtn) retryBtn.addEventListener("click", render);
      return;
    }
    if (myToken !== renderToken) return;
    detailHost.innerHTML = detailHtml(project, stages, warranties, quotesForProject, changeOrdersForProject);
    bindDetail(project, stages, warranties, quotesForProject, changeOrdersForProject);
  }

  function selectAndOpen(id) { selectedId = id; creating = false; render(); }
  // Sets which project should be shown without triggering its own render — for callers
  // that are about to switch to this tab anyway (switchTab() renders once on its own,
  // so calling both would fire two overlapping renders racing each other).
  function selectOnly(id) { selectedId = id; creating = false; }

  function newProjectFormHtml() {
    return (
      '<div class="detail-header"><h3>New project</h3></div>' +
      '<form id="newProjectForm" class="field-grid">' +
        '<div class="field span-2"><label>Project name</label><input type="text" id="npName" required></div>' +
        '<div class="field span-2"><label>Address</label><input type="text" id="npAddress"></div>' +
        '<div class="field"><label>Client name</label><input type="text" id="npClient"></div>' +
        '<div class="field"><label>Status</label><select id="npStatus"><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option></select></div>' +
        '<div class="field"><label>Start date</label><input type="date" min="1970-01-01" max="2099-12-31" id="npStart"></div>' +
        '<div class="field"><label>Est. end date</label><input type="date" min="1970-01-01" max="2099-12-31" id="npEnd"></div>' +
        '<div class="field"><label>Quoted total ($)</label><input type="number" step="0.01" id="npQuoted"></div>' +
        '<div class="field span-2"><label>Notes</label><input type="text" id="npNotes"></div>' +
        '<div class="field span-2" style="display:flex;gap:10px;">' +
          '<button class="btn btn-primary" type="submit">Create project</button>' +
          '<button class="btn" type="button" id="npCancel">Cancel</button>' +
        '</div>' +
      '</form>'
    );
  }

  function bindNewProjectForm() {
    document.getElementById("npCancel").addEventListener("click", () => { creating = false; render(); });
    document.getElementById("newProjectForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const rec = await A.api("/projects", { method: "POST", body: {
        name: document.getElementById("npName").value,
        address: document.getElementById("npAddress").value,
        clientName: document.getElementById("npClient").value,
        status: document.getElementById("npStatus").value,
        startDate: document.getElementById("npStart").value,
        estEndDate: document.getElementById("npEnd").value,
        quotedTotal: document.getElementById("npQuoted").value,
        notes: document.getElementById("npNotes").value
      }});
      A.toast("Project created");
      creating = false;
      selectedId = rec.id;
      render();
    });
  }

  function detailHtml(p, stages, warranties, quotesForProject, changeOrdersForProject) {
    const s = p.summary;
    return (
      '<div class="detail-header">' +
        '<div><h3>' + A.esc(p.name) + '</h3><div class="addr">' + A.esc(p.address || "No address") + (p.clientName ? " — " + A.esc(p.clientName) : "") + '</div></div>' +
        '<button class="btn btn-sm btn-danger" id="btnDeleteProject">Delete project</button>' +
      '</div>' +

      '<div class="detail-totals">' +
        tile("Labor cost", A.fmtMoney(s.laborTotal)) +
        tile("Material cost", A.fmtMoney(s.materialsTotal)) +
        tile("Other expenses", A.fmtMoney(s.otherExpensesTotal)) +
        tile("Total spend", A.fmtMoney(s.grandTotal)) +
        tile("Quote / Contract total", A.fmtMoney(s.quotedTotal)) +
        tile("Change orders", (s.approvedChangeOrdersTotal >= 0 ? "+" : "") + A.fmtMoney(s.approvedChangeOrdersTotal)) +
        tile("Total contract amount", A.fmtMoney(s.effectiveQuotedTotal)) +
        tile("Profit margin", (s.profitMargin >= 0 ? "+" : "") + A.fmtMoney(s.profitMargin)) +
        tile("Received from client", A.fmtMoney(s.amountReceived)) +
        tile("Outstanding balance", A.fmtMoney(s.outstandingBalance)) +
        tile("Stage progress", s.stageProgress.passed + " / " + s.stageProgress.total) +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head"><h3>Project details</h3></div>' +
        '<form id="editProjectForm" class="field-grid">' +
          '<div class="field span-2"><label>Project name</label><input type="text" id="epName" value="' + A.esc(p.name) + '" required></div>' +
          '<div class="field span-2"><label>Address</label><input type="text" id="epAddress" value="' + A.esc(p.address || "") + '"></div>' +
          '<div class="field"><label>Client name</label><input type="text" id="epClient" value="' + A.esc(p.clientName || "") + '"></div>' +
          '<div class="field"><label>Status</label><select id="epStatus">' +
            ["active", "on_hold", "completed"].map((v) => '<option value="' + v + '"' + (p.status === v ? " selected" : "") + '>' + v.replace("_", " ") + '</option>').join("") +
          '</select></div>' +
          '<div class="field"><label>Start date</label><input type="date" min="1970-01-01" max="2099-12-31" id="epStart" value="' + (p.startDate || "") + '"></div>' +
          '<div class="field"><label>Est. end date</label><input type="date" min="1970-01-01" max="2099-12-31" id="epEnd" value="' + (p.estEndDate || "") + '"></div>' +
          '<div class="field"><label>Quote / Contract total ($)</label><input type="number" step="0.01" id="epQuoted" value="' + (p.quotedTotal || 0) + '"></div>' +
          '<div class="field"><label>Change orders (approved)</label><input type="text" disabled value="' + (s.approvedChangeOrdersTotal >= 0 ? "+" : "") + A.fmtMoney(s.approvedChangeOrdersTotal) + '" style="background:var(--surface-2);color:var(--muted);"></div>' +
          '<div class="field span-2"><label>Total contract amount</label><input type="text" disabled value="' + A.fmtMoney(s.effectiveQuotedTotal) + '" style="background:var(--surface-2);font-weight:600;color:var(--ink);"></div>' +
          '<div class="field span-2"><label>Notes</label><input type="text" id="epNotes" value="' + A.esc(p.notes || "") + '"></div>' +
          '<div class="field span-2"><button class="btn btn-primary btn-sm" type="submit">Save changes</button></div>' +
        '</form>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head"><h3>Quote / Contract 报价/合同</h3><span class="hint">' + (quotesForProject.length ? quotesForProject.length + ' on file' : 'None yet') + '</span></div>' +
        (quotesForProject.length
          ? quotesForProject.map(quoteLine).join("")
          : '<div class="empty-state">This project started without a formal quote/contract — that\'s fine, you can create one anytime.</div>') +
        '<button class="btn btn-sm" id="btnNewQuoteForProject" type="button" style="margin-top:12px;">+ ' + (quotesForProject.length ? "New quote" : "Create a quote") + '</button>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head"><h3>Change Orders 变更单</h3><span class="hint">' + (changeOrdersForProject.length ? changeOrdersForProject.length + ' on file' : 'None yet') + '</span></div>' +
        (changeOrdersForProject.length
          ? changeOrdersForProject.map(changeOrderLine).join("")
          : '<div class="empty-state">No change orders for this project yet.</div>') +
        '<button class="btn btn-sm" id="btnNewChangeOrderForProject" type="button" style="margin-top:12px;">+ New change order</button>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head"><h3>Inspections</h3><span class="hint">' + stages.length + ' logged for this project</span></div>' +
        (stages.length ? summaryLine(stages) : '<div class="empty-state">No inspections logged yet for this project.</div>') +
        '<button class="btn btn-sm" id="btnViewInspections" type="button" style="margin-top:12px;">View / add inspections →</button>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head"><h3>Warranty coverage 保修信息</h3><span class="hint">' + warranties.length + ' on file</span></div>' +
        '<div id="warrantyList">' + (warranties.length ? warranties.map(warrantyLine).join("") : '<div class="empty-state">No warranty info logged yet.</div>') + '</div>' +
        '<form id="warrantyForm" class="field-grid field-grid-3" style="margin-top:14px;">' +
          '<div class="field"><label>Item</label><input type="text" id="wtyItem" placeholder="e.g. Plumbing" required></div>' +
          '<div class="field"><label>Provider</label><input type="text" id="wtyProvider" placeholder="e.g. ABC Plumbing"></div>' +
          '<div class="field"><label>Contact</label><input type="text" id="wtyContact" placeholder="phone / email"></div>' +
          '<div class="field"><label>Start date</label><input type="date" min="1970-01-01" max="2099-12-31" id="wtyStart"></div>' +
          '<div class="field"><label>Expiration date</label><input type="date" min="1970-01-01" max="2099-12-31" id="wtyExpire"></div>' +
          '<div class="field"><label>Notes</label><input type="text" id="wtyNotes" placeholder="optional"></div>' +
          '<div class="field span-full"><button class="btn btn-sm" type="submit">+ Add warranty</button></div>' +
        '</form>' +
      '</div>'
    );
  }

  function changeOrderLine(o) {
    const badgeClass = o.status === "approved" ? "passed" : o.status === "rejected" ? "failed" : "";
    return (
      '<div class="proj-line" style="align-items:flex-start;padding:8px 0;">' +
        '<span>' +
          '<strong>' + A.esc(o.orderNo || o.title || "Untitled change order") + '</strong> ' +
          '<span class="badge ' + badgeClass + '">' + A.esc(o.status || "pending") + '</span><br>' +
          '<small style="color:var(--muted);">' + A.esc(A.fmtDate(o.orderDate)) + (o.title ? " · " + A.esc(o.title) : "") + ' · ' + A.fmtMoney(o.total) + '</small>' +
        '</span>' +
        '<button class="btn btn-sm" data-open-co="' + o.id + '" type="button">Open →</button>' +
      '</div>'
    );
  }

  function quoteLine(q) {
    const badgeClass = q.status === "signed" ? "passed" : q.status === "sent" ? "scheduled" : "";
    return (
      '<div class="proj-line" style="align-items:flex-start;padding:8px 0;">' +
        '<span>' +
          '<strong>' + A.esc(q.quoteNo || "Untitled quote") + '</strong> ' +
          '<span class="badge ' + badgeClass + '">' + A.esc(q.status || "draft") + '</span><br>' +
          '<small style="color:var(--muted);">' + A.esc(A.fmtDate(q.quoteDate)) + ' · ' + A.fmtMoney(q.total) + '</small>' +
        '</span>' +
        '<button class="btn btn-sm" data-open-quote="' + q.id + '" type="button">Open →</button>' +
      '</div>'
    );
  }

  function warrantyLine(w) {
    const today = A.todayISO();
    const isExpired = w.expirationDate && w.expirationDate < today;
    const badge = w.expirationDate
      ? '<span class="badge ' + (isExpired ? "failed" : "passed") + '">' + (isExpired ? "Expired" : "Active") + '</span>'
      : "";
    const meta = [
      w.providerName,
      w.providerContact,
      w.startDate ? "from " + A.fmtDate(w.startDate) : "",
      w.expirationDate ? "exp. " + A.fmtDate(w.expirationDate) : ""
    ].filter(Boolean).join(" · ");
    return (
      '<div class="proj-line" style="align-items:flex-start;padding:8px 0;">' +
        '<span>' +
          '<strong>' + A.esc(w.item) + '</strong> ' + badge + '<br>' +
          '<small style="color:var(--muted);">' + A.esc(meta) + '</small>' +
          (w.notes ? '<br><small style="color:var(--muted);">' + A.esc(w.notes) + '</small>' : "") +
        '</span>' +
        '<button class="row-del" data-warranty-id="' + w.id + '" title="Delete">✕</button>' +
      '</div>'
    );
  }

  function summaryLine(stages) {
    const passed = stages.filter((s) => s.status === "passed").length;
    const failed = stages.filter((s) => s.status === "failed").length;
    const scheduled = stages.filter((s) => s.status === "scheduled").length;
    return (
      '<div style="display:flex;gap:18px;font-size:13px;">' +
        '<span><b class="num">' + passed + '</b> passed</span>' +
        '<span><b class="num">' + scheduled + '</b> scheduled</span>' +
        (failed ? '<span style="color:var(--bad)"><b class="num">' + failed + '</b> failed</span>' : '') +
      '</div>'
    );
  }

  function tile(label, value) {
    return '<div class="tile"><div class="label">' + A.esc(label) + '</div><div class="value num">' + value + '</div></div>';
  }

  function bindDetail(p, stages, warranties, quotesForProject, changeOrdersForProject) {
    document.getElementById("btnNewQuoteForProject").addEventListener("click", () => {
      window.QuotesTab.newQuoteForProject(p.id);
      A.switchTab("quotes");
    });
    document.querySelectorAll("[data-open-quote]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.QuotesTab.openQuote(Number(btn.getAttribute("data-open-quote")));
        A.switchTab("quotes");
      });
    });

    document.getElementById("btnNewChangeOrderForProject").addEventListener("click", () => {
      window.ChangeOrdersTab.newOrderForProject(p.id);
      A.switchTab("changeorders");
    });
    document.querySelectorAll("[data-open-co]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.ChangeOrdersTab.openOrder(Number(btn.getAttribute("data-open-co")));
        A.switchTab("changeorders");
      });
    });

    document.getElementById("btnDeleteProject").addEventListener("click", async () => {
      if (!confirm('Delete project "' + p.name + '" and all its attendance, materials, stages, and quotes? This cannot be undone.')) return;
      await A.api("/projects/" + p.id, { method: "DELETE" });
      selectedId = null;
      A.toast("Project deleted");
      render();
    });

    document.getElementById("editProjectForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      await A.api("/projects/" + p.id, { method: "PUT", body: {
        name: document.getElementById("epName").value,
        address: document.getElementById("epAddress").value,
        clientName: document.getElementById("epClient").value,
        status: document.getElementById("epStatus").value,
        startDate: document.getElementById("epStart").value,
        estEndDate: document.getElementById("epEnd").value,
        quotedTotal: document.getElementById("epQuoted").value,
        notes: document.getElementById("epNotes").value
      }});
      A.toast("Saved");
      render();
    });

    document.getElementById("btnViewInspections").addEventListener("click", () => {
      window.StagesTab.filterToProject(p.id);
      A.switchTab("stages");
    });

    document.getElementById("warrantyForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      await A.api("/warranties", { method: "POST", body: {
        projectId: p.id,
        item: document.getElementById("wtyItem").value,
        providerName: document.getElementById("wtyProvider").value,
        providerContact: document.getElementById("wtyContact").value,
        startDate: document.getElementById("wtyStart").value,
        expirationDate: document.getElementById("wtyExpire").value,
        notes: document.getElementById("wtyNotes").value
      }});
      A.toast("Warranty added");
      render();
    });

    document.querySelectorAll("[data-warranty-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await A.api("/warranties/" + btn.getAttribute("data-warranty-id"), { method: "DELETE" });
        render();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btnNewProject");
    if (btn) btn.addEventListener("click", () => { creating = true; selectedId = null; render(); });
  });

  return { render, selectAndOpen, selectOnly };
})();
