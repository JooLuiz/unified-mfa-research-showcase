const API_BASE_URL = "http://localhost:4000/api";

async function signIn(page, { username, tokenKey, userKey }) {
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username, password: "password123" },
  });

  const loginPayload = await loginResponse.json();

  await page.addInitScript(
    ([storedTokenKey, storedUserKey, token, user]) => {
      localStorage.setItem(storedTokenKey, token);
      localStorage.setItem(storedUserKey, JSON.stringify(user));
    },
    [tokenKey, userKey, loginPayload.token, loginPayload.user],
  );
}

module.exports = { signIn };
