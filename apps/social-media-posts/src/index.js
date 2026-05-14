import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="react-mfe-preview">
      <h1>Social Media Posts MFE</h1>
      <p>This domain exposes the React Post Feed via Module Federation.</p>
    </main>
  );
}

const rootContainer = document.getElementById("root");
if (rootContainer) {
  createRoot(rootContainer).render(<App />);
}
