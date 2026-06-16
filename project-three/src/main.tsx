import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { VaultProvider } from "./lib/vault";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <VaultProvider>
      <App />
    </VaultProvider>
  </React.StrictMode>
);
