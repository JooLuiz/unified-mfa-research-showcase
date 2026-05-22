import { navigate } from "./navigate";
import {
  dispatchAddToCartEvent,
  getCartTotalValue,
  updateCartItem,
  removeCartItem,
} from "./cartActions";
import { storePLPFilters, normalizePlpFilters } from "./PLPFilterActions";
import {
  isAuthenticated,
  setAuthSession,
  consumePostLoginRedirect,
  rememberPostLoginRedirect,
} from "./authActions";
import { MOCK_API_BASE_URL } from "./constants";
import fetchJson from "./fetchJson";

async function renderHomePage(appState, pageMount, modules, activeCleanupFunctions) {
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

  const firstBannerId = appState.banners[0]?.id;
  const firstShowcaseId = appState.showcases[0]?.id;

  activeCleanupFunctions.push(
    modules.mountPromotionalBanner(bannerMount, {
      bannerId: firstBannerId,
      apiBaseUrl: MOCK_API_BASE_URL,
      onApplyPromotion: (promotionFilters) =>
        applyPromotionFilters(appState, promotionFilters),
    }),
  );
  activeCleanupFunctions.push(
    modules.mountProductShowcase(showcaseMount, {
      showcaseId: firstShowcaseId,
      apiBaseUrl: MOCK_API_BASE_URL,
      fallbackTitle: "New Products Showcase",
      mountProductCard: modules.mountProductCard,
      onProductClick: (productId) => navigate(`/product?productId=${productId}`),
      onAddToCart: dispatchAddToCartEvent,
    }),
  );
  if (appState.isFormularySubmitted) {
    activeCleanupFunctions.push(modules.mountFormularySent(faqMount));
  } else {
    const currentUser = appState.currentUser;
    activeCleanupFunctions.push(
      modules.mountFaqFormulary(faqMount, {
        userName: currentUser?.fullName || currentUser?.username || "",
        userEmail: currentUser?.email || "",
        onFormSubmitted: (payload) => {
          appState.isFormularySubmitted = true;
          appState.lastIframeMessage = `FAQ submitted by ${payload.name} (${payload.email})`;
          void persistFaqAnswerToApi(appState, payload);
          window.dispatchEvent(new CustomEvent("global:renderApp"));
        },
      }),
    );
  }

  if (appState.lastIframeMessage) {
    noticeMount.innerHTML = `<div class="notice-box">Latest iframe message: ${appState.lastIframeMessage}</div>`;
  }
}

async function renderPromotionsPage(appState, pageMount, modules, activeCleanupFunctions) {
  pageMount.innerHTML = `<section id="promotionsMount" class="page-content"></section>`;
  const promotionsMount = pageMount.querySelector("#promotionsMount");

  appState.banners.forEach((banner) => {
    const bannerContainer = document.createElement("div");
    promotionsMount.appendChild(bannerContainer);
    activeCleanupFunctions.push(
      modules.mountPromotionalBanner(bannerContainer, {
        bannerId: banner.id,
        apiBaseUrl: MOCK_API_BASE_URL,
        onApplyPromotion: (promotionFilters) =>
          applyPromotionFilters(appState, promotionFilters),
      }),
    );
  });
}

function applyPromotionFilters(appState, promotionFilters) {
  appState.plpFilters = normalizePlpFilters(promotionFilters || {});
  storePLPFilters(appState);
  navigate("/products");
}

async function renderProductListPage(appState, pageMount, modules, activeCleanupFunctions) {
  pageMount.innerHTML = `<section id="plpMount"></section>`;
  const plpMount = pageMount.querySelector("#plpMount");

  activeCleanupFunctions.push(
    modules.mountProductList(plpMount, {
      apiBaseUrl: MOCK_API_BASE_URL,
      initialFilters: appState.plpFilters,
      initialSort: appState.plpSortBy,
      onFiltersChange: (nextFilters) => {
        appState.plpFilters = normalizePlpFilters(nextFilters);
        storePLPFilters(appState);
      },
      onProductClick: (productId) => navigate(`/product?productId=${productId}`),
      onAddToCart: dispatchAddToCartEvent,
      mountProductCard: modules.mountProductCard,
    }),
  );
}

async function renderProductDetailsPage(appState, pageMount, modules, activeCleanupFunctions) {
  pageMount.innerHTML = `<section id="pdpMount"></section>`;
  const pdpMount = pageMount.querySelector("#pdpMount");
  const currentUrl = new URL(window.location.href);
  const productId =
    currentUrl.searchParams.get("productId") || appState.products[0]?.id;

  activeCleanupFunctions.push(
    modules.mountProductDetails(pdpMount, {
      productId,
      apiBaseUrl: MOCK_API_BASE_URL,
      onAddToCart: dispatchAddToCartEvent,
      mountSimilarProducts: (containerElement, similarProductsProps) =>
        modules.mountProductShowcase(containerElement, {
          title: similarProductsProps.title,
          productIds: similarProductsProps.productIds,
          apiBaseUrl: similarProductsProps.apiBaseUrl,
          mountProductCard: modules.mountProductCard,
          onProductClick: (nextProductId) =>
            navigate(`/product?productId=${nextProductId}`),
          onAddToCart: dispatchAddToCartEvent,
        }),
    }),
  );
}

async function renderCheckoutPage(appState, pageMount, modules, activeCleanupFunctions) {
  if (!isAuthenticated(appState)) {
    rememberPostLoginRedirect("/checkout");
    navigate("/login");
    return;
  }

  if (appState.cartItems.length === 0) {
    pageMount.innerHTML = `<section id="checkoutEmptyMount"></section>`;
    const checkoutEmptyMount = pageMount.querySelector("#checkoutEmptyMount");
    activeCleanupFunctions.push(
      modules.mountCheckoutEmpty(checkoutEmptyMount, {
        onGoShopping: () => navigate("/products"),
      }),
    );
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
        const orderItems = appState.cartItems.map((cartItem) => {
          const product = appState.productsById[cartItem.productId];
          return {
            productId: cartItem.productId,
            name: product?.name || cartItem.productId,
            quantity: cartItem.quantity,
            unitPrice: product?.price || 0,
          };
        });
        const totalAmount = subtotal - discountAmount;

        void persistOrder(appState, {
          items: orderItems,
          subtotal,
          discountAmount,
          totalAmount,
          appliedCoupon: appState.appliedCoupon,
          shippingAddress: appState.currentUser?.address || null,
        });

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

async function renderOrderPlacedPage(pageMount) {
  pageMount.innerHTML = `
    <section class="notice-box">
      <h2>Order Placed!</h2>
      <p>Thank you for your purchase.</p>
      <button id="continueShoppingButton" class="account-action-button" type="button">
        Continue shopping
      </button>
    </section>
  `;
  const continueShoppingButton = pageMount.querySelector("#continueShoppingButton");
  if (continueShoppingButton) {
    continueShoppingButton.addEventListener("click", () => navigate("/products"));
  }
}

async function renderLoginPage(appState, pageMount, modules, activeCleanupFunctions) {
  if (isAuthenticated(appState)) {
    const redirectPath = consumePostLoginRedirect() || "/";
    navigate(redirectPath);
    return;
  }

  pageMount.innerHTML = `<section id="loginMount" class="page-content"></section>`;
  const loginMount = pageMount.querySelector("#loginMount");

  activeCleanupFunctions.push(
    modules.mountLoginForm(loginMount, {
      apiBaseUrl: MOCK_API_BASE_URL,
      redirectAfterLogin: consumePostLoginRedirect(),
      onLoginSuccess: ({ token, user, redirectAfterLogin }) => {
        setAuthSession(appState, { token, user });
        const targetPath = redirectAfterLogin || "/";
        navigate(targetPath);
      },
      onCancel: () => navigate("/"),
    }),
  );
}

async function renderAccountPage(appState, pageMount, activeCleanupFunctions) {
  if (!isAuthenticated(appState)) {
    rememberPostLoginRedirect("/account");
    navigate("/login");
    return;
  }

  pageMount.innerHTML = `
    <section class="account-page">
      <div class="account-page-header">
        <h2>My Account</h2>
        <div class="account-page-actions">
          <button id="continueShoppingButton" class="account-action-button" type="button">Continue shopping</button>
        </div>
      </div>
      <div id="accountProfileMount"></div>
      <div id="accountAddressMount"></div>
      <div id="accountOrdersMount" class="account-orders-section"></div>
    </section>
  `;

  const continueShoppingButton = pageMount.querySelector("#continueShoppingButton");
  if (continueShoppingButton) {
    continueShoppingButton.addEventListener("click", () => navigate("/products"));
  }

  const accountProfileMount = pageMount.querySelector("#accountProfileMount");
  const accountAddressMount = pageMount.querySelector("#accountAddressMount");
  const accountOrdersMount = pageMount.querySelector("#accountOrdersMount");

  const [accountProfileModule, accountAddressModule] = await Promise.all([
    import("account/AccountProfile"),
    import("account/AccountAddress"),
  ]);

  activeCleanupFunctions.push(
    accountProfileModule.mountAccountProfile(accountProfileMount, {
      user: appState.currentUser,
      onSaveProfile: (profilePayload) =>
        persistAccountUpdate(appState, profilePayload),
    }),
  );

  activeCleanupFunctions.push(
    accountAddressModule.mountAccountAddress(accountAddressMount, {
      address: appState.currentUser?.address,
      onSaveAddress: (addressPayload) =>
        persistAccountUpdate(appState, { address: addressPayload }),
    }),
  );

  await renderMyOrdersList(appState, accountOrdersMount, activeCleanupFunctions);
}

async function renderMyOrdersList(appState, ordersContainer, activeCleanupFunctions) {
  ordersContainer.innerHTML = `
    <section class="account-card">
      <header class="account-card-header">
        <div>
          <h2 class="account-card-title">My Orders</h2>
          <p class="account-card-subtitle">Loading your orders...</p>
        </div>
      </header>
      <div id="myOrdersListMount"></div>
    </section>
  `;

  const myOrdersListMount = ordersContainer.querySelector("#myOrdersListMount");
  const subtitleElement = ordersContainer.querySelector(".account-card-subtitle");

  let userOrders = [];
  try {
    const ordersResponse = await fetchJson(`${MOCK_API_BASE_URL}/orders`, {
      headers: {
        Authorization: `Bearer ${appState.authToken}`,
      },
    });
    userOrders = Array.isArray(ordersResponse?.items) ? ordersResponse.items : [];
  } catch (error) {
    console.warn("renderMyOrdersList - error");
    console.warn(error);
    if (subtitleElement) {
      subtitleElement.textContent = "Unable to load orders.";
    }
    return;
  }

  if (userOrders.length === 0) {
    if (subtitleElement) {
      subtitleElement.textContent = "You have not placed any orders yet.";
    }
    return;
  }

  if (subtitleElement) {
    subtitleElement.textContent = `${userOrders.length} order${userOrders.length === 1 ? "" : "s"} placed.`;
  }

  const sortedOrders = [...userOrders].sort(
    (firstOrder, secondOrder) =>
      new Date(secondOrder.placedAt).getTime() -
      new Date(firstOrder.placedAt).getTime(),
  );

  const orderRowClickHandlers = [];

  sortedOrders.forEach((order) => {
    const orderRow = document.createElement("button");
    orderRow.type = "button";
    orderRow.className = "my-orders-row";
    const itemCount = Array.isArray(order.items) ? order.items.length : 0;
    const placedAtLabel = order.placedAt
      ? new Date(order.placedAt).toLocaleString()
      : "-";
    const totalAmountLabel = `$${Number(order.totalAmount || 0).toFixed(2)}`;
    orderRow.innerHTML = `
      <span class="my-orders-row-id">${order.id}</span>
      <span class="my-orders-row-date">${placedAtLabel}</span>
      <span class="my-orders-row-items">${itemCount} item${itemCount === 1 ? "" : "s"}</span>
      <span class="my-orders-row-total">${totalAmountLabel}</span>
    `;
    const handleOrderClick = () => navigate(`/order-details?orderId=${order.id}`);
    orderRow.addEventListener("click", handleOrderClick);
    orderRowClickHandlers.push({ orderRow, handleOrderClick });
    myOrdersListMount.appendChild(orderRow);
  });

  activeCleanupFunctions.push(() => {
    orderRowClickHandlers.forEach(({ orderRow, handleOrderClick }) => {
      orderRow.removeEventListener("click", handleOrderClick);
    });
  });
}

async function renderOrderDetailsPage(appState, pageMount, modules, activeCleanupFunctions) {
  if (!isAuthenticated(appState)) {
    rememberPostLoginRedirect(`/order-details${window.location.search}`);
    navigate("/login");
    return;
  }

  pageMount.innerHTML = `
    <section class="order-details-page">
      <div class="order-details-page-header">
        <h2>Order Details</h2>
        <button id="backToAccountButton" class="account-action-button" type="button">Back to account</button>
      </div>
      <div id="orderDetailsMount"></div>
    </section>
  `;

  const backToAccountButton = pageMount.querySelector("#backToAccountButton");
  if (backToAccountButton) {
    backToAccountButton.addEventListener("click", () => navigate("/account"));
  }

  const orderDetailsMount = pageMount.querySelector("#orderDetailsMount");
  const currentUrl = new URL(window.location.href);
  const requestedOrderId = currentUrl.searchParams.get("orderId");

  if (!requestedOrderId) {
    orderDetailsMount.innerHTML = `<div class="notice-box">No order id was provided.</div>`;
    return;
  }

  activeCleanupFunctions.push(
    modules.mountOrderDetails(orderDetailsMount, {
      orderId: requestedOrderId,
      apiBaseUrl: MOCK_API_BASE_URL,
      authToken: appState.authToken,
    }),
  );
}

async function persistAccountUpdate(appState, updatePayload) {
  if (!appState.authToken) {
    return;
  }
  try {
    const updatedUser = await fetchJson(`${MOCK_API_BASE_URL}/users/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${appState.authToken}`,
      },
      body: JSON.stringify(updatePayload),
    });
    setAuthSession(appState, {
      token: appState.authToken,
      user: updatedUser,
    });
  } catch (error) {
    console.warn("persistAccountUpdate - error");
    console.warn(error);
  }
}

async function persistFaqAnswerToApi(appState, faqPayload) {
  try {
    await fetchJson(`${MOCK_API_BASE_URL}/faq`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(appState.authToken
          ? { Authorization: `Bearer ${appState.authToken}` }
          : {}),
      },
      body: JSON.stringify(faqPayload),
    });
  } catch (error) {
    console.warn("persistFaqAnswerToApi - error");
    console.warn(error);
  }
}

async function persistOrder(appState, orderPayload) {
  if (!appState.authToken) {
    return;
  }
  try {
    await fetchJson(`${MOCK_API_BASE_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${appState.authToken}`,
      },
      body: JSON.stringify(orderPayload),
    });
  } catch (error) {
    console.warn("persistOrder - error");
    console.warn(error);
  }
}

export {
  renderHomePage,
  renderPromotionsPage,
  renderProductListPage,
  renderProductDetailsPage,
  renderCheckoutPage,
  renderOrderPlacedPage,
  renderLoginPage,
  renderAccountPage,
  renderOrderDetailsPage,
};
