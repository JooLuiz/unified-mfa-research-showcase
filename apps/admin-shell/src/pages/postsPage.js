/**
 * Renders the all-posts table route for the admin shell.
 * Role: Loads every post via the admin API and renders a read-only table.
 * Not in this file: Auth guard (main.js) or post mutations.
 * Key dependencies: src/utils/fetchJson.js; src/notifications/notificationBus.js.
 * See also: src/utils/renderActions.js (public barrel).
 */

import fetchJson from "../utils/fetchJson";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { notify } from "../notifications/notificationBus";

const CONTENT_EXCERPT_LENGTH = 80;

function formatDate(isoDate) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

function buildExcerpt(content) {
  if (!content) {
    return "";
  }
  if (content.length <= CONTENT_EXCERPT_LENGTH) {
    return content;
  }
  return `${content.slice(0, CONTENT_EXCERPT_LENGTH)}…`;
}

/**
 * Returns a safe numeric comment count from a post record.
 */
function getCommentCount(postRecord) {
  return Number.isFinite(postRecord.comments) ? postRecord.comments : 0;
}

/**
 * Renders the posts page with a table of all users' posts.
 *
 * @param {object} appState - Shell state holding the auth session.
 * @param {HTMLElement} pageMount - Route container element.
 * @returns {Promise<void>}
 * @sideEffects Fetches admin posts and renders the table; on failure shows an inline error and a toast.
 */
async function renderPostsPage(appState, pageMount) {
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

    if (postsPayload.items.length === 0) {
      tableMount.innerHTML = `<p class="admin-empty">No posts found.</p>`;
      return;
    }

    const tableRows = postsPayload.items
      .map((postRecord) => {
        const authorName =
          postRecord.author?.fullName ||
          postRecord.author?.username ||
          "Unknown author";
        return `
          <tr>
            <td>${authorName}</td>
            <td>${formatDate(postRecord.createdAt)}</td>
            <td>${buildExcerpt(postRecord.content)}</td>
            <td class="admin-cell-number">${postRecord.likes ?? 0}</td>
            <td class="admin-cell-number">${getCommentCount(postRecord)}</td>
          </tr>
        `;
      })
      .join("");

    tableMount.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Author</th>
            <th>Created At</th>
            <th>Content</th>
            <th>Likes</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
  } catch (error) {
    tableMount.innerHTML = `<p class="admin-error">Unable to load posts.</p>`;
    notify({
      type: "error",
      title: "Posts unavailable",
      message: "Unable to load all posts.",
    });
  }
}

export { renderPostsPage };
