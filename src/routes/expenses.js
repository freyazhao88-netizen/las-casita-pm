"use strict";
const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/expenses", async (req, res, next) => {
  try {
    const { projectId, month } = req.query;
    let list = await db.all("expenses");
    if (projectId) list = list.filter((e) => e.projectId === Number(projectId));
    if (month) list = list.filter((e) => e.expenseDate && e.expenseDate.slice(0, 7) === month);
    list.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
    res.json(list);
  } catch (e) { next(e); }
});

router.post("/expenses", async (req, res, next) => {
  try {
    const { projectId, expenseDate, category, description, amount, status, paymentMethod, notes } = req.body || {};
    if (!projectId || !expenseDate || amount === undefined || amount === "") {
      return res.status(400).json({ error: "projectId, expenseDate, and amount are required" });
    }
    if (!(await db.find("projects", projectId))) return res.status(400).json({ error: "Unknown project" });
    const finalStatus = status === "reimbursed" ? "reimbursed" : "unreimbursed";
    const rec = await db.insert("expenses", {
      projectId: Number(projectId),
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
    ["expenseDate", "category", "description", "status", "paymentMethod", "notes"].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ("amount" in req.body) patch.amount = Number(req.body.amount) || 0;
    if ("projectId" in req.body) patch.projectId = Number(req.body.projectId);
    res.json(await db.update("expenses", req.params.id, patch));
  } catch (e) { next(e); }
});

router.delete("/expenses/:id", async (req, res, next) => {
  try {
    const ok = await db.remove("expenses", req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get("/expense-category-library", (req, res) => {
  res.json(db.EXPENSE_CATEGORY_LIBRARY);
});

module.exports = router;
