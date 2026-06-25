import {
  auth,
  onAuthStateChanged,
  signOut,

  db,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query
} from "./firebase.js";

onAuthStateChanged(auth, (user) => {

  if (!user) {

    window.location.href =
      "login.html";
  }
});

const loadBtn =
  document.getElementById("loadAppointments");

const appointmentsList =
  document.getElementById("appointmentsList");

const blockedTimesList =
  document.getElementById("blockedTimesList");

const loadBlockedTimesBtn =
  document.getElementById("loadBlockedTimes");

const blockDate =
  document.getElementById("blockDate");

const blockStart =
  document.getElementById("blockStart");

const blockEnd =
  document.getElementById("blockEnd");

const blockReason =
  document.getElementById("blockReason");

const saveBlockedTime =
  document.getElementById("saveBlockedTime");

const logoutBtn = document.getElementById("logoutBtn");

  logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});  

loadBtn.addEventListener(
  "click",
  loadAppointments
);

loadBlockedTimesBtn.addEventListener(
  "click",
  loadBlockedTimes
);

saveBlockedTime.addEventListener(
  "click",
  saveBlockedTimeToFirebase
);

populateTimeDropdowns();

function populateTimeDropdowns() {

  for (let hour = 8; hour <= 18; hour++) {

    for (let mins of [0, 15, 30, 45]) {

      const totalMinutes =
        hour * 60 + mins;

      const displayHour =
        hour > 12 ? hour - 12 : hour;

      const ampm =
        hour >= 12 ? "PM" : "AM";

      const formatted =
        `${displayHour}:${mins
          .toString()
          .padStart(2, "0")} ${ampm}`;

      const startOption =
        document.createElement("option");

      startOption.value =
        totalMinutes;

      startOption.textContent =
        formatted;

      const endOption =
        document.createElement("option");

      endOption.value =
        totalMinutes;

      endOption.textContent =
        formatted;

      blockStart.appendChild(startOption);
      blockEnd.appendChild(endOption);
    }
  }
}

async function saveBlockedTimeToFirebase() {

  if (
    !blockDate.value ||
    !blockStart.value ||
    !blockEnd.value
  ) {

    alert(
      "Please complete all time fields."
    );

    return;
  }

  try {

    await addDoc(
      collection(db, "blockedTimes"),
      {
        date: blockDate.value,

        startMinutes:
          Number(blockStart.value),

        endMinutes:
          Number(blockEnd.value),

        reason:
          blockReason.value.trim()
      }
    );

    alert("Time blocked successfully.");

    blockDate.value = "";
    blockStart.value = "";
    blockEnd.value = "";
    blockReason.value = "";

    loadBlockedTimes();

  } catch (error) {

    console.error(error);

    alert("Could not block time.");
  }
}

async function loadBlockedTimes() {

  blockedTimesList.innerHTML =
    "<p>Loading blocked times...</p>";

  const q =
    query(collection(db, "blockedTimes"));

  const snapshot =
    await getDocs(q);

  if (snapshot.empty) {

    blockedTimesList.innerHTML =
      "<p>No blocked times.</p>";

    return;
  }

  blockedTimesList.innerHTML = "";

  snapshot.forEach((documentData) => {

    const block =
      documentData.data();

    const blockId =
      documentData.id;

    const card =
      document.createElement("div");

    card.classList.add("appointment-card");

    card.innerHTML = `
      <h3>${block.date}</h3>

      <p>
        <strong>Blocked:</strong>
        ${minutesToTime(block.startMinutes)}
        -
        ${minutesToTime(block.endMinutes)}
      </p>

      <p>
        <strong>Reason:</strong>
        ${block.reason || "None"}
      </p>

      <button
        class="delete-block-btn"
        data-id="${blockId}"
      >
        Unblock Time
      </button>
    `;

    blockedTimesList.appendChild(card);
  });

  attachDeleteBlockedEvents();
}

function attachDeleteBlockedEvents() {

  const buttons =
    document.querySelectorAll(".delete-block-btn");

  buttons.forEach((btn) => {

    btn.addEventListener("click", async () => {

      const confirmDelete =
        confirm(
          "Unblock this time?"
        );

      if (!confirmDelete) return;

      try {

        await deleteDoc(
          doc(
            db,
            "blockedTimes",
            btn.dataset.id
          )
        );

        alert("Time unblocked.");

        loadBlockedTimes();

      } catch (error) {

        console.error(error);

        alert("Could not unblock time.");
      }
    });
  });
}

function minutesToTime(minutes) {

  const hour =
    Math.floor(minutes / 60);

  const mins =
    minutes % 60;

  const displayHour =
    hour > 12 ? hour - 12 : hour;

  const ampm =
    hour >= 12 ? "PM" : "AM";

  return `${displayHour}:${mins
    .toString()
    .padStart(2, "0")} ${ampm}`;
}

async function loadAppointments() {

  appointmentsList.innerHTML =
    "<p>Loading appointments...</p>";

  const q =
    query(collection(db, "appointments"));

  const snapshot =
    await getDocs(q);

  if (snapshot.empty) {

    appointmentsList.innerHTML =
      "<p>No appointments found.</p>";

    return;
  }

  appointmentsList.innerHTML = "";

  snapshot.forEach((documentData) => {

    const appt =
      documentData.data();

    const appointmentId =
      documentData.id;

    const card =
      document.createElement("div");

    card.classList.add("appointment-card");

    card.innerHTML = `
      <h3>
        ${appt.date} at ${appt.time}
      </h3>

      <p>
        <strong>Client:</strong>
        ${appt.name}
      </p>

      <p>
        <strong>Email:</strong>
        ${appt.email}
      </p>

      <p>
        <strong>Phone:</strong>
        ${appt.phone}
      </p>

      <p>
        <strong>Service:</strong>
        ${appt.service}
      </p>

      <p>
        <strong>Cupping:</strong>
        ${appt.cuppingAddon ? "Yes" : "No"}
      </p>

      <p>
        <strong>Notes:</strong>
        ${appt.notes || "None"}
      </p>

      <button
        class="delete-btn"
        data-id="${appointmentId}"
      >
        Cancel Appointment
      </button>
    `;

    appointmentsList.appendChild(card);
  });

  attachDeleteEvents();
}

function attachDeleteEvents() {

  const deleteButtons =
    document.querySelectorAll(".delete-btn");

  deleteButtons.forEach((btn) => {

    btn.addEventListener("click", async () => {

      const confirmDelete =
        confirm(
          "Cancel this appointment?"
        );

      if (!confirmDelete) return;

      const appointmentId =
        btn.dataset.id;

      try {

        await deleteDoc(
          doc(
            db,
            "appointments",
            appointmentId
          )
        );

        alert("Appointment cancelled.");

        loadAppointments();

      } catch (error) {

        console.error(error);

        alert(
          "Could not cancel appointment."
        );
      }
    });
  });
}

loadAppointments();
loadBlockedTimes();