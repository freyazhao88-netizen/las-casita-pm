"use strict";
window.ProjectsTab = (function () {
  const A = window.App;
  let selectedId = null;
  let creating = false;
  let bound = false;

  function bindOnce() {
    if (bound) return;
    bound = true;
    document.getElementById("projStatusFilter").addEventListener("change", render);
    document.getElementById("projClientFilter").addEventListener("input", render);
  }

  async function render() {
    bindOnce();
    const allProjects = await A.api("/projects?summary=1");
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
    const stages = await A.api("/projects/" + project.id + "/stages");
    detailHost.innerHTML = detailHtml(project, stages);
    bindDetail(project, stages);
  }

  function selectAndOpen(id) { selectedId = id; creating = false; render(); }

  function newProjectFormHtml() {
    return (
      '<div class="detail-header"><h3>New project</h3></div>' +
      '<form id="newProjectForm" class="field-grid">' +
        '<div class="field span-2"><label>Project name</label><input type="text" id="npName" required></div>' +
        '<div class="field span-2"><label>Address</label><input type="text" id="npAddress"></div>' +
        '<div class="field"><label>Client name</label><input type="text" id="npClient"></div>' +
        '<div class="field"><label>Status</label><select id="npStatus"><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option></select></div>' +
        '<div class="field"><label>Start date</label><input type="date" id="npStart"></div>' +
        '<div class="field"><label>Est. end date</label><input type="date" id="npEnd"></div>' +
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

  function detailHtml(p, stages) {
    const s = p.summary;
    return (
      '<div class="detail-header">' +
        '<div><h3>' + A.esc(p.name) + '</h3><div class="addr">' + A.esc(p.address || "No address") + (p.clientName ? " — " + A.esc(p.clientName) : "") + '</div></div>' +
        '<button class="btn btn-sm btn-danger" id="btnDeleteProject">Delete project</button>' +
      '</div>' +

      '<div class="detail-totals">' +
        tile("Labor cost", A.fmtMoney(s.laborTotal)) +
        tile("Material cost", A.fmtMoney(s.materialsTotal)) +
        tile("Total spend", A.fmtMoney(s.grandTotal)) +
        tile("Quoted total", A.fmtMoney(s.quotedTotal)) +
        tile("Vs. quote", (s.variance >= 0 ? "+" : "") + A.fmtMoney(s.variance)) +
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
          '<div class="field"><label>Start date</label><input type="date" id="epStart" value="' + (p.startDate || "") + '"></div>' +
          '<div class="field"><label>Est. end date</label><input type="date" id="epEnd" value="' + (p.estEndDate || "") + '"></div>' +
          '<div class="field"><label>Quoted total ($)</label><input type="number" step="0.01" id="epQuoted" value="' + (p.quotedTotal || 0) + '"></div>' +
          '<div class="field span-2"><label>Notes</label><input type="text" id="epNotes" value="' + A.esc(p.notes || "") + '"></div>' +
          '<div class="field span-2"><button class="btn btn-primary btn-sm" type="submit">Save changes</button></div>' +
        '</form>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head"><h3>Inspections</h3><span class="hint">' + stages.length + ' logged for this project</span></div>' +
        (stages.length ? summaryLine(stages) : '<div class="empty-state">No inspections logged yet for this project.</div>') +
        '<button class="btn btn-sm" id="btnViewInspections" type="button" style="margin-top:12px;">View / add inspections →</button>' +
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

  function bindDetail(p, stages) {
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
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btnNewProject");
    if (btn) btn.addEventListener("click", () => { creating = true; selectedId = null; render(); });
  });

  return { render, selectAndOpen };
})();
