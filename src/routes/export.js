"use strict";
const express = require("express");
const ExcelJS = require("exceljs");
const db = require("../db");
const { computeItemsTotal, computeAllSummaries } = require("../summary");

const router = express.Router();

function addSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 16 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((r) => sheet.addRow(r));
  return sheet;
}

router.get("/export/all", async (req, res, next) => {
  try {
    const [employees, projects, attendance, materials, expenses, payments, wagePayments, changeOrders, quotes, stages] =
      await Promise.all([
        db.all("employees"), db.all("projects"), db.all("attendance"), db.all("materials"),
        db.all("expenses"), db.all("payments"), db.all("wagePayments"), db.all("changeOrders"),
        db.all("quotes"), db.all("stages")
      ]);

    const projectName = (id) => { const p = projects.find((x) => x.id === id); return p ? p.name : ""; };
    const employeeName = (id) => { const e = employees.find((x) => x.id === id); return e ? e.name : ""; };
    const summaries = await computeAllSummaries(projects);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Las Casita Project Manager";
    workbook.created = new Date();

    addSheet(workbook, "Projects",
      [
        { header: "ID", key: "id", width: 8 },
        { header: "Name", key: "name", width: 24 },
        { header: "Address", key: "address", width: 28 },
        { header: "Client", key: "clientName", width: 20 },
        { header: "Status", key: "status", width: 12 },
        { header: "Start date", key: "startDate", width: 12 },
        { header: "Est. end date", key: "estEndDate", width: 12 },
        { header: "Quote / Contract total", key: "quotedTotal", width: 18 },
        { header: "Approved change orders", key: "approvedChangeOrdersTotal", width: 18 },
        { header: "Total contract amount", key: "effectiveQuotedTotal", width: 18 },
        { header: "Labor cost", key: "laborTotal", width: 14 },
        { header: "Material cost", key: "materialsTotal", width: 14 },
        { header: "Other expenses", key: "otherExpensesTotal", width: 14 },
        { header: "Total spend", key: "grandTotal", width: 14 },
        { header: "Profit margin", key: "profitMargin", width: 14 },
        { header: "Received from client", key: "amountReceived", width: 16 },
        { header: "Outstanding balance", key: "outstandingBalance", width: 16 },
        { header: "Notes", key: "notes", width: 30 }
      ],
      projects.map((p) => {
        const s = summaries[p.id] || {};
        return {
          id: p.id, name: p.name, address: p.address, clientName: p.clientName, status: p.status,
          startDate: p.startDate, estEndDate: p.estEndDate,
          quotedTotal: Number(p.quotedTotal) || 0,
          approvedChangeOrdersTotal: s.approvedChangeOrdersTotal || 0,
          effectiveQuotedTotal: s.effectiveQuotedTotal || 0,
          laborTotal: s.laborTotal || 0,
          materialsTotal: s.materialsTotal || 0,
          otherExpensesTotal: s.otherExpensesTotal || 0,
          grandTotal: s.grandTotal || 0,
          profitMargin: s.profitMargin || 0,
          amountReceived: s.amountReceived || 0,
          outstandingBalance: s.outstandingBalance || 0,
          notes: p.notes
        };
      })
    );

    addSheet(workbook, "Employees",
      [
        { header: "ID", key: "id", width: 8 },
        { header: "Name", key: "name", width: 22 },
        { header: "Default day rate", key: "defaultDailyRate", width: 16 },
        { header: "Active", key: "active", width: 10 },
        { header: "SSN", key: "ssn", width: 14 },
        { header: "ID number", key: "idNumber", width: 16 },
        { header: "Notes", key: "notes", width: 30 }
      ],
      employees.map((e) => ({
        id: e.id, name: e.name, defaultDailyRate: Number(e.defaultDailyRate) || 0,
        active: e.active ? "Yes" : "No", ssn: e.ssn, idNumber: e.idNumber, notes: e.notes
      }))
    );

    addSheet(workbook, "Attendance",
      [
        { header: "Date", key: "workDate", width: 12 },
        { header: "Employee", key: "employeeName", width: 20 },
        { header: "Project", key: "projectName", width: 22 },
        { header: "Days", key: "days", width: 8 },
        { header: "Rate", key: "rate", width: 12 },
        { header: "Cost", key: "cost", width: 12 },
        { header: "Notes", key: "notes", width: 26 }
      ],
      attendance.map((a) => ({
        workDate: a.workDate, employeeName: employeeName(a.employeeId), projectName: projectName(a.projectId),
        days: Number(a.days) || 0, rate: Number(a.rate) || 0, cost: (Number(a.days) || 0) * (Number(a.rate) || 0),
        notes: a.notes
      }))
    );

    addSheet(workbook, "Materials",
      [
        { header: "Date", key: "purchaseDate", width: 12 },
        { header: "Project", key: "projectName", width: 22 },
        { header: "Vendor", key: "vendor", width: 18 },
        { header: "Category", key: "category", width: 16 },
        { header: "Description", key: "description", width: 28 },
        { header: "Qty", key: "qty", width: 8 },
        { header: "Unit price", key: "unitPrice", width: 12 },
        { header: "Amount", key: "amount", width: 12 },
        { header: "Payment status", key: "paymentStatus", width: 14 },
        { header: "Payment method", key: "paymentMethod", width: 16 },
        { header: "Invoice #", key: "invoiceNumber", width: 14 },
        { header: "Has receipt", key: "hasReceipt", width: 12 }
      ],
      materials.map((m) => ({
        purchaseDate: m.purchaseDate, projectName: projectName(m.projectId), vendor: m.vendor,
        category: m.category, description: m.description, qty: m.qty, unitPrice: m.unitPrice,
        amount: Number(m.amount) || 0, paymentStatus: m.paymentStatus, paymentMethod: m.paymentMethod,
        invoiceNumber: m.invoiceNumber, hasReceipt: m.receiptPath ? "Yes" : "No"
      }))
    );

    addSheet(workbook, "Other Expenses",
      [
        { header: "Date", key: "expenseDate", width: 12 },
        { header: "Project", key: "projectName", width: 22 },
        { header: "Category", key: "category", width: 16 },
        { header: "Description", key: "description", width: 28 },
        { header: "Amount", key: "amount", width: 12 },
        { header: "Status", key: "status", width: 14 },
        { header: "Payment method", key: "paymentMethod", width: 16 },
        { header: "Notes", key: "notes", width: 26 },
        { header: "Has receipt", key: "hasReceipt", width: 12 }
      ],
      expenses.map((e) => ({
        expenseDate: e.expenseDate, projectName: projectName(e.projectId), category: e.category,
        description: e.description, amount: Number(e.amount) || 0, status: e.status,
        paymentMethod: e.paymentMethod, notes: e.notes, hasReceipt: e.receiptPath ? "Yes" : "No"
      }))
    );

    addSheet(workbook, "Client Payments",
      [
        { header: "Date", key: "paymentDate", width: 12 },
        { header: "Project", key: "projectName", width: 22 },
        { header: "Amount", key: "amount", width: 12 },
        { header: "Method", key: "method", width: 14 },
        { header: "Reference", key: "reference", width: 16 },
        { header: "Notes", key: "notes", width: 26 }
      ],
      payments.map((p) => ({
        paymentDate: p.paymentDate, projectName: projectName(p.projectId), amount: Number(p.amount) || 0,
        method: p.method, reference: p.reference, notes: p.notes
      }))
    );

    addSheet(workbook, "Payroll Payments",
      [
        { header: "Date", key: "paymentDate", width: 12 },
        { header: "Employee", key: "employeeName", width: 20 },
        { header: "Amount", key: "amount", width: 12 },
        { header: "Method", key: "method", width: 14 },
        { header: "Notes", key: "notes", width: 26 }
      ],
      wagePayments.map((p) => ({
        paymentDate: p.paymentDate, employeeName: employeeName(p.employeeId), amount: Number(p.amount) || 0,
        method: p.method, notes: p.notes
      }))
    );

    addSheet(workbook, "Change Orders",
      [
        { header: "Project", key: "projectName", width: 22 },
        { header: "CO #", key: "orderNo", width: 10 },
        { header: "Date", key: "orderDate", width: 12 },
        { header: "Title", key: "title", width: 24 },
        { header: "Amount", key: "amount", width: 12 },
        { header: "Status", key: "status", width: 12 },
        { header: "Approved date", key: "approvedDate", width: 14 },
        { header: "Client", key: "clientName", width: 18 },
        { header: "Notes", key: "notes", width: 26 }
      ],
      changeOrders.map((c) => ({
        projectName: projectName(c.projectId), orderNo: c.orderNo, orderDate: c.orderDate, title: c.title,
        amount: computeItemsTotal(c.items), status: c.status, approvedDate: c.approvedDate,
        clientName: c.clientName, notes: c.notes
      }))
    );

    addSheet(workbook, "Quotes-Contracts",
      [
        { header: "Project", key: "projectName", width: 22 },
        { header: "Quote #", key: "quoteNo", width: 12 },
        { header: "Date", key: "quoteDate", width: 12 },
        { header: "Client", key: "clientName", width: 18 },
        { header: "Address", key: "address", width: 26 },
        { header: "Total", key: "total", width: 14 },
        { header: "Status", key: "status", width: 12 }
      ],
      quotes.map((q) => ({
        projectName: projectName(q.projectId), quoteNo: q.quoteNo, quoteDate: q.quoteDate,
        clientName: q.clientName, address: q.address, total: computeItemsTotal(q.items), status: q.status
      }))
    );

    addSheet(workbook, "Inspections",
      [
        { header: "Project", key: "projectName", width: 22 },
        { header: "Inspection", key: "name", width: 22 },
        { header: "Department", key: "department", width: 20 },
        { header: "Date", key: "inspectionDate", width: 12 },
        { header: "Status", key: "status", width: 12 },
        { header: "Notes", key: "notes", width: 26 }
      ],
      stages.map((s) => ({
        projectName: projectName(s.projectId), name: s.name, department: s.department,
        inspectionDate: s.inspectionDate, status: s.status, notes: s.notes
      }))
    );

    const filename = "las-casita-export-" + new Date().toISOString().slice(0, 10) + ".xlsx";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

module.exports = router;
