"use strict";
const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/warranties", async (req, res, next) => {
  try {
    const { projectId } = req.query;
    let list = await db.all("warranties");
    if (projectId) list = list.filter((w) => w.projectId === Number(projectId));
    list.sort((a, b) => (a.expirationDate || "9999").localeCompare(b.expirationDate || "9999"));
    res.json(list);
  } catch (e) { next(e); }
});

router.post("/warranties", async (req, res, next) => {
  try {
    const { projectId, item, providerName, providerContact, startDate, expirationDate, notes } = req.body || {};
    if (!projectId || !item) return res.status(400).json({ error: "projectId and item are required" });
    if (!(await db.find("projects", projectId))) return res.status(400).json({ error: "Unknown project" });
    const rec = await db.insert("warranties", {
      projectId: Number(projectId),
      item: item.trim(),
      providerName: providerName || "",
      providerContact: providerContact || "",
      startDate: startDate || null,
      expirationDate: expirationDate || null,
      notes: notes || ""
    });
    res.status(201).json(rec);
  } catch (e) { next(e); }
});

router.put("/warranties/:id", async (req, res, next) => {
  try {
    const rec = await db.find("warranties", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = {};
    ["item", "providerName", "providerContact", "startDate", "expirationDate", "notes"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    res.json(await db.update("warranties", req.params.id, patch));
  } catch (e) { next(e); }
});

router.delete("/warranties/:id", async (req, res, next) => {
  try {
    const ok = await db.remove("warranties", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
