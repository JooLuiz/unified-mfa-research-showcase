import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="react-mfe-preview">
      <h1>React MFE Remote</h1>
      <p>This app exposes Module Federation modules and a Header web component.</p>
    </main>
  );
}

const rootContainer = document.getElementById("root");
if (rootContainer) {
  createRoot(rootContainer).render(<App />);
}
