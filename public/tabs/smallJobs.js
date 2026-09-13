"use strict";
window.SmallJobsTab = (function () {
  const A = window.App;

  const TYPE_LABEL = { labor: "Labor", material: "Material", expense: "Expense", payment: "Payment" };

  async function render() {
    const jobs = await A.api("/small-jobs");
    const host = document.getElementById("smallJobsList");
    if (!jobs.length) {
      host.innerHTML = '<div class="empty-state">No small jobs yet — type a one-off job name (instead of picking a project) on a payment, material, expense, or work-log entry to start tracking one here.</div>';
      return;
    }
    host.innerHTML = jobs.map((j) => (
      '<div class="proj-card" data-job="' + A.esc(j.name) + '">' +
        '<h4>' + A.esc(j.name) + '</h4>' +
        '<div class="addr">' + (j.address ? A.esc(j.address) + " · " : "") + 'Last activity: ' + A.esc(A.fmtDate(j.lastActivity)) + '</div>' +
        '<div class="row"><span class="k">Received 收款</span><span class="v">' + A.fmtMoney(j.amountReceived) + '</span></div>' +
        '<div class="row"><span class="k">Labor 人工</span><span class="v">' + A.fmtMoney(j.laborTotal) + '</span></div>' +
        '<div class="row"><span class="k">Materials 材料</span><span class="v">' + A.fmtMoney(j.materialsTotal) + '</span></div>' +
        '<div class="row"><span class="k">Other expenses 其它花费</span><span class="v">' + A.fmtMoney(j.otherExpensesTotal) + '</span></div>' +
        '<div class="row total"><span class="k">Profit 利润</span><span class="v" style="color:' + (j.profit >= 0 ? "var(--good)" : "var(--bad)") + '">' + A.fmtMoney(j.profit) + '</span></div>' +
      '</div>'
    )).join("");
    host.querySelectorAll("[data-job]").forEach((card) => {
      const job = jobs.find((j) => j.name === card.getAttribute("data-job"));
      card.addEventListener("click", () => openJobDetail(job));
    });
  }

  function openJobDetail(job) {
    const rowsHtml = job.entries.map((e) => (
      '<tr><td>' + A.esc(A.fmtDate(e.date)) + '</td>' +
        '<td>' + A.esc(TYPE_LABEL[e.type] || e.type) + '</td>' +
        '<td>' + A.esc(e.description) + '</td>' +
        '<td class="amt num">' + (e.type === "payment" ? "+" : "−") + A.fmtMoney(e.amount) + '</td></tr>'
    )).join("") || '<tr><td colspan="4" style="padding:16px 0;color:var(--muted);">No entries.</td></tr>';
    const html =
      '<form id="sjInfoForm" style="margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid var(--line);">' +
        '<div class="field-grid field-grid-3">' +
          '<div class="field"><label>Client name 客户姓名</label><input type="text" id="sjClient" value="' + A.esc(job.clientName || "") + '"></div>' +
          '<div class="field"><label>Project manager 项目负责人</label><input type="text" id="sjManager" value="' + A.esc(job.managerName || "") + '"></div>' +
          '<div class="field"><label>Phone</label><input type="text" id="sjPhone" value="' + A.esc(job.phone || "") + '"></div>' +
        '</div>' +
        '<div class="field" style="margin-top:10px;"><label>Address</label><input type="text" id="sjAddress" value="' + A.esc(job.address || "") + '"></div>' +
        '<div class="field" style="margin-top:10px;"><label>Notes</label><textarea id="sjNotes" rows="2">' + A.esc(job.notes || "") + '</textarea></div>' +
        '<button class="btn btn-sm" type="submit" style="margin-top:10px;">Save info</button>' +
      '</form>' +
      '<table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody></table>' +
      '<div class="row total" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">' +
        '<span class="k">Profit 利润</span><span class="v" style="color:' + (job.profit >= 0 ? "var(--good)" : "var(--bad)") + '">' + A.fmtMoney(job.profit) + '</span>' +
      '</div>';
    A.showDetailModal(job.name, html);
    document.getElementById("sjInfoForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      await A.api("/small-jobs/" + encodeURIComponent(job.name) + "/info", {
        method: "PUT",
        body: {
          clientName: document.getElementById("sjClient").value,
          managerName: document.getElementById("sjManager").value,
          phone: document.getElementById("sjPhone").value,
          address: document.getElementById("sjAddress").value,
          notes: document.getElementById("sjNotes").value
        }
      });
      A.toast("Info saved");
      render();
    });
  }

  return { render };
})();
