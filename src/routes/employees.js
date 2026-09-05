"use strict";
const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/employees", async (req, res, next) => {
  try {
    const list = (await db.all("employees")).sort((a, b) => a.name.localeCompare(b.name));
    res.json(list);
  } catch (e) { next(e); }
});

router.post("/employees", async (req, res, next) => {
  try {
    const { name, defaultDailyRate, notes, ssn, idNumber } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Name is required" });
    const rec = await db.insert("employees", {
      name: String(name).trim(),
      defaultDailyRate: Number(defaultDailyRate) || 0,
      active: true,
      notes: notes || "",
      ssn: ssn || "",
      idNumber: idNumber || ""
    });
    res.status(201).json(rec);
  } catch (e) { next(e); }
});

router.put("/employees/:id", async (req, res, next) => {
  try {
    const rec = await db.find("employees", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = {};
    if ("name" in req.body) patch.name = String(req.body.name).trim();
    if ("defaultDailyRate" in req.body) patch.defaultDailyRate = Number(req.body.defaultDailyRate) || 0;
    if ("active" in req.body) patch.active = !!req.body.active;
    if ("notes" in req.body) patch.notes = req.body.notes;
    if ("ssn" in req.body) patch.ssn = req.body.ssn;
    if ("idNumber" in req.body) patch.idNumber = req.body.idNumber;
    res.json(await db.update("employees", req.params.id, patch));
  } catch (e) { next(e); }
});

router.delete("/employees/:id", async (req, res, next) => {
  try {
    const attendance = await db.all("attendance");
    const used = attendance.some((a) => a.employeeId === Number(req.params.id));
    if (used) return res.status(400).json({ error: "Cannot delete: employee has attendance records. Mark inactive instead." });
    const ok = await db.remove("employees", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
