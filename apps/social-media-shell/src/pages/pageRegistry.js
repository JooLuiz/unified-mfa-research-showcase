/**
 * Lists the social shell's single-spa applications and the paths each one is active on.
 * Role: One table for layout and page application names and their activity rules.
 * Not in this file: Page rendering (src/utils/pageApps.js) or single-spa registration (src/main.js).
 * Key dependencies: src/utils/singlePostRoute.js.
 * See also: src/main.js.
 */

import { isSinglePostPath } from "../utils/singlePostRoute";

const HEADER_APP_NAME = "@social-media/header";
const FOOTER_APP_NAME = "@social-media/footer";
const FEED_PAGE_APP_NAME = "@social-media/feed-page";
const POSTS_PAGE_APP_NAME = "@social-media/posts-page";
const LOGIN_PAGE_APP_NAME = "@social-media/login-page";
const ACCOUNT_PAGE_APP_NAME = "@social-media/account-page";
const NOTIFICATIONS_PAGE_APP_NAME = "@social-media/notifications-page";
const SINGLE_POST_PAGE_APP_NAME = "@social-media/single-post-page";

const PAGE_APP_NAMES = [
  FEED_PAGE_APP_NAME,
  POSTS_PAGE_APP_NAME,
  LOGIN_PAGE_APP_NAME,
  ACCOUNT_PAGE_APP_NAME,
  NOTIFICATIONS_PAGE_APP_NAME,
  SINGLE_POST_PAGE_APP_NAME,
];

/**
 * Builds an activity rule that matches one exact pathname.
 *
 * @param {string} targetPath - Pathname the application owns.
 * @returns {(location: { pathname: string }) => boolean} single-spa activeWhen rule.
 */
function activeOnExactPath(targetPath) {
  return function activeWhen(currentLocation) {
    return currentLocation.pathname === targetPath;
  };
}

/**
 * Builds the activity rule for the single-post detail route.
 *
 * @returns {(location: { pathname: string }) => boolean} single-spa activeWhen rule.
 */
function activeOnSinglePostPath() {
  return function activeWhen(currentLocation) {
    return isSinglePostPath(currentLocation.pathname);
  };
}

/**
 * Pairs each page application with its name and activity rule.
 *
 * @param {{ feedPageApp: object, postsPageApp: object, loginPageApp: object, accountPageApp: object,
 *   notificationsPageApp: object, singlePostPageApp: object }} pageApps - single-spa page lifecycles.
 * @returns {Array<{ name: string, app: object, activeWhen: (location: { pathname: string }) => boolean }>}
 *   Registrations in route order.
 */
function createPageAppRegistrations(pageApps) {
  return [
    { name: FEED_PAGE_APP_NAME, app: pageApps.feedPageApp, activeWhen: activeOnExactPath("/") },
    { name: POSTS_PAGE_APP_NAME, app: pageApps.postsPageApp, activeWhen: activeOnExactPath("/posts") },
    { name: LOGIN_PAGE_APP_NAME, app: pageApps.loginPageApp, activeWhen: activeOnExactPath("/login") },
    {
      name: ACCOUNT_PAGE_APP_NAME,
      app: pageApps.accountPageApp,
      activeWhen: activeOnExactPath("/account"),
    },
    {
      name: NOTIFICATIONS_PAGE_APP_NAME,
      app: pageApps.notificationsPageApp,
      activeWhen: activeOnExactPath("/notifications"),
    },
    {
      name: SINGLE_POST_PAGE_APP_NAME,
      app: pageApps.singlePostPageApp,
      activeWhen: activeOnSinglePostPath(),
    },
  ];
}

export {
  FOOTER_APP_NAME,
  HEADER_APP_NAME,
  PAGE_APP_NAMES,
  activeOnExactPath,
  activeOnSinglePostPath,
  createPageAppRegistrations,
};
