"use strict";
const express = require("express");
const db = require("../db");
const { computeProjectSummary, computeAllSummaries } = require("../summary");

const router = express.Router();

router.get("/projects", async (req, res, next) => {
  try {
    const withSummary = req.query.summary === "1";
    const list = (await db.all("projects")).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    if (!withSummary) return res.json(list);
    const summaries = await computeAllSummaries(list);
    res.json(list.map((p) => ({ ...p, summary: summaries[p.id] })));
  } catch (e) { next(e); }
});

router.get("/projects/:id", async (req, res, next) => {
  try {
    const p = await db.find("projects", req.params.id);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json({ ...p, summary: await computeProjectSummary(p) });
  } catch (e) { next(e); }
});

router.post("/projects", async (req, res, next) => {
  try {
    const { name, address, clientName, startDate, estEndDate, status, quotedTotal, notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Project name is required" });
    const rec = await db.insert("projects", {
      name: String(name).trim(),
      address: address || "",
      clientName: clientName || "",
      startDate: startDate || null,
      estEndDate: estEndDate || null,
      status: status || "active",
      quotedTotal: Number(quotedTotal) || 0,
      notes: notes || ""
    });
    res.status(201).json(rec);
  } catch (e) { next(e); }
});

router.put("/projects/:id", async (req, res, next) => {
  try {
    const rec = await db.find("projects", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = {};
    ["name", "address", "clientName", "status", "notes"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ("startDate" in req.body) patch.startDate = req.body.startDate || null;
    if ("estEndDate" in req.body) patch.estEndDate = req.body.estEndDate || null;
    if ("quotedTotal" in req.body) patch.quotedTotal = Number(req.body.quotedTotal) || 0;
    res.json(await db.update("projects", req.params.id, patch));
  } catch (e) { next(e); }
});

router.delete("/projects/:id", async (req, res, next) => {
  try {
    const ok = await db.remove("projects", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
