import {
  auth,
  signInWithEmailAndPassword
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

    window.location.href = "scheduler-test.html";

  } catch (error) {
    console.error(error);
    message.innerHTML = "Login failed. Check email/password.";
  }
});