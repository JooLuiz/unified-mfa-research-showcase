/**
 * Custom element adapter for the product showcase MFE.
 * Role: Owns angular-product-showcase registration and the host-facing mountProductShowcase function;
 *   this is the module exposed via Module Federation.
 * Not in this file: Component behavior (src/product-showcase-element.ts), loading, or card mounting.
 * Key dependencies: Angular elements API.
 * See also: src/product-showcase-element.ts.
 */

import "@angular/compiler";
import { ApplicationRef, Injector } from "@angular/core";
import { createCustomElement } from "@angular/elements";
import { createApplication } from "@angular/platform-browser";
import { ProductShowcaseElementComponent } from "./product-showcase-element";
import type {
  ProductShowcaseConfiguration,
  ProductShowcaseElementInstance,
} from "./showcase-types";

const customElementName = "angular-product-showcase";

let showcaseElementsApplicationPromise: Promise<ApplicationRef> | null = null;
let showcaseRegistrationPromise: Promise<void> | null = null;

const getShowcaseElementsApplication = (): Promise<ApplicationRef> => {
  if (!showcaseElementsApplicationPromise) {
    showcaseElementsApplicationPromise = createApplication();
  }
  return showcaseElementsApplicationPromise;
};

const ensureProductShowcaseElementRegistered = (): Promise<void> => {
  if (customElements.get(customElementName)) {
    return Promise.resolve();
  }

  if (!showcaseRegistrationPromise) {
    showcaseRegistrationPromise = getShowcaseElementsApplication().then((applicationRef) => {
      if (customElements.get(customElementName)) {
        return;
      }

      const customElementConstructor = createCustomElement(ProductShowcaseElementComponent, {
        injector: applicationRef.injector as Injector,
      });
      customElements.define(customElementName, customElementConstructor);
    });
  }

  return showcaseRegistrationPromise;
};

/**
 * Registers the angular-product-showcase custom element.
 *
 * @sideEffects Defines the custom element on window.customElements.
 */
export function registerProductShowcaseElement(): void {
  void ensureProductShowcaseElementRegistered();
}

/**
 * Mounts a product showcase into a host container.
 *
 * @param containerElement - Host-owned mount element.
 * @param props - Showcase configuration (products, ids, or showcaseId plus callbacks).
 * @returns Cleanup that removes the showcase element.
 */
export function mountProductShowcase(
  containerElement: HTMLElement,
  props: ProductShowcaseConfiguration,
): () => void {
  let isUnmounted = false;

  const mountPromise = ensureProductShowcaseElementRegistered().then(() => {
    if (isUnmounted) {
      return;
    }

    const showcaseElement = document.createElement(customElementName) as ProductShowcaseElementInstance;
    containerElement.appendChild(showcaseElement);
    showcaseElement.config = props;
  });

  return () => {
    isUnmounted = true;
    void mountPromise.finally(() => {
      containerElement.innerHTML = "";
    });
  };
}
