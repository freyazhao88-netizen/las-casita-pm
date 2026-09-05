"use strict";
const express = require("express");
const db = require("../db");

const router = express.Router();

function computeAmount(mode, qty, unitPrice, amount) {
  if (mode === "qty") return (Number(qty) || 0) * (Number(unitPrice) || 0);
  return Number(amount) || 0;
}

router.get("/materials", async (req, res, next) => {
  try {
    const { projectId, month, projectStatus } = req.query;
    let list = await db.all("materials");
    if (projectId) list = list.filter((m) => m.projectId === Number(projectId));
    if (month) list = list.filter((m) => m.purchaseDate && m.purchaseDate.slice(0, 7) === month);
    if (projectStatus) {
      const projects = await db.all("projects");
      const idsWithStatus = new Set(projects.filter((p) => p.status === projectStatus).map((p) => p.id));
      list = list.filter((m) => idsWithStatus.has(m.projectId));
    }
    list.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
    res.json(list);
  } catch (e) { next(e); }
});

router.post("/materials", async (req, res, next) => {
  try {
    const { projectId, purchaseDate, vendor, description, category, mode, qty, unitPrice, amount, paymentStatus, paymentMethod, invoiceNumber } = req.body || {};
    if (!projectId || !purchaseDate) {
      return res.status(400).json({ error: "projectId and purchaseDate are required" });
    }
    if (!(await db.find("projects", projectId))) return res.status(400).json({ error: "Unknown project" });
    const useMode = mode === "qty" ? "qty" : "flat";
    const rec = await db.insert("materials", {
      projectId: Number(projectId),
      purchaseDate,
      vendor: vendor || "",
      description: description || "",
      category: category || "",
      mode: useMode,
      qty: useMode === "qty" ? Number(qty) || 0 : null,
      unitPrice: useMode === "qty" ? Number(unitPrice) || 0 : null,
      amount: computeAmount(useMode, qty, unitPrice, amount),
      paymentStatus: paymentStatus === "paid" ? "paid" : "unpaid",
      paymentMethod: paymentMethod || "",
      invoiceNumber: invoiceNumber || ""
    });
    res.status(201).json(rec);
  } catch (e) { next(e); }
});

router.put("/materials/:id", async (req, res, next) => {
  try {
    const rec = await db.find("materials", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = {};
    ["purchaseDate", "vendor", "description", "category", "paymentStatus", "paymentMethod", "invoiceNumber"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ("projectId" in req.body) patch.projectId = Number(req.body.projectId);
    if ("mode" in req.body) patch.mode = req.body.mode === "qty" ? "qty" : "flat";
    if ("qty" in req.body) patch.qty = req.body.qty === "" ? null : Number(req.body.qty);
    if ("unitPrice" in req.body) patch.unitPrice = req.body.unitPrice === "" ? null : Number(req.body.unitPrice);
    const mode = patch.mode || rec.mode;
    if (mode === "qty" && ("qty" in patch || "unitPrice" in patch || "mode" in patch)) {
      patch.amount = computeAmount("qty", "qty" in patch ? patch.qty : rec.qty, "unitPrice" in patch ? patch.unitPrice : rec.unitPrice);
    } else if ("amount" in req.body) {
      patch.amount = Number(req.body.amount) || 0;
    }
    res.json(await db.update("materials", req.params.id, patch));
  } catch (e) { next(e); }
});

router.delete("/materials/:id", async (req, res, next) => {
  try {
    const ok = await db.remove("materials", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
