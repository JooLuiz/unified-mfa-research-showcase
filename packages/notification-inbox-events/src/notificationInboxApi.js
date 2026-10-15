/**
 * HTTP read for the notification inbox.
 * Role: Fetches the persisted list for one shell. Writes and live push travel over event mesh.
 * Not in this file: Mesh mark-read commands (src/notificationInboxClient.js).
 * Key dependencies: mock-data-service GET /notifications.
 * See also: src/notificationInboxClient.js.
 */

/**
 * Fetches notifications for a given shell.
 *
 * @param {{ apiBaseUrl: string, authToken: string, shell: string }} input - API base, bearer token, and shell.
 * @returns {Promise<Array<object>>} Inbox rows, newest first, or an empty list when the call is skipped.
 */
export async function fetchNotificationInbox({ apiBaseUrl, authToken, shell }) {
  if (!apiBaseUrl || !authToken || !shell) {
    return [];
  }

  const response = await fetch(
    `${apiBaseUrl}/notifications?shell=${encodeURIComponent(shell)}`,
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `fetchNotificationInbox - request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return Array.isArray(data.items) ? data.items : [];
}
