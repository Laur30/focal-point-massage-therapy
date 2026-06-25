import {
  auth,
  onAuthStateChanged,

  db,
  collection,
  addDoc,
  getDocs,
  query,
  where
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

let selectedService = {
  name: "60 Minute Deep Tissue / Trigger Point",
  duration: 60
};

let selectedTime = null;
let selectedStartMinutes = null;
let currentUser = null;
let currentDate = new Date();

const serviceButtons = document.querySelectorAll(".service-btn");
const timeSlotsDiv = document.getElementById("timeSlots");
const bookingDateInput = document.getElementById("bookingDate");
const bookingForm = document.getElementById("bookingForm");
const calendarGrid = document.getElementById("calendarGrid");
const calendarMonth = document.getElementById("calendarMonth");

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "client-login.html";
    return;
  }

  currentUser = user;
});

document.getElementById("prevMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

serviceButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    serviceButtons.forEach((b) => b.classList.remove("active"));

    btn.classList.add("active");

    selectedService = {
      name: btn.dataset.service,
      duration: Number(btn.dataset.duration)
    };

    if (bookingDateInput.value) {
     generateTimeSlots();
    } 
  });
});

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function formatTime(hour, mins) {
  const displayHour = hour > 12 ? hour - 12 : hour;
  const ampm = hour >= 12 ? "PM" : "AM";

  return `${displayHour}:${mins.toString().padStart(2, "0")} ${ampm}`;
}

function createGoogleCalendarLink(appointment) {
  const startDateTime = new Date(`${appointment.date} ${appointment.time}`);
  const endDateTime = new Date(
    startDateTime.getTime() + appointment.duration * 60000
  );

  const formatForGoogle = (date) => {
    return date.toISOString().replace(/[-:]|\.\d{3}/g, "");
  };

  const title = encodeURIComponent(
    `Focal Point Massage Therapy - ${appointment.service}`
  );

  const details = encodeURIComponent(
    "Your appointment with Focal Point Massage Therapy is confirmed."
  );

  const location = encodeURIComponent("Focal Point Massage Therapy");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatForGoogle(startDateTime)}/${formatForGoogle(endDateTime)}&details=${details}&location=${location}`;
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

async function getBlockedTimesForDate(dateString) {
  const q = query(
    collection(db, "blockedTimes"),
    where("date", "==", dateString)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

async function getAppointmentsForMonth(year, month) {
  const monthStart =
    `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const lastDay = new Date(year, month + 1, 0).getDate();

  const monthEnd =
    `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const q = query(
    collection(db, "appointments"),
    where("date", ">=", monthStart),
    where("date", "<=", monthEnd),
    where("status", "==", "confirmed")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

async function getBlockedTimesForMonth(year, month) {
  const monthStart =
    `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const lastDay = new Date(year, month + 1, 0).getDate();

  const monthEnd =
    `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const q = query(
    collection(db, "blockedTimes"),
    where("date", ">=", monthStart),
    where("date", "<=", monthEnd)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

function dayHasOpenSlot(dateString, weekday, bookings, blockedTimes) {
  const { start, end } = availability[weekday];

  for (let hour = start; hour < end; hour++) {
    for (let mins of [0, 15, 30, 45]) {
      const proposedStart = hour * 60 + mins;

      const proposedEnd =
        proposedStart + selectedService.duration + bufferMinutes;

      if (proposedEnd > end * 60) continue;

      const bookingConflict = bookings.some((booking) => {
        const bookedStart = booking.startMinutes;

        const bookedEnd =
          booking.startMinutes + booking.duration + bufferMinutes;

        return overlaps(
          proposedStart,
          proposedEnd,
          bookedStart,
          bookedEnd
        );
      });

      const blockedConflict = blockedTimes.some((block) => {
        return overlaps(
          proposedStart,
          proposedEnd,
          block.startMinutes,
          block.endMinutes
        );
      });

      if (!bookingConflict && !blockedConflict) {
        return true;
      }
    }
  }

  return false;
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

  let monthlyAppointments = [];
  let monthlyBlockedTimes = [];

  try {
    monthlyAppointments = await getAppointmentsForMonth(year, month);
    monthlyBlockedTimes = await getBlockedTimesForMonth(year, month);
  } catch (error) {
    console.error("Month loading failed:", error);
  }

  calendarGrid.innerHTML = "";

  const startDay = firstDay.getDay();

  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement("div");
    empty.classList.add("calendar-empty");
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const fullDate =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const weekday = new Date(year, month, day).getDay();

    const dayDiv = document.createElement("div");
    dayDiv.classList.add("calendar-day");
    dayDiv.innerText = day;

    calendarGrid.appendChild(dayDiv);

    if (!availability[weekday]) {
      dayDiv.classList.add("unavailable");
      continue;
    }

    const bookingsForDay =
      monthlyAppointments.filter((appt) => appt.date === fullDate);

    const blockedForDay =
      monthlyBlockedTimes.filter((block) => block.date === fullDate);

    const hasOpenSlot =
      dayHasOpenSlot(fullDate, weekday, bookingsForDay, blockedForDay);

    if (!hasOpenSlot) {
      dayDiv.classList.add("unavailable");
      continue;
    }

    dayDiv.classList.add("available");

    dayDiv.addEventListener("click", () => {
      document
        .querySelectorAll(".calendar-day")
        .forEach((d) => d.classList.remove("selected"));

      dayDiv.classList.add("selected");

      bookingDateInput.value = fullDate;

      generateTimeSlots();
    });
  }
}

async function generateTimeSlots() {
  timeSlotsDiv.innerHTML = "";

  selectedTime = null;
  selectedStartMinutes = null;

  if (!bookingDateInput.value) return;

  const [selectedYear, selectedMonth, selectedDay] =
    bookingDateInput.value.split("-").map(Number);

  const selectedDate =
    new Date(selectedYear, selectedMonth - 1, selectedDay);

  const day = selectedDate.getDay();

  if (!availability[day]) {
    timeSlotsDiv.innerHTML =
      "<p>No availability for this day.</p>";
    return;
  }

  const existingBookings =
    await getBookingsForDate(bookingDateInput.value);

  const blockedTimes =
    await getBlockedTimesForDate(bookingDateInput.value);

  const { start, end } = availability[day];

  let slotsCreated = 0;

  for (let hour = start; hour < end; hour++) {
    for (let mins of [0, 15, 30, 45]) {
      const proposedStart = hour * 60 + mins;

      const proposedEnd =
        proposedStart + selectedService.duration + bufferMinutes;

      if (proposedEnd > end * 60) continue;

      const bookingConflict = existingBookings.some((booking) => {
        const bookedStart = booking.startMinutes;

        const bookedEnd =
          booking.startMinutes + booking.duration + bufferMinutes;

        return overlaps(
          proposedStart,
          proposedEnd,
          bookedStart,
          bookedEnd
        );
      });

      const blockedConflict = blockedTimes.some((block) => {
        return overlaps(
          proposedStart,
          proposedEnd,
          block.startMinutes,
          block.endMinutes
        );
      });

      if (bookingConflict || blockedConflict) continue;

      const formatted = formatTime(hour, mins);

      const slot = document.createElement("div");
      slot.classList.add("time-slot");
      slot.innerText = formatted;

      slot.addEventListener("click", () => {
        document
          .querySelectorAll(".time-slot")
          .forEach((s) => s.classList.remove("selected"));

        slot.classList.add("selected");

        selectedTime = formatted;
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

bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) {
    alert("Please log in before booking.");
    window.location.href = "client-login.html";
    return;
  }

  if (!bookingDateInput.value || !selectedTime) {
    alert("Please select a date and time.");
    return;
  }

  const appointmentData = {
    userId: currentUser.uid,
    clientEmail: currentUser.email,

    name: document.getElementById("clientName").value.trim(),
    email: document.getElementById("clientEmail").value.trim(),
    phone: document.getElementById("clientPhone").value.trim(),
    notes: document.getElementById("notes").value.trim(),

    cuppingAddon:
      document.getElementById("cuppingAddon").checked,

    service: selectedService.name,
    duration: selectedService.duration,
    date: bookingDateInput.value,
    time: selectedTime,
    startMinutes: selectedStartMinutes,
    status: "confirmed",
    createdAt: new Date().toISOString()
  };

  const googleCalendarLink =
    createGoogleCalendarLink(appointmentData);

  try {
    await addDoc(
      collection(db, "appointments"),
      appointmentData
    );

    await emailjs.send(
      "service_l51ekpl",
      "template_4l5qpcb",
      {
        client_name: appointmentData.name,
        client_email: appointmentData.email,
        email: appointmentData.email,
        service: appointmentData.service,
        date: appointmentData.date,
        time: appointmentData.time,
        google_calendar_link: googleCalendarLink
      }
    );

    sessionStorage.setItem(
      "confirmedService",
      appointmentData.service
    );

    sessionStorage.setItem(
      "confirmedDate",
      appointmentData.date
    );

    sessionStorage.setItem(
      "confirmedTime",
      appointmentData.time
    );

    window.location.href = "confirmation.html";

  } catch (error) {
    console.error(error);

    alert(
      "Booking failed. Check console."
    );
  }
});

renderCalendar();