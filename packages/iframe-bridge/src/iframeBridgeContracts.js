/**
 * Names iframe bridge message kinds shared by isolated pages and their hosts.
 * Role: Holds the iframe-bridge topic and the resized, faq, post, and go-shopping event names.
 * Not in this file: postMessage type strings or host iframe mounting.
 * Key dependencies: None.
 * See also: src/createIframeBridge.js.
 */

const IFRAME_BRIDGE_TOPIC = "iframe-bridge";
const IFRAME_BRIDGE_MESSAGE_EVENT = "message";
const RESIZED_EVENT = "resized";
const FAQ_SUBMITTED_EVENT = "faq-submitted";
const POST_SUBMITTED_EVENT = "post-submitted";
const GO_SHOPPING_EVENT = "go-shopping";

export {
  FAQ_SUBMITTED_EVENT,
  GO_SHOPPING_EVENT,
  IFRAME_BRIDGE_MESSAGE_EVENT,
  IFRAME_BRIDGE_TOPIC,
  POST_SUBMITTED_EVENT,
  RESIZED_EVENT,
};
