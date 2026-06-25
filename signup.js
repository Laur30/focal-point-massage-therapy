import {
  auth,
  createUserWithEmailAndPassword
} from "./firebase.js";

const signupForm =
  document.getElementById("signupForm");

const signupMessage =
  document.getElementById("signupMessage");

signupForm.addEventListener(
  "submit",
  async (e) => {

    e.preventDefault();

    const email =
      document
        .getElementById("signupEmail")
        .value;

    const password =
      document
        .getElementById("signupPassword")
        .value;

    try {

      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      signupMessage.innerHTML =
        "Account created 🎉";

      setTimeout(() => {

       window.location.href = "client-login.html";

      }, 1200);

    } catch (error) {

      console.error(error);

      signupMessage.innerHTML =
        "Could not create account.";
    }
  }
);