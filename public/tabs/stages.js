"use strict";
window.StagesTab = (function () {
  const A = window.App;
  let bound = false;
  let suggestions = [];

  function bindOnce() {
    if (bound) return;
    bound = true;
    document.getElementById("stgProjectFilter").addEventListener("change", render);
    document.getElementById("stgStatusFilter").addEventListener("change", render);

    document.getElementById("stgAddForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const projectId = document.getElementById("stgAddProject").value;
      const name = document.getElementById("stgAddName").value.trim();
      const department = document.getElementById("stgAddDept").value.trim();
      if (!projectId || !name) { A.toast("Pick a project and name the inspection"); return; }
      await A.api("/projects/" + projectId + "/stages", { method: "POST", body: { name, department } });
      document.getElementById("stgAddName").value = "";
      document.getElementById("stgAddDept").value = "";
      A.toast("Inspection added");
      render();
    });
  }

  function filterToProject(projectId) {
    bindOnce();
    const sel = document.getElementById("stgProjectFilter");
    A.populateSelect(sel, A.state.projects, (p) => p.id, (p) => p.name, "All projects");
    sel.value = String(projectId);
  }

  async function render() {
    bindOnce();
    A.populateSelect(document.getElementById("stgProjectFilter"), A.state.projects, (p) => p.id, (p) => p.name, "All projects");
    A.populateSelect(document.getElementById("stgAddProject"), A.state.projects, (p) => p.id, (p) => p.name);

    if (!suggestions.length) {
      suggestions = await A.api("/stage-suggestions");
      const chipHost = document.getElementById("stgSuggestChips");
      chipHost.innerHTML = "";
      suggestions.forEach((name) => {
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "chip"; btn.textContent = "+ " + name;
        btn.addEventListener("click", () => { document.getElementById("stgAddName").value = name; });
        chipHost.appendChild(btn);
      });
    }

    const projectId = document.getElementById("stgProjectFilter").value;
    const status = document.getElementById("stgStatusFilter").value;
    const params = [];
    if (projectId) params.push("projectId=" + projectId);
    if (status) params.push("status=" + status);
    const list = await A.api("/stages" + (params.length ? "?" + params.join("&") : ""));

    const tbody = document.querySelector("#stgTable tbody");
    if (!list.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No inspections match this filter.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((s) => rowHtml(s)).join("");
    tbody.querySelectorAll("tr[data-id]").forEach(bindRow);
  }

  function rowHtml(s) {
    return (
      '<tr data-id="' + s.id + '">' +
        '<td>' + A.esc(s.projectName) + '</td>' +
        '<td><input class="stg-name" type="text" value="' + A.esc(s.name) + '" style="border:1px solid transparent;background:transparent;width:150px;"></td>' +
        '<td><input class="stg-dept" type="text" value="' + A.esc(s.department || "") + '" placeholder="—" style="width:120px;"></td>' +
        '<td><input class="stg-date" type="date" value="' + (s.inspectionDate || "") + '"></td>' +
        '<td><select class="stg-status ' + s.status + '">' +
          '<option value="scheduled"' + (s.status === "scheduled" ? " selected" : "") + '>Scheduled</option>' +
          '<option value="passed"' + (s.status === "passed" ? " selected" : "") + '>Passed</option>' +
          '<option value="failed"' + (s.status === "failed" ? " selected" : "") + '>Failed</option>' +
        '</select></td>' +
        '<td><input class="stg-notes" type="text" value="' + A.esc(s.notes || "") + '" placeholder="—" style="width:150px;"></td>' +
        '<td><button class="row-del" title="Delete">✕</button></td>' +
      '</tr>'
    );
  }

  function bindRow(row) {
    const id = row.getAttribute("data-id");
    const save = (patch) => A.api("/stages/" + id, { method: "PUT", body: patch });
    row.querySelector(".stg-name").addEventListener("change", (e) => save({ name: e.target.value }));
    row.querySelector(".stg-dept").addEventListener("change", (e) => save({ department: e.target.value }));
    row.querySelector(".stg-date").addEventListener("change", (e) => save({ inspectionDate: e.target.value }));
    row.querySelector(".stg-notes").addEventListener("change", (e) => save({ notes: e.target.value }));
    row.querySelector(".stg-status").addEventListener("change", async (e) => {
      e.target.className = "stg-status " + e.target.value;
      await save({ status: e.target.value });
    });
    row.querySelector(".row-del").addEventListener("click", async () => {
      await A.api("/stages/" + id, { method: "DELETE" });
      render();
    });
  }

  return { render, filterToProject };
})();
