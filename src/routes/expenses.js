"use strict";
const express = require("express");
const db = require("../db");
const receipts = require("../receipts");

const router = express.Router();

router.get("/expenses", async (req, res, next) => {
  try {
    const { projectId, month, status } = req.query;
    let list = await db.all("expenses");
    if (projectId) list = list.filter((e) => e.projectId === Number(projectId));
    if (month) list = list.filter((e) => e.expenseDate && e.expenseDate.slice(0, 7) === month);
    if (status) list = list.filter((e) => e.status === status);
    list.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
    res.json(list);
  } catch (e) { next(e); }
});

router.post("/expenses", async (req, res, next) => {
  try {
    const { projectId, adhocProjectName, expenseDate, category, description, amount, status, paymentMethod, notes } = req.body || {};
    if (!expenseDate || amount === undefined || amount === "") {
      return res.status(400).json({ error: "expenseDate and amount are required" });
    }
    const cleanAdhoc = (adhocProjectName || "").trim();
    if (!projectId && !cleanAdhoc) return res.status(400).json({ error: "Pick a project or type a one-off job name" });
    if (projectId && !(await db.find("projects", projectId))) return res.status(400).json({ error: "Unknown project" });
    const finalStatus = status === "reimbursed" ? "reimbursed" : "unreimbursed";
    const rec = await db.insert("expenses", {
      projectId: projectId ? Number(projectId) : null,
      adhocProjectName: projectId ? "" : cleanAdhoc,
      expenseDate,
      category: category || "",
      description: description || "",
      amount: Number(amount) || 0,
      status: finalStatus,
      paymentMethod: finalStatus === "reimbursed" ? (paymentMethod || "") : "",
      notes: notes || ""
    });
    res.status(201).json(rec);
  } catch (e) { next(e); }
});

router.put("/expenses/:id", async (req, res, next) => {
  try {
    const rec = await db.find("expenses", req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });
    const patch = {};
    ["expenseDate", "category", "description", "status", "paymentMethod", "notes", "adhocProjectName"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ("amount" in req.body) patch.amount = Number(req.body.amount) || 0;
    if ("projectId" in req.body) patch.projectId = req.body.projectId ? Number(req.body.projectId) : null;
    res.json(await db.update("expenses", req.params.id, patch));
  } catch (e) { next(e); }
});

router.delete("/expenses/:id", async (req, res, next) => {
  try {
    const rec = await db.find("expenses", req.params.id);
    const ok = await db.remove("expenses", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    if (rec && rec.receiptPath) await receipts.removeReceipt(rec.receiptPath);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get("/expense-category-library", (req, res) => {
  res.json(db.EXPENSE_CATEGORY_LIBRARY);
});

router.post("/expenses/:id/receipt", (req, res, next) => {
  receipts.upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const rec = await db.find("expenses", req.params.id);
      if (!rec) return res.status(404).json({ error: "Not found" });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const storagePath = await receipts.uploadReceipt("expenses", req.params.id, req.file, rec.receiptPath);
      try {
        res.json(await db.update("expenses", req.params.id, { receiptPath: storagePath }));
      } catch (dbErr) {
        await receipts.removeReceipt(storagePath);
        throw dbErr;
      }
    } catch (e) { next(e); }
  });
});

router.get("/expenses/:id/receipt", async (req, res, next) => {
  try {
    const rec = await db.find("expenses", req.params.id);
    if (!rec || !rec.receiptPath) return res.status(404).json({ error: "No receipt on file" });
    res.json({ url: await receipts.signedUrlFor(rec.receiptPath) });
  } catch (e) { next(e); }
});

router.delete("/expenses/:id/receipt", async (req, res, next) => {
  try {
    const rec = await db.find("expenses", req.params.id);
    if (!rec || !rec.receiptPath) return res.status(404).json({ error: "No receipt on file" });
    await receipts.removeReceipt(rec.receiptPath);
    res.json(await db.update("expenses", req.params.id, { receiptPath: null }));
  } catch (e) { next(e); }
});

module.exports = router;
