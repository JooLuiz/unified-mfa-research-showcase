/**
 * Builds the markup for the admin posts table.
 * Role: Pure HTML-building helpers shared by the initial posts fetch, the live post-row
 *   prepend triggered by live admin events, and the live Likes-cell patch triggered by
 *   post_likes_changed.
 * Not in this file: Fetching, auth, or live-event subscription (src/pages/postsPage.js).
 * Key dependencies: None.
 * See also: src/pages/postsPage.js.
 */

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
 * Builds the markup for a single post row.
 *
 * @param {object} postRecord - Post with its author embedded (as returned by GET /admin/posts).
 * @returns {string} `<tr>` markup for the posts table body.
 */
function buildPostRowMarkup(postRecord) {
  const authorName =
    postRecord.author?.fullName ||
    postRecord.author?.username ||
    "Unknown author";
  return `
    <tr data-post-id="${postRecord.id}">
      <td>${authorName}</td>
      <td>${formatDate(postRecord.createdAt)}</td>
      <td>${buildExcerpt(postRecord.content)}</td>
      <td class="admin-cell-number admin-cell-likes">${postRecord.likes ?? 0}</td>
      <td class="admin-cell-number">${getCommentCount(postRecord)}</td>
    </tr>
  `;
}

/**
 * Replaces one post row's Likes cell in place, leaving the rest of the row untouched.
 *
 * @param {HTMLElement} tableMount - Container element for the table.
 * @param {{ postId: string, likes: number }} likesChangedInput - Post whose like count changed, and its new count.
 * @returns {void}
 * @sideEffects Mutates the table mount's DOM. A missing row (the post isn't in this table, or
 *   the table hasn't rendered yet) is a no-op.
 */
function updatePostLikesRow(tableMount, { postId, likes }) {
  const matchingRow = tableMount.querySelector(`tr[data-post-id="${postId}"]`);
  if (!matchingRow) {
    return;
  }
  const likesCell = matchingRow.querySelector(".admin-cell-likes");
  if (likesCell) {
    likesCell.textContent = String(likes);
  }
}

/**
 * Builds the full posts table markup, including header and body rows.
 *
 * @param {object[]} postRecords - Posts with their author embedded.
 * @returns {string} `<table>` markup.
 */
function buildPostsTableMarkup(postRecords) {
  const tableRows = postRecords.map(buildPostRowMarkup).join("");
  return `
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
}

export { buildPostRowMarkup, buildPostsTableMarkup, updatePostLikesRow };
