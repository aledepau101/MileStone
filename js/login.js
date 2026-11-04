(() => {
  const { validateLoginFields, authenticate, getAccounts } = globalThis;
  const form = document.querySelector(".login-form");
  const submitButton = form?.querySelector(".submit-button");
  const statusMessage = form?.querySelector(".form-status");

  if (
    typeof validateLoginFields !== "function" ||
    typeof authenticate !== "function" ||
    typeof getAccounts !== "function"
  ) {
    throw new Error("Log in requires the validation, auth, and storage scripts to load first.");
  }

  if (!form || !submitButton || !statusMessage) {
    throw new Error("Log in form elements are missing.");
  }

  const fields = {
    email: { input: form.elements.email, error: document.querySelector("#login-email-error") },
    password: { input: form.elements.password, error: document.querySelector("#login-password-error") },
  };

  for (const [fieldName, field] of Object.entries(fields)) {
    if (!field.input || !field.error) {
      throw new Error(`Log in form is missing the ${fieldName} field or its error message.`);
    }
  }

  function getFieldValues() {
    return Object.fromEntries(
      Object.entries(fields).map(([fieldName, field]) => [fieldName, field.input.value]),
    );
  }

  function showFieldErrors(errors) {
    for (const [fieldName, field] of Object.entries(fields)) {
      const error = errors[fieldName] ?? "";
      field.error.textContent = error;
      field.error.hidden = !error;
      field.input.setAttribute("aria-invalid", String(Boolean(error)));
    }
  }

  function showStatus(message) {
    statusMessage.textContent = message;
    statusMessage.hidden = !message;
  }

  form.addEventListener("input", () => {
    showStatus("");
    if (form.dataset.submitted === "true") {
      showFieldErrors(validateLoginFields(getFieldValues()));
    }
  });

  form.querySelectorAll(".visibility-toggle").forEach((toggle) => {
    const passwordInput = toggle.closest(".input-wrap")?.querySelector('input[type="password"], input[type="text"]');

    if (!passwordInput) {
      throw new Error("A password visibility control is missing its input.");
    }

    toggle.addEventListener("click", () => {
      const isVisible = passwordInput.type === "text";
      passwordInput.type = isVisible ? "password" : "text";
      toggle.setAttribute("aria-pressed", String(!isVisible));
      toggle.setAttribute("aria-label", `${isVisible ? "Show" : "Hide"} password`);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    form.dataset.submitted = "true";
    showStatus("");

    const values = getFieldValues();
    const validationErrors = validateLoginFields(values);
    showFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      fields[Object.keys(validationErrors)[0]].input.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Logging in...";

    try {
      const accounts = await getAccounts();
      const session = authenticate(accounts, {
        email: values.email,
        password: values.password,
        role: form.elements.role.value,
      });

      if (!session) {
        showStatus("Incorrect email, password, or account type.");
        return;
      }

      try {
        globalThis.localStorage.setItem("currentUser", JSON.stringify(session));
      } catch {
        showStatus("You are logged in, but your session could not be saved. Please try again.");
        return;
      }

      window.location.assign("dashboard.html");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Unable to log in.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Log in";
    }
  });
})();
