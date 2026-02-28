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
} from "@mui/material";

import RefreshIcon from "@mui/icons-material/Refresh";
import CalculateIcon from "@mui/icons-material/Calculate";
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";
import HistoryIcon from "@mui/icons-material/History";

const cornflowerBlue = "#6495ED";
const fontFamily = "Montserrat, sans-serif";

// 🔧 Set this to your Inventory Apps Script Web App /exec URL
// Example: "https://script.google.com/macros/s/AKfycbxxxxxxx/exec"
const DEFAULT_INVENTORY_API_URL = "https://script.google.com/macros/s/AKfycbzEkxzsVYQWMdI7CmleY53U-O4C58b92wlCZnISqtv11L2YLcaRuiB0WGHWW1HlpsoG/exec";

// -------- Helpers --------
const safeStr = (v) => (v ?? "").toString().trim();
const toUpper = (v) => safeStr(v).toUpperCase();
const asNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function getUserFromLocalStorage() {
  // Adjust keys if your CRM uses different storage
  // Common pattern: localStorage.setItem("crmUser", JSON.stringify({...}))
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

async function apiGet(apiUrl, params) {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${apiUrl}?${qs.toString()}`, { method: "GET" });
  const json = await res.json().catch(() => ({}));
  if (!json?.ok) throw new Error(json?.error || "Request failed");
  return json.data;
}

async function apiPost(apiUrl, body) {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // If you face CORS preflight issues, we can switch to `mode: "no-cors"`
    // (but then you can't read the response). For now keep normal mode.
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!json?.ok) throw new Error(json?.error || "Request failed");
  return json.data;
}

export default function InventoryModule({
  apiUrl = DEFAULT_INVENTORY_API_URL,
  logoSrc = "/assets/kk-logo.png",
  title = "Inventory Calculator",
}) {
  const [loading, setLoading] = useState(false);

  // Validation data (from validation sheet via getValidation)
  const [validation, setValidation] = useState({});
  const [validationLoading, setValidationLoading] = useState(false);

  // Selection
  const [category, setCategory] = useState("ACRYLIC");
  const [variant, setVariant] = useState("");

  // Dynamic Inputs from Inventory Calc Inputs
  const [inputDefs, setInputDefs] = useState([]);
  const [inputsLoading, setInputsLoading] = useState(false);
  const [inputs, setInputs] = useState({});

  // Calculation result
  const [calcResult, setCalcResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Booking
  const [remarks, setRemarks] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // Bookings list (same page)
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");

  const user = useMemo(() => getUserFromLocalStorage(), []);

  // Derive variants list from validation
  const variantsList = useMemo(() => {
    // You can rename these columns in your "Inventory Validation" if needed
    // and update here accordingly.
    // We try multiple common keys to be safe.
    const acrylicVariants =
      validation?.["Acrylic Variants"] ||
      validation?.["Acrylic Sub Base"] ||
      validation?.["Acrylic"] ||
      [];
    const puVariants =
      validation?.["PU Variants"] ||
      validation?.["PU Type"] ||
      validation?.["PU"] ||
      [];

    if (toUpper(category) === "PU") return puVariants;
    return acrylicVariants;
  }, [validation, category]);

  // Load validation on mount
  useEffect(() => {
    const run = async () => {
      if (!apiUrl) return;
      setValidationLoading(true);
      try {
        const data = await apiGet(apiUrl, { action: "getValidation" });
        setValidation(data || {});
      } catch (e) {
        // keep silent but show minimal
        console.error("getValidation error:", e);
      } finally {
        setValidationLoading(false);
      }
    };
    run();
  }, [apiUrl]);

  // Ensure default variant
  useEffect(() => {
    if (!variantsList?.length) return;
    if (!variant) setVariant(variantsList[0]);
  }, [variantsList, variant]);

  // Load inputs whenever category/variant changes
  useEffect(() => {
    const run = async () => {
      if (!apiUrl || !category || !variant) return;

      setInputsLoading(true);
      setCalcResult(null);
      setBookingSuccess(null);

      try {
        const defs = await apiGet(apiUrl, {
          action: "getInputs",
          category,
          variant,
        });

        const safeDefs = Array.isArray(defs) ? defs : [];
        setInputDefs(safeDefs);

        // initialize inputs with defaults
        const next = {};
        safeDefs.forEach((d) => {
          const k = d.inputKey;
          if (!k) return;
          next[k] = d.defaultValue ?? "";
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

  const canCalculate = !!apiUrl && !!category && !!variant && inputDefs.length > 0;

  const handleChangeInput = (key, value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleCalculate = async () => {
    if (!canCalculate) return;

    setCalcLoading(true);
    setBookingSuccess(null);
    try {
      const data = await apiPost(apiUrl, {
        action: "calculate",
        data: {
          category,
          variant,
          inputs: normalizeInputsForPost(inputs, inputDefs),
        },
      });
      setCalcResult(data || null);
    } catch (e) {
      console.error("calculate error:", e);
      setCalcResult(null);
      alert(`Calculation failed: ${e.message || e}`);
    } finally {
      setCalcLoading(false);
    }
  };

  const handleCreateBooking = async () => {
    if (!calcResult?.items?.length) {
      alert("Please calculate first.");
      return;
    }

    setBookingLoading(true);
    try {
      const payloadInputs = normalizeInputsForPost(inputs, inputDefs);
      const res = await apiPost(apiUrl, {
        action: "createBooking",
        data: {
          category,
          variant,
          requestedBy: user.username || "End User",
          inputs: payloadInputs,
          remarks: remarks || "",
        },
      });

      setBookingSuccess(res || null);
      setRemarks("");

      // try refresh bookings list
      fetchBookings();
    } catch (e) {
      console.error("createBooking error:", e);
      alert(`Booking failed: ${e.message || e}`);
    } finally {
      setBookingLoading(false);
    }
  };

  const fetchBookings = async () => {
    if (!apiUrl) return;
    setBookingsLoading(true);
    setBookingsError("");

    try {
      // ⚠️ This action needs to be added in GAS:
      // doGet?action=getBookings&requestedBy=...&role=...
      // UI will gracefully handle if not available.
      const data = await apiGet(apiUrl, {
        action: "getBookings",
        requestedBy: user.username || "",
        role: user.role || "",
      });

      setBookings(Array.isArray(data) ? data : []);
    } catch (e) {
      // This will happen until we add getBookings in GAS
      setBookings([]);
      setBookingsError(
        "Bookings list endpoint is not enabled yet (needs GAS action=getBookings). Calculator + booking creation will still work."
      );
    } finally {
      setBookingsLoading(false);
    }
  };

  // Load bookings on mount (best effort)
  useEffect(() => {
    if (!apiUrl) return;
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

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
            <Tooltip title="Refresh">
              <IconButton
                onClick={() => {
                  // refresh validation + inputs + bookings
                  setValidation({});
                  setCalcResult(null);
                  setBookingSuccess(null);
                  // run the same effects
                  window.location.reload();
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Controls */}
      <Paper
        elevation={0}
        sx={{ p: 2, mb: 2, borderRadius: 2, border: "1px solid rgba(0,0,0,0.08)" }}
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
            {validationLoading ? (
              <Box display="flex" alignItems="center" gap={1} mt={1}>
                <CircularProgress size={14} />
                <Typography sx={{ fontSize: 12, opacity: 0.7, fontFamily }}>
                  Loading validation…
                </Typography>
              </Box>
            ) : null}
          </Grid>

          <Grid item xs={12} md={5}>
            <Box display="flex" gap={1} justifyContent={{ xs: "flex-start", md: "flex-end" }}>
              <Button
                variant="contained"
                startIcon={calcLoading ? <CircularProgress size={16} /> : <CalculateIcon />}
                onClick={handleCalculate}
                disabled={!canCalculate || calcLoading || inputsLoading}
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

        {/* Dynamic Inputs */}
        <Box>
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
              No inputs found for this Category/Variant. Please check `Inventory Calc Inputs`.
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
        </Box>
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
              <Chip
                label={`Total Required: ${totals.totalRequired}`}
                size="small"
                sx={{ fontFamily }}
              />
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
            Run <b>Calculate</b> to view materials, packaging, and stock availability.
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
                  const shortage = asNum(it.shortageQty);
                  const ok = shortage <= 0;

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
                        {round2(shortage)}
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

        {bookingSuccess?.bookingId ? (
          <Box mt={2}>
            <Divider sx={{ mb: 2 }} />
            <Typography sx={{ fontFamily, fontWeight: 700, color: "green" }}>
              Booking Created: {bookingSuccess.bookingId}
            </Typography>
            <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.8 }}>
              Reserved Packaged: {bookingSuccess?.totals?.totalPack ?? "-"} | Reserved Loose:{" "}
              {bookingSuccess?.totals?.totalLoose ?? "-"} | Shortage:{" "}
              {bookingSuccess?.totals?.totalShort ?? "-"}
            </Typography>
          </Box>
        ) : null}
      </Paper>

      {/* Bookings (same page) */}
      <Paper
        elevation={0}
        sx={{ p: 2, borderRadius: 2, border: "1px solid rgba(0,0,0,0.08)" }}
      >
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
            sx={{
              textTransform: "none",
              fontFamily,
              borderColor: cornflowerBlue,
              color: cornflowerBlue,
            }}
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
                  <TableRow key={b.bookingId || idx}>
                    <TableCell sx={{ fontFamily, fontSize: 12 }}>
                      {safeStr(b.timestamp || b.Timestamp)}
                    </TableCell>
                    <TableCell sx={{ fontFamily }}>{safeStr(b.bookingId || b["Booking ID"])}</TableCell>
                    <TableCell sx={{ fontFamily }}>{safeStr(b.requestedBy || b["Requested By"])}</TableCell>
                    <TableCell sx={{ fontFamily }}>{safeStr(b.category || b.Category)}</TableCell>
                    <TableCell sx={{ fontFamily }}>{safeStr(b.variant || b["Variant / Base Type"])}</TableCell>
                    <TableCell sx={{ fontFamily }}>
                      <Chip size="small" label={safeStr(b.status || b.Status)} sx={{ fontFamily }} />
                    </TableCell>
                    <TableCell sx={{ fontFamily, fontSize: 12 }}>
                      {safeStr(b.remarks || b.Remarks)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Missing API URL warning */}
      {!apiUrl ? (
        <Box mt={2}>
          <Typography sx={{ fontFamily, fontSize: 12, color: "crimson" }}>
            ⚠️ Please set your Inventory Apps Script Web App URL in <b>DEFAULT_INVENTORY_API_URL</b> or pass{" "}
            <b>apiUrl</b> prop to this component.
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}

// Normalize numeric inputs where appropriate
function normalizeInputsForPost(inputs, inputDefs) {
  const out = { ...(inputs || {}) };

  // We convert numeric-looking fields to numbers except "wearCoatType"
  // based on inputDefs units/keys.
  (inputDefs || []).forEach((d) => {
    const key = d.inputKey;
    if (!key) return;

    if (key === "wearCoatType") {
      out[key] = safeStr(out[key] || "SD");
      return;
    }

    const val = out[key];
    // if empty keep 0
    if (val === "" || val == null) {
      out[key] = 0;
      return;
    }

    // convert to number when possible
    const n = Number(val);
    out[key] = Number.isFinite(n) ? n : val;
  });

  return out;
}

function round2(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
