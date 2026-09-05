"use strict";
window.ChangeOrdersTab = (function () {
  const A = window.App;
  let uidCounter = 1;
  function uid() { return "id" + (uidCounter++) + "_" + Math.random().toString(36).slice(2, 7); }

  let categoryLibrary = [];
  let companySettings = null;
  let order = null; // current editor state
  let bound = false;

  function blankOrder() {
    return {
      id: null,
      projectId: "",
      orderNo: "",
      orderDate: A.todayISO(),
      title: "",
      clientName: "",
      status: "pending",
      notes: "",
      items: []
    };
  }

  function computeItemAmount(item) {
    if (item.mode === "na") return 0;
    if (item.mode === "qty") return (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
    return parseFloat(item.flatAmount) || 0;
  }
  function orderTotal() { return order.items.reduce((s, it) => s + computeItemAmount(it), 0); }

  async function ensureLibrary() {
    if (!categoryLibrary.length) categoryLibrary = await A.api("/category-library");
    if (!companySettings) companySettings = await A.api("/settings");
  }

  async function render() {
    await ensureLibrary();
    document.getElementById("coListView").hidden = false;
    document.getElementById("coEditorView").hidden = true;
    bindListButtons();

    const projectId = document.getElementById("coProjectFilter").value;
    const status = document.getElementById("coStatusFilter").value;
    const params = [];
    if (projectId) params.push("projectId=" + projectId);
    if (status) params.push("status=" + status);
    const list = await A.api("/change-orders" + (params.length ? "?" + params.join("&") : ""));

    const tbody = document.querySelector("#coTable tbody");
    if (!list.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No change orders yet — click "New change order" to build one.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((o) => (
      '<tr>' +
        '<td>' + A.esc(o.orderDate || "") + '</td>' +
        '<td>' + A.esc(o.orderNo || "") + '</td>' +
        '<td>' + A.esc(o.projectName || "") + '</td>' +
        '<td>' + A.esc(o.title || "") + '</td>' +
        '<td class="amt num">' + A.fmtMoney(o.total) + '</td>' +
        '<td><span class="badge ' + (o.status === "approved" ? "passed" : o.status === "rejected" ? "failed" : "pending") + '">' + o.status + '</span></td>' +
        '<td style="white-space:nowrap;">' +
          '<button class="btn btn-sm" data-open="' + o.id + '">Open</button> ' +
          '<button class="row-del" data-del="' + o.id + '" title="Delete">✕</button>' +
        '</td>' +
      '</tr>'
    )).join("");
    tbody.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openEditor(Number(b.getAttribute("data-open")))));
    tbody.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Delete this change order?")) return;
      await A.api("/change-orders/" + b.getAttribute("data-del"), { method: "DELETE" });
      render();
    }));
  }

  function bindListButtons() {
    document.getElementById("coProjectFilter").onchange = render;
    document.getElementById("coStatusFilter").onchange = render;
    if (bound) return;
    bound = true;
    document.getElementById("btnNewChangeOrder").addEventListener("click", () => { order = blankOrder(); openEditorView(); });
    document.getElementById("btnBackToChangeOrders").addEventListener("click", () => { render(); });
    document.getElementById("btnPrintChangeOrder").addEventListener("click", () => window.print());
    document.getElementById("btnSaveChangeOrder").addEventListener("click", saveOrder);
  }

  async function openEditor(id) {
    const full = await A.api("/change-orders/" + id);
    order = {
      id: full.id, projectId: full.projectId, orderNo: full.orderNo || "",
      orderDate: full.orderDate || A.todayISO(), title: full.title || "",
      clientName: full.clientName || "", status: full.status || "pending",
      notes: full.notes || "", items: full.items || []
    };
    openEditorView();
  }

  function openEditorView() {
    document.getElementById("coListView").hidden = true;
    document.getElementById("coEditorView").hidden = false;
    renderEditor();
  }

  async function saveOrder() {
    if (!order.projectId) { A.toast("Pick a project first"); return; }
    const body = {
      orderNo: order.orderNo, orderDate: order.orderDate, title: order.title,
      clientName: order.clientName, status: order.status, notes: order.notes, items: order.items
    };
    if (order.id) {
      await A.api("/change-orders/" + order.id, { method: "PUT", body });
    } else {
      const rec = await A.api("/projects/" + order.projectId + "/change-orders", { method: "POST", body });
      order.id = rec.id;
    }
    A.toast("Change order saved");
  }

  /* ---------------- Editor pane ---------------- */
  function renderEditor() {
    const pane = document.getElementById("coEditorPane");
    pane.innerHTML =
      '<div class="card">' +
        '<div class="card-head"><h3>Change order info</h3></div>' +
        '<div class="field-grid">' +
          '<div class="field span-2"><label>Project</label><select id="coProject" required></select></div>' +
          '<div class="field"><label>Date</label><input type="date" id="coDate"></div>' +
          '<div class="field"><label>CO #</label><input type="text" id="coNo"></div>' +
          '<div class="field span-2"><label>Title / description of change</label><input type="text" id="coTitle" placeholder="e.g. Add a window in the primary bedroom"></div>' +
          '<div class="field"><label>Client name</label><input type="text" id="coClient"></div>' +
          '<div class="field"><label>Status</label><select id="coStatus">' +
            '<option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>' +
          '</select></div>' +
          '<div class="field span-2"><label>Notes</label><input type="text" id="coNotes" placeholder="optional"></div>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head"><h3>Line items</h3><span class="hint" id="coItemCount"></span></div>' +
        '<div class="chip-lib" id="coChipLib"></div>' +
        '<div id="coItemRows"></div>' +
        '<div class="empty-state" id="coItemsEmpty">No line items yet — click a category above to add one.</div>' +
      '</div>';

    const projSelect = document.getElementById("coProject");
    A.populateSelect(projSelect, A.state.projects, (p) => p.id, (p) => p.name, "— Select a project —");
    projSelect.value = order.projectId || "";
    projSelect.addEventListener("change", () => {
      order.projectId = projSelect.value ? Number(projSelect.value) : "";
      const proj = A.state.projects.find((p) => p.id === Number(projSelect.value));
      if (proj && !order.clientName) document.getElementById("coClient").value = order.clientName = proj.clientName || "";
      renderPreview();
    });

    const fields = { coDate: "orderDate", coNo: "orderNo", coTitle: "title", coClient: "clientName", coNotes: "notes" };
    Object.keys(fields).forEach((elId) => {
      const key = fields[elId];
      const el = document.getElementById(elId);
      el.value = order[key] || "";
      el.addEventListener("input", () => { order[key] = el.value; renderPreview(); });
    });
    const statusSelect = document.getElementById("coStatus");
    statusSelect.value = order.status;
    statusSelect.addEventListener("change", () => { order.status = statusSelect.value; renderPreview(); });

    const chipLib = document.getElementById("coChipLib");
    categoryLibrary.forEach((name) => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "chip"; btn.textContent = "+ " + name;
      btn.addEventListener("click", () => addItem(name));
      chipLib.appendChild(btn);
    });
    const customChip = document.createElement("button");
    customChip.type = "button"; customChip.className = "chip chip-custom"; customChip.textContent = "+ Custom item";
    customChip.addEventListener("click", () => addItem(""));
    chipLib.appendChild(customChip);

    renderItems();
    renderPreview();
  }

  function addItem(category) {
    const item = { id: uid(), category, description: "", mode: "flat", flatAmount: "", qty: "", unit: "sq ft", rate: "" };
    order.items.push(item);
    renderItems(); renderPreview();
    const row = document.querySelector('[data-item-id="' + item.id + '"] .cat-input');
    if (row) row.focus();
  }
  function removeItem(id) { order.items = order.items.filter((it) => it.id !== id); renderItems(); renderPreview(); }
  function moveItem(id, dir) {
    const idx = order.items.findIndex((it) => it.id === id);
    const newIdx = idx + dir;
    if (idx < 0 || newIdx < 0 || newIdx >= order.items.length) return;
    const tmp = order.items[idx]; order.items[idx] = order.items[newIdx]; order.items[newIdx] = tmp;
    renderItems(); renderPreview();
  }

  function buildItemRow(item) {
    const wrap = document.createElement("div");
    wrap.className = "item-row";
    wrap.setAttribute("data-item-id", item.id);

    const top = document.createElement("div"); top.className = "row-top";
    const catInput = document.createElement("input");
    catInput.type = "text"; catInput.className = "cat-input"; catInput.placeholder = "Category name"; catInput.value = item.category;
    catInput.addEventListener("input", () => { item.category = catInput.value; renderPreview(); });
    top.appendChild(catInput);

    const actions = document.createElement("div"); actions.className = "row-actions";
    const upBtn = document.createElement("button"); upBtn.type = "button"; upBtn.textContent = "↑"; upBtn.title = "Move up";
    upBtn.addEventListener("click", () => moveItem(item.id, -1));
    const downBtn = document.createElement("button"); downBtn.type = "button"; downBtn.textContent = "↓"; downBtn.title = "Move down";
    downBtn.addEventListener("click", () => moveItem(item.id, 1));
    const delBtn = document.createElement("button"); delBtn.type = "button"; delBtn.textContent = "✕"; delBtn.title = "Remove item"; delBtn.className = "danger";
    delBtn.addEventListener("click", () => removeItem(item.id));
    actions.appendChild(upBtn); actions.appendChild(downBtn); actions.appendChild(delBtn);
    top.appendChild(actions);
    wrap.appendChild(top);

    const descInput = document.createElement("input");
    descInput.type = "text"; descInput.className = "desc-input"; descInput.placeholder = "Description"; descInput.value = item.description;
    descInput.addEventListener("input", () => { item.description = descInput.value; renderPreview(); });
    wrap.appendChild(descInput);

    const modeRow = document.createElement("div"); modeRow.className = "mode-row";
    const modeSelect = document.createElement("select"); modeSelect.className = "mode-select";
    [["flat", "Flat amount"], ["qty", "Qty × rate"], ["na", "N/A (no charge)"]].forEach((pair) => {
      const opt = document.createElement("option"); opt.value = pair[0]; opt.textContent = pair[1];
      if (item.mode === pair[0]) opt.selected = true;
      modeSelect.appendChild(opt);
    });
    modeRow.appendChild(modeSelect);
    const fieldsHost = document.createElement("div"); modeRow.appendChild(fieldsHost);
    const amountDisplay = document.createElement("div"); amountDisplay.className = "row-amount num"; modeRow.appendChild(amountDisplay);

    function renderFields() {
      fieldsHost.innerHTML = "";
      if (item.mode === "flat") {
        const wrapper = document.createElement("div"); wrapper.className = "flat-fields";
        const amt = document.createElement("input"); amt.type = "number"; amt.step = "0.01"; amt.placeholder = "0.00"; amt.value = item.flatAmount;
        amt.addEventListener("input", () => { item.flatAmount = amt.value; updateAmount(); renderPreview(); });
        wrapper.appendChild(amt); fieldsHost.appendChild(wrapper);
      } else if (item.mode === "qty") {
        const q = document.createElement("div"); q.className = "qty-fields";
        const qty = document.createElement("input"); qty.type = "number"; qty.step = "0.01"; qty.className = "qty"; qty.placeholder = "qty"; qty.value = item.qty;
        const unit = document.createElement("input"); unit.type = "text"; unit.className = "unit"; unit.placeholder = "sq ft"; unit.value = item.unit;
        const x = document.createElement("span"); x.textContent = "×";
        const rate = document.createElement("input"); rate.type = "number"; rate.step = "0.01"; rate.className = "rate"; rate.placeholder = "$/unit"; rate.value = item.rate;
        qty.addEventListener("input", () => { item.qty = qty.value; updateAmount(); renderPreview(); });
        unit.addEventListener("input", () => { item.unit = unit.value; renderPreview(); });
        rate.addEventListener("input", () => { item.rate = rate.value; updateAmount(); renderPreview(); });
        q.appendChild(qty); q.appendChild(unit); q.appendChild(x); q.appendChild(rate);
        fieldsHost.appendChild(q);
      } else {
        const na = document.createElement("span"); na.style.fontSize = "12px"; na.style.color = "var(--muted)";
        na.textContent = "Scope noted, no charge on this change order";
        fieldsHost.appendChild(na);
      }
      updateAmount();
    }
    function updateAmount() {
      if (item.mode === "na") { amountDisplay.textContent = "N/A"; amountDisplay.classList.add("na"); }
      else { amountDisplay.textContent = A.fmtMoney(computeItemAmount(item)); amountDisplay.classList.remove("na"); }
    }
    modeSelect.addEventListener("change", () => { item.mode = modeSelect.value; renderFields(); renderPreview(); });
    renderFields();
    wrap.appendChild(modeRow);
    return wrap;
  }

  function renderItems() {
    const host = document.getElementById("coItemRows");
    const emptyEl = document.getElementById("coItemsEmpty");
    host.innerHTML = "";
    emptyEl.style.display = order.items.length ? "none" : "block";
    order.items.forEach((item) => host.appendChild(buildItemRow(item)));
    const n = order.items.length;
    document.getElementById("coItemCount").textContent = n === 0 ? "" : (n + " item" + (n === 1 ? "" : "s"));
  }

  function renderPreview() {
    const total = orderTotal();
    const c = companySettings || {};
    const proj = A.state.projects.find((p) => p.id === Number(order.projectId));

    let itemsHtml = order.items.map((it) => {
      const amtHtml = it.mode === "na" ? '<td class="amt na">N/A</td>' : '<td class="amt num">' + A.fmtMoney(computeItemAmount(it)) + '</td>';
      const descBits = [];
      if (it.description) descBits.push(A.esc(it.description));
      if (it.mode === "qty") {
        const qty = parseFloat(it.qty) || 0, rate = parseFloat(it.rate) || 0;
        descBits.push('(' + qty + ' ' + A.esc(it.unit || "unit") + ' × ' + A.fmtMoney(rate) + ')');
      }
      return '<tr><td class="cat">' + A.esc(it.category || "Item") + '</td><td class="desc">' + descBits.join(" ") + '</td>' + amtHtml + '</tr>';
    }).join("");
    if (!order.items.length) itemsHtml = '<tr><td colspan="3" style="padding:16px 0;color:var(--muted);font-size:12px;">No line items added yet.</td></tr>';

    const statusBadge = '<span class="badge ' + (order.status === "approved" ? "passed" : order.status === "rejected" ? "failed" : "pending") + '">' + order.status + '</span>';

    const html =
      '<div class="qs-head">' +
        '<div class="qs-logo"><img src="/logo.jpg" alt="' + A.esc(c.companyName || "Las Casita Inc.") + '" class="qs-logo-img"></div>' +
        '<div class="qs-title"><h3>Change Order</h3></div>' +
      '</div>' +
      '<div class="qs-meta">' +
        '<div class="col"><p><strong>' + A.esc(c.companyName || "") + '</strong></p><p class="muted">' + A.esc(c.companyAddr1 || "") + '</p><p class="muted">' + A.esc(c.companyAddr2 || "") + '</p></div>' +
        '<div class="col right"><p><span class="muted">Date:</span> ' + A.esc(A.fmtDate(order.orderDate)) + '</p><p><span class="muted">CO #:</span> ' + A.esc(order.orderNo) + '</p><p>' + statusBadge + '</p></div>' +
      '</div>' +
      '<div class="qs-project">' +
        '<p><span class="k">Project&nbsp;</span> ' + A.esc(proj ? proj.name + (proj.address ? " — " + proj.address : "") : "—") + '</p>' +
        '<p><span class="k">Description of change&nbsp;</span> ' + A.esc(order.title || "—") + '</p>' +
      '</div>' +
      '<table class="qs-table"><thead><tr><th>Category</th><th>Description</th><th class="amt">Amount</th></tr></thead><tbody>' + itemsHtml +
      '<tr class="qs-total-row"><td colspan="2">Total change</td><td class="amt num">' + A.fmtMoney(total) + '</td></tr></tbody></table>' +
      '<p class="qs-auth">By signing this change order, the owner authorizes the additional work and/or cost adjustment described above, to be added to the original contract amount.</p>' +
      '<div class="qs-sign"><div class="line"><hr class="rule"><div class="cap"><span>' + A.esc(order.clientName || "Client") + '</span><span>Date</span></div></div>' +
        '<div class="line"><hr class="rule"><div class="cap"><span>' + A.esc((c.companyName || "").replace(/ Inc\.?$/, "")) + '</span><span>Date</span></div></div></div>';

    document.getElementById("co-sheet").innerHTML = html;
    document.getElementById("coTopbarTotal").textContent = A.fmtMoney(total);
  }

  return { render };
})();
