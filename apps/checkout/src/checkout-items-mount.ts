/**
 * Boots the checkout items custom element and exposes its live availability handle.
 * Role: Owns Angular bootstrap, the global cart listener, and teardown for the checkout line list.
 * Not in this file: Line rendering and the available-count rule (src/checkout-items.ts).
 * Key dependencies: @angular/platform-browser.
 * See also: src/checkout-items.ts; apps/ecommerce-shell/src/pages/checkoutPage.js.
 */

import { ApplicationRef, ComponentRef } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import {
  CheckoutItemsComponent,
  readCartItemsFromGlobalState,
  type CheckoutItemsProps,
} from "./checkout-items";

export type CheckoutItemsHandle = {
  unmount: () => void;
  applyAvailable: (productId: string, available: number) => void;
};

/**
 * Mounts the checkout line list into a host element.
 *
 * @param containerElement - Element that becomes the component host.
 * @param props - Product lookup, API base, and quantity or remove callbacks.
 * @returns Handle that tears the mount down and applies a reservation's available count.
 * @sideEffects Listens for cart:updateGlobalCart until unmount.
 */
export function mountCheckoutItems(
  containerElement: HTMLElement,
  props: CheckoutItemsProps,
): CheckoutItemsHandle {
  let applicationRef: ApplicationRef | null = null;
  let componentRef: ComponentRef<CheckoutItemsComponent> | null = null;
  let isUnmounted = false;

  const syncCartItemsFromGlobalState = (): void => {
    if (!componentRef) {
      return;
    }
    componentRef.setInput("cartItems", readCartItemsFromGlobalState());
  };

  const handleGlobalCartUpdated = (): void => {
    syncCartItemsFromGlobalState();
  };

  window.addEventListener("cart:updateGlobalCart", handleGlobalCartUpdated);

  const bootstrapPromise = createApplication().then((nextApplicationRef) => {
    if (isUnmounted) {
      nextApplicationRef.destroy();
      return;
    }

    applicationRef = nextApplicationRef;
    componentRef = applicationRef.bootstrap(CheckoutItemsComponent, containerElement);
    syncCartItemsFromGlobalState();
    componentRef.setInput("productsById", props.productsById ?? {});
    componentRef.setInput("apiBaseUrl", props.apiBaseUrl ?? null);

    componentRef.instance.quantityChange.subscribe((payload) => {
      props.onQuantityChange?.(payload.productId, payload.quantity);
    });
    componentRef.instance.removeItem.subscribe((productId) => {
      props.onRemoveItem?.(productId);
    });
  });

  return {
    /**
     * Applies the available count from a reservation that this checkout just completed.
     *
     * @param productId - Catalog product id.
     * @param available - Units still free after that reservation.
     * @returns Nothing.
     */
    applyAvailable(productId: string, available: number): void {
      componentRef?.instance.applyAvailable(productId, available);
    },
    unmount(): void {
      isUnmounted = true;
      window.removeEventListener("cart:updateGlobalCart", handleGlobalCartUpdated);
      void bootstrapPromise.then(() => {
        componentRef?.destroy();
        applicationRef?.destroy();
        containerElement.innerHTML = "";
      });
    },
  };
}
