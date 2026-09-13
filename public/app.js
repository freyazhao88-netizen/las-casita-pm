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

  // Native <input type="date"> technically allows a year of any length (its spec'd
  // value format is \d{4,}-\d{2}-\d{2}), so scrolling/holding the year spinner can run
  // past 9999. Clamp every date field on this page to a sane 4-digit year range.
  const DATE_MIN_YEAR = 1970;
  const DATE_MAX_YEAR = 2099;
  function clampDateValue(value) {
    const m = /^(\d+)-(\d{2})-(\d{2})$/.exec(value || "");
    if (!m) return value;
    let year = Number(m[1].slice(0, 4));
    if (year > DATE_MAX_YEAR) year = DATE_MAX_YEAR;
    if (year < DATE_MIN_YEAR) year = DATE_MIN_YEAR;
    return String(year).padStart(4, "0") + "-" + m[2] + "-" + m[3];
  }
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el && el.tagName === "INPUT" && el.type === "date" && el.value) {
      const clamped = clampDateValue(el.value);
      if (clamped !== el.value) el.value = clamped;
    }
  }, true);

  // Shared print/PDF modal (used by pay stubs, wage statements, etc.) — bound once
  // here so every caller just builds a document's HTML and hands it over.
  function showPrintSheet(html) {
    document.getElementById("payStubSheet").innerHTML = html;
    document.getElementById("payStubModal").hidden = false;
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnCloseStub").addEventListener("click", () => {
      document.getElementById("payStubModal").hidden = true;
    });
    document.getElementById("btnPrintStub").addEventListener("click", () => window.print());
    document.getElementById("payStubModal").addEventListener("click", (e) => {
      if (e.target.id === "payStubModal") document.getElementById("payStubModal").hidden = true;
    });

    document.getElementById("btnCloseDetail").addEventListener("click", () => {
      document.getElementById("detailModal").hidden = true;
    });
    document.getElementById("detailModal").addEventListener("click", (e) => {
      if (e.target.id === "detailModal") document.getElementById("detailModal").hidden = true;
    });
  });

  // Generic small modal for breakdowns (payables/receivables, etc.) — not print-oriented.
  function showDetailModal(title, html) {
    document.getElementById("detailModalTitle").textContent = title;
    document.getElementById("detailModalBody").innerHTML = html;
    document.getElementById("detailModal").hidden = false;
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

  // Safari has never supported <input type="month"> (it silently falls back to a
  // plain text box with no picker), so month pickers use a plain <select> instead —
  // works identically everywhere. Populates the most recent `monthsBack` months,
  // newest first, and selects the current month by default.
  function populateMonthSelect(select, monthsBack, includeAllOption) {
    if (!select || select.dataset.populated) return;
    select.dataset.populated = "1";
    const now = new Date();
    const options = [];
    if (includeAllOption) options.push('<option value="">All months</option>');
    for (let i = 0; i < (monthsBack || 24); i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      const label = d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
      options.push('<option value="' + value + '">' + label + '</option>');
    }
    select.innerHTML = options.join("");
    select.value = includeAllOption ? "" : currentMonth();
  }

  async function loadCoreData() {
    const [employees, projects] = await Promise.all([
      api("/employees"),
      api("/projects?summary=1")
    ]);
    state.employees = employees;
    state.projects = projects;
    populateSelect(document.getElementById("attEmployee"), employees, (e) => e.id, (e) => e.name);
    populateSelect(document.getElementById("attEmployeeFilter"), employees, (e) => e.id, (e) => e.name, "All employees");
    populateSelect(document.getElementById("wageEmployee"), employees, (e) => e.id, (e) => e.name);
    populateSelect(document.getElementById("wageEmployeeFilter"), employees, (e) => e.id, (e) => e.name, "All employees");
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
    populateSelect(document.getElementById("attProjectFilter"), active, (p) => p.id, (p) => p.name, "All projects");
    populateSelect(document.getElementById("matProjectFilter"), active, (p) => p.id, (p) => p.name, "All projects");
    populateSelect(document.getElementById("stgProjectFilter"), active, (p) => p.id, (p) => p.name, "All projects");
    populateSelect(document.getElementById("coProjectFilter"), active, (p) => p.id, (p) => p.name, "All projects");
    populateSelect(document.getElementById("payProjectFilter"), active, (p) => p.id, (p) => p.name, "All projects");
    populateSelect(document.getElementById("expProjectFilter"), active, (p) => p.id, (p) => p.name, "All projects");
    const nameOptions = document.getElementById("projectNameOptions");
    if (nameOptions) nameOptions.innerHTML = active.map((p) => '<option value="' + esc(p.name) + '">').join("");
    populateSelect(document.getElementById("slgProject"), active, (p) => p.id, (p) => p.name);
    populateSelect(document.getElementById("slgProjectFilter"), active, (p) => p.id, (p) => p.name, "All projects");
  }

  function projectName(id) {
    const p = state.projects.find((x) => x.id === Number(id));
    return p ? p.name : "—";
  }

  // For records that can point at either a real project or a typed one-off job name
  // (Other expenses, Client payments) — shows whichever one is set.
  function projectNameOf(entry) {
    return entry.projectId ? projectName(entry.projectId) : (entry.adhocProjectName || "—");
  }

  // Resolves a typed project-name string to an existing project's id when it matches
  // one exactly, so a combo text+datalist field can submit either a real project or a
  // one-off name through the same input.
  function resolveProjectInput(typedName) {
    const name = (typedName || "").trim();
    const match = state.projects.find((p) => p.name === name);
    return match ? { projectId: match.id, adhocProjectName: "" } : { projectId: null, adhocProjectName: name };
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
    if (window.StagesTab && name === "stages") window.StagesTab.render();
    if (window.ChangeOrdersTab && name === "changeorders") window.ChangeOrdersTab.render();
    if (window.PaymentsTab && name === "payments") window.PaymentsTab.render();
    if (window.QuotesTab && name === "quotes") window.QuotesTab.render();
    try { localStorage.setItem("lc-active-tab", name); } catch (e) {}
  }

  return {
    fmtMoney, fmtDate, esc, toast, api, currentMonth, todayISO, populateMonthSelect,
    state, loadCoreData, populateSelect, populateProjectSelects,
    projectName, projectNameOf, resolveProjectInput, employeeName, switchTab, showPrintSheet, showDetailModal
  };
})();
