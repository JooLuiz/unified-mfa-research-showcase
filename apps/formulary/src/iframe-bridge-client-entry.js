/**
 * Defers standalone iframe mesh initialization until Webpack sharing is ready.
 * Role: Avoids eager consumption of the shared Event Mesh singleton.
 * Not in this file: Iframe bridge configuration or static form behavior.
 * Key dependencies: src/iframe-bridge-client.js.
 * See also: webpack.config.js.
 */

import("./iframe-bridge-client.js");
