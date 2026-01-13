// ExistenceCheckPage.jsx
import React from "react";
import { Box, Typography, Paper } from "@mui/material";
import ExistenceSearch from "./ExistenceSearch";

const cornflowerBlue = "#6495ED";

export default function ExistenceCheckPage() {
  return (
    <Box sx={{ fontFamily: "Montserrat, sans-serif" }}>
      <Typography
        sx={{
          fontSize: 20,
          fontWeight: 900,
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
        <ExistenceSearch />
      </Paper>
    </Box>
  );
}
