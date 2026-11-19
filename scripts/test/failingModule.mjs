/**
 * Module that fails as soon as it is evaluated.
 * Role: Stands in for a shell entry the bootstrap could not load.
 * Not in this file: The real application entry.
 * Key dependencies: None.
 * See also: scripts/test/shellEntryResolver.mjs.
 */

throw new Error("bootstrap module failed");
