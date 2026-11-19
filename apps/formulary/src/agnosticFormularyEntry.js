/**
 * Async entry for the agnostic-formulary webpack bundle.
 * Role: Creates the async boundary Module Federation needs before the shared vue module can be consumed on a standalone page.
 * Not in this file: Form rendering, query reading, or bridge calls (see src/mountAgnosticFormulary.js).
 * Key dependencies: src/mountAgnosticFormulary.js.
 * See also: public/faq-formulary.html; webpack.config.js.
 */

import("./mountAgnosticFormulary.js");
