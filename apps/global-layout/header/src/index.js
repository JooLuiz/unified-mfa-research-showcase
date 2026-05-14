import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="react-mfe-preview">
      <h1>Global Layout - Header</h1>
      <p>This sub-project exposes the React Header Web Component via Module Federation.</p>
    </main>
  );
}

const rootContainer = document.getElementById("root");
if (rootContainer) {
  createRoot(rootContainer).render(<App />);
}
