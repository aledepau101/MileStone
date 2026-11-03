(() => {
  const { validateSignupFields, createAccount } = globalThis;
  const form = document.querySelector(".signup-form");
  const submitButton = form?.querySelector(".submit-button");
  const statusMessage = form?.querySelector(".form-status");

  if (typeof validateSignupFields !== "function" || typeof createAccount !== "function") {
    throw new Error("Sign-up requires the validation and storage scripts to load first.");
  }

  if (!form || !submitButton || !statusMessage) {
    throw new Error("Sign-up form elements are missing.");
  }

  const fields = {
    fullName: {
      input: form.elements.fullName,
      error: document.querySelector("#full-name-error"),
    },
    email: {
      input: form.elements.email,
      error: document.querySelector("#university-email-error"),
    },
    password: {
      input: form.elements.password,
      error: document.querySelector("#password-error"),
    },
    confirmPassword: {
      input: form.elements.confirmPassword,
      error: document.querySelector("#confirm-password-error"),
    },
  };

  for (const [fieldName, field] of Object.entries(fields)) {
    if (!field.input || !field.error) {
      throw new Error(`Sign-up form is missing the ${fieldName} field or its error message.`);
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
      showFieldErrors(validateSignupFields(getFieldValues()));
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

      const fieldLabel = passwordInput.name === "confirmPassword" ? "confirm password" : "password";
      toggle.setAttribute("aria-label", `${isVisible ? "Show" : "Hide"} ${fieldLabel}`);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    form.dataset.submitted = "true";
    showStatus("");

    const values = getFieldValues();
    const validationErrors = validateSignupFields(values);
    showFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      fields[Object.keys(validationErrors)[0]].input.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Creating account...";

    try {
      const accountResult = await createAccount({
        name: values.fullName.trim(),
        email: values.email.trim(),
        password: values.password,
        role: form.elements.role.value,
      });

      if (!accountResult.ok) {
        if (accountResult.error === "This email is already registered.") {
          showFieldErrors({ email: accountResult.error });
          fields.email.input.focus();
        } else {
          showStatus(accountResult.error || "Unable to create your account.");
        }
        return;
      }

      try {
        globalThis.localStorage.setItem(
          "currentUser",
          JSON.stringify({
            name: values.fullName.trim(),
            email: values.email.trim(),
            role: form.elements.role.value,
          }),
        );
      } catch {
        showStatus("Your account was created, but your session could not be saved. Please try again.");
        return;
      }

      window.location.assign("dashboard.html");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Create account";
    }
  });
})();