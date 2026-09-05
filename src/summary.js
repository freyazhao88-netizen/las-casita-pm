"use strict";
const db = require("./db");

function entryCost(a) {
  return (Number(a.days) || 0) * (Number(a.rate) || 0);
}

function computeItemAmount(item) {
  if (item.mode === "na") return 0;
  if (item.mode === "qty") return (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
  return parseFloat(item.flatAmount) || 0;
}
function computeItemsTotal(items) {
  return (items || []).reduce((sum, it) => sum + computeItemAmount(it), 0);
}

function stageProgressOf(stages) {
  const total = stages.length;
  const passed = stages.filter((s) => s.status === "passed").length;
  return { total, passed, percent: total ? Math.round((passed / total) * 100) : 0 };
}

function summaryOf(project, attendanceForProject, materialsForProject, stagesForProject, changeOrdersForProject, paymentsForProject) {
  const laborTotal = attendanceForProject.reduce((sum, a) => sum + entryCost(a), 0);
  const materialsTotal = materialsForProject.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  const approvedChangeOrdersTotal = changeOrdersForProject
    .filter((c) => c.status === "approved")
    .reduce((sum, c) => sum + computeItemsTotal(c.items), 0);
  const baseQuoted = Number(project.quotedTotal) || 0;
  const effectiveQuotedTotal = baseQuoted + approvedChangeOrdersTotal;
  const costTotal = laborTotal + materialsTotal;
  const amountReceived = paymentsForProject.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return {
    projectId: project.id,
    laborTotal,
    materialsTotal,
    grandTotal: costTotal,
    quotedTotal: baseQuoted,
    approvedChangeOrdersTotal,
    effectiveQuotedTotal,
    variance: effectiveQuotedTotal - costTotal,
    profitMargin: effectiveQuotedTotal - costTotal,
    amountReceived,
    outstandingBalance: effectiveQuotedTotal - amountReceived,
    stageProgress: stageProgressOf(stagesForProject)
  };
}

// One project's summary — a handful of filtered queries, fine for a single lookup.
async function computeProjectSummary(project) {
  const [attendance, materials, stages, changeOrders, payments] = await Promise.all([
    db.all("attendance"),
    db.all("materials"),
    db.all("stages"),
    db.all("changeOrders"),
    db.all("payments")
  ]);
  return summaryOf(
    project,
    attendance.filter((a) => a.projectId === project.id),
    materials.filter((m) => m.projectId === project.id),
    stages.filter((s) => s.projectId === project.id),
    changeOrders.filter((c) => c.projectId === project.id),
    payments.filter((p) => p.projectId === project.id)
  );
}

// All projects at once — fetches each table once, then groups in memory
// (avoids N+1 round trips to Supabase when listing the whole portfolio).
async function computeAllSummaries(projects) {
  const [attendance, materials, stages, changeOrders, payments] = await Promise.all([
    db.all("attendance"),
    db.all("materials"),
    db.all("stages"),
    db.all("changeOrders"),
    db.all("payments")
  ]);
  const byId = {};
  projects.forEach((p) => {
    byId[p.id] = summaryOf(
      p,
      attendance.filter((a) => a.projectId === p.id),
      materials.filter((m) => m.projectId === p.id),
      stages.filter((s) => s.projectId === p.id),
      changeOrders.filter((c) => c.projectId === p.id),
      payments.filter((pay) => pay.projectId === p.id)
    );
  });
  return byId;
}

module.exports = { entryCost, computeItemAmount, computeItemsTotal, computeProjectSummary, computeAllSummaries };
