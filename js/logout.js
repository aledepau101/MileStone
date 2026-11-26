"use strict";

// Log out: ends the server session, clears the saved user, and returns to the login page.
(() => {
  const trigger = document.querySelector(".planner-profile");
  if (!trigger) return;

  async function logOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // Still sign out on this device even if the server can't be reached.
    }
    try {
      localStorage.removeItem("currentUser");
    } catch {
      // localStorage unavailable; nothing to clear.
    }
    window.location.assign("login.html");
  }

  trigger.addEventListener("click", logOut);
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      logOut();
    }
  });
})();
