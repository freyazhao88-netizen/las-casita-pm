"use strict";
const express = require("express");
const db = require("../db");
const { entryCost } = require("../summary");

const router = express.Router();

// Public, read-only — identified by an unguessable per-employee token instead of the
// shared office password, so one worker can never see another worker's pay or hours.
router.get("/worker/:token", async (req, res, next) => {
  try {
    const employees = await db.all("employees");
    const emp = employees.find((e) => e.accessToken === req.params.token);
    if (!emp) return res.status(404).json({ error: "Not found" });

    const [attendance, wagePayments, projects] = await Promise.all([
      db.all("attendance"),
      db.all("wagePayments"),
      db.all("projects")
    ]);

    const projectName = (a) => {
      if (a.projectId) {
        const p = projects.find((x) => x.id === a.projectId);
        return p ? p.name : "Unknown";
      }
      return a.adhocProjectName || "One-off job";
    };

    const myAttendance = attendance
      .filter((a) => a.employeeId === emp.id)
      .map((a) => ({ workDate: a.workDate, projectName: projectName(a), days: a.days, rate: a.rate, cost: entryCost(a) }))
      .sort((a, b) => b.workDate.localeCompare(a.workDate));
    const myPayments = wagePayments
      .filter((p) => p.employeeId === emp.id)
      .map((p) => ({ paymentDate: p.paymentDate, amount: p.amount, method: p.method, notes: p.notes }))
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

    const totalOwed = myAttendance.reduce((s, a) => s + a.cost, 0);
    const totalPaid = myPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    res.json({
      name: emp.name,
      attendance: myAttendance.slice(0, 90),
      payments: myPayments.slice(0, 60),
      totalOwed,
      totalPaid,
      balance: totalOwed - totalPaid
    });
  } catch (e) { next(e); }
});

module.exports = router;
