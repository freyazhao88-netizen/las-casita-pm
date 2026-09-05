"use strict";
const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/settings", async (req, res, next) => {
  try {
    const { passwordHash, passwordSalt, id, ...pub } = await db.getSettings();
    res.json(pub);
  } catch (e) { next(e); }
});

router.put("/settings", async (req, res, next) => {
  try {
    const allowed = ["companyName", "companyAddr1", "companyAddr2", "companyEmail", "contact1", "contact2"];
    const patch = {};
    allowed.forEach((key) => { if (key in req.body) patch[key] = req.body[key]; });
    const updated = await db.updateSettings(patch);
    const { passwordHash, passwordSalt, id, ...pub } = updated;
    res.json(pub);
  } catch (e) { next(e); }
});

router.get("/category-library", (req, res) => {
  res.json(db.CATEGORY_LIBRARY);
});

router.get("/stage-suggestions", (req, res) => {
  res.json(db.DEFAULT_STAGE_SUGGESTIONS);
});

module.exports = router;
