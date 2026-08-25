/**
 * Public barrel for the social media shell's route renderers.
 * Role: Re-exports every render* function from src/pages/ so pageApps.js keeps a single stable import site.
 * Not in this file: Page logic (src/pages/) or HTTP commands (src/commands/).
 * Key dependencies: None.
 * See also: src/utils/pageApps.js.
 */

export { renderFeedPage } from "../pages/feedPage";
export { renderPostsPage } from "../pages/postsPage";
export { renderLoginPage } from "../pages/authenticationPages";
export { renderAccountPage } from "../pages/accountPage";
