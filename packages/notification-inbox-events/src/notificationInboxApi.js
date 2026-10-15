/**
 * HTTP operations for the notification inbox.
 * Role: Fetches notifications for a shell and marks one notification or the whole shell read.
 */

/**
 * Fetches notifications for a given shell.
 *
 * @param {{ apiBaseUrl: string, authToken: string, shell: string }} input
 * @returns {Promise<Array<object>>}
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

/**
 * Marks a single notification as read on the server.
 *
 * @param {{ apiBaseUrl: string, authToken: string, notificationId: string }} input
 * @returns {Promise<object>} The updated notification row.
 */
export async function markNotificationAsRead({
  apiBaseUrl,
  authToken,
  notificationId,
}) {
  const response = await fetch(
    `${apiBaseUrl}/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `markNotificationAsRead - request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Marks every unread notification for the caller's shell as read.
 *
 * @param {{ apiBaseUrl: string, authToken: string, shell: string }} input
 * @returns {Promise<Array<object>>} The shell's notifications after the update.
 */
export async function markAllNotificationsAsRead({ apiBaseUrl, authToken, shell }) {
  const response = await fetch(
    `${apiBaseUrl}/notifications/read-all?shell=${encodeURIComponent(shell)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `markAllNotificationsAsRead - request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return Array.isArray(data.items) ? data.items : [];
}
