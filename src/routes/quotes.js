"use strict";
const express = require("express");
const db = require("../db");
const { computeAllSummaries } = require("../summary");

const router = express.Router();

function computeItemAmount(item) {
  if (item.mode === "na") return 0;
  if (item.mode === "qty") return (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
  return parseFloat(item.flatAmount) || 0;
}
function computeTotal(items) {
  return (items || []).reduce((sum, it) => sum + computeItemAmount(it), 0);
}

// The frontend works with a nested `meta` object; the DB stores those as flat columns.
function metaToRow(meta) {
  meta = meta || {};
  return {
    quoteNo: meta.quoteNo || "",
    quoteDate: meta.date || null,
    clientName: meta.client || "",
    address: meta.address || "",
    scope: meta.scope || "",
    referralSource: meta.referralSource || "",
    estimatePeriod: meta.period || "",
    startDate: meta.startDate || null,
    estEndDate: meta.estEndDate || null
  };
}
function rowToMeta(row) {
  return {
    quoteNo: row.quoteNo || "",
    date: row.quoteDate || "",
    client: row.clientName || "",
    address: row.address || "",
    scope: row.scope || "",
    referralSource: row.referralSource || "",
    period: row.estimatePeriod || "",
    startDate: row.startDate || "",
    estEndDate: row.estEndDate || ""
  };
}
function withMeta(row) {
  const { quoteNo, quoteDate, clientName, address, scope, referralSource, estimatePeriod, startDate, estEndDate, ...rest } = row;
  return { ...rest, meta: rowToMeta(row), total: computeTotal(row.items) };
}

// When a quote is marked "signed" and linked to a project, its total becomes
// that project's contract amount (quoted_total) — the baseline change orders build on.
async function syncToProjectIfSigned(row) {
  if (row.status === "signed" && row.projectId) {
    const patch = { quotedTotal: computeTotal(row.items) };
    // A signed contract is the authoritative version of these details — only overwrite
    // the project's own fields when the contract actually specifies them, so an unrelated
    // blank field on the quote never blanks out something already on the project.
    if (row.clientName) patch.clientName = row.clientName;
    if (row.address) patch.address = row.address;
    if (row.startDate) patch.startDate = row.startDate;
    if (row.estEndDate) patch.estEndDate = row.estEndDate;
    await db.update("projects", row.projectId, patch);
  }
}

router.get("/quotes", async (req, res, next) => {
  try {
    const { projectId } = req.query;
    let list = await db.all("quotes");
    if (projectId) list = list.filter((q) => q.projectId === Number(projectId));
    list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    res.json(list.map((q) => ({
      id: q.id, projectId: q.projectId, quoteNo: q.quoteNo, quoteDate: q.quoteDate,
      address: q.address, scope: q.scope, client: q.clientName, status: q.status || "draft",
      total: computeTotal(q.items), updatedAt: q.updatedAt
    })));
  } catch (e) { next(e); }
});

// For each project with a signed quote, finds the first payment-schedule step whose
// cumulative amount isn't yet covered by what the client has actually paid, and
// surfaces it if it's due within 10 days (or already overdue). Recomputed live from
// the current quote + payments each time, so edits to either are reflected immediately.
router.get("/quotes/payment-reminders", async (req, res, next) => {
  try {
    const [quotes, projects] = await Promise.all([db.all("quotes"), db.all("projects")]);
    const summaries = await computeAllSummaries(projects);

    const signedByProject = {};
    quotes.filter((q) => q.status === "signed" && q.projectId).forEach((q) => {
      const existing = signedByProject[q.projectId];
      if (!existing || (q.updatedAt || "") > (existing.updatedAt || "")) signedByProject[q.projectId] = q;
    });

    const today = new Date().toISOString().slice(0, 10);
    const reminders = [];
    Object.values(signedByProject).forEach((q) => {
      const project = projects.find((p) => p.id === q.projectId);
      if (!project) return;
      const received = (summaries[q.projectId] || {}).amountReceived || 0;
      const steps = (q.paymentSchedule || [])
        .filter((s) => s.dueDate)
        .slice()
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      let cumulative = 0;
      for (const step of steps) {
        cumulative += Number(step.amount) || 0;
        if (cumulative > received + 0.005) {
          const daysUntil = Math.round((new Date(step.dueDate) - new Date(today)) / 86400000);
          if (daysUntil <= 10) {
            reminders.push({
              projectId: project.id,
              projectName: project.name,
              label: step.label || "Payment due",
              amount: Number(step.amount) || 0,
              dueDate: step.dueDate,
              daysUntil
            });
          }
          break;
        }
      }
    });
    reminders.sort((a, b) => a.daysUntil - b.daysUntil);
    res.json(reminders);
  } catch (e) { next(e); }
});

router.get("/quotes/:id", async (req, res, next) => {
  try {
    const q = await db.find("quotes", req.params.id);
    if (!q) return res.status(404).json({ error: "Not found" });
    res.json(withMeta(q));
  } catch (e) { next(e); }
});

router.post("/quotes", async (req, res, next) => {
  try {
    const { projectId, meta, items, paymentSchedule, exclusions, status } = req.body || {};
    if (projectId && !(await db.find("projects", projectId))) return res.status(400).json({ error: "Unknown project" });
    const now = new Date().toISOString();
    const rec = await db.insert("quotes", {
      projectId: projectId ? Number(projectId) : null,
      ...metaToRow(meta),
      items: items || [],
      paymentSchedule: paymentSchedule || [],
      exclusions: exclusions || [],
      status: status || "draft",
      createdAt: now,
      updatedAt: now
    });
    await syncToProjectIfSigned(rec);
    res.status(201).json(withMeta(rec));
  } catch (e) { next(e); }
});

router.put("/quotes/:id", async (req, res, next) => {
  try {
    const rec = await db.find("quotes", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = { updatedAt: new Date().toISOString() };
    if (req.body.meta) Object.assign(patch, metaToRow(req.body.meta));
    ["items", "paymentSchedule", "exclusions", "status"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ("projectId" in req.body) patch.projectId = req.body.projectId ? Number(req.body.projectId) : null;
    const updated = await db.update("quotes", req.params.id, patch);
    await syncToProjectIfSigned(updated);
    res.json(withMeta(updated));
  } catch (e) { next(e); }
});

router.post("/quotes/:id/duplicate", async (req, res, next) => {
  try {
    const src = await db.find("quotes", req.params.id);
    if (!src) return res.status(404).json({ error: "Not found" });
    const now = new Date().toISOString();
    const rec = await db.insert("quotes", {
      projectId: src.projectId,
      ...metaToRow({ ...rowToMeta(src), quoteNo: "" }),
      items: JSON.parse(JSON.stringify(src.items)),
      paymentSchedule: JSON.parse(JSON.stringify(src.paymentSchedule)),
      exclusions: JSON.parse(JSON.stringify(src.exclusions)),
      status: "draft",
      createdAt: now,
      updatedAt: now
    });
    res.status(201).json(withMeta(rec));
  } catch (e) { next(e); }
});

router.delete("/quotes/:id", async (req, res, next) => {
  try {
    const ok = await db.remove("quotes", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
