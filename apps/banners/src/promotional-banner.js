import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

async function fetchBannerById(apiBaseUrl, bannerId, signal) {
  const response = await fetch(`${apiBaseUrl}/banners/${bannerId}`, { signal });
  if (!response.ok) {
    throw new Error(
      `fetchBannerById - request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

function PromotionalBannerView({ bannerId, apiBaseUrl, onApplyPromotion }) {
  const [bannerData, setBannerData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!bannerId || !apiBaseUrl) {
      setBannerData(null);
      return undefined;
    }

    const abortController = new AbortController();
    setIsLoading(true);
    setLoadError(null);

    fetchBannerById(apiBaseUrl, bannerId, abortController.signal)
      .then((fetchedBanner) => {
        if (!abortController.signal.aborted) {
          setBannerData(fetchedBanner);
          setIsLoading(false);
        }
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          return;
        }
        console.warn("PromotionalBannerView - error");
        console.warn(error);
        setLoadError(error);
        setBannerData(null);
        setIsLoading(false);
      });

    return () => {
      abortController.abort();
    };
  }, [bannerId, apiBaseUrl]);

  if (isLoading && !bannerData) {
    return <section className="banner-card">Loading banner...</section>;
  }

  if (loadError || !bannerData) {
    return <section className="banner-card">No banner available.</section>;
  }

  const handleApplyPromotion = () => {
    if (typeof onApplyPromotion === "function") {
      onApplyPromotion(bannerData.filters || {}, bannerData);
    }
  };

  return (
    <section className="banner-card">
      <h2>{bannerData.title}</h2>
      <img
        src={bannerData.imageUrl}
        alt={bannerData.title}
        className="banner-image-clickable"
        onClick={handleApplyPromotion}
      />
      <strong>Shop the Collection</strong>
      <button className="banner-action" onClick={handleApplyPromotion}>
        View Promotion
      </button>
    </section>
  );
}

export function mountPromotionalBanner(containerElement, props) {
  const root = createRoot(containerElement);
  root.render(
    <PromotionalBannerView
      bannerId={props.bannerId}
      apiBaseUrl={props.apiBaseUrl}
      onApplyPromotion={props.onApplyPromotion}
    />,
  );

  return () => {
    root.unmount();
  };
}
