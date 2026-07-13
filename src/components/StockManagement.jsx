// src/components/StockManagement.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
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
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  ListItemText,
} from "@mui/material";

import RefreshIcon from "@mui/icons-material/Refresh";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

const cornflowerBlue = "#6495ED";
const fontFamily = "Montserrat, sans-serif";

const INVENTORY_API_URL =
  "https://script.google.com/macros/s/AKfycbzEkxzsVYQWMdI7CmleY53U-O4C58b92wlCZnISqtv11L2YLcaRuiB0WGHWW1HlpsoG/exec";

const JSONP_TIMEOUT_MS = 60000;
const DEFAULT_PACK_SIZES = {
  "PORE SEALER": 23.2,
  "WEAR COAT": 21.4,
  "ADHESIVE": 15,
};
const CALC_MATRIX_ADMIN_EMAILS = ["holy@klientkonnect.com", "sidhant@ridosports.com"];
const DEFAULT_CALC_TYPES = [
  "AREA_X_RATE",
  "AREA_X_LAYER",
  "AREA_X_THICKNESS_RATE",
  "AREA_X_FIXED",
  "AREA_X_RATE_IF",
  "FORMULA",
];

// ---------- Helpers ----------
const safeStr = (v) => (v ?? "").toString().trim();
const toUpper = (v) => safeStr(v).toUpperCase();
const asNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(asNum(n) * 100) / 100;
const hasValue = (v) => v !== undefined && v !== null && safeStr(v) !== "";
const normalizeKey = (v) => safeStr(v).replace(/\s+/g, " ").trim().toUpperCase();

function pickFirst(row, keys = []) {
  for (const key of keys) {
    const val = row?.[key];
    if (safeStr(val) !== "") return val;
  }
  return "";
}

function getSkuCode(row) {
  return safeStr(pickFirst(row, ["skuCode", "SKU Code", "SKU", "Sku Code"]));
}

function normalizeSkuRow(row) {
  const skuCode = getSkuCode(row);
  const category = safeStr(pickFirst(row, ["category", "Category"]));
  const materialName = safeStr(pickFirst(row, ["materialName", "Material Name", "Material"]));
  const variant = safeStr(pickFirst(row, ["variant", "Variant", "Color Variant", "colorVariant"]));

  if (!skuCode && !category && !materialName && !variant) return null;

  return {
    skuCode,
    category,
    materialName,
    variant,
    label: [skuCode, materialName, variant].filter(Boolean).join(" | "),
  };
}

function getLocationValue(row) {
  return safeStr(
    row?.location ||
      row?.stockLocation ||
      row?.stockAvailableAt ||
      row?.Location ||
      row?.["Stock Location"] ||
      row?.["Stock Available At"] ||
      row?.["Stock available at"]
  );
}

function getDefaultPackSize(materialName) {
  const normalized = safeStr(materialName).toUpperCase();
  return (
    DEFAULT_PACK_SIZES[normalized] ||
    Object.entries(DEFAULT_PACK_SIZES).find(([key]) => normalized.includes(key))?.[1] ||
    0
  );
}

function getUserFromLocalStorage() {
  try {
    const raw = localStorage.getItem("crmUser");
    if (!raw) return { username: "", role: "" };
    const parsed = JSON.parse(raw);
    return {
      username: parsed?.loginUsername || parsed?.username || parsed?.name || "",
      email: parsed?.email || parsed?.loginEmail || parsed?.userEmail || "",
      role: parsed?.role || "",
    };
  } catch {
    return { username: "", role: "" };
  }
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

function parsePackSizeOptions(value) {
  return Array.from(
    new Set(
      safeStr(value)
        .split(/[|,]/)
        .map((v) => asNum(v))
        .filter((n) => n > 0)
    )
  ).sort((a, b) => a - b);
}

function buildStockRow(row, idx) {
  const packSize = asNum(row.packSize);
  const packagedStockQty = asNum(row.packagedStockQty);
  const packagesAvailable = hasValue(row.packagesAvailable)
    ? asNum(row.packagesAvailable)
    : packSize > 0
      ? round2(packagedStockQty / packSize)
      : 0;
  const readyPacksCount = packagesAvailable;

  const reservedPackagedQty = asNum(row.reservedPackagedQty);
  const reservedLooseQty = asNum(row.reservedLooseQty);
  const dispatchedPackagedQty = asNum(row.dispatchedPackagedQty);
  const dispatchedLooseQty = asNum(row.dispatchedLooseQty);
  const looseStockQty = asNum(row.looseStockQty);
  const availablePackagedQty = hasValue(row.availablePackagedQty)
    ? asNum(row.availablePackagedQty)
    : Math.max(0, packagedStockQty - reservedPackagedQty - dispatchedPackagedQty);
  const availableLooseQty = hasValue(row.availableLooseQty)
    ? asNum(row.availableLooseQty)
    : Math.max(0, looseStockQty - reservedLooseQty - dispatchedLooseQty);

  return {
    id: `${getSkuCode(row) || safeStr(row.category)}__${safeStr(row.materialName)}__${safeStr(row.variant)}__${getLocationValue(row)}__${idx}`,
    skuCode: getSkuCode(row),
    timestamp: row.timestamp || "",
    category: safeStr(row.category),
    materialName: safeStr(row.materialName),
    variant: safeStr(row.variant),
    location: getLocationValue(row),
    unit: safeStr(row.unit),
    packSize,
    packSizeOptions: safeStr(row.packSizeOptions || ""),
    packSizeOptionsList: parsePackSizeOptions(row.packSizeOptions || ""),
    packagesAvailable: round2(packagesAvailable),
    readyPacksCount,
    packagedStockQty: round2(packagedStockQty),
    looseStockQty: round2(looseStockQty),
    reservedPackagedQty: round2(reservedPackagedQty),
    reservedLooseQty: round2(reservedLooseQty),
    dispatchedPackagedQty: round2(dispatchedPackagedQty),
    dispatchedLooseQty: round2(dispatchedLooseQty),
    availablePackagedQty: round2(availablePackagedQty),
    availableLooseQty: round2(availableLooseQty),
    minStockLevel: asNum(row.minStockLevel),
    active: safeStr(row.active || "TRUE"),
    updatedBy: safeStr(row.updatedBy),
  };
}

function deriveModalState(row) {
  const packSize = asNum(row?.packSize);
  const readyPacksCount = asNum(row?.readyPacksCount);
  const looseStockQty = asNum(row?.looseStockQty);
  const reservedPackagedQty = asNum(row?.reservedPackagedQty);
  const reservedLooseQty = asNum(row?.reservedLooseQty);

  const packagedStockQty = round2(readyPacksCount * packSize);
  const availablePackagedQty = round2(Math.max(0, packagedStockQty - reservedPackagedQty));
  const availableLooseQty = round2(Math.max(0, looseStockQty - reservedLooseQty));

  return {
    ...row,
    packSize,
    readyPacksCount,
    looseStockQty,
    packagedStockQty,
    availablePackagedQty,
    availableLooseQty,
  };
}

function mapCreateCategoryToStoredCategory(category) {
  const value = safeStr(category);
  const normalized = normalizeKey(value);

  if (normalized === "ACRYLIC MATERIAL" || normalized === "ACRYLIC") return "ACRYLIC";
  if (normalized === "PU MATERIAL" || normalized === "PU") return "PU";
  if (normalized === "ACRYLIC OR PU MATERIAL" || normalized === "ACRYLIC OR PU") return "ACRYLIC OR PU";

  return value;
}

function mapStoredCategoryToCreateCategory(category) {
  const value = safeStr(category);
  const normalized = normalizeKey(value);

  if (normalized === "ACRYLIC MATERIAL" || normalized === "ACRYLIC") return "ACRYLIC";
  if (normalized === "PU MATERIAL" || normalized === "PU") return "PU";
  if (normalized === "ACRYLIC OR PU MATERIAL" || normalized === "ACRYLIC OR PU") return "ACRYLIC OR PU";

  return value;
}

function sameInventoryCategory(a, b) {
  return normalizeKey(mapCreateCategoryToStoredCategory(a)) === normalizeKey(mapCreateCategoryToStoredCategory(b));
}

function isWildcardVariant(variant) {
  const value = normalizeKey(variant);
  return !value || value === "ALL" || value === "DEFAULT" || value === "ALL VARIANTS" || value === "ALL COLORS";
}

function buildCalcRuleDraft({ category = "", materialName = "", variant = "", unit = "" } = {}) {
  return {
    category: mapCreateCategoryToStoredCategory(category),
    variant: variant || "ALL VARIANTS",
    materialName,
    unit,
    calcType: "AREA_X_RATE",
    baseRate: "",
    inputKey: "area",
    dependsOn: "",
    formula: "",
    active: "TRUE",
  };
}

function buildNewMaterialState(defaultCategory = "") {
  const mappedDefaultCategory =
    defaultCategory && defaultCategory !== "ALL"
      ? mapStoredCategoryToCreateCategory(defaultCategory)
      : "";

  return {
    skuCode: "",
    category: mappedDefaultCategory,
    materialName: "",
    variant: "",
    location: "",
    unit: "",
    packSize: 0,
    packSizeOptions: "",
    packSizeOptionsList: [],
    readyPacksCount: 0,
    packagedStockQty: 0,
    looseStockQty: 0,
    reservedPackagedQty: 0,
    reservedLooseQty: 0,
    availablePackagedQty: 0,
    availableLooseQty: 0,
    minStockLevel: 0,
    active: "TRUE",
  };
}

export default function StockManagement({
  apiUrl = INVENTORY_API_URL,
  logoSrc = "/assets/kk-logo.png",
  title = "Stock Management",
}) {
  const user = useMemo(() => getUserFromLocalStorage(), []);
  const userIdentity = normalizeKey(
    [user.username, user.email, user.role].filter(Boolean).join(" ")
  );
  const canManageStock =
    userIdentity.includes("STOCK@RIDOSPORTS.COM") ||
    userIdentity.includes("SARABJEET") ||
    normalizeKey(user.role) === "ADMIN";
  const userEmail = safeStr(user.email || user.username).toLowerCase();
  const canManageCalcMatrix = CALC_MATRIX_ADMIN_EMAILS.includes(userEmail);

  const [validation, setValidation] = useState({});
  const [validationLoading, setValidationLoading] = useState(false);
  const [skuRows, setSkuRows] = useState([]);

  const [category, setCategory] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("ROWS");
  const [search, setSearch] = useState("");

  const [stockRows, setStockRows] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState("");
  const [globalNotice, setGlobalNotice] = useState("");

  const [openModal, setOpenModal] = useState(false);
  const [modalForm, setModalForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalNotice, setModalNotice] = useState("");
  const [modalError, setModalError] = useState("");

  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(buildNewMaterialState());
  const [creating, setCreating] = useState(false);
  const [createNotice, setCreateNotice] = useState("");
  const [createError, setCreateError] = useState("");
  const [calcRules, setCalcRules] = useState([]);
  const [calcRulesLoading, setCalcRulesLoading] = useState(false);
  const [calcRuleDraft, setCalcRuleDraft] = useState(buildCalcRuleDraft());
  const [calcRuleSaving, setCalcRuleSaving] = useState(false);
  const [calcRuleNotice, setCalcRuleNotice] = useState("");
  const [calcRuleError, setCalcRuleError] = useState("");

  const [openToggleModal, setOpenToggleModal] = useState(false);
  const [toggleRow, setToggleRow] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [toggleError, setToggleError] = useState("");

  const [openTransferModal, setOpenTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState("");

  // ---------- Validation Mapping ----------
  // Keep the row-wise logic available for any future use or backend normalization,
  // but the Add Material modal now uses category-column headers directly.
  const materialValidationRows = useMemo(() => {
    const rowWise =
      validation?.inventoryMaterialRows ||
      validation?.["Inventory Material Rows"] ||
      validation?.inventoryMaterialValidation ||
      [];

    if (Array.isArray(rowWise) && rowWise.length > 0 && typeof rowWise[0] === "object") {
      return rowWise
        .map((row) => ({
          category: safeStr(row.category || row.Category),
          materialName: safeStr(row.materialName || row["Material Name"]),
          unit: safeStr(row.unit || row.Unit),
        }))
        .filter((row) => row.category && row.materialName);
    }

    const normalizedCategoryList = validation?.["Category"] || [];
    const normalizedMaterialList = validation?.["Material Name"] || [];
    const normalizedUnitList = validation?.["Unit"] || [];

    const normalizedRows = [];
    const maxLen = Math.max(
      normalizedCategoryList.length,
      normalizedMaterialList.length,
      normalizedUnitList.length
    );

    for (let i = 0; i < maxLen; i++) {
      const categoryValue = safeStr(normalizedCategoryList[i]);
      const materialName = safeStr(normalizedMaterialList[i]);
      const unit = safeStr(normalizedUnitList[i]);

      if (categoryValue && materialName) {
        normalizedRows.push({
          category: categoryValue,
          materialName,
          unit,
        });
      }
    }

    if (normalizedRows.length > 0) {
      return normalizedRows;
    }

    const acrylicMaterials = validation?.["Acrylic Material"] || [];
    const acrylicOrPuMaterials = validation?.["Acrylic or PU Material"] || [];
    const puMaterials = validation?.["PU Material"] || [];

    const groupedRows = [
      ...acrylicMaterials
        .map((item) => ({
          category: "Acrylic Material",
          materialName: safeStr(item),
          unit: "kg",
        }))
        .filter((row) => row.materialName),

      ...acrylicOrPuMaterials
        .map((item) => ({
          category: "Acrylic or PU Material",
          materialName: safeStr(item),
          unit: safeStr(item) === "Thinner" ? "ltr" : "kg",
        }))
        .filter((row) => row.materialName),

      ...puMaterials
        .map((item) => ({
          category: "PU Material",
          materialName: safeStr(item),
          unit: "kg",
        }))
        .filter((row) => row.materialName),
    ];

    return groupedRows;
  }, [validation]);

  // Main page category filter
  const categoryOptions = useMemo(() => {
    const fromSku = Array.from(
      new Set((skuRows || []).map((r) => safeStr(r.category)).filter(Boolean))
    );

    const fromValidation = Array.from(
      new Set(
        (validation?.["Category"] || [])
          .map((v) => safeStr(v))
          .filter(Boolean)
      )
    );

    const fromRows = Array.from(
      new Set(
        (stockRows || [])
          .map((r) => safeStr(r.category))
          .filter(Boolean)
      )
    );

    return Array.from(new Set([...fromSku, ...fromValidation, ...fromRows]));
  }, [skuRows, validation, stockRows]);

  const skuOptions = useMemo(() => {
    return (skuRows || [])
      .filter((row) => category === "ALL" || sameInventoryCategory(row.category, category))
      .sort((a, b) => safeStr(a.label).localeCompare(safeStr(b.label)));
  }, [skuRows, category]);

  const createSkuOptions = useMemo(() => {
    return (skuRows || [])
      .filter(
        (row) =>
          !safeStr(createForm.category) ||
          sameInventoryCategory(row.category, createForm.category)
      )
      .sort((a, b) => safeStr(a.label).localeCompare(safeStr(b.label)));
  }, [skuRows, createForm.category]);

  // Add Material modal category dropdown:
  // category selection should look up the relevant validation COLUMN HEADER.
  const createCategoryOptions = useMemo(() => {
    const fromSku = Array.from(
      new Set((skuRows || []).map((row) => safeStr(row.category)).filter(Boolean))
    );

    if (fromSku.length > 0) {
      return fromSku;
    }

    const allowedCategoryHeaders = [
      "Acrylic Material",
      "Acrylic or PU Material",
      "PU Material",
    ];

    const filteredHeaders = allowedCategoryHeaders.filter((header) => {
      const values = Array.isArray(validation?.[header]) ? validation[header] : [];
      return values.map((v) => safeStr(v)).filter(Boolean).length > 0;
    });

    if (filteredHeaders.length > 0) {
      return filteredHeaders;
    }

    const directCategory = (validation?.["Category"] || [])
      .map((v) => safeStr(v))
      .filter(Boolean);

    return Array.from(new Set(directCategory));
  }, [skuRows, validation]);

  // Add Material modal material dropdown:
  // selected category directly maps to the values under that validation column.
  const createMaterialOptions = useMemo(() => {
    const selectedCategory = safeStr(createForm.category);
    if (!selectedCategory) return [];

    const fromSku = (skuRows || [])
      .filter((row) => sameInventoryCategory(row.category, selectedCategory))
      .map((row) => safeStr(row.materialName))
      .filter(Boolean);

    if (fromSku.length > 0) {
      return Array.from(new Set(fromSku)).sort((a, b) => a.localeCompare(b));
    }

    const values = Array.isArray(validation?.[selectedCategory])
      ? validation[selectedCategory]
      : [];

    if (values.length > 0) {
      return Array.from(
        new Set(values.map((v) => safeStr(v)).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));
    }

    // fallback to row mapping if needed
    const filtered = materialValidationRows
      .filter((row) => safeStr(row.category) === selectedCategory)
      .map((row) => safeStr(row.materialName))
      .filter(Boolean);

    return Array.from(new Set(filtered)).sort((a, b) => a.localeCompare(b));
  }, [skuRows, validation, createForm.category, materialValidationRows]);

  const createVariantOptions = useMemo(() => {
    if (!safeStr(createForm.category) || !safeStr(createForm.materialName)) return [];

    return Array.from(
      new Set(
        (skuRows || [])
          .filter((row) => sameInventoryCategory(row.category, createForm.category))
          .filter((row) => normalizeKey(row.materialName) === normalizeKey(createForm.materialName))
          .map((row) => safeStr(row.variant))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [skuRows, createForm.category, createForm.materialName]);

  const selectedCalcRule = useMemo(() => {
    if (!safeStr(createForm.category) || !safeStr(createForm.materialName)) return null;

    const selectedCategory = mapCreateCategoryToStoredCategory(createForm.category);
    const selectedVariant = safeStr(createForm.variant);
    const candidates = (calcRules || []).filter(
      (rule) =>
        sameInventoryCategory(rule.category, selectedCategory) &&
        normalizeKey(rule.materialName) === normalizeKey(createForm.materialName)
    );

    return (
      candidates.find((rule) => selectedVariant && normalizeKey(rule.variant) === normalizeKey(selectedVariant)) ||
      candidates.find((rule) => isWildcardVariant(rule.variant)) ||
      candidates[0] ||
      null
    );
  }, [calcRules, createForm.category, createForm.materialName, createForm.variant]);

  // Pack size validation fallback from validation sheet if available
  const approvedPackSizes = useMemo(() => {
    const raw =
      validation?.["Pack Sizes"] ||
      validation?.["Approved Pack Sizes"] ||
      validation?.["Packaging Sizes"] ||
      [];

    const nums = (raw || [])
      .flatMap((v) => safeStr(v).split(/[|,]/))
      .map((v) => Number(safeStr(v)))
      .filter((n) => Number.isFinite(n) && n > 0);

    return Array.from(new Set(nums)).sort((a, b) => a - b);
  }, [validation]);

  const locationOptions = useMemo(() => {
    const raw =
      validation?.["Location"] ||
      validation?.["Stock Location"] ||
      validation?.["Stock Available At"] ||
      validation?.["Stock available at"] ||
      [];

    const fromValidation = (raw || [])
      .flatMap((v) => safeStr(v).split(/[|,]/))
      .map((v) => safeStr(v))
      .filter(Boolean);

    const fromRows = (stockRows || [])
      .map((row) => safeStr(row.location))
      .filter(Boolean);

    return Array.from(new Set([...fromValidation, ...fromRows])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [validation, stockRows]);

  const filteredRows = useMemo(() => {
    const q = toUpper(search);

    return (stockRows || []).filter((row) => {
      const matchesCategory =
        category === "ALL" || toUpper(row.category) === toUpper(category);
      const matchesLocation =
        locationFilter === "ALL" || normalizeKey(row.location) === normalizeKey(locationFilter);

      const hay =
        `${row.skuCode} ${row.category} ${row.materialName} ${row.variant} ${row.location} ${row.unit} ${row.packSizeOptions}`.toUpperCase();

      const matchesSearch = !q || hay.includes(q);

      return matchesCategory && matchesLocation && matchesSearch;
    });
  }, [stockRows, category, locationFilter, search]);

  const materialRows = useMemo(() => {
    const groups = new Map();

    filteredRows.forEach((row) => {
      const key = [
        normalizeKey(row.skuCode),
        normalizeKey(row.category),
        normalizeKey(row.materialName),
        normalizeKey(row.variant),
      ].join("||");

      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          skuCode: row.skuCode,
          category: row.category,
          materialName: row.materialName,
          variant: row.variant,
          unit: row.unit,
          locations: [],
          packagedStockQty: 0,
          looseStockQty: 0,
          reservedPackagedQty: 0,
          reservedLooseQty: 0,
          availablePackagedQty: 0,
          availableLooseQty: 0,
          packagesAvailable: 0,
          minStockLevel: 0,
          activeCount: 0,
          rowCount: 0,
        });
      }

      const group = groups.get(key);
      group.locations.push(row);
      group.packagedStockQty = round2(group.packagedStockQty + asNum(row.packagedStockQty));
      group.looseStockQty = round2(group.looseStockQty + asNum(row.looseStockQty));
      group.reservedPackagedQty = round2(group.reservedPackagedQty + asNum(row.reservedPackagedQty));
      group.reservedLooseQty = round2(group.reservedLooseQty + asNum(row.reservedLooseQty));
      group.availablePackagedQty = round2(group.availablePackagedQty + asNum(row.availablePackagedQty));
      group.availableLooseQty = round2(group.availableLooseQty + asNum(row.availableLooseQty));
      group.packagesAvailable = round2(group.packagesAvailable + asNum(row.packagesAvailable));
      group.minStockLevel = round2(group.minStockLevel + asNum(row.minStockLevel));
      group.activeCount += toUpper(row.active) === "TRUE" ? 1 : 0;
      group.rowCount += 1;
    });

    return Array.from(groups.values()).sort((a, b) =>
      `${a.category} ${a.materialName} ${a.variant}`.localeCompare(
        `${b.category} ${b.materialName} ${b.variant}`
      )
    );
  }, [filteredRows]);

  const fetchValidation = async () => {
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

  const fetchSkuMaster = async () => {
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

  const fetchCalcRules = async (categoryValue = createForm.category) => {
    if (!apiUrl || !safeStr(categoryValue)) {
      setCalcRules([]);
      return;
    }

    setCalcRulesLoading(true);

    try {
      const data = await apiGet(apiUrl, {
        action: "getCalcConfig",
        category: mapCreateCategoryToStoredCategory(categoryValue),
        variant: "",
      });
      setCalcRules(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("getCalcConfig error:", e);
      setCalcRules([]);
    } finally {
      setCalcRulesLoading(false);
    }
  };

  const fetchStock = async () => {
    if (!apiUrl) return;
    setStockLoading(true);
    setStockError("");
    setGlobalNotice("");

    try {
      const categoryParam = category === "ALL" ? "" : category;
      const data = await apiGet(apiUrl, {
        action: "getStock",
        category: categoryParam,
      });

      const safeRows = Array.isArray(data) ? data : [];
      const mapped = safeRows.map((row, idx) =>
        buildStockRow(
          {
            timestamp: row.timestamp || "",
            skuCode: row.skuCode || row["SKU Code"],
            category: row.category,
            materialName: row.materialName,
            variant: row.variant || row["Variant"],
            location: getLocationValue(row),
            unit: row.unit,
            packSize: row.packSize,
            packSizeOptions: row.packSizeOptions,
            packagesAvailable: row.packagesAvailable,
            packagedStockQty: row.packagedStockQty,
            looseStockQty: row.looseStockQty,
            reservedPackagedQty: row.reservedPackagedQty,
            reservedLooseQty: row.reservedLooseQty,
            dispatchedPackagedQty: row.dispatchedPackagedQty,
            dispatchedLooseQty: row.dispatchedLooseQty,
            availablePackagedQty: row.availablePackagedQty,
            availableLooseQty: row.availableLooseQty,
            minStockLevel: row.minStockLevel,
            active: row.active,
            updatedBy: row.updatedBy,
          },
          idx
        )
      );

      setStockRows(mapped);
    } catch (e) {
      console.error("getStock error:", e);
      setStockRows([]);
      setStockError(`Failed to load stock: ${e.message || e}`);
    } finally {
      setStockLoading(false);
    }
  };

  useEffect(() => {
    fetchValidation();
    fetchSkuMaster();
  }, [apiUrl]);

  useEffect(() => {
    fetchStock();
  }, [apiUrl, category]);

  useEffect(() => {
    if (openCreateModal && safeStr(createForm.category)) {
      fetchCalcRules(createForm.category);
    }
  }, [openCreateModal, createForm.category]);

  useEffect(() => {
    const base = selectedCalcRule || buildCalcRuleDraft({
      category: createForm.category,
      materialName: createForm.materialName,
      variant: createVariantOptions.length ? "ALL VARIANTS" : createForm.variant,
      unit: createForm.unit,
    });

    setCalcRuleDraft({
      category: mapCreateCategoryToStoredCategory(base.category || createForm.category),
      variant: safeStr(base.variant || (createVariantOptions.length ? "ALL VARIANTS" : createForm.variant)),
      materialName: safeStr(base.materialName || createForm.materialName),
      unit: safeStr(base.unit || createForm.unit),
      calcType: safeStr(base.calcType || "AREA_X_RATE"),
      baseRate: safeStr(base.baseRate),
      inputKey: safeStr(base.inputKey || "area"),
      dependsOn: safeStr(base.dependsOn),
      formula: safeStr(base.formula),
      active: safeStr(base.active || "TRUE"),
    });
    setCalcRuleNotice("");
    setCalcRuleError("");
  }, [selectedCalcRule, createForm.category, createForm.materialName, createForm.variant, createForm.unit, createVariantOptions.length]);


  const handleOpenModal = (row) => {
    const validationPackSizes = approvedPackSizes || [];
    const existingPackSizes = row.packSizeOptionsList?.length
      ? row.packSizeOptionsList
      : parsePackSizeOptions(row.packSizeOptions);

    const mergedPackSizes = Array.from(
      new Set(
        [...existingPackSizes, ...validationPackSizes, asNum(row.packSize)]
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    ).sort((a, b) => a - b);

    setModalForm(
      deriveModalState({
        ...row,
        packSizeOptionsList: mergedPackSizes,
      })
    );
    setModalNotice("");
    setModalError("");
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setModalForm(null);
    setModalNotice("");
    setModalError("");
    setSaving(false);
  };

  const handleModalChange = (field, value) => {
    setModalForm((prev) => {
      if (!prev) return prev;

      const next = { ...prev, [field]: value };

      if (field === "packSizeOptions") {
        const freeTextOptions = parsePackSizeOptions(value);
        const merged = Array.from(
          new Set(
            [...freeTextOptions, ...approvedPackSizes, asNum(next.packSize)].filter(
              (n) => n > 0
            )
          )
        ).sort((a, b) => a - b);

        next.packSizeOptionsList = merged;
      }

      if (field === "packSize") {
        const merged = Array.from(
          new Set(
            [...(next.packSizeOptionsList || []), ...approvedPackSizes, asNum(value)].filter(
              (n) => n > 0
            )
          )
        ).sort((a, b) => a - b);

        next.packSizeOptionsList = merged;
        next.packSizeOptions = merged.join(", ");
      }

      const derived = deriveModalState({
        ...next,
        packSize: field === "packSize" ? asNum(value) : asNum(next.packSize),
        readyPacksCount:
          field === "readyPacksCount" ? asNum(value) : asNum(next.readyPacksCount),
        looseStockQty:
          field === "looseStockQty" ? asNum(value) : asNum(next.looseStockQty),
      });

      return {
        ...next,
        packagedStockQty: derived.packagedStockQty,
        availablePackagedQty: derived.availablePackagedQty,
        availableLooseQty: derived.availableLooseQty,
      };
    });
  };

  const handleSaveStock = async () => {
    if (!modalForm) return;
    if (!canManageStock) {
      setModalError("Only stock@ridosports.com or admin can update stock line items.");
      return;
    }

    setSaving(true);
    setModalNotice("");
    setModalError("");

    try {
      if (!safeStr(modalForm.location)) {
        throw new Error("Location is required and cannot be changed during update.");
      }

      const payload = {
        action: "setStock",
        data: {
          role: user.role || "",
          timestamp: modalForm.timestamp || "",
          skuCode: modalForm.skuCode || "",
          category: modalForm.category,
          materialName: modalForm.materialName,
          variant: modalForm.variant || "",
          location: safeStr(modalForm.location),
          unit: modalForm.unit,
          packSize: asNum(modalForm.packSize),
          packSizeOptions: safeStr(modalForm.packSizeOptions),
          readyPacksCount: asNum(modalForm.readyPacksCount),
          packagedStockQty: asNum(modalForm.packagedStockQty),
          looseStockQty: asNum(modalForm.looseStockQty),
          minStockLevel: asNum(modalForm.minStockLevel),
          active: safeStr(modalForm.active || "TRUE"),
          doneBy: user.username || "",
          notes: "Row-wise stock update from Stock Management modal",
        },
      };

      await apiPostNoCors(apiUrl, payload);

      const verifyRows = await apiGet(apiUrl, {
        action: "getStock",
        category: modalForm.category || "",
      });

      const matched = (Array.isArray(verifyRows) ? verifyRows : []).find((row) => {
        const rowSku = safeStr(row.skuCode || row["SKU Code"]);
        const rowVariant = safeStr(row.variant || row["Variant"]);
        const rowLocation = getLocationValue(row);

        return (
          normalizeKey(rowSku) === normalizeKey(modalForm.skuCode || "") &&
          normalizeKey(rowVariant) === normalizeKey(modalForm.variant || "") &&
          normalizeKey(rowLocation) === normalizeKey(modalForm.location || "")
        );
      });

      const packagedOk = round2(matched?.packagedStockQty) === round2(modalForm.packagedStockQty);
      const looseOk = round2(matched?.looseStockQty) === round2(modalForm.looseStockQty);
      const minOk = round2(matched?.minStockLevel) === round2(modalForm.minStockLevel);

      if (!matched || !packagedOk || !looseOk || !minOk) {
        throw new Error("Save request sent, but stock row did not update. Please recheck SKU/location mapping in stock sheet.");
      }

      setModalNotice("✅ Stock updated successfully.");
      setGlobalNotice("✅ Stock row updated successfully.");

      setTimeout(() => {
        handleCloseModal();
        fetchStock();
      }, 700);
    } catch (e) {
      console.error("setStock error:", e);
      setModalError(`Save failed: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCreateModal = () => {
    if (!canManageStock) {
      setGlobalNotice("");
      setStockError("Only stock@ridosports.com or admin can add stock line items.");
      return;
    }

    setCreateForm(buildNewMaterialState(category));
    setCreateNotice("");
    setCreateError("");
    setOpenCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setOpenCreateModal(false);
    setCreateForm(buildNewMaterialState(category));
    setCreateNotice("");
    setCreateError("");
    setCreating(false);
  };

  const handleCreateChange = (field, value) => {
    setCreateForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "skuCode") {
        const sku = (skuRows || []).find(
          (row) => normalizeKey(row.skuCode) === normalizeKey(value)
        );

        if (sku) {
          next.skuCode = sku.skuCode;
          next.category = sku.category;
          next.materialName = sku.materialName;
          next.variant = sku.variant || "";
          next.unit = toUpper(sku.materialName) === "THINNER" ? "ltr" : "kg";
        }
      }

      if (field === "category") {
        next.skuCode = "";
        next.materialName = "";
        next.variant = "";
        next.unit = "";
      }

      if (field === "materialName") {
        const selectedMaterial = safeStr(value);
        const sku = (skuRows || []).find(
          (row) =>
            sameInventoryCategory(row.category, next.category) &&
            toUpper(row.materialName) === toUpper(selectedMaterial)
        );

        if (sku) {
          next.skuCode = sku.skuCode;
          next.variant = sku.variant || "";
        }

        next.unit = toUpper(selectedMaterial) === "THINNER" ? "ltr" : "kg";

        const defaultPack = getDefaultPackSize(selectedMaterial);

        if (defaultPack > 0 && asNum(next.packSize) <= 0) {
          next.packSize = defaultPack;

          next.packSizeOptionsList = Array.from(
            new Set([...(next.packSizeOptionsList || []), defaultPack])
          ).sort((a, b) => a - b);

          next.packSizeOptions = next.packSizeOptionsList.join(", ");
        }
      }

      if (field === "variant") {
        const sku = (skuRows || []).find(
          (row) =>
            sameInventoryCategory(row.category, next.category) &&
            normalizeKey(row.materialName) === normalizeKey(next.materialName) &&
            normalizeKey(row.variant) === normalizeKey(value)
        );

        if (sku) {
          next.skuCode = sku.skuCode;
        }
      }

      if (field === "packSizeOptions") {
        const freeTextOptions = parsePackSizeOptions(value);
        const merged = Array.from(
          new Set(
            [...freeTextOptions, ...approvedPackSizes, asNum(next.packSize)].filter(
              (n) => n > 0
            )
          )
        ).sort((a, b) => a - b);

        next.packSizeOptionsList = merged;
      }

      if (field === "packSize") {
        const merged = Array.from(
          new Set(
            [...(next.packSizeOptionsList || []), ...approvedPackSizes, asNum(value)].filter(
              (n) => n > 0
            )
          )
        ).sort((a, b) => a - b);

        next.packSizeOptionsList = merged;
      }

      const packSize = field === "packSize" ? asNum(value) : asNum(next.packSize);
      const readyPacksCount =
        field === "readyPacksCount" ? asNum(value) : asNum(next.readyPacksCount);
      const looseStockQty =
        field === "looseStockQty" ? asNum(value) : asNum(next.looseStockQty);

      next.packagedStockQty = round2(packSize * readyPacksCount);
      next.availablePackagedQty = round2(next.packagedStockQty);
      next.availableLooseQty = round2(looseStockQty);

      return next;
    });
  };

  const handleCalcRuleDraftChange = (field, value) => {
    setCalcRuleDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveCalcRule = async () => {
    if (!canManageCalcMatrix) {
      setCalcRuleError("Only calculation matrix admins can update calculation rules.");
      return;
    }

    if (!safeStr(calcRuleDraft.category) || !safeStr(calcRuleDraft.materialName)) {
      setCalcRuleError("Category and Material Name are required for a calculation rule.");
      return;
    }

    if (!safeStr(calcRuleDraft.calcType)) {
      setCalcRuleError("Calc Type is required.");
      return;
    }

    if (safeStr(calcRuleDraft.calcType) === "FORMULA") {
      if (!safeStr(calcRuleDraft.formula)) {
        setCalcRuleError("Formula is required for FORMULA rules.");
        return;
      }
    } else if (!safeStr(calcRuleDraft.baseRate)) {
      setCalcRuleError("Base Rate / Factor is required.");
      return;
    }

    setCalcRuleSaving(true);
    setCalcRuleNotice("");
    setCalcRuleError("");

    try {
      await apiPostNoCors(apiUrl, {
        action: "upsertCalcMatrixRule",
        data: {
          userEmail: user.email || user.username || "",
          updatedBy: user.username || user.email || "",
          rule: calcRuleDraft,
        },
      });

      setCalcRuleNotice("Calculation rule update submitted.");
      setTimeout(() => fetchCalcRules(createForm.category), 800);
    } catch (e) {
      console.error("upsertCalcMatrixRule error:", e);
      setCalcRuleError(`Rule update failed: ${e.message || e}`);
    } finally {
      setCalcRuleSaving(false);
    }
  };

  const handleCreateMaterial = async () => {
    if (!canManageStock) {
      setCreateError("Only stock@ridosports.com or admin can add stock line items.");
      return;
    }

    if (!safeStr(createForm.category)) {
      setCreateError("Category is required.");
      return;
    }

    if (!safeStr(createForm.materialName)) {
      setCreateError("Material Name is required.");
      return;
    }

    if (!safeStr(createForm.unit)) {
      setCreateError("Unit is required.");
      return;
    }

    const selectedLocations = Array.isArray(createForm.location)
      ? createForm.location.map((loc) => safeStr(loc)).filter(Boolean)
      : safeStr(createForm.location)
        ? [safeStr(createForm.location)]
        : [];

    if (selectedLocations.length === 0) {
      setCreateError("At least one stock location is required.");
      return;
    }

    if (asNum(createForm.packSize) <= 0) {
      setCreateError("Pack Size is required.");
      return;
    }

    setCreating(true);
    setCreateNotice("");
    setCreateError("");

    try {
      const storedCategory = mapCreateCategoryToStoredCategory(createForm.category);

      await Promise.all(
        selectedLocations.map((location) => {
          const payload = {
            action: "createStockItem",
            data: {
              role: user.role || "",
              skuCode: createForm.skuCode || "",
              category: storedCategory,
              materialName: createForm.materialName,
              variant: createForm.variant || "",
              location,
              unit: createForm.unit,
              packSize: asNum(createForm.packSize),
              packSizeOptions: safeStr(createForm.packSizeOptions),
              readyPacksCount: asNum(createForm.readyPacksCount),
              packagedStockQty: asNum(createForm.packagedStockQty),
              looseStockQty: asNum(createForm.looseStockQty),
              minStockLevel: asNum(createForm.minStockLevel),
              active: safeStr(createForm.active || "TRUE"),
              doneBy: user.username || "",
              notes: "New stock item created from Stock Management",
            },
          };

          console.log("createStockItem payload =>", payload);
          return apiPostNoCors(apiUrl, payload);
        })
      );

      setCreateNotice("✅ Material submission sent for selected location(s).");
      setGlobalNotice("✅ Material submission sent for selected location(s). Refreshing stock...");

      setTimeout(() => {
        handleCloseCreateModal();
        fetchStock();
      }, 1000);
    } catch (e) {
      console.error("createStockItem error:", e);
      setCreateError(`Create failed: ${e.message || e}`);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenToggleModal = (row) => {
    setToggleRow(row);
    setToggleError("");
    setOpenToggleModal(true);
  };

  const handleCloseToggleModal = () => {
    setOpenToggleModal(false);
    setToggleRow(null);
    setToggleError("");
    setToggleLoading(false);
  };

  const handleToggleActive = async () => {
    if (!toggleRow) return;
    if (!canManageStock) {
      setToggleError("Only stock@ridosports.com or admin can change stock line item status.");
      return;
    }

    setToggleLoading(true);
    setToggleError("");

    try {
      const nextActive = toUpper(toggleRow.active) === "TRUE" ? "FALSE" : "TRUE";

      const payload = {
        action: "toggleStockItemActive",
        data: {
          role: user.role || "",
          skuCode: toggleRow.skuCode || "",
          category: toggleRow.category,
          materialName: toggleRow.materialName,
          variant: toggleRow.variant || "",
          location: safeStr(toggleRow.location),
          active: nextActive,
          doneBy: user.username || "",
          notes:
            nextActive === "FALSE"
              ? "Stock item deactivated from Stock Management"
              : "Stock item reactivated from Stock Management",
        },
      };

      await apiPostNoCors(apiUrl, payload);

      setGlobalNotice(
        nextActive === "FALSE"
          ? "✅ Material deactivated successfully."
          : "✅ Material reactivated successfully."
      );

      setTimeout(() => {
        handleCloseToggleModal();
        fetchStock();
      }, 800);
    } catch (e) {
      console.error("toggleStockItemActive error:", e);
      setToggleError(`Action failed: ${e.message || e}`);
    } finally {
      setToggleLoading(false);
    }
  };

  const handleOpenTransferModal = (row) => {
    setTransferForm({
      ...row,
      fromLocation: row.location || "",
      toLocation: "",
      transferPackagedQty: 0,
      transferLooseQty: 0,
      notes: "Stock transfer from Stock Management",
    });
    setTransferError("");
    setOpenTransferModal(true);
  };

  const handleCloseTransferModal = () => {
    setOpenTransferModal(false);
    setTransferForm(null);
    setTransferError("");
    setTransferLoading(false);
  };

  const handleTransferChange = (field, value) => {
    setTransferForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSubmitTransfer = async () => {
    if (!transferForm) return;
    if (!canManageStock) {
      setTransferError("Only stock@ridosports.com or admin can transfer stock.");
      return;
    }

    const fromLocation = safeStr(transferForm.fromLocation);
    const toLocation = safeStr(transferForm.toLocation);
    const transferPackagedQty = asNum(transferForm.transferPackagedQty);
    const transferLooseQty = asNum(transferForm.transferLooseQty);

    if (!fromLocation) {
      setTransferError("Source location is required.");
      return;
    }

    if (!toLocation) {
      setTransferError("Destination location is required.");
      return;
    }

    if (normalizeKey(fromLocation) === normalizeKey(toLocation)) {
      setTransferError("Source and destination locations must be different.");
      return;
    }

    if (transferPackagedQty <= 0 && transferLooseQty <= 0) {
      setTransferError("Enter packaged qty or loose qty to transfer.");
      return;
    }

    if (transferPackagedQty > asNum(transferForm.availablePackagedQty)) {
      setTransferError("Transfer packaged qty cannot exceed available packaged qty.");
      return;
    }

    if (transferLooseQty > asNum(transferForm.availableLooseQty)) {
      setTransferError("Transfer loose qty cannot exceed available loose qty.");
      return;
    }

    setTransferLoading(true);
    setTransferError("");

    try {
      await apiPostNoCors(apiUrl, {
        action: "transferStock",
        data: {
          role: user.role || "",
          skuCode: transferForm.skuCode || "",
          category: transferForm.category,
          materialName: transferForm.materialName,
          variant: transferForm.variant || "",
          fromLocation,
          toLocation,
          unit: transferForm.unit,
          packSize: asNum(transferForm.packSize),
          packSizeOptions: safeStr(transferForm.packSizeOptions),
          packagedQty: transferPackagedQty,
          looseQty: transferLooseQty,
          minStockLevel: asNum(transferForm.minStockLevel),
          active: safeStr(transferForm.active || "TRUE"),
          doneBy: user.username || "",
          notes: safeStr(transferForm.notes || "Stock transfer from Stock Management"),
        },
      });

      setGlobalNotice("✅ Stock transfer submitted. Refreshing stock...");

      setTimeout(() => {
        handleCloseTransferModal();
        fetchStock();
      }, 900);
    } catch (e) {
      console.error("transferStock error:", e);
      setTransferError(`Transfer failed: ${e.message || e}`);
    } finally {
      setTransferLoading(false);
    }
  };

  const totalRows = filteredRows.length;
  const totalMaterials = materialRows.length;
  const lowStockCount = filteredRows.filter(
    (row) =>
      asNum(row.minStockLevel) > 0 &&
      asNum(row.availablePackagedQty + row.availableLooseQty) <= asNum(row.minStockLevel)
  ).length;

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
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
          flexWrap="wrap"
        >
          <Box display="flex" alignItems="center" gap={2}>
            <img
              src={logoSrc}
              alt="Klient Konnect"
              style={{ height: 56, objectFit: "contain" }}
            />
            <Box>
              <Typography
                variant="h5"
                sx={{ fontFamily, fontWeight: 700, color: cornflowerBlue }}
              >
                {title}
              </Typography>
              <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.8 }}>
                Manage ready packs and loose stock row-wise for inventory materials.
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateModal}
              disabled={!canManageStock}
              sx={{
                textTransform: "none",
                fontFamily,
                backgroundColor: cornflowerBlue,
              }}
            >
              Add Material
            </Button>

            <Tooltip title="Refresh stock">
              <IconButton onClick={fetchStock}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>

            {stockLoading || validationLoading ? <CircularProgress size={18} /> : null}
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
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                sx={{ fontFamily }}
              >
                <MenuItem value="ALL">ALL</MenuItem>
                {categoryOptions.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Location</InputLabel>
              <Select
                label="Location"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                sx={{ fontFamily }}
              >
                <MenuItem value="ALL">ALL</MenuItem>
                {locationOptions.map((loc) => (
                  <MenuItem key={loc} value={loc}>
                    {loc}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>View</InputLabel>
              <Select
                label="View"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                sx={{ fontFamily }}
              >
                <MenuItem value="ROWS">Location Rows</MenuItem>
                <MenuItem value="MATERIALS">Material View</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Search Material"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ fontFamily }}
              inputProps={{ style: { fontFamily } }}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <Box
              display="flex"
              justifyContent={{ xs: "flex-start", md: "flex-end" }}
              gap={1}
              flexWrap="wrap"
            >
              <Chip
                icon={<Inventory2Icon />}
                label={`Rows: ${totalRows}`}
                size="small"
                sx={{ fontFamily }}
              />
              <Chip
                label={`Materials: ${totalMaterials}`}
                size="small"
                sx={{ fontFamily }}
              />
              <Chip
                label={canManageStock ? "Stock access enabled" : "View only"}
                size="small"
                color={canManageStock ? "success" : "default"}
                sx={{ fontFamily }}
              />
              <Chip
                label={`Low Stock: ${lowStockCount}`}
                size="small"
                color={lowStockCount > 0 ? "warning" : "success"}
                sx={{ fontFamily }}
              />
            </Box>
          </Grid>
        </Grid>

        {globalNotice ? (
          <Box mt={2}>
            <Alert severity="success" sx={{ fontFamily }}>
              {globalNotice}
            </Alert>
          </Box>
        ) : null}

        {stockError ? (
          <Box mt={2}>
            <Alert severity="error" sx={{ fontFamily }}>
              {stockError}
            </Alert>
          </Box>
        ) : null}
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Inventory2Icon sx={{ color: cornflowerBlue }} />
          <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>
            {viewMode === "MATERIALS" ? "Inventory Stock by Material" : "Inventory Stock by Location"}
          </Typography>
        </Box>

        {stockLoading ? (
          <Box display="flex" alignItems="center" gap={1}>
            <CircularProgress size={16} />
            <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>
              Loading stock…
            </Typography>
          </Box>
        ) : filteredRows.length === 0 ? (
          <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.75 }}>
            No stock rows found.
          </Typography>
        ) : viewMode === "MATERIALS" ? (
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "rgba(100,149,237,0.10)" }}>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>SKU</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Material</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Variant</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Sites</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Unit</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Packaged Stock Qty (Kg/Litre)
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Packages Available
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Loose Stock Qty (Kg/Litre)
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Reserved Packaged
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Reserved Loose
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Available Packaged Qty
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Available Loose Qty
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Min Stock
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Active Sites</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {materialRows.map((row) => {
                  const totalAvailable = round2(
                    asNum(row.availablePackagedQty) + asNum(row.availableLooseQty)
                  );
                  const isLowStock =
                    asNum(row.minStockLevel) > 0 && totalAvailable <= asNum(row.minStockLevel);

                  return (
                    <TableRow key={row.id}>
                      <TableCell sx={{ fontFamily }}>{row.skuCode || "-"}</TableCell>
                      <TableCell sx={{ fontFamily }}>{row.category}</TableCell>
                      <TableCell sx={{ fontFamily }}>{row.materialName}</TableCell>
                      <TableCell sx={{ fontFamily }}>{row.variant || "-"}</TableCell>
                      <TableCell sx={{ fontFamily, minWidth: 220 }}>
                        <Box display="flex" gap={0.5} flexWrap="wrap">
                          {row.locations.map((locRow) => (
                            <Chip
                              key={locRow.id}
                              size="small"
                              label={`${locRow.location || "-"}: ${round2(locRow.availablePackagedQty)} packaged / ${round2(locRow.availableLooseQty)} loose`}
                              color={toUpper(locRow.active) === "TRUE" ? "default" : "warning"}
                              sx={{ fontFamily }}
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontFamily }}>{row.unit}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.packagedStockQty)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.packagesAvailable)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.looseStockQty)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.reservedPackagedQty)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.reservedLooseQty)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        <Chip
                          size="small"
                          label={round2(row.availablePackagedQty)}
                          color={isLowStock ? "warning" : "default"}
                          sx={{ fontFamily }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.availableLooseQty)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.minStockLevel)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }}>
                        {row.activeCount} / {row.rowCount}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "rgba(100,149,237,0.10)" }}>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>SKU</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Material</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Variant</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Location</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Unit</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Pack Size
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Packaged Stock Qty (Kg/Litre)
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Packages Available
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Loose Stock Qty (Kg/Litre)
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Reserved Packaged
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Reserved Loose
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Available Packaged Qty
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Available Loose Qty
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Min Stock
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Active</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="center">
                    Update
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="center">
                    Transfer
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="center">
                    Deactivate
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredRows.map((row) => {
                  const totalAvailable = round2(
                    asNum(row.availablePackagedQty) + asNum(row.availableLooseQty)
                  );
                  const isLowStock =
                    asNum(row.minStockLevel) > 0 && totalAvailable <= asNum(row.minStockLevel);
                  const isActive = toUpper(row.active) === "TRUE";

                  return (
                    <TableRow key={row.id}>
                      <TableCell sx={{ fontFamily }}>{row.skuCode || "-"}</TableCell>
                      <TableCell sx={{ fontFamily }}>{row.category}</TableCell>
                      <TableCell sx={{ fontFamily }}>{row.materialName}</TableCell>
                      <TableCell sx={{ fontFamily }}>{row.variant || "-"}</TableCell>
                      <TableCell sx={{ fontFamily }}>{row.location || "-"}</TableCell>
                      <TableCell sx={{ fontFamily }}>{row.unit}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.packSize)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.packagedStockQty)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.packagesAvailable)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.looseStockQty)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.reservedPackagedQty)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.reservedLooseQty)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        <Chip
                          size="small"
                          label={round2(row.availablePackagedQty)}
                          color={isLowStock ? "warning" : "default"}
                          sx={{ fontFamily }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.availableLooseQty)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(row.minStockLevel)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }}>
                        <Chip
                          size="small"
                          label={isActive ? "TRUE" : "FALSE"}
                          color={isActive ? "success" : "default"}
                          sx={{ fontFamily }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Update Stock">
                          <IconButton onClick={() => handleOpenModal(row)} disabled={!canManageStock}>
                            <EditIcon sx={{ color: cornflowerBlue }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Transfer Stock">
                          <IconButton onClick={() => handleOpenTransferModal(row)} disabled={!canManageStock || !isActive}>
                            <SwapHorizIcon sx={{ color: cornflowerBlue }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={isActive ? "Deactivate Material" : "Reactivate Material"}>
                          <IconButton onClick={() => handleOpenToggleModal(row)} disabled={!canManageStock}>
                            {isActive ? (
                              <ToggleOffIcon sx={{ color: "#d97706" }} />
                            ) : (
                              <ToggleOnIcon sx={{ color: "green" }} />
                            )}
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

      {/* Update Stock Modal */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle
          sx={{
            fontFamily,
            px: 3,
            py: 2,
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            backgroundColor: "rgba(100,149,237,0.08)",
          }}
        >
          <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2}>
            <Box>
              <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>
                Update Stock
              </Typography>
              <Typography sx={{ fontFamily, fontSize: 12, color: "rgba(31,42,68,0.72)", mt: 0.3 }}>
                {modalForm?.materialName || "Selected material"}
                {modalForm?.category ? ` | ${modalForm.category}` : ""}
              </Typography>
            </Box>

            {modalForm ? (
              <Chip
                size="small"
                label={toUpper(modalForm.active) === "TRUE" ? "Active" : "Inactive"}
                color={toUpper(modalForm.active) === "TRUE" ? "success" : "default"}
                sx={{ fontFamily, fontWeight: 600 }}
              />
            ) : null}
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3, backgroundColor: "#fbfcff" }}>
          {modalForm ? (
            <Box>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 2,
                  borderRadius: 2,
                  border: "1px solid rgba(100,149,237,0.22)",
                  backgroundColor: "#ffffff",
                }}
              >
                <Typography
                  sx={{
                    fontFamily,
                    fontSize: 12,
                    fontWeight: 700,
                    color: cornflowerBlue,
                    textTransform: "uppercase",
                    mb: 1.5,
                  }}
                >
                  Material Details
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        backgroundColor: "rgba(100,149,237,0.06)",
                      }}
                    >
                      <Typography sx={{ fontFamily, fontSize: 11, opacity: 0.65 }}>
                        SKU
                      </Typography>
                      <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>
                        {modalForm.skuCode || "-"}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        backgroundColor: "rgba(100,149,237,0.06)",
                      }}
                    >
                      <Typography sx={{ fontFamily, fontSize: 11, opacity: 0.65 }}>
                        Category
                      </Typography>
                      <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>
                        {modalForm.category || "-"}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        backgroundColor: "rgba(100,149,237,0.06)",
                      }}
                    >
                      <Typography sx={{ fontFamily, fontSize: 11, opacity: 0.65 }}>
                        Material Name
                      </Typography>
                      <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>
                        {modalForm.materialName || "-"}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        backgroundColor: "rgba(100,149,237,0.06)",
                      }}
                    >
                      <Typography sx={{ fontFamily, fontSize: 11, opacity: 0.65 }}>
                        Variant
                      </Typography>
                      <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>
                        {modalForm.variant || "-"}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Location"
                      value={modalForm.location || ""}
                      sx={{ fontFamily }}
                      inputProps={{ style: { fontFamily }, readOnly: true }}
                      helperText="Location cannot be changed in Update. Deactivate and create a new row for a different location."
                      FormHelperTextProps={{ sx: { fontFamily, m: 0.5 } }}
                    />
                  </Grid>

                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Unit"
                      value={modalForm.unit}
                      onChange={(e) => handleModalChange("unit", e.target.value)}
                      sx={{ fontFamily }}
                      inputProps={{ style: { fontFamily } }}
                    />
                  </Grid>

                  <Grid item xs={12} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Active</InputLabel>
                      <Select
                        label="Active"
                        value={modalForm.active}
                        onChange={(e) => handleModalChange("active", e.target.value)}
                        sx={{ fontFamily }}
                      >
                        <MenuItem value="TRUE">TRUE</MenuItem>
                        <MenuItem value="FALSE">FALSE</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 2,
                  borderRadius: 2,
                  border: "1px solid rgba(0,0,0,0.08)",
                  backgroundColor: "#ffffff",
                }}
              >
                <Typography
                  sx={{
                    fontFamily,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#1f2a44",
                    textTransform: "uppercase",
                    mb: 1.5,
                  }}
                >
                  Stock Details
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Pack Size Options"
                      value={modalForm.packSizeOptions}
                      onChange={(e) => handleModalChange("packSizeOptions", e.target.value)}
                      sx={{ fontFamily }}
                      inputProps={{ style: { fontFamily } }}
                      placeholder="25|50|100"
                      helperText="Use | or commas between values"
                      FormHelperTextProps={{ sx: { fontFamily, m: 0.5 } }}
                    />
                  </Grid>

                  <Grid item xs={12} md={4}>
                    {(modalForm.packSizeOptionsList?.length || approvedPackSizes.length) ? (
                      <FormControl fullWidth size="small">
                        <InputLabel>Pack Size</InputLabel>
                        <Select
                          label="Pack Size"
                          value={modalForm.packSize}
                          onChange={(e) => handleModalChange("packSize", e.target.value)}
                          sx={{ fontFamily }}
                        >
                          {Array.from(
                            new Set([
                              ...(modalForm.packSizeOptionsList || []),
                              ...(approvedPackSizes || []),
                            ])
                          )
                            .filter((ps) => asNum(ps) > 0)
                            .sort((a, b) => a - b)
                            .map((ps) => (
                              <MenuItem key={ps} value={ps}>
                                {ps}
                              </MenuItem>
                            ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Pack Size"
                        value={modalForm.packSize}
                        onChange={(e) => handleModalChange("packSize", e.target.value)}
                        sx={{ fontFamily }}
                        inputProps={{ style: { fontFamily } }}
                      />
                    )}
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Packages Available"
                      value={modalForm.readyPacksCount}
                      onChange={(e) => handleModalChange("readyPacksCount", e.target.value)}
                      sx={{ fontFamily }}
                      inputProps={{ style: { fontFamily } }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Loose Stock Qty (Kg/Litre)"
                      value={modalForm.looseStockQty}
                      onChange={(e) => handleModalChange("looseStockQty", e.target.value)}
                      sx={{ fontFamily }}
                      inputProps={{ style: { fontFamily } }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Min Stock Level"
                      value={modalForm.minStockLevel}
                      onChange={(e) => handleModalChange("minStockLevel", e.target.value)}
                      sx={{ fontFamily }}
                      inputProps={{ style: { fontFamily } }}
                    />
                  </Grid>
                </Grid>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid rgba(100,149,237,0.22)",
                  backgroundColor: "rgba(100,149,237,0.06)",
                }}
              >
                <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} mb={1.5}>
                  <Typography
                    sx={{
                      fontFamily,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#1f2a44",
                      textTransform: "uppercase",
                    }}
                  >
                    Calculated Stock Preview
                  </Typography>
                  <Chip
                    size="small"
                    label={`Packaged Stock Qty (Kg/Litre): ${round2(modalForm.packagedStockQty)}`}
                    sx={{
                      fontFamily,
                      fontWeight: 600,
                      color: "#1f2a44",
                      backgroundColor: "#ffffff",
                    }}
                  />
                </Box>

                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6} md={4}>
                    <Box sx={{ p: 1.5, borderRadius: 1, backgroundColor: "#ffffff" }}>
                      <Typography sx={{ fontFamily, fontSize: 11, opacity: 0.65 }}>
                        Reserved Packaged
                      </Typography>
                      <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>
                        {round2(modalForm.reservedPackagedQty)}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6} md={4}>
                    <Box sx={{ p: 1.5, borderRadius: 1, backgroundColor: "#ffffff" }}>
                      <Typography sx={{ fontFamily, fontSize: 11, opacity: 0.65 }}>
                        Reserved Loose
                      </Typography>
                      <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>
                        {round2(modalForm.reservedLooseQty)}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6} md={4}>
                    <Box sx={{ p: 1.5, borderRadius: 1, backgroundColor: "#ffffff" }}>
                      <Typography sx={{ fontFamily, fontSize: 11, opacity: 0.65 }}>
                        Packaged Stock Qty (Kg/Litre)
                      </Typography>
                      <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>
                        {round2(modalForm.packagedStockQty)}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.5, borderRadius: 1, backgroundColor: "#ffffff" }}>
                      <Typography sx={{ fontFamily, fontSize: 11, opacity: 0.65 }}>
                        Available Packaged Qty
                      </Typography>
                      <Typography sx={{ fontFamily, fontWeight: 700, color: cornflowerBlue }}>
                        {round2(modalForm.availablePackagedQty)}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.5, borderRadius: 1, backgroundColor: "#ffffff" }}>
                      <Typography sx={{ fontFamily, fontSize: 11, opacity: 0.65 }}>
                        Available Loose Qty
                      </Typography>
                      <Typography sx={{ fontFamily, fontWeight: 700, color: cornflowerBlue }}>
                        {round2(modalForm.availableLooseQty)}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>

              {modalNotice ? (
                <Box mt={2}>
                  <Alert severity="success" sx={{ fontFamily }}>
                    {modalNotice}
                  </Alert>
                </Box>
              ) : null}

              {modalError ? (
                <Box mt={2}>
                  <Alert severity="error" sx={{ fontFamily }}>
                    {modalError}
                  </Alert>
                </Box>
              ) : null}
            </Box>
          ) : null}
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: "1px solid rgba(0,0,0,0.08)",
            backgroundColor: "#ffffff",
          }}
        >
          <Button onClick={handleCloseModal} sx={{ textTransform: "none", fontFamily }}>
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSaveStock}
            disabled={!modalForm || saving || !canManageStock}
            sx={{
              textTransform: "none",
              fontFamily,
              backgroundColor: cornflowerBlue,
              boxShadow: "none",
              "&:hover": {
                backgroundColor: "#4f7fd4",
                boxShadow: "none",
              },
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Material Modal */}
      <Dialog open={openCreateModal} onClose={handleCloseCreateModal} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontFamily, fontWeight: 700 }}>Add Material</DialogTitle>
        <DialogContent dividers>
          <Box>
            <Grid container spacing={2}>
              {createSkuOptions.length ? (
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>SKU</InputLabel>
                    <Select
                      label="SKU"
                      value={createForm.skuCode || ""}
                      onChange={(e) => handleCreateChange("skuCode", e.target.value)}
                      sx={{ fontFamily }}
                    >
                      <MenuItem value="">Select SKU</MenuItem>
                      {createSkuOptions.map((sku) => (
                        <MenuItem key={sku.skuCode || sku.label} value={sku.skuCode}>
                          {sku.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              ) : null}

              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    label="Category"
                    value={createForm.category}
                    onChange={(e) => handleCreateChange("category", e.target.value)}
                    sx={{ fontFamily }}
                  >
                    {createCategoryOptions.map((cat) => (
                      <MenuItem key={cat} value={cat}>
                        {cat}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                {createVariantOptions.length ? (
                  <FormControl fullWidth size="small">
                    <InputLabel>Variant</InputLabel>
                    <Select
                      label="Variant"
                      value={createForm.variant || ""}
                      onChange={(e) => handleCreateChange("variant", e.target.value)}
                      sx={{ fontFamily }}
                    >
                      <MenuItem value="">Select Variant</MenuItem>
                      {createVariantOptions.map((variant) => (
                        <MenuItem key={variant} value={variant}>
                          {variant}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    label="Variant"
                    value={createForm.variant || ""}
                    onChange={(e) => handleCreateChange("variant", e.target.value)}
                    sx={{ fontFamily }}
                    inputProps={{ style: { fontFamily } }}
                  />
                )}
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Material Name</InputLabel>
                  <Select
                    label="Material Name"
                    value={createForm.materialName}
                    onChange={(e) => handleCreateChange("materialName", e.target.value)}
                    sx={{ fontFamily }}
                    disabled={!createForm.category}
                  >
                    {createMaterialOptions.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Unit"
                  value={createForm.unit}
                  sx={{ fontFamily }}
                  inputProps={{ style: { fontFamily }, readOnly: true }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                {locationOptions.length ? (
                  <FormControl fullWidth size="small">
                    <InputLabel>Location(s)</InputLabel>
                    <Select
                      multiple
                      label="Location(s)"
                      value={Array.isArray(createForm.location) ? createForm.location : createForm.location ? [createForm.location] : []}
                      onChange={(e) => handleCreateChange("location", e.target.value)}
                      renderValue={(selected) => selected.join(", ")}
                      sx={{ fontFamily }}
                    >
                      {locationOptions.map((loc) => (
                        <MenuItem key={loc} value={loc}>
                          <Checkbox
                            checked={
                              Array.isArray(createForm.location)
                                ? createForm.location.includes(loc)
                                : createForm.location === loc
                            }
                          />
                          <ListItemText primary={loc} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    label="Location"
                    value={createForm.location}
                    onChange={(e) => handleCreateChange("location", e.target.value)}
                    sx={{ fontFamily }}
                    inputProps={{ style: { fontFamily } }}
                  />
                )}
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Pack Size Options"
                  value={createForm.packSizeOptions}
                  onChange={(e) => handleCreateChange("packSizeOptions", e.target.value)}
                  sx={{ fontFamily }}
                  inputProps={{ style: { fontFamily } }}
                  placeholder="25|50|100"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                {(createForm.packSizeOptionsList?.length || approvedPackSizes.length) ? (
                  <FormControl fullWidth size="small">
                    <InputLabel>Pack Size</InputLabel>
                    <Select
                      label="Pack Size"
                      value={createForm.packSize}
                      onChange={(e) => handleCreateChange("packSize", e.target.value)}
                      sx={{ fontFamily }}
                    >
                      {Array.from(
                        new Set([
                          ...(createForm.packSizeOptionsList || []),
                          ...(approvedPackSizes || []),
                        ])
                      )
                        .filter((ps) => asNum(ps) > 0)
                        .sort((a, b) => a - b)
                        .map((ps) => (
                          <MenuItem key={ps} value={ps}>
                            {ps}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Pack Size"
                    value={createForm.packSize}
                    onChange={(e) => handleCreateChange("packSize", e.target.value)}
                    sx={{ fontFamily }}
                    inputProps={{ style: { fontFamily } }}
                  />
                )}
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Packages Available"
                  value={createForm.readyPacksCount}
                  onChange={(e) => handleCreateChange("readyPacksCount", e.target.value)}
                  sx={{ fontFamily }}
                  inputProps={{ style: { fontFamily } }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Loose Stock Qty (Kg/Litre)"
                  value={createForm.looseStockQty}
                  onChange={(e) => handleCreateChange("looseStockQty", e.target.value)}
                  sx={{ fontFamily }}
                  inputProps={{ style: { fontFamily } }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Min Stock Level"
                  value={createForm.minStockLevel}
                  onChange={(e) => handleCreateChange("minStockLevel", e.target.value)}
                  sx={{ fontFamily }}
                  inputProps={{ style: { fontFamily } }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Active</InputLabel>
                  <Select
                    label="Active"
                    value={createForm.active}
                    onChange={(e) => handleCreateChange("active", e.target.value)}
                    sx={{ fontFamily }}
                  >
                    <MenuItem value="TRUE">TRUE</MenuItem>
                    <MenuItem value="FALSE">FALSE</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: "1px solid rgba(100,149,237,0.22)",
                    backgroundColor: "#fbfcff",
                  }}
                >
                  <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap" mb={1.5}>
                    <Box>
                      <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>
                        Calculation Matrix
                      </Typography>
                      <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.72 }}>
                        {selectedCalcRule
                          ? "This material is mapped to an inventory calculation rule."
                          : "No calculation rule is currently mapped for this material."}
                      </Typography>
                    </Box>
                    {calcRulesLoading ? <CircularProgress size={16} /> : null}
                  </Box>

                  {!canManageCalcMatrix ? (
                    selectedCalcRule ? (
                      <Grid container spacing={1.5}>
                        <Grid item xs={12} md={3}>
                          <Chip label={`Variant: ${safeStr(selectedCalcRule.variant) || "DEFAULT"}`} sx={{ fontFamily }} />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Chip label={`Calc: ${selectedCalcRule.calcType}`} sx={{ fontFamily }} />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Chip label={`Factor: ${selectedCalcRule.baseRate || "-"}`} sx={{ fontFamily }} />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Chip label={`Input: ${selectedCalcRule.inputKey || "-"}`} sx={{ fontFamily }} />
                        </Grid>
                      </Grid>
                    ) : (
                      <Alert severity="warning" sx={{ fontFamily }}>
                        Ask a calculation matrix admin to map this material before it is used in calculator-driven bookings.
                      </Alert>
                    )
                  ) : (
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Matrix Category"
                          value={calcRuleDraft.category}
                          onChange={(e) => handleCalcRuleDraftChange("category", e.target.value)}
                          sx={{ fontFamily }}
                          inputProps={{ style: { fontFamily } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Matrix Material"
                          value={calcRuleDraft.materialName}
                          onChange={(e) => handleCalcRuleDraftChange("materialName", e.target.value)}
                          sx={{ fontFamily }}
                          inputProps={{ style: { fontFamily } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Variant Group"
                          value={calcRuleDraft.variant}
                          onChange={(e) => handleCalcRuleDraftChange("variant", e.target.value)}
                          sx={{ fontFamily }}
                          inputProps={{ style: { fontFamily } }}
                          helperText="Use ALL VARIANTS for colors/shared rules"
                          FormHelperTextProps={{ sx: { fontFamily, m: 0.5 } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Unit"
                          value={calcRuleDraft.unit}
                          onChange={(e) => handleCalcRuleDraftChange("unit", e.target.value)}
                          sx={{ fontFamily }}
                          inputProps={{ style: { fontFamily } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Calc Type</InputLabel>
                          <Select
                            label="Calc Type"
                            value={calcRuleDraft.calcType}
                            onChange={(e) => handleCalcRuleDraftChange("calcType", e.target.value)}
                            sx={{ fontFamily }}
                          >
                            {DEFAULT_CALC_TYPES.map((type) => (
                              <MenuItem key={type} value={type}>
                                {type}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Base Rate / Factor"
                          value={calcRuleDraft.baseRate}
                          onChange={(e) => handleCalcRuleDraftChange("baseRate", e.target.value)}
                          sx={{ fontFamily }}
                          inputProps={{ style: { fontFamily } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Input Key"
                          value={calcRuleDraft.inputKey}
                          onChange={(e) => handleCalcRuleDraftChange("inputKey", e.target.value)}
                          sx={{ fontFamily }}
                          inputProps={{ style: { fontFamily } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Matrix Active</InputLabel>
                          <Select
                            label="Matrix Active"
                            value={calcRuleDraft.active}
                            onChange={(e) => handleCalcRuleDraftChange("active", e.target.value)}
                            sx={{ fontFamily }}
                          >
                            <MenuItem value="TRUE">TRUE</MenuItem>
                            <MenuItem value="FALSE">FALSE</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Depends On"
                          value={calcRuleDraft.dependsOn}
                          onChange={(e) => handleCalcRuleDraftChange("dependsOn", e.target.value)}
                          sx={{ fontFamily }}
                          inputProps={{ style: { fontFamily } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Formula"
                          value={calcRuleDraft.formula}
                          onChange={(e) => handleCalcRuleDraftChange("formula", e.target.value)}
                          sx={{ fontFamily }}
                          inputProps={{ style: { fontFamily } }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Box display="flex" justifyContent="flex-end">
                          <Button
                            variant="outlined"
                            startIcon={calcRuleSaving ? <CircularProgress size={16} /> : <SaveIcon />}
                            onClick={handleSaveCalcRule}
                            disabled={calcRuleSaving}
                            sx={{ textTransform: "none", fontFamily }}
                          >
                            Save Calculation Rule
                          </Button>
                        </Box>
                      </Grid>
                    </Grid>
                  )}

                  {calcRuleNotice ? (
                    <Box mt={2}>
                      <Alert severity="success" sx={{ fontFamily }}>
                        {calcRuleNotice}
                      </Alert>
                    </Box>
                  ) : null}

                  {calcRuleError ? (
                    <Box mt={2}>
                      <Alert severity="error" sx={{ fontFamily }}>
                        {calcRuleError}
                      </Alert>
                    </Box>
                  ) : null}
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>
                  Packaged Stock Qty (Kg/Litre)
                </Typography>
                <Typography sx={{ fontFamily, fontWeight: 600 }}>
                  {round2(createForm.packagedStockQty)}
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>
                  Available Packaged Qty
                </Typography>
                <Typography sx={{ fontFamily, fontWeight: 600 }}>
                  {round2(createForm.availablePackagedQty)}
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>
                  Available Loose Qty
                </Typography>
                <Typography sx={{ fontFamily, fontWeight: 600 }}>
                  {round2(createForm.availableLooseQty)}
                </Typography>
              </Grid>
            </Grid>

            {createNotice ? (
              <Box mt={2}>
                <Alert severity="success" sx={{ fontFamily }}>
                  {createNotice}
                </Alert>
              </Box>
            ) : null}

            {createError ? (
              <Box mt={2}>
                <Alert severity="error" sx={{ fontFamily }}>
                  {createError}
                </Alert>
              </Box>
            ) : null}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseCreateModal} sx={{ textTransform: "none", fontFamily }}>
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={creating ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleCreateMaterial}
            disabled={creating || !canManageStock}
            sx={{ textTransform: "none", fontFamily, backgroundColor: cornflowerBlue }}
          >
            Create Material
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer Stock Modal */}
      <Dialog open={openTransferModal} onClose={handleCloseTransferModal} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontFamily, fontWeight: 700 }}>Transfer Partial Stock</DialogTitle>
        <DialogContent dividers>
          {transferForm ? (
            <Box>
              <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44", mb: 0.5 }}>
                {transferForm.materialName}
              </Typography>
              <Typography sx={{ fontFamily, fontSize: 12, color: "rgba(31,42,68,0.72)", mb: 2 }}>
                {transferForm.category}
                {transferForm.variant ? ` | ${transferForm.variant}` : ""}
                {transferForm.skuCode ? ` | ${transferForm.skuCode}` : ""}
              </Typography>
              <Alert severity="info" sx={{ fontFamily, mb: 2 }}>
                Enter only the quantity to move. If the destination location does not already have this material row, it will be created automatically.
              </Alert>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="From Location"
                    value={transferForm.fromLocation}
                    sx={{ fontFamily }}
                    inputProps={{ style: { fontFamily }, readOnly: true }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  {locationOptions.length ? (
                    <FormControl fullWidth size="small">
                      <InputLabel>To Location</InputLabel>
                      <Select
                        label="To Location"
                        value={transferForm.toLocation}
                        onChange={(e) => handleTransferChange("toLocation", e.target.value)}
                        sx={{ fontFamily }}
                      >
                        {locationOptions
                          .filter((loc) => normalizeKey(loc) !== normalizeKey(transferForm.fromLocation))
                          .map((loc) => (
                            <MenuItem key={loc} value={loc}>
                              {loc}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      label="To Location"
                      value={transferForm.toLocation}
                      onChange={(e) => handleTransferChange("toLocation", e.target.value)}
                      sx={{ fontFamily }}
                      inputProps={{ style: { fontFamily } }}
                    />
                  )}
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Packaged Stock Qty (Kg/Litre) to Transfer"
                    value={transferForm.transferPackagedQty}
                    onChange={(e) => handleTransferChange("transferPackagedQty", e.target.value)}
                    sx={{ fontFamily }}
                    inputProps={{ style: { fontFamily } }}
                    helperText={`Available: ${round2(transferForm.availablePackagedQty)}`}
                    FormHelperTextProps={{ sx: { fontFamily, m: 0.5 } }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Loose Stock Qty (Kg/Litre) to Transfer"
                    value={transferForm.transferLooseQty}
                    onChange={(e) => handleTransferChange("transferLooseQty", e.target.value)}
                    sx={{ fontFamily }}
                    inputProps={{ style: { fontFamily } }}
                    helperText={`Available: ${round2(transferForm.availableLooseQty)}`}
                    FormHelperTextProps={{ sx: { fontFamily, m: 0.5 } }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Notes"
                    value={transferForm.notes}
                    onChange={(e) => handleTransferChange("notes", e.target.value)}
                    sx={{ fontFamily }}
                    inputProps={{ style: { fontFamily } }}
                  />
                </Grid>
              </Grid>

              {transferError ? (
                <Box mt={2}>
                  <Alert severity="error" sx={{ fontFamily }}>
                    {transferError}
                  </Alert>
                </Box>
              ) : null}
            </Box>
          ) : null}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseTransferModal} sx={{ textTransform: "none", fontFamily }}>
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={transferLoading ? <CircularProgress size={16} /> : <SwapHorizIcon />}
            onClick={handleSubmitTransfer}
            disabled={!transferForm || transferLoading || !canManageStock}
            sx={{ textTransform: "none", fontFamily, backgroundColor: cornflowerBlue }}
          >
            Transfer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toggle Active Modal */}
      <Dialog open={openToggleModal} onClose={handleCloseToggleModal} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontFamily, fontWeight: 700 }}>
          {toggleRow && toUpper(toggleRow.active) === "TRUE"
            ? "Deactivate Material"
            : "Reactivate Material"}
        </DialogTitle>

        <DialogContent dividers>
          {toggleRow ? (
            <Box>
              <Typography sx={{ fontFamily, mb: 1 }}>
                <b>Category:</b> {toggleRow.category}
              </Typography>
              <Typography sx={{ fontFamily, mb: 1 }}>
                <b>Material Name:</b> {toggleRow.materialName}
              </Typography>
              <Typography sx={{ fontFamily, mb: 1 }}>
                <b>Current Active Status:</b> {toggleRow.active}
              </Typography>
              <Typography sx={{ fontFamily, fontSize: 13, opacity: 0.85 }}>
                {toUpper(toggleRow.active) === "TRUE"
                  ? "This will deactivate the material so it stops appearing in active stock usage flows."
                  : "This will reactivate the material and make it available again in active stock usage flows."}
              </Typography>

              {toggleError ? (
                <Box mt={2}>
                  <Alert severity="error" sx={{ fontFamily }}>
                    {toggleError}
                  </Alert>
                </Box>
              ) : null}
            </Box>
          ) : null}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseToggleModal} sx={{ textTransform: "none", fontFamily }}>
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={
              toggleLoading ? (
                <CircularProgress size={16} />
              ) : toggleRow && toUpper(toggleRow.active) === "TRUE" ? (
                <ToggleOffIcon />
              ) : (
                <ToggleOnIcon />
              )
            }
            onClick={handleToggleActive}
            disabled={!toggleRow || toggleLoading || !canManageStock}
            sx={{
              textTransform: "none",
              fontFamily,
              backgroundColor: toUpper(toggleRow?.active) === "TRUE" ? "#d97706" : "green",
            }}
          >
            {toggleRow && toUpper(toggleRow.active) === "TRUE" ? "Deactivate" : "Reactivate"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
