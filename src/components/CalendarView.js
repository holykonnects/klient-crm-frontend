// CalendarView.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent,
  TextField, Grid, MenuItem, Select, InputLabel, FormControl
} from '@mui/material';
import { useAuth } from './AuthContext';
import '@fontsource/montserrat';
import LoadingOverlay from './LoadingOverlay';
import './CalendarStyles.css';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzCsp1ngGzlrbhNm17tqPeOgpVgPBrb5Pgoahxhy4rAZVLg5mFymYeioepLxBnqKOtPjw/exec';

const CalendarView = ({ open, onClose, entryType: externalEntryType, selectedEntryRow, mode }) => {
  const { user } = useAuth();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openDialog, setOpenDialog] = useState(false);
  const [entryType, setEntryType] = useState('');
  const [entries, setEntries] = useState([]);

  const [formData, setFormData] = useState({
    leadType: '',
    selectedEntry: '',
    newLeadName: '',
    meetingDate: '',
    meetingTime: '',
    purpose: '',
    entryValue: '',
    leadOwner: ''
  });

  const activeEntryType = externalEntryType || entryType;
  const calendarRef = useRef(null);

  // ---------- Normalizers (frontend) ----------
  const toISODate = (val) => {
    if (!val) return '';
    if (typeof val === 'string') {
      const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // DD/MM/YYYY
      return m ? `${m[3]}-${m[2]}-${m[1]}` : val;        // else assume YYYY-MM-DD
    }
    const d = (val?.$d instanceof Date) ? val.$d : (val instanceof Date ? val : null);
    if (!d) return String(val);
    const y = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${mm}-${dd}`;
  };

  const toHHmm = (val) => {
    if (!val) return '';
    if (typeof val === 'string') {
      let s = val.replace(/\./g, ':').trim();
      if (/^\d{3,4}$/.test(s)) s = s.padStart(4, '0').slice(0,2) + ':' + s.slice(-2);
      const ampm = (s.match(/am|pm/i) || [''])[0].toLowerCase();
      const m = s.match(/(\d{1,2}):(\d{2})/);
      if (!m) return '';
      let h = +m[1], min = +m[2];
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
    }
    const d = (val?.$d instanceof Date) ? val.$d : (val instanceof Date ? val : null);
    if (!d) return '';
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  // ---------- Prefill when opening from a selected row ----------
  useEffect(() => {
    if (mode === 'existing' && selectedEntryRow) {
      const row = selectedEntryRow;
      const name = row['First Name'] && row['Last Name'] ? `${row['First Name']} ${row['Last Name']}` : row['Name'] || '';
      const company = row['Company'] || '';
      const mobile = row['Mobile Number'] || row['Phone'] || '';
      setFormData(prev => ({
        ...prev,
        selectedEntry: `${company} | ${name} | ${mobile}`,
        leadType: 'Existing',
        leadOwner: row['Lead Owner'] || row['Account Owner'] || '',
        meetingDate: '',
        meetingTime: '',
        purpose: ''
      }));
    }
  }, [mode, selectedEntryRow, activeEntryType]);

  // ---------- Reusable events loader ----------
  const loadEvents = async () => {
    if (!user?.username || !user?.role) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'getEvents',
        user: user.username,
        // from / to optional
        // debug: '1',
      });
      const res = await fetch(`${SCRIPT_URL}?${params.toString()}`, { method: 'GET' });
      const text = await res.text();

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error('❌ Could not parse events JSON:', text);
        throw e;
      }

      const arr = Array.isArray(json) ? json : (Array.isArray(json.events) ? json.events : []);
      const cleaned = (arr || []).filter(e => e && e.start && e.title);

      setEvents(cleaned);

      // force size after data arrives
      setTimeout(() => {
        try { calendarRef.current?.getApi().updateSize(); } catch {}
      }, 0);
    } catch (err) {
      console.error('❌ Error fetching calendar events:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Fetch events on mount / user change ----------
  useEffect(() => { loadEvents(); }, [user?.username, user?.role]);

  // ---------- Fetch selectable entries for the modal ----------
  useEffect(() => {
    if (!entryType || selectedEntryRow) return;
    const action =
      activeEntryType === 'Lead' ? 'getLeads'
      : activeEntryType === 'Deal' ? 'getDeals'
      : 'getAccounts';
    fetchEntries(action);
  }, [entryType, selectedEntryRow]);

  const fetchEntries = async (action) => {
    try {
      const url = `${SCRIPT_URL}?action=${action}&user=${encodeURIComponent(user.username)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();

      console.log(`✅ Received ${action} data:`, data);
      if (!Array.isArray(data.entries)) throw new Error("Invalid format: 'entries' is not an array");

      const formatted = [...new Set(data.entries)].map(e => ({ label: e, value: e }));
      setEntries(formatted);
    } catch (err) {
      console.error(`❌ Error fetching ${action}:`, err);
      setEntries([]);
    }
  };

  // ---------- FullCalendar: select to prefill date/time ----------
  const handleDateSelect = (arg) => {
    const date = arg.startStr.split('T')[0];
    const time = arg.startStr.split('T')[1]?.slice(0, 5) || '10:00';
    setFormData(prev => ({ ...prev, meetingDate: date, meetingTime: time, leadOwner: user.username }));
    setOpenDialog(true);
  };

  // ---------- Form handling ----------
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => sendMeetingData();

  const sendMeetingData = async () => {
    const now = new Date();
    const timestamp = now.toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });

    // normalize date/time to safe formats
    const normalizedDate = toISODate(formData.meetingDate);
    const normalizedTime = toHHmm(formData.meetingTime);

    console.debug('🕒 Raw:', { meetingDate: formData.meetingDate, meetingTime: formData.meetingTime });
    console.debug('✅ Normalized:', { normalizedDate, normalizedTime });

    if (!normalizedDate || !normalizedTime) {
      alert('Please select both date and time.');
      return;
    }

    const entryValue =
      activeEntryType === 'Lead'
        ? (formData.leadType === 'Existing' ? formData.selectedEntry : formData.newLeadName)
        : formData.selectedEntry;

    const payload = {
      "Timestamp": timestamp,
      "Meeting Date": normalizedDate,  // YYYY-MM-DD
      "Meeting Time": normalizedTime,  // HH:mm (24h)
      "Select Client": entryValue || '',
      "Purpose & Remarks": formData.purpose || '',
      "Lead Type": formData.leadType || '',
      "Lead Owner": user?.username || 'Unknown',
      "Entry Type": activeEntryType,
      "Entry Value": entryValue || ''
    };

    setLoading(true);
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors", // as requested
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log("📦 Submitted payload:", payload);

      // close and reset
      if (typeof open === 'boolean' && onClose) onClose();
      else setOpenDialog(false);

      setFormData({
        leadType: '', selectedEntry: '', newLeadName: '',
        meetingDate: '', meetingTime: '', purpose: '',
        entryValue: '', leadOwner: ''
      });
      setEntryType('');

      // refresh events without page reload
      await loadEvents();
      alert("✅ Meeting successfully scheduled.");
    } catch (error) {
      console.error("❌ Error submitting meeting:", error);
      alert("❌ Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Sizing fixes ----------
  useEffect(() => {
    if (!open) return;
    const api = calendarRef.current?.getApi();
    setTimeout(() => api?.updateSize(), 50);
    setTimeout(() => api?.updateSize(), 250);
  }, [open]);

  useEffect(() => {
    const wrap = document.getElementById('fc-wrap');
    const api = calendarRef.current?.getApi();
    if (!wrap || !api) return;

    const ro = new ResizeObserver(() => api.updateSize());
    ro.observe(wrap);

    const onWin = () => api.updateSize();
    window.addEventListener('resize', onWin);

    return () => { ro.disconnect(); window.removeEventListener('resize', onWin); };
  }, []);

  // Force a re-render key when number of events changes (helps 0 -> many)
  const calendarKey = useMemo(() => `cal-${events.length}`, [events.length]);

  if (loading) return (<LoadingOverlay />);

  return (
    <Box sx={{ padding: 3, fontFamily: 'Montserrat, sans-serif' }}>
      {/* header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center">
          <img src="/assets/kk-logo.png" alt="Klient Konnect Logo" style={{ height: 100, marginRight: 12 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#2f80ed' }}>Calendar Schedule</Typography>
        </Box>
        <Button
          variant="contained"
          sx={{ fontFamily: 'Montserrat', backgroundColor: '#2f80ed' }}
          onClick={() => setOpenDialog(true)}
        >
          + Create Meeting
        </Button>
      </Box>

      {/* calendar */}
      <Box sx={{ boxShadow: 2, borderRadius: 2, backgroundColor: '#fff' }}>
        <div id="fc-wrap" style={{ minHeight: 600, height: '100%', padding: 12 }}>
          <FullCalendar
            key={calendarKey}
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            selectable
            select={handleDateSelect}
            allDaySlot={false}
            height="100%"
            contentHeight="auto"
            expandRows
            timeZone="Asia/Kolkata"           // ✅ important
            headerToolbar={{ start: 'prev,next today', center: 'title', end: 'timeGridDay,timeGridWeek,dayGridMonth' }}
            dayCellClassNames={(arg) => ["montserrat-day-cell", arg.date.toDateString() === new Date().toDateString() ? "today-highlight" : ""]}
            events={events}                   // pass strings as-is
            eventContent={(eventInfo) => (
              <Box sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.75rem', padding: '4px' }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{eventInfo.event.title}</Typography>
                {eventInfo.event.extendedProps?.purpose && (
                  <Typography sx={{ fontSize: '0.75rem', color: '#666' }}>
                    {eventInfo.event.extendedProps.purpose}
                  </Typography>
                )}
                {eventInfo.event.extendedProps?.owner && (
                  <Typography sx={{ fontSize: '0.7rem', color: '#aaa' }}>
                    by {eventInfo.event.extendedProps.owner}
                  </Typography>
                )}
              </Box>
            )}
          />
        </div>
      </Box>

      {/* modal */}
      <Dialog
        open={typeof open === 'boolean' ? open : openDialog}
        onClose={onClose || (() => setOpenDialog(false))}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { height: '85vh' } }}
      >
        <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
          Schedule Meeting
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {!selectedEntryRow && (
              <>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Entry Type</InputLabel>
                    <Select
                      value={entryType}
                      onChange={(e) => {
                        setEntryType(e.target.value);
                        setFormData(prev => ({ ...prev, leadType: '', selectedEntry: '', newLeadName: '' }));
                      }}
                    >
                      <MenuItem value="Lead">Lead</MenuItem>
                      <MenuItem value="Deal">Deal</MenuItem>
                      <MenuItem value="Account">Account</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {entryType === 'Lead' && (
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Lead Type</InputLabel>
                      <Select
                        value={formData.leadType}
                        onChange={(e) => setFormData(prev => ({ ...prev, leadType: e.target.value }))}
                      >
                        <MenuItem value="Existing">Existing Lead</MenuItem>
                        <MenuItem value="New">New Lead</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}
              </>
            )}

            {(activeEntryType === 'Deal' || activeEntryType === 'Account' || (activeEntryType === 'Lead' && formData.leadType === 'Existing')) && (
              <Grid item xs={12}>
                {mode === 'existing' ? (
                  <TextField
                    label={`${activeEntryType} (Prefilled)`}
                    value={formData.selectedEntry}
                    fullWidth
                    InputProps={{ readOnly: true }}
                  />
                ) : (
                  <FormControl fullWidth>
                    <InputLabel>Select {activeEntryType}</InputLabel>
                    <Select name="selectedEntry" value={formData.selectedEntry} onChange={handleInputChange}>
                      {entries.map((entry, i) => (
                        <MenuItem key={i} value={entry.value}>{entry.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Grid>
            )}

            {entryType === 'Lead' && formData.leadType === 'New' && (
              <Grid item xs={12}>
                <TextField
                  label="New Lead Name"
                  name="newLeadName"
                  fullWidth
                  value={formData.newLeadName}
                  onChange={handleInputChange}
                />
              </Grid>
            )}

            <Grid item xs={6}>
              <TextField
                label="Date"
                name="meetingDate"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={formData.meetingDate}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Time"
                name="meetingTime"
                type="time"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={formData.meetingTime}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Purpose / Remarks"
                name="purpose"
                fullWidth
                multiline
                minRows={2}
                value={formData.purpose}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} textAlign="right">
              <Button
                onClick={handleSubmit}
                variant="contained"
                sx={{ backgroundColor: '#2f80ed', fontFamily: 'Montserrat' }}
              >
                Submit
              </Button>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default CalendarView;

