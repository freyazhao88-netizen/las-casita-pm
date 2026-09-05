"use strict";
const db = require("./db");

function entryCost(a) {
  return (Number(a.days) || 0) * (Number(a.rate) || 0);
}

function stageProgressOf(stages) {
  const total = stages.length;
  const passed = stages.filter((s) => s.status === "passed").length;
  return { total, passed, percent: total ? Math.round((passed / total) * 100) : 0 };
}

function summaryOf(project, attendanceForProject, materialsForProject, stagesForProject) {
  const laborTotal = attendanceForProject.reduce((sum, a) => sum + entryCost(a), 0);
  const materialsTotal = materialsForProject.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  return {
    projectId: project.id,
    laborTotal,
    materialsTotal,
    grandTotal: laborTotal + materialsTotal,
    quotedTotal: Number(project.quotedTotal) || 0,
    variance: (Number(project.quotedTotal) || 0) - (laborTotal + materialsTotal),
    stageProgress: stageProgressOf(stagesForProject)
  };
}

// One project's summary — a handful of filtered queries, fine for a single lookup.
async function computeProjectSummary(project) {
  const [attendance, materials, stages] = await Promise.all([
    db.all("attendance"),
    db.all("materials"),
    db.all("stages")
  ]);
  return summaryOf(
    project,
    attendance.filter((a) => a.projectId === project.id),
    materials.filter((m) => m.projectId === project.id),
    stages.filter((s) => s.projectId === project.id)
  );
}

// All projects at once — fetches each table once, then groups in memory
// (avoids N+1 round trips to Supabase when listing the whole portfolio).
async function computeAllSummaries(projects) {
  const [attendance, materials, stages] = await Promise.all([
    db.all("attendance"),
    db.all("materials"),
    db.all("stages")
  ]);
  const byId = {};
  projects.forEach((p) => {
    byId[p.id] = summaryOf(
      p,
      attendance.filter((a) => a.projectId === p.id),
      materials.filter((m) => m.projectId === p.id),
      stages.filter((s) => s.projectId === p.id)
    );
  });
  return byId;
}

module.exports = { entryCost, computeProjectSummary, computeAllSummaries };
