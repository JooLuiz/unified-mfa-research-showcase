/**
 * Public barrel for the ecommerce shell's route renderers.
 * Role: Re-exports every render* function from src/pages/ so main.js keeps a single stable import site.
 * Not in this file: Page logic (src/pages/) or HTTP commands (src/commands/).
 * Key dependencies: None.
 * See also: src/main.js.
 */

export { renderHomePage } from "../pages/homePage";
export { renderPromotionsPage } from "../pages/promotionsPage";
export {
  renderProductListPage,
  renderProductDetailsPage,
} from "../pages/catalogPages";
export {
  renderCheckoutPage,
  renderOrderPlacedPage,
} from "../pages/checkoutPage";
export { renderLoginPage } from "../pages/authenticationPages";
export { renderAccountPage } from "../pages/accountPage";
export { renderOrderDetailsPage } from "../pages/orderPages";
