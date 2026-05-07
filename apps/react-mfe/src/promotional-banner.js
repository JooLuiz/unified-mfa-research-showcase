import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function PromotionalBannerView({ banner, onApplyPromotion }) {
  if (!banner) {
    return <section className="banner-card">No banner available.</section>;
  }

  const handleApplyPromotion = () => {
    if (typeof onApplyPromotion === "function") {
      onApplyPromotion(banner.filters || {});
    }
  };

  return (
    <section className="banner-card">
      <h2>{banner.title}</h2>
      <img
        src={banner.imageUrl}
        alt={banner.title}
        className="banner-image-clickable"
        onClick={handleApplyPromotion}
      />
      <strong>Shop the Collection</strong>
      <button className="header-action" onClick={handleApplyPromotion}>
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
      onApplyPromotion={props.onApplyPromotion}
    />,
  );

  return () => {
    root.unmount();
  };
}
