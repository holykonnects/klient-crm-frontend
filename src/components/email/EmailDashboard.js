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

import EmailTemplatesTable from "./EmailTemplatesTable";
import SendEmailModal from "./SendEmailModal";

const cornflowerBlue = "#6495ED";

export default function EmailDashboard() {
  const [tab, setTab] = useState(0);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);

  return (
    <Box sx={{ fontFamily: "Montserrat, sans-serif", p: 2 }}>
      {/* PAGE TITLE */}
      <Typography
        variant="h5"
        fontWeight="700"
        sx={{
          mb: 2,
          color: cornflowerBlue,
          letterSpacing: 0.5,
        }}
      >
        Email Dashboard
      </Typography>

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
            {/* SEND EMAIL CARD */}
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
                </CardContent>
              </CardActionArea>
            </Card>
          </Stack>

          {/* SEND EMAIL MODAL */}
          <SendEmailModal
            open={sendEmailOpen}
            onClose={() => setSendEmailOpen(false)}
          />
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

          {/* PLACEHOLDER */}
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
