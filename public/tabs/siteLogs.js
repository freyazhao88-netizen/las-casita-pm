"use strict";
window.SiteLogsTab = (function () {
  const A = window.App;
  let bound = false;
  let pendingTodos = [];

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
      const body = {
        logDate: document.getElementById("slgDate").value,
        projectId: document.getElementById("slgProject").value,
        weather: document.getElementById("slgWeather").value,
        crew: document.getElementById("slgCrew").value,
        notes: document.getElementById("slgNotes").value,
        todos: pendingTodos.map((t) => ({ text: t, done: false }))
      };
      if (!body.projectId) { A.toast("Pick a project"); return; }
      await A.api("/site-logs", { method: "POST", body });
      document.getElementById("slgWeather").value = "";
      document.getElementById("slgCrew").value = "";
      document.getElementById("slgNotes").value = "";
      pendingTodos = [];
      renderPendingTodos();
      A.toast("Log saved");
      render();
    });
  }

  async function render() {
    bindOnce();
    const projectId = document.getElementById("slgProjectFilter").value;
    const list = await A.api("/site-logs" + (projectId ? "?projectId=" + projectId : ""));
    const host = document.getElementById("slgList");
    if (!list.length) {
      host.innerHTML = '<div class="empty-state">No site logs yet. Log today\'s entry above.</div>';
      return;
    }
    host.innerHTML = list.map((l) => logCardHtml(l)).join("");
    host.querySelectorAll("[data-del-log]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this log entry?")) return;
        await A.api("/site-logs/" + btn.getAttribute("data-del-log"), { method: "DELETE" });
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

  function logCardHtml(l) {
    const todosHtml = (l.todos || []).length
      ? '<div class="todo-list">' + l.todos.map((t, i) => (
          '<label class="' + (t.done ? "done" : "") + '">' +
            '<input type="checkbox" data-todo-toggle="' + l.id + ':' + i + '" ' + (t.done ? "checked" : "") + '>' +
            A.esc(t.text) +
          '</label>'
        )).join("") + '</div>'
      : "";
    return (
      '<div class="emp-summary-block">' +
        '<div class="head"><span>' + A.esc(A.fmtDate(l.logDate)) + ' — ' + A.esc(A.projectName(l.projectId)) + '</span>' +
        '<button class="row-del" data-del-log="' + l.id + '" title="Delete">✕</button></div>' +
        (l.weather ? '<div class="proj-line"><span>Weather</span><span>' + A.esc(l.weather) + '</span></div>' : "") +
        (l.crew ? '<div class="proj-line"><span>Crew</span><span>' + A.esc(l.crew) + '</span></div>' : "") +
        (l.notes ? '<p style="font-size:12.5px;color:var(--ink);margin:8px 0 0;">' + A.esc(l.notes) + '</p>' : "") +
        todosHtml +
      '</div>'
    );
  }

  return { render };
})();
