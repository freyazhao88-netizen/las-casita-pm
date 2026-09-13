"use strict";
window.SiteLogsTab = (function () {
  const A = window.App;
  let bound = false;
  let pendingTodos = [];
  const expandedDates = new Set();
  let initializedExpand = false;

  function renderPendingTodos() {
    const host = document.getElementById("slgTodoPending");
    host.innerHTML = pendingTodos.map((t, i) => (
      '<span class="chip todo-chip">' + A.esc(t) + ' <button type="button" data-idx="' + i + '">✕</button></span>'
    )).join("");
    host.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        pendingTodos.splice(Number(btn.getAttribute("data-idx")), 1);
        renderPendingTodos();
      });
    });
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.getElementById("slgDate").value = A.todayISO();
    A.populateMonthSelect(document.getElementById("slgMonthFilter"), 24);
    document.getElementById("slgMonthFilter").addEventListener("change", render);
    document.getElementById("slgProjectFilter").addEventListener("change", render);

    document.getElementById("slgAddTodo").addEventListener("click", () => {
      const input = document.getElementById("slgTodoInput");
      const text = input.value.trim();
      if (!text) return;
      pendingTodos.push(text);
      input.value = "";
      renderPendingTodos();
    });
    document.getElementById("slgTodoInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); document.getElementById("slgAddTodo").click(); }
    });

    document.getElementById("slgForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const crewEmployeeIds = [...document.querySelectorAll(".slg-crew-cb:checked")].map((cb) => Number(cb.value));
      const projectInput = A.resolveProjectInput(document.getElementById("slgProject").value);
      if (!projectInput.projectId && !projectInput.adhocProjectName) { A.toast("Pick or type a project"); return; }
      const body = Object.assign({
        logDate: document.getElementById("slgDate").value,
        weather: document.getElementById("slgWeather").value,
        crewEmployeeIds,
        notes: document.getElementById("slgNotes").value,
        todos: pendingTodos.map((t) => ({ text: t, done: false }))
      }, projectInput);
      await A.api("/site-logs", { method: "POST", body });
      document.getElementById("slgProject").value = "";
      document.getElementById("slgWeather").value = "";
      document.getElementById("slgNotes").value = "";
      document.querySelectorAll(".slg-crew-cb:checked").forEach((cb) => { cb.checked = false; });
      pendingTodos = [];
      renderPendingTodos();
      A.toast("Log saved — crew's attendance added automatically");
      render();
    });
  }

  function renderCrewChecklist() {
    const host = document.getElementById("slgCrewChecklist");
    const checkedIds = new Set([...document.querySelectorAll(".slg-crew-cb:checked")].map((cb) => cb.value));
    const employees = (A.state.employees || []).filter((e) => e.active);
    host.innerHTML = employees.map((e) => (
      '<label class="chip" style="cursor:pointer;">' +
        '<input type="checkbox" class="slg-crew-cb" value="' + e.id + '" style="margin-right:6px;"' + (checkedIds.has(String(e.id)) ? " checked" : "") + '>' +
        A.esc(e.name) +
      '</label>'
    )).join("");
  }

  async function render() {
    bindOnce();
    renderCrewChecklist();
    const month = document.getElementById("slgMonthFilter").value;
    const projectId = document.getElementById("slgProjectFilter").value;
    const params = [];
    if (month) params.push("month=" + month);
    if (projectId) params.push("projectId=" + projectId);
    const [list, attendance] = await Promise.all([
      A.api("/site-logs" + (params.length ? "?" + params.join("&") : "")),
      A.api("/attendance?" + (month ? "month=" + month : "month=" + A.currentMonth()))
    ]);
    const host = document.getElementById("slgList");
    if (!list.length) {
      host.innerHTML = '<div class="empty-state">No site logs for this month yet. Log today\'s entry above.</div>';
      return;
    }
    const casualMap = casualWorkerMap(attendance);
    const groupOrder = [];
    const byDate = {};
    list.forEach((l) => {
      if (!byDate[l.logDate]) { byDate[l.logDate] = []; groupOrder.push(l.logDate); }
      byDate[l.logDate].push(l);
    });
    if (!initializedExpand && groupOrder.length) {
      expandedDates.add(groupOrder[0]);
      initializedExpand = true;
    }
    host.innerHTML = groupOrder.map((d) => dayCardHtml(d, byDate[d], casualMap)).join("");
    host.querySelectorAll("details.slg-day").forEach((det) => {
      det.addEventListener("toggle", () => {
        const date = det.getAttribute("data-date");
        if (det.open) expandedDates.add(date); else expandedDates.delete(date);
      });
    });
    host.querySelectorAll("[data-del-log]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (!confirm("Delete this log entry?")) return;
        const ids = btn.getAttribute("data-del-log").split(",");
        for (const id of ids) await A.api("/site-logs/" + id, { method: "DELETE" });
        render();
      });
    });
    host.querySelectorAll("[data-todo-toggle]").forEach((cb) => {
      cb.addEventListener("change", async () => {
        const [logId, idx] = cb.getAttribute("data-todo-toggle").split(":");
        await A.api("/site-logs/" + logId + "/todos/" + idx, { method: "PUT", body: { done: cb.checked } });
        render();
      });
    });
  }

  // Groups a day's raw site_log rows by project — the "Log Today" form creates a
  // separate row per submission, so a project logged twice in one day (e.g. crew
  // added in two batches) would otherwise show as two identical-looking headers.
  function projectKeyOf(l) {
    return l.projectId ? ("id:" + l.projectId) : ("adhoc:" + (l.adhocProjectName || "").trim().toLowerCase());
  }

  function mergedCrew(logs) {
    const names = [];
    logs.forEach((l) => {
      (l.crew || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((n) => {
        if (!names.includes(n)) names.push(n);
      });
    });
    return names.join(", ");
  }

  // Casual/day laborers (logged via the Casual labor log, no employee record) never
  // show up in the site log's crew checklist — this pulls their names in from the
  // attendance table by matching the same date + project, so the site log's crew
  // line reflects who actually worked, not just who was checked on the form.
  function casualWorkerMap(attendance) {
    const map = {};
    attendance.filter((a) => !a.employeeId && (a.adhocEmployeeName || "").trim()).forEach((a) => {
      const key = a.workDate + "|" + projectKeyOf(a);
      const name = a.adhocEmployeeName.trim();
      if (!map[key]) map[key] = [];
      if (!map[key].includes(name)) map[key].push(name);
    });
    return map;
  }

  function projectGroupHtml(logs, casualNames) {
    const crew = mergedCrew(logs);
    const weather = (logs.find((l) => l.weather) || {}).weather || "";
    const notesHtml = logs.filter((l) => l.notes).map((l) => (
      '<p style="font-size:12.5px;color:var(--ink);margin:8px 0 0;">' + A.esc(l.notes) + '</p>'
    )).join("");
    const todosHtml = logs.filter((l) => (l.todos || []).length).map((l) => (
      '<div class="todo-list">' + l.todos.map((t, i) => (
        '<label class="' + (t.done ? "done" : "") + '">' +
          '<input type="checkbox" data-todo-toggle="' + l.id + ':' + i + '" ' + (t.done ? "checked" : "") + '>' +
          A.esc(t.text) +
        '</label>'
      )).join("") + '</div>'
    )).join("");
    const delIds = logs.map((l) => l.id).join(",");
    return (
      '<div class="proj-line" style="font-weight:600;"><span>' + A.esc(A.projectNameOf(logs[0])) + '</span>' +
      '<button class="row-del" data-del-log="' + delIds + '" title="Delete">✕</button></div>' +
      (weather ? '<div class="proj-line"><span>Weather</span><span>' + A.esc(weather) + '</span></div>' : "") +
      (crew ? '<div class="proj-line"><span>Crew</span><span>' + A.esc(crew) + '</span></div>' : "") +
      (casualNames && casualNames.length ? '<div class="proj-line"><span>Casual 临时工</span><span>' + A.esc(casualNames.join(", ")) + '</span></div>' : "") +
      notesHtml +
      todosHtml
    );
  }

  function dayCardHtml(date, logs, casualMap) {
    const groupOrder = [];
    const byProject = {};
    logs.forEach((l) => {
      const key = projectKeyOf(l);
      if (!byProject[key]) { byProject[key] = []; groupOrder.push(key); }
      byProject[key].push(l);
    });
    const entriesHtml = groupOrder.map((key, i) => (
      '<div' + (i > 0 ? ' style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);"' : '') + '>' +
        projectGroupHtml(byProject[key], casualMap[date + "|" + key]) +
      '</div>'
    )).join("");
    const isOpen = expandedDates.has(date);
    return (
      '<details class="emp-summary-block slg-day" data-date="' + A.esc(date) + '"' + (isOpen ? " open" : "") + '>' +
        '<summary class="head" style="cursor:pointer;"><span>' + A.esc(A.fmtDate(date)) + '</span>' +
        '<span class="hint">' + groupOrder.length + ' project' + (groupOrder.length === 1 ? "" : "s") + ' ' + (isOpen ? "▾" : "▸") + '</span></summary>' +
        '<div style="margin-top:10px;">' + entriesHtml + '</div>' +
      '</details>'
    );
  }

  return { render };
})();
