import { navigate } from "./navigate";
import {
  mountFaqIframe,
  mountCheckoutEmptyIframe,
  mountOrderPlacedIframe,
} from "./mountActions";
import {
  dispatchAddToCartEvent,
  getCartTotalValue,
  updateCartItem,
  removeCartItem,
} from "./cartActions";
import {
  calculatePlpItemsPerRow,
  getPlpInitialVisibleCount,
  filterProducts,
} from "./PLPProductsActions";
import { storePLPFilters, normalizePlpFilters } from "./PLPFilterActions";

async function renderHomePage(
  appState,
  pageMount,
  modules,
  activeCleanupFunctions,
) {
  pageMount.innerHTML = `
    <div id="bannerMount"></div>
    <div id="showcaseMount"></div>
    <div id="faqMount"></div>
    <div id="noticeMount"></div>
  `;

  const bannerMount = pageMount.querySelector("#bannerMount");
  const showcaseMount = pageMount.querySelector("#showcaseMount");
  const faqMount = pageMount.querySelector("#faqMount");
  const noticeMount = pageMount.querySelector("#noticeMount");

  const firstBanner = appState.banners[0];
  const showcaseConfiguration = appState.showcases[0];
  const showcaseProducts = (showcaseConfiguration?.productIds || [])
    .map((productId) => appState.productsById[productId])
    .filter(Boolean);

  activeCleanupFunctions.push(
    modules.mountPromotionalBanner(bannerMount, {
      banner: firstBanner,
      onApplyPromotion: (promotionFilters) =>
        applyPromotionFilters(appState, promotionFilters),
    }),
  );
  activeCleanupFunctions.push(
    modules.mountProductShowcase(showcaseMount, {
      title: showcaseConfiguration?.showcaseTitle || "New Products Showcase",
      products: showcaseProducts,
      mountProductCard: modules.mountProductCard,
      onProductClick: (productId) =>
        navigate(`/product?productId=${productId}`),
      onAddToCart: dispatchAddToCartEvent,
    }),
  );
  if (appState.isFormularySubmitted) {
    activeCleanupFunctions.push(modules.mountFormularySent(faqMount));
  } else {
    activeCleanupFunctions.push(mountFaqIframe(faqMount));
  }

  if (appState.lastIframeMessage) {
    noticeMount.innerHTML = `<div class="notice-box">Latest iframe message: ${appState.lastIframeMessage}</div>`;
  }
}

async function renderPromotionsPage(
  appState,
  pageMount,
  modules,
  activeCleanupFunctions,
) {
  pageMount.innerHTML = `<section id="promotionsMount" class="page-content"></section>`;
  const promotionsMount = pageMount.querySelector("#promotionsMount");

  appState.banners.forEach((banner) => {
    const bannerContainer = document.createElement("div");
    promotionsMount.appendChild(bannerContainer);
    activeCleanupFunctions.push(
      modules.mountPromotionalBanner(bannerContainer, {
        banner,
        onApplyPromotion: (promotionFilters) =>
          applyPromotionFilters(appState, promotionFilters),
      }),
    );
  });
}

function applyPromotionFilters(appState, promotionFilters) {
  appState.plpFilters = normalizePlpFilters(promotionFilters || {});
  appState.plpVisibleCount = getPlpInitialVisibleCount();
  storePLPFilters(appState);
  navigate("/products");
}

async function renderProductListPage(
  appState,
  pageMount,
  modules,
  activeCleanupFunctions,
) {
  pageMount.innerHTML = `<section id="plpMount"></section>`;
  const plpMount = pageMount.querySelector("#plpMount");
  appState.plpItemsPerRow = calculatePlpItemsPerRow();
  const minimumVisibleCount = getPlpInitialVisibleCount(
    appState.plpItemsPerRow,
  );
  appState.plpVisibleCount = Math.max(
    appState.plpVisibleCount,
    minimumVisibleCount,
  );

  const normalizedProducts = filterProducts(appState, [...appState.products]);
  const visibleCount = Math.min(
    appState.plpVisibleCount,
    normalizedProducts.length,
  );
  const visibleProducts = normalizedProducts.slice(0, visibleCount);
  const canLoadMore = visibleCount < normalizedProducts.length;

  activeCleanupFunctions.push(
    modules.mountProductList(plpMount, {
      products: visibleProducts,
      totalProducts: normalizedProducts.length,
      activeSort: appState.plpSortBy,
      activeFilters: appState.plpFilters,
      categories: appState.categories,
      onSortChange: (nextSortBy) => {
        appState.plpSortBy = nextSortBy;
        window.dispatchEvent(new CustomEvent("global:renderApp"));
      },
      onApplyFilters: (nextFilters) => {
        appState.plpFilters = normalizePlpFilters(nextFilters);
        appState.plpVisibleCount = getPlpInitialVisibleCount();
        storePLPFilters(appState);
        window.dispatchEvent(new CustomEvent("global:renderApp"));
      },
      onClearFilters: (nextFilters) => {
        appState.plpFilters = normalizePlpFilters(nextFilters);
        appState.plpVisibleCount = getPlpInitialVisibleCount();
        storePLPFilters(appState);
        window.dispatchEvent(new CustomEvent("global:renderApp"));
      },
      onLoadMore: () => {
        appState.plpVisibleCount += appState.plpItemsPerRow;
        window.dispatchEvent(new CustomEvent("global:renderApp"));
      },
      canLoadMore,
      onProductClick: (productId) =>
        navigate(`/product?productId=${productId}`),
      onAddToCart: dispatchAddToCartEvent,
      mountProductCard: modules.mountProductCard,
    }),
  );
}

async function renderProductDetailsPage(
  appState,
  pageMount,
  modules,
  activeCleanupFunctions,
) {
  pageMount.innerHTML = `<section id="pdpMount"></section>`;
  const pdpMount = pageMount.querySelector("#pdpMount");
  const currentUrl = new URL(window.location.href);
  const productId =
    currentUrl.searchParams.get("productId") || appState.products[0]?.id;
  const selectedProduct = appState.productsById[productId];
  const similarProducts = (selectedProduct?.similarProducts || [])
    .map((similarProductId) => appState.productsById[similarProductId])
    .filter(Boolean);

  activeCleanupFunctions.push(
    modules.mountProductDetails(pdpMount, {
      product: selectedProduct,
      similarProducts,
      onAddToCart: dispatchAddToCartEvent,
      mountSimilarProducts: (containerElement, similarProductsProps) =>
        modules.mountProductShowcase(containerElement, {
          title: similarProductsProps.title,
          products: similarProductsProps.products,
          mountProductCard: modules.mountProductCard,
          onProductClick: (nextProductId) =>
            navigate(`/product?productId=${nextProductId}`),
          onAddToCart: dispatchAddToCartEvent,
        }),
    }),
  );
}

async function renderCheckoutPage(
  appState,
  pageMount,
  modules,
  activeCleanupFunctions,
) {
  if (appState.cartItems.length === 0) {
    pageMount.innerHTML = `<section id="checkoutEmptyMount"></section>`;
    const checkoutEmptyMount = pageMount.querySelector("#checkoutEmptyMount");
    activeCleanupFunctions.push(mountCheckoutEmptyIframe(checkoutEmptyMount));
    return;
  }

  pageMount.innerHTML = `
    <section class="checkout-grid">
      <div id="checkoutItemsMount"></div>
      <div class="checkout-right-column">
        <div id="checkoutSummaryMount"></div>
        <div id="applyCouponMount"></div>
      </div>
    </section>
  `;

  const checkoutItemsMount = pageMount.querySelector("#checkoutItemsMount");
  const checkoutSummaryMount = pageMount.querySelector("#checkoutSummaryMount");
  const applyCouponMount = pageMount.querySelector("#applyCouponMount");

  const subtotal = getCartTotalValue(appState);
  const discountPercentage = appState.appliedCoupon?.discountPercentage || 0;
  const discountAmount = subtotal * (discountPercentage / 100);

  activeCleanupFunctions.push(
    modules.mountCheckoutItems(checkoutItemsMount, {
      cartItems: appState.cartItems,
      productsById: appState.productsById,
      onQuantityChange: (productId, quantity) => {
        updateCartItem(appState, productId, quantity);
        window.dispatchEvent(new CustomEvent("global:renderApp"));
      },
      onRemoveItem: (productId) => {
        removeCartItem(appState, productId);
        window.dispatchEvent(new CustomEvent("global:renderApp"));
      },
    }),
  );

  activeCleanupFunctions.push(
    modules.mountCheckoutSummary(checkoutSummaryMount, {
      subtotal,
      discountAmount,
      onPlaceOrder: () => {
        appState.cartItems = [];
        appState.appliedCoupon = null;
        window.dispatchEvent(new CustomEvent("cart:updateGlobalCart"));
        navigate("/order-placed");
      },
    }),
  );

  activeCleanupFunctions.push(
    modules.mountApplyCoupon(applyCouponMount, {
      onCouponApplied: (couponPayload) => {
        appState.appliedCoupon = couponPayload;
        window.dispatchEvent(new CustomEvent("global:renderApp"));
      },
    }),
  );
}

async function renderOrderPlacedPage(pageMount, activeCleanupFunctions) {
  pageMount.innerHTML = `<section id="orderPlacedMount"></section>`;
  const orderPlacedMount = pageMount.querySelector("#orderPlacedMount");
  activeCleanupFunctions.push(mountOrderPlacedIframe(orderPlacedMount));
}

export {
  renderHomePage,
  renderPromotionsPage,
  renderProductListPage,
  renderProductDetailsPage,
  renderCheckoutPage,
  renderOrderPlacedPage,
};
