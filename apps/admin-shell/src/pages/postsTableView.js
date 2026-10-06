/**
 * Builds the markup for the admin posts table.
 * Role: Pure HTML-building helpers shared by the initial posts fetch and the live
 *   post-row prepend triggered by SSE events.
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
    <tr>
      <td>${authorName}</td>
      <td>${formatDate(postRecord.createdAt)}</td>
      <td>${buildExcerpt(postRecord.content)}</td>
      <td class="admin-cell-number">${postRecord.likes ?? 0}</td>
      <td class="admin-cell-number">${getCommentCount(postRecord)}</td>
    </tr>
  `;
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

export { buildPostRowMarkup, buildPostsTableMarkup };
