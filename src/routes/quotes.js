"use strict";
const express = require("express");
const db = require("../db");

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

router.get("/quotes", async (req, res, next) => {
  try {
    const { projectId } = req.query;
    let list = await db.all("quotes");
    if (projectId) list = list.filter((q) => q.projectId === Number(projectId));
    list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    res.json(list.map((q) => ({
      id: q.id, projectId: q.projectId, quoteNo: q.quoteNo, quoteDate: q.quoteDate,
      address: q.address, scope: q.scope, client: q.clientName,
      total: computeTotal(q.items), updatedAt: q.updatedAt
    })));
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
    const { projectId, meta, items, paymentSchedule, exclusions } = req.body || {};
    if (projectId && !(await db.find("projects", projectId))) return res.status(400).json({ error: "Unknown project" });
    const now = new Date().toISOString();
    const rec = await db.insert("quotes", {
      projectId: projectId ? Number(projectId) : null,
      ...metaToRow(meta),
      items: items || [],
      paymentSchedule: paymentSchedule || [],
      exclusions: exclusions || [],
      createdAt: now,
      updatedAt: now
    });
    res.status(201).json(withMeta(rec));
  } catch (e) { next(e); }
});

router.put("/quotes/:id", async (req, res, next) => {
  try {
    const rec = await db.find("quotes", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = { updatedAt: new Date().toISOString() };
    if (req.body.meta) Object.assign(patch, metaToRow(req.body.meta));
    ["items", "paymentSchedule", "exclusions"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ("projectId" in req.body) patch.projectId = req.body.projectId ? Number(req.body.projectId) : null;
    const updated = await db.update("quotes", req.params.id, patch);
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
