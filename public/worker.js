"use strict";
(function () {
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  function fmtMoney(n) { return money.format(isFinite(n) ? n : 0); }
  function fmtDate(iso) {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    return parts[1] + "/" + parts[2] + "/" + parts[0];
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  async function boot() {
    const token = new URLSearchParams(location.search).get("t");
    if (!token) { showError(); return; }
    let data;
    try {
      const res = await fetch("/api/worker/" + encodeURIComponent(token));
      if (!res.ok) { showError(); return; }
      data = await res.json();
    } catch (e) { showError(); return; }
    render(data);
  }

  function showError() {
    document.getElementById("wkError").hidden = false;
    document.getElementById("app").hidden = true;
  }

  function render(data) {
    document.getElementById("app").hidden = false;
    document.getElementById("wkName").textContent = data.name;
    document.getElementById("wkBalance").textContent = fmtMoney(data.balance);
    document.getElementById("wkBalance").style.color = data.balance > 0.005 ? "var(--bad)" : "var(--good)";
    document.getElementById("wkOwed").textContent = fmtMoney(data.totalOwed);
    document.getElementById("wkPaid").textContent = fmtMoney(data.totalPaid);

    const attHost = document.getElementById("wkAttendance");
    attHost.innerHTML = data.attendance.length
      ? data.attendance.map((a) => (
          '<div class="wk-row"><span>' + esc(a.projectName) + '<span class="meta">' + esc(fmtDate(a.workDate)) + ' · ' + a.days + ' d</span></span>' +
          '<span class="amt">' + fmtMoney(a.cost) + '</span></div>'
        )).join("")
      : '<div class="wk-empty">暂无记录 No attendance yet.</div>';

    const payHost = document.getElementById("wkPayments");
    payHost.innerHTML = data.payments.length
      ? data.payments.map((p) => (
          '<div class="wk-row"><span>' + (p.method ? esc(p.method) : "Payment") + (p.notes ? ' <span class="meta">' + esc(p.notes) + '</span>' : '') + '<span class="meta">' + esc(fmtDate(p.paymentDate)) + '</span></span>' +
          '<span class="amt">' + fmtMoney(p.amount) + '</span></div>'
        )).join("")
      : '<div class="wk-empty">暂无付款记录 No payments yet.</div>';
  }

  boot();
})();
