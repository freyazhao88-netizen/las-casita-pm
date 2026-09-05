"use strict";
require("dotenv").config();
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — check app/.env");
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket }
});

const TABLES = {
  employees: "employees",
  projects: "projects",
  attendance: "attendance",
  materials: "materials",
  stages: "stages",
  quotes: "quotes"
};

const DEFAULT_STAGE_SUGGESTIONS = [
  "Demolition", "Foundation", "Framing", "Rough Electrical", "Rough Plumbing",
  "Rough Mechanical (HVAC)", "Framing Inspection", "Insulation", "Stucco",
  "Roofing", "Drywall", "Paint", "Flooring", "Tile", "Bathroom", "Kitchen",
  "Final Inspection"
];

const CATEGORY_LIBRARY = [
  "Demolition", "Foundation", "Framing", "Mechanical (HVAC)", "Electrical", "Plumbing", "Roofing",
  "Interior Doors", "Exterior Doors", "Windows", "Insulation", "Drywall", "Stucco", "Texture", "Paint",
  "Flooring", "Tile", "Cabinets", "Countertop", "Bath Vanities", "Bathroom", "Kitchen",
  "Moulding / Baseboard", "Stair Railing", "Closet / Pantry", "Waterproofing", "Hardware",
  "Driveway / Concrete", "Porch", "Laundry Cabinet"
];

function camelToSnake(s) { return s.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase()); }
function snakeToCamel(s) { return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase()); }

function toSnakeObj(obj) {
  const out = {};
  Object.keys(obj).forEach((k) => { out[camelToSnake(k)] = obj[k]; });
  return out;
}
function toCamelObj(obj) {
  if (!obj) return obj;
  const out = {};
  Object.keys(obj).forEach((k) => { out[snakeToCamel(k)] = obj[k]; });
  return out;
}
function toCamelArr(arr) { return (arr || []).map(toCamelObj); }

function check(error) {
  if (error) { const e = new Error(error.message); e.cause = error; throw e; }
}

async function all(collection) {
  const { data, error } = await supabase.from(TABLES[collection]).select("*");
  check(error);
  return toCamelArr(data);
}

async function find(collection, id) {
  const { data, error } = await supabase.from(TABLES[collection]).select("*").eq("id", Number(id)).maybeSingle();
  check(error);
  return toCamelObj(data);
}

async function insert(collection, record) {
  const { data, error } = await supabase.from(TABLES[collection]).insert(toSnakeObj(record)).select().single();
  check(error);
  return toCamelObj(data);
}

async function update(collection, id, patch) {
  const { data, error } = await supabase.from(TABLES[collection]).update(toSnakeObj(patch)).eq("id", Number(id)).select().maybeSingle();
  check(error);
  return toCamelObj(data);
}

async function remove(collection, id) {
  const { error, data } = await supabase.from(TABLES[collection]).delete().eq("id", Number(id)).select();
  check(error);
  return !!(data && data.length);
}

async function removeWhere(collection, column, value) {
  const { error } = await supabase.from(TABLES[collection]).delete().eq(camelToSnake(column), value);
  check(error);
}

let settingsCache = null;

async function getSettings() {
  if (settingsCache) return settingsCache;
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  check(error);
  if (data) { settingsCache = toCamelObj(data); return settingsCache; }

  const defaults = {
    id: 1,
    company_name: "Las Casita Inc.",
    company_addr1: "1700 W Cameron Ave #212",
    company_addr2: "West Covina, CA 91790",
    company_email: "lascasitainc@gmail.com",
    contact1: "Owen (626) 869-8008",
    contact2: "LV (626) 566-5266"
  };
  const { data: inserted, error: insertError } = await supabase.from("settings").insert(defaults).select().single();
  check(insertError);
  settingsCache = toCamelObj(inserted);
  return settingsCache;
}

async function updateSettings(patch) {
  const { data, error } = await supabase.from("settings").update(toSnakeObj(patch)).eq("id", 1).select().single();
  check(error);
  settingsCache = toCamelObj(data);
  return settingsCache;
}

module.exports = {
  supabase,
  all, find, insert, update, remove, removeWhere,
  getSettings, updateSettings,
  DEFAULT_STAGE_SUGGESTIONS, CATEGORY_LIBRARY
};
