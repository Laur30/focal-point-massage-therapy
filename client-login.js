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
    console.error(error);
    message.innerHTML = "Login failed. Check email/password.";
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