"use strict";
(function () {
  let employees = [];
  let projects = [];
  let pendingTodos = [];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function fmtDate(iso) {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    return parts[1] + "/" + parts[2] + "/" + parts[0];
  }
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2600);
  }
  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch("/api" + path, {
      method: opts.method || "GET",
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin"
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const msg = (data && data.error) || ("Request failed (" + res.status + ")");
      toast(msg);
      throw new Error(msg);
    }
    return data;
  }

  function resolveProjectInput(typedName) {
    const name = (typedName || "").trim();
    const match = projects.find((p) => p.name === name);
    return match ? { projectId: match.id, adhocProjectName: "" } : { projectId: null, adhocProjectName: name };
  }

  async function checkSession() {
    const res = await fetch("/api/session", { credentials: "same-origin" });
    return res.json();
  }

  async function boot() {
    const session = await checkSession();
    if (session.loggedIn) { await showApp(); } else { showLogin(); }
  }

  function showLogin() {
    document.getElementById("loginScreen").hidden = false;
    document.getElementById("app").hidden = true;
  }

  async function showApp() {
    document.getElementById("loginScreen").hidden = true;
    document.getElementById("app").hidden = false;
    document.getElementById("flDate").value = todayISO();
    const [emps, projs] = await Promise.all([api("/employees"), api("/projects")]);
    employees = emps.filter((e) => e.active);
    projects = projs;
    document.getElementById("flProjectOptions").innerHTML = projects.map((p) => '<option value="' + esc(p.name) + '">').join("");
    renderCrewChecklist();
    await renderTodos();
  }

  function renderCrewChecklist() {
    const host = document.getElementById("flCrewChecklist");
    host.innerHTML = employees.map((e) => (
      '<label class="fl-crew-cb-label"><input type="checkbox" class="fl-crew-cb" value="' + e.id + '">' + esc(e.name) + '</label>'
    )).join("");
  }

  function renderPendingTodos() {
    const host = document.getElementById("flTodoPending");
    host.innerHTML = pendingTodos.map((t, i) => (
      '<span class="chip todo-chip">' + esc(t) + ' <button type="button" data-idx="' + i + '">✕</button></span>'
    )).join("");
    host.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        pendingTodos.splice(Number(btn.getAttribute("data-idx")), 1);
        renderPendingTodos();
      });
    });
  }

  async function renderTodos() {
    const todos = await api("/site-logs/open-todos");
    const host = document.getElementById("flTodoList");
    if (!todos.length) {
      host.innerHTML = '<div class="fl-empty">没有待办事项 Nothing pending.</div>';
      return;
    }
    host.innerHTML = todos.map((t) => (
      '<label class="fl-todo-item">' +
        '<input type="checkbox" data-todo-toggle="' + t.logId + ':' + t.todoIndex + '">' +
        '<span><span>' + esc(t.text) + '</span><span class="meta">' + esc(t.projectName) + ' · ' + esc(fmtDate(t.logDate)) + '</span></span>' +
      '</label>'
    )).join("");
    host.querySelectorAll("[data-todo-toggle]").forEach((cb) => {
      cb.addEventListener("change", async () => {
        const [logId, idx] = cb.getAttribute("data-todo-toggle").split(":");
        await api("/site-logs/" + logId + "/todos/" + idx, { method: "PUT", body: { done: true } });
        renderTodos();
      });
    });
  }

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = document.getElementById("loginPassword").value;
    const errEl = document.getElementById("loginError");
    errEl.hidden = true;
    try {
      const res = await fetch("/api/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }), credentials: "same-origin"
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Incorrect password");
      document.getElementById("loginPassword").value = "";
      await showApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });

  document.getElementById("btnLogout").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    showLogin();
  });

  document.getElementById("flAddTodo").addEventListener("click", () => {
    const input = document.getElementById("flTodoInput");
    const text = input.value.trim();
    if (!text) return;
    pendingTodos.push(text);
    input.value = "";
    renderPendingTodos();
  });
  document.getElementById("flTodoInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("flAddTodo").click(); }
  });

  document.getElementById("flForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const crewEmployeeIds = [...document.querySelectorAll(".fl-crew-cb:checked")].map((cb) => Number(cb.value));
    const projectInput = resolveProjectInput(document.getElementById("flProject").value);
    if (!projectInput.projectId && !projectInput.adhocProjectName) { toast("请选择或输入项目"); return; }
    const body = Object.assign({
      logDate: document.getElementById("flDate").value,
      weather: document.getElementById("flWeather").value,
      crewEmployeeIds,
      notes: document.getElementById("flNotes").value,
      todos: pendingTodos.map((t) => ({ text: t, done: false }))
    }, projectInput);
    await api("/site-logs", { method: "POST", body });
    document.getElementById("flProject").value = "";
    document.getElementById("flWeather").value = "";
    document.getElementById("flNotes").value = "";
    document.querySelectorAll(".fl-crew-cb:checked").forEach((cb) => { cb.checked = false; });
    pendingTodos = [];
    renderPendingTodos();
    toast("日志已保存 Log saved");
    renderTodos();
  });

  boot();
})();
