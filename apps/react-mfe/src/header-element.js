import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function HeaderView({ totalPrice, onNavigate }) {
  return (
    <header className="header-shell">
      <div className="header-group">
        <span className="header-logo">Generic Site Logo</span>
        <button className="header-action" onClick={() => onNavigate("/products")}>
          Products (Link)
        </button>
        <button className="header-action" onClick={() => onNavigate("/")}>
          Promotions (Link)
        </button>
      </div>
      <div className="header-group">
        <span className="header-action">Cart Icon</span>
        <span className="header-action">Total price of cart currently: ${totalPrice.toFixed(2)}</span>
      </div>
    </header>
  );
}

class HeaderElement extends HTMLElement {
  connectedCallback() {
    this.root = createRoot(this);
    this.renderComponent();
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
    }
  }

  set state(nextState) {
    this.internalState = nextState;
    this.renderComponent();
  }

  get state() {
    return this.internalState;
  }

  renderComponent() {
    if (!this.root) {
      return;
    }

    const totalPrice = this.internalState?.totalPrice || 0;
    this.root.render(
      <HeaderView
        totalPrice={totalPrice}
        onNavigate={(path) => {
          this.dispatchEvent(
            new CustomEvent("host:navigate", {
              detail: { path },
              bubbles: true,
            }),
          );
        }}
      />,
    );
  }
}

export function registerHeaderElement() {
  const customElementName = "react-header-mfe";
  if (!customElements.get(customElementName)) {
    customElements.define(customElementName, HeaderElement);
  }
}
