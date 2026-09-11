"use strict";
const express = require("express");
const db = require("../db");
const { entryCost } = require("../summary");

const router = express.Router();

router.get("/wage-payments", async (req, res, next) => {
  try {
    const { employeeId } = req.query;
    let list = await db.all("wagePayments");
    if (employeeId) list = list.filter((p) => p.employeeId === Number(employeeId));
    list.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
    res.json(list);
  } catch (e) { next(e); }
});

router.post("/wage-payments", async (req, res, next) => {
  try {
    const { employeeId, paymentDate, amount, method, notes } = req.body || {};
    if (!employeeId || !paymentDate || amount === undefined || amount === "") {
      return res.status(400).json({ error: "employeeId, paymentDate, and amount are required" });
    }
    if (!(await db.find("employees", employeeId))) return res.status(400).json({ error: "Unknown employee" });
    const rec = await db.insert("wagePayments", {
      employeeId: Number(employeeId),
      paymentDate,
      amount: Number(amount) || 0,
      method: method || "",
      notes: notes || ""
    });
    res.status(201).json(rec);
  } catch (e) { next(e); }
});

router.put("/wage-payments/:id", async (req, res, next) => {
  try {
    const rec = await db.find("wagePayments", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = {};
    ["paymentDate", "method", "notes"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ("amount" in req.body) patch.amount = Number(req.body.amount) || 0;
    if ("employeeId" in req.body) patch.employeeId = Number(req.body.employeeId);
    res.json(await db.update("wagePayments", req.params.id, patch));
  } catch (e) { next(e); }
});

router.delete("/wage-payments/:id", async (req, res, next) => {
  try {
    const ok = await db.remove("wagePayments", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Per-employee, all-time: wages earned (from attendance) vs. wages actually paid
// (from this ledger) — the running balance naturally covers advances (it can go
// negative, meaning the worker has been paid ahead of what they've earned so far).
router.get("/payroll-balances", async (req, res, next) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [employees, attendance, wagePayments] = await Promise.all([
      db.all("employees"),
      db.all("attendance"),
      db.all("wagePayments")
    ]);
    const result = employees.map((e) => {
      const empAttendance = attendance.filter((a) => a.employeeId === e.id);
      const totalOwed = empAttendance.reduce((s, a) => s + entryCost(a), 0);
      const totalPaid = wagePayments.filter((p) => p.employeeId === e.id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const thisMonthOwed = empAttendance
        .filter((a) => a.workDate && a.workDate.slice(0, 7) === month)
        .reduce((s, a) => s + entryCost(a), 0);
      return {
        employeeId: e.id,
        employeeName: e.name,
        active: e.active,
        totalOwed,
        totalPaid,
        balance: totalOwed - totalPaid,
        thisMonthOwed
      };
    }).filter((r) => r.totalOwed > 0.005 || r.totalPaid > 0.005 || r.active);
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
