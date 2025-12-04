import React, { useState } from "react";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";

import MailOutlineIcon from "@mui/icons-material/MailOutline";
import DescriptionIcon from "@mui/icons-material/Description";
import HistoryIcon from "@mui/icons-material/History";
import SendIcon from "@mui/icons-material/Send"; // for bulk sender

import EmailTemplatesTable from "./EmailTemplatesTable";
import EmailLogsTable from "./EmailLogsTable";
import SendEmailModal from "./SendEmailModal";

const cornflowerBlue = "#6495ED";

// ✅ Bulk email Apps Script URL (inline)
const BULK_EMAIL_URL =
  "https://script.google.com/macros/s/AKfycbyHKwZhtRyVNYtECD3LZ_whE4q1Me29Xgv4CLjnpW3N1M0_iXV0d55ZuiJgpViCBJZ_zQ/exec";

export default function EmailDashboard() {
  const [tab, setTab] = useState(0);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  return (
    <Box sx={{ fontFamily: "Montserrat, sans-serif", p: 2 }}>
      {/* HEADER WITH KK LOGO */}
      <Box
        sx={{
          px: 2,
          pb: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <img
            src="/assets/kk-logo.png"
            alt="Klient Konnect"
            style={{ height: 40 }}
          />
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: cornflowerBlue,
                letterSpacing: 0.5,
              }}
            >
              Email Dashboard
            </Typography>
            <Typography
              sx={{
                fontSize: 11,
                color: "#555",
              }}
            >
              Single & bulk campaigns via templates
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* TABS */}
      <Tabs
        value={tab}
        onChange={(e, v) => setTab(v)}
        textColor="primary"
        indicatorColor="primary"
        sx={{
          mb: 2,
          "& .MuiTab-root": {
            fontFamily: "Montserrat, sans-serif",
            textTransform: "none",
            fontSize: 14,
            fontWeight: 600,
          },
        }}
      >
        <Tab label="Send" />
        <Tab label="Templates" />
        <Tab label="Logs" />
      </Tabs>

      {/* ========================================= */}
      {/*               TAB: SEND                   */}
      {/* ========================================= */}
      {tab === 0 && (
        <Box>
          <Typography fontWeight={600} sx={{ mb: 2 }}>
            Choose an action
          </Typography>

          <Stack direction="row" spacing={3} flexWrap="wrap">
            {/* SINGLE SEND CARD */}
            <Card
              sx={{
                width: 250,
                borderRadius: 3,
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                border: `2px solid ${cornflowerBlue}`,
              }}
            >
              <CardActionArea onClick={() => setSendEmailOpen(true)}>
                <CardContent sx={{ textAlign: "center", py: 4 }}>
                  <MailOutlineIcon
                    sx={{ fontSize: 40, color: cornflowerBlue }}
                  />
                  <Typography
                    sx={{
                      mt: 2,
                      fontFamily: "Montserrat",
                      fontWeight: 600,
                    }}
                  >
                    Lead Emails
                  </Typography>
                  <Typography
                    sx={{
                      mt: 0.5,
                      fontSize: 11,
                      color: "#555",
                    }}
                  >
                    Single email to new or existing lead
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>

            {/* BULK SENDER CARD (INLINE IFRAME) */}
            <Card
              sx={{
                width: 250,
                borderRadius: 3,
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                border: `2px solid ${cornflowerBlue}`,
              }}
            >
              <CardActionArea onClick={() => setBulkOpen(true)}>
                <CardContent sx={{ textAlign: "center", py: 4 }}>
                  <SendIcon sx={{ fontSize: 40, color: cornflowerBlue }} />
                  <Typography
                    sx={{
                      mt: 2,
                      fontFamily: "Montserrat",
                      fontWeight: 600,
                    }}
                  >
                    Email Sender
                  </Typography>
                  <Typography
                    sx={{
                      mt: 0.5,
                      fontSize: 11,
                      color: "#555",
                    }}
                  >
                    Campaign sheet based multi-send
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>

            
          </Stack>

          {/* SINGLE SEND MODAL */}
          <SendEmailModal
            open={sendEmailOpen}
            onClose={() => setSendEmailOpen(false)}
          />

          {/* BULK SENDER INLINE MODAL (IFRAME) */}
          <Dialog
            open={bulkOpen}
            onClose={() => setBulkOpen(false)}
            fullWidth
            maxWidth="lg"
          >
            <DialogTitle
              sx={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              Bulk Email Sender
            </DialogTitle>
            <DialogContent
              dividers
              sx={{
                p: 0,
                height: "80vh",
              }}
            >
              <Box sx={{ width: "100%", height: "100%" }}>
                <iframe
                  src={BULK_EMAIL_URL}
                  title="Bulk Email Sender"
                  style={{
                    border: "none",
                    width: "100%",
                    height: "100%",
                  }}
                />
              </Box>
            </DialogContent>
          </Dialog>
        </Box>
      )}

      {/* ========================================= */}
      {/*             TAB: TEMPLATES                */}
      {/* ========================================= */}
      {tab === 1 && (
        <Box sx={{ mt: 2 }}>
          <EmailTemplatesTable />
        </Box>
      )}

      {/* ========================================= */}
      {/*               TAB: LOGS                   */}
      {/* ========================================= */}
      {tab === 2 && (
        <Box sx={{ mt: 2 }}>
          <EmailLogsTable />
        </Box>
      )}
    </Box>
  );
}
