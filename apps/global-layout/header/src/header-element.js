import React from "react";
import { createRoot } from "react-dom/client";
import PrettyIcons from "js-pretty-icons";
import "./styles.css";

const ECOMMERCE_NAV_LINKS = [
  { path: "/products", label: "Products" },
  { path: "/promotions", label: "Promotions" },
];

const SOCIAL_NAV_LINKS = [{ path: "/posts", label: "Posts" }];

function getNavigationLinks(appType) {
  if (appType === "social") {
    return SOCIAL_NAV_LINKS;
  }
  return ECOMMERCE_NAV_LINKS;
}

function HeaderView({
  appType,
  totalPrice,
  itemCount,
  isAuthenticated,
  currentUserName,
  onNavigate,
  onLogout,
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const navigationLinks = getNavigationLinks(appType);
  const isSocialShell = appType === "social";

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
          <svg
            className="header-logo-svg"
            viewBox="0 0 64 64"
            aria-hidden="true"
          >
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
          {navigationLinks.map((navigationLink) => (
            <button
              key={navigationLink.path}
              className="header-action"
              onClick={() => onNavigate(navigationLink.path)}
            >
              {navigationLink.label}
            </button>
          ))}
        </div>

        <button
          className="header-action mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen((currentState) => !currentState)}
        >
          Menu
        </button>

        {isMobileMenuOpen && (
          <div className="mobile-menu-dropdown">
            {navigationLinks.map((navigationLink) => (
              <button
                key={navigationLink.path}
                className="header-action"
                onClick={() => navigateFromMenu(navigationLink.path)}
              >
                {navigationLink.label}
              </button>
            ))}
            {isAuthenticated && (
              <button
                className="header-action"
                onClick={() => navigateFromMenu("/account")}
              >
                Account
              </button>
            )}
          </div>
        )}
      </div>
      <div className="header-group header-right-group">
        {isAuthenticated ? (
          <>
            <button
              className="header-action"
              onClick={() => onNavigate("/account")}
            >
              {currentUserName || "Account"}
            </button>
            <button
              className="header-action"
              onClick={() => onLogout && onLogout()}
            >
              Log out
            </button>
          </>
        ) : (
          <button
            className="header-action"
            onClick={() => onNavigate("/login")}
          >
            Log in
          </button>
        )}
        {!isSocialShell && (
          <>
            <button
              className="header-action cart-action"
              onClick={() => onNavigate("/checkout")}
            >
              <PrettyIcons icon="cart" width={20} height={20} />
              <span className="cart-item-count">{itemCount}</span>
            </button>
            <button
              className="header-action"
              onClick={() => onNavigate("/checkout")}
            >
              Total: ${totalPrice.toFixed(2)}
            </button>
          </>
        )}
      </div>
    </header>
  );
}

class HeaderElement extends HTMLElement {
  constructor() {
    super();

    if (Object.prototype.hasOwnProperty.call(this, "state")) {
      const preUpgradeState = this.state;
      delete this.state;
      this.state = preUpgradeState;
    }
  }

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
    const isAuthenticated = Boolean(this.internalState?.isAuthenticated);
    const currentUserName = this.internalState?.currentUserName || "";
    const appType = this.internalState?.appType || "ecommerce";

    this.root.render(
      <HeaderView
        appType={appType}
        totalPrice={totalPrice}
        itemCount={itemCount}
        isAuthenticated={isAuthenticated}
        currentUserName={currentUserName}
        onNavigate={(path) => {
          this.dispatchEvent(
            new CustomEvent("host:navigate", {
              detail: { path },
              bubbles: true,
            }),
          );
        }}
        onLogout={() => {
          this.dispatchEvent(
            new CustomEvent("host:logout", {
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
