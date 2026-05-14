import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function LoginFormView({ apiBaseUrl, onLoginSuccess, onCancel, redirectAfterLogin }) {
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
      if (typeof onLoginSuccess === "function") {
        onLoginSuccess({
          token: loginPayload.token,
          user: loginPayload.user,
          redirectAfterLogin,
        });
      }
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
          {typeof onCancel === "function" && (
            <button
              className="login-cancel-button"
              type="button"
              onClick={() => onCancel()}
            >
              Cancel
            </button>
          )}
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
      onLoginSuccess={props.onLoginSuccess}
      onCancel={props.onCancel}
      redirectAfterLogin={props.redirectAfterLogin}
    />,
  );

  return () => {
    root.unmount();
  };
}
