import "./styles.css";

const MOCK_API_BASE_URL = "http://localhost:4000/api";
const FAQ_IFRAME_URL = "http://localhost:4203/faq-formulary.html";
const CHECKOUT_EMPTY_IFRAME_URL = "http://localhost:4202/checkout-empty.html";
const ORDER_PLACED_IFRAME_URL = "http://localhost:4202/order-placed.html";
const FILTER_STORAGE_KEY = "host-shell:plp-filters";
const FAQ_FRAME_ID = "faq-formulary";
const CHECKOUT_EMPTY_FRAME_ID = "checkout-empty";
const ORDER_PLACED_FRAME_ID = "order-placed";

const appState = {
  products: [],
  productsById: {},
  showcases: [],
  banners: [],
  cartItems: [],
  plpFilters: {
    minPrice: "",
    maxPrice: "",
  },
  plpSortBy: "",
  plpVisibleCount: 8,
  plpItemsPerRow: 4,
  appliedCoupon: null,
  lastIframeMessage: "",
  isFormularySubmitted: false,
};

let currentRenderId = 0;
let activeCleanupFunctions = [];

const remoteModulesPromise = Promise.all([
  import("react_mfe/HeaderElement"),
  import("react_mfe/PromotionalBanner"),
  import("react_mfe/ProductList"),
  import("react_mfe/CheckoutItems"),
  import("angular_mfe/ProductCard"),
  import("angular_mfe/ProductDetails"),
  import("angular_mfe/ProductShowcaseElement"),
  import("angular_mfe/ApplyCoupon"),
  import("angular_mfe/FormularySentElement"),
  import("vue_mfe/FooterElement"),
  import("vue_mfe/CheckoutSummary"),
]).then(
  ([
    headerModule,
    bannerModule,
    productListModule,
    checkoutItemsModule,
    productCardModule,
    productDetailsModule,
    productShowcaseModule,
    applyCouponModule,
    formularySentModule,
    footerModule,
    checkoutSummaryModule,
  ]) => {
    headerModule.registerHeaderElement();
    productShowcaseModule.registerProductShowcaseElement();
    formularySentModule.registerFormularySentElement();
    footerModule.registerFooterElement();

    return {
      mountPromotionalBanner: bannerModule.mountPromotionalBanner,
      mountProductList: productListModule.mountProductList,
      mountCheckoutItems: checkoutItemsModule.mountCheckoutItems,
      mountProductCard: productCardModule.mountProductCard,
      mountProductDetails: productDetailsModule.mountProductDetails,
      mountProductShowcase: productShowcaseModule.mountProductShowcase,
      mountApplyCoupon: applyCouponModule.mountApplyCoupon,
      mountFormularySent: formularySentModule.mountFormularySent,
      mountCheckoutSummary: checkoutSummaryModule.mountCheckoutSummary,
    };
  },
);

function setGlobalCartVariable() {
  window.__APP_SHELL_CART__ = appState.cartItems;
}

function readStoredPlpFilters() {
  try {
    const storedValue = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!storedValue) {
      return;
    }
    const parsedValue = JSON.parse(storedValue);
    appState.plpFilters = {
      minPrice: parsedValue.minPrice || "",
      maxPrice: parsedValue.maxPrice || "",
    };
  } catch (error) {
    console.warn("Unable to parse stored PLP filters", error);
  }
}

function storePlpFilters() {
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(appState.plpFilters));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function loadMockData() {
  const [productsResponse, showcasesResponse, bannersResponse] = await Promise.all([
    fetchJson(`${MOCK_API_BASE_URL}/products`),
    fetchJson(`${MOCK_API_BASE_URL}/showcases`),
    fetchJson(`${MOCK_API_BASE_URL}/banners`),
  ]);

  appState.products = productsResponse.items;
  appState.productsById = appState.products.reduce((accumulator, product) => {
    accumulator[product.id] = product;
    return accumulator;
  }, {});
  appState.showcases = showcasesResponse;
  appState.banners = bannersResponse;
}

function clearCurrentPage() {
  activeCleanupFunctions.forEach((cleanup) => {
    if (typeof cleanup === "function") {
      cleanup();
    }
  });
  activeCleanupFunctions = [];
}

function getCartTotalValue() {
  return appState.cartItems.reduce((totalValue, cartItem) => {
    const product = appState.productsById[cartItem.productId];
    if (!product) {
      return totalValue;
    }
    return totalValue + product.price * cartItem.quantity;
  }, 0);
}

function getCartItemCount() {
  return appState.cartItems.reduce((currentCount, cartItem) => currentCount + cartItem.quantity, 0);
}

function dispatchAddToCartEvent(addToCartPayload) {
  window.dispatchEvent(
    new CustomEvent("cart:add-item", {
      detail: addToCartPayload,
    }),
  );
}

function updateCartItem(productId, quantity) {
  const existingItem = appState.cartItems.find((cartItem) => cartItem.productId === productId);
  if (existingItem) {
    existingItem.quantity = quantity;
  } else {
    appState.cartItems.push({ productId, quantity });
  }
  setGlobalCartVariable();
}

function withLayout() {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `
    <div class="app-shell">
      <div id="headerMount"></div>
      <main id="pageMount" class="page-content"></main>
      <div id="footerMount"></div>
    </div>
  `;

  return {
    headerMount: appRoot.querySelector("#headerMount"),
    pageMount: appRoot.querySelector("#pageMount"),
    footerMount: appRoot.querySelector("#footerMount"),
  };
}

function navigate(path) {
  history.pushState({}, "", path);
  renderApp();
}

function calculatePlpItemsPerRow() {
  const minimumCardWidth = 170;
  const cardGap = 12;
  const filtersColumnWidth = 220;
  const pagePaddingAllowance = 96;
  const estimatedGridWidth = Math.max(
    window.innerWidth - filtersColumnWidth - pagePaddingAllowance,
    minimumCardWidth,
  );

  const estimatedCardsPerRow = Math.floor(
    (estimatedGridWidth + cardGap) / (minimumCardWidth + cardGap),
  );
  return Math.max(estimatedCardsPerRow, 1);
}

function getPlpInitialVisibleCount(itemsPerRow) {
  return Math.max(itemsPerRow * 2, 2);
}

function normalizeProductsByFilters(products) {
  const hasMinimumFilter = String(appState.plpFilters.minPrice).trim() !== "";
  const hasMaximumFilter = String(appState.plpFilters.maxPrice).trim() !== "";
  const minPrice = hasMinimumFilter ? Number(appState.plpFilters.minPrice) : null;
  const maxPrice = hasMaximumFilter ? Number(appState.plpFilters.maxPrice) : null;

  let filteredProducts = products.filter((product) => {
    const isAboveMinimum = Number.isFinite(minPrice) ? product.price >= minPrice : true;
    const isBelowMaximum = Number.isFinite(maxPrice) ? product.price <= maxPrice : true;
    return isAboveMinimum && isBelowMaximum;
  });

  if (appState.plpSortBy === "price-asc") {
    filteredProducts = filteredProducts.sort((firstProduct, secondProduct) => firstProduct.price - secondProduct.price);
  }

  if (appState.plpSortBy === "price-desc") {
    filteredProducts = filteredProducts.sort((firstProduct, secondProduct) => secondProduct.price - firstProduct.price);
  }

  if (appState.plpSortBy === "name-asc") {
    filteredProducts = filteredProducts.sort((firstProduct, secondProduct) => firstProduct.name.localeCompare(secondProduct.name));
  }

  return filteredProducts;
}

function mountHeaderAndFooter(layoutMounts) {
  const headerElement = document.createElement("react-header-mfe");
  headerElement.state = {
    totalPrice: getCartTotalValue(),
    itemCount: getCartItemCount(),
  };
  headerElement.addEventListener("host:navigate", (event) => {
    navigate(event.detail.path);
  });
  layoutMounts.headerMount.appendChild(headerElement);

  const footerElement = document.createElement("vue-footer-mfe");
  footerElement.setAttribute("message", "© 2026 Unified MFE Research. All rights reserved.");
  layoutMounts.footerMount.appendChild(footerElement);
}

function mountFaqIframe(containerElement) {
  return mountResizableIframe(containerElement, {
    title: "FAQ Formulary",
    src: FAQ_IFRAME_URL,
    frameId: FAQ_FRAME_ID,
  });
}

function mountCheckoutEmptyIframe(containerElement) {
  return mountResizableIframe(containerElement, {
    title: "Checkout Empty",
    src: CHECKOUT_EMPTY_IFRAME_URL,
    frameId: CHECKOUT_EMPTY_FRAME_ID,
  });
}

function mountResizableIframe(containerElement, iframeConfig) {
  containerElement.innerHTML = `
    <section class="frame-container">
      <iframe
        data-frame-id="${iframeConfig.frameId}"
        title="${iframeConfig.title}"
        src="${iframeConfig.src}"
        scrolling="no"
      ></iframe>
    </section>
  `;

  const iframeElement = containerElement.querySelector("iframe");
  if (iframeElement) {
    iframeElement.style.height = "0px";
  }

  return () => {
    containerElement.innerHTML = "";
  };
}

function mountOrderPlacedIframe(containerElement) {
  return mountResizableIframe(containerElement, {
    title: "Order Placed",
    src: ORDER_PLACED_IFRAME_URL,
    frameId: ORDER_PLACED_FRAME_ID,
  });
}

async function renderHomePage(pageMount, modules) {
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
  const firstBannerProduct = appState.productsById[firstBanner?.associatedProductId];
  const showcaseConfiguration = appState.showcases[0];
  const showcaseProducts = (showcaseConfiguration?.productIds || [])
    .map((productId) => appState.productsById[productId])
    .filter(Boolean);

  activeCleanupFunctions.push(
    modules.mountPromotionalBanner(bannerMount, {
      banner: {
        ...firstBanner,
        productTitle: firstBannerProduct?.name || "",
      },
      onNavigate: navigate,
    }),
  );
  activeCleanupFunctions.push(
    modules.mountProductShowcase(showcaseMount, {
      title: showcaseConfiguration?.showcaseTitle || "New Products Showcase",
      products: showcaseProducts,
      mountProductCard: modules.mountProductCard,
      onProductClick: (productId) => navigate(`/product?productId=${productId}`),
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

async function renderPromotionsPage(pageMount, modules) {
  pageMount.innerHTML = `<section id="promotionsMount" class="page-content"></section>`;
  const promotionsMount = pageMount.querySelector("#promotionsMount");

  appState.banners.forEach((banner) => {
    const bannerContainer = document.createElement("div");
    promotionsMount.appendChild(bannerContainer);
    const relatedProduct = appState.productsById[banner.associatedProductId];
    activeCleanupFunctions.push(
      modules.mountPromotionalBanner(bannerContainer, {
        banner: {
          ...banner,
          productTitle: relatedProduct?.name || "",
        },
        onNavigate: navigate,
      }),
    );
  });
}

async function renderProductListPage(pageMount, modules) {
  pageMount.innerHTML = `<section id="plpMount"></section>`;
  const plpMount = pageMount.querySelector("#plpMount");
  appState.plpItemsPerRow = calculatePlpItemsPerRow();
  const minimumVisibleCount = getPlpInitialVisibleCount(appState.plpItemsPerRow);
  appState.plpVisibleCount = Math.max(appState.plpVisibleCount, minimumVisibleCount);

  const normalizedProducts = normalizeProductsByFilters([...appState.products]);
  const visibleCount = Math.min(appState.plpVisibleCount, normalizedProducts.length);
  const visibleProducts = normalizedProducts.slice(0, visibleCount);
  const canLoadMore = visibleCount < normalizedProducts.length;

  activeCleanupFunctions.push(
    modules.mountProductList(plpMount, {
      products: visibleProducts,
      totalProducts: normalizedProducts.length,
      activeSort: appState.plpSortBy,
      activeFilters: appState.plpFilters,
      onSortChange: (nextSortBy) => {
        appState.plpSortBy = nextSortBy;
        renderApp();
      },
      onApplyFilters: (nextFilters) => {
        appState.plpFilters = nextFilters;
        appState.plpVisibleCount = getPlpInitialVisibleCount(
          calculatePlpItemsPerRow(),
        );
        storePlpFilters();
        renderApp();
      },
      onClearFilters: (nextFilters) => {
        appState.plpFilters = nextFilters;
        appState.plpVisibleCount = getPlpInitialVisibleCount(
          calculatePlpItemsPerRow(),
        );
        storePlpFilters();
        renderApp();
      },
      onLoadMore: () => {
        appState.plpVisibleCount += appState.plpItemsPerRow;
        renderApp();
      },
      canLoadMore,
      onProductClick: (productId) => navigate(`/product?productId=${productId}`),
      onAddToCart: dispatchAddToCartEvent,
      mountProductCard: modules.mountProductCard,
    }),
  );
}

async function renderProductDetailsPage(pageMount, modules) {
  pageMount.innerHTML = `<section id="pdpMount"></section>`;
  const pdpMount = pageMount.querySelector("#pdpMount");
  const currentUrl = new URL(window.location.href);
  const productId = currentUrl.searchParams.get("productId") || appState.products[0]?.id;
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
          onProductClick: (nextProductId) => navigate(`/product?productId=${nextProductId}`),
          onAddToCart: dispatchAddToCartEvent,
        }),
    }),
  );
}

async function renderCheckoutPage(pageMount, modules) {
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

  const subtotal = getCartTotalValue();
  const discountPercentage = appState.appliedCoupon?.discountPercentage || 0;
  const discountAmount = subtotal * (discountPercentage / 100);

  activeCleanupFunctions.push(
    modules.mountCheckoutItems(checkoutItemsMount, {
      cartItems: appState.cartItems,
      productsById: appState.productsById,
      onQuantityChange: (productId, quantity) => {
        updateCartItem(productId, quantity);
        renderApp();
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
        setGlobalCartVariable();
        navigate("/order-placed");
      },
    }),
  );

  activeCleanupFunctions.push(
    modules.mountApplyCoupon(applyCouponMount, {
      onCouponApplied: (couponPayload) => {
        appState.appliedCoupon = couponPayload;
        renderApp();
      },
    }),
  );
}

async function renderOrderPlacedPage(pageMount) {
  pageMount.innerHTML = `<section id="orderPlacedMount"></section>`;
  const orderPlacedMount = pageMount.querySelector("#orderPlacedMount");
  activeCleanupFunctions.push(mountOrderPlacedIframe(orderPlacedMount));
}

async function renderApp() {
  const renderId = ++currentRenderId;
  clearCurrentPage();

  let modules;
  try {
    modules = await remoteModulesPromise;
  } catch (error) {
    const appRoot = document.getElementById("appRoot");
    appRoot.innerHTML = `<pre>Unable to load remotes: ${error.message}</pre>`;
    return;
  }

  if (renderId !== currentRenderId) {
    return;
  }

  const layoutMounts = withLayout();
  mountHeaderAndFooter(layoutMounts);

  const pathName = window.location.pathname;
  if (pathName === "/") {
    await renderHomePage(layoutMounts.pageMount, modules);
    return;
  }

  if (pathName === "/products") {
    await renderProductListPage(layoutMounts.pageMount, modules);
    return;
  }

  if (pathName === "/promotions") {
    await renderPromotionsPage(layoutMounts.pageMount, modules);
    return;
  }

  if (pathName === "/product") {
    await renderProductDetailsPage(layoutMounts.pageMount, modules);
    return;
  }

  if (pathName === "/checkout") {
    await renderCheckoutPage(layoutMounts.pageMount, modules);
    return;
  }

  if (pathName === "/order-placed") {
    await renderOrderPlacedPage(layoutMounts.pageMount);
    return;
  }

  layoutMounts.pageMount.innerHTML = `
    <section class="notice-box">
      <h2>Page not found</h2>
      <button id="goHomeButton">Go Home</button>
    </section>
  `;
  layoutMounts.pageMount.querySelector("#goHomeButton").addEventListener("click", () => navigate("/"));
}

window.addEventListener("popstate", () => {
  renderApp();
});

window.addEventListener("resize", () => {
  if (window.location.pathname !== "/products") {
    return;
  }

  const recalculatedItemsPerRow = calculatePlpItemsPerRow();
  if (recalculatedItemsPerRow === appState.plpItemsPerRow) {
    return;
  }

  appState.plpItemsPerRow = recalculatedItemsPerRow;
  appState.plpVisibleCount = Math.max(
    appState.plpVisibleCount,
    getPlpInitialVisibleCount(recalculatedItemsPerRow),
  );
  renderApp();
});

window.addEventListener("message", (event) => {
  const messageData = event.data;
  if (!messageData || typeof messageData !== "object") {
    return;
  }

  if (messageData.type === "iframe:resize") {
    const frameId = messageData.payload?.frameId;
    const rawHeight = Number(messageData.payload?.height);
    if (typeof frameId === "string" && Number.isFinite(rawHeight)) {
      const frameElement = document.querySelector(
        `iframe[data-frame-id="${frameId}"]`,
      );
      if (frameElement) {
        frameElement.style.height = `${Math.max(rawHeight, 80)}px`;
      }
    }
    return;
  }

  if (messageData.type === "faq:form-submitted") {
    appState.isFormularySubmitted = true;
    appState.lastIframeMessage = `FAQ submitted by ${messageData.payload.name} (${messageData.payload.email})`;
    renderApp();
    return;
  }

  if (messageData.type === "order-placed:completed") {
    appState.lastIframeMessage = "Order placed flow completed via iframe.";
    return;
  }

  if (messageData.type === "checkout:go-shopping") {
    navigate("/products");
  }
});

window.addEventListener("cart:add-item", (event) => {
  const payload = event.detail;
  if (!payload || !payload.productId) {
    return;
  }

  const incomingQuantity = Number(payload.quantity);
  const quantityValue = Number.isFinite(incomingQuantity) && incomingQuantity > 0 ? incomingQuantity : 1;
  const existingItem = appState.cartItems.find((cartItem) => cartItem.productId === payload.productId);
  if (existingItem) {
    existingItem.quantity += quantityValue;
  } else {
    appState.cartItems.push({
      productId: payload.productId,
      quantity: quantityValue,
    });
  }
  setGlobalCartVariable();
  renderApp();
});

async function bootstrap() {
  readStoredPlpFilters();
  await loadMockData();
  setGlobalCartVariable();
  await renderApp();
}

bootstrap().catch((error) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${error.message}</pre>`;
});
