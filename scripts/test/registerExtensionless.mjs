/**
 * Registers the extensionless resolver before the unit suite loads shell modules.
 * Role: Installs scripts/test/extensionlessResolver.mjs for this Node process.
 * Not in this file: The resolve rule itself.
 * Key dependencies: node:module register.
 * See also: scripts/test/extensionlessResolver.mjs; package.json test script.
 */

import { register } from "node:module";

register("./extensionlessResolver.mjs", import.meta.url);
