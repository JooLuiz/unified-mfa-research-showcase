/**
 * Showcase fetching for the product showcase element.
 * Role: Owns the showcase HTTP request and the abort/dedup bookkeeping around it.
 * Not in this file: Component state or rendering (src/product-showcase-element.ts).
 * Key dependencies: Mock data service GET /showcases/:showcaseId.
 * See also: src/product-showcase-element.ts.
 */

import type { Showcase } from "./showcase-types";

/**
 * Fetches a showcase by id.
 *
 * @param apiBaseUrl - Mock API base URL.
 * @param showcaseId - Showcase identifier.
 * @param signal - Abort signal for the request.
 * @returns The fetched showcase.
 * @throws {Error} When the response is not ok.
 */
export async function fetchShowcaseById(
  apiBaseUrl: string,
  showcaseId: string,
  signal: AbortSignal,
): Promise<Showcase> {
  const response = await fetch(`${apiBaseUrl}/showcases/${showcaseId}`, { signal });
  if (!response.ok) {
    throw new Error(
      `fetchShowcaseById - request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

/**
 * Tracks the in-flight showcase request so the component can dedup and abort loads.
 */
export class ShowcaseRequestTracker {
  private activeAbortController?: AbortController;
  private lastLoadedShowcaseId?: string;
  private lastLoadedApiBaseUrl?: string;

  /**
   * Reports whether the given showcase was already loaded from the given API.
   */
  hasLoaded(showcaseId: string, apiBaseUrl: string): boolean {
    return (
      this.lastLoadedShowcaseId === showcaseId &&
      this.lastLoadedApiBaseUrl === apiBaseUrl
    );
  }

  /**
   * Marks a new load, aborting any previous request.
   *
   * @returns The abort controller for the new request.
   */
  begin(showcaseId: string, apiBaseUrl: string): AbortController {
    this.abort();
    this.lastLoadedShowcaseId = showcaseId;
    this.lastLoadedApiBaseUrl = apiBaseUrl;
    const abortController = new AbortController();
    this.activeAbortController = abortController;
    return abortController;
  }

  /**
   * Clears the dedup markers without aborting the in-flight request.
   */
  reset(): void {
    this.lastLoadedShowcaseId = undefined;
    this.lastLoadedApiBaseUrl = undefined;
  }

  /**
   * Aborts the in-flight request, if any.
   */
  abort(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = undefined;
    }
  }
}
