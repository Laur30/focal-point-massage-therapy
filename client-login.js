import {
  auth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "./firebase.js";

const form = document.getElementById("clientLoginForm");
const message = document.getElementById("clientLoginMessage");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("clientEmail").value;
  const password = document.getElementById("clientPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);

    message.innerHTML = "Login successful 🎉";

    window.location.href = "client-dashboard.html";

    } catch (error) {
    console.error("Login error:", error);

    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password"
    ) {
      message.innerHTML =
        "That email/password did not match. If you just reset your password, use the new password you created from the reset email.";
    } else if (error.code === "auth/user-not-found") {
      message.innerHTML =
        "No account was found with that email. Please check the spelling or create an account.";
    } else if (error.code === "auth/invalid-email") {
      message.innerHTML = "Please enter a valid email address.";
    } else if (error.code === "auth/too-many-requests") {
      message.innerHTML =
        "Too many attempts. Please wait a few minutes, then try again.";
    } else {
      message.innerHTML = `Login failed: ${error.message}`;
    }
  }
});
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

forgotPasswordBtn.addEventListener("click", async () => {
  const typedEmail = document.getElementById("clientEmail").value.trim();

  const email = prompt(
    "Enter the email address for your account:",
    typedEmail
  );

  if (!email) {
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email.trim());
    alert("Password reset email sent. Please check your inbox.");
  } catch (error) {
    console.error("Password reset error:", error);

    if (error.code === "auth/user-not-found") {
      alert("No account was found with that email address.");
    } else if (error.code === "auth/invalid-email") {
      alert("Please enter a valid email address.");
    } else {
      alert(`Could not send reset email: ${error.message}`);
    }
  }
});