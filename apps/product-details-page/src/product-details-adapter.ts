/**
 * Mount adapter for the product details MFE.
 * Role: Owns the host-facing mountProductDetails function and its Angular application bootstrap;
 *   this is the module exposed via Module Federation. Publishes cart.item-add-requested on add-to-cart.
 * Not in this file: Component behavior (src/product-details.component.ts) or product loading (src/product-loader.ts).
 * Key dependencies: Angular platform-browser createApplication API; @shared/server-events createPageEvents; @shared/catalog-events.
 * See also: src/product-details.component.ts.
 */

import "@angular/compiler";
import { ApplicationRef, ComponentRef } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import { createPageEvents } from "@shared/server-events";
import { createCatalogEvents } from "@shared/catalog-events";
import { ProductDetailsComponent } from "./product-details.component";
import type { ProductDetailsProps } from "./product-details.types";

const { publishCartItemAddRequested } = createCatalogEvents(createPageEvents());

/**
 * Mounts the product details page into a host container.
 *
 * @param containerElement - Host-owned mount element.
 * @param props - Product details props (apiBaseUrl, mountSimilarProducts).
 * @returns Cleanup that destroys the Angular application.
 */
export function mountProductDetails(
  containerElement: HTMLElement,
  props: ProductDetailsProps,
): () => void {
  let applicationRef: ApplicationRef | null = null;
  let componentRef: ComponentRef<ProductDetailsComponent> | null = null;
  let isUnmounted = false;

  const bootstrapPromise = createApplication().then((nextApplicationRef) => {
    if (isUnmounted) {
      nextApplicationRef.destroy();
      return;
    }

    applicationRef = nextApplicationRef;
    componentRef = applicationRef.bootstrap(ProductDetailsComponent, containerElement);
    componentRef.setInput("apiBaseUrl", props.apiBaseUrl ?? null);
    componentRef.setInput("mountSimilarProducts", props.mountSimilarProducts);

    componentRef.instance.addToCart.subscribe((payload) => {
      publishCartItemAddRequested(payload);
    });
  });

  return () => {
    isUnmounted = true;
    void bootstrapPromise.then(() => {
      componentRef?.destroy();
      applicationRef?.destroy();
      containerElement.innerHTML = "";
    });
  };
}
