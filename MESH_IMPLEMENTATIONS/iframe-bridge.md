# Iframe Bridge

Cross-origin FAQ, new-post, and empty-checkout iframes communicate with their owning shell through the Event Mesh gateway rather than browser `postMessage`.

## Lifecycle

1. The parent creates a cryptographically random UUID channel and adds it to the iframe URL.
2. The parent publishes `iframe-bridge.registered` with the channel and approved frame ID.
3. The iframe connects as a guest and publishes a permitted `iframe-bridge.message`.
4. The gateway validates the envelope, resolves the registered owner, and sends the message only to that client.
5. The parent removes its subscription when its route or remote unmounts. Gateway registrations expire after five minutes.

## Contract

All bridge messages use distributed scope:

| Frame ID | Event | Payload |
| --- | --- | --- |
| `faq-formulary` | `resized` | `{ height }` |
| `faq-formulary` | `faq-submitted` | `{ name, email, contactMethod, question }` |
| `new-post-formulary` | `resized` | `{ height }` |
| `new-post-formulary` | `post-submitted` | `{ content, imageUrl }` |
| `checkout-empty` | `resized` | `{ height }` |
| `checkout-empty` | `go-shopping` | `{}` |

Guest credentials may publish only `iframe-bridge.registered` and `iframe-bridge.message`. The gateway validates the frame ID and event payload before targeted delivery; guest clients cannot publish order or export commands.
