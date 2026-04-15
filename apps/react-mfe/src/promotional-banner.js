import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function PromotionalBannerView({ banner, onNavigate }) {
  if (!banner) {
    return <section className="banner-card">No banner available.</section>;
  }

  const promotionPath = `/product?productId=${banner.associatedProductId}`;
  return (
    <section className="banner-card">
      <h2>{banner.title}</h2>
      <img
        src={banner.imageUrl}
        alt={banner.title}
        className="banner-image-clickable"
        onClick={() => onNavigate(promotionPath)}
      />
      <strong>
        {banner.productTitle
          ? `Featured Product: ${banner.productTitle}`
          : "Featured Product"}
      </strong>
      <button
        className="header-action"
        onClick={() => onNavigate(promotionPath)}
      >
        View Promotion
      </button>
    </section>
  );
}

export function mountPromotionalBanner(containerElement, props) {
  const root = createRoot(containerElement);
  root.render(
    <PromotionalBannerView
      banner={props.banner}
      onNavigate={props.onNavigate}
    />,
  );

  return () => {
    root.unmount();
  };
}
