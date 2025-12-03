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
} from "@mui/material";

import MailOutlineIcon from "@mui/icons-material/MailOutline";
import DescriptionIcon from "@mui/icons-material/Description";
import HistoryIcon from "@mui/icons-material/History";
import GroupIcon from "@mui/icons-material/Group"; // for bulk email sender

import EmailTemplatesTable from "./EmailTemplatesTable";
import SendEmailModal from "./SendEmailModal";
// ⬇️ Hook your existing multi-email sender here
// import MultipleEmailSenderModal from "./MultipleEmailSenderModal";

const cornflowerBlue = "#6495ED";

export default function EmailDashboard() {
  const [tab, setTab] = useState(0);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);

  return (
    <Box sx={{ fontFamily: "Montserrat, sans-serif", p: 2 }}>
      {/* HEADER WITH KK LOGO + TITLE */}
      <Box
        sx={{
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          rowGap: 1.5,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          {/* Klient Konnect Logo */}
          <Box
            component="img"
            src="/kk-logo.png"
            alt="Klient Konnect"
            sx={{
              height: 40,
              objectFit: "contain",
            }}
          />

          <Box>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{
                color: cornflowerBlue,
                letterSpacing: 0.5,
              }}
            >
              Email Dashboard
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "#555",
                mt: 0.3,
              }}
            >
              Manage templates, send single mails, and run bulk campaigns –
              empowered by Klient Konnect.
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
            fontSize: 15,
            fontWeight: 600,
          },
        }}
      >
        <Tab label="Send Email" />
        <Tab label="Templates" />
        <Tab label="Logs" />
      </Tabs>

      {/* SEND EMAIL TAB */}
      {tab === 0 && (
        <Box>
          <Typography fontWeight={600} sx={{ mb: 2 }}>
            Choose an action
          </Typography>

          <Stack direction="row" spacing={3} flexWrap="wrap">
            {/* SEND EMAIL CARD (Single Email) */}
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
                    Send Email
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.5,
                      color: "#666",
                    }}
                  >
                    One-to-one email with templates & preview.
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>

            {/* MANAGE TEMPLATES CARD */}
            <Card
              sx={{
                width: 250,
                borderRadius: 3,
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                border: `2px solid ${cornflowerBlue}`,
              }}
            >
              <CardActionArea onClick={() => setTab(1)}>
                <CardContent sx={{ textAlign: "center", py: 4 }}>
                  <DescriptionIcon
                    sx={{ fontSize: 40, color: cornflowerBlue }}
                  />
                  <Typography
                    sx={{
                      mt: 2,
                      fontFamily: "Montserrat",
                      fontWeight: 600,
                    }}
                  >
                    Manage Templates
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.5,
                      color: "#666",
                    }}
                  >
                    Create and edit reusable email templates.
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>

            {/* LOGS CARD */}
            <Card
              sx={{
                width: 250,
                borderRadius: 3,
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                border: `2px solid ${cornflowerBlue}`,
              }}
            >
              <CardActionArea onClick={() => setTab(2)}>
                <CardContent sx={{ textAlign: "center", py: 4 }}>
                  <HistoryIcon
                    sx={{ fontSize: 40, color: cornflowerBlue }}
                  />
                  <Typography
                    sx={{
                      mt: 2,
                      fontFamily: "Montserrat",
                      fontWeight: 600,
                    }}
                  >
                    View Logs
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.5,
                      color: "#666",
                    }}
                  >
                    Track email events and delivery history.
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>

            {/* ✅ BULK / MULTIPLE EMAIL SENDER CARD (4th button) */}
            <Card
              sx={{
                width: 250,
                borderRadius: 3,
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                border: `2px solid ${cornflowerBlue}`,
              }}
            >
              <CardActionArea onClick={() => setBulkEmailOpen(true)}>
                <CardContent sx={{ textAlign: "center", py: 4 }}>
                  <GroupIcon sx={{ fontSize: 40, color: cornflowerBlue }} />
                  <Typography
                    sx={{
                      mt: 2,
                      fontFamily: "Montserrat",
                      fontWeight: 600,
                    }}
                  >
                    Bulk Email Sender
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.5,
                      color: "#666",
                    }}
                  >
                    Send campaigns to multiple leads/accounts with one template.
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Stack>

          {/* SEND EMAIL MODAL (single) */}
          <SendEmailModal
            open={sendEmailOpen}
            onClose={() => setSendEmailOpen(false)}
          />

          {/* BULK / MULTIPLE EMAIL MODAL */}
          {/* Replace with your actual multi-email sender component & props */}
          {/* 
          <MultipleEmailSenderModal
            open={bulkEmailOpen}
            onClose={() => setBulkEmailOpen(false)}
          />
          */}
        </Box>
      )}

      {/* TEMPLATES TAB */}
      {tab === 1 && (
        <Box sx={{ mt: 2 }}>
          <EmailTemplatesTable />
        </Box>
      )}

      {/* LOGS TAB */}
      {tab === 2 && (
        <Box sx={{ mt: 2 }}>
          <Typography
            sx={{
              fontFamily: "Montserrat",
              fontWeight: 600,
              mt: 1,
              mb: 1,
            }}
          >
            Email Logs (Coming Soon)
          </Typography>

          <Box
            sx={{
              p: 3,
              borderRadius: 2,
              border: "1px dashed #ccc",
              color: "#444",
              fontStyle: "italic",
            }}
          >
            Logs from the “Email_Events” sheet will appear here.
          </Box>
        </Box>
      )}
    </Box>
  );
}
