import {
  auth,
  signInWithEmailAndPassword
} from "./firebase.js";

const loginForm =
  document.getElementById("loginForm");

const loginMessage =
  document.getElementById("loginMessage");

loginForm.addEventListener(
  "submit",
  async (e) => {

    e.preventDefault();

    const email =
      document
        .getElementById("loginEmail")
        .value;

    const password =
      document
        .getElementById("loginPassword")
        .value;

    try {

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      loginMessage.innerHTML =
        "Login successful 🎉";

      window.location.href =
        "admin.html";

    } catch (error) {

      console.error(error);

      loginMessage.innerHTML =
        "Incorrect login.";
    }
  }
);