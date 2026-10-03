// src/components/QuotationBuilder.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete, Box, Grid, Typography, Button, TextField, IconButton,
  MenuItem, Select, FormControl, InputLabel, Paper, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Dialog, DialogActions, DialogContent, DialogTitle
} from '@mui/material';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import PictureInPictureAlt from '@mui/icons-material/PictureInPictureAlt';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import FolderOpen from '@mui/icons-material/FolderOpen';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ZoomIn from '@mui/icons-material/ZoomIn';
import ZoomOut from '@mui/icons-material/ZoomOut';
import RestartAlt from '@mui/icons-material/RestartAlt';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import '@fontsource/montserrat';
import { useAuth } from './AuthContext';
import QuotationAdmin from './QuotationAdmin';
import QuotationRichTextEditor from './QuotationRichTextEditor';
import QuotationSheetPreview from './QuotationSheetPreview';
import QuotationSetBuilder from './QuotationSetBuilder';
import QuotationDraftsDialog from './QuotationDraftsDialog';
import { itemQuantity, normalizeSets, setQuoteTotals } from './quotationSets';
import { applyAthleticImageMapping, athleticDrainPerimeter, buildAthleticDefaultRows, isExportableQuotationRow, reconcileAthleticRows } from './athleticRateLibrary';
import { filterQuotationLeads, normalizeQuotationLead, quotationMetaForLead } from '../utils/quotationLeadOptions';
import { moveQuotationRow } from '../utils/quotationRowOrder';

const QUOTATION_API_URL = '/api/quotations';
const QUOTATION_ENGINE_VERSION = 'quotation-v1';
const fieldSx = {
  '& .MuiInputBase-root': { borderRadius: 1.5, backgroundColor: '#fff', minHeight: 42 },
  '& .MuiInputBase-input': { fontFamily: 'Montserrat, sans-serif', fontSize: '0.88rem' },
  '& .MuiInputLabel-root': { fontFamily: 'Montserrat, sans-serif' }
};
const selectSx = { fontFamily: 'Montserrat, sans-serif', fontSize: '0.88rem', borderRadius: 1.5, backgroundColor: '#fff', minHeight: 42 };
const panelSx = {
  p: 2,
  border: '1px solid #dbe3ef',
  borderRadius: 2,
  boxShadow: '0 8px 22px rgba(15, 23, 42, 0.05)'
};
const sectionTitleSx = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: 0,
  mb: 1.5
};
const TC_FALLBACK_OPTIONS = ['Equipment', 'Flooring', 'Athletic'];
const DEFAULT_TERMS_BY_QUOTE_TYPE = {
  standard: 'Equipment',
  athletic: 'Athletic',
  'project-set': 'Equipment',
};
const ITEM_TYPE_OPTIONS = ['Equipment', 'Non Equipment'];
const GST_RATE_OPTIONS = [0, 5, 12, 18, 28];

const emptyRow = {
  category: '', subCategory: '', itemCode: '',
  qty: 1, rateOverride: '',
  unit: '', rate: '', desc: '', descHtml: '', imageUrl: '', itemType: 'Equipment',
  freight: '', installation: ''
};

// helpers
function isHttpUrl(s) { if (!s) return false; const t = String(s).trim(); return /^https?:\/\/\S+$/i.test(t); }
function safeOpen(url) { const t = String(url || '').trim(); if (!isHttpUrl(t)) return false; window.open(t, '_blank', 'noopener,noreferrer'); return true; }
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name || 'Quotation.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
async function fetchJSON(url, init) {
  const r = await fetch(url, init);
  const text = await r.text();
  try {
    const parsed = JSON.parse(text);
    if (!r.ok && parsed && !parsed.error) parsed.error = `Request failed with status ${r.status}`;
    return parsed;
  } catch {
    const detail = text ? `: ${text.slice(0, 240)}` : '';
    throw new Error(`Invalid JSON from server${detail}`);
  }
}
function toNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[₹,%\s,]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function money(value) {
  return toNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function pctValue(value) {
  const n = toNumber(value);
  return n > 1 ? n / 100 : n;
}
function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}
function plainTextToHtml(value) {
  return String(value || '').split(/\r?\n/).map(line => `<p>${escapeHtml(line) || '<br>'}</p>`).join('');
}
function htmlToPlainText(value) {
  const node = document.createElement('div');
  node.innerHTML = String(value || '');
  return (node.innerText || node.textContent || '').trim();
}

function calculateItemTotals(rows, pricing) {
  let equipment = 0;
  let nonEquipment = 0;
  rows.forEach(row => {
    const lineTotal = toNumber(row.qty) * toNumber(row.rateOverride !== '' ? row.rateOverride : row.rate);
    if (row.itemType === 'Non Equipment') nonEquipment += lineTotal;
    else equipment += lineTotal;
  });
  const freight = toNumber(pricing.freightAmount);
  const installation = toNumber(pricing.installationAmount);
  const equipmentDiscount = equipment * pctValue(pricing.equipmentDiscountPct);
  const nonEquipmentDiscount = nonEquipment * pctValue(pricing.nonEquipmentDiscountPct);
  const equipmentTaxable = Math.max(equipment - equipmentDiscount, 0);
  const nonEquipmentTaxable = Math.max(nonEquipment - nonEquipmentDiscount, 0);
  const freightInstall = freight + installation;
  const equipmentGst = equipmentTaxable * pctValue(pricing.equipmentGstPct);
  const nonEquipmentGst = nonEquipmentTaxable * pctValue(pricing.nonEquipmentGstPct);
  const freightInstallGst = freightInstall * pctValue(pricing.freightInstallGstPct);
  const grandRaw = equipmentTaxable + nonEquipmentTaxable + freightInstall + equipmentGst + nonEquipmentGst + freightInstallGst;
  return {
    equipment, nonEquipment, subTotal: equipment + nonEquipment, freight, installation,
    equipmentDiscount, nonEquipmentDiscount, equipmentGst, nonEquipmentGst, freightInstallGst,
    grand: Math.ceil(grandRaw),
  };
}

function CompactPreviewFrame({ children }) {
  const [zoom, setZoom] = useState(0.72);
  const changeZoom = delta => setZoom(current => Math.min(1, Math.max(0.5, Number((current + delta).toFixed(2)))));
  return <Paper sx={{ ...panelSx, mb: 2.5, p: 0, overflow: 'hidden' }}>
    <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid #dbe3ef', bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
      <Box>
        <Typography sx={{ ...sectionTitleSx, mb: 0 }}>Quote Output Preview</Typography>
        <Typography sx={{ mt: 0.35, fontSize: '0.7rem', color: '#64748b' }}>Updates immediately from the quotation items above.</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title="Zoom out"><span><IconButton size="small" disabled={zoom <= 0.5} onClick={() => changeZoom(-0.1)}><ZoomOut fontSize="small" /></IconButton></span></Tooltip>
        <Button size="small" onClick={() => setZoom(0.72)} sx={{ minWidth: 58 }}>{Math.round(zoom * 100)}%</Button>
        <Tooltip title="Zoom in"><span><IconButton size="small" disabled={zoom >= 1} onClick={() => changeZoom(0.1)}><ZoomIn fontSize="small" /></IconButton></span></Tooltip>
      </Box>
    </Box>
    <Box sx={{ height: { xs: 430, md: 540 }, overflow: 'auto', bgcolor: '#e9eef5', p: { xs: 1, md: 2 }, scrollbarGutter: 'stable' }}>
      <Box sx={{ zoom: String(zoom), width: `${100 / zoom}%` }}>{children}</Box>
    </Box>
  </Paper>;
}

export default function QuotationBuilder() {
  const { user } = useAuth();

  const [quoteType, setQuoteType] = useState('standard');
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [standardRows, setStandardRows] = useState([{ ...emptyRow }]);
  const [athleticRows, setAthleticRows] = useState([]);
  const [excludedAthleticLibraryKeys, setExcludedAthleticLibraryKeys] = useState([]);
  const [manageAthleticDefaults, setManageAthleticDefaults] = useState(true);
  const [meta, setMeta] = useState({
    clientName: '', projectName: '', quotationNo: '',
    dateISO: new Date().toISOString().slice(0, 10),
    preparedBy: '', notes: '', layout: 'portrait',
    leadSourceName: '', leadSourceEmail: '',
    quotationTitle: '', clientBillingAddress: '', clientGstNumber: '',
    tcType: 'Equipment'
  });
  const [pricing, setPricing] = useState({
    freightAmount: '',
    installationAmount: '',
    nonEquipmentDiscountPct: 0,
    equipmentDiscountPct: 0,
    nonEquipmentGstPct: 18,
    equipmentGstPct: 18,
    freightInstallGstPct: 18
  });
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [athletic, setAthletic] = useState({
    preset: '400m - 8 lane benchmark', surfaceSystem: 'Full PUR System',
    areaMethod: 'Preset benchmark area', civilWorks: 'Yes', drainageWorks: 'Yes',
    trackEquipment: 'No', installation: 'Inclusive', lengthPerimeter: '', breadth: '',
    laneWidth: 1.22, laneQuantity: '', manualArea: '', quotedSurfaceArea: '', drainPerimeter: '',
    gstPct: 18, discountPct: 0, freightAmount: 0, certificationAmount: 0,
    validityDays: 30, paymentTerms: '50% advance; balance as agreed'
  });
  const [quotationSets, setQuotationSets] = useState([]);
  const [setGstPct, setSetGstPct] = useState(18);
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [activeQuoteId, setActiveQuoteId] = useState('');
  const [descriptionEditor, setDescriptionEditor] = useState(null);
  const [imageSelector, setImageSelector] = useState(null);
  const [termsByType, setTermsByType] = useState({});

  const [leadOptions, setLeadOptions] = useState([]);
  const [attachLead, setAttachLead] = useState('');
  const [leadLookupError, setLeadLookupError] = useState('');
  const [leadLookupLoading, setLeadLookupLoading] = useState(false);

  const rows = quoteType === 'athletic' ? athleticRows : standardRows;
  const setRows = updater => {
    const setter = quoteType === 'athletic' ? setAthleticRows : setStandardRows;
    setter(current => typeof updater === 'function' ? updater(current) : updater);
  };

  const canUseQuotation =
    user?.role === 'Admin' ||
    (Array.isArray(user?.pageAccess) && user.pageAccess.includes('Quotation'));

  // Load catalog
  useEffect(() => {
    (async () => {
      setCatalogLoading(true);
      setCatalogError('');
      setCatalog(null);
      const j = await fetchJSON(`${QUOTATION_API_URL}?action=getCatalog&type=${quoteType}`);
      if (!j.ok) throw new Error(j.error || 'Quotation catalogue could not be loaded');
      setCatalog(j.data);
    })().catch(err => {
      console.error(err);
      setCatalogError(err.message || 'Quotation catalogue could not be loaded');
    }).finally(() => setCatalogLoading(false));
  }, [quoteType]);

  // Load leads
  useEffect(() => {
    if (!user?.username) return;
    (async () => {
      setLeadLookupLoading(true);
      const j = await fetchJSON(`${QUOTATION_API_URL}?action=getLeadsForUser&user=${encodeURIComponent(user.username)}`);
      if (j.ok && (Array.isArray(j.leads) || Array.isArray(j.entries))) {
        setLeadOptions((j.leads || j.entries || []).map(normalizeQuotationLead));
        setLeadLookupError('');
      } else {
        setLeadOptions([]);
        setLeadLookupError(j.error || 'Lead lookup unavailable');
      }
    })().catch(err => {
      setLeadOptions([]);
      setLeadLookupError(err.message || 'Lead lookup unavailable');
    }).finally(() => setLeadLookupLoading(false));
  }, [user?.username]);

  const selectedLead = useMemo(() => {
    if (!attachLead) return null;
    return leadOptions.find(lead => lead.value === attachLead) || normalizeQuotationLead(attachLead);
  }, [attachLead, leadOptions]);

  const handleLeadSelection = (lead) => {
    const selected = lead ? normalizeQuotationLead(lead) : null;
    setAttachLead(selected?.value || '');
    if (selected) setMeta(current => quotationMetaForLead(selected, current));
  };

  useEffect(() => {
    if (!user?.username) return;
    fetchJSON(`${QUOTATION_API_URL}?action=listQuotes&user=${encodeURIComponent(user.username)}`)
      .then(result => {
        if (!result.ok) throw new Error(result.error || 'Saved quotes could not be loaded');
        setSavedDrafts(result.quotes || []);
      })
      .catch(() => {
        try {
          const value = JSON.parse(localStorage.getItem(`rido-quotation-drafts:${user.username}`) || '[]');
          setSavedDrafts(Array.isArray(value) ? value : []);
        } catch {
          setSavedDrafts([]);
        }
      });
  }, [user?.username]);

  const totals = useMemo(() => calculateItemTotals(rows, pricing), [rows, pricing]);
  const athleticPricing = useMemo(() => ({
    freightAmount: athletic.freightAmount,
    installationAmount: athletic.certificationAmount,
    nonEquipmentDiscountPct: athletic.discountPct,
    equipmentDiscountPct: athletic.discountPct,
    nonEquipmentGstPct: athletic.gstPct,
    equipmentGstPct: athletic.gstPct,
    freightInstallGstPct: athletic.gstPct,
  }), [athletic]);
  const athleticTotals = useMemo(() => calculateItemTotals(rows, athleticPricing), [rows, athleticPricing]);
  const projectSetTotals = useMemo(() => setQuoteTotals(quotationSets, setGstPct), [quotationSets, setGstPct]);

  const subCatsFor = (cat) => catalog?.subcategories?.[cat] || [];
  const itemsFor = (cat, sub) => (catalog?.items?.[`${cat}|||${sub}`]) || [];
  const tcOptions = catalog?.tcOptions?.length ? catalog.tcOptions : TC_FALLBACK_OPTIONS;
  const sourceTerms = catalog?.tcTerms?.[meta.tcType] || [];
  const selectedTerms = Object.prototype.hasOwnProperty.call(termsByType, meta.tcType)
    ? termsByType[meta.tcType]
    : sourceTerms;

  const updateSelectedTerms = (updater) => {
    setTermsByType(current => {
      const base = Object.prototype.hasOwnProperty.call(current, meta.tcType)
        ? current[meta.tcType]
        : sourceTerms;
      const next = typeof updater === 'function' ? updater([...base]) : updater;
      return { ...current, [meta.tcType]: next };
    });
  };

  const changeTerm = (index, value) => updateSelectedTerms(terms => terms.map((term, termIndex) => termIndex === index ? value : term));
  const addTerm = () => updateSelectedTerms(terms => [...terms, '']);
  const removeTerm = (index) => updateSelectedTerms(terms => terms.filter((_, termIndex) => termIndex !== index));
  const resetTerms = () => setTermsByType(current => {
    const next = { ...current };
    delete next[meta.tcType];
    return next;
  });

  const handleQuoteTypeChange = (nextQuoteType) => {
    setQuoteType(nextQuoteType);
    if (nextQuoteType === 'athletic' && !activeQuoteId) setManageAthleticDefaults(true);
    setMeta(current => ({
      ...current,
      tcType: DEFAULT_TERMS_BY_QUOTE_TYPE[nextQuoteType] || current.tcType || 'Equipment',
    }));
  };

  const handleAthleticPreset = (preset) => {
    const record = (catalog?.presets || []).find(row => String(row.Preset || '').trim() === preset);
    const customMethod = preset === 'Manual surveyed area'
      ? 'Manual surveyed area'
      : preset === 'Rectangular/custom facility'
        ? 'Length × breadth'
        : preset === 'Custom geometry'
          ? 'Perimeter × lane width × lanes'
          : 'Preset benchmark area';
    const usable = (value) => toNumber(value) || '';
    setAthletic(current => ({
      ...current,
      preset,
      areaMethod: customMethod,
      lengthPerimeter: record ? usable(record['Track Length']) : current.lengthPerimeter,
      laneQuantity: record ? usable(record.Lanes) : current.laneQuantity,
      laneWidth: record ? (toNumber(record['Lane Width']) || 1.22) : current.laneWidth,
      drainPerimeter: record ? usable(record['Drain Perimeter']) : current.drainPerimeter,
      manualArea: preset === 'Manual surveyed area' ? current.manualArea : '',
      breadth: preset === 'Rectangular/custom facility' ? current.breadth : '',
    }));
  };

  const athleticArea = useMemo(() => {
    const preset = (catalog?.presets || []).find(row => String(row.Preset || '').trim() === athletic.preset);
    if (athletic.areaMethod === 'Preset benchmark area') return toNumber(preset?.['Benchmark Surface Area']);
    if (athletic.areaMethod === 'Manual surveyed area') return toNumber(athletic.manualArea);
    if (athletic.areaMethod === 'Length × breadth') return toNumber(athletic.lengthPerimeter) * toNumber(athletic.breadth);
    return toNumber(athletic.lengthPerimeter) * toNumber(athletic.laneWidth) * toNumber(athletic.laneQuantity);
  }, [athletic, catalog]);

  const quotedSurfaceArea = athletic.quotedSurfaceArea === '' || athletic.quotedSurfaceArea === undefined
    ? athleticArea
    : toNumber(athletic.quotedSurfaceArea);
  const effectiveDrainPerimeter = useMemo(
    () => athleticDrainPerimeter(athletic, catalog?.presets || []),
    [athletic, catalog?.presets]
  );

  const generatedAthleticDefaults = useMemo(() => buildAthleticDefaultRows(
    catalog?.rateLibrary || [],
    athletic,
    { area: quotedSurfaceArea, perimeter: effectiveDrainPerimeter },
    catalog || {}
  ), [athletic, catalog, effectiveDrainPerimeter, quotedSurfaceArea]);

  useEffect(() => {
    if (quoteType !== 'athletic' || !manageAthleticDefaults || !catalog?.rateLibrary) return;
    setAthleticRows(current => reconcileAthleticRows(current, generatedAthleticDefaults, excludedAthleticLibraryKeys));
  }, [catalog?.rateLibrary, excludedAthleticLibraryKeys, generatedAthleticDefaults, manageAthleticDefaults, quoteType]);

  const handleRowChange = (i, field, value) => {
    setRows(prev => {
      const next = [...prev];
      const row = { ...next[i], [field]: value };
      const libraryRow = row.source === 'rate-library';

      if (field === 'category') {
        row.subCategory = ''; row.itemCode = '';
        row.imageUrl = '';
        if (!libraryRow) {
          row.unit = ''; row.rate = ''; row.rateOverride = '';
          row.desc = ''; row.descHtml = '';
        }
      }
      if (field === 'subCategory') {
        row.itemCode = '';
        row.imageUrl = '';
        if (!libraryRow) {
          row.unit = ''; row.rate = ''; row.rateOverride = '';
          row.desc = ''; row.descHtml = '';
        }
      }
      if (field === 'itemCode' && catalog) {
        const key = `${row.category}|||${row.subCategory}`;
        const pool = (catalog.items && catalog.items[key]) || [];
        const found = pool.find(p => p.code === value);
        if (found) {
          if (!libraryRow) {
            row.unit = found.unit || '';
            row.rate = toNumber(found.rate);
            row.itemType = found.itemType || row.itemType || 'Equipment';
            row.desc = (found.desc && String(found.desc).trim())
              ? found.desc
              : `${row.category} : ${row.subCategory} : ${value}`;
            row.descHtml = plainTextToHtml(row.desc);
          }
          row.imageUrl = found.imageUrl || '';
        } else if (!libraryRow) {
          row.unit = ''; row.rate = ''; row.desc = ''; row.descHtml = ''; row.imageUrl = '';
        }
      }

      if (field === 'qty' && libraryRow) row.qtyEdited = true;
      if (field === 'unit' && libraryRow) row.unitEdited = true;
      if (field === 'descHtml') {
        row.desc = htmlToPlainText(value);
        if (libraryRow) row.descEdited = true;
      }

      next[i] = row;
      return next;
    });
  };

  const addRow = () => setRows(prev => [...prev, { ...emptyRow }]);
  const moveRow = (index, direction) => setRows(prev => moveQuotationRow(prev, index, direction));
  const removeRow = (i) => setRows(prev => {
    const removed = prev[i];
    if (removed?.libraryKey) setExcludedAthleticLibraryKeys(current => [...new Set([...current, removed.libraryKey])]);
    return prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev;
  });

  const restoreAthleticDefaults = () => {
    setExcludedAthleticLibraryKeys([]);
    setManageAthleticDefaults(true);
    setAthleticRows(current => reconcileAthleticRows(current, generatedAthleticDefaults, []));
  };

  const openAthleticImageSelector = (rowIndex, row) => setImageSelector({
    rowIndex,
    category: row.category || '',
    subCategory: row.subCategory || '',
    itemCode: row.itemCode || '',
  });

  const updateImageSelector = (field, value) => setImageSelector(current => {
    const next = { ...current, [field]: value };
    if (field === 'category') {
      next.subCategory = '';
      next.itemCode = '';
    }
    if (field === 'subCategory') next.itemCode = '';
    return next;
  });

  const applyAthleticImageSelection = () => {
    setAthleticRows(current => current.map((row, index) => index === imageSelector.rowIndex
      ? applyAthleticImageMapping(row, imageSelector, catalog || {})
      : row));
    setImageSelector(null);
  };

  const buildPayload = () => ({
    quoteType,
    quoteId: activeQuoteId || undefined,
    engineVersion: QUOTATION_ENGINE_VERSION,
    meta: { ...meta, termsAndConditions: selectedTerms.filter(term => htmlToPlainText(term)) },
    pricing: quoteType === 'athletic' ? athleticPricing : pricing,
    athletic: quoteType === 'athletic' ? athletic : undefined,
    setQuotation: quoteType === 'project-set' ? {
      gstPct: toNumber(setGstPct),
      sets: quotationSets.map(set => ({
        ...set,
        baseQuantity: toNumber(set.baseQuantity),
        items: (set.items || []).map(item => ({
          ...item,
          qty: itemQuantity(set, item),
          rate: toNumber(item.rate),
          factor: toNumber(item.factor),
        }))
      }))
    } : undefined,
    items: rows
      .filter(r => (quoteType === 'standard' || quoteType === 'athletic') && isExportableQuotationRow(r, quoteType))
      .map(r => ({
        category: r.category,
        subCategory: r.subCategory,
        itemCode: r.itemCode,
        displayItem: r.libraryItem || r.itemCode || (quoteType === 'athletic' ? 'Manual athletic item' : ''),
        source: r.source || 'manual',
        qtyDriver: r.qtyDriver || '',
        factor: toNumber(r.factor),
        qty: toNumber(r.qty),
        unit: r.unit || '',
        itemType: r.itemType || 'Equipment',
        rate: toNumber(r.rate),
        rateOverride: r.rateOverride !== '' ? toNumber(r.rateOverride) : undefined,
        descOverride: (r.desc && String(r.desc).trim()) ? r.desc : undefined,
        descHtml: r.descHtml || undefined,
        imageUrl: r.imageUrl || undefined,
        freight: r.freight || '',
        installation: r.installation || ''
      })),
    attach: attachLead ? { leadDisplay: attachLead } : null,
    builderState: { rows, attachLead, termsByType, excludedAthleticLibraryKeys },
  });

  const persistDrafts = (next) => {
    try {
      localStorage.setItem(`rido-quotation-drafts:${user.username}`, JSON.stringify(next));
      setSavedDrafts(next);
      return true;
    } catch (error) {
      console.error('Save quotation draft error:', error);
      alert('The draft could not be saved in this browser. The saved quote register is not active yet.');
      return false;
    }
  };

  const saveDraft = async ({ status = 'Draft', pdfUrl = '', workingCopyUrl = '', quoteId: requestedQuoteId = '' } = {}) => {
    const quoteId = requestedQuoteId || activeQuoteId || `Q-${Date.now().toString(36).toUpperCase()}`;
    const payload = buildPayload();
    payload.quoteId = quoteId;
    const record = {
      quoteId,
      updatedAt: new Date().toLocaleString('en-IN'),
      quoteType,
      quotationNo: meta.quotationNo,
      title: meta.quotationTitle,
      clientName: meta.clientName,
      projectName: meta.projectName,
      status,
      payload,
    };
    try {
      const result = await fetchJSON(QUOTATION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveQuote',
          user: user?.username || '',
          quote: { quoteId, status, pdfUrl, workingCopyUrl, payload },
        })
      });
      if (!result.ok) {
        const error = new Error(result.error || 'Quote could not be saved');
        error.registerUnavailable = Boolean(result.registerUnavailable);
        throw error;
      }
      const saved = { ...result.quote, payload };
      setSavedDrafts(current => [saved, ...current.filter(draft => draft.quoteId !== saved.quoteId)]);
      setActiveQuoteId(saved.quoteId);
      return saved;
    } catch (error) {
      if (!error.registerUnavailable) console.error('Shared quotation register save error:', error);
      const next = [record, ...savedDrafts.filter(draft => draft.quoteId !== quoteId)];
      if (persistDrafts(next)) setActiveQuoteId(quoteId);
      return record;
    }
  };

  const openDraft = async (record, duplicate = false) => {
    let payload = record.payload;
    if (!payload) {
      try {
        const result = await fetchJSON(`${QUOTATION_API_URL}?action=getQuote&user=${encodeURIComponent(user?.username || '')}&quoteId=${encodeURIComponent(record.quoteId)}&revision=${encodeURIComponent(record.revision || '')}`);
        if (!result.ok) throw new Error(result.error || 'Saved quote could not be opened');
        payload = result.quote?.payload;
      } catch (error) {
        console.error(error);
        alert(error.message || 'Saved quote could not be opened');
        return;
      }
    }
    payload = payload || {};
    const draftMeta = payload.meta || {};
    const draftQuoteType = payload.quoteType || 'standard';
    const draftRows = payload.builderState?.rows?.length ? payload.builderState.rows : [{ ...emptyRow }];
    setQuoteType(draftQuoteType);
    setMeta(current => ({ ...current, ...draftMeta }));
    setPricing(current => ({ ...current, ...(payload.pricing || {}) }));
    setAthletic(current => ({ ...current, ...(payload.athletic || {}) }));
    setQuotationSets(normalizeSets(payload.setQuotation?.sets || []));
    setSetGstPct(payload.setQuotation?.gstPct ?? 18);
    if (draftQuoteType === 'athletic') {
      setAthleticRows(draftRows);
      setExcludedAthleticLibraryKeys(payload.builderState?.excludedAthleticLibraryKeys || []);
      setManageAthleticDefaults(true);
    } else {
      setStandardRows(draftRows);
    }
    setAttachLead(payload.builderState?.attachLead || payload.attach?.leadDisplay || '');
    if (payload.builderState?.termsByType) {
      setTermsByType(payload.builderState.termsByType);
    } else if (Array.isArray(draftMeta.termsAndConditions)) {
      setTermsByType({ [draftMeta.tcType || 'Equipment']: draftMeta.termsAndConditions });
    } else {
      setTermsByType({});
    }
    setActiveQuoteId(duplicate ? '' : record.quoteId);
    if (duplicate) setMeta(current => ({ ...current, quotationNo: '', quotationTitle: current.quotationTitle ? `${current.quotationTitle} copy` : '' }));
    setDraftsOpen(false);
    setLastExport(record.pdfUrl || record.workingCopyUrl ? {
      url: record.pdfUrl || '', workingCopyUrl: record.workingCopyUrl || '', name: record.title || ''
    } : null);
  };

  const exportSetExcel = async () => {
    if (!quotationSets.some(set => (set.items || []).length)) {
      alert('Add at least one project set before exporting.');
      return;
    }
    setExporting(true);
    try {
      const quoteId = activeQuoteId || `Q-${Date.now().toString(36).toUpperCase()}`;
      const payload = buildPayload();
      payload.quoteId = quoteId;
      const response = await fetch(QUOTATION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exportSetWorkbook', user: user?.username || '', payload })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Export failed with status ${response.status}`);
      }
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      downloadBlob(await response.blob(), match?.[1] || `${meta.quotationTitle || 'Project BOQ Quotation'}.xlsx`);
      await saveDraft({ status: 'Exported Excel', quoteId });
    } catch (error) {
      console.error(error);
      alert(error.message || 'Excel export failed.');
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    if (!canUseQuotation) { alert('You do not have access to Quotation Builder.'); return; }
    if (quoteType === 'project-set' && !quotationSets.some(set => (set.items || []).length)) {
      alert('Add at least one project set before exporting.');
      return;
    }
    setExporting(true);
    try {
      const payload = buildPayload();
      if ((quoteType === 'standard' || quoteType === 'athletic') && !payload.items.length) {
        alert('Add at least one complete quotation item before exporting.');
        return;
      }
      let exportQuoteId = payload.quoteId;
      if (!exportQuoteId) {
        const saved = await saveDraft({ status: 'Draft' });
        exportQuoteId = saved?.quoteId;
        if (!exportQuoteId) throw new Error('The quotation could not be assigned a Quote ID before export');
        payload.quoteId = exportQuoteId;
      }

      const j = await fetchJSON(QUOTATION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exportPdf', user: user?.username || '', payload }),
      });

      if (!j.ok) { alert(j.error || 'Export failed'); return; }
      const url = String(j.pdfUrl || '').trim();
      if (!isHttpUrl(url)) {
        console.warn('Invalid pdfUrl from backend:', j.pdfUrl);
        alert('Exported, but the PDF link looked invalid. Check the Drive folder or the Lead’s “Quotation Link”.');
        return;
      }
      safeOpen(url);
      setLastExport({ url, name: j.pdfFileName, workingCopyUrl: j.workingCopyUrl });
      await saveDraft({ status: 'Exported', pdfUrl: url, workingCopyUrl: j.workingCopyUrl, quoteId: exportQuoteId });
    } catch (e) {
      console.error(e);
      alert('Export failed. See console for details.');
    } finally {
      setExporting(false);
    }
  };

  if (adminOpen && user?.role === 'Admin') {
    return <QuotationAdmin user={user} onClose={() => setAdminOpen(false)} />;
  }

  if (!canUseQuotation) {
    return (
      <Box sx={{ p: 3, fontFamily: 'Montserrat, sans-serif' }}>
        <Typography variant="h6" fontWeight={600}>You don’t have access to Quotation Builder.</Typography>
        <Typography variant="body2">Please contact your admin.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 1.5, md: 3 }, bgcolor: '#f6f8fb', fontFamily: 'Montserrat, sans-serif' }}>
      <Box sx={{
        mb: 2.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', md: 'center' },
        gap: 2,
        flexDirection: { xs: 'column', md: 'row' }
      }}>
        <Box>
          <Typography variant="h5" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#0f172a' }}>
            Build Quote
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            {quoteType === 'athletic'
              ? 'Configuration-driven athletic track estimate and automatic BOQ'
              : quoteType === 'project-set'
                ? `${quotationSets.length} project sets with ${quotationSets.reduce((sum, set) => sum + (set.items || []).length, 0)} editable line items`
              : `${rows.filter(r => r.category && r.subCategory && r.itemCode).length} line items ready for export`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {user?.role === 'Admin' && <Button variant="outlined" onClick={() => setAdminOpen(true)} sx={{ borderRadius: 1.5 }}>Manage Quote Data</Button>}
          <Tooltip title="Open saved quotation revisions"><Button variant="outlined" startIcon={<FolderOpen />} onClick={() => setDraftsOpen(true)} sx={{ borderRadius: 1.5 }}>Saved Quotes</Button></Tooltip>
          <Tooltip title="Save a new quotation revision"><Button variant="outlined" startIcon={<SaveOutlined />} onClick={() => saveDraft()} sx={{ borderRadius: 1.5 }}>Save Draft</Button></Tooltip>
          <FormControl size="small" sx={{ minWidth: 230, ...fieldSx }}>
            <InputLabel>Quotation Type</InputLabel>
            <Select value={quoteType} label="Quotation Type" onChange={e => handleQuoteTypeChange(e.target.value)} sx={selectSx}>
              <MenuItem value="standard">Standard Sports / Equipment</MenuItem>
              <MenuItem value="athletic">Athletic Track / Automatic BOQ</MenuItem>
              <MenuItem value="project-set">Project BOQ / Multiple Sets</MenuItem>
            </Select>
          </FormControl>
          {lastExport && isHttpUrl(lastExport.url) && (
            <Button variant="outlined" onClick={() => safeOpen(lastExport.url)} sx={{ borderRadius: 1.5 }}>
              Open Last PDF
            </Button>
          )}
          {lastExport && isHttpUrl(lastExport.workingCopyUrl) && (
            <Button variant="outlined" onClick={() => safeOpen(lastExport.workingCopyUrl)} sx={{ borderRadius: 1.5 }}>
              Open Working Quote
            </Button>
          )}
          {quoteType === 'project-set' && (
            <Button variant="outlined" startIcon={<DownloadOutlined />} onClick={exportSetExcel} disabled={exporting}
              sx={{ borderRadius: 1.5 }}>
              Export Excel
            </Button>
          )}
          <Button variant="contained" onClick={exportPdf} disabled={exporting}
            sx={{ borderRadius: 1.5, px: 2.5, bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}>
            {exporting ? 'Exporting...' : 'Export PDF'}
          </Button>
        </Box>
      </Box>

      <Paper sx={{ ...panelSx, p: 0, mb: 2.5, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 2, py: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 3 }, flexWrap: 'wrap', minWidth: 0 }}>
            <Typography sx={{ ...sectionTitleSx, mb: 0 }}>Quote Summary</Typography>
            {quoteType === 'standard' ? <>
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b' }}>Subtotal <strong style={{ color: '#0f172a' }}>₹{money(totals.subTotal)}</strong></Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b' }}>GST <strong style={{ color: '#0f172a' }}>₹{money(totals.equipmentGst + totals.nonEquipmentGst + totals.freightInstallGst)}</strong></Typography>
              <Box sx={{ px: 1.5, py: 0.7, bgcolor: '#0f172a', color: '#fff', borderRadius: 1.25 }}><Typography sx={{ fontSize: '0.82rem', fontWeight: 800 }}>Grand Total ₹{money(totals.grand)}</Typography></Box>
            </> : quoteType === 'project-set' ? <>
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b' }}>Subtotal <strong style={{ color: '#0f172a' }}>₹{money(projectSetTotals.subtotal)}</strong></Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b' }}>GST <strong style={{ color: '#0f172a' }}>₹{money(projectSetTotals.gst)}</strong></Typography>
              <Box sx={{ px: 1.5, py: 0.7, bgcolor: '#0f172a', color: '#fff', borderRadius: 1.25 }}><Typography sx={{ fontSize: '0.82rem', fontWeight: 800 }}>Grand Total ₹{money(projectSetTotals.grand)}</Typography></Box>
            </> : <>
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b' }}>{athletic.preset}</Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b' }}>Quoted Area <strong style={{ color: '#0f172a' }}>{quotedSurfaceArea ? `${quotedSurfaceArea.toLocaleString('en-IN', { maximumFractionDigits: 2 })} sqm` : 'Waiting for dimensions'}</strong></Typography>
            </>}
          </Box>
          <Button size="small" endIcon={summaryExpanded ? <ExpandLess /> : <ExpandMore />} onClick={() => setSummaryExpanded(value => !value)} sx={{ whiteSpace: 'nowrap' }}>
            {summaryExpanded ? 'Hide details' : 'View details'}
          </Button>
        </Box>
        {summaryExpanded && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 0, borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
          {(quoteType === 'standard' ? [
            ['Equipment', `₹${money(totals.equipment)}`], ['Non Equipment', `₹${money(totals.nonEquipment)}`],
            ['Discounts', `-₹${money(totals.equipmentDiscount + totals.nonEquipmentDiscount)}`],
            ['Freight + Installation', `₹${money(totals.freight + totals.installation)}`]
          ] : quoteType === 'project-set' ? [
            ['Sets', quotationSets.length],
            ['Items', quotationSets.reduce((sum, set) => sum + (set.items || []).length, 0)],
            ['GST', `${setGstPct || 0}%`],
            ['Grand Total', `₹${money(projectSetTotals.grand)}`]
          ] : [
            ['Surface System', athletic.surfaceSystem], ['Area Method', athletic.areaMethod],
            ['Civil / Drainage', `${athletic.civilWorks} / ${athletic.drainageWorks}`],
            ['GST / Discount', `${athletic.gstPct || 0}% / ${athletic.discountPct || 0}%`]
          ]).map(([label, value]) => <Box key={label} sx={{ px: 2, py: 1.25, borderRight: '1px solid #e2e8f0' }}>
            <Typography sx={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>{label}</Typography>
            <Typography sx={{ mt: 0.25, fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>{value}</Typography>
          </Box>)}
        </Box>}
      </Paper>

      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid item xs={12}>
          <Paper sx={{ ...panelSx, mb: 2.5 }}>
            <Typography sx={sectionTitleSx}>Quote Details</Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Quote Title / File Name" value={meta.quotationTitle}
                  onChange={e => setMeta(m => ({ ...m, quotationTitle: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  fullWidth
                  autoHighlight
                  openOnFocus
                  options={leadOptions}
                  value={selectedLead}
                  loading={leadLookupLoading}
                  filterOptions={(options, state) => filterQuotationLeads(options, state.inputValue)}
                  getOptionLabel={option => normalizeQuotationLead(option).display}
                  isOptionEqualToValue={(option, value) => normalizeQuotationLead(option).value === normalizeQuotationLead(value).value}
                  onChange={(event, value) => handleLeadSelection(value)}
                  noOptionsText={leadLookupError || 'No matching leads'}
                  loadingText="Loading leads..."
                  renderOption={(props, option) => {
                    const lead = normalizeQuotationLead(option);
                    const { key, ...optionProps } = props;
                    return <Box component="li" key={key || lead.value} {...optionProps} sx={{ display: 'block !important', py: 1 }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>{lead.company || lead.contactName}</Typography>
                      <Typography sx={{ mt: 0.2, fontSize: '0.7rem', color: '#64748b' }}>
                        {[lead.contactName !== lead.company ? lead.contactName : '', lead.mobile, lead.leadId].filter(Boolean).join(' | ')}
                      </Typography>
                    </Box>;
                  }}
                  renderInput={params => <TextField {...params} size="small" label="Attach to Lead" error={Boolean(leadLookupError)} helperText={leadLookupError || 'Search company, contact, mobile, email or Lead ID'} sx={fieldSx} />}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Client Name" value={meta.clientName}
                  onChange={e => setMeta(m => ({ ...m, clientName: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Project Name" value={meta.projectName}
                  onChange={e => setMeta(m => ({ ...m, projectName: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Quotation No." value={meta.quotationNo}
                  onChange={e => setMeta(m => ({ ...m, quotationNo: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" type="date" label="Date" InputLabelProps={{ shrink: true }}
                  value={meta.dateISO} onChange={e => setMeta(m => ({ ...m, dateISO: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Quotation Generated By" value={meta.preparedBy}
                  onChange={e => setMeta(m => ({ ...m, preparedBy: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small" sx={fieldSx}>
                  <InputLabel>Terms Type</InputLabel>
                  <Select value={meta.tcType} label="Terms Type" onChange={e => setMeta(m => ({ ...m, tcType: e.target.value }))} sx={selectSx}>
                    {tcOptions.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
                <Typography sx={{ mt: 0.5, px: 0.5, fontSize: '0.68rem', color: selectedTerms.length ? '#64748b' : '#b45309' }}>
                  {selectedTerms.length ? `${selectedTerms.length} ${meta.tcType} terms loaded` : `No ${meta.tcType} terms were found`}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Client GST Number" value={meta.clientGstNumber}
                  onChange={e => setMeta(m => ({ ...m, clientGstNumber: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small" sx={fieldSx}>
                  <InputLabel>PDF Layout</InputLabel>
                  <Select value={meta.layout} label="PDF Layout" onChange={e => setMeta(m => ({ ...m, layout: e.target.value }))} sx={selectSx}>
                    <MenuItem value="portrait">Portrait</MenuItem>
                    <MenuItem value="landscape">Landscape</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Client Billing Address" value={meta.clientBillingAddress}
                  onChange={e => setMeta(m => ({ ...m, clientBillingAddress: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Notes" value={meta.notes}
                  onChange={e => setMeta(m => ({ ...m, notes: e.target.value }))} sx={fieldSx} />
              </Grid>
            </Grid>
          </Paper>

          {quoteType === 'standard' && <Paper sx={{ ...panelSx, mb: 2.5 }}>
            <Typography sx={sectionTitleSx}>Pricing Controls</Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={6} md={12 / 7}>
                <TextField fullWidth size="small" type="number" label="Freight" value={pricing.freightAmount}
                  onChange={e => setPricing(p => ({ ...p, freightAmount: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={6} md={12 / 7}>
                <TextField fullWidth size="small" type="number" label="Installation" value={pricing.installationAmount}
                  onChange={e => setPricing(p => ({ ...p, installationAmount: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={6} md={12 / 7}>
                <TextField fullWidth size="small" type="number" label="Equipment Discount %" value={pricing.equipmentDiscountPct}
                  onChange={e => setPricing(p => ({ ...p, equipmentDiscountPct: e.target.value }))} sx={fieldSx} />
              </Grid>
              <Grid item xs={6} md={12 / 7}>
                <TextField fullWidth size="small" type="number" label="Non Equipment Discount %" value={pricing.nonEquipmentDiscountPct}
                  onChange={e => setPricing(p => ({ ...p, nonEquipmentDiscountPct: e.target.value }))} sx={fieldSx} />
              </Grid>
              {[
                ['equipmentGstPct', 'GST Equipment'],
                ['nonEquipmentGstPct', 'GST Non Equipment'],
                ['freightInstallGstPct', 'GST Freight + Installation']
              ].map(([key, label]) => (
                <Grid item xs={6} md={12 / 7} key={key}>
                  <FormControl fullWidth size="small" sx={fieldSx}>
                    <InputLabel>{label}</InputLabel>
                    <Select value={pricing[key]} label={label}
                      onChange={e => setPricing(p => ({ ...p, [key]: e.target.value }))}
                      sx={selectSx}>
                      {GST_RATE_OPTIONS.map(rate => <MenuItem key={rate} value={rate}>{rate}%</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              ))}
            </Grid>
          </Paper>}

          {quoteType === 'project-set' && <Box sx={{ mb: 2.5 }}>
            <QuotationSetBuilder
              sets={quotationSets}
              onChange={setQuotationSets}
              gstPct={setGstPct}
              onGstChange={setSetGstPct}
              onDownloadExcel={exportSetExcel}
              catalog={catalog}
            />
          </Box>}

          {quoteType === 'project-set' && <CompactPreviewFrame>
              <QuotationSheetPreview
                meta={meta}
                sets={quotationSets}
                gstPct={setGstPct}
                terms={selectedTerms}
                termsType={meta.tcType}
                termTypes={tcOptions}
                onTermsTypeChange={value => setMeta(current => ({ ...current, tcType: value }))}
                onTermChange={changeTerm}
                onTermAdd={addTerm}
                onTermRemove={removeTerm}
                onTermsReset={resetTerms}
              />
          </CompactPreviewFrame>}

          {quoteType === 'athletic' && (
            <Paper sx={{ ...panelSx, mb: 2.5 }}>
              <Typography sx={sectionTitleSx}>Athletic Track Configuration</Typography>
              <Grid container spacing={1.5}>
                {[
                  ['surfaceSystem', 'Surface System', catalog?.lists?.['Track Systems'] || []],
                  ['areaMethod', 'Area Calculation Method', catalog?.lists?.['Area Calculation Methods'] || []],
                  ['civilWorks', 'Civil Base Works', catalog?.lists?.['Yes / No'] || ['Yes', 'No']],
                  ['drainageWorks', 'Drainage Works', catalog?.lists?.['Yes / No'] || ['Yes', 'No']],
                  ['trackEquipment', 'Track Equipment', catalog?.lists?.['Yes / No'] || ['Yes', 'No']],
                  ['installation', 'Installation', catalog?.lists?.Installation || ['Inclusive', 'Extra']],
                ].map(([key, label, options]) => (
                  <Grid item xs={12} md={6} key={key}>
                    <FormControl fullWidth size="medium" sx={fieldSx}>
                      <InputLabel>{label}</InputLabel>
                      <Select value={athletic[key]} label={label} onChange={e => setAthletic(a => ({ ...a, [key]: e.target.value }))} sx={selectSx}>
                        {options.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                ))}
                <Grid item xs={12} md={6} sx={{ order: -1 }}>
                  <FormControl fullWidth size="medium" sx={fieldSx}>
                    <InputLabel>Preset / Benchmark</InputLabel>
                    <Select value={athletic.preset} label="Preset / Benchmark" onChange={e => handleAthleticPreset(e.target.value)} sx={selectSx}>
                      {(catalog?.lists?.['Preset / Benchmark'] || []).map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                {[
                  ['lengthPerimeter', 'Length / Perimeter (m)'], ['breadth', 'Breadth (m)'],
                  ['laneWidth', 'Lane Width (m)'], ['laneQuantity', 'Lane Quantity'],
                  ['manualArea', 'Manual Surveyed Area (sqm)'],
                  ['gstPct', 'GST %'], ['discountPct', 'Discount %'],
                  ['freightAmount', 'Freight / Mobilisation'], ['certificationAmount', 'Certification / Testing'],
                  ['validityDays', 'Validity (days)'],
                ].map(([key, label]) => (
                  <Grid item xs={12} md={6} key={key}>
                    <TextField fullWidth size="medium" type="number" label={label} value={athletic[key]}
                      onChange={e => setAthletic(a => ({ ...a, [key]: e.target.value }))} sx={fieldSx} />
                  </Grid>
                ))}
                <Grid item xs={12} md={6}>
                  <TextField fullWidth size="medium" type="number" label="Drain / Edge Perimeter (rmt)" value={athletic.drainPerimeter === '' || athletic.drainPerimeter === undefined ? effectiveDrainPerimeter || '' : athletic.drainPerimeter}
                    onChange={e => setAthletic(current => ({ ...current, drainPerimeter: e.target.value }))}
                    helperText={athletic.drainPerimeter === '' || athletic.drainPerimeter === undefined ? 'Auto-populated from the selected preset. Edit to override.' : 'Manual override. Clear to restore the preset perimeter.'}
                    inputProps={{ min: 0, step: 'any' }} sx={fieldSx} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth size="medium" type="number" label="Calculated / Quoted Surface Area (sqm)" value={athletic.quotedSurfaceArea === '' || athletic.quotedSurfaceArea === undefined ? athleticArea || '' : athletic.quotedSurfaceArea}
                    onChange={e => setAthletic(current => ({ ...current, quotedSurfaceArea: e.target.value }))}
                    helperText={athletic.quotedSurfaceArea === '' || athletic.quotedSurfaceArea === undefined ? 'Auto-populated from the selected preset. Edit to override.' : `Manual override. Clear to restore calculated area${athleticArea ? ` (${athleticArea.toLocaleString('en-IN', { maximumFractionDigits: 2 })} sqm)` : ''}.`}
                    inputProps={{ min: 0, step: 'any' }} sx={fieldSx} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="medium" label="Payment Terms" value={athletic.paymentTerms}
                    onChange={e => setAthletic(a => ({ ...a, paymentTerms: e.target.value }))} sx={fieldSx} />
                </Grid>
              </Grid>
            </Paper>
          )}

          {(quoteType === 'standard' || quoteType === 'athletic') && <Paper sx={{ ...panelSx, p: 0, overflow: 'hidden', mb: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 1 }}>
              <Box sx={{ px: 2, pt: 2 }}>
                <Typography sx={{ ...sectionTitleSx, mb: 0 }}>{quoteType === 'athletic' ? 'Athletic Quotation Items' : 'Quotation Items'}</Typography>
                <Typography sx={{ mt: 0.5, fontSize: '0.75rem', color: '#64748b' }}>
                  {quoteType === 'athletic'
                    ? `${rows.filter(row => row.source === 'rate-library').length} enabled defaults from the Athletic Rate Library. Rates and calculations follow Administration; quotation overrides stay local.`
                    : 'Dropdowns and item details are supplied by Equipment BD.'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.75, mr: 2, mt: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {quoteType === 'athletic' && <Button size="small" variant="outlined" startIcon={<RestartAlt />} onClick={restoreAthleticDefaults} sx={{ borderRadius: 1.5 }}>
                  Reload Library Defaults
                </Button>}
                <Button size="small" startIcon={<AddCircleOutline />} onClick={addRow} sx={{ borderRadius: 1.5 }}>
                  Add Line
                </Button>
              </Box>
            </Box>
            {catalogLoading && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pb: 2 }}><CircularProgress size={16} /><Typography variant="body2">Loading Equipment BD…</Typography></Box>}
            {catalogError && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{catalogError}</Alert>}
            {quoteType === 'athletic' && !catalogLoading && !catalogError && manageAthleticDefaults
              && !generatedAthleticDefaults.some(row => String(row.scope).trim().toLowerCase() === 'surface') && (
              <Alert severity="warning" sx={{ mx: 2, mb: 2 }}>
                No enabled Surface default is configured for {athletic.surfaceSystem}. Enable the required row in Quotation Administration or add the item manually.
              </Alert>
            )}
            {!catalogLoading && !catalogError && !(catalog?.categories || []).length && (
              <Alert severity="warning" sx={{ mx: 2, mb: 2 }}>Equipment BD loaded, but no Category, Sub Category and Item Code records were found.</Alert>
            )}
            <TableContainer sx={{ mx: 2, mb: 2, width: 'auto', maxHeight: 470, overflowX: 'auto', overflowY: 'auto !important', border: '1px solid #dbe3ef', borderRadius: 2, scrollbarGutter: 'stable' }}>
              <Table stickyHeader size="small" sx={{ minWidth: 1740, tableLayout: 'fixed', '& th': { bgcolor: '#f8fafc', color: '#475569', fontWeight: 800, whiteSpace: 'nowrap' }, '& tbody td': { verticalAlign: 'top !important', py: 1 } }}>
                <TableHead><TableRow>
                  <TableCell sx={{ width: 46 }}>S.No</TableCell><TableCell sx={{ minWidth: 155 }}>Scope / Category</TableCell>
                  <TableCell sx={{ minWidth: 165 }}>System / Sub Category</TableCell><TableCell sx={{ minWidth: 190 }}>Item / Code</TableCell>
                  <TableCell sx={{ width: 92 }}>Image</TableCell><TableCell sx={{ width: 390 }}>Description</TableCell>
                  <TableCell sx={{ width: 110 }}>Freight</TableCell><TableCell sx={{ width: 110 }}>Installation</TableCell>
                  <TableCell sx={{ width: 90 }}>Unit</TableCell><TableCell sx={{ width: 95 }}>Quantity</TableCell>
                  <TableCell sx={{ width: 115 }}>Unit Price</TableCell><TableCell sx={{ width: 135 }}>Total Amount</TableCell>
                  <TableCell sx={{ minWidth: 145 }}>Type</TableCell><TableCell sx={{ width: 112 }}>Actions</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {rows.map((r, i) => {
                    const subcats = subCatsFor(r.category);
                    const items = itemsFor(r.category, r.subCategory);
                    const lineRate = toNumber(r.rateOverride !== '' ? r.rateOverride : r.rate);
                    const lineTotal = toNumber(r.qty) * lineRate;
                    return <TableRow key={i} hover>
                      <TableCell sx={{ fontWeight: 700 }}><Box sx={{ minHeight: 42, display: 'flex', alignItems: 'center' }}>{i + 1}</Box></TableCell>
                      <TableCell>{r.source === 'rate-library'
                        ? <Box sx={{ minHeight: 42, display: 'flex', alignItems: 'center' }}><Typography sx={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155' }}>{r.scope || 'Athletic'}</Typography></Box>
                        : <FormControl fullWidth size="small"><Select value={r.category} displayEmpty disabled={catalogLoading} onChange={e => handleRowChange(i, 'category', e.target.value)} sx={selectSx}><MenuItem value=""><em>Choose</em></MenuItem>{(catalog?.categories || []).map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}</Select></FormControl>}</TableCell>
                      <TableCell>{r.source === 'rate-library'
                        ? <Box sx={{ minHeight: 42, display: 'flex', alignItems: 'center' }}><Typography sx={{ fontSize: '0.76rem', color: '#475569' }}>{r.system || 'ALL'}</Typography></Box>
                        : <FormControl fullWidth size="small"><Select value={r.subCategory} displayEmpty disabled={!r.category} onChange={e => handleRowChange(i, 'subCategory', e.target.value)} sx={selectSx}><MenuItem value=""><em>Choose</em></MenuItem>{subcats.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}</Select></FormControl>}</TableCell>
                      <TableCell>
                        {r.source === 'rate-library'
                          ? <Box sx={{ minHeight: 42, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><Typography sx={{ fontSize: '0.76rem', lineHeight: 1.35, fontWeight: 700, color: '#334155' }}>{r.libraryItem}</Typography>
                            {r.itemCode && <Typography sx={{ mt: 0.45, fontSize: '0.65rem', color: '#64748b' }}>Image reference: {r.itemCode}</Typography>}</Box>
                          : <FormControl fullWidth size="small"><Select value={r.itemCode} displayEmpty disabled={!r.subCategory} onChange={e => handleRowChange(i, 'itemCode', e.target.value)} sx={selectSx}><MenuItem value=""><em>Choose</em></MenuItem>{items.map(it => <MenuItem key={it.code} value={it.code}>{it.name && it.name !== it.code ? `${it.code} — ${it.name}` : it.code}</MenuItem>)}</Select></FormControl>}
                      </TableCell>
                      <TableCell>{r.source === 'rate-library'
                        ? <Box sx={{ minHeight: 42, display: 'flex', alignItems: 'center' }}>
                          <Tooltip title="Choose image reference"><IconButton size="small" onClick={() => openAthleticImageSelector(i, r)}><EditOutlined fontSize="small" /></IconButton></Tooltip>
                          {r.imageUrl && <Tooltip title="Open mapped image"><IconButton size="small" onClick={() => safeOpen(r.imageUrl)}><PictureInPictureAlt fontSize="small" /></IconButton></Tooltip>}
                        </Box>
                        : r.imageUrl ? <Tooltip title="Open item image"><IconButton size="small" onClick={() => safeOpen(r.imageUrl)}><PictureInPictureAlt fontSize="small" /></IconButton></Tooltip> : <Typography sx={{ color: '#94a3b8', pt: 1 }}>—</Typography>}</TableCell>
                      <TableCell>
                        <Box onClick={() => setDescriptionEditor({ rowIndex: i, value: r.descHtml || plainTextToHtml(r.desc) })} sx={{
                          position: 'relative', minHeight: 82, cursor: 'text',
                          border: '1px solid #cbd5e1', borderRadius: 1.5, bgcolor: '#fff', px: 1.25, py: 1,
                          pr: 5, '&:hover': { borderColor: '#64748b', bgcolor: '#fbfdff' }
                        }}>
                          <Typography sx={{ fontSize: '0.76rem', lineHeight: 1.45, color: r.desc ? '#334155' : '#94a3b8', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                            {r.desc || 'Populated from Equipment BD'}
                          </Typography>
                          <Tooltip title="Edit and format description"><IconButton size="small" sx={{ position: 'absolute', top: 6, right: 6, bgcolor: '#f8fafc' }}><EditOutlined fontSize="small" /></IconButton></Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell><TextField fullWidth size="small" value={r.freight || ''} placeholder="Included / Excluded / Value" onChange={e => handleRowChange(i, 'freight', e.target.value)} sx={fieldSx} /></TableCell>
                      <TableCell><TextField fullWidth size="small" value={r.installation || ''} placeholder="Included / Excluded / Value" onChange={e => handleRowChange(i, 'installation', e.target.value)} sx={fieldSx} /></TableCell>
                      <TableCell><TextField fullWidth size="small" value={r.unit || ''} onChange={e => handleRowChange(i, 'unit', e.target.value)} sx={fieldSx} /></TableCell>
                      <TableCell><TextField fullWidth size="small" type="number" value={r.qty} inputProps={{ min: 0, step: 'any' }} onChange={e => handleRowChange(i, 'qty', e.target.value)} helperText={r.source === 'rate-library' ? r.qtyDriver : ''} sx={fieldSx} /></TableCell>
                      <TableCell><TextField fullWidth size="small" type="number" value={r.rateOverride !== '' ? r.rateOverride : (r.rate ?? '')} inputProps={{ min: 0, step: 'any' }} onChange={e => handleRowChange(i, 'rateOverride', e.target.value)} sx={fieldSx} /></TableCell>
                      <TableCell sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}><Box sx={{ minHeight: 42, display: 'flex', alignItems: 'center' }}>₹{money(lineTotal)}</Box></TableCell>
                      <TableCell><FormControl fullWidth size="small"><Select value={r.itemType || 'Equipment'} onChange={e => handleRowChange(i, 'itemType', e.target.value)} sx={selectSx}>{ITEM_TYPE_OPTIONS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Tooltip title="Move line up"><span><IconButton size="small" disabled={i === 0} onClick={() => moveRow(i, -1)}><ArrowUpward fontSize="small" /></IconButton></span></Tooltip>
                          <Tooltip title="Move line down"><span><IconButton size="small" disabled={i === rows.length - 1} onClick={() => moveRow(i, 1)}><ArrowDownward fontSize="small" /></IconButton></span></Tooltip>
                          <Tooltip title="Remove line"><span><IconButton size="small" disabled={rows.length === 1} onClick={() => removeRow(i)}><DeleteOutline fontSize="small" /></IconButton></span></Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <Typography sx={{ fontSize: '0.78rem', color: '#64748b' }}>{quoteType === 'athletic' ? 'Athletic scope and defaults remain controlled by the Rate Library. Image references are mapped separately.' : 'Select Category, then Sub Category, then Item Code—matching the New Template sheet.'}</Typography>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 800 }}>Subtotal ₹{money(quoteType === 'athletic' ? athleticTotals.subTotal : totals.subTotal)}</Typography>
            </Box>
          </Paper>}

          {(quoteType === 'standard' || quoteType === 'athletic') && <CompactPreviewFrame>
            <QuotationSheetPreview
              quoteType={quoteType}
              meta={meta}
              rows={rows}
              totals={quoteType === 'athletic' ? athleticTotals : totals}
              pricing={quoteType === 'athletic' ? athleticPricing : pricing}
              terms={selectedTerms}
              termsType={meta.tcType}
              termTypes={tcOptions}
              onTermsTypeChange={value => setMeta(current => ({ ...current, tcType: value }))}
              onTermChange={changeTerm}
              onTermAdd={addTerm}
              onTermRemove={removeTerm}
              onTermsReset={resetTerms}
            />
          </CompactPreviewFrame>}
        </Grid>
      </Grid>
      <QuotationDraftsDialog
        open={draftsOpen}
        drafts={savedDrafts}
        onClose={() => setDraftsOpen(false)}
        onOpen={(draft) => openDraft(draft, false)}
        onDuplicate={(draft) => openDraft(draft, true)}
      />
      <Dialog open={Boolean(descriptionEditor)} onClose={(event, reason) => { if (reason !== 'backdropClick') setDescriptionEditor(null); }} maxWidth="md" fullWidth disableEscapeKeyDown>
        <DialogTitle>Format Description</DialogTitle>
        <DialogContent dividers>
          <QuotationRichTextEditor value={descriptionEditor?.value || ''} onChange={value => setDescriptionEditor(current => ({ ...current, value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDescriptionEditor(null)}>Cancel</Button>
          <Button type="button" variant="contained" onClick={() => {
            const edit = descriptionEditor;
            setDescriptionEditor(null);
            if (edit) handleRowChange(edit.rowIndex, 'descHtml', edit.value);
          }}>Apply</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(imageSelector)} onClose={(event, reason) => { if (reason !== 'backdropClick') setImageSelector(null); }} maxWidth="sm" fullWidth disableEscapeKeyDown>
        <DialogTitle>Choose Athletic Item Image</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ mb: 2, fontSize: '0.78rem', color: '#64748b' }}>This mapping changes only the image reference. The athletic scope, system, description, quantity calculation, unit and rate remain unchanged.</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>Category</InputLabel><Select label="Category" value={imageSelector?.category || ''} onChange={event => updateImageSelector('category', event.target.value)}>{(catalog?.categories || []).map(category => <MenuItem key={category} value={category}>{category}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12}><FormControl fullWidth disabled={!imageSelector?.category}><InputLabel>Sub Category</InputLabel><Select label="Sub Category" value={imageSelector?.subCategory || ''} onChange={event => updateImageSelector('subCategory', event.target.value)}>{subCatsFor(imageSelector?.category).map(subCategory => <MenuItem key={subCategory} value={subCategory}>{subCategory}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12}><FormControl fullWidth disabled={!imageSelector?.subCategory}><InputLabel>Item Code / Image</InputLabel><Select label="Item Code / Image" value={imageSelector?.itemCode || ''} onChange={event => updateImageSelector('itemCode', event.target.value)}>{itemsFor(imageSelector?.category, imageSelector?.subCategory).map(item => <MenuItem key={item.code} value={item.code}>{item.name && item.name !== item.code ? `${item.code} — ${item.name}` : item.code}</MenuItem>)}</Select></FormControl></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageSelector(null)}>Cancel</Button>
          <Button variant="outlined" color="inherit" onClick={() => setImageSelector(current => ({ ...current, category: '', subCategory: '', itemCode: '' }))}>Clear Image</Button>
          <Button variant="contained" onClick={applyAthleticImageSelection}>Apply Image</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
