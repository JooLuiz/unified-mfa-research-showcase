import React from "react";
import { createRoot } from "react-dom/client";
import PrettyIcons from "js-pretty-icons";
import "./styles.css";

function FormularySentView() {
  return React.createElement(
    "section",
    { className: "formulary-sent-shell" },
    React.createElement(PrettyIcons, {
      icon: "check-circle",
      width: 30,
      height: 30,
      className: "formulary-sent-icon",
    }),
    React.createElement("strong", null, "form submitted successfully"),
  );
}

class FormularySentElement extends HTMLElement {
  connectedCallback() {
    this.root = createRoot(this);
    this.root.render(React.createElement(FormularySentView));
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
    }
  }
}

export function registerFormularySentElement() {
  const customElementName = "angular-formulary-sent";
  if (!customElements.get(customElementName)) {
    customElements.define(customElementName, FormularySentElement);
  }
}

export function mountFormularySent(containerElement) {
  const formularySentElement = document.createElement("angular-formulary-sent");
  containerElement.appendChild(formularySentElement);

  return () => {
    containerElement.innerHTML = "";
  };
}
