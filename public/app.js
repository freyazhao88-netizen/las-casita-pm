"use strict";
window.App = (function () {
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const state = { employees: [], projects: [] };
  let toastTimer = null;

  function fmtMoney(n) { return money.format(isFinite(n) ? n : 0); }

  function fmtDate(iso) {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
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

  function currentMonth() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  async function loadCoreData() {
    const [employees, projects] = await Promise.all([
      api("/employees"),
      api("/projects?summary=1")
    ]);
    state.employees = employees;
    state.projects = projects;
    populateSelect(document.getElementById("attEmployee"), employees, (e) => e.id, (e) => e.name);
    populateProjectSelects();
  }

  function populateSelect(select, items, valueFn, labelFn, placeholder) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = "";
    if (placeholder) {
      const opt = document.createElement("option");
      opt.value = ""; opt.textContent = placeholder;
      select.appendChild(opt);
    }
    items.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = valueFn(item);
      opt.textContent = labelFn(item);
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  function populateProjectSelects() {
    const active = state.projects.slice().sort((a, b) => a.name.localeCompare(b.name));
    populateSelect(document.getElementById("attProject"), active, (p) => p.id, (p) => p.name);
    populateSelect(document.getElementById("matProject"), active, (p) => p.id, (p) => p.name);
    populateSelect(document.getElementById("matProjectFilter"), active, (p) => p.id, (p) => p.name, "All projects");
    populateSelect(document.getElementById("stgProjectFilter"), active, (p) => p.id, (p) => p.name, "All projects");
  }

  function projectName(id) {
    const p = state.projects.find((x) => x.id === Number(id));
    return p ? p.name : "—";
  }

  function employeeName(id) {
    const e = state.employees.find((x) => x.id === Number(id));
    return e ? e.name : "—";
  }

  function switchTab(name) {
    const activeBtn = document.querySelector('.nav-item[data-tab="' + name + '"]');
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
    const titleEl = document.getElementById("pageTitle");
    if (titleEl && activeBtn) titleEl.textContent = activeBtn.dataset.title || activeBtn.textContent.trim();
    if (window.DashboardTab && name === "dashboard") window.DashboardTab.render();
    if (window.ProjectsTab && name === "projects") window.ProjectsTab.render();
    if (window.AttendanceTab && name === "attendance") window.AttendanceTab.render();
    if (window.MaterialsTab && name === "materials") window.MaterialsTab.render();
    if (window.EmployeesTab && name === "employees") window.EmployeesTab.render();
    if (window.StagesTab && name === "stages") window.StagesTab.render();
    if (window.QuotesTab && name === "quotes") window.QuotesTab.render();
    try { localStorage.setItem("lc-active-tab", name); } catch (e) {}
  }

  return {
    fmtMoney, fmtDate, esc, toast, api, currentMonth, todayISO,
    state, loadCoreData, populateSelect, populateProjectSelects,
    projectName, employeeName, switchTab
  };
})();
