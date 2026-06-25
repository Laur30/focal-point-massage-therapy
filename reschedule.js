import {
  auth,
  onAuthStateChanged,

  db,
  doc,
  getDocs,
  collection,
  query,
  where,
  updateDoc

} from "./firebase.js";

emailjs.init("geVjfrV3JuXFSSv4d");

const availability = {
  1: { start: 10, end: 15 },
  2: { start: 10, end: 15 },
  3: { start: 11, end: 15 },
  4: { start: 10, end: 15 },
  5: { start: 11, end: 14 }
};

const bufferMinutes = 15;

let selectedTime = null;
let selectedStartMinutes = null;
let currentDate = new Date();
let currentAppointmentDuration = 60;
let appointment = null;

const appointmentId =
  new URLSearchParams(window.location.search).get("id");

const calendarGrid = document.getElementById("calendarGrid");
const calendarMonth = document.getElementById("calendarMonth");
const bookingDateInput = document.getElementById("bookingDate");
const timeSlotsDiv = document.getElementById("timeSlots");
const saveBtn = document.getElementById("saveReschedule");
const messageDiv = document.getElementById("rescheduleMessage");

document.getElementById("prevMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function formatTime(hour, mins) {
  const displayHour = hour > 12 ? hour - 12 : hour;
  const ampm = hour >= 12 ? "PM" : "AM";

  return `${displayHour}:${mins.toString().padStart(2, "0")} ${ampm}`;
}

async function loadCurrentAppointment() {
  if (!appointmentId) {
    alert("No appointment selected.");
    window.location.href = "client-dashboard.html";
    return;
  }

  const q = query(
    collection(db, "appointments"),
    where("__name__", "==", appointmentId)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    alert("Appointment not found.");
    window.location.href = "client-dashboard.html";
    return;
  }

  appointment = snapshot.docs[0].data();

  currentAppointmentDuration = appointment.duration || 60;

  renderCalendar();
}

async function getBookingsForDate(dateString) {
  const q = query(
    collection(db, "appointments"),
    where("date", "==", dateString),
    where("status", "==", "confirmed")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

async function renderCalendar() {
  calendarGrid.innerHTML =
    "<p class='calendar-loading'>Loading calendar...</p>";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  calendarMonth.innerText =
    firstDay.toLocaleString("default", {
      month: "long",
      year: "numeric"
    });

  calendarGrid.innerHTML = "";

  const startDay = firstDay.getDay();

  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement("div");
    empty.classList.add("calendar-day", "empty");
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const fullDate =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const dateObj = new Date(fullDate + "T00:00:00");
    const weekday = dateObj.getDay();

    const dayDiv = document.createElement("div");
    dayDiv.classList.add("calendar-day");
    dayDiv.innerText = day;

    if (!availability[weekday]) {
      dayDiv.classList.add("unavailable");
    } else {
      dayDiv.classList.add("available");

      dayDiv.addEventListener("click", () => {
        document
          .querySelectorAll(".calendar-day")
          .forEach((d) => d.classList.remove("selected"));

        dayDiv.classList.add("selected");

        bookingDateInput.value = fullDate;
        selectedTime = null;
        selectedStartMinutes = null;

        generateTimeSlots();
      });
    }

    calendarGrid.appendChild(dayDiv);
  }
}

async function generateTimeSlots() {
  timeSlotsDiv.innerHTML = "";

  selectedTime = null;
  selectedStartMinutes = null;

  if (!bookingDateInput.value) return;

  const selectedDate =
    new Date(bookingDateInput.value + "T00:00:00");

  const day = selectedDate.getDay();

  if (!availability[day]) {
    timeSlotsDiv.innerHTML = "<p>No availability for this day.</p>";
    return;
  }

  const existingBookings =
    await getBookingsForDate(bookingDateInput.value);

  const { start, end } = availability[day];

  let slotsCreated = 0;

  for (let hour = start; hour < end; hour++) {
    for (let mins of [0, 15, 30, 45]) {
      const proposedStart = hour * 60 + mins;

      const proposedEnd =
        proposedStart +
        currentAppointmentDuration +
        bufferMinutes;

      if (proposedEnd > end * 60) continue;

      const bookingConflict =
        existingBookings.some((booking) => {
          if (booking.id === appointmentId) {
            return false;
          }

          const bookedStart = booking.startMinutes;

          const bookedEnd =
            booking.startMinutes +
            booking.duration +
            bufferMinutes;

          return overlaps(
            proposedStart,
            proposedEnd,
            bookedStart,
            bookedEnd
          );
        });

      if (bookingConflict) continue;

      const slot = document.createElement("div");
      slot.classList.add("time-slot");
      slot.innerText = formatTime(hour, mins);

      slot.addEventListener("click", () => {
        document
          .querySelectorAll(".time-slot")
          .forEach((s) => s.classList.remove("selected"));

        slot.classList.add("selected");

        selectedTime = slot.innerText;
        selectedStartMinutes = proposedStart;
      });

      timeSlotsDiv.appendChild(slot);
      slotsCreated++;
    }
  }

  if (slotsCreated === 0) {
    timeSlotsDiv.innerHTML =
      "<p>No open times left for this date.</p>";
  }
}

saveBtn.addEventListener("click", async () => {
  if (!bookingDateInput.value || !selectedTime) {
    alert("Please select a date and time.");
    return;
  }

  try {
    await updateDoc(
      doc(db, "appointments", appointmentId),
      {
        date: bookingDateInput.value,
        time: selectedTime,
        startMinutes: selectedStartMinutes,
        cuppingAddon:
          document.getElementById("cuppingAddon").checked,
        updatedAt: new Date().toISOString()
      }
    );
    await emailjs.send(
  "service_l51ekpl",
  "template_4l5qpcb",
  {
    client_name: appointment.name,
    client_email: appointment.email,
    email: appointment.email,
    service: appointment.service,
    date: bookingDateInput.value,
    time: selectedTime,
    phone: appointment.phone,
    notes: appointment.notes,
    cupping:
      document.getElementById("cuppingAddon").checked ? "Yes" : "No"
  }
);

await emailjs.send(
  "service_l51ekpl",
  "template_4l5qpcb",
  {
    client_name: appointment.name,
    client_email: appointment.email,
    email: "sandersonlaurie1@gmail.com",
    service: appointment.service,
    date: bookingDateInput.value,
    time: selectedTime,
    phone: appointment.phone,
    notes: appointment.notes,
    cupping:
      document.getElementById("cuppingAddon").checked ? "Yes" : "No"
  }
);

    sessionStorage.setItem(
      "rescheduledService",
      "Appointment"
    );

    sessionStorage.setItem(
     "rescheduledDate",
     bookingDateInput.value
    );

    sessionStorage.setItem(
      "rescheduledTime",
       selectedTime
    );

    window.location.href =
     "reschedule-confirmation.html";

  } catch (error) {
    console.error(error);
    alert("Failed to reschedule.");
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "client-login.html";
    return;
  }

  loadCurrentAppointment();
});