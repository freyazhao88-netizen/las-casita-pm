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
    const { month, date, employeeId, projectId } = req.query;
    let list = await db.all("attendance");
    if (month) list = list.filter((a) => inMonth(a.workDate, month));
    if (date) list = list.filter((a) => a.workDate === date);
    if (employeeId) list = list.filter((a) => a.employeeId === Number(employeeId));
    if (projectId) list = list.filter((a) => a.projectId === Number(projectId));
    list.sort((a, b) => a.workDate.localeCompare(b.workDate));
    res.json(list.map((a) => ({ ...a, cost: entryCost(a) })));
  } catch (e) { next(e); }
});

router.post("/attendance", async (req, res, next) => {
  try {
    const { employeeId, adhocEmployeeName, projectId, adhocProjectName, workDate, days, rate, notes } = req.body || {};
    if (!workDate) return res.status(400).json({ error: "workDate is required" });
    const cleanAdhocEmployee = (adhocEmployeeName || "").trim();
    if (!employeeId && !cleanAdhocEmployee) return res.status(400).json({ error: "Pick an employee or type a one-off helper's name" });
    const cleanAdhoc = (adhocProjectName || "").trim();
    if (!projectId && !cleanAdhoc) return res.status(400).json({ error: "Pick a project or type a one-off job name" });
    if (employeeId && !(await db.find("employees", employeeId))) return res.status(400).json({ error: "Unknown employee" });
    if (projectId && !(await db.find("projects", projectId))) return res.status(400).json({ error: "Unknown project" });
    const rec = await db.insert("attendance", {
      employeeId: employeeId ? Number(employeeId) : null,
      adhocEmployeeName: employeeId ? "" : cleanAdhocEmployee,
      projectId: projectId ? Number(projectId) : null,
      adhocProjectName: projectId ? "" : cleanAdhoc,
      workDate,
      days: days === undefined || days === "" ? 1 : Number(days),
      rate: Number(rate) || 0,
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
    if ("employeeId" in req.body) patch.employeeId = req.body.employeeId ? Number(req.body.employeeId) : null;
    if ("adhocEmployeeName" in req.body) patch.adhocEmployeeName = req.body.adhocEmployeeName;
    if ("projectId" in req.body) patch.projectId = req.body.projectId ? Number(req.body.projectId) : null;
    if ("adhocProjectName" in req.body) patch.adhocProjectName = req.body.adhocProjectName;
    if ("workDate" in req.body) patch.workDate = req.body.workDate;
    if ("days" in req.body) patch.days = Number(req.body.days);
    if ("rate" in req.body) patch.rate = Number(req.body.rate);
    if ("notes" in req.body) patch.notes = req.body.notes;
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

// Monthly rollup: per employee -> total days, total wage, breakdown by project.
// Whether it's actually been paid lives in the wage-payments ledger (see
// /api/payroll-balances), not on individual attendance entries — that's the
// only way advances (paid ahead of the day being logged) stay consistent.
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
      const empKey = a.employeeId || ("adhoc:" + (a.adhocEmployeeName || ""));
      if (!byEmployee[empKey]) {
        const emp = a.employeeId ? employees.find((e) => e.id === a.employeeId) : null;
        byEmployee[empKey] = {
          employeeId: a.employeeId || null,
          employeeName: a.employeeId ? (emp ? emp.name : "Unknown") : (a.adhocEmployeeName || "One-off helper"),
          totalDays: 0,
          totalWage: 0,
          byProject: {}
        };
      }
      const bucket = byEmployee[empKey];
      const cost = entryCost(a);
      bucket.totalDays += Number(a.days) || 0;
      bucket.totalWage += cost;
      const projKey = a.projectId || ("adhoc:" + (a.adhocProjectName || ""));
      if (!bucket.byProject[projKey]) {
        const proj = a.projectId ? projects.find((p) => p.id === a.projectId) : null;
        bucket.byProject[projKey] = {
          projectId: a.projectId || null,
          projectName: a.projectId ? (proj ? proj.name : "Unknown") : (a.adhocProjectName || "One-off job"),
          days: 0,
          wage: 0
        };
      }
      bucket.byProject[projKey].days += Number(a.days) || 0;
      bucket.byProject[projKey].wage += cost;
    });

    const result = Object.values(byEmployee).map((b) => ({
      ...b,
      byProject: Object.values(b.byProject).sort((x, y) => y.wage - x.wage)
    })).sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    res.json({
      month,
      employees: result,
      grandTotalDays: result.reduce((s, b) => s + b.totalDays, 0),
      grandTotalWage: result.reduce((s, b) => s + b.totalWage, 0)
    });
  } catch (e) { next(e); }
});

module.exports = router;
