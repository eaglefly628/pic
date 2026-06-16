import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { ThemeProvider } from "./lib/theme";
import { LibraryProvider } from "./lib/library";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LibraryProvider>
        <App />
      </LibraryProvider>
    </ThemeProvider>
  </React.StrictMode>
);
