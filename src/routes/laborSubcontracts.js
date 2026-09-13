"use strict";
const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/labor-subcontracts", async (req, res, next) => {
  try {
    const { projectId, month, paymentStatus } = req.query;
    let list = await db.all("laborSubcontracts");
    if (projectId) list = list.filter((s) => s.projectId === Number(projectId));
    if (month) list = list.filter((s) => s.startDate && s.startDate.slice(0, 7) === month);
    if (paymentStatus) list = list.filter((s) => s.paymentStatus === paymentStatus);
    list.sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    res.json(list);
  } catch (e) { next(e); }
});

router.post("/labor-subcontracts", async (req, res, next) => {
  try {
    const { projectId, adhocProjectName, description, amount, startDate, endDate, notes } = req.body || {};
    if (!description || !String(description).trim()) return res.status(400).json({ error: "Description is required" });
    if (amount === undefined || amount === "") return res.status(400).json({ error: "Amount is required" });
    if (!startDate) return res.status(400).json({ error: "Start date is required" });
    const cleanAdhoc = (adhocProjectName || "").trim();
    if (!projectId && !cleanAdhoc) return res.status(400).json({ error: "Pick a project or type a one-off job name" });
    if (projectId && !(await db.find("projects", projectId))) return res.status(400).json({ error: "Unknown project" });
    const rec = await db.insert("laborSubcontracts", {
      projectId: projectId ? Number(projectId) : null,
      adhocProjectName: projectId ? "" : cleanAdhoc,
      description: String(description).trim(),
      amount: Number(amount) || 0,
      startDate,
      endDate: endDate || null,
      notes: notes || "",
      paymentStatus: "unpaid"
    });
    res.status(201).json(rec);
  } catch (e) { next(e); }
});

router.put("/labor-subcontracts/:id", async (req, res, next) => {
  try {
    const rec = await db.find("laborSubcontracts", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = {};
    ["description", "startDate", "endDate", "notes", "adhocProjectName", "paymentStatus"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ("amount" in req.body) patch.amount = Number(req.body.amount) || 0;
    if ("projectId" in req.body) patch.projectId = req.body.projectId ? Number(req.body.projectId) : null;
    res.json(await db.update("laborSubcontracts", req.params.id, patch));
  } catch (e) { next(e); }
});

router.delete("/labor-subcontracts/:id", async (req, res, next) => {
  try {
    const ok = await db.remove("laborSubcontracts", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
