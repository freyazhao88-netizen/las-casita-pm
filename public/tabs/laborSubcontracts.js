"use strict";
window.LaborSubcontractsTab = (function () {
  const A = window.App;
  let bound = false;

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.getElementById("lsForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const projectInput = A.resolveProjectInput(document.getElementById("lsProject").value);
      if (!projectInput.projectId && !projectInput.adhocProjectName) { A.toast("Pick or type a project"); return; }
      const body = Object.assign({
        description: document.getElementById("lsDescription").value,
        amount: document.getElementById("lsAmount").value,
        startDate: document.getElementById("lsStartDate").value,
        endDate: document.getElementById("lsEndDate").value,
        notes: document.getElementById("lsNotes").value
      }, projectInput);
      await A.api("/labor-subcontracts", { method: "POST", body });
      document.getElementById("lsProject").value = "";
      document.getElementById("lsDescription").value = "";
      document.getElementById("lsAmount").value = "";
      document.getElementById("lsStartDate").value = "";
      document.getElementById("lsEndDate").value = "";
      document.getElementById("lsNotes").value = "";
      A.toast("Subcontract added");
      render();
    });
  }

  async function render() {
    bindOnce();
    const list = await A.api("/labor-subcontracts");
    const tbody = document.querySelector("#lsTable tbody");
    if (!list.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No labor subcontracts logged yet.</td></tr>';
    } else {
      tbody.innerHTML = list.map((s) => (
        '<tr>' +
          '<td>' + A.esc(A.projectNameOf(s)) + '</td>' +
          '<td>' + A.esc(s.description) + '</td>' +
          '<td class="amt num">' + A.fmtMoney(s.amount) + '</td>' +
          '<td>' + A.fmtDate(s.startDate) + '</td>' +
          '<td>' + (s.endDate ? A.fmtDate(s.endDate) : "") + '</td>' +
          '<td>' + A.esc(s.notes) + '</td>' +
          '<td><button class="row-del" data-id="' + s.id + '" title="Delete">✕</button></td>' +
        '</tr>'
      )).join("");
      tbody.querySelectorAll(".row-del").forEach((btn) => {
        btn.addEventListener("click", async () => {
          await A.api("/labor-subcontracts/" + btn.getAttribute("data-id"), { method: "DELETE" });
          render();
        });
      });
    }
    const total = list.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    document.getElementById("lsTotalHint").textContent = list.length ? ("Total: " + A.fmtMoney(total)) : "";
  }

  return { render };
})();
