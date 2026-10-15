"use strict";
const express = require("express");
const db = require("../db");

const router = express.Router();

function cleanTodos(todos) {
  return Array.isArray(todos)
    ? todos.map((t) => ({ text: String((t && t.text) || "").trim(), done: !!(t && t.done) })).filter((t) => t.text)
    : [];
}

function cleanCrewIds(crewEmployeeIds) {
  return Array.isArray(crewEmployeeIds) ? crewEmployeeIds.map(Number).filter((n) => Number.isFinite(n)) : [];
}

function cleanCasualCrew(names) {
  if (!Array.isArray(names)) return [];
  const seen = new Set();
  return names.map((n) => String(n || "").trim()).filter((n) => {
    const key = n.toLowerCase();
    if (!n || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// { employeeId: days } for each crew member — 1 (full day) unless a smaller share of
// the day was worked here (e.g. 0.5 when the worker split the day across two sites).
function cleanCrewDays(crewDays, crewIds) {
  const out = {};
  crewIds.forEach((id) => {
    const d = Number(crewDays && crewDays[id]);
    out[id] = d > 0 && d <= 1 ? d : 1;
  });
  return out;
}

function crewNameText(employees, crewEmployeeIds, crewDays) {
  return crewEmployeeIds
    .map((id) => {
      const e = employees.find((x) => x.id === id);
      if (!e) return null;
      const d = crewDays && crewDays[id];
      return d && d < 1 ? e.name + " (" + d + "d)" : e.name;
    })
    .filter(Boolean)
    .join(", ");
}

// Fills in that day's attendance for each crew member — defaults to a full day at
// their current rate. Never overwrites or removes an existing entry, so a manual
// correction (half day, different rate) made afterward is always preserved.
async function syncAttendanceForCrew(projectId, adhocProjectName, logDate, crewEmployeeIds, employees, crewDays) {
  if (!crewEmployeeIds.length) return [];
  const attendance = await db.all("attendance");
  for (const employeeId of crewEmployeeIds) {
    const exists = attendance.some((a) => a.employeeId === employeeId && a.workDate === logDate &&
      (projectId ? a.projectId === projectId : a.adhocProjectName === adhocProjectName));
    if (exists) continue;
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) continue;
    await db.insert("attendance", {
      employeeId,
      projectId,
      adhocProjectName: projectId ? "" : adhocProjectName,
      workDate: logDate,
      days: (crewDays && crewDays[employeeId]) || 1,
      rate: Number(emp.defaultDailyRate) || 0,
      notes: "Auto-logged from site log"
    });
  }

  // Warn when a worker's total across all sites that day adds up to more than one day.
  const after = await db.all("attendance");
  const warnings = [];
  for (const employeeId of crewEmployeeIds) {
    const total = after.filter((a) => a.employeeId === employeeId && a.workDate === logDate)
      .reduce((sum, a) => sum + (Number(a.days) || 0), 0);
    if (total > 1.0001) {
      const emp = employees.find((e) => e.id === employeeId);
      warnings.push((emp ? emp.name : "Worker") + " 当天合计 " + total + " 天（超过 1 天，请确认）");
    }
  }
  return warnings;
}

router.get("/site-logs", async (req, res, next) => {
  try {
    const { projectId, month } = req.query;
    let list = await db.all("siteLogs");
    if (projectId) list = list.filter((l) => l.projectId === Number(projectId));
    if (month) list = list.filter((l) => l.logDate && l.logDate.slice(0, 7) === month);
    list.sort((a, b) => b.logDate.localeCompare(a.logDate) || b.id - a.id);
    res.json(list);
  } catch (e) { next(e); }
});

// Flattened list of open (unchecked) to-do items across active projects' site logs — for the Dashboard.
router.get("/site-logs/open-todos", async (req, res, next) => {
  try {
    const [logs, projects] = await Promise.all([db.all("siteLogs"), db.all("projects")]);
    const activeIds = new Set(projects.filter((p) => p.status === "active").map((p) => p.id));
    const projectName = (id) => { const p = projects.find((x) => x.id === id); return p ? p.name : ""; };
    const open = [];
    logs.filter((l) => (l.projectId ? activeIds.has(l.projectId) : true)).forEach((l) => {
      (l.todos || []).forEach((t, idx) => {
        if (!t.done) {
          open.push({ logId: l.id, todoIndex: idx, projectId: l.projectId, projectName: l.projectId ? projectName(l.projectId) : (l.adhocProjectName || "One-off job"), logDate: l.logDate, text: t.text });
        }
      });
    });
    open.sort((a, b) => a.logDate.localeCompare(b.logDate));
    res.json(open);
  } catch (e) { next(e); }
});

router.post("/site-logs", async (req, res, next) => {
  try {
    const { projectId, adhocProjectName, logDate, weather, crewEmployeeIds, crewDays, casualCrew, notes, todos } = req.body || {};
    if (!logDate) return res.status(400).json({ error: "logDate is required" });
    const cleanAdhoc = (adhocProjectName || "").trim();
    if (!projectId && !cleanAdhoc) return res.status(400).json({ error: "Pick a project or type a one-off job name" });
    if (projectId && !(await db.find("projects", projectId))) return res.status(400).json({ error: "Unknown project" });
    const crewIds = cleanCrewIds(crewEmployeeIds);
    const days = cleanCrewDays(crewDays, crewIds);
    const employees = await db.all("employees");
    const rec = await db.insert("siteLogs", {
      projectId: projectId ? Number(projectId) : null,
      adhocProjectName: projectId ? "" : cleanAdhoc,
      logDate,
      weather: weather || "",
      crew: crewNameText(employees, crewIds, days),
      crewEmployeeIds: crewIds,
      crewDays: days,
      casualCrew: cleanCasualCrew(casualCrew),
      notes: notes || "",
      todos: cleanTodos(todos)
    });
    const warnings = await syncAttendanceForCrew(rec.projectId, rec.adhocProjectName, logDate, crewIds, employees, days);
    res.status(201).json({ ...rec, warnings });
  } catch (e) { next(e); }
});

router.put("/site-logs/:id", async (req, res, next) => {
  try {
    const rec = await db.find("siteLogs", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = {};
    ["logDate", "weather", "notes"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ("projectId" in req.body) patch.projectId = req.body.projectId ? Number(req.body.projectId) : null;
    if ("adhocProjectName" in req.body) patch.adhocProjectName = req.body.adhocProjectName;
    if ("todos" in req.body) patch.todos = cleanTodos(req.body.todos);
    if ("casualCrew" in req.body) patch.casualCrew = cleanCasualCrew(req.body.casualCrew);

    let crewIds = null;
    let employees = null;
    if ("crewEmployeeIds" in req.body) {
      crewIds = cleanCrewIds(req.body.crewEmployeeIds);
      employees = await db.all("employees");
      const days = cleanCrewDays(req.body.crewDays, crewIds);
      patch.crewEmployeeIds = crewIds;
      patch.crewDays = days;
      patch.crew = crewNameText(employees, crewIds, days);
    }

    const updated = await db.update("siteLogs", req.params.id, patch);
    let warnings = [];
    if (crewIds) warnings = await syncAttendanceForCrew(updated.projectId, updated.adhocProjectName, updated.logDate, crewIds, employees, patch.crewDays);
    res.json({ ...updated, warnings });
  } catch (e) { next(e); }
});

// Toggle a single to-do item's done state without resending the whole log.
router.put("/site-logs/:id/todos/:index", async (req, res, next) => {
  try {
    const rec = await db.find("siteLogs", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const idx = Number(req.params.index);
    const todos = Array.isArray(rec.todos) ? rec.todos.slice() : [];
    if (!todos[idx]) return res.status(404).json({ error: "To-do item not found" });
    todos[idx] = { ...todos[idx], done: !!req.body.done };
    res.json(await db.update("siteLogs", req.params.id, { todos }));
  } catch (e) { next(e); }
});

router.delete("/site-logs/:id", async (req, res, next) => {
  try {
    const ok = await db.remove("siteLogs", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
