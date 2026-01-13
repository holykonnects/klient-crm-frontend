import React from "react";
import { Box, Typography, Paper } from "@mui/material";
import ExistenceSearch from "./ExistenceSearch";

const cornflowerBlue = "#6495ED";

const EXISTENCE_SEARCH_BACKEND_URL =
  "https://script.google.com/macros/s/AKfycbzlQehb3L1sGPfJY0llUf-24bu8PjiGAJtEGXvh6mQJkbfDJLTU2o4g_HLxinBX_q6B4g/exec";

export default function ExistenceCheckPage() {
  return (
    <Box sx={{ fontFamily: "Montserrat, sans-serif" }}>
      <Typography
        sx={{
          fontSize: 20,
          fontWeight: 800,
          color: cornflowerBlue,
          mb: 2,
          fontFamily: "Montserrat, sans-serif"
        }}
      >
        CRM Existence Check
      </Typography>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3,
          border: "1px solid #eaeaea",
          background: "#fff"
        }}
      >
        {/* Full-width, comfortable UX */}
        <ExistenceSearch backendUrl={EXISTENCE_SEARCH_BACKEND_URL} open={true} />
      </Paper>
    </Box>
  );
}
