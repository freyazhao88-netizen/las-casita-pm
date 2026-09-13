"use strict";
const express = require("express");
const db = require("../db");
const { entryCost } = require("../summary");

const router = express.Router();

router.get("/small-jobs", async (req, res, next) => {
  try {
    const [attendance, materials, expenses, payments] = await Promise.all([
      db.all("attendance"),
      db.all("materials"),
      db.all("expenses"),
      db.all("payments")
    ]);

    const isAdhoc = (r) => !r.projectId && r.adhocProjectName;
    // Group by a case/whitespace-insensitive key so "12152Chino" and "12152chino"
    // (typed on different forms, on different days) land in the same job — but
    // keep the first-seen spelling as the display name.
    const normKey = (name) => (name || "").trim().toLowerCase();
    const jobs = {};
    const jobFor = (name) => {
      const key = normKey(name);
      if (!jobs[key]) {
        jobs[key] = { name: (name || "").trim(), laborTotal: 0, materialsTotal: 0, otherExpensesTotal: 0, amountReceived: 0, entries: [], lastActivity: "" };
      }
      return jobs[key];
    };
    const track = (job, date) => { if (date && date > job.lastActivity) job.lastActivity = date; };

    attendance.filter(isAdhoc).forEach((a) => {
      const job = jobFor(a.adhocProjectName);
      const cost = entryCost(a);
      job.laborTotal += cost;
      job.entries.push({ type: "labor", date: a.workDate, description: "Labor — " + a.days + " d × " + (Number(a.rate) || 0), amount: cost });
      track(job, a.workDate);
    });
    materials.filter(isAdhoc).forEach((m) => {
      const job = jobFor(m.adhocProjectName);
      const amt = Number(m.amount) || 0;
      job.materialsTotal += amt;
      job.entries.push({ type: "material", date: m.purchaseDate, description: "Material — " + (m.description || m.vendor || ""), amount: amt });
      track(job, m.purchaseDate);
    });
    expenses.filter(isAdhoc).forEach((e) => {
      const job = jobFor(e.adhocProjectName);
      const amt = Number(e.amount) || 0;
      job.otherExpensesTotal += amt;
      job.entries.push({ type: "expense", date: e.expenseDate, description: "Expense — " + (e.description || e.category || ""), amount: amt });
      track(job, e.expenseDate);
    });
    payments.filter(isAdhoc).forEach((p) => {
      const job = jobFor(p.adhocProjectName);
      const amt = Number(p.amount) || 0;
      job.amountReceived += amt;
      job.entries.push({ type: "payment", date: p.paymentDate, description: "Payment received" + (p.method ? " — " + p.method : ""), amount: amt });
      track(job, p.paymentDate);
    });

    const list = Object.values(jobs).map((j) => {
      const costTotal = j.laborTotal + j.materialsTotal + j.otherExpensesTotal;
      j.entries.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      return {
        name: j.name,
        laborTotal: j.laborTotal,
        materialsTotal: j.materialsTotal,
        otherExpensesTotal: j.otherExpensesTotal,
        costTotal,
        amountReceived: j.amountReceived,
        profit: j.amountReceived - costTotal,
        lastActivity: j.lastActivity,
        entries: j.entries
      };
    });
    list.sort((a, b) => (b.lastActivity || "").localeCompare(a.lastActivity || ""));
    res.json(list);
  } catch (e) { next(e); }
});

module.exports = router;
