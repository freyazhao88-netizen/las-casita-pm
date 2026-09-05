"use strict";
const express = require("express");
const db = require("../db");
const { computeItemsTotal } = require("../summary");

const router = express.Router();

function withTotal(row) {
  return { ...row, total: computeItemsTotal(row.items) };
}

// Cross-project view — every change order across every project, joined with project name.
router.get("/change-orders", async (req, res, next) => {
  try {
    const { projectId, status } = req.query;
    const [orders, projects] = await Promise.all([db.all("changeOrders"), db.all("projects")]);
    let list = orders.map((o) => ({
      ...o,
      projectName: (projects.find((p) => p.id === o.projectId) || {}).name || "Unknown"
    }));
    if (projectId) list = list.filter((o) => o.projectId === Number(projectId));
    if (status) list = list.filter((o) => o.status === status);
    list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    res.json(list.map(withTotal));
  } catch (e) { next(e); }
});

router.get("/projects/:projectId/change-orders", async (req, res, next) => {
  try {
    const list = (await db.all("changeOrders"))
      .filter((o) => o.projectId === Number(req.params.projectId))
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    res.json(list.map(withTotal));
  } catch (e) { next(e); }
});

router.get("/change-orders/:id", async (req, res, next) => {
  try {
    const o = await db.find("changeOrders", req.params.id);
    if (!o) return res.status(404).json({ error: "Not found" });
    res.json(withTotal(o));
  } catch (e) { next(e); }
});

router.post("/projects/:projectId/change-orders", async (req, res, next) => {
  try {
    const projectId = Number(req.params.projectId);
    const project = await db.find("projects", projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const { orderNo, orderDate, title, items, clientName, notes } = req.body || {};
    const now = new Date().toISOString();
    const rec = await db.insert("changeOrders", {
      projectId,
      orderNo: orderNo || "",
      orderDate: orderDate || null,
      title: title || "",
      items: items || [],
      status: "pending",
      approvedDate: null,
      clientName: clientName || project.clientName || "",
      notes: notes || "",
      createdAt: now,
      updatedAt: now
    });
    res.status(201).json(withTotal(rec));
  } catch (e) { next(e); }
});

router.put("/change-orders/:id", async (req, res, next) => {
  try {
    const rec = await db.find("changeOrders", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = { updatedAt: new Date().toISOString() };
    ["orderNo", "title", "items", "status", "clientName", "notes"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ("orderDate" in req.body) patch.orderDate = req.body.orderDate || null;
    if (patch.status === "approved" && !rec.approvedDate && !("approvedDate" in patch)) {
      patch.approvedDate = new Date().toISOString().slice(0, 10);
    }
    const updated = await db.update("changeOrders", req.params.id, patch);
    res.json(withTotal(updated));
  } catch (e) { next(e); }
});

router.delete("/change-orders/:id", async (req, res, next) => {
  try {
    const ok = await db.remove("changeOrders", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
