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
} from "@mui/material";

import RefreshIcon from "@mui/icons-material/Refresh";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";

const cornflowerBlue = "#6495ED";
const fontFamily = "Montserrat, sans-serif";

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

async function apiGet(apiUrl, params) {
  const qs = new URLSearchParams(params);
  const payload = await jsonp(`${apiUrl}?${qs.toString()}`);
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

function normalizeInventoryCategory(category) {
  const val = safeStr(category).toUpperCase();
  if (val === "ACRYLIC") return "ACRYLIC";
  if (val === "PU") return "PU";
  return val;
}

function validationCategoryMatchesInventory(validationCategory, inventoryCategory) {
  const v = safeStr(validationCategory).toUpperCase();
  const i = normalizeInventoryCategory(inventoryCategory);

  if (v === "ACRYLIC/PU") return i === "ACRYLIC" || i === "PU";
  if (v === "ACRYLIC") return i === "ACRYLIC";
  if (v === "PU") return i === "PU";

  return v === i;
}

function buildStockRow(row, idx) {
  const packSize = asNum(row.packSize);
  const packagedStockQty = asNum(row.packagedStockQty);
  const readyPacksCount = packSize > 0 ? round2(packagedStockQty / packSize) : 0;

  const reservedPackagedQty = asNum(row.reservedPackagedQty);
  const reservedLooseQty = asNum(row.reservedLooseQty);
  const looseStockQty = asNum(row.looseStockQty);

  return {
    id: `${safeStr(row.category)}__${safeStr(row.materialName)}__${idx}`,
    timestamp: row.timestamp || "",
    category: safeStr(row.category),
    materialName: safeStr(row.materialName),
    unit: safeStr(row.unit),
    packSize,
    packSizeOptions: safeStr(row.packSizeOptions || ""),
    packSizeOptionsList: parsePackSizeOptions(row.packSizeOptions || ""),
    readyPacksCount,
    packagedStockQty: round2(packagedStockQty),
    looseStockQty: round2(looseStockQty),
    reservedPackagedQty: round2(reservedPackagedQty),
    reservedLooseQty: round2(reservedLooseQty),
    availablePackagedQty: round2(Math.max(0, packagedStockQty - reservedPackagedQty)),
    availableLooseQty: round2(Math.max(0, looseStockQty - reservedLooseQty)),
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

function buildNewMaterialState(defaultCategory = "") {
  return {
    category: defaultCategory && defaultCategory !== "ALL" ? defaultCategory : "",
    materialName: "",
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

  const [validation, setValidation] = useState({});
  const [validationLoading, setValidationLoading] = useState(false);

  const [category, setCategory] = useState("ALL");
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

  const [openToggleModal, setOpenToggleModal] = useState(false);
  const [toggleRow, setToggleRow] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [toggleError, setToggleError] = useState("");

  // ---------- Validation Mapping ----------
  // Supports either:
  // 1) existing column-wise getValidation() response
  // 2) future row-wise response under validation.inventoryMaterialRows / validation.Inventory Material Rows
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

    const categories = validation?.["Category"] || [];
    const materials = validation?.["Material Name"] || [];
    const units = validation?.["Unit"] || [];

    const maxLen = Math.max(categories.length, materials.length, units.length);
    const rows = [];

    for (let i = 0; i < maxLen; i++) {
      const category = safeStr(categories[i]);
      const materialName = safeStr(materials[i]);
      const unit = safeStr(units[i]);

      if (!category || !materialName) continue;

      rows.push({
        category,
        materialName,
        unit,
      });
    }

    return rows;
  }, [validation]);

  const categoryOptions = useMemo(() => {
    const fromValidation =
      validation?.["Category"] ||
      validation?.["Inventory Category"] ||
      [];

    const normalized = Array.from(
      new Set((fromValidation || []).map((v) => safeStr(v)).filter(Boolean))
    );

    const fromRows = Array.from(
      new Set(stockRows.map((r) => safeStr(r.category)).filter(Boolean))
    );

    return Array.from(new Set([...normalized, ...fromRows]));
  }, [validation, stockRows]);

  // Create Material modal category mapping based on inventory nomenclature
  const createCategoryOptions = useMemo(() => {
    return ["ACRYLIC", "PU"];
  }, []);

  const createMaterialOptions = useMemo(() => {
    if (!safeStr(createForm.category)) return [];

    const filtered = materialValidationRows.filter((row) =>
      validationCategoryMatchesInventory(row.category, createForm.category)
    );

    const deduped = [];
    const seen = new Set();

    filtered.forEach((row) => {
      const key = `${safeStr(row.materialName)}__${safeStr(row.unit)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(row);
      }
    });

    return deduped.sort((a, b) => a.materialName.localeCompare(b.materialName));
  }, [materialValidationRows, createForm.category]);

  // Update modal pack size dropdown validation fallback from validation sheet if available
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

  const filteredRows = useMemo(() => {
    const q = toUpper(search);
    return (stockRows || []).filter((row) => {
      const matchesCategory =
        category === "ALL" || toUpper(row.category) === toUpper(category);

      const hay =
        `${row.category} ${row.materialName} ${row.unit} ${row.packSizeOptions}`.toUpperCase();

      const matchesSearch = !q || hay.includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [stockRows, category, search]);

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
            category: row.category,
            materialName: row.materialName,
            unit: row.unit,
            packSize: row.packSize,
            packSizeOptions: row.packSizeOptions,
            packagedStockQty: row.packagedStockQty,
            looseStockQty: row.looseStockQty,
            reservedPackagedQty: row.reservedPackagedQty,
            reservedLooseQty: row.reservedLooseQty,
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
  }, [apiUrl]);

  useEffect(() => {
    fetchStock();
  }, [apiUrl, category]);

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
          new Set([...freeTextOptions, ...approvedPackSizes, asNum(next.packSize)].filter((n) => n > 0))
        ).sort((a, b) => a - b);

        next.packSizeOptionsList = merged;
      }

      if (field === "packSize") {
        const merged = Array.from(
          new Set([...(next.packSizeOptionsList || []), ...approvedPackSizes, asNum(value)].filter((n) => n > 0))
        ).sort((a, b) => a - b);
        next.packSizeOptionsList = merged;
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

    setSaving(true);
    setModalNotice("");
    setModalError("");

    try {
      const payload = {
        action: "setStock",
        data: {
          role: user.role || "",
          category: modalForm.category,
          materialName: modalForm.materialName,
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

      setModalNotice("✅ Stock updated successfully.");
      setGlobalNotice("✅ Stock row updated successfully.");

      setTimeout(() => {
        handleCloseModal();
        fetchStock();
      }, 1000);
    } catch (e) {
      console.error("setStock error:", e);
      setModalError(`Save failed: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCreateModal = () => {
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

      if (field === "category") {
        next.materialName = "";
        next.unit = "";
      }

      if (field === "materialName") {
        const selectedMaterial = createMaterialOptions.find(
          (item) => safeStr(item.materialName) === safeStr(value)
        );
        next.unit = selectedMaterial?.unit || "";
      }

      if (field === "packSizeOptions") {
        const freeTextOptions = parsePackSizeOptions(value);
        const merged = Array.from(
          new Set([...freeTextOptions, ...approvedPackSizes, asNum(next.packSize)].filter((n) => n > 0))
        ).sort((a, b) => a - b);

        next.packSizeOptionsList = merged;
      }

      if (field === "packSize") {
        const merged = Array.from(
          new Set([...(next.packSizeOptionsList || []), ...approvedPackSizes, asNum(value)].filter((n) => n > 0))
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

  const handleCreateMaterial = async () => {
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

    setCreating(true);
    setCreateNotice("");
    setCreateError("");

    try {
      const payload = {
        action: "createStockItem",
        data: {
          role: user.role || "",
          category: createForm.category,
          materialName: createForm.materialName,
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

      await apiPostNoCors(apiUrl, payload);

      setCreateNotice("✅ Material created successfully.");
      setGlobalNotice("✅ New stock material created successfully.");

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

    setToggleLoading(true);
    setToggleError("");

    try {
      const nextActive = toUpper(toggleRow.active) === "TRUE" ? "FALSE" : "TRUE";

      const payload = {
        action: "toggleStockItemActive",
        data: {
          role: user.role || "",
          category: toggleRow.category,
          materialName: toggleRow.materialName,
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

  const totalRows = filteredRows.length;
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
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
          <Box display="flex" alignItems="center" gap={2}>
            <img src={logoSrc} alt="Klient Konnect" style={{ height: 56, objectFit: "contain" }} />
            <Box>
              <Typography variant="h5" sx={{ fontFamily, fontWeight: 700, color: cornflowerBlue }}>
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
            {(stockLoading || validationLoading) ? <CircularProgress size={18} /> : null}
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

          <Grid item xs={12} md={5}>
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

          <Grid item xs={12} md={4}>
            <Box display="flex" justifyContent={{ xs: "flex-start", md: "flex-end" }} gap={1} flexWrap="wrap">
              <Chip
                icon={<Inventory2Icon />}
                label={`Rows: ${totalRows}`}
                size="small"
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
            Inventory Stock
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
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "rgba(100,149,237,0.10)" }}>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Material</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Unit</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Pack Size</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Packaged Qty</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Loose Qty</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Reserved Packaged</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Reserved Loose</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Available Packaged</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Available Loose</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="right">Min Stock</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Active</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }}>Updated By</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="center">Update</TableCell>
                  <TableCell sx={{ fontFamily, fontWeight: 700 }} align="center">Deactivate</TableCell>
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
                      <TableCell sx={{ fontFamily }}>{row.category}</TableCell>
                      <TableCell sx={{ fontFamily }}>{row.materialName}</TableCell>
                      <TableCell sx={{ fontFamily }}>{row.unit}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">{round2(row.packSize)}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">{round2(row.packagedStockQty)}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">{round2(row.looseStockQty)}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">{round2(row.reservedPackagedQty)}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">{round2(row.reservedLooseQty)}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">
                        <Chip
                          size="small"
                          label={round2(row.availablePackagedQty)}
                          color={isLowStock ? "warning" : "default"}
                          sx={{ fontFamily }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily }} align="right">{round2(row.availableLooseQty)}</TableCell>
                      <TableCell sx={{ fontFamily }} align="right">{round2(row.minStockLevel)}</TableCell>
                      <TableCell sx={{ fontFamily }}>
                        <Chip
                          size="small"
                          label={isActive ? "TRUE" : "FALSE"}
                          color={isActive ? "success" : "default"}
                          sx={{ fontFamily }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily, fontSize: 12 }}>{row.updatedBy || "-"}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="Update Stock">
                          <IconButton onClick={() => handleOpenModal(row)}>
                            <EditIcon sx={{ color: cornflowerBlue }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={isActive ? "Deactivate Material" : "Reactivate Material"}>
                          <IconButton onClick={() => handleOpenToggleModal(row)}>
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
      <Dialog open={openModal} onClose={handleCloseModal} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontFamily, fontWeight: 700 }}>Update Stock</DialogTitle>
        <DialogContent dividers>
          {modalForm ? (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Category</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{modalForm.category}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Material Name</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{modalForm.materialName}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Unit</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{modalForm.unit}</Typography>
                </Grid>

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
                        {(modalForm.packSizeOptionsList || []).map((ps) => (
                          <MenuItem key={ps} value={ps}>{ps}</MenuItem>
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
                    label="Ready Packs Count"
                    value={modalForm.readyPacksCount}
                    onChange={(e) => handleModalChange("readyPacksCount", e.target.value)}
                    sx={{ fontFamily }}
                    inputProps={{ style: { fontFamily } }}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Loose Stock Qty"
                    value={modalForm.looseStockQty}
                    onChange={(e) => handleModalChange("looseStockQty", e.target.value)}
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
                    value={modalForm.minStockLevel}
                    onChange={(e) => handleModalChange("minStockLevel", e.target.value)}
                    sx={{ fontFamily }}
                    inputProps={{ style: { fontFamily } }}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
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

                <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                <Grid item xs={12} md={4}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Reserved Packaged Qty</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{round2(modalForm.reservedPackagedQty)}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Reserved Loose Qty</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{round2(modalForm.reservedLooseQty)}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Derived Packaged Stock Qty</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{round2(modalForm.packagedStockQty)}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Derived Available Packaged Qty</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{round2(modalForm.availablePackagedQty)}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Derived Available Loose Qty</Typography>
                  <Typography sx={{ fontFamily, fontWeight: 600 }}>{round2(modalForm.availableLooseQty)}</Typography>
                </Grid>
              </Grid>

              {modalNotice ? <Box mt={2}><Alert severity="success" sx={{ fontFamily }}>{modalNotice}</Alert></Box> : null}
              {modalError ? <Box mt={2}><Alert severity="error" sx={{ fontFamily }}>{modalError}</Alert></Box> : null}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal} sx={{ textTransform: "none", fontFamily }}>Close</Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSaveStock}
            disabled={!modalForm || saving}
            sx={{ textTransform: "none", fontFamily, backgroundColor: cornflowerBlue }}
          >
            Save Stock
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Material Modal */}
      <Dialog open={openCreateModal} onClose={handleCloseCreateModal} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontFamily, fontWeight: 700 }}>Add Material</DialogTitle>
        <DialogContent dividers>
          <Box>
            <Grid container spacing={2}>
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
                      <MenuItem key={`${item.materialName}-${item.unit}`} value={item.materialName}>
                        {item.materialName}
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
                      {(createForm.packSizeOptionsList || []).map((ps) => (
                        <MenuItem key={ps} value={ps}>{ps}</MenuItem>
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
                  label="Ready Packs Count"
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
                  label="Loose Stock Qty"
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

              <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

              <Grid item xs={12} md={4}>
                <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Derived Packaged Stock Qty</Typography>
                <Typography sx={{ fontFamily, fontWeight: 600 }}>{round2(createForm.packagedStockQty)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Derived Available Packaged Qty</Typography>
                <Typography sx={{ fontFamily, fontWeight: 600 }}>{round2(createForm.availablePackagedQty)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography sx={{ fontFamily, fontSize: 12, opacity: 0.7 }}>Derived Available Loose Qty</Typography>
                <Typography sx={{ fontFamily, fontWeight: 600 }}>{round2(createForm.availableLooseQty)}</Typography>
              </Grid>
            </Grid>

            {createNotice ? <Box mt={2}><Alert severity="success" sx={{ fontFamily }}>{createNotice}</Alert></Box> : null}
            {createError ? <Box mt={2}><Alert severity="error" sx={{ fontFamily }}>{createError}</Alert></Box> : null}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateModal} sx={{ textTransform: "none", fontFamily }}>Close</Button>
          <Button
            variant="contained"
            startIcon={creating ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleCreateMaterial}
            disabled={creating}
            sx={{ textTransform: "none", fontFamily, backgroundColor: cornflowerBlue }}
          >
            Create Material
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toggle Active Modal */}
      <Dialog open={openToggleModal} onClose={handleCloseToggleModal} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontFamily, fontWeight: 700 }}>
          {toggleRow && toUpper(toggleRow.active) === "TRUE" ? "Deactivate Material" : "Reactivate Material"}
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
            disabled={!toggleRow || toggleLoading}
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