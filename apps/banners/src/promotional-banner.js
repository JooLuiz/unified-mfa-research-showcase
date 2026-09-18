/**
 * Promotional banner remote for catalog promotion intents.
 * Role: Renders a banner and publishes catalog.promotion-applied on the host mesh when applied.
 * Not in this file: Mesh configuration (host shell owns configureMesh) or PLP filter ownership.
 * Key dependencies: event-mesh/mesh singleton; @shared/catalog-events.
 * See also: MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import mesh from "event-mesh/mesh";
import { createCatalogEvents } from "@shared/catalog-events";
import "./styles.css";

const { publishPromotionApplied } = createCatalogEvents({ mesh });

async function fetchBannerById(apiBaseUrl, bannerId, signal) {
  const response = await fetch(`${apiBaseUrl}/banners/${bannerId}`, { signal });
  if (!response.ok) {
    throw new Error(
      `fetchBannerById - request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

function PromotionalBannerView({ banner, bannerId, apiBaseUrl }) {
  const [bannerData, setBannerData] = useState(banner || null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (banner) {
      setBannerData(banner);
      setIsLoading(false);
      setLoadError(null);
      return undefined;
    }

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
  }, [banner, bannerId, apiBaseUrl]);

  if (isLoading && !bannerData) {
    return <section className="banner-card">Loading banner...</section>;
  }

  if (loadError || !bannerData) {
    return <section className="banner-card">No banner available.</section>;
  }

  const handleApplyPromotion = () => {
    publishPromotionApplied({ filters: bannerData.filters || {} });
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
      banner={props.banner}
      bannerId={props.bannerId}
      apiBaseUrl={props.apiBaseUrl}
    />,
  );

  return () => {
    root.unmount();
  };
}
