"use strict";
const express = require("express");
const db = require("../db");
const { entryCost } = require("../summary");

const router = express.Router();

function inMonth(dateStr, month) {
  return !!dateStr && dateStr.slice(0, 7) === month;
}

router.get("/attendance", async (req, res, next) => {
  try {
    const { month, employeeId, projectId } = req.query;
    let list = await db.all("attendance");
    if (month) list = list.filter((a) => inMonth(a.workDate, month));
    if (employeeId) list = list.filter((a) => a.employeeId === Number(employeeId));
    if (projectId) list = list.filter((a) => a.projectId === Number(projectId));
    list.sort((a, b) => a.workDate.localeCompare(b.workDate));
    res.json(list.map((a) => ({ ...a, cost: entryCost(a) })));
  } catch (e) { next(e); }
});

router.post("/attendance", async (req, res, next) => {
  try {
    const { employeeId, projectId, workDate, days, rate, notes } = req.body || {};
    if (!employeeId || !projectId || !workDate) {
      return res.status(400).json({ error: "employeeId, projectId, and workDate are required" });
    }
    if (!(await db.find("employees", employeeId))) return res.status(400).json({ error: "Unknown employee" });
    if (!(await db.find("projects", projectId))) return res.status(400).json({ error: "Unknown project" });
    const rec = await db.insert("attendance", {
      employeeId: Number(employeeId),
      projectId: Number(projectId),
      workDate,
      days: days === undefined || days === "" ? 1 : Number(days),
      rate: Number(rate) || 0,
      paymentStatus: "unpaid",
      notes: notes || ""
    });
    res.status(201).json({ ...rec, cost: entryCost(rec) });
  } catch (e) { next(e); }
});

router.put("/attendance/:id", async (req, res, next) => {
  try {
    const rec = await db.find("attendance", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = {};
    if ("employeeId" in req.body) patch.employeeId = Number(req.body.employeeId);
    if ("projectId" in req.body) patch.projectId = Number(req.body.projectId);
    if ("workDate" in req.body) patch.workDate = req.body.workDate;
    if ("days" in req.body) patch.days = Number(req.body.days);
    if ("rate" in req.body) patch.rate = Number(req.body.rate);
    if ("notes" in req.body) patch.notes = req.body.notes;
    if ("paymentStatus" in req.body) patch.paymentStatus = req.body.paymentStatus;
    const updated = await db.update("attendance", req.params.id, patch);
    res.json({ ...updated, cost: entryCost(updated) });
  } catch (e) { next(e); }
});

router.delete("/attendance/:id", async (req, res, next) => {
  try {
    const ok = await db.remove("attendance", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Monthly rollup: per employee -> total days, total wage, breakdown by project, payment status
router.get("/attendance/summary", async (req, res, next) => {
  try {
    const month = req.query.month;
    if (!month) return res.status(400).json({ error: "month (YYYY-MM) is required" });
    const [allAttendance, employees, projects] = await Promise.all([
      db.all("attendance"), db.all("employees"), db.all("projects")
    ]);
    const entries = allAttendance.filter((a) => inMonth(a.workDate, month));
    const byEmployee = {};

    entries.forEach((a) => {
      if (!byEmployee[a.employeeId]) {
        const emp = employees.find((e) => e.id === a.employeeId);
        byEmployee[a.employeeId] = {
          employeeId: a.employeeId,
          employeeName: emp ? emp.name : "Unknown",
          totalDays: 0,
          totalWage: 0,
          unpaidWage: 0,
          byProject: {}
        };
      }
      const bucket = byEmployee[a.employeeId];
      const cost = entryCost(a);
      bucket.totalDays += Number(a.days) || 0;
      bucket.totalWage += cost;
      if (a.paymentStatus !== "paid") bucket.unpaidWage += cost;
      if (!bucket.byProject[a.projectId]) {
        const proj = projects.find((p) => p.id === a.projectId);
        bucket.byProject[a.projectId] = {
          projectId: a.projectId,
          projectName: proj ? proj.name : "Unknown",
          days: 0,
          wage: 0
        };
      }
      bucket.byProject[a.projectId].days += Number(a.days) || 0;
      bucket.byProject[a.projectId].wage += cost;
    });

    const result = Object.values(byEmployee).map((b) => ({
      ...b,
      byProject: Object.values(b.byProject).sort((x, y) => y.wage - x.wage)
    })).sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    res.json({
      month,
      employees: result,
      grandTotalDays: result.reduce((s, b) => s + b.totalDays, 0),
      grandTotalWage: result.reduce((s, b) => s + b.totalWage, 0),
      grandUnpaidWage: result.reduce((s, b) => s + b.unpaidWage, 0)
    });
  } catch (e) { next(e); }
});

module.exports = router;
