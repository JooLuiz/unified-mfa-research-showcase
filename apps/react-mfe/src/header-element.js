import React from "react";
import { createRoot } from "react-dom/client";
import PrettyIcons from "js-pretty-icons";
import "./styles.css";

function HeaderView({ totalPrice, itemCount, onNavigate }) {
  return (
    <header className="header-shell">
      <div className="header-group">
        <button className="header-logo-button" onClick={() => onNavigate("/")}>
          <svg className="header-logo-svg" viewBox="0 0 64 64" aria-hidden="true">
            <rect x="10" y="20" width="26" height="30" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
            <path d="M23 20v30" stroke="currentColor" strokeWidth="2.5" />
            <path d="M8 24c8-6 20-6 28 0" stroke="currentColor" strokeWidth="2.5" fill="none" />
            <circle cx="44" cy="32" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <ellipse cx="44" cy="32" rx="16" ry="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <ellipse cx="44" cy="32" rx="6.5" ry="16" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="56" cy="31" r="2.5" fill="currentColor" />
          </svg>
          <span className="header-logo-title">MFE Lab</span>
        </button>
        <button className="header-action" onClick={() => onNavigate("/products")}>
          Products
        </button>
        <button className="header-action" onClick={() => onNavigate("/promotions")}>
          Promotions
        </button>
      </div>
      <div className="header-group">
        <button className="header-action cart-action" onClick={() => onNavigate("/checkout")}>
          <PrettyIcons icon="cart" width={20} height={20} />
          <span className="cart-item-count">{itemCount}</span>
        </button>
        <button className="header-action" onClick={() => onNavigate("/checkout")}>
          Total: ${totalPrice.toFixed(2)}
        </button>
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
    const itemCount = this.internalState?.itemCount || 0;
    this.root.render(
      <HeaderView
        totalPrice={totalPrice}
        itemCount={itemCount}
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
