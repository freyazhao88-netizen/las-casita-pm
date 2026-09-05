"use strict";
window.QuotesTab = (function () {
  const A = window.App;
  let uidCounter = 1;
  function uid() { return "id" + (uidCounter++) + "_" + Math.random().toString(36).slice(2, 7); }

  let categoryLibrary = [];
  let companySettings = null;
  let quote = null; // current editor state
  let bound = false;

  var TXT = {
    en: {
      quote: "Quote", tag: "Construction", date: "Date:", quoteNo: "Quote #:",
      address: "Project address", scope: "Scope of work",
      category: "Category", description: "Description", amount: "Amount",
      noItems: "No scope items added yet.", total: "Total",
      auth: "By signing this quote, you hereby authorize the furnishing of all materials and labor required to complete the work mentioned in this quote.",
      name: "Name", signDate: "Date",
      periodHeader: "Construction period", tbd: "To be determined",
      periodDisclaimer: ". Does not include holidays, natural disasters, material shortages, inspection delays, or utility company delays.",
      start: "Start", estCompletion: "Est. completion",
      paymentHeader: "Payment schedule",
      exclusionsHeader: "Not included / exclusions",
      terminationHeader: "Termination",
      terminationText: "Project disputes or any other reason that the owner decides to terminate said contract — the current outstanding balances and materials purchased for the job will need to be paid off to the contractor."
    },
    zh: {
      quote: "报价单", tag: "建筑工程", date: "日期:", quoteNo: "报价单号:",
      address: "项目地址", scope: "工程范围",
      category: "项目类别", description: "说明", amount: "金额",
      noItems: "尚未添加报价项目。", total: "总计",
      auth: "签署本报价单即表示您授权供应完成本报价单所列工程所需的全部材料及人工。",
      name: "姓名", signDate: "日期",
      periodHeader: "施工工期", tbd: "待定",
      periodDisclaimer: "。不包含节假日、自然灾害、材料短缺、验收延误或市政公用事业延误等情况。",
      start: "开工", estCompletion: "预计完工",
      paymentHeader: "付款计划",
      exclusionsHeader: "不包含项目 / 免责声明",
      terminationHeader: "终止条款",
      terminationText: "如因项目纠纷或业主决定终止合同,现有未付余额及已为本工程采购的材料费用,均需结清给承包商。"
    }
  };

  var CATEGORY_ZH = {
    "Demolition": "拆除", "Foundation": "地基", "Framing": "框架", "Mechanical (HVAC)": "暖通空调",
    "Electrical": "电路", "Plumbing": "水管", "Roofing": "屋顶", "Interior Doors": "室内门",
    "Exterior Doors": "室外门", "Windows": "窗户", "Insulation": "隔热层", "Drywall": "石膏板",
    "Stucco": "外墙灰泥", "Texture": "墙面纹理", "Paint": "油漆", "Flooring": "地板", "Tile": "瓷砖",
    "Cabinets": "橱柜", "Countertop": "台面", "Bath Vanities": "浴室柜", "Bathroom": "卫浴",
    "Kitchen": "厨房", "Moulding / Baseboard": "装饰线条/踢脚线", "Stair Railing": "楼梯扶手",
    "Closet / Pantry": "衣柜/储藏室", "Waterproofing": "防水", "Hardware": "五金件",
    "Driveway / Concrete": "车道/混凝土", "Porch": "门廊", "Laundry Cabinet": "洗衣柜"
  };

  var PAYMENT_ZH = {
    "First payment (deposit) due upon signing of contract": "首付款(定金)于签订合同时支付",
    "Second payment due upon start of construction": "第二笔款项于开工时支付",
    "Third payment due upon trenching / demo complete": "第三笔款项于开挖/拆除完成后支付",
    "Fourth payment due upon lumber delivery": "第四笔款项于木材到货后支付",
    "Fifth payment due upon rough electric inspection approval": "第五笔款项于粗电验收通过后支付",
    "Sixth payment due upon rough plumbing inspection approval": "第六笔款项于粗水管验收通过后支付",
    "Seventh payment due upon rough mechanical inspection approval": "第七笔款项于暖通验收通过后支付",
    "Eighth payment due upon framing inspection approval": "第八笔款项于框架验收通过后支付",
    "Ninth payment due upon insulation approval": "第九笔款项于隔热层验收通过后支付",
    "Tenth payment due upon stucco complete": "第十笔款项于外墙灰泥完成后支付",
    "Eleventh payment due upon roof complete": "第十一笔款项于屋顶完成后支付",
    "Twelfth payment due upon drywall approval": "第十二笔款项于石膏板验收通过后支付",
    "Thirteenth payment due upon paint complete": "第十三笔款项于油漆完成后支付",
    "Fourteenth payment due upon flooring complete": "第十四笔款项于地板完成后支付",
    "Fifteenth payment due upon bath complete": "第十五笔款项于卫浴完成后支付",
    "Sixteenth payment due upon kitchen complete": "第十六笔款项于厨房完成后支付",
    "Seventeenth payment due upon final inspection approval": "第十七笔款项于最终验收通过后支付"
  };

  var EXCLUSION_ZH = {
    "All government, utility, school, city, and building permit fees.": "所有政府、市政、学校、市政厅及建筑许可费用。",
    "Additional architectural, engineering, survey, cut sheet, structural observation, deputy inspection, Title-24 energy compliance report, soil memo/report, AQMD report.": "额外的建筑设计、工程、测绘、图纸、结构观测、代理检查、Title-24能效合规报告、土壤报告及AQMD报告等费用。",
    "Any extra work required by the city due to unforeseen code violations.": "因不可预见的规范违规而产生的、市政要求的额外工程。",
    "Materials not included: appliances, sink disposal, cabinet pulls/knobs, main entry door, garage door, shower door, bath hardware, tile, fixture, toilet, and sink.": "不包含材料:电器、水槽垃圾处理器、橱柜拉手/把手、正门、车库门、淋浴门、卫浴五金、瓷砖、灯具洁具、马桶及水槽。",
    "Does not include outside consultants: fire sprinklers, solar panels, and battery backup.": "不包含外部顾问项目:消防喷淋、太阳能板及蓄电池后备系统。"
  };

  function defaultPaymentSchedule() {
    return [
      "First payment (deposit) due upon signing of contract",
      "Second payment due upon start of construction",
      "Third payment due upon trenching / demo complete",
      "Fourth payment due upon lumber delivery",
      "Fifth payment due upon rough electric inspection approval",
      "Sixth payment due upon rough plumbing inspection approval",
      "Seventh payment due upon rough mechanical inspection approval",
      "Eighth payment due upon framing inspection approval",
      "Ninth payment due upon insulation approval",
      "Tenth payment due upon stucco complete",
      "Eleventh payment due upon roof complete",
      "Twelfth payment due upon drywall approval",
      "Thirteenth payment due upon paint complete",
      "Fourteenth payment due upon flooring complete",
      "Fifteenth payment due upon bath complete",
      "Sixteenth payment due upon kitchen complete",
      "Seventeenth payment due upon final inspection approval"
    ].map((label, i) => ({ id: uid(), label, amount: i === 0 ? "1000" : "" }));
  }

  function defaultExclusions() {
    return [
      "All government, utility, school, city, and building permit fees.",
      "Additional architectural, engineering, survey, cut sheet, structural observation, deputy inspection, Title-24 energy compliance report, soil memo/report, AQMD report.",
      "Any extra work required by the city due to unforeseen code violations.",
      "Materials not included: appliances, sink disposal, cabinet pulls/knobs, main entry door, garage door, shower door, bath hardware, tile, fixture, toilet, and sink.",
      "Does not include outside consultants: fire sprinklers, solar panels, and battery backup."
    ].map((text) => ({ id: uid(), text }));
  }

  function blankQuote() {
    return {
      id: null,
      projectId: "",
      meta: {
        date: A.todayISO(), quoteNo: "", address: "", scope: "", client: "",
        period: "", startDate: "", estEndDate: "", referralSource: "", language: "en"
      },
      items: [],
      paymentSchedule: defaultPaymentSchedule(),
      exclusions: defaultExclusions()
    };
  }

  function fmtDateLang(iso, lang) {
    if (!iso) return "";
    if (lang !== "zh") return A.fmtDate(iso);
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  }

  function computeItemAmount(item) {
    if (item.mode === "na") return 0;
    if (item.mode === "qty") return (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
    return parseFloat(item.flatAmount) || 0;
  }
  function quoteTotal() { return quote.items.reduce((s, it) => s + computeItemAmount(it), 0); }
  function paymentTotal() { return quote.paymentSchedule.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0); }

  async function ensureLibrary() {
    if (!categoryLibrary.length) categoryLibrary = await A.api("/category-library");
    if (!companySettings) companySettings = await A.api("/settings");
  }

  async function render() {
    await ensureLibrary();
    document.getElementById("quotesListView").hidden = false;
    document.getElementById("quoteEditorView").hidden = true;
    bindListButtons();
    const list = await A.api("/quotes");
    const tbody = document.querySelector("#quotesTable tbody");
    if (!list.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No quotes yet — click "New quote" to build one.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((q) => (
      '<tr>' +
        '<td>' + A.esc(q.quoteDate || "") + '</td>' +
        '<td>' + A.esc(q.quoteNo || "") + '</td>' +
        '<td>' + A.esc(q.address || "") + '</td>' +
        '<td>' + A.esc(q.client || "") + '</td>' +
        '<td>' + A.esc(q.projectId ? A.projectName(q.projectId) : "—") + '</td>' +
        '<td class="amt num">' + A.fmtMoney(q.total) + '</td>' +
        '<td style="white-space:nowrap;">' +
          '<button class="btn btn-sm" data-open="' + q.id + '">Open</button> ' +
          '<button class="btn btn-sm" data-dup="' + q.id + '">Duplicate</button> ' +
          '<button class="row-del" data-del="' + q.id + '" title="Delete">✕</button>' +
        '</td>' +
      '</tr>'
    )).join("");
    tbody.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openEditor(Number(b.getAttribute("data-open")))));
    tbody.querySelectorAll("[data-dup]").forEach((b) => b.addEventListener("click", async () => {
      await A.api("/quotes/" + b.getAttribute("data-dup") + "/duplicate", { method: "POST" });
      A.toast("Quote duplicated");
      render();
    }));
    tbody.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Delete this quote?")) return;
      await A.api("/quotes/" + b.getAttribute("data-del"), { method: "DELETE" });
      render();
    }));
  }

  function bindListButtons() {
    if (bound) return;
    bound = true;
    document.getElementById("btnNewQuote").addEventListener("click", () => { quote = blankQuote(); openEditorView(); });
    document.getElementById("btnBackToQuotes").addEventListener("click", () => { render(); });
    document.getElementById("btnPrintQuote").addEventListener("click", () => window.print());
    document.getElementById("btnSaveQuote").addEventListener("click", saveQuote);
  }

  async function openEditor(id) {
    const full = await A.api("/quotes/" + id);
    quote = {
      id: full.id,
      projectId: full.projectId || "",
      meta: Object.assign(blankQuote().meta, full.meta),
      items: full.items || [],
      paymentSchedule: full.paymentSchedule && full.paymentSchedule.length ? full.paymentSchedule : defaultPaymentSchedule(),
      exclusions: full.exclusions && full.exclusions.length ? full.exclusions : defaultExclusions()
    };
    openEditorView();
  }

  function openEditorView() {
    document.getElementById("quotesListView").hidden = true;
    document.getElementById("quoteEditorView").hidden = false;
    renderEditor();
  }

  async function saveQuote() {
    const body = { projectId: quote.projectId || null, meta: quote.meta, items: quote.items, paymentSchedule: quote.paymentSchedule, exclusions: quote.exclusions };
    if (quote.id) {
      await A.api("/quotes/" + quote.id, { method: "PUT", body });
    } else {
      const rec = await A.api("/quotes", { method: "POST", body });
      quote.id = rec.id;
    }
    A.toast("Quote saved");
  }

  /* ---------------- Editor pane ---------------- */
  function renderEditor() {
    const pane = document.getElementById("qbEditorPane");
    pane.innerHTML =
      '<div class="card">' +
        '<div class="card-head"><h3>Project info</h3></div>' +
        '<div class="field-grid">' +
          '<div class="field span-2"><label>Link to project (optional)</label><select id="qbProject"><option value="">— No linked project —</option></select></div>' +
          '<div class="field"><label>Date</label><input type="date" id="qbDate"></div>' +
          '<div class="field"><label>Quote #</label><input type="text" id="qbQuoteNo"></div>' +
          '<div class="field span-2"><label>Project address</label><input type="text" id="qbAddress"></div>' +
          '<div class="field span-2"><label>Scope of work title</label><input type="text" id="qbScope"></div>' +
          '<div class="field"><label>Client name</label><input type="text" id="qbClient"></div>' +
          '<div class="field"><label>Estimated period (text)</label><input type="text" id="qbPeriod" placeholder="e.g. about 12 weeks"></div>' +
          '<div class="field"><label>Start date</label><input type="date" id="qbStart"></div>' +
          '<div class="field"><label>Est. completion date</label><input type="date" id="qbEnd"></div>' +
          '<div class="field span-2"><label>Lead source</label><input type="text" id="qbReferral" placeholder="e.g. Advertisement, or referred by Jane Doe" list="qbReferralList"><datalist id="qbReferralList"><option value="Advertisement"><option value="Referral"><option value="Google search"><option value="Repeat client"></datalist></div>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head"><h3>Scope &amp; line items</h3><span class="hint" id="qbItemCount"></span></div>' +
        '<div class="chip-lib" id="qbChipLib"></div>' +
        '<div id="qbItemRows"></div>' +
        '<div class="empty-state" id="qbItemsEmpty">No line items yet — click a category above to add one.</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head"><h3>Payment schedule</h3></div>' +
        '<div id="qbPayRows"></div>' +
        '<button class="add-row-btn" id="qbAddPay" type="button">+ Add payment step</button>' +
        '<div id="qbBalanceChip"></div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head"><h3>Not included / exclusions</h3></div>' +
        '<div id="qbExclRows"></div>' +
        '<button class="add-row-btn" id="qbAddExcl" type="button">+ Add exclusion</button>' +
      '</div>';

    // project select
    const projSelect = document.getElementById("qbProject");
    A.populateSelect(projSelect, A.state.projects, (p) => p.id, (p) => p.name, "— No linked project —");
    projSelect.value = quote.projectId || "";
    projSelect.addEventListener("change", () => {
      quote.projectId = projSelect.value ? Number(projSelect.value) : "";
      const proj = A.state.projects.find((p) => p.id === Number(projSelect.value));
      if (proj) {
        if (!quote.meta.address) document.getElementById("qbAddress").value = quote.meta.address = proj.address || "";
        if (!quote.meta.client) document.getElementById("qbClient").value = quote.meta.client = proj.clientName || "";
        if (!quote.meta.startDate) document.getElementById("qbStart").value = quote.meta.startDate = proj.startDate || "";
        if (!quote.meta.estEndDate) document.getElementById("qbEnd").value = quote.meta.estEndDate = proj.estEndDate || "";
      }
      renderPreview();
    });

    const metaFields = { qbDate: "date", qbQuoteNo: "quoteNo", qbAddress: "address", qbScope: "scope", qbClient: "client", qbPeriod: "period", qbStart: "startDate", qbEnd: "estEndDate", qbReferral: "referralSource" };
    Object.keys(metaFields).forEach((elId) => {
      const key = metaFields[elId];
      const el = document.getElementById(elId);
      el.value = quote.meta[key] || "";
      el.addEventListener("input", () => { quote.meta[key] = el.value; renderPreview(); });
    });

    // chip library
    const chipLib = document.getElementById("qbChipLib");
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

    document.querySelectorAll("#qbLangToggle .lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === (quote.meta.language || "en"));
      btn.onclick = () => {
        quote.meta.language = btn.dataset.lang;
        document.querySelectorAll("#qbLangToggle .lang-btn").forEach((b) => b.classList.toggle("active", b === btn));
        renderPreview();
      };
    });

    renderItems();
    renderPaySchedule();
    renderExclusions();
    renderPreview();

    document.getElementById("qbAddPay").addEventListener("click", () => {
      quote.paymentSchedule.push({ id: uid(), label: "", amount: "" });
      renderPaySchedule(); renderPreview();
    });
    document.getElementById("qbAddExcl").addEventListener("click", () => {
      quote.exclusions.push({ id: uid(), text: "" });
      renderExclusions(); renderPreview();
    });
  }

  function addItem(category) {
    const item = { id: uid(), category, description: "", mode: "flat", flatAmount: "", qty: "", unit: "sq ft", rate: "" };
    quote.items.push(item);
    renderItems(); renderPreview();
    const row = document.querySelector('[data-item-id="' + item.id + '"] .cat-input');
    if (row) row.focus();
  }
  function removeItem(id) { quote.items = quote.items.filter((it) => it.id !== id); renderItems(); renderPreview(); }
  function moveItem(id, dir) {
    const idx = quote.items.findIndex((it) => it.id === id);
    const newIdx = idx + dir;
    if (idx < 0 || newIdx < 0 || newIdx >= quote.items.length) return;
    const tmp = quote.items[idx]; quote.items[idx] = quote.items[newIdx]; quote.items[newIdx] = tmp;
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
    descInput.type = "text"; descInput.className = "desc-input"; descInput.placeholder = "Description (e.g. labor only, material by owner)"; descInput.value = item.description;
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
        na.textContent = "Scope noted, no charge on this quote";
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
    const host = document.getElementById("qbItemRows");
    const emptyEl = document.getElementById("qbItemsEmpty");
    host.innerHTML = "";
    emptyEl.style.display = quote.items.length ? "none" : "block";
    quote.items.forEach((item) => host.appendChild(buildItemRow(item)));
    const n = quote.items.length;
    document.getElementById("qbItemCount").textContent = n === 0 ? "" : (n + " item" + (n === 1 ? "" : "s"));
  }

  function buildPayRow(p) {
    const row = document.createElement("div"); row.className = "pay-row";
    const label = document.createElement("input"); label.type = "text"; label.className = "pay-label"; label.value = p.label;
    label.addEventListener("input", () => { p.label = label.value; renderPreview(); });
    const amt = document.createElement("input"); amt.type = "number"; amt.step = "0.01"; amt.className = "pay-amount"; amt.placeholder = "0.00"; amt.value = p.amount;
    amt.addEventListener("input", () => { p.amount = amt.value; renderPreview(); renderBalance(); });
    const actions = document.createElement("div"); actions.className = "row-actions";
    const del = document.createElement("button"); del.type = "button"; del.textContent = "✕"; del.className = "danger"; del.title = "Remove step";
    del.addEventListener("click", () => { quote.paymentSchedule = quote.paymentSchedule.filter((x) => x.id !== p.id); renderPaySchedule(); renderPreview(); });
    actions.appendChild(del);
    row.appendChild(label); row.appendChild(amt); row.appendChild(actions);
    return row;
  }
  function renderPaySchedule() {
    const host = document.getElementById("qbPayRows");
    host.innerHTML = "";
    quote.paymentSchedule.forEach((p) => host.appendChild(buildPayRow(p)));
    renderBalance();
  }
  function renderBalance() {
    const host = document.getElementById("qbBalanceChip");
    const total = quoteTotal(); const paid = paymentTotal(); const diff = total - paid;
    const chip = document.createElement("div");
    if (Math.abs(diff) < 0.005) { chip.className = "balance-chip good"; chip.innerHTML = '<span class="dot"></span> Payment steps match the quote total'; }
    else { chip.className = "balance-chip bad"; chip.innerHTML = '<span class="dot"></span> ' + (diff > 0 ? A.fmtMoney(diff) + " unassigned" : A.fmtMoney(Math.abs(diff)) + " over the quote total"); }
    host.innerHTML = ""; host.appendChild(chip);
  }

  function buildExclRow(x) {
    const row = document.createElement("div"); row.className = "excl-row";
    const text = document.createElement("input"); text.type = "text"; text.className = "excl-text"; text.value = x.text;
    text.addEventListener("input", () => { x.text = text.value; renderPreview(); });
    const actions = document.createElement("div"); actions.className = "row-actions";
    const del = document.createElement("button"); del.type = "button"; del.textContent = "✕"; del.className = "danger"; del.title = "Remove";
    del.addEventListener("click", () => { quote.exclusions = quote.exclusions.filter((e) => e.id !== x.id); renderExclusions(); renderPreview(); });
    actions.appendChild(del);
    row.appendChild(text); row.appendChild(actions);
    return row;
  }
  function renderExclusions() {
    const host = document.getElementById("qbExclRows");
    host.innerHTML = "";
    quote.exclusions.forEach((x) => host.appendChild(buildExclRow(x)));
  }

  function renderPreview() {
    const m = quote.meta;
    const total = quoteTotal();
    const c = companySettings || {};
    const lang = m.language === "zh" ? "zh" : "en";
    const t = TXT[lang];
    const catLabel = (name) => (lang === "zh" && CATEGORY_ZH[name]) ? CATEGORY_ZH[name] : name;
    const payLabel = (label) => (lang === "zh" && PAYMENT_ZH[label]) ? PAYMENT_ZH[label] : label;
    const exclLabel = (text) => (lang === "zh" && EXCLUSION_ZH[text]) ? EXCLUSION_ZH[text] : text;

    let itemsHtml = quote.items.map((it) => {
      const amtHtml = it.mode === "na" ? '<td class="amt na">N/A</td>' : '<td class="amt num">' + A.fmtMoney(computeItemAmount(it)) + '</td>';
      const descBits = [];
      if (it.description) descBits.push(A.esc(it.description));
      if (it.mode === "qty") {
        const qty = parseFloat(it.qty) || 0, rate = parseFloat(it.rate) || 0;
        descBits.push('(' + qty + ' ' + A.esc(it.unit || "unit") + ' × ' + A.fmtMoney(rate) + ')');
      }
      return '<tr><td class="cat">' + A.esc(catLabel(it.category) || "Item") + '</td><td class="desc">' + descBits.join(" ") + '</td>' + amtHtml + '</tr>';
    }).join("");
    if (!quote.items.length) itemsHtml = '<tr><td colspan="3" style="padding:16px 0;color:var(--muted);font-size:12px;">' + A.esc(t.noItems) + '</td></tr>';

    const payHtml = quote.paymentSchedule.map((p, i) => (
      '<tr><td class="n">' + (i + 1) + '.</td><td>' + A.esc(payLabel(p.label) || "Payment step") + '</td><td class="amt num">' + A.fmtMoney(parseFloat(p.amount) || 0) + '</td></tr>'
    )).join("");
    const exclHtml = quote.exclusions.map((x) => x.text ? '<li>' + A.esc(exclLabel(x.text)) + '</li>' : "").join("");

    let periodLine = m.period || t.tbd;
    if (m.startDate || m.estEndDate) {
      const bits = [];
      if (m.startDate) bits.push(t.start + ": " + fmtDateLang(m.startDate, lang));
      if (m.estEndDate) bits.push(t.estCompletion + ": " + fmtDateLang(m.estEndDate, lang));
      periodLine += " (" + bits.join(" · ") + ")";
    }

    const html =
      '<div class="qs-head">' +
        '<div class="qs-logo"><img src="/logo.jpg" alt="' + A.esc(c.companyName || "Las Casita Inc.") + '" class="qs-logo-img"></div>' +
        '<div class="qs-title"><h3>' + A.esc(t.quote) + '</h3></div>' +
      '</div>' +
      '<div class="qs-meta">' +
        '<div class="col"><p><strong>' + A.esc(c.companyName || "") + '</strong></p><p class="muted">' + A.esc(c.companyAddr1 || "") + '</p><p class="muted">' + A.esc(c.companyAddr2 || "") + '</p><p class="muted">' + A.esc(c.companyEmail || "") + '</p></div>' +
        '<div class="col right"><p><span class="muted">' + A.esc(t.date) + '</span> ' + A.esc(fmtDateLang(m.date, lang)) + '</p><p><span class="muted">' + A.esc(t.quoteNo) + '</span> ' + A.esc(m.quoteNo) + '</p><p class="muted">' + A.esc(c.contact1 || "") + '</p><p class="muted">' + A.esc(c.contact2 || "") + '</p></div>' +
      '</div>' +
      '<div class="qs-project"><p><span class="k">' + A.esc(t.address) + '&nbsp;</span> ' + A.esc(m.address || "—") + '</p><p><span class="k">' + A.esc(t.scope) + '&nbsp;</span> ' + A.esc(m.scope || "—") + '</p></div>' +
      '<table class="qs-table"><thead><tr><th>' + A.esc(t.category) + '</th><th>' + A.esc(t.description) + '</th><th class="amt">' + A.esc(t.amount) + '</th></tr></thead><tbody>' + itemsHtml +
      '<tr class="qs-total-row"><td colspan="2">' + A.esc(t.total) + '</td><td class="amt num">' + A.fmtMoney(total) + '</td></tr></tbody></table>' +
      '<p class="qs-auth">' + A.esc(t.auth) + '</p>' +
      '<div class="qs-sign"><div class="line"><hr class="rule"><div class="cap"><span>' + A.esc(m.client || t.name) + '</span><span>' + A.esc(t.signDate) + '</span></div></div>' +
        '<div class="line"><hr class="rule"><div class="cap"><span>' + A.esc((c.companyName || "").replace(/ Inc\.?$/, "")) + '</span><span>' + A.esc(t.signDate) + '</span></div></div></div>' +
      '<div class="qs-section"><h4>' + A.esc(t.periodHeader) + '</h4><p>' + A.esc(periodLine) + A.esc(t.periodDisclaimer) + '</p></div>' +
      '<div class="qs-section"><h4>' + A.esc(t.paymentHeader) + '</h4><table class="qs-pay">' + payHtml + '</table></div>' +
      '<div class="qs-section"><h4>' + A.esc(t.exclusionsHeader) + '</h4><ol class="qs-excl">' + exclHtml + '</ol></div>' +
      '<div class="qs-section"><h4>' + A.esc(t.terminationHeader) + '</h4><p class="qs-term">' + A.esc(t.terminationText) + '</p></div>';

    document.getElementById("quote-sheet").innerHTML = html;
    document.getElementById("qbTopbarTotal").textContent = A.fmtMoney(total);
    renderBalance();
  }

  return { render };
})();
