# Global Layout Domain

This domain contains the cross-cutting layout components that wrap every page in the application. It is composed of two independent sub-projects, each with its own technology stack and Webpack build, demonstrating how a single business domain can host multiple stacks.

## Sub-projects

- `header/` - React Web Component (`react-header-mfe`), exposed via Module Federation as `header/HeaderElement`. Default port: `4301`.
- `footer/` - Vue Web Component (`vue-footer-mfe`), exposed via Module Federation as `footer/FooterElement`. Default port: `4302`.

Each sub-project is registered as an independent npm workspace under `apps/global-layout/*`.
