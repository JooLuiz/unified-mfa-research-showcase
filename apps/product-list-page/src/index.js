import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="react-mfe-preview">
      <h1>Product List Page MFE</h1>
      <p>This domain exposes the React Product List Page (with filters) via Module Federation.</p>
    </main>
  );
}

const rootContainer = document.getElementById("root");
if (rootContainer) {
  createRoot(rootContainer).render(<App />);
}
