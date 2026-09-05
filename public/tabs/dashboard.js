"use strict";
window.DashboardTab = (function () {
  const A = window.App;

  async function render() {
    const curMonth = A.currentMonth();
    const [projects, curAtt, curMat, allStages] = await Promise.all([
      A.api("/projects?summary=1"),
      A.api("/attendance/summary?month=" + curMonth),
      A.api("/materials?month=" + curMonth),
      A.api("/stages")
    ]);
    A.state.projects = projects;
    A.populateProjectSelects();

    const grandLabor = projects.reduce((s, p) => s + p.summary.laborTotal, 0);
    const grandMaterials = projects.reduce((s, p) => s + p.summary.materialsTotal, 0);
    const grandQuoted = projects.reduce((s, p) => s + p.summary.quotedTotal, 0);
    const grandTotal = grandLabor + grandMaterials;
    const curMaterialTotal = curMat.reduce((s, m) => s + m.amount, 0);

    const nonCompletedIds = new Set(projects.filter((p) => p.status !== "completed").map((p) => p.id));
    const scheduledCount = allStages.filter((s) => nonCompletedIds.has(s.projectId) && s.status === "scheduled").length;
    const failedCount = allStages.filter((s) => nonCompletedIds.has(s.projectId) && s.status === "failed").length;

    let stagesNote, stagesTone;
    if (failedCount > 0) { stagesNote = failedCount + " failed inspection" + (failedCount === 1 ? "" : "s"); stagesTone = "warn"; }
    else if (scheduledCount > 0) { stagesNote = "awaiting inspection"; stagesTone = ""; }
    else { stagesNote = "all caught up"; stagesTone = "good"; }

    document.getElementById("dashStats").innerHTML = [
      tile("Active projects", projects.filter((p) => p.status === "active").length, "", "▣", projects.length + " total"),
      tile("Total labor cost", A.fmtMoney(grandLabor), "", "◷", "this month: " + A.fmtMoney(curAtt.grandTotalWage)),
      tile("Total material cost", A.fmtMoney(grandMaterials), "", "▤", "this month: " + A.fmtMoney(curMaterialTotal)),
      tile("Total spend", A.fmtMoney(grandTotal), "warm", "Σ", "vs. " + A.fmtMoney(grandQuoted) + " quoted"),
      tile("Inspections scheduled", String(scheduledCount), failedCount > 0 ? "warm" : "", "✓", stagesNote, stagesTone)
    ].join("");

    const cardsHost = document.getElementById("dashProjectCards");
    if (!projects.length) {
      cardsHost.innerHTML = '<div class="empty-state">No projects yet. Create one in the Projects tab.</div>';
    } else {
      cardsHost.innerHTML = projects.map((p) => cardHtml(p)).join("");
      cardsHost.querySelectorAll("[data-open-project]").forEach((card) => {
        card.addEventListener("click", () => {
          window.ProjectsTab.selectAndOpen(Number(card.getAttribute("data-open-project")));
          A.switchTab("projects");
        });
      });
    }

    renderUpcomingInspections(allStages);
  }

  function renderUpcomingInspections(allStages) {
    const host = document.getElementById("dashRecentStages");
    const failed = allStages.filter((s) => s.status === "failed");
    const scheduled = allStages.filter((s) => s.status === "scheduled")
      .sort((a, b) => (a.inspectionDate || "9999").localeCompare(b.inspectionDate || "9999"));
    const upcoming = failed.concat(scheduled).slice(0, 8);

    if (!upcoming.length) {
      host.innerHTML = '<div class="empty-state">Nothing scheduled — all inspections are passed or none logged yet.</div>';
      return;
    }
    const dotGlyph = { passed: "✓", scheduled: "!", failed: "✕" };
    host.innerHTML = upcoming.map((s) => (
      '<div class="inspect-row">' +
        '<div class="inspect-dot ' + s.status + '">' + dotGlyph[s.status] + '</div>' +
        '<div class="inspect-text"><strong>' + A.esc(s.name) + ' — ' + A.esc(s.projectName) + '</strong>' +
        '<small>' + (s.inspectionDate ? A.esc(A.fmtDate(s.inspectionDate)) : "No date set") + (s.department ? " · " + A.esc(s.department) : "") + '</small></div>' +
        '<span class="badge ' + s.status + '">' + s.status + '</span>' +
      '</div>'
    )).join("");
  }

  function tile(label, value, tone, icon, note, noteTone) {
    return (
      '<div class="stat-tile">' +
        '<div class="stat-tile-head"><span class="label">' + A.esc(label) + '</span><span class="icon">' + icon + '</span></div>' +
        '<div class="value ' + (tone || "") + '">' + value + '</div>' +
        (note ? '<div class="note ' + (noteTone || "") + '">' + A.esc(note) + '</div>' : "") +
      '</div>'
    );
  }

  function cardHtml(p) {
    const s = p.summary;
    const pct = s.stageProgress.percent;
    const varianceTone = s.variance < 0 ? "color:var(--bad)" : "color:var(--good)";
    return (
      '<div class="proj-card" data-open-project="' + p.id + '">' +
        '<h4>' + A.esc(p.name) + ' <span class="status-pill ' + p.status + '">' + A.esc(p.status.replace("_", " ")) + '</span></h4>' +
        '<div class="addr">' + A.esc(p.address || "No address") + '</div>' +
        '<div class="row"><span class="k">Labor cost</span><span class="v num">' + A.fmtMoney(s.laborTotal) + '</span></div>' +
        '<div class="row"><span class="k">Material cost</span><span class="v num">' + A.fmtMoney(s.materialsTotal) + '</span></div>' +
        '<div class="row"><span class="k">Quoted total</span><span class="v num">' + A.fmtMoney(s.quotedTotal) + '</span></div>' +
        '<div class="row total"><span class="k">Total spend</span><span class="v num">' + A.fmtMoney(s.grandTotal) + '</span></div>' +
        '<div class="row"><span class="k">Vs. quote</span><span class="v num" style="' + varianceTone + '">' + (s.variance >= 0 ? "+" : "") + A.fmtMoney(s.variance) + '</span></div>' +
        '<div class="progress-bar"><div class="fill" style="width:' + pct + '%"></div></div>' +
        '<div class="row"><span class="k">Stage progress</span><span class="v">' + s.stageProgress.passed + ' / ' + s.stageProgress.total + ' (' + pct + '%)</span></div>' +
      '</div>'
    );
  }

  return { render };
})();
