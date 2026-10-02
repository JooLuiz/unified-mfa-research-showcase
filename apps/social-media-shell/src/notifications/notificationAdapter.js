/**
 * Publishes social media shell notifications through event mesh.
 * Role: Producer-side API for raising notifications on the mesh.
 * Not in this file: Toast rendering or mesh client configuration.
 * Key dependencies: @shared/notifications; event-mesh/mesh.
 * See also: src/notifications/notificationCenter.js; src/main.js.
 */

import { createMeshNotificationAdapter } from "@shared/notifications";
import mesh from "event-mesh/mesh";

const { publishNotification } = createMeshNotificationAdapter({ mesh });

export { publishNotification };
