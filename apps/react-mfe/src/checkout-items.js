import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function CheckoutItemsView({ cartItems, productsById, onQuantityChange }) {
  return (
    <section className="checkout-items-shell">
      <h2>Checkout Items in Cart Component</h2>
      {cartItems.length === 0 && <p>Your cart is empty.</p>}
      {cartItems.map((cartItem) => {
        const product = productsById[cartItem.productId];
        if (!product) {
          return null;
        }

        return (
          <article key={cartItem.productId} className="checkout-item">
            <span>{product.name}</span>
            <span>${(product.price * cartItem.quantity).toFixed(2)}</span>
            <input
              type="number"
              min="1"
              value={cartItem.quantity}
              onChange={(event) => {
                const nextQuantity = Number(event.target.value);
                if (Number.isFinite(nextQuantity) && nextQuantity > 0) {
                  onQuantityChange(cartItem.productId, nextQuantity);
                }
              }}
            />
          </article>
        );
      })}
    </section>
  );
}

export function mountCheckoutItems(containerElement, props) {
  const root = createRoot(containerElement);
  root.render(
    <CheckoutItemsView
      cartItems={props.cartItems}
      productsById={props.productsById}
      onQuantityChange={props.onQuantityChange}
    />,
  );

  return () => {
    root.unmount();
  };
}
