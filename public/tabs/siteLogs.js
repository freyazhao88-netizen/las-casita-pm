"use strict";
window.SiteLogsTab = (function () {
  const A = window.App;
  let bound = false;
  let pendingTodos = [];
  let pendingCasual = [];
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

  function renderPendingCasual() {
    const host = document.getElementById("slgCasualPending");
    host.innerHTML = pendingCasual.map((n, i) => (
      '<span class="chip todo-chip">' + A.esc(n) + ' <button type="button" data-idx="' + i + '">✕</button></span>'
    )).join("");
    host.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        pendingCasual.splice(Number(btn.getAttribute("data-idx")), 1);
        renderPendingCasual();
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

    document.getElementById("slgAddCasual").addEventListener("click", () => {
      const input = document.getElementById("slgCasualInput");
      const name = input.value.trim();
      if (!name) return;
      if (!pendingCasual.some((n) => n.toLowerCase() === name.toLowerCase())) pendingCasual.push(name);
      input.value = "";
      renderPendingCasual();
    });
    document.getElementById("slgCasualInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); document.getElementById("slgAddCasual").click(); }
    });

    document.getElementById("slgForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const crewEmployeeIds = [...document.querySelectorAll(".slg-crew-cb:checked")].map((cb) => Number(cb.value));
      const projectInput = A.resolveProjectInput(document.getElementById("slgProject").value);
      if (!projectInput.projectId && !projectInput.adhocProjectName) { A.toast("Pick or type a project"); return; }
      const typedCasual = document.getElementById("slgCasualInput").value.trim();
      if (typedCasual && !pendingCasual.some((n) => n.toLowerCase() === typedCasual.toLowerCase())) pendingCasual.push(typedCasual);
      const body = Object.assign({
        casualCrew: pendingCasual,
        logDate: document.getElementById("slgDate").value,
        weather: document.getElementById("slgWeather").value,
        crewEmployeeIds,
        crewDays: Object.fromEntries(crewEmployeeIds.map((id) => [id, Number(document.querySelector('.slg-days[data-emp="' + id + '"]').value)])),
        notes: document.getElementById("slgNotes").value,
        todos: pendingTodos.map((t) => ({ text: t, done: false }))
      }, projectInput);
      const saved = await A.api("/site-logs", { method: "POST", body });
      document.getElementById("slgProject").value = "";
      document.getElementById("slgWeather").value = "";
      document.getElementById("slgNotes").value = "";
      document.querySelectorAll(".slg-crew-cb:checked").forEach((cb) => { cb.checked = false; });
      document.querySelectorAll(".slg-days").forEach((sel) => { sel.value = "1"; sel.style.display = "none"; });
      pendingTodos = [];
      renderPendingTodos();
      pendingCasual = [];
      document.getElementById("slgCasualInput").value = "";
      renderPendingCasual();
      A.toast(saved.warnings && saved.warnings.length ? "⚠ " + saved.warnings.join("；") : "Log saved — crew's attendance added automatically");
      render();
    });
  }

  function renderCrewChecklist() {
    const host = document.getElementById("slgCrewChecklist");
    const checkedIds = new Set([...document.querySelectorAll(".slg-crew-cb:checked")].map((cb) => cb.value));
    const daysById = {};
    document.querySelectorAll(".slg-days").forEach((sel) => { daysById[sel.getAttribute("data-emp")] = sel.value; });
    const employees = (A.state.employees || []).filter((e) => e.active);
    host.innerHTML = employees.map((e) => (
      '<label class="chip" style="cursor:pointer;display:inline-flex;align-items:center;">' +
        '<input type="checkbox" class="slg-crew-cb" value="' + e.id + '" style="margin-right:6px;"' + (checkedIds.has(String(e.id)) ? " checked" : "") + '>' +
        A.esc(e.name) +
        '<select class="slg-days" data-emp="' + e.id + '" style="' + (checkedIds.has(String(e.id)) ? "" : "display:none;") + 'margin-left:6px;font-size:12px;padding:2px 4px;border:1px solid var(--line);border-radius:4px;background:var(--surface);">' +
          ["1", "0.5"].map((v) => '<option value="' + v + '"' + ((daysById[e.id] || "1") === v ? " selected" : "") + '>' + (v === "1" ? "全天" : "半天") + '</option>').join("") +
        '</select>' +
      '</label>'
    )).join("");
    host.querySelectorAll(".slg-crew-cb").forEach((cb) => {
      cb.addEventListener("change", () => {
        const sel = host.querySelector('.slg-days[data-emp="' + cb.value + '"]');
        sel.style.display = cb.checked ? "" : "none";
        if (!cb.checked) sel.value = "1";
      });
    });
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

  function projectGroupHtml(logs, attendanceCasual) {
    const crew = mergedCrew(logs);
    const casualNames = (attendanceCasual || []).slice();
    logs.forEach((l) => (l.casualCrew || []).forEach((n) => {
      if (!casualNames.some((x) => x.toLowerCase() === n.toLowerCase())) casualNames.push(n);
    }));
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
