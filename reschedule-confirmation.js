const detailsDiv =
  document.getElementById("rescheduleDetails");

const service =
  sessionStorage.getItem("rescheduledService");

const date =
  sessionStorage.getItem("rescheduledDate");

const time =
  sessionStorage.getItem("rescheduledTime");

detailsDiv.innerHTML = `
  <p>${service || "Your appointment"}</p>
  <p>${date || ""}</p>
  <p>${time || ""}</p>
  <p class="email-note">Your appointment has been updated.</p>
`;