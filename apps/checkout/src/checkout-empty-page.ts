import "./styles.css";

const CHECKOUT_EMPTY_FRAME_ID = "checkout-empty";

function notifyHostHeight(): void {
  const contentHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  );
  window.parent.postMessage(
    {
      type: "iframe:resize",
      payload: {
        frameId: CHECKOUT_EMPTY_FRAME_ID,
        height: contentHeight,
      },
    },
    "*",
  );
}

function handleGoBackToShopping(): void {
  window.parent.postMessage({ type: "checkout:go-shopping" }, "*");
}

function renderCheckoutEmptyPage(): void {
  const rootElement = document.querySelector("checkout-empty-root");
  if (!rootElement) {
    return;
  }

  rootElement.innerHTML = `
    <section class="checkout-empty-shell">
      <h2>There are no items in your cart</h2>
      <p>Please add some items to your cart to proceed</p>
      <button type="button" class="checkout-empty-go-back-button">
        Go Back to Shopping
      </button>
    </section>
  `;

  const goBackButton = rootElement.querySelector<HTMLButtonElement>(
    ".checkout-empty-go-back-button",
  );
  if (goBackButton) {
    goBackButton.addEventListener("click", handleGoBackToShopping);
  }

  notifyHostHeight();
  window.addEventListener("load", notifyHostHeight);
  window.addEventListener("resize", notifyHostHeight);
}

renderCheckoutEmptyPage();
