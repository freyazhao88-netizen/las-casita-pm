"use strict";
const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/payments", async (req, res, next) => {
  try {
    const { projectId } = req.query;
    let list = await db.all("payments");
    if (projectId) list = list.filter((p) => p.projectId === Number(projectId));
    list.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
    res.json(list);
  } catch (e) { next(e); }
});

router.post("/payments", async (req, res, next) => {
  try {
    const { projectId, paymentDate, amount, method, reference, notes } = req.body || {};
    if (!projectId || !paymentDate || amount === undefined || amount === "") {
      return res.status(400).json({ error: "projectId, paymentDate, and amount are required" });
    }
    if (!(await db.find("projects", projectId))) return res.status(400).json({ error: "Unknown project" });
    const rec = await db.insert("payments", {
      projectId: Number(projectId),
      paymentDate,
      amount: Number(amount) || 0,
      method: method || "",
      reference: reference || "",
      notes: notes || ""
    });
    res.status(201).json(rec);
  } catch (e) { next(e); }
});

router.put("/payments/:id", async (req, res, next) => {
  try {
    const rec = await db.find("payments", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = {};
    ["paymentDate", "method", "reference", "notes"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ("amount" in req.body) patch.amount = Number(req.body.amount) || 0;
    if ("projectId" in req.body) patch.projectId = Number(req.body.projectId);
    res.json(await db.update("payments", req.params.id, patch));
  } catch (e) { next(e); }
});

router.delete("/payments/:id", async (req, res, next) => {
  try {
    const ok = await db.remove("payments", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
