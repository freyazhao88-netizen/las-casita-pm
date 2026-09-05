"use strict";
const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/session", (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.loggedIn) });
});

router.post("/login", async (req, res, next) => {
  try {
    const { password } = req.body || {};
    const s = await db.getSettings();
    if (password && db.verifyPassword(password, s.passwordSalt, s.passwordHash)) {
      req.session.loggedIn = true;
      return res.json({ ok: true });
    }
    res.status(401).json({ ok: false, error: "Incorrect password" });
  } catch (e) { next(e); }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.post("/change-password", async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const s = await db.getSettings();
    if (!newPassword || String(newPassword).length < 4) {
      return res.status(400).json({ ok: false, error: "New password must be at least 4 characters" });
    }
    if (!db.verifyPassword(currentPassword, s.passwordSalt, s.passwordHash)) {
      return res.status(401).json({ ok: false, error: "Current password is incorrect" });
    }
    const { salt, hash } = db.hashPassword(newPassword);
    await db.updateSettings({ passwordSalt: salt, passwordHash: hash });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
