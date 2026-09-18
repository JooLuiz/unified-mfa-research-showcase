/**
 * Login form remote for shell-owned auth session handoff.
 * Role: POSTs credentials, writes host-injected auth storage keys, then publishes auth.session-changed and navigation.path-requested.
 * Not in this file: Mesh configuration (host owns configureMesh) or welcome toasts (shell onAuthSessionChanged).
 * Key dependencies: event-mesh/mesh singleton; @shared/shell-events.
 * See also: MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import mesh from "event-mesh/mesh";
import { createShellEvents } from "@shared/shell-events";
import "./styles.css";

const { publishAuthSessionChanged, publishPathRequested } = createShellEvents({
  mesh,
});

function LoginFormView({
  apiBaseUrl,
  redirectAfterLogin,
  authTokenStorageKey,
  authUserStorageKey,
  defaultRedirectPath,
  requiredRole,
}) {
  const [usernameValue, setUsernameValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (submitEvent) => {
    submitEvent.preventDefault();

    const trimmedUsername = usernameValue.trim();
    const trimmedPassword = passwordValue.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setErrorMessage("Please type both username/email and password.");
      return;
    }

    if (
      typeof authTokenStorageKey !== "string" ||
      authTokenStorageKey.trim() === "" ||
      typeof authUserStorageKey !== "string" ||
      authUserStorageKey.trim() === ""
    ) {
      setErrorMessage("Login is misconfigured: missing auth storage keys.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const loginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedUsername,
          password: trimmedPassword,
        }),
      });

      if (!loginResponse.ok) {
        const errorPayload = await loginResponse.json().catch(() => ({}));
        setErrorMessage(errorPayload.message || "Invalid credentials.");
        return;
      }

      const loginPayload = await loginResponse.json();
      const authenticatedUser = loginPayload.user;
      if (
        typeof requiredRole === "string" &&
        requiredRole.trim() !== "" &&
        authenticatedUser?.role !== requiredRole
      ) {
        setErrorMessage("This account does not have the required access.");
        return;
      }

      localStorage.setItem(authTokenStorageKey, loginPayload.token);
      localStorage.setItem(authUserStorageKey, JSON.stringify(authenticatedUser));
      publishAuthSessionChanged();

      const targetPath =
        (typeof redirectAfterLogin === "string" && redirectAfterLogin.trim() !== ""
          ? redirectAfterLogin
          : null) ||
        (typeof defaultRedirectPath === "string" && defaultRedirectPath.trim() !== ""
          ? defaultRedirectPath
          : "/");
      publishPathRequested(targetPath);
    } catch (error) {
      setErrorMessage(`Unable to log in: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="login-shell">
      <h2>Log in to MFE Lab</h2>
      <p className="login-helper">
        Use one of the demo accounts (e.g. <code>alice.parker</code> /{" "}
        <code>password123</code>) to access the full e-commerce experience.
      </p>
      <form className="login-form" onSubmit={handleSubmit}>
        <label className="login-label" htmlFor="usernameInput">
          Username or email
        </label>
        <input
          id="usernameInput"
          className="login-input"
          type="text"
          value={usernameValue}
          autoComplete="username"
          onChange={(changeEvent) => setUsernameValue(changeEvent.target.value)}
        />

        <label className="login-label" htmlFor="passwordInput">
          Password
        </label>
        <input
          id="passwordInput"
          className="login-input"
          type="password"
          value={passwordValue}
          autoComplete="current-password"
          onChange={(changeEvent) => setPasswordValue(changeEvent.target.value)}
        />

        {errorMessage && <p className="login-error">{errorMessage}</p>}

        <div className="login-actions">
          <button className="login-submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
          <button
            className="login-cancel-button"
            type="button"
            onClick={() => publishPathRequested("/")}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

export function mountLoginForm(containerElement, props) {
  const root = createRoot(containerElement);
  root.render(
    <LoginFormView
      apiBaseUrl={props.apiBaseUrl}
      redirectAfterLogin={props.redirectAfterLogin}
      authTokenStorageKey={props.authTokenStorageKey}
      authUserStorageKey={props.authUserStorageKey}
      defaultRedirectPath={props.defaultRedirectPath}
      requiredRole={props.requiredRole}
    />,
  );

  return () => {
    root.unmount();
  };
}
