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

function crewNameText(employees, crewEmployeeIds) {
  return crewEmployeeIds
    .map((id) => { const e = employees.find((x) => x.id === id); return e ? e.name : null; })
    .filter(Boolean)
    .join(", ");
}

// Fills in that day's attendance for each crew member — defaults to a full day at
// their current rate. Never overwrites or removes an existing entry, so a manual
// correction (half day, different rate) made afterward is always preserved.
async function syncAttendanceForCrew(projectId, adhocProjectName, logDate, crewEmployeeIds, employees) {
  if (!crewEmployeeIds.length) return;
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
      days: 1,
      rate: Number(emp.defaultDailyRate) || 0,
      notes: "Auto-logged from site log"
    });
  }
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
    const { projectId, adhocProjectName, logDate, weather, crewEmployeeIds, notes, todos } = req.body || {};
    if (!logDate) return res.status(400).json({ error: "logDate is required" });
    const cleanAdhoc = (adhocProjectName || "").trim();
    if (!projectId && !cleanAdhoc) return res.status(400).json({ error: "Pick a project or type a one-off job name" });
    if (projectId && !(await db.find("projects", projectId))) return res.status(400).json({ error: "Unknown project" });
    const crewIds = cleanCrewIds(crewEmployeeIds);
    const employees = await db.all("employees");
    const rec = await db.insert("siteLogs", {
      projectId: projectId ? Number(projectId) : null,
      adhocProjectName: projectId ? "" : cleanAdhoc,
      logDate,
      weather: weather || "",
      crew: crewNameText(employees, crewIds),
      crewEmployeeIds: crewIds,
      notes: notes || "",
      todos: cleanTodos(todos)
    });
    await syncAttendanceForCrew(rec.projectId, rec.adhocProjectName, logDate, crewIds, employees);
    res.status(201).json(rec);
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

    let crewIds = null;
    let employees = null;
    if ("crewEmployeeIds" in req.body) {
      crewIds = cleanCrewIds(req.body.crewEmployeeIds);
      employees = await db.all("employees");
      patch.crewEmployeeIds = crewIds;
      patch.crew = crewNameText(employees, crewIds);
    }

    const updated = await db.update("siteLogs", req.params.id, patch);
    if (crewIds) await syncAttendanceForCrew(updated.projectId, updated.adhocProjectName, updated.logDate, crewIds, employees);
    res.json(updated);
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
