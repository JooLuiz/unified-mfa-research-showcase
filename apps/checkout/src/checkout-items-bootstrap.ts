/**
 * Boots the checkout line list on this branch and publishes cart intents.
 * Role: Owns Angular bootstrap, the cart-change subscription, and teardown.
 * Not in this file: Line rendering and the available-count rule (src/checkout-items.ts).
 * Key dependencies: event-mesh/mesh; @shared/catalog-events; @angular/platform-browser.
 * See also: src/checkout-items.ts; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import { ApplicationRef, ComponentRef } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import mesh from "event-mesh/mesh";
import { createCatalogEvents } from "@shared/catalog-events";
import {
  CheckoutItemsComponent,
  normalizeCartItems,
  type CartItem,
  type CheckoutItemsProps,
} from "./checkout-items";

const { publishCartItemUpdateRequested, publishCartItemRemoveRequested } =
  createCatalogEvents({ mesh });

/**
 * Mounts the checkout line list and publishes update or remove intents.
 *
 * @param containerElement - Element that becomes the component host.
 * @param props - Current cart snapshot, product lookup, and cart-change subscription.
 * @returns Unmount function.
 * @sideEffects Subscribes to cart changes until unmount. Publishes cart intents on quantity or remove.
 */
export function mountCheckoutItems(
  containerElement: HTMLElement,
  props: CheckoutItemsProps,
): () => void {
  let applicationRef: ApplicationRef | null = null;
  let componentRef: ComponentRef<CheckoutItemsComponent> | null = null;
  let isUnmounted = false;

  const syncCartItems = (cartItems: CartItem[]): void => {
    if (!componentRef) {
      return;
    }
    componentRef.setInput("cartItems", normalizeCartItems(cartItems));
  };

  const unsubscribeFromCartChanges = props.subscribeToCartChanges(syncCartItems);

  const bootstrapPromise = createApplication().then((nextApplicationRef) => {
    if (isUnmounted) {
      nextApplicationRef.destroy();
      return;
    }

    applicationRef = nextApplicationRef;
    componentRef = applicationRef.bootstrap(CheckoutItemsComponent, containerElement);
    syncCartItems(props.cartItems);
    componentRef.setInput("productsById", props.productsById ?? {});

    componentRef.instance.quantityChange.subscribe((payload) => {
      publishCartItemUpdateRequested({
        productId: payload.productId,
        quantity: payload.quantity,
      });
    });
    componentRef.instance.removeItem.subscribe((productId) => {
      publishCartItemRemoveRequested(productId);
    });
  });

  return () => {
    isUnmounted = true;
    unsubscribeFromCartChanges();
    void bootstrapPromise.then(() => {
      componentRef?.destroy();
      applicationRef?.destroy();
      containerElement.innerHTML = "";
    });
  };
}
