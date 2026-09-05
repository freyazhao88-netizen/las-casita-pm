"use strict";
window.EmployeesTab = (function () {
  const A = window.App;
  let bound = false;

  function mask(value) {
    if (!value) return "—";
    return "•".repeat(Math.max(4, value.length));
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    document.getElementById("empForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        name: document.getElementById("empName").value,
        defaultDailyRate: document.getElementById("empRate").value,
        ssn: document.getElementById("empSsn").value,
        idNumber: document.getElementById("empIdNumber").value,
        notes: document.getElementById("empNotes").value
      };
      await A.api("/employees", { method: "POST", body });
      document.getElementById("empForm").reset();
      A.toast("Employee added");
      A.loadCoreData();
      render();
    });
  }

  async function render() {
    bindOnce();
    const list = await A.api("/employees");
    A.state.employees = list;
    A.populateSelect(document.getElementById("attEmployee"), list, (e) => e.id, (e) => e.name);
    const tbody = document.querySelector("#empTable tbody");
    if (!list.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No employees yet.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((emp) => (
      '<tr data-id="' + emp.id + '">' +
        '<td><input class="emp-name" type="text" value="' + A.esc(emp.name) + '" style="border:1px solid transparent;background:transparent;width:100%;"></td>' +
        '<td class="amt"><input class="emp-rate num" type="number" step="0.01" value="' + emp.defaultDailyRate + '" style="border:1px solid transparent;background:transparent;width:90px;text-align:right;"></td>' +
        '<td>' + maskedCell("ssn", emp.ssn) + '</td>' +
        '<td>' + maskedCell("idNumber", emp.idNumber) + '</td>' +
        '<td><input class="emp-notes" type="text" value="' + A.esc(emp.notes || "") + '" style="border:1px solid transparent;background:transparent;width:100%;"></td>' +
        '<td><input class="emp-active" type="checkbox" ' + (emp.active ? "checked" : "") + '></td>' +
        '<td><button class="row-del" title="Delete">✕</button></td>' +
      '</tr>'
    )).join("");

    tbody.querySelectorAll("tr[data-id]").forEach((row) => {
      const id = row.getAttribute("data-id");
      const save = (patch) => A.api("/employees/" + id, { method: "PUT", body: patch }).then(() => A.loadCoreData());
      row.querySelector(".emp-name").addEventListener("change", (e) => save({ name: e.target.value }));
      row.querySelector(".emp-rate").addEventListener("change", (e) => save({ defaultDailyRate: e.target.value }));
      row.querySelector(".emp-notes").addEventListener("change", (e) => save({ notes: e.target.value }));
      row.querySelector(".emp-active").addEventListener("change", (e) => save({ active: e.target.checked }));
      row.querySelectorAll(".masked-reveal").forEach((btn) => {
        btn.addEventListener("click", () => {
          const wrap = btn.closest(".masked-field");
          const revealed = wrap.classList.toggle("revealed");
          btn.textContent = revealed ? "hide" : "show";
        });
      });
      row.querySelectorAll(".masked-input").forEach((input) => {
        input.addEventListener("change", () => save({ [input.dataset.field]: input.value }));
      });
      row.querySelector(".row-del").addEventListener("click", async () => {
        try {
          await A.api("/employees/" + id, { method: "DELETE" });
          A.toast("Employee deleted");
          A.loadCoreData();
          render();
        } catch (e) { /* toast already shown by api() */ }
      });
    });
  }

  function maskedCell(field, value) {
    return (
      '<div class="masked-field">' +
        '<span class="masked-display">' + A.esc(mask(value)) + '</span>' +
        '<input class="masked-input" data-field="' + field + '" type="text" value="' + A.esc(value || "") + '">' +
        '<button type="button" class="masked-reveal">show</button>' +
      '</div>'
    );
  }

  return { render };
})();
