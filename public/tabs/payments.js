"use strict";
window.PaymentsTab = (function () {
  const A = window.App;
  let bound = false;

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.getElementById("payDate").value = A.todayISO();
    document.getElementById("payProjectFilter").addEventListener("change", render);

    document.getElementById("payForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        paymentDate: document.getElementById("payDate").value,
        projectId: document.getElementById("payProject").value,
        amount: document.getElementById("payAmount").value,
        method: document.getElementById("payMethod").value,
        reference: document.getElementById("payReference").value,
        notes: document.getElementById("payNotes").value
      };
      if (!body.projectId) { A.toast("Pick a project"); return; }
      await A.api("/payments", { method: "POST", body });
      document.getElementById("payAmount").value = "";
      document.getElementById("payMethod").value = "";
      document.getElementById("payReference").value = "";
      document.getElementById("payNotes").value = "";
      A.toast("Payment logged");
      render();
    });
  }

  async function render() {
    bindOnce();
    const projectId = document.getElementById("payProjectFilter").value;
    const list = await A.api("/payments" + (projectId ? "?projectId=" + projectId : ""));
    const tbody = document.querySelector("#payTable tbody");
    if (!list.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No payments logged yet.</td></tr>';
    } else {
      tbody.innerHTML = list.map((p) => (
        '<tr>' +
          '<td>' + p.paymentDate + '</td>' +
          '<td>' + A.esc(A.projectName(p.projectId)) + '</td>' +
          '<td class="amt num">' + A.fmtMoney(p.amount) + '</td>' +
          '<td>' + A.esc(p.method) + '</td>' +
          '<td>' + A.esc(p.reference) + '</td>' +
          '<td>' + A.esc(p.notes) + '</td>' +
          '<td><button class="row-del" data-id="' + p.id + '" title="Delete">✕</button></td>' +
        '</tr>'
      )).join("");
      tbody.querySelectorAll(".row-del").forEach((btn) => {
        btn.addEventListener("click", async () => {
          await A.api("/payments/" + btn.getAttribute("data-id"), { method: "DELETE" });
          render();
        });
      });
    }
    const total = list.reduce((s, p) => s + p.amount, 0);
    document.getElementById("payTotalHint").textContent = list.length ? ("Total received: " + A.fmtMoney(total)) : "";
  }

  return { render };
})();
