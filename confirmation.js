const detailsDiv = document.getElementById("confirmationDetails");

const service = sessionStorage.getItem("confirmedService");
const date = sessionStorage.getItem("confirmedDate");
const time = sessionStorage.getItem("confirmedTime");

detailsDiv.innerHTML = `
  <p>${service || "Your session"}</p>
  <p>${date || ""}</p>
  <p>${time || ""}</p>
  <p class="email-note">Confirmation email sent.</p>
`;