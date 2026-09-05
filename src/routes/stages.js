"use strict";
const express = require("express");
const db = require("../db");

const router = express.Router();

// Cross-project view — every inspection across every project, joined with project name.
router.get("/stages", async (req, res, next) => {
  try {
    const { projectId, status } = req.query;
    const [stages, projects] = await Promise.all([db.all("stages"), db.all("projects")]);
    let list = stages.map((s) => ({
      ...s,
      projectName: (projects.find((p) => p.id === s.projectId) || {}).name || "Unknown"
    }));
    if (projectId) list = list.filter((s) => s.projectId === Number(projectId));
    if (status) list = list.filter((s) => s.status === status);
    list.sort((a, b) => (a.projectName || "").localeCompare(b.projectName) || a.sortOrder - b.sortOrder);
    res.json(list);
  } catch (e) { next(e); }
});

router.get("/projects/:projectId/stages", async (req, res, next) => {
  try {
    const list = (await db.all("stages"))
      .filter((s) => s.projectId === Number(req.params.projectId))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    res.json(list);
  } catch (e) { next(e); }
});

router.post("/projects/:projectId/stages", async (req, res, next) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!(await db.find("projects", projectId))) return res.status(404).json({ error: "Project not found" });
    const { name, department } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Inspection name is required" });
    const existing = (await db.all("stages")).filter((s) => s.projectId === projectId);
    const maxOrder = existing.reduce((m, s) => Math.max(m, s.sortOrder), -1);
    const rec = await db.insert("stages", {
      projectId,
      name: String(name).trim(),
      department: department || "",
      sortOrder: maxOrder + 1,
      inspectionDate: null,
      status: "scheduled",
      completedDate: null,
      notes: ""
    });
    res.status(201).json(rec);
  } catch (e) { next(e); }
});

router.put("/stages/:id", async (req, res, next) => {
  try {
    const rec = await db.find("stages", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = {};
    ["name", "department", "status", "notes"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ("inspectionDate" in req.body) patch.inspectionDate = req.body.inspectionDate || null;
    if ("completedDate" in req.body) patch.completedDate = req.body.completedDate || null;
    if (patch.status === "passed" && !rec.completedDate && !("completedDate" in patch)) {
      patch.completedDate = new Date().toISOString().slice(0, 10);
    }
    res.json(await db.update("stages", req.params.id, patch));
  } catch (e) { next(e); }
});

router.post("/stages/reorder", async (req, res, next) => {
  try {
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: "orderedIds array required" });
    await Promise.all(orderedIds.map((id, i) => db.update("stages", id, { sortOrder: i })));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete("/stages/:id", async (req, res, next) => {
  try {
    const ok = await db.remove("stages", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
