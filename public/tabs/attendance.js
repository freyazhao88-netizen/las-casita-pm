"use strict";
window.AttendanceTab = (function () {
  const A = window.App;
  let bound = false;

  function bindOnce() {
    if (bound) return;
    bound = true;

    const monthInput = document.getElementById("attMonth");
    monthInput.value = A.currentMonth();
    monthInput.addEventListener("change", render);

    document.getElementById("attDate").value = A.todayISO();

    document.getElementById("attEmployee").addEventListener("change", (e) => {
      const emp = A.state.employees.find((x) => x.id === Number(e.target.value));
      if (emp) document.getElementById("attRate").value = emp.defaultDailyRate;
    });

    document.getElementById("attForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        workDate: document.getElementById("attDate").value,
        employeeId: document.getElementById("attEmployee").value,
        projectId: document.getElementById("attProject").value,
        days: document.getElementById("attDays").value,
        rate: document.getElementById("attRate").value,
        notes: document.getElementById("attNotes").value
      };
      if (!body.employeeId || !body.projectId) { A.toast("Pick an employee and a project"); return; }
      await A.api("/attendance", { method: "POST", body });
      document.getElementById("attNotes").value = "";
      A.toast("Entry added");
      render();
    });
  }

  async function render() {
    bindOnce();
    if (!document.getElementById("attEmployee").value && A.state.employees[0]) {
      document.getElementById("attRate").value = A.state.employees[0].defaultDailyRate;
    }
    const month = document.getElementById("attMonth").value || A.currentMonth();
    const [entries, summary] = await Promise.all([
      A.api("/attendance?month=" + month),
      A.api("/attendance/summary?month=" + month)
    ]);
    renderTable(entries);
    renderSummary(summary);
  }

  function renderTable(entries) {
    const tbody = document.querySelector("#attTable tbody");
    if (!entries.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No attendance logged this month yet.</td></tr>';
      return;
    }
    tbody.innerHTML = entries.map((a) => (
      '<tr>' +
        '<td>' + a.workDate + '</td>' +
        '<td>' + A.esc(A.employeeName(a.employeeId)) + '</td>' +
        '<td>' + A.esc(A.projectName(a.projectId)) + '</td>' +
        '<td class="num">' + a.days + '</td>' +
        '<td class="amt num">' + A.fmtMoney(a.rate) + '</td>' +
        '<td class="amt num">' + A.fmtMoney(a.cost) + '</td>' +
        '<td><button class="payment-pill ' + (a.paymentStatus === "paid" ? "paid" : "unpaid") + '" data-id="' + a.id + '">' + (a.paymentStatus === "paid" ? "Paid" : "Unpaid") + '</button></td>' +
        '<td><button class="row-del" data-id="' + a.id + '" title="Delete">✕</button></td>' +
      '</tr>'
    )).join("");
    tbody.querySelectorAll(".row-del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await A.api("/attendance/" + btn.getAttribute("data-id"), { method: "DELETE" });
        render();
      });
    });
    tbody.querySelectorAll(".payment-pill").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const next = btn.classList.contains("paid") ? "unpaid" : "paid";
        await A.api("/attendance/" + btn.getAttribute("data-id"), { method: "PUT", body: { paymentStatus: next } });
        render();
      });
    });
  }

  function renderSummary(summary) {
    const host = document.getElementById("attSummary");
    if (!summary.employees.length) {
      host.innerHTML = '<div class="empty-state">Nothing to summarize yet.</div>';
      return;
    }
    host.innerHTML = summary.employees.map((e) => (
      '<div class="emp-summary-block">' +
        '<div class="head"><span>' + A.esc(e.employeeName) + ' — ' + e.totalDays + ' day' + (e.totalDays === 1 ? "" : "s") + '</span><span class="wage num">' + A.fmtMoney(e.totalWage) + '</span></div>' +
        (e.unpaidWage > 0.005 ? '<div class="proj-line" style="color:var(--bad)"><span>Unpaid</span><span class="num">' + A.fmtMoney(e.unpaidWage) + '</span></div>' : "") +
        e.byProject.map((bp) => (
          '<div class="proj-line"><span>' + A.esc(bp.projectName) + ' (' + bp.days + ' d)</span><span class="num">' + A.fmtMoney(bp.wage) + '</span></div>'
        )).join("") +
      '</div>'
    )).join("") + (
      '<div class="emp-summary-block" style="background:transparent;border-style:dashed;">' +
        '<div class="head"><span>Total (' + summary.grandTotalDays + ' days)</span><span class="wage num">' + A.fmtMoney(summary.grandTotalWage) + '</span></div>' +
        (summary.grandUnpaidWage > 0.005 ? '<div class="proj-line" style="color:var(--bad)"><span>Total unpaid</span><span class="num">' + A.fmtMoney(summary.grandUnpaidWage) + '</span></div>' : "") +
      '</div>'
    );
  }

  return { render };
})();
