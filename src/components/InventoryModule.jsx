// src/components/InventoryModule.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import RefreshIcon from "@mui/icons-material/Refresh";
import CalculateIcon from "@mui/icons-material/Calculate";
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";
import HistoryIcon from "@mui/icons-material/History";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SaveIcon from "@mui/icons-material/Save";

const cornflowerBlue = "#6495ED";
const fontFamily = "Montserrat, sans-serif";

const INVENTORY_API_URL =
  "https://script.google.com/macros/s/AKfycbzEkxzsVYQWMdI7CmleY53U-O4C58b92wlCZnISqtv11L2YLcaRuiB0WGHWW1HlpsoG/exec";

const BOOKING_HOLD_DAYS = 2;
const JSONP_TIMEOUT_MS = 60000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STATUS_PENDING_REVIEW = "Pending Review";
const STATUS_HOLD = "Hold";
const STATUS_APPROVED = "Approved";
const STATUS_DECLINED = "Declined";
const STATUS_RELEASED = "Released";
const STATUS_DISPATCHED = "Dispatched";

const safeStr = (v) => (v ?? "").toString().trim();
const toUpper = (v) => safeStr(v).toUpperCase();
const normalizeKey = (v) => safeStr(v).replace(/\s+/g, " ").trim().toUpperCase();
const asNum = (v) => {
  const n = Number(typeof v === "string" ? v.replace(/,/g, "") : v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(asNum(n) * 100) / 100;

function normalizeStatus(value) {
  return normalizeKey(value || STATUS_PENDING_REVIEW);
}

function isReleasedStatus(status) {
  return [
    normalizeKey(STATUS_DECLINED),
    normalizeKey(STATUS_RELEASED),
    "CANCELLED",
    "CANCELED",
  ].includes(normalizeStatus(status));
}

function isReservedStatus(status) {
  return [normalizeKey(STATUS_HOLD), normalizeKey(STATUS_APPROVED)].includes(
    normalizeStatus(status)
  );
}

function parseBookingDate(value) {
  const raw = safeStr(value);
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const parts = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!parts) return null;

  const [, dd, mm, yyyy, hh = "0", min = "0", sec = "0"] = parts;
  const fullYear = yyyy.length === 2 ? `20${yyyy}` : yyyy;
  const parsed = new Date(
    Number(fullYear),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min),
    Number(sec)
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pickFirst(row, keys = []) {
  for (const key of keys) {
    const val = row?.[key];
    if (safeStr(val) !== "") return val;
  }
  return "";
}

function getSkuCode(row) {
  return safeStr(pickFirst(row, ["SKU Code", "skuCode", "SKU", "Sku Code"]));
}

function getStockLocation(row) {
  return safeStr(
    pickFirst(row, [
      "location",
      "Location",
      "stockLocation",
      "Stock Location",
      "Stock Available At",
      "Stock available at",
    ])
  );
}

function normalizeSkuRow(row) {
  const skuCode = getSkuCode(row);
  const category = safeStr(pickFirst(row, ["Category", "category"]));
  const materialName = safeStr(pickFirst(row, ["Material Name", "materialName", "Material"]));
  const variant = safeStr(pickFirst(row, ["Variant", "variant", "Color Variant", "colorVariant"]));

  if (!skuCode && !materialName && !variant) return null;

  return {
    skuCode,
    category,
    materialName,
    variant,
    label: [skuCode, materialName, variant].filter(Boolean).join(" | "),
  };
}

function getBookingHoldInfo(booking) {
  const explicitExpiry = parseBookingDate(
    pickFirst(booking, [
      "Hold Expiry",
      "Hold Expires At",
      "holdExpiresAt",
      "holdExpiry",
      "Reservation Expiry",
    ])
  );

  const createdAt = parseBookingDate(
    pickFirst(booking, ["timestamp", "Timestamp", "Created At", "createdAt"])
  );

  const expiresAt = explicitExpiry ||
    (createdAt ? new Date(createdAt.getTime() + BOOKING_HOLD_DAYS * MS_PER_DAY) : null);

  if (!expiresAt) {
    return {
      createdAt,
      expiresAt: null,
      isExpired: false,
      daysRemaining: null,
    };
  }

  const msRemaining = expiresAt.getTime() - Date.now();

  return {
    createdAt,
    expiresAt,
    isExpired: msRemaining <= 0,
    daysRemaining: Math.max(0, Math.ceil(msRemaining / MS_PER_DAY)),
  };
}

function getUserFromLocalStorage() {
  try {
    const raw = localStorage.getItem("crmUser");
    if (!raw) return { username: "", role: "" };

    const parsed = JSON.parse(raw);
    return {
      username: parsed?.loginUsername || parsed?.username || parsed?.name || "",
      role: parsed?.role || "",
    };
  } catch {
    return { username: "", role: "" };
  }
}

function formatDisplayDate(value) {
  const raw = safeStr(value);
  if (!raw) return "";

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  return d.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isChildItemRow(row) {
  return safeStr(row?.["Row Type"]).toUpperCase() === "CHILD";
}

function mapRowToChildItem(row) {
  if (!isChildItemRow(row)) return null;

  const selectedPackSize = asNum(
    pickFirst(row, ["Selected Pack Size", "selectedPackSize", "Pack Size", "packSize"])
  );
  const allocatedPackQty = asNum(
    pickFirst(row, ["Allocated Pack Qty", "allocatedPackQty", "Packs Needed", "packsNeeded"])
  );
  const mappedStockQty = asNum(
    pickFirst(row, ["Mapped Stock Qty", "mappedStockQty", "Packaging Qty", "packagingQty"])
  );
  const allocatedLooseQty = asNum(pickFirst(row, ["Allocated Loose Qty", "allocatedLooseQty"]));
  const itemStatus = pickFirst(row, ["Item Status", "itemStatus", "Status", "status"]);

  return {
    skuCode: getSkuCode(row),
    materialName: pickFirst(row, ["Material Name", "materialName", "Item Name", "itemName", "Material"]),
    variant: pickFirst(row, ["Variant", "variant", "Color Variant", "colorVariant"]),
    allocatedArea: asNum(pickFirst(row, ["Allocated Area", "allocatedArea", "Color Area", "colorArea"])),
    unit: pickFirst(row, ["Unit", "unit"]),
    requiredQty: asNum(pickFirst(row, ["Required Qty", "requiredQty", "Requirement Qty", "Qty Required"])),
    selectedPackSize,
    allocatedPackQty,
    allocatedLooseQty,
    mappedStockQty,
    packSize: selectedPackSize,
    packsNeeded: allocatedPackQty,
    packagingQty: mappedStockQty,
    reservedQty: asNum(pickFirst(row, ["Reserved Qty", "reservedQty"])),
    dispatchedQty: asNum(pickFirst(row, ["Dispatched Qty", "dispatchedQty"])),
    availableTotalQty: asNum(
      pickFirst(row, ["Available Total Qty", "availableTotalQty", "Available Qty", "availableQty"])
    ),
    shortageQty: asNum(pickFirst(row, ["Shortage Qty", "shortageQty"])),
    canFulfill: toUpper(pickFirst(row, ["Can Fulfill", "canFulfill"])) === "YES",
    itemStatus,
    status: itemStatus,
  };
}

function getAllocationKey(item, index) {
  return `${index}__${normalizeKey(item?.skuCode || item?.materialName)}`;
}

function getColorOptionKey(option) {
  if (typeof option === "object" && option) {
    return normalizeKey(option.skuCode || option.variant || option.label || option.materialName);
  }

  return normalizeKey(option);
}

function getColorOptionLabel(option) {
  if (typeof option === "object" && option) {
    return safeStr(option.label || option.variant || option.skuCode || option.materialName || "Color");
  }

  return safeStr(option || "Color");
}

function isAcrylicColorMaterial(materialName) {
  const n = normalizeKey(materialName);
  return (
    n === "COLOR" ||
    n === "COLOUR" ||
    n === "ACRYLIC COLOR" ||
    n === "ACRYLIC COLOUR" ||
    n.includes("ACRYLIC COLOR") ||
    n.includes("ACRYLIC COLOUR")
  );
}

function shouldUseAcrylicColorSelection(category, materialName) {
  return toUpper(category) === "ACRYLIC" && isAcrylicColorMaterial(materialName);
}

function getStockMaterialName(row) {
  return pickFirst(row, ["materialName", "Material Name", "Item Name", "itemName", "Material"]);
}

function getStockVariant(row) {
  return pickFirst(row, ["variant", "Variant", "Color Variant", "colorVariant"]);
}

function getStockKey(row) {
  const skuCode = getSkuCode(row);
  if (skuCode) return normalizeKey(skuCode);

  const materialName = getStockMaterialName(row);
  const variant = getStockVariant(row);
  return normalizeKey([materialName, variant].filter(Boolean).join("__"));
}

function mergeStockRows(rows = []) {
  const grouped = {};

  rows.forEach((row) => {
    const key = getStockKey(row);
    if (!key) return;

    const current =
      grouped[key] ||
      {
        ...row,
        locations: [],
        packagedStockQty: 0,
        looseStockQty: 0,
        reservedPackagedQty: 0,
        reservedLooseQty: 0,
        availablePackagedQty: 0,
        availableLooseQty: 0,
      };

    const stockInfo = getStockAvailability(row);
    const location = getStockLocation(row);

    current.packagedStockQty = round2(
      asNum(current.packagedStockQty) + asNum(pickFirst(row, ["packagedStockQty", "Packaged Stock Qty"]))
    );
    current.looseStockQty = round2(
      asNum(current.looseStockQty) + asNum(pickFirst(row, ["looseStockQty", "Loose Stock Qty"]))
    );
    current.reservedPackagedQty = round2(
      asNum(current.reservedPackagedQty) + asNum(pickFirst(row, ["reservedPackagedQty", "Reserved Packaged Qty"]))
    );
    current.reservedLooseQty = round2(
      asNum(current.reservedLooseQty) + asNum(pickFirst(row, ["reservedLooseQty", "Reserved Loose Qty"]))
    );
    current.availablePackagedQty = round2(
      asNum(current.availablePackagedQty) + stockInfo.availablePackagedQty
    );
    current.availableLooseQty = round2(
      asNum(current.availableLooseQty) + stockInfo.availableLooseQty
    );
    current.availableTotalQty = round2(
      asNum(current.availablePackagedQty) + asNum(current.availableLooseQty)
    );

    if (location) {
      current.locations.push({
        location,
        availableTotalQty: stockInfo.availableTotalQty,
      });
    }

    grouped[key] = current;
  });

  return grouped;
}

function getStockAvailability(row) {
  if (!row) {
    return {
      packSize: 0,
      availablePackagedQty: 0,
      availableLooseQty: 0,
      availableTotalQty: 0,
    };
  }

  const packSize = asNum(pickFirst(row, ["packSize", "Pack Size", "Package Size"]));
  const availablePackagedRaw = pickFirst(row, ["availablePackagedQty", "Available Packaged Qty"]);
  const availableLooseRaw = pickFirst(row, ["availableLooseQty", "Available Loose Qty"]);

  const hasExplicitAvailable =
    safeStr(availablePackagedRaw) !== "" || safeStr(availableLooseRaw) !== "";

  if (hasExplicitAvailable) {
    const availablePackagedQty = Math.max(0, asNum(availablePackagedRaw));
    const availableLooseQty = Math.max(0, asNum(availableLooseRaw));
    return {
      packSize,
      availablePackagedQty: round2(availablePackagedQty),
      availableLooseQty: round2(availableLooseQty),
      availableTotalQty: round2(availablePackagedQty + availableLooseQty),
    };
  }

  const packaged = asNum(pickFirst(row, ["packagedStockQty", "Packaged Stock Qty"]));
  const loose = asNum(pickFirst(row, ["looseStockQty", "Loose Stock Qty"]));
  const resPack = asNum(pickFirst(row, ["reservedPackagedQty", "Reserved Packaged Qty"]));
  const resLoose = asNum(pickFirst(row, ["reservedLooseQty", "Reserved Loose Qty"]));

  const availablePackagedQty = Math.max(0, packaged - resPack);
  const availableLooseQty = Math.max(0, loose - resLoose);

  return {
    packSize,
    availablePackagedQty: round2(availablePackagedQty),
    availableLooseQty: round2(availableLooseQty),
    availableTotalQty: round2(availablePackagedQty + availableLooseQty),
  };
}

function normalizeValidationList(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function deriveAllocationFromPackSize(requiredQty, packSize) {
  const required = asNum(requiredQty);
  const size = asNum(packSize);
  if (required <= 0 || size <= 0) {
    return {
      allocatedPackQty: 0,
      allocatedLooseQty: required,
      mappedStockQty: required,
      shortageQty: 0,
    };
  }

  const allocatedPackQty = Math.floor(required / size);
  const allocatedLooseQty = round2(required - allocatedPackQty * size);
  const mappedStockQty = round2(allocatedPackQty * size + allocatedLooseQty);

  return {
    allocatedPackQty,
    allocatedLooseQty,
    mappedStockQty,
    shortageQty: round2(Math.max(0, required - mappedStockQty)),
  };
}

function groupBookingsForSummary(rows = []) {
  const grouped = new Map();

  rows.forEach((row, idx) => {
    const bookingId =
      safeStr(pickFirst(row, ["Booking ID", "bookingId", "BookingId"])) || `ROW_${idx + 1}`;

    if (!grouped.has(bookingId)) {
      grouped.set(bookingId, {
        bookingId,
        timestamp: pickFirst(row, ["Timestamp", "timestamp", "Created At"]),
        requestedBy: pickFirst(row, ["Requested By", "requestedBy", "Created By"]),
        category: pickFirst(row, ["Category", "category"]),
        variant: pickFirst(row, ["Variant / Base Type", "variant", "Variant"]),
        status: pickFirst(row, ["Status", "status", "Booking Status"]),
        holdExpiresAt: pickFirst(row, ["Hold Expiry", "Hold Expires At", "holdExpiresAt", "holdExpiry"]),
        remarks: pickFirst(row, ["Remarks", "remarks"]),
        rows: [],
        childItems: [],
      });
    }

    const group = grouped.get(bookingId);
    group.rows.push(row);

    if (safeStr(row?.["Row Type"]).toUpperCase() === "PARENT") {
      group.timestamp = pickFirst(row, ["Timestamp", "timestamp", "Created At"]) || group.timestamp;
      group.requestedBy = pickFirst(row, ["Requested By", "requestedBy", "Created By"]) || group.requestedBy;
      group.category = pickFirst(row, ["Category", "category"]) || group.category;
      group.variant = pickFirst(row, ["Variant / Base Type", "variant", "Variant"]) || group.variant;
      group.status = pickFirst(row, ["Status", "status", "Booking Status"]) || group.status;
      group.holdExpiresAt = pickFirst(row, ["Hold Expiry", "Hold Expires At", "holdExpiresAt", "holdExpiry"]) || group.holdExpiresAt;
      group.remarks = pickFirst(row, ["Remarks", "remarks"]) || group.remarks;
    }

    const item = mapRowToChildItem(row);
    if (item) group.childItems.push(item);
  });

  return Array.from(grouped.values()).map((g) => {
    const parentRow =
      g.rows.find((row) => safeStr(row?.["Row Type"]).toUpperCase() === "PARENT") || null;

    const totalItems = g.childItems.length;

    const totalRequiredQty = parentRow
      ? round2(asNum(parentRow["Total Required Qty"]))
      : round2(g.childItems.reduce((sum, item) => sum + asNum(item.requiredQty), 0));

    const totalShortageQty = parentRow
      ? round2(asNum(parentRow["Shortage Qty"]))
      : round2(g.childItems.reduce((sum, item) => sum + asNum(item.shortageQty), 0));

    return {
      ...g,
      totalItems,
      totalRequiredQty,
      totalShortageQty,
    };
  });
}

let jsonpQueue = Promise.resolve();

function enqueueJsonp(task) {
  const next = jsonpQueue.catch(() => {}).then(task);
  jsonpQueue = next.catch(() => {});
  return next;
}

function jsonp(url, timeoutMs = JSONP_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const cb = `cb_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement("script");

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("JSONP timeout"));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      try {
        delete window[cb];
      } catch {
        window[cb] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };

    const sep = url.includes("?") ? "&" : "?";
    script.src = `${url}${sep}callback=${encodeURIComponent(cb)}`;
    script.async = true;

    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP load failed"));
    };

    document.body.appendChild(script);
  });
}

async function apiGet(apiUrl, params) {
  const qs = new URLSearchParams({
    ...params,
    _: String(Date.now()),
  });
  const payload = await enqueueJsonp(() => jsonp(`${apiUrl}?${qs.toString()}`));
  if (!payload?.ok) throw new Error(payload?.error || "Request failed");
  return payload.data;
}

async function apiPostNoCors(apiUrl, body) {
  await fetch(apiUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function apiMutation(apiUrl, body) {
  const payload = await enqueueJsonp(() =>
    jsonp(
      `${apiUrl}?action=mutation&payload=${encodeURIComponent(JSON.stringify(body))}&_=${Date.now()}`
    )
  );
  if (!payload?.ok) throw new Error(payload?.error || "Request failed");
  return payload.data;
}

function evalRate(expr) {
  if (!expr) return 0;
  const cleaned = String(expr).replace(/[^0-9+\-*/(). ]/g, "");

  try {
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${cleaned});`)();
    return asNum(val);
  } catch {
    return 0;
  }
}

function buildAliasMap(computedByMaterialName) {
  const out = {
    Area: 0,
    SBR: 0,
    Color: 0,
    Resurfacer: 0,
    Cushion: 0,
    EPDM: 0,
  };

  Object.entries(computedByMaterialName).forEach(([name, qty]) => {
    const n = toUpper(name);

    if (n === "SBR") out.SBR = qty;
    if (n.includes("SBR/R GRADE")) out.SBR = qty;
    if (n === "COLOR" || n.includes("ACRYLIC COLOR")) out.Color = qty;
    if (n.includes("RESURFACER")) out.Resurfacer = qty;
    if (n.includes("CUSHION")) out.Cushion = qty;
    if (n.includes("EPDM GRANULE")) out.EPDM = qty;
  });

  return out;
}

function evalFormula(formula, area, computedByMaterialName) {
  if (!formula) return 0;

  const aliases = buildAliasMap(computedByMaterialName);
  aliases.Area = area;

  let expr = String(formula);
  Object.keys(aliases).forEach((k) => {
    expr = expr.replace(new RegExp(`\\b${k}\\b`, "g"), String(aliases[k]));
  });

  const cleaned = expr.replace(/[^0-9+\-*/(). ]/g, "");

  try {
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${cleaned});`)();
    return asNum(val);
  } catch {
    return 0;
  }
}

function computeLocally({ category, variant, inputs, configRows, stockRows }) {
  const cat = toUpper(category);
  const varr = toUpper(variant);

  const area = cat === "PU" ? asNum(inputs.areaSqm || 0) : asNum(inputs.areaSqf || 0);
  const wearCoatType = toUpper(inputs.wearCoatType || "SD");

  const stockMap = {};
  const mergedStock = mergeStockRows(stockRows || []);
  Object.values(mergedStock).forEach((s) => {
    const skuKey = getSkuCode(s) ? normalizeKey(getSkuCode(s)) : "";
    const materialKey = normalizeKey(getStockMaterialName(s));
    const variantKey = normalizeKey([getStockMaterialName(s), getStockVariant(s)].filter(Boolean).join("__"));
    if (skuKey) stockMap[skuKey] = s;
    if (variantKey) stockMap[variantKey] = s;
    if (materialKey && !stockMap[materialKey]) stockMap[materialKey] = s;
  });

  const computed = {};
  const items = [];

  const filteredCfg = (configRows || []).filter(
    (r) =>
      toUpper(r.category) === cat &&
      toUpper(r.variant) === varr &&
      toUpper(r.active) !== "FALSE"
  );

  filteredCfg.forEach((row) => {
    if (row.calcType === "FORMULA") return;

    if (row.calcType === "AREA_X_RATE_IF") {
      const should = toUpper(row.formula || "");
      if (should && should !== wearCoatType) return;
    }

    let qty = 0;

    if (row.calcType === "AREA_X_RATE" || row.calcType === "AREA_X_RATE_IF") {
      qty = area * evalRate(row.baseRate);
    } else if (row.calcType === "AREA_X_LAYER") {
      const mult = asNum(inputs[row.inputKey] || 0);
      qty = area * evalRate(row.baseRate) * mult;
    } else if (row.calcType === "AREA_X_THICKNESS_RATE") {
      const thick = asNum(inputs[row.inputKey] || 0);
      qty = area * evalRate(row.baseRate) * thick;
    } else if (row.calcType === "AREA_X_FIXED") {
      qty = area * evalRate(row.baseRate);
    } else {
      return;
    }

    qty = round2(qty);
    computed[row.materialName] = qty;

    items.push({
      materialName: row.materialName,
      unit: row.unit,
      requiredQty: qty,
      calcType: row.calcType,
    });
  });

  filteredCfg
    .filter((r) => r.calcType === "FORMULA")
    .forEach((row) => {
      const qty = round2(evalFormula(row.formula, area, computed));
      computed[row.materialName] = qty;

      items.push({
        materialName: row.materialName,
        unit: row.unit,
        requiredQty: qty,
        calcType: "FORMULA",
        formula: row.formula,
      });
    });

  const withStock = items.map((it) => {
    const materialKey = normalizeKey(it.materialName);
    const s = stockMap[materialKey];

    const packSize = s ? asNum(s.packSize) : 0;
    const packaged = s ? asNum(s.packagedStockQty) : 0;
    const loose = s ? asNum(s.looseStockQty) : 0;
    const resPack = s ? asNum(s.reservedPackagedQty) : 0;
    const resLoose = s ? asNum(s.reservedLooseQty) : 0;

    const availablePackagedQty = Math.max(0, packaged - resPack);
    const availableLooseQty = Math.max(0, loose - resLoose);
    const availableTotalQty = availablePackagedQty + availableLooseQty;
    const shortageQty = Math.max(0, asNum(it.requiredQty) - availableTotalQty);

    const estimatedPacksNeeded = packSize > 0 ? Math.ceil(it.requiredQty / packSize) : 0;
    const estimatedPackagingQty = packSize > 0 ? estimatedPacksNeeded * packSize : 0;

    return {
      ...it,
      packSize,
      estimatedPacksNeeded,
      estimatedPackagingQty: round2(estimatedPackagingQty),
      availablePackagedQty: round2(availablePackagedQty),
      availableLooseQty: round2(availableLooseQty),
      availableTotalQty: round2(availableTotalQty),
      shortageQty: round2(shortageQty),
      canFulfill: shortageQty <= 0,
    };
  });

  return { category: cat, variant: varr, area, wearCoatType, items: withStock };
}

export default function InventoryModule({
  apiUrl = INVENTORY_API_URL,
  logoSrc = "/assets/kk-logo.png",
  title = "Inventory Calculator",
}) {
  const user = useMemo(() => getUserFromLocalStorage(), []);

  const [validation, setValidation] = useState({});
  const [validationLoading, setValidationLoading] = useState(false);

  const [category, setCategory] = useState("ACRYLIC");
  const [variant, setVariant] = useState("");

  const [inputDefs, setInputDefs] = useState([]);
  const [inputs, setInputs] = useState({});
  const [inputsLoading, setInputsLoading] = useState(false);

  const [configRows, setConfigRows] = useState([]);
  const [configLoading, setConfigLoading] = useState(false);

  const [stockRows, setStockRows] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [skuRows, setSkuRows] = useState([]);

  const [calcResult, setCalcResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [selectedAcrylicColors, setSelectedAcrylicColors] = useState({});
  const [selectedColorAreas, setSelectedColorAreas] = useState({});

  const [remarks, setRemarks] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingNotice, setBookingNotice] = useState("");

  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");

  const [bookingDetailOpen, setBookingDetailOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedBookingStatus, setSelectedBookingStatus] = useState("");
  const [bookingAllocations, setBookingAllocations] = useState({});
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState("");

  const isAdmin = toUpper(user?.role) === "ADMIN";

  const variantsList = useMemo(() => {
    const acrylicVariants =
      validation?.["Acrylic Sub Base"] ||
      validation?.["Acrylic Variants"] ||
      validation?.["Acrylic"] ||
      [];

    const puVariants =
      validation?.["PU Type"] ||
      validation?.["PU Variants"] ||
      validation?.["PU"] ||
      [];

    return toUpper(category) === "PU" ? puVariants : acrylicVariants;
  }, [validation, category]);

  const bookingStatusOptions = useMemo(() => {
    const raw =
      validation?.["Booking Status"] ||
      validation?.["booking status"] ||
      validation?.["Booking status"] ||
      validation?.["Status"] ||
      [];

    const fromValidation = Array.from(
      new Set(
        (raw || [])
          .flatMap((v) => safeStr(v).split(/[|,]/))
          .map((v) => safeStr(v))
          .filter(Boolean)
      )
    );

    return fromValidation.length
      ? fromValidation
      : [
          STATUS_PENDING_REVIEW,
          STATUS_HOLD,
          STATUS_APPROVED,
          STATUS_DECLINED,
          STATUS_RELEASED,
          STATUS_DISPATCHED,
        ];
  }, [validation]);

  const approvedPackSizes = useMemo(() => {
    const raw =
      validation?.["Approved Pack Sizes"] ||
      validation?.["Approved Package Sizes"] ||
      validation?.["Pack Sizes"] ||
      validation?.["Package Sizes"] ||
      [];

    return Array.from(
      new Set(
        normalizeValidationList(raw)
          .flatMap((v) => safeStr(v).split(/[|,]/))
          .map((v) => asNum(v))
          .filter((n) => n > 0)
      )
    ).sort((a, b) => a - b);
  }, [validation]);

  const acrylicColorOptions = useMemo(() => {
    const fromSku = (skuRows || [])
      .filter((row) => {
        const categoryKey = normalizeKey(row.category);
        return (
          categoryKey === "ACRYLIC" &&
          normalizeKey(row.materialName) === "COLOR" &&
          safeStr(row.variant)
        );
      })
      .map((row) => ({
        skuCode: row.skuCode,
        materialName: row.materialName || "Color",
        variant: row.variant,
        label: row.variant,
      }));

    const validationEntries = Object.entries(validation || {})
      .filter(([key]) => isAcrylicColorMaterial(key))
      .flatMap(([, value]) => normalizeValidationList(value));

    const fromValidation = validationEntries
      .flatMap((v) => safeStr(v).split(/[|,]/))
      .map((v) => safeStr(v))
      .filter(Boolean);

    const fromStock = (stockRows || [])
      .filter((row) => {
        const materialName = getStockMaterialName(row);
        const skuCode = getSkuCode(row);
        return isAcrylicColorMaterial(materialName) || normalizeKey(skuCode).startsWith("ACR-COLOR-");
      })
      .map((row) => {
        const variantName = safeStr(getStockVariant(row));
        return variantName || getStockMaterialName(row);
      })
      .filter(Boolean);

    const seen = new Set();
    return [
      ...fromSku,
      ...fromValidation.map((name) => ({
        skuCode: "",
        materialName: "Color",
        variant: name,
        label: name,
      })),
      ...fromStock.map((name) => ({
        skuCode: "",
        materialName: "Color",
        variant: name,
        label: name,
      })),
    ].filter((option) => {
      const key = normalizeKey(option.skuCode || option.variant || option.label);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [skuRows, validation, stockRows]);

  const stockByMaterial = useMemo(() => {
    const out = mergeStockRows(stockRows || []);

    Object.values(out).forEach((row) => {
      const materialKey = normalizeKey(getStockMaterialName(row));
      const variantKey = normalizeKey(getStockVariant(row));
      const combinedKey = normalizeKey([getStockMaterialName(row), getStockVariant(row)].filter(Boolean).join("__"));
      if (materialKey && !out[materialKey]) out[materialKey] = row;
      if (variantKey && !out[variantKey]) out[variantKey] = row;
      if (combinedKey && !out[combinedKey]) out[combinedKey] = row;
    });

    return out;
  }, [stockRows]);

  const bookingSummaryRows = useMemo(() => {
    return groupBookingsForSummary(bookings || []);
  }, [bookings]);

  const selectedParentRow = useMemo(() => {
    if (!selectedBooking?.rows?.length) return null;
    return (
      selectedBooking.rows.find(
        (row) => safeStr(row["Row Type"]).toUpperCase() === "PARENT"
      ) || null
    );
  }, [selectedBooking]);

  const selectedInputsJson = useMemo(() => {
    if (!selectedParentRow) return "";
    return safeStr(selectedParentRow["Inputs JSON"] || selectedParentRow["inputsJson"]);
  }, [selectedParentRow]);

  const selectedBookingHoldInfo = useMemo(
    () => getBookingHoldInfo(selectedBooking || {}),
    [selectedBooking]
  );

  const normalizedInputs = useMemo(() => {
    const out = { ...(inputs || {}) };

    (inputDefs || []).forEach((d) => {
      const key = d.inputKey;
      if (!key) return;

      if (key === "wearCoatType") {
        out[key] = safeStr(out[key] || "SD");
        return;
      }

      const val = out[key];
      if (val === "" || val == null) {
        out[key] = 0;
      } else {
        const n = Number(val);
        out[key] = Number.isFinite(n) ? n : val;
      }
    });

    return out;
  }, [inputs, inputDefs]);

  const calcDisplayItems = useMemo(() => {
    return (calcResult?.items || []).map((it, index) => {
      const requiresAcrylicColor = shouldUseAcrylicColorSelection(category, it.materialName);
      const colorKey = getAllocationKey(it, index);
      const selectedOptions = requiresAcrylicColor
        ? selectedAcrylicColors[colorKey] || []
        : [];

      if (!requiresAcrylicColor || !acrylicColorOptions.length) {
        return {
          ...it,
          colorKey,
          requiresAcrylicColor,
          selectedMaterialName: it.materialName,
        };
      }

      const selectedColorOptions = selectedOptions
        .map((value) => {
          if (typeof value === "object" && value) return value;
          return acrylicColorOptions.find(
            (opt) =>
              normalizeKey(opt.skuCode) === normalizeKey(value) ||
              normalizeKey(opt.variant) === normalizeKey(value) ||
              normalizeKey(opt.label) === normalizeKey(value)
          );
        })
        .filter(Boolean);

      const totalAllocatedArea = selectedColorOptions.reduce((sum, option) => {
        const areaKey = `${colorKey}__${getColorOptionKey(option)}`;
        return sum + asNum(selectedColorAreas[areaKey]);
      }, 0);

      const colorBreakup = selectedColorOptions.map((option) => {
        const optionKey = getColorOptionKey(option);
        const areaKey = `${colorKey}__${optionKey}`;
        const allocatedArea = asNum(selectedColorAreas[areaKey]);
        const requiredQty =
          totalAllocatedArea > 0
            ? round2(asNum(it.requiredQty) * (allocatedArea / totalAllocatedArea))
            : 0;
        const stockRow =
          stockByMaterial[normalizeKey(option.skuCode)] ||
          stockByMaterial[normalizeKey(option.variant)] ||
          stockByMaterial[normalizeKey([option.materialName, option.variant].filter(Boolean).join("__"))] ||
          null;
        const stockInfo = getStockAvailability(stockRow);
        const shortageQty = Math.max(0, requiredQty - stockInfo.availableTotalQty);

        return {
          skuCode: option.skuCode || getSkuCode(stockRow),
          materialName: option.materialName || "Color",
          variant: getColorOptionLabel(option),
          label: getColorOptionLabel(option),
          optionKey,
          areaKey,
          allocatedArea,
          requiredQty,
          packSize: stockInfo.packSize,
          estimatedPacksNeeded:
            stockInfo.packSize > 0 ? Math.ceil(requiredQty / stockInfo.packSize) : 0,
          availablePackagedQty: stockInfo.availablePackagedQty,
          availableLooseQty: stockInfo.availableLooseQty,
          availableTotalQty: stockInfo.availableTotalQty,
          shortageQty: round2(shortageQty),
          canFulfill: requiredQty > 0 && shortageQty <= 0,
        };
      });

      const availableTotalQty = colorBreakup.reduce((sum, item) => sum + asNum(item.availableTotalQty), 0);
      const shortageQty = selectedColorOptions.length
        ? colorBreakup.reduce((sum, item) => sum + asNum(item.shortageQty), 0)
        : asNum(it.requiredQty);
      const estimatedPacksNeeded = colorBreakup.reduce(
        (sum, item) => sum + asNum(item.estimatedPacksNeeded),
        0
      );

      return {
        ...it,
        colorKey,
        requiresAcrylicColor,
        selectedMaterialName: colorBreakup.map((item) => item.variant).filter(Boolean).join(", "),
        colorBreakup,
        totalAllocatedArea: round2(totalAllocatedArea),
        selectedStockFound: colorBreakup.some((item) => item.availableTotalQty > 0),
        packSize: colorBreakup.length === 1 ? colorBreakup[0].packSize : 0,
        estimatedPacksNeeded,
        estimatedPackagingQty: 0,
        availablePackagedQty: colorBreakup.reduce((sum, item) => sum + asNum(item.availablePackagedQty), 0),
        availableLooseQty: colorBreakup.reduce((sum, item) => sum + asNum(item.availableLooseQty), 0),
        availableTotalQty: round2(availableTotalQty),
        shortageQty: round2(shortageQty),
        canFulfill:
          selectedColorOptions.length > 0 &&
          totalAllocatedArea > 0 &&
          colorBreakup.every((item) => item.canFulfill),
      };
    });
  }, [calcResult, selectedAcrylicColors, selectedColorAreas, acrylicColorOptions, stockByMaterial, category]);

  const totals = useMemo(() => {
    const items = calcDisplayItems || [];
    const totalRequired = items.reduce((s, it) => s + asNum(it.requiredQty), 0);
    const totalShort = items.reduce((s, it) => s + asNum(it.shortageQty), 0);
    const allFulfillable = items.every((it) => !!it.canFulfill);

    return {
      totalRequired: round2(totalRequired),
      totalShort: round2(totalShort),
      allFulfillable,
    };
  }, [calcDisplayItems]);

  const busy =
    validationLoading ||
    inputsLoading ||
    configLoading ||
    stockLoading ||
    calcLoading ||
    bookingLoading;

  useEffect(() => {
    if (variantsList?.length && !variant) setVariant(variantsList[0]);
  }, [variantsList, variant]);

  useEffect(() => {
    const run = async () => {
      if (!apiUrl) return;
      setValidationLoading(true);

      try {
        const data = await apiGet(apiUrl, { action: "getValidation" });
        setValidation(data || {});
      } catch (e) {
        console.error("getValidation error:", e);
      } finally {
        setValidationLoading(false);
      }
    };

    run();
  }, [apiUrl]);

  useEffect(() => {
    const run = async () => {
      if (!apiUrl) return;

      try {
        const data = await apiGet(apiUrl, { action: "getSkuMaster" });
        const rows = Array.isArray(data) ? data : [];
        setSkuRows(rows.map(normalizeSkuRow).filter(Boolean));
      } catch (e) {
        console.error("getSkuMaster error:", e);
        setSkuRows([]);
      }
    };

    run();
  }, [apiUrl]);

  useEffect(() => {
    const run = async () => {
      if (!apiUrl || !category || !variant) return;

      setInputsLoading(true);
      setCalcResult(null);
      setBookingNotice("");

      try {
        const defs = await apiGet(apiUrl, { action: "getInputs", category, variant });
        const safeDefs = Array.isArray(defs) ? defs : [];
        setInputDefs(safeDefs);

        const next = {};
        safeDefs.forEach((d) => {
          if (!d.inputKey) return;
          next[d.inputKey] = d.defaultValue ?? "";
        });
        setInputs(next);
      } catch (e) {
        console.error("getInputs error:", e);
        setInputDefs([]);
        setInputs({});
      } finally {
        setInputsLoading(false);
      }
    };

    run();
  }, [apiUrl, category, variant]);

  useEffect(() => {
    const run = async () => {
      if (!apiUrl || !category || !variant) return;

      setConfigLoading(true);
      try {
        const cfg = await apiGet(apiUrl, { action: "getCalcConfig", category, variant });
        setConfigRows(Array.isArray(cfg) ? cfg : []);
      } catch (e) {
        console.error("getCalcConfig error:", e);
        setConfigRows([]);
      } finally {
        setConfigLoading(false);
      }
    };

    run();
  }, [apiUrl, category, variant]);

  async function fetchStockRows(options = {}) {
    const { silent = false } = options;
    if (!apiUrl || !category) return [];

    if (!silent) setStockLoading(true);
    try {
      const st = await apiGet(apiUrl, { action: "getStock", category });
      const rows = Array.isArray(st) ? st : [];
      setStockRows(rows);
      return rows;
    } catch (e) {
      console.error("getStock error:", e);
      setStockRows([]);
      return [];
    } finally {
      if (!silent) setStockLoading(false);
    }
  }

  useEffect(() => {
    fetchStockRows();
  }, [apiUrl, category]);

  useEffect(() => {
    if (!calcResult?.items?.length) return;

    try {
      const refreshed = computeLocally({
        category,
        variant,
        inputs: normalizedInputs,
        configRows,
        stockRows,
      });
      setCalcResult(refreshed);
    } catch (e) {
      console.error("refresh calculation after stock update error:", e);
    }
  }, [stockRows]);

  useEffect(() => {
    const items = calcResult?.items || [];
    const colorItems = items
      .map((item, index) => ({ item, index, key: getAllocationKey(item, index) }))
      .filter(({ item }) => shouldUseAcrylicColorSelection(category, item.materialName));

    if (!colorItems.length) {
      setSelectedAcrylicColors({});
      return;
    }

    setSelectedAcrylicColors((prev) => {
      const next = {};
      colorItems.forEach(({ key }) => {
        const previousList = Array.isArray(prev[key]) ? prev[key] : safeStr(prev[key]) ? [prev[key]] : [];
        const validPrevious = previousList.filter((previous) =>
          acrylicColorOptions.some(
            (opt) =>
              normalizeKey(opt.skuCode) === normalizeKey(previous?.skuCode || previous) ||
              normalizeKey(opt.variant) === normalizeKey(previous?.variant || previous) ||
              normalizeKey(opt.label) === normalizeKey(previous?.label || previous)
          )
        );
        next[key] =
          validPrevious.length > 0
            ? validPrevious
            : acrylicColorOptions.length === 1
            ? [acrylicColorOptions[0]]
            : [];
      });
      return next;
    });
  }, [calcResult, acrylicColorOptions, category]);

  useEffect(() => {
    const items = calcResult?.items || [];
    const fullArea = asNum(calcResult?.area || normalizedInputs.areaSqf || normalizedInputs.areaSqm);
    if (!fullArea) return;

    setSelectedColorAreas((prev) => {
      let changed = false;
      const next = { ...prev };

      items.forEach((item, index) => {
        if (!shouldUseAcrylicColorSelection(category, item.materialName)) return;

        const colorKey = getAllocationKey(item, index);
        const selectedOptions = selectedAcrylicColors[colorKey] || [];
        if (selectedOptions.length !== 1) return;

        const areaKey = `${colorKey}__${getColorOptionKey(selectedOptions[0])}`;
        if (asNum(next[areaKey]) > 0) return;

        next[areaKey] = fullArea;
        changed = true;
      });

      return changed ? next : prev;
    });
  }, [calcResult, normalizedInputs, selectedAcrylicColors, category]);

  useEffect(() => {
    if (!apiUrl) return;
    fetchBookings();
    
  }, [apiUrl]);

  const handleChangeInput = (key, value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleCalculate = () => {
    setCalcLoading(true);
    setBookingNotice("");

    try {
      const result = computeLocally({
        category,
        variant,
        inputs: normalizedInputs,
        configRows,
        stockRows,
      });
      setCalcResult(result);
    } catch (e) {
      console.error("local calculate error:", e);
      setCalcResult(null);
      alert(`Calculation failed: ${e.message || e}`);
    } finally {
      setCalcLoading(false);
    }
  };

  async function fetchBookings() {
    if (!apiUrl) return;

    setBookingsLoading(true);
    setBookingsError("");

    try {
      const data = await apiGet(apiUrl, {
        action: "getBookings",
        requestedBy: user.username || "",
        role: user.role || "",
      });

      setBookings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("getBookings error:", e);
      setBookings([]);
      setBookingsError(
        "Bookings list endpoint is not enabled yet. Please add Apps Script action=getBookings."
      );
    } finally {
      setBookingsLoading(false);
    }
  }

  const handleCreateBooking = async () => {
    if (!calcResult?.items?.length) {
      alert("Please calculate first.");
      return;
    }

    setBookingLoading(true);
    setBookingNotice("");

    try {
      const missingColorSelections = (calcDisplayItems || []).filter(
        (it) => it.requiresAcrylicColor && acrylicColorOptions.length && !(it.colorBreakup || []).length
      );

      if (missingColorSelections.length) {
        alert("Please select at least one acrylic color variant before submitting the booking.");
        return;
      }

      const missingColorAreas = (calcDisplayItems || []).filter(
        (it) =>
          it.requiresAcrylicColor &&
          acrylicColorOptions.length &&
          (!(it.colorBreakup || []).length || asNum(it.totalAllocatedArea) <= 0)
      );

      if (missingColorAreas.length) {
        alert("Please enter allocated area for the selected acrylic color breakup.");
        return;
      }

      const payload = {
        action: "createBooking",
        data: {
          category,
          variant,
          requestedBy: user.username || "End User",
          remarks: remarks || "",
          status: STATUS_PENDING_REVIEW,
          inputs: normalizedInputs,
          totalRequiredQty: totals.totalRequired,
          totalShortageQty: totals.totalShort,
          items: (calcDisplayItems || []).flatMap((it) => {
            if (it.requiresAcrylicColor && (it.colorBreakup || []).length) {
              return it.colorBreakup
                .filter((color) => asNum(color.allocatedArea) > 0)
                .map((color) => ({
                  skuCode: color.skuCode || "",
                  materialName: color.materialName || "Color",
                  variant: color.variant || "",
                  unit: it.unit || "",
                  requiredQty: asNum(color.requiredQty),
                  allocatedArea: asNum(color.allocatedArea),
                  totalAllocatedArea: asNum(it.totalAllocatedArea),
                  calcType: it.calcType || "",
                  formula: it.formula || "",
                  calculatedMaterialName: it.materialName || "",
                }));
            }

            return [
              {
                skuCode: it.skuCode || "",
                materialName: it.selectedMaterialName || it.materialName || "",
                variant: it.variant || "",
                unit: it.unit || "",
                requiredQty: asNum(it.requiredQty),
                allocatedArea: 0,
                totalAllocatedArea: 0,
                calcType: it.calcType || "",
                formula: it.formula || "",
                calculatedMaterialName: it.materialName || "",
              },
            ];
          }),
        },
      };

      console.log("createBooking payload =>", payload);

      await apiMutation(apiUrl, payload);

      setRemarks("");
      setBookingNotice("✅ Requirement submitted for admin review. Refreshing bookings…");
      setTimeout(() => fetchBookings(), 1200);
    } catch (e) {
      console.error("createBooking error:", e);
      alert(`Booking submission failed: ${e.message || e}`);
    } finally {
      setBookingLoading(false);
    }
  };

  const handleOpenBookingDetail = (booking) => {
    setSelectedBooking(booking);
    setSelectedBookingStatus(safeStr(booking?.status) || STATUS_PENDING_REVIEW);
    setBookingAllocations(
      (booking?.childItems || []).reduce((acc, item, index) => {
        const selectedPackSize = asNum(
          item.selectedPackSize || item.packSize || approvedPackSizes[0]
        );
        const derived = deriveAllocationFromPackSize(item.requiredQty, selectedPackSize);
        const allocatedPackQty = asNum(item.allocatedPackQty || item.packsNeeded || derived.allocatedPackQty);
        const allocatedLooseQty = asNum(item.allocatedLooseQty || derived.allocatedLooseQty);

        acc[getAllocationKey(item, index)] = {
          selectedPackSize,
          allocatedPackQty,
          allocatedLooseQty,
        };
        return acc;
      }, {})
    );
    setStatusNotice("");
    setBookingDetailOpen(true);
  };

  const handleCloseBookingDetail = () => {
    setBookingDetailOpen(false);
    setSelectedBooking(null);
    setSelectedBookingStatus("");
    setBookingAllocations({});
    setStatusNotice("");
  };

  const handleAllocationChange = (item, index, field, value) => {
    const key = getAllocationKey(item, index);
    setBookingAllocations((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        ...(field === "selectedPackSize"
          ? {
              selectedPackSize: value,
              ...deriveAllocationFromPackSize(item.requiredQty, value),
            }
          : { [field]: value }),
      },
    }));
  };

  const buildBookingAllocationItems = () =>
    (selectedBooking?.childItems || []).map((item, index) => {
      const key = getAllocationKey(item, index);
      const allocation = bookingAllocations[key] || {};
      const selectedPackSize = asNum(allocation.selectedPackSize || item.selectedPackSize || item.packSize);
      const derived = deriveAllocationFromPackSize(item.requiredQty, selectedPackSize);
      const allocatedPackQty = asNum(allocation.allocatedPackQty ?? item.allocatedPackQty ?? derived.allocatedPackQty);
      const allocatedLooseQty = asNum(allocation.allocatedLooseQty ?? item.allocatedLooseQty ?? derived.allocatedLooseQty);
      const mappedStockQty = round2(selectedPackSize * allocatedPackQty + allocatedLooseQty);
      const shortageQty = round2(Math.max(0, asNum(item.requiredQty) - mappedStockQty));

      return {
        skuCode: item.skuCode || "",
        materialName: item.materialName || "",
        variant: item.variant || "",
        allocatedArea: asNum(item.allocatedArea),
        unit: item.unit || "",
        requiredQty: asNum(item.requiredQty),
        selectedPackSize,
        allocatedPackQty,
        allocatedLooseQty,
        mappedStockQty,
        shortageQty,
        itemStatus: shortageQty > 0 ? "Short" : "Allocated",
      };
    });

  const handleBookingDecision = async (nextStatus, bookingAction = "statusUpdate") => {
    if (!selectedBooking?.bookingId || !nextStatus) return;

    setStatusUpdateLoading(true);
    setStatusNotice("");

    try {
      const normalized = normalizeStatus(nextStatus);
      const shouldReserve = [normalizeKey(STATUS_HOLD), normalizeKey(STATUS_APPROVED)].includes(normalized);
      const shouldRelease = [normalizeKey(STATUS_RELEASED), normalizeKey(STATUS_DECLINED)].includes(normalized);
      const shouldDispatch = normalized === normalizeKey(STATUS_DISPATCHED);

      const payload = {
        action: "updateBookingStatus",
        data: {
          bookingId: selectedBooking.bookingId,
          status: nextStatus,
          bookingAction,
          bookingHoldDays: BOOKING_HOLD_DAYS,
          reserveStock: shouldReserve,
          releaseStock: shouldRelease,
          dispatchStock: shouldDispatch,
          items: buildBookingAllocationItems(),
          updatedBy: user.username || "",
        },
      };

      console.log("updateBookingStatus payload =>", payload);

      await apiMutation(apiUrl, payload);

      setStatusNotice(
        shouldDispatch || shouldReserve || shouldRelease
          ? "✅ Booking status update submitted. Refreshing stock availability…"
          : "✅ Booking status update submitted."
      );

      setBookings((prev) =>
        (prev || []).map((row) => {
          const rowBookingId = safeStr(pickFirst(row, ["Booking ID", "bookingId", "BookingId"]));
          if (rowBookingId !== selectedBooking.bookingId) return row;
          return {
            ...row,
            Status: nextStatus,
            status: nextStatus,
            "Booking Status": nextStatus,
          };
        })
      );

      setSelectedBooking((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
              rows: (prev.rows || []).map((row) => ({
                ...row,
                Status: nextStatus,
                status: nextStatus,
                "Booking Status": nextStatus,
              })),
            }
          : prev
      );

      setSelectedBookingStatus(nextStatus);
      setTimeout(async () => {
        await Promise.all([fetchBookings(), fetchStockRows({ silent: true })]);
      }, 1200);

      if (shouldDispatch || shouldReserve || shouldRelease) {
        setTimeout(() => {
          fetchStockRows({ silent: true });
        }, 3500);
      }
    } catch (e) {
      console.error("updateBookingStatus error:", e);
      alert(`Booking status update failed: ${e.message || e}`);
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const handleSaveBookingStatus = async () => {
    if (!selectedBooking?.bookingId) return;
    await handleBookingDecision(selectedBookingStatus, "manualStatusUpdate");
  };

  return (
    <Box sx={{ p: 2, fontFamily }}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: "1px solid rgba(100,149,237,0.25)",
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
          <Box display="flex" alignItems="center" gap={2}>
            <img src={logoSrc} alt="Klient Konnect" style={{ height: 56, objectFit: "contain" }} />
            <Box>
              <Typography variant="h5" sx={{ fontFamily, fontWeight: 700, color: cornflowerBlue }}>
                {title}
              </Typography>
              <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.8 }}>
                Calculate material requirements and submit them for stock admin review.
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="Reload page">
              <IconButton onClick={() => window.location.reload()}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {busy ? <CircularProgress size={18} /> : null}
          </Box>
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setVariant("");
                }}
                sx={{ fontFamily }}
              >
                <MenuItem value="ACRYLIC">ACRYLIC</MenuItem>
                <MenuItem value="PU">PU</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small" disabled={validationLoading}>
              <InputLabel>Variant / Base Type</InputLabel>
              <Select
                label="Variant / Base Type"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                sx={{ fontFamily }}
              >
                {(variantsList || []).map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={5}>
            <Box display="flex" gap={1} justifyContent={{ xs: "flex-start", md: "flex-end" }} flexWrap="wrap">
              <Button
                variant="contained"
                startIcon={calcLoading ? <CircularProgress size={16} /> : <CalculateIcon />}
                onClick={handleCalculate}
                disabled={!variant || calcLoading || inputsLoading || configLoading || stockLoading}
                sx={{
                  textTransform: "none",
                  fontFamily,
                  backgroundColor: cornflowerBlue,
                }}
              >
                Calculate
              </Button>

              <Button
                variant="outlined"
                startIcon={bookingLoading ? <CircularProgress size={16} /> : <ShoppingCartCheckoutIcon />}
                onClick={handleCreateBooking}
                disabled={!calcResult?.items?.length || bookingLoading}
                sx={{
                  textTransform: "none",
                  fontFamily,
                  borderColor: cornflowerBlue,
                  color: cornflowerBlue,
                }}
              >
                Book Requirement
              </Button>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography sx={{ fontFamily, fontWeight: 700, mb: 1, color: "#1f2a44" }}>
          Inputs
        </Typography>

        {inputsLoading ? (
          <Box display="flex" alignItems="center" gap={1}>
            <CircularProgress size={16} />
            <Typography sx={{ fontSize: 12, opacity: 0.7, fontFamily }}>Loading inputs…</Typography>
          </Box>
        ) : inputDefs.length === 0 ? (
          <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.75 }}>
            No inputs found. Check <b>Inventory Calc Inputs</b>.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {inputDefs.map((d) => (
              <Grid key={`${d.variant}-${d.inputKey}`} item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label={d.label || d.inputKey}
                  value={inputs[d.inputKey] ?? ""}
                  onChange={(e) => handleChangeInput(d.inputKey, e.target.value)}
                  sx={{ fontFamily }}
                  inputProps={{ style: { fontFamily } }}
                  helperText={d.unit ? `Unit: ${d.unit}` : ""}
                />
              </Grid>
            ))}

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Remarks (optional)"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                sx={{ fontFamily }}
                inputProps={{ style: { fontFamily } }}
              />
            </Grid>
          </Grid>
        )}

        {bookingNotice ? (
          <Box mt={2}>
            <Alert severity="success" sx={{ fontFamily }}>
              {bookingNotice}
            </Alert>
          </Box>
        ) : null}
      </Paper>

      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, border: "1px solid rgba(0,0,0,0.08)" }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1} gap={2} flexWrap="wrap">
          <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>
            Requirement & Availability
          </Typography>

          {calcResult?.items?.length ? (
            <Box display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end">
              <Chip label={`Total Required: ${totals.totalRequired}`} size="small" sx={{ fontFamily }} />
              <Chip
                label={`Total Shortage: ${totals.totalShort}`}
                size="small"
                sx={{ fontFamily }}
                color={totals.totalShort > 0 ? "warning" : "success"}
              />
              <Chip
                label={totals.allFulfillable ? "Available as per current stock" : "Partial / Short"}
                size="small"
                sx={{ fontFamily }}
                color={totals.allFulfillable ? "success" : "warning"}
              />
            </Box>
          ) : null}
        </Box>

        {!calcResult?.items?.length ? (
          <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.75 }}>
            Run <b>Calculate</b> to view material requirement and stock availability.
          </Typography>
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "rgba(100,149,237,0.10)" }}>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Material</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700, minWidth: 240 }}>Stock Variant</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Unit</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Required</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Current Pack Size</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Estimated Packs</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Current Available</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Shortage</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {calcDisplayItems.map((it, index) => {
                  const ok = asNum(it.shortageQty) <= 0;

                  return (
                    <TableRow key={`${it.materialName}-${it.calcType}-${index}`}>
                      <TableCell sx={{ fontFamily }}>{it.materialName}</TableCell>
                      <TableCell sx={{ fontFamily, minWidth: 360 }}>
                        {it.requiresAcrylicColor && acrylicColorOptions.length ? (
                          <Box sx={{ minWidth: 340 }}>
                            <Autocomplete
                              multiple
                              size="small"
                              options={acrylicColorOptions}
                              value={selectedAcrylicColors[it.colorKey] || []}
                              isOptionEqualToValue={(option, value) =>
                                getColorOptionKey(option) === getColorOptionKey(value)
                              }
                              getOptionLabel={getColorOptionLabel}
                              renderOption={(props, option) => {
                                const safeOption =
                                  typeof option === "object" && option
                                    ? option
                                    : { skuCode: "", materialName: "Color", variant: safeStr(option), label: safeStr(option) };
                                const stockRow =
                                  stockByMaterial[normalizeKey(safeOption.skuCode)] ||
                                  stockByMaterial[normalizeKey(safeOption.variant)] ||
                                  stockByMaterial[
                                    normalizeKey([safeOption.materialName, safeOption.variant].filter(Boolean).join("__"))
                                  ] ||
                                  null;
                                const stockInfo = getStockAvailability(stockRow);
                                return (
                                  <Box
                                    component="li"
                                    {...props}
                                    sx={{ display: "flex", justifyContent: "space-between", gap: 2, fontFamily }}
                                  >
                                    <Typography sx={{ fontFamily, fontSize: 12 }}>
                                      {getColorOptionLabel(safeOption)}
                                    </Typography>
                                    <Typography sx={{ fontFamily, fontSize: 11, color: "#667085" }}>
                                      Avl {round2(stockInfo.availableTotalQty)}
                                      {it.unit ? ` ${it.unit}` : ""}
                                    </Typography>
                                  </Box>
                                );
                              }}
                              renderTags={(value, getTagProps) =>
                                value.map((option, tagIndex) => {
                                  const { key, ...tagProps } = getTagProps({ index: tagIndex });
                                  return (
                                    <Chip
                                      {...tagProps}
                                      key={key || getColorOptionKey(option)}
                                      label={getColorOptionLabel(option)}
                                      size="small"
                                      sx={{
                                        height: 22,
                                        borderRadius: "6px",
                                        fontFamily,
                                        fontSize: 11,
                                        backgroundColor: "rgba(100,149,237,0.10)",
                                        color: "#1f2a44",
                                      }}
                                    />
                                  );
                                })
                              }
                              onChange={(event, value) => {
                                setSelectedAcrylicColors((prev) => ({
                                  ...prev,
                                  [it.colorKey]: value,
                                }));
                              }}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="Color variants"
                                  placeholder="Select"
                                  inputProps={{
                                    ...params.inputProps,
                                    style: { ...params.inputProps.style, fontFamily },
                                  }}
                                />
                              )}
                              sx={{ fontFamily }}
                            />

                            {(it.colorBreakup || []).length ? (
                              <Box
                                sx={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 1,
                                  mt: 1,
                                }}
                              >
                                {it.colorBreakup.map((color) => {
                                  const colorLabel = getColorOptionLabel(color);
                                  const areaKey = color.areaKey || `${it.colorKey}__${getColorOptionKey(color)}`;
                                  const hasArea = asNum(color.allocatedArea) > 0;
                                  return (
                                    <Box
                                      key={areaKey}
                                      sx={{
                                        width: { xs: "100%", sm: "calc(50% - 4px)" },
                                        minWidth: 150,
                                      }}
                                    >
                                      <TextField
                                        fullWidth
                                        size="small"
                                        type="number"
                                        label={`${colorLabel} area`}
                                        value={selectedColorAreas[areaKey] || ""}
                                        onChange={(e) =>
                                          setSelectedColorAreas((prev) => ({
                                            ...prev,
                                            [areaKey]: e.target.value,
                                          }))
                                        }
                                        helperText={
                                          hasArea
                                            ? `Req ${round2(color.requiredQty)} ${it.unit}`
                                            : "Enter area"
                                        }
                                        FormHelperTextProps={{
                                          sx: { mx: 0, fontFamily, fontSize: 10.5, lineHeight: 1.2 },
                                        }}
                                        inputProps={{ style: { fontFamily, textAlign: "right" } }}
                                      />
                                    </Box>
                                  );
                                })}
                              </Box>
                            ) : null}
                          </Box>
                        ) : it.requiresAcrylicColor ? (
                          <Typography sx={{ fontFamily, fontSize: 12, color: "#c62828" }}>
                            Add acrylic color SKUs in SKU sheet
                          </Typography>
                        ) : (
                          <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.65 }}>-</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontFamily }}>{it.unit}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">{round2(it.requiredQty)}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">{it.packSize ? round2(it.packSize) : "-"}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">{it.estimatedPacksNeeded || "-"}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">{round2(it.availableTotalQty)}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">{round2(it.shortageQty)}</TableCell>
                      <TableCell sx={{ fontFamily }}>
                        <Chip
                          size="small"
                          label={ok ? "Available" : "Short"}
                          color={ok ? "success" : "warning"}
                          sx={{ fontFamily }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {calcResult?.items?.length ? (
          <Alert severity="info" sx={{ mt: 2, fontFamily }}>
            Pack sizes shown here are read-only estimates from current stock. Final package allocation is handled by the stock admin during booking review.
          </Alert>
        ) : null}
      </Paper>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: "1px solid rgba(0,0,0,0.08)" }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon sx={{ color: cornflowerBlue }} />
            <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>Bookings</Typography>
          </Box>

          <Button
            size="small"
            variant="outlined"
            startIcon={bookingsLoading ? <CircularProgress size={14} /> : <RefreshIcon />}
            onClick={fetchBookings}
            sx={{ textTransform: "none", fontFamily, borderColor: cornflowerBlue, color: cornflowerBlue }}
          >
            Refresh
          </Button>
        </Box>

        {bookingsError ? (
          <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.8 }}>{bookingsError}</Typography>
        ) : null}

        {bookingsLoading ? (
          <Box display="flex" alignItems="center" gap={1}>
            <CircularProgress size={16} />
            <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Loading bookings…</Typography>
          </Box>
        ) : bookingSummaryRows.length === 0 ? (
          <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.75 }}>No bookings to show.</Typography>
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "rgba(100,149,237,0.10)" }}>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Timestamp</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Booking ID</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Requested By</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Variant</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Items</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Hold</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Remarks</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bookingSummaryRows.map((b, idx) => {
                  const holdInfo = getBookingHoldInfo(b);
                  const released = isReleasedStatus(b.status);
                  const reserved = isReservedStatus(b.status);
                  const holdLabel = !reserved
                    ? "-"
                    : !holdInfo.expiresAt
                      ? "Active"
                      : released
                        ? "Released"
                        : holdInfo.isExpired
                          ? "Expired"
                          : `${holdInfo.daysRemaining}d left`;

                  return (
                    <TableRow key={b.bookingId || idx}>
                      <TableCell sx={{ fontFamily, fontSize: 12 }}>{formatDisplayDate(b.timestamp)}</TableCell>
                      <TableCell sx={{ fontFamily }}>{safeStr(b.bookingId)}</TableCell>
                      <TableCell sx={{ fontFamily }}>{safeStr(b.requestedBy)}</TableCell>
                      <TableCell sx={{ fontFamily }}>{safeStr(b.category)}</TableCell>
                      <TableCell sx={{ fontFamily }}>{safeStr(b.variant)}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">{b.totalItems || 0}</TableCell>
                      <TableCell sx={{ fontFamily }}>
                        <Chip
                          size="small"
                          label={holdLabel}
                          color={reserved && holdInfo.isExpired ? "warning" : "default"}
                          sx={{ fontFamily }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily }}>
                        <Chip size="small" label={safeStr(b.status) || STATUS_PENDING_REVIEW} sx={{ fontFamily }} />
                      </TableCell>
                      <TableCell sx={{ fontFamily, fontSize: 12 }}>{safeStr(b.remarks)}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="View booking items">
                          <IconButton onClick={() => handleOpenBookingDetail(b)}>
                            <VisibilityIcon sx={{ color: cornflowerBlue }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={bookingDetailOpen} onClose={handleCloseBookingDetail} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontFamily, fontWeight: 700 }}>Booking Details</DialogTitle>

        <DialogContent dividers>
          {selectedBooking ? (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={3}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Booking ID</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{safeStr(selectedBooking.bookingId)}</Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Timestamp</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{formatDisplayDate(selectedBooking.timestamp)}</Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Hold Until</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>
                    {selectedBookingHoldInfo.expiresAt
                      ? formatDisplayDate(selectedBookingHoldInfo.expiresAt.toISOString())
                      : "-"}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Requested By</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{safeStr(selectedBooking.requestedBy)}</Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Category</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{safeStr(selectedBooking.category)}</Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Variant</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{safeStr(selectedBooking.variant)}</Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Total Items</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{selectedBooking.totalItems || 0}</Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Total Required Qty</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{round2(selectedBooking.totalRequiredQty)}</Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Total Shortage Qty</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{round2(selectedBooking.totalShortageQty)}</Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Remarks</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 500 }}>{safeStr(selectedBooking.remarks) || "-"}</Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Requirement Inputs</Typography>
                  <Box
                    sx={{
                      mt: 0.5,
                      p: 1.25,
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 1,
                      backgroundColor: "#fafafa",
                      fontFamily,
                      fontSize: 12,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {selectedInputsJson || "-"}
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap" mb={1}>
                <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>Child Items</Typography>

                <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                  {isAdmin ? (
                    <>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleBookingDecision(STATUS_HOLD, "holdBooking")}
                        disabled={statusUpdateLoading}
                        sx={{ textTransform: "none", fontFamily, backgroundColor: "#d97706" }}
                      >
                        Hold
                      </Button>

                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleBookingDecision(STATUS_APPROVED, "approveBooking")}
                        disabled={statusUpdateLoading}
                        sx={{ textTransform: "none", fontFamily, backgroundColor: "#15803d" }}
                      >
                        Approve
                      </Button>

                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleBookingDecision(STATUS_DISPATCHED, "dispatchBooking")}
                        disabled={statusUpdateLoading}
                        sx={{ textTransform: "none", fontFamily, backgroundColor: "#2563eb" }}
                      >
                        Dispatch
                      </Button>

                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleBookingDecision(STATUS_RELEASED, "releaseBooking")}
                        disabled={statusUpdateLoading}
                        sx={{ textTransform: "none", fontFamily, backgroundColor: "#6b7280" }}
                      >
                        Release
                      </Button>

                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleBookingDecision(STATUS_DECLINED, "declineBooking")}
                        disabled={statusUpdateLoading}
                        sx={{ textTransform: "none", fontFamily, backgroundColor: "#b91c1c" }}
                      >
                        Decline
                      </Button>

                      <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel>Booking Status</InputLabel>
                        <Select
                          label="Booking Status"
                          value={selectedBookingStatus}
                          onChange={(e) => setSelectedBookingStatus(e.target.value)}
                          sx={{ fontFamily }}
                        >
                          {(bookingStatusOptions || []).map((status) => (
                            <MenuItem key={status} value={status}>
                              {status}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <Button
                        variant="contained"
                        startIcon={statusUpdateLoading ? <CircularProgress size={16} /> : <SaveIcon />}
                        onClick={handleSaveBookingStatus}
                        disabled={!selectedBookingStatus || statusUpdateLoading}
                        sx={{ textTransform: "none", fontFamily, backgroundColor: cornflowerBlue }}
                      >
                        Save Status
                      </Button>
                    </>
                  ) : (
                    <Chip
                      size="small"
                      label={`Status: ${safeStr(selectedBooking.status) || STATUS_PENDING_REVIEW}`}
                      sx={{ fontFamily }}
                    />
                  )}
                </Box>
              </Box>

              {statusNotice ? (
                <Box mb={2}>
                  <Alert severity="success" sx={{ fontFamily }}>{statusNotice}</Alert>
                </Box>
              ) : null}

              {selectedBookingHoldInfo.isExpired && isReservedStatus(selectedBooking.status) ? (
                <Box mb={2}>
                  <Alert severity="warning" sx={{ fontFamily }}>
                    This booking has crossed the {BOOKING_HOLD_DAYS}-day hold period. Release stock to return reserved quantities to availability.
                  </Alert>
                </Box>
              ) : null}

              {selectedBooking.childItems?.length ? (
                <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: "rgba(100,149,237,0.10)" }}>
                        <TableCell sx={{ fontFamily, fontWeight: 700 }}>SKU</TableCell>
                        <TableCell sx={{ fontFamily, fontWeight: 700 }}>Material</TableCell>
                        <TableCell sx={{ fontFamily, fontWeight: 700 }}>Variant</TableCell>
                        <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Area</TableCell>
                        <TableCell sx={{ fontFamily, fontWeight: 700 }}>Unit</TableCell>
                        <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Required Qty</TableCell>
                        <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Package Size</TableCell>
                        <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Allocated Packs</TableCell>
                        <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Allocated Loose</TableCell>
                        <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Reserved Qty</TableCell>
                        <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Dispatched Qty</TableCell>
                        <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Shortage Qty</TableCell>
                        <TableCell sx={{ fontFamily, fontWeight: 700 }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedBooking.childItems.map((item, index) => {
                        const allocationKey = getAllocationKey(item, index);
                        const allocation = bookingAllocations[allocationKey] || {};
                        const selectedPackSize = asNum(
                          allocation.selectedPackSize || item.selectedPackSize || item.packSize || approvedPackSizes[0]
                        );
                        const derivedAllocation = deriveAllocationFromPackSize(item.requiredQty, selectedPackSize);
                        const allocatedPackQty = asNum(
                          allocation.allocatedPackQty ?? item.allocatedPackQty ?? derivedAllocation.allocatedPackQty
                        );
                        const allocatedLooseQty = asNum(
                          allocation.allocatedLooseQty ?? item.allocatedLooseQty ?? derivedAllocation.allocatedLooseQty
                        );
                        const mappedStockQty = round2(selectedPackSize * allocatedPackQty + allocatedLooseQty);
                        const shortageQty = round2(Math.max(0, asNum(item.requiredQty) - mappedStockQty));
                        const packSizeOptions = Array.from(
                          new Set([
                            ...approvedPackSizes,
                          ].filter((n) => n > 0))
                        ).sort((a, b) => a - b);
                        const itemStatus = safeStr(item.itemStatus || item.status) || (mappedStockQty > 0 ? "Allocated" : "Pending Allocation");
                        const packSizeOptionLabels = packSizeOptions.map((ps) => String(ps));

                        return (
                          <TableRow key={`${item.materialName || "item"}-${index}`}>
                            <TableCell sx={{ fontFamily }}>{safeStr(item.skuCode) || "-"}</TableCell>
                            <TableCell sx={{ fontFamily }}>{safeStr(item.materialName)}</TableCell>
                            <TableCell sx={{ fontFamily }}>{safeStr(item.variant) || "-"}</TableCell>
                            <TableCell sx={{ fontFamily }} align="right">
                              {asNum(item.allocatedArea) > 0 ? round2(item.allocatedArea) : "-"}
                            </TableCell>
                            <TableCell sx={{ fontFamily }}>{safeStr(item.unit)}</TableCell>
                            <TableCell sx={{ fontFamily }} align="right">{round2(item.requiredQty)}</TableCell>
                            <TableCell sx={{ fontFamily }} align="right">
                              {isAdmin ? (
                                <Autocomplete
                                  freeSolo
                                  size="small"
                                  options={packSizeOptionLabels}
                                  value={selectedPackSize ? String(selectedPackSize) : ""}
                                  onChange={(event, value) => {
                                    handleAllocationChange(item, index, "selectedPackSize", value || "");
                                  }}
                                  onInputChange={(event, value, reason) => {
                                    if (reason === "input" || reason === "clear") {
                                      handleAllocationChange(item, index, "selectedPackSize", value || "");
                                    }
                                  }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      placeholder="Select"
                                      inputProps={{
                                        ...params.inputProps,
                                        style: { fontFamily, textAlign: "right" },
                                      }}
                                    />
                                  )}
                                  sx={{ width: 132, fontFamily }}
                                />
                              ) : (
                                selectedPackSize ? round2(selectedPackSize) : "Pending"
                              )}
                            </TableCell>
                            <TableCell sx={{ fontFamily }} align="right">
                              {allocatedPackQty ? round2(allocatedPackQty) : "-"}
                            </TableCell>
                            <TableCell sx={{ fontFamily }} align="right">
                              {allocatedLooseQty ? round2(allocatedLooseQty) : "-"}
                            </TableCell>
                            <TableCell sx={{ fontFamily }} align="right">{item.reservedQty ? round2(item.reservedQty) : "-"}</TableCell>
                            <TableCell sx={{ fontFamily }} align="right">{item.dispatchedQty ? round2(item.dispatchedQty) : "-"}</TableCell>
                            <TableCell sx={{ fontFamily }} align="right">{round2(shortageQty)}</TableCell>
                            <TableCell sx={{ fontFamily }}>
                              <Chip
                                size="small"
                                label={shortageQty > 0 ? "Short" : itemStatus}
                                color={shortageQty <= 0 ? "success" : "warning"}
                                sx={{ fontFamily }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.75 }}>
                  No child items were returned for this booking. If items exist in the backend, ensure
                  <b> getBookings </b>returns line-level rows against the same Booking ID.
                </Typography>
              )}
            </Box>
          ) : null}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseBookingDetail} sx={{ textTransform: "none", fontFamily }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
