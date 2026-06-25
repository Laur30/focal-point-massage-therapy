import {
  auth,
  onAuthStateChanged,
  signOut,

  db,
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where

} from "./firebase.js";

const appointmentsDiv =
  document.getElementById("clientAppointments");

const logoutBtn =
  document.getElementById("logoutBtn");

logoutBtn.addEventListener(
  "click",
  async () => {

    await signOut(auth);

    window.location.href =
      "client-login.html";
  }
);

onAuthStateChanged(
  auth,

  async (user) => {

    if (!user) {

      window.location.href =
        "client-login.html";

      return;
    }

    loadAppointments(user.uid);
  }
);

async function loadAppointments(userId) {

  appointmentsDiv.innerHTML =
    "<p>Loading appointments...</p>";

  try {

    const q = query(
      collection(db, "appointments"),

      where("userId", "==", userId)
    );

    const snapshot =
      await getDocs(q);

    appointmentsDiv.innerHTML = "";

    if (snapshot.empty) {

      appointmentsDiv.innerHTML = `
        <p>
          No appointments found.
        </p>
      `;

      return;
    }

    snapshot.forEach((docSnap) => {

      const appointment = {
        id: docSnap.id,
        ...docSnap.data()
      };

      const card =
        document.createElement("div");

      card.classList.add(
        "appointment-card"
      );

      card.innerHTML = `

        <h3>
          ${appointment.service}
        </h3>

        <p>
          ${appointment.date}
        </p>

        <p>
          ${appointment.time}
        </p>

        <p>
          Cupping:
          ${appointment.cuppingAddon
            ? "Yes"
            : "No"}
        </p>

        <button
          class="delete-btn"
          data-id="${appointment.id}"
        >
          Cancel Appointment
        </button>

        <button
          class="reschedule-btn"
          data-id="${appointment.id}"
        >
          Reschedule
        </button>
      `;

      appointmentsDiv.appendChild(card);
    });

    setupButtons();

  } catch (error) {

    console.error(error);

    appointmentsDiv.innerHTML = `
      <p>
        Failed to load appointments.
      </p>
    `;
  }
}

function setupButtons() {

  document
    .querySelectorAll(".delete-btn")
    .forEach((btn) => {

      btn.addEventListener(
        "click",

        async () => {

          const confirmed =
            confirm(
              "Cancel this appointment?"
            );

          if (!confirmed) return;

          try {

            await deleteDoc(
              doc(
                db,
                "appointments",
                btn.dataset.id
              )
            );

            btn
              .closest(".appointment-card")
              .remove();

          } catch (error) {

            console.error(error);

            alert(
              "Failed to cancel appointment."
            );
          }
        }
      );
    });

  document
    .querySelectorAll(".reschedule-btn")
    .forEach((btn) => {

      btn.addEventListener(
        "click",

        () => {

          const appointmentId =
            btn.dataset.id;

          window.location.href =
            `reschedule.html?id=${appointmentId}`;
        }
      );
    });
}