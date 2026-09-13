"use strict";
const express = require("express");
const db = require("../db");
const { entryCost } = require("../summary");

const router = express.Router();

// Group by a case/whitespace-insensitive key so "12152Chino" and "12152chino"
// (typed on different forms, on different days) land in the same job.
function normKey(name) {
  return (name || "").trim().toLowerCase();
}

router.get("/small-jobs/:name/info", async (req, res, next) => {
  try {
    const key = normKey(req.params.name);
    const infos = await db.all("smallJobInfo");
    const info = infos.find((i) => i.nameKey === key);
    res.json(info || { nameKey: key, contactName: "", phone: "", address: "", notes: "" });
  } catch (e) { next(e); }
});

router.put("/small-jobs/:name/info", async (req, res, next) => {
  try {
    const key = normKey(req.params.name);
    if (!key) return res.status(400).json({ error: "Job name is required" });
    const { contactName, phone, address, notes } = req.body || {};
    const infos = await db.all("smallJobInfo");
    const existing = infos.find((i) => i.nameKey === key);
    const patch = {
      nameKey: key,
      displayName: req.params.name.trim(),
      contactName: contactName || "",
      phone: phone || "",
      address: address || "",
      notes: notes || ""
    };
    const rec = existing ? await db.update("smallJobInfo", existing.id, patch) : await db.insert("smallJobInfo", patch);
    res.json(rec);
  } catch (e) { next(e); }
});

router.get("/small-jobs", async (req, res, next) => {
  try {
    const [attendance, materials, expenses, payments, infos] = await Promise.all([
      db.all("attendance"),
      db.all("materials"),
      db.all("expenses"),
      db.all("payments"),
      db.all("smallJobInfo")
    ]);

    const isAdhoc = (r) => !r.projectId && r.adhocProjectName;
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
      const info = infos.find((i) => i.nameKey === normKey(j.name));
      return {
        name: j.name,
        laborTotal: j.laborTotal,
        materialsTotal: j.materialsTotal,
        otherExpensesTotal: j.otherExpensesTotal,
        costTotal,
        amountReceived: j.amountReceived,
        profit: j.amountReceived - costTotal,
        lastActivity: j.lastActivity,
        entries: j.entries,
        contactName: info ? info.contactName : "",
        phone: info ? info.phone : "",
        address: info ? info.address : "",
        notes: info ? info.notes : ""
      };
    });
    list.sort((a, b) => (b.lastActivity || "").localeCompare(a.lastActivity || ""));
    res.json(list);
  } catch (e) { next(e); }
});

module.exports = router;
