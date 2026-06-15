import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { ThemeProvider } from "./lib/theme";
import { VaultProvider } from "./vault/VaultContext";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <VaultProvider>
        <App />
      </VaultProvider>
    </ThemeProvider>
  </React.StrictMode>
);
