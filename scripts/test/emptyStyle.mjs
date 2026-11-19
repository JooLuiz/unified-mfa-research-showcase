/**
 * Stand-in for a stylesheet import while Node runs a shell unit test.
 * Role: Gives CSS imports an empty module so the test runner can load shell files.
 * Not in this file: Real styles.
 * Key dependencies: None.
 * See also: scripts/test/extensionlessResolver.mjs.
 */

export default "";
