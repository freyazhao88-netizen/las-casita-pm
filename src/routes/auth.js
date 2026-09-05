"use strict";
const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/session", (req, res) => {
  res.json({
    loggedIn: !!(req.session && req.session.loggedIn),
    email: (req.session && req.session.userEmail) || null
  });
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: "Email and password are required" });
    const { data, error } = await db.supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return res.status(401).json({ ok: false, error: "Incorrect email or password" });
    }
    req.session.loggedIn = true;
    req.session.userId = data.user.id;
    req.session.userEmail = data.user.email;
    res.json({ ok: true, email: data.user.email });
  } catch (e) { next(e); }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.post("/change-password", async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!req.session || !req.session.userEmail) return res.status(401).json({ ok: false, error: "Not logged in" });
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ ok: false, error: "New password must be at least 6 characters" });
    }
    const { error: verifyError } = await db.supabase.auth.signInWithPassword({
      email: req.session.userEmail, password: currentPassword
    });
    if (verifyError) return res.status(401).json({ ok: false, error: "Current password is incorrect" });

    const { error: updateError } = await db.supabase.auth.admin.updateUserById(req.session.userId, { password: newPassword });
    if (updateError) return res.status(500).json({ ok: false, error: updateError.message });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
