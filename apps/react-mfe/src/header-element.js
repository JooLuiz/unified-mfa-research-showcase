import React from "react";
import { createRoot } from "react-dom/client";
import PrettyIcons from "js-pretty-icons";
import "./styles.css";

function HeaderView({ totalPrice, itemCount, onNavigate }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const navigateFromMenu = (path) => {
    onNavigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="header-shell">
      <div className="header-left-group">
        <button className="header-logo-button" onClick={() => onNavigate("/")}>
          <svg className="header-logo-svg" viewBox="0 0 64 64" aria-hidden="true">
            <path
              d="M8 25l24-12 24 12-24 12L8 25z"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M20 31v10c0 4 6 7 12 7s12-3 12-7V31"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M52 28v15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="52" cy="46" r="2.5" fill="currentColor" />
          </svg>
          <span className="header-logo-title">MFE Lab</span>
        </button>

        <div className="header-desktop-nav">
          <button className="header-action" onClick={() => onNavigate("/products")}>
            Products
          </button>
          <button className="header-action" onClick={() => onNavigate("/promotions")}>
            Promotions
          </button>
        </div>

        <button
          className="header-action mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen((currentState) => !currentState)}
        >
          Menu
        </button>

        {isMobileMenuOpen && (
          <div className="mobile-menu-dropdown">
            <button className="header-action" onClick={() => navigateFromMenu("/products")}>
              Products
            </button>
            <button className="header-action" onClick={() => navigateFromMenu("/promotions")}>
              Promotions
            </button>
          </div>
        )}
      </div>
      <div className="header-group header-right-group">
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
