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
import SendIcon from "@mui/icons-material/Send"; // for bulk sender

import EmailTemplatesTable from "./EmailTemplatesTable";
import EmailLogsTable from "./EmailLogsTable";
import SendEmailModal from "./SendEmailModal";
import BulkEmailSender from './BulkEmailSender';

const cornflowerBlue = "#6495ED";

export default function EmailDashboard() {
  const [tab, setTab] = useState(0);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  return (
    <Box sx={{ fontFamily: "Montserrat, sans-serif", p: { xs: 1, sm: 2 } }}>
      {/* HEADER WITH KK LOGO */}
      <Box
        sx={{
          px: { xs: 0.5, sm: 2 },
          pb: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          textAlign: { xs: 'center', sm: 'left' },
          mb: 1.5,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: { xs: 'column', sm: 'row' }, alignItems: "center", gap: { xs: 0.5, sm: 1.5 }, width: '100%' }}>
          <img
            className="crm-primary-logo"
            src="/assets/rido-sports-logo.png"
            alt="Rido Sports"
          />
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 500,
                color: cornflowerBlue,
                letterSpacing: 0.5,
                fontSize: { xs: 16, sm: 20 },
              }}
            >
              Client Communication Dashboard
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 500,
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
          width: { xs: '100%', sm: 'auto' },
          "& .MuiTab-root": {
            fontFamily: "Montserrat, sans-serif",
            textTransform: "none",
            fontSize: { xs: 12, sm: 14 },
            fontWeight: 600,
            minWidth: { xs: 0, sm: 90 },
            flex: { xs: 1, sm: 'initial' },
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
          <Typography fontWeight={400} sx={{ fontFamily: 'Montserrat,sans-serif', fontSize: 9, mb: 2 }}>
            Select action
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 3 }} flexWrap="wrap">
            {/* SINGLE SEND CARD */}
            <Card
              sx={{
                width: { xs: '100%', sm: 250 },
                borderRadius: 3,
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                border: `2px solid ${cornflowerBlue}`,
              }}
            >
              <CardActionArea onClick={() => setSendEmailOpen(true)}>
                <CardContent sx={{ textAlign: "center", py: { xs: 2.5, sm: 4 } }}>
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

            {/* NATIVE CAMPAIGN SENDER */}
            <Card
              sx={{
                width: { xs: '100%', sm: 250 },
                borderRadius: 3,
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                border: `2px solid ${cornflowerBlue}`,
              }}
            >
              <CardActionArea onClick={() => setBulkOpen(true)}>
                <CardContent sx={{ textAlign: "center", py: { xs: 2.5, sm: 4 } }}>
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

          <BulkEmailSender open={bulkOpen} onClose={() => setBulkOpen(false)} />
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
