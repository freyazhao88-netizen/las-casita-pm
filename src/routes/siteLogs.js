"use strict";
const express = require("express");
const db = require("../db");

const router = express.Router();

function cleanTodos(todos) {
  return Array.isArray(todos)
    ? todos.map((t) => ({ text: String((t && t.text) || "").trim(), done: !!(t && t.done) })).filter((t) => t.text)
    : [];
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
    logs.filter((l) => activeIds.has(l.projectId)).forEach((l) => {
      (l.todos || []).forEach((t, idx) => {
        if (!t.done) {
          open.push({ logId: l.id, todoIndex: idx, projectId: l.projectId, projectName: projectName(l.projectId), logDate: l.logDate, text: t.text });
        }
      });
    });
    open.sort((a, b) => a.logDate.localeCompare(b.logDate));
    res.json(open);
  } catch (e) { next(e); }
});

router.post("/site-logs", async (req, res, next) => {
  try {
    const { projectId, logDate, weather, crew, notes, todos } = req.body || {};
    if (!projectId || !logDate) return res.status(400).json({ error: "projectId and logDate are required" });
    if (!(await db.find("projects", projectId))) return res.status(400).json({ error: "Unknown project" });
    const rec = await db.insert("siteLogs", {
      projectId: Number(projectId),
      logDate,
      weather: weather || "",
      crew: crew || "",
      notes: notes || "",
      todos: cleanTodos(todos)
    });
    res.status(201).json(rec);
  } catch (e) { next(e); }
});

router.put("/site-logs/:id", async (req, res, next) => {
  try {
    const rec = await db.find("siteLogs", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = {};
    ["logDate", "weather", "crew", "notes"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ("projectId" in req.body) patch.projectId = Number(req.body.projectId);
    if ("todos" in req.body) patch.todos = cleanTodos(req.body.todos);
    res.json(await db.update("siteLogs", req.params.id, patch));
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
