const MOCK_API_BASE_URL = "http://localhost:4000/api";
const ECOMMERCE_SHELL_BASE_URL = "http://localhost:4200";

const AUTH_TOKEN_STORAGE_KEY = "social-media-shell:auth-token";
const AUTH_USER_STORAGE_KEY = "social-media-shell:auth-user";
const POST_LOGIN_REDIRECT_STORAGE_KEY = "social-media-shell:post-login-redirect";

const PROTECTED_ROUTE_PATHS = ["/account"];

export {
  MOCK_API_BASE_URL,
  ECOMMERCE_SHELL_BASE_URL,
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  POST_LOGIN_REDIRECT_STORAGE_KEY,
  PROTECTED_ROUTE_PATHS,
};
