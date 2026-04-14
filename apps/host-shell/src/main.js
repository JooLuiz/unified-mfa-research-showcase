import "./styles.css";

const MOCK_API_BASE_URL = "http://localhost:4000/api";
const FAQ_IFRAME_URL = "http://localhost:4203/faq-formulary.html";
const ORDER_PLACED_IFRAME_URL = "http://localhost:4202/order-placed.html";
const FILTER_STORAGE_KEY = "host-shell:plp-filters";

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
  appliedCoupon: null,
  lastIframeMessage: "",
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
    footerModule,
    checkoutSummaryModule,
  ]) => {
    headerModule.registerHeaderElement();
    productShowcaseModule.registerProductShowcaseElement();
    footerModule.registerFooterElement();

    return {
      mountPromotionalBanner: bannerModule.mountPromotionalBanner,
      mountProductList: productListModule.mountProductList,
      mountCheckoutItems: checkoutItemsModule.mountCheckoutItems,
      mountProductCard: productCardModule.mountProductCard,
      mountProductDetails: productDetailsModule.mountProductDetails,
      mountProductShowcase: productShowcaseModule.mountProductShowcase,
      mountApplyCoupon: applyCouponModule.mountApplyCoupon,
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

function normalizeProductsByFilters(products) {
  const minPrice = Number(appState.plpFilters.minPrice);
  const maxPrice = Number(appState.plpFilters.maxPrice);

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
  };
  headerElement.addEventListener("host:navigate", (event) => {
    navigate(event.detail.path);
  });
  layoutMounts.headerMount.appendChild(headerElement);

  const footerElement = document.createElement("vue-footer-mfe");
  footerElement.setAttribute("message", "Copyright Message");
  layoutMounts.footerMount.appendChild(footerElement);
}

function mountFaqIframe(containerElement) {
  containerElement.innerHTML = `
    <section class="frame-container">
      <iframe title="FAQ Formulary" src="${FAQ_IFRAME_URL}"></iframe>
    </section>
  `;
  return () => {
    containerElement.innerHTML = "";
  };
}

function mountOrderPlacedIframe(containerElement) {
  containerElement.innerHTML = `
    <section class="frame-container">
      <iframe title="Order Placed" src="${ORDER_PLACED_IFRAME_URL}"></iframe>
    </section>
  `;
  return () => {
    containerElement.innerHTML = "";
  };
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
  const showcaseConfiguration = appState.showcases[0];
  const showcaseProducts = (showcaseConfiguration?.productIds || [])
    .map((productId) => appState.productsById[productId])
    .filter(Boolean);

  activeCleanupFunctions.push(
    modules.mountPromotionalBanner(bannerMount, {
      banner: firstBanner,
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
  activeCleanupFunctions.push(mountFaqIframe(faqMount));

  if (appState.lastIframeMessage) {
    noticeMount.innerHTML = `<div class="notice-box">Latest iframe message: ${appState.lastIframeMessage}</div>`;
  }
}

async function renderProductListPage(pageMount, modules) {
  pageMount.innerHTML = `<section id="plpMount"></section>`;
  const plpMount = pageMount.querySelector("#plpMount");
  const normalizedProducts = normalizeProductsByFilters([...appState.products]);
  const visibleProducts = normalizedProducts.slice(0, appState.plpVisibleCount);

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
      onFiltersChange: (nextFilters) => {
        appState.plpFilters = nextFilters;
        appState.plpVisibleCount = 8;
        storePlpFilters();
        renderApp();
      },
      onLoadMore: () => {
        appState.plpVisibleCount += 4;
        renderApp();
      },
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

window.addEventListener("message", (event) => {
  const messageData = event.data;
  if (!messageData || typeof messageData !== "object") {
    return;
  }

  if (messageData.type === "faq:question-submitted") {
    appState.lastIframeMessage = `FAQ question submitted: ${messageData.payload.question}`;
  }

  if (messageData.type === "order-placed:completed") {
    appState.lastIframeMessage = "Order placed flow completed via iframe.";
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
