/**
 * Remembers which signed-in user the shell's current page was rendered for.
 * Role: Lets a session-changed event skip a full re-render when only the profile was refreshed.
 * Not in this file: Rendering or session storage.
 * Key dependencies: None.
 * See also: src/createRenderedSessionMarker.test.js.
 */

/**
 * Creates a marker for the user id painted by the latest render.
 *
 * @param {{ authToken?: string | null, currentUser?: { id?: string } | null }} appState - Shell state.
 * @returns {{ beginRender: () => number, isLatestRender: (renderId: number) => boolean,
 *   remember: (renderId?: number) => void, isSameSignedInUser: () => boolean }}
 *   Render id source, staleness check, recorder, and comparison.
 */
function createRenderedSessionMarker(appState) {
  let latestRenderId = 0;
  let renderedUserId = null;

  return {
    beginRender() {
      latestRenderId += 1;
      return latestRenderId;
    },
    isLatestRender(renderId) {
      return renderId === latestRenderId;
    },
    remember(renderId = latestRenderId) {
      if (renderId !== latestRenderId) {
        return;
      }
      renderedUserId = appState.authToken ? appState.currentUser?.id ?? null : null;
    },
    isSameSignedInUser() {
      return Boolean(appState.authToken) && appState.currentUser?.id === renderedUserId;
    },
  };
}

export { createRenderedSessionMarker };
