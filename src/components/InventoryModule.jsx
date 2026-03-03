// src/components/InventoryModule.jsx
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
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
} from "@mui/material";

import RefreshIcon from "@mui/icons-material/Refresh";
import CalculateIcon from "@mui/icons-material/Calculate";
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";
import HistoryIcon from "@mui/icons-material/History";

const cornflowerBlue = "#6495ED";
const fontFamily = "Montserrat, sans-serif";

// ✅ Inventory Apps Script Web App URL
const INVENTORY_API_URL =
  "https://script.google.com/macros/s/AKfycbzEkxzsVYQWMdI7CmleY53U-O4C58b92wlCZnISqtv11L2YLcaRuiB0WGHWW1HlpsoG/exec";

// ---------- Helpers ----------
const safeStr = (v) => (v ?? "").toString().trim();
const toUpper = (v) => safeStr(v).toUpperCase();
const asNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(asNum(n) * 100) / 100;

function getUserFromLocalStorage() {
  // Adjust keys if your CRM uses different storage format
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

/**
 * ✅ JSONP helper (fixes CORS for GET calls to Apps Script Web App)
 * We will use this for:
 * - getValidation
 * - getInputs
 * - getCalcConfig
 * - getStock
 * - getBookings
 */
function jsonp(url, timeoutMs = 20000) {
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
    script.src = `${url}${sep}callback=${cb}`;
    script.async = true;

    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP load failed"));
    };

    document.body.appendChild(script);
  });
}

/**
 * ✅ GET via JSONP (returns json.data)
 * Requires GAS doGet to support ?callback=...
 */
async function apiGet(apiUrl, params) {
  const qs = new URLSearchParams(params);
  const payload = await jsonp(`${apiUrl}?${qs.toString()}`);
  if (!payload?.ok) throw new Error(payload?.error || "Request failed");
  return payload.data;
}

/**
 * ✅ POST with no-cors (opaque response; cannot read JSON)
 * Use for createBooking submission to avoid preflight/CORS blocks.
 */
async function apiPostNoCors(apiUrl, body) {
  await fetch(apiUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // no-cors response is opaque → cannot read bookingId from response
}

// ---------- Local Calculation Engine ----------
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

  // Build stock map by Material Name
  const stockMap = {};
  (stockRows || []).forEach((s) => {
    stockMap[s.materialName] = s;
  });

  const computed = {}; // materialName -> qty
  const items = [];

  const filteredCfg = (configRows || []).filter(
    (r) =>
      toUpper(r.category) === cat &&
      toUpper(r.variant) === varr &&
      toUpper(r.active) !== "FALSE"
  );

  // 1) Non-FORMULA first
  filteredCfg.forEach((row) => {
    if (row.calcType === "FORMULA") return;

    // Wear coat conditional rows
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

  // 2) FORMULA pass
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

  // 3) Packaging + availability (pack size from stock sheet)
  const withStock = items.map((it) => {
    const s = stockMap[it.materialName];

    const packSize = s ? asNum(s.packSize) : 0;
    const packsNeeded = packSize > 0 ? Math.ceil(it.requiredQty / packSize) : 0;
    const packagingQty = packSize > 0 ? packsNeeded * packSize : asNum(it.requiredQty);

    // Availability computed from stock qty - reserved qty (ignore available columns)
    const packaged = s ? asNum(s.packagedStockQty) : 0;
    const loose = s ? asNum(s.looseStockQty) : 0;
    const resPack = s ? asNum(s.reservedPackagedQty) : 0;
    const resLoose = s ? asNum(s.reservedLooseQty) : 0;

    const availPack = Math.max(0, packaged - resPack);
    const availLoose = Math.max(0, loose - resLoose);
    const availTotal = availPack + availLoose;

    const shortageQty = Math.max(0, asNum(it.requiredQty) - availTotal);

    return {
      ...it,
      packSize,
      packsNeeded,
      packagingQty: round2(packagingQty),
      availablePackagedQty: round2(availPack),
      availableLooseQty: round2(availLoose),
      availableTotalQty: round2(availTotal),
      shortageQty: round2(shortageQty),
      canFulfill: shortageQty <= 0,
    };
  });

  return { category: cat, variant: varr, area, wearCoatType, items: withStock };
}

// ---------- Component ----------
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

  const [calcResult, setCalcResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const [remarks, setRemarks] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingNotice, setBookingNotice] = useState("");

  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");

  // Variants from validation sheet (adjust header names if your validation uses different column headers)
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

  useEffect(() => {
    if (variantsList?.length && !variant) setVariant(variantsList[0]);
  }, [variantsList, variant]);

  // Load validation (JSONP)
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

  // Load inputs for category/variant (JSONP)
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

  // Load calc config (JSONP)
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

  // Load stock for category (JSONP)
  useEffect(() => {
    const run = async () => {
      if (!apiUrl || !category) return;
      setStockLoading(true);
      try {
        const st = await apiGet(apiUrl, { action: "getStock", category });
        setStockRows(Array.isArray(st) ? st : []);
      } catch (e) {
        console.error("getStock error:", e);
        setStockRows([]);
      } finally {
        setStockLoading(false);
      }
    };
    run();
  }, [apiUrl, category]);

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
      if (val === "" || val == null) out[key] = 0;
      else {
        const n = Number(val);
        out[key] = Number.isFinite(n) ? n : val;
      }
    });
    return out;
  }, [inputs, inputDefs]);

  const handleChangeInput = (key, value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const totals = useMemo(() => {
    const items = calcResult?.items || [];
    const totalRequired = items.reduce((s, it) => s + asNum(it.requiredQty), 0);
    const totalShort = items.reduce((s, it) => s + asNum(it.shortageQty), 0);
    const allFulfillable = items.every((it) => !!it.canFulfill);
    return {
      totalRequired: round2(totalRequired),
      totalShort: round2(totalShort),
      allFulfillable,
    };
  }, [calcResult]);

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

  const fetchBookings = async () => {
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
      setBookings([]);
      setBookingsError(
        "Bookings list endpoint is not enabled yet. Please add GAS action=getBookings."
      );
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    if (!apiUrl) return;
    fetchBookings();
  }, [apiUrl]);

  const handleCreateBooking = async () => {
    if (!calcResult?.items?.length) {
      alert("Please calculate first.");
      return;
    }

    setBookingLoading(true);
    setBookingNotice("");

    try {
      await apiPostNoCors(apiUrl, {
        action: "createBooking",
        data: {
          category,
          variant,
          requestedBy: user.username || "End User",
          inputs: normalizedInputs,
          remarks: remarks || "",
        },
      });

      setRemarks("");
      setBookingNotice("✅ Booking submitted successfully. Refreshing bookings…");

      // Best effort refresh (JSONP getBookings)
      setTimeout(() => fetchBookings(), 1200);
    } catch (e) {
      console.error("createBooking error:", e);
      alert(`Booking submission failed: ${e.message || e}`);
    } finally {
      setBookingLoading(false);
    }
  };

  const busy =
    validationLoading ||
    inputsLoading ||
    configLoading ||
    stockLoading ||
    calcLoading ||
    bookingLoading;

  return (
    <Box sx={{ p: 2, fontFamily }}>
      {/* Header */}
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
                Calculate material requirement, check stock availability, and book.
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

      {/* Controls */}
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
            <Box
              display="flex"
              gap={1}
              justifyContent={{ xs: "flex-start", md: "flex-end" }}
              flexWrap="wrap"
            >
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
                startIcon={
                  bookingLoading ? <CircularProgress size={16} /> : <ShoppingCartCheckoutIcon />
                }
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
            <Typography sx={{ fontSize: 12, opacity: 0.7, fontFamily }}>
              Loading inputs…
            </Typography>
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

      {/* Results */}
      <Paper
        elevation={0}
        sx={{ p: 2, mb: 2, borderRadius: 2, border: "1px solid rgba(0,0,0,0.08)" }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1} gap={2}>
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
                label={totals.allFulfillable ? "Fully Available" : "Partial / Short"}
                size="small"
                sx={{ fontFamily }}
                color={totals.allFulfillable ? "success" : "warning"}
              />
            </Box>
          ) : null}
        </Box>

        {!calcResult?.items?.length ? (
          <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.75 }}>
            Run <b>Calculate</b> to view materials and availability.
          </Typography>
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "rgba(100,149,237,0.10)" }}>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Material</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Unit</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Required
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Pack Size
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Packs
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Packaging Qty
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Available (Total)
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">
                    Shortage
                  </TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {calcResult.items.map((it) => {
                  const ok = asNum(it.shortageQty) <= 0;
                  return (
                    <TableRow key={`${it.materialName}-${it.calcType}`}>
                      <TableCell sx={{ fontFamily }}>{it.materialName}</TableCell>
                      <TableCell sx={{ fontFamily }}>{it.unit}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(it.requiredQty)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {it.packSize ? round2(it.packSize) : "-"}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {it.packsNeeded ?? "-"}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(it.packagingQty)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(it.availableTotalQty)}
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        {round2(it.shortageQty)}
                      </TableCell>
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
      </Paper>

      {/* Bookings */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: "1px solid rgba(0,0,0,0.08)" }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon sx={{ color: cornflowerBlue }} />
            <Typography sx={{ fontFamily, fontWeight: 700, color: "#1f2a44" }}>
              Bookings
            </Typography>
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
          <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.8 }}>
            {bookingsError}
          </Typography>
        ) : null}

        {bookingsLoading ? (
          <Box display="flex" alignItems="center" gap={1}>
            <CircularProgress size={16} />
            <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>
              Loading bookings…
            </Typography>
          </Box>
        ) : bookings.length === 0 ? (
          <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.75 }}>
            No bookings to show.
          </Typography>
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
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bookings.map((b, idx) => (
                  <TableRow key={b["Booking ID"] || idx}>
                    <TableCell sx={{ fontFamily, fontSize: 12 }}>
                      {safeStr(b["Timestamp"])}
                    </TableCell>
                    <TableCell sx={{ fontFamily }}>{safeStr(b["Booking ID"])}</TableCell>
                    <TableCell sx={{ fontFamily }}>{safeStr(b["Requested By"])}</TableCell>
                    <TableCell sx={{ fontFamily }}>{safeStr(b["Category"])}</TableCell>
                    <TableCell sx={{ fontFamily }}>{safeStr(b["Variant / Base Type"])}</TableCell>
                    <TableCell sx={{ fontFamily }}>
                      <Chip size="small" label={safeStr(b["Status"])} sx={{ fontFamily }} />
                    </TableCell>
                    <TableCell sx={{ fontFamily, fontSize: 12 }}>{safeStr(b["Remarks"])}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
