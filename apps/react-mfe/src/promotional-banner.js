import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function PromotionalBannerView({ banner, onNavigate }) {
  if (!banner) {
    return <section className="banner-card">No banner available.</section>;
  }

  return (
    <section className="banner-card">
      <h2>Promotional Banner</h2>
      <img src={banner.imageUrl} alt={banner.title} />
      <strong>{banner.title}</strong>
      <button className="header-action" onClick={() => onNavigate(`/product?productId=${banner.associatedProductId}`)}>
        View related product
      </button>
    </section>
  );
}

export function mountPromotionalBanner(containerElement, props) {
  const root = createRoot(containerElement);
  root.render(<PromotionalBannerView banner={props.banner} onNavigate={props.onNavigate} />);

  return () => {
    root.unmount();
  };
}
