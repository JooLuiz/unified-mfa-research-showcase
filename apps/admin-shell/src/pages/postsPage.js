/**
 * Renders the all-posts table route for the admin shell.
 * Role: Loads every post via the admin API and renders a read-only table, kept live by
 *   prepending new rows whenever a post is broadcast over live admin events.
 * Not in this file: Auth guard (main.js), post mutations, or table markup
 *   (src/pages/postsTableView.js).
 * Key dependencies: src/utils/fetchJson.js; src/notifications/notificationAdapter.js;
 *   src/events/adminLiveEvents.js; src/pages/postsTableView.js.
 * See also: src/utils/renderActions.js (public barrel).
 */

import fetchJson from "../utils/fetchJson";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { publishNotification } from "../notifications/notificationAdapter";
import { subscribeToAdminLiveEvents } from "../events/adminLiveEvents";
import { POST_CREATED_EVENT_TYPE } from "../events/adminLiveEventsContracts";
import { buildPostRowMarkup, buildPostsTableMarkup } from "./postsTableView";

/**
 * Renders the posts table markup, or an empty-state message when there are no posts.
 *
 * @param {HTMLElement} tableMount - Container element for the table.
 * @param {object[]} postRecords - Posts with their author embedded.
 * @returns {void}
 * @sideEffects Replaces the table mount's contents.
 */
function renderPostsTable(tableMount, postRecords) {
  if (postRecords.length === 0) {
    tableMount.innerHTML = `<p class="admin-empty">No posts found.</p>`;
    return;
  }
  tableMount.innerHTML = buildPostsTableMarkup(postRecords);
}

/**
 * Inserts a newly created post as the first row of the posts table.
 *
 * @param {HTMLElement} tableMount - Container element for the table.
 * @param {object} postRecord - Post with its author embedded, as broadcast over live admin events.
 * @returns {void}
 * @sideEffects Mutates the table mount's DOM.
 */
function prependPostRow(tableMount, postRecord) {
  const tableBody = tableMount.querySelector("tbody");
  if (!tableBody) {
    renderPostsTable(tableMount, [postRecord]);
    return;
  }
  tableBody.insertAdjacentHTML("afterbegin", buildPostRowMarkup(postRecord));
}

/**
 * Renders the posts page with a table of all users' posts, kept live by prepending new
 * rows whenever a post is broadcast over live admin events.
 *
 * @param {object} appState - Shell state holding the auth session.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 * @sideEffects Fetches admin posts, renders the table, and registers a live-events subscription.
 */
async function renderPostsPage(appState, pageMount, activeCleanupFunctions) {
  pageMount.innerHTML = `
    <section class="admin-table-page">
      <h2>All Posts</h2>
      <div id="postsTableMount">
        <p class="admin-loading">Loading posts…</p>
      </div>
    </section>
  `;
  const tableMount = pageMount.querySelector("#postsTableMount");

  try {
    const postsPayload = await fetchJson(`${MOCK_API_BASE_URL}/admin/posts`, {
      headers: { Authorization: `Bearer ${appState.authToken}` },
    });
    renderPostsTable(tableMount, postsPayload.items);
  } catch (error) {
    tableMount.innerHTML = `<p class="admin-error">Unable to load posts.</p>`;
    publishNotification({
      type: "error",
      title: "Posts unavailable",
      message: "Unable to load all posts.",
    });
  }

  const unsubscribeFromLiveEvents = subscribeToAdminLiveEvents(({ type, data }) => {
    if (type === POST_CREATED_EVENT_TYPE) {
      prependPostRow(tableMount, data);
    }
  });
  activeCleanupFunctions.push(unsubscribeFromLiveEvents);
}

export { renderPostsPage };
