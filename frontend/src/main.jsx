/**
 * @file main.jsx
 * @description Application client bootstrap entry point.
 * Mounts the React application root into the DOM, wrapped with StrictMode
 * and the ThemeProvider context.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

// Find root DOM element and render the app tree
const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);

