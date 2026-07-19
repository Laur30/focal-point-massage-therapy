import {
  auth,
  onAuthStateChanged,
  signOut,
  db,
  collection,
  addDoc,
  getDocs,
  query,
  where
} from "./firebase.js";

emailjs.init("geVjfrV3JuXFSSv4d");

const EMAILJS_SERVICE_ID = "service_l51ekpl";
const EMAILJS_TEMPLATE_ID = "template_4l5qpcb";
const BUSINESS_EMAIL = "sandersonlaurie1@gmail.com";
const MANAGE_APPOINTMENT_LINK =
  "https://focalpointmassagetherapy.com/client-dashboard.html";

const availability = {
  1: { start: 10, end: 15 },
  2: { start: 10, end: 15 },
  3: { start: 11, end: 15 },
  4: { start: 10, end: 15 },
  5: { start: 11, end: 14 }
};

const bufferMinutes = 15;

let currentUser = null;

let selectedService = {
  name: "60 Minute Deep Tissue / Trigger Point",
  duration: 60
};

let selectedTime = null;
let selectedStartMinutes = null;
let currentDate = new Date();

const serviceButtons = document.querySelectorAll(".service-btn");
const timeSlotsDiv = document.getElementById("timeSlots");
const bookingDateInput = document.getElementById("bookingDate");
const bookingForm = document.getElementById("bookingForm");
const calendarGrid = document.getElementById("calendarGrid");
const calendarMonth = document.getElementById("calendarMonth");
const confirmationMessage = document.getElementById("confirmationMessage");

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatPhoneNumber(phone) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return phone;
}

function formatTime(hour, mins) {
  const displayHour = hour > 12 ? hour - 12 : hour;
  const ampm = hour >= 12 ? "PM" : "AM";

  return `${displayHour}:${mins.toString().padStart(2, "0")} ${ampm}`;
}

function parseAppointmentDateTime(dateString, timeString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const match = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return new Date(`${dateString} ${timeString}`);
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = match[3].toUpperCase();

  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  return new Date(year, month - 1, day, hour, minute);
}

function createGoogleCalendarLink(appointment) {
  const startDateTime = parseAppointmentDateTime(
    appointment.date,
    appointment.time
  );

  const endDateTime = new Date(
    startDateTime.getTime() + appointment.duration * 60000
  );

  const formatForGoogle = (date) =>
    date.toISOString().replace(/[-:]|\.\d{3}/g, "");

  const title = encodeURIComponent(
    `Focal Point Massage Therapy - ${appointment.service}`
  );

  const details = encodeURIComponent(
    `Your appointment with Focal Point Massage Therapy is confirmed.`
  );

  const location = encodeURIComponent("Focal Point Massage Therapy");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatForGoogle(
    startDateTime
  )}/${formatForGoogle(endDateTime)}&details=${details}&location=${location}`;
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs)
    )
  ]);
}

function selectServiceButton(btn) {
  if (!btn) return;

  document.querySelectorAll(".service-btn").forEach((button) => {
    button.classList.remove("active");
  });

  btn.classList.add("active");

  selectedService = {
    name: btn.dataset.service,
    duration: Number(btn.dataset.duration)
  };

  selectedTime = null;
  selectedStartMinutes = null;

  if (timeSlotsDiv) {
    timeSlotsDiv.innerHTML = "";
  }

  if (bookingDateInput && bookingDateInput.value) {
    generateTimeSlots();
  }
}

serviceButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectServiceButton(btn);
  });
});

const urlParams = new URLSearchParams(window.location.search);
const selectedDurationFromUrl = urlParams.get("duration") || "60";

let selectedButton = null;

serviceButtons.forEach((btn) => {
  if (btn.dataset.duration === selectedDurationFromUrl) {
    selectedButton = btn;
  }
});

if (selectedButton) {
  selectServiceButton(selectedButton);
} else if (serviceButtons.length > 0) {
  selectServiceButton(serviceButtons[0]);
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
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
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-31`;

  const q = query(
    collection(db, "appointments"),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    where("status", "==", "confirmed")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

async function getBlockedTimesForMonth(year, month) {
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-31`;

  const q = query(
    collection(db, "blockedTimes"),
    where("date", ">=", startDate),
    where("date", "<=", endDate)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

function dayHasOpenSlot(dateString, weekday, bookings, blockedTimes) {
  const dayAvailability = availability[weekday];

  if (!dayAvailability) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const calendarDate = new Date(dateString + "T12:00:00");

  if (calendarDate < today) {
    return false;
  }

  const { start, end } = dayAvailability;

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

        return overlaps(proposedStart, proposedEnd, bookedStart, bookedEnd);
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

async function prefillClientInfo(user) {
  try {
    const nameInput =
      document.getElementById("clientName") ||
      document.getElementById("name") ||
      document.querySelector('input[placeholder="Full Name"]');

    const emailInput =
      document.getElementById("clientEmail") ||
      document.getElementById("email") ||
      document.querySelector('input[type="email"]');

    const phoneInput =
      document.getElementById("clientPhone") ||
      document.getElementById("phone") ||
      document.querySelector('input[placeholder="Phone Number"]');

    if (emailInput && !emailInput.value && user.email) {
      emailInput.value = user.email;
    }

    const q = query(
      collection(db, "appointments"),
      where("userId", "==", user.uid)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    let latestAppointment = null;

    snapshot.docs.forEach((doc) => {
      const appointment = doc.data();

      if (!latestAppointment) {
        latestAppointment = appointment;
        return;
      }

      const currentCreatedAt = appointment.createdAt || "";
      const latestCreatedAt = latestAppointment.createdAt || "";

      if (currentCreatedAt > latestCreatedAt) {
        latestAppointment = appointment;
      }
    });

    if (!latestAppointment) return;

    if (nameInput && !nameInput.value) {
      nameInput.value = latestAppointment.name || "";
    }

    if (phoneInput && !phoneInput.value) {
      phoneInput.value = latestAppointment.phone || "";
    }

    if (emailInput && !emailInput.value) {
      emailInput.value =
        latestAppointment.clientEmail ||
        latestAppointment.email ||
        user.email ||
        "";
    }
  } catch (error) {
    console.error("Could not prefill client info:", error);
  }
}

async function renderCalendar() {
  if (!calendarGrid || !calendarMonth) return;

  calendarGrid.innerHTML = "";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  calendarMonth.textContent = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const bookings = await getAppointmentsForMonth(year, month);
  const blockedTimes = await getBlockedTimesForMonth(year, month);

  for (let i = 0; i < startDay; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-day empty";
    calendarGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateObj = new Date(year, month, day);
    const weekday = dateObj.getDay();

    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;

    const dayBookings = bookings.filter(
      (booking) => booking.date === dateString
    );

    const dayBlockedTimes = blockedTimes.filter(
      (block) => block.date === dateString
    );

    const dayDiv = document.createElement("button");
    dayDiv.type = "button";
    dayDiv.className = "calendar-day";
    dayDiv.textContent = day;

    const hasOpenSlot = dayHasOpenSlot(
      dateString,
      weekday,
      dayBookings,
      dayBlockedTimes
    );

    if (!hasOpenSlot) {
      dayDiv.classList.add("unavailable");
      dayDiv.disabled = true;
    } else {
      dayDiv.classList.add("available");

      dayDiv.addEventListener("click", () => {
        document.querySelectorAll(".calendar-day").forEach((cell) => {
          cell.classList.remove("selected");
        });

        dayDiv.classList.add("selected");

        bookingDateInput.value = dateString;
        selectedTime = null;
        selectedStartMinutes = null;

        generateTimeSlots();
      });
    }

    calendarGrid.appendChild(dayDiv);
  }
}

async function generateTimeSlots() {
  if (!timeSlotsDiv || !bookingDateInput) return;

  timeSlotsDiv.innerHTML = "";

  selectedTime = null;
  selectedStartMinutes = null;

  if (!bookingDateInput.value) return;

  const [selectedYear, selectedMonth, selectedDay] = bookingDateInput.value
    .split("-")
    .map(Number);

  const selectedDate = new Date(
    selectedYear,
    selectedMonth - 1,
    selectedDay
  );

  const day = selectedDate.getDay();

  if (!availability[day]) {
    timeSlotsDiv.innerHTML = "<p>No availability for this day.</p>";
    return;
  }

  const existingBookings = await getBookingsForDate(bookingDateInput.value);
  const blockedTimes = await getBlockedTimesForDate(bookingDateInput.value);

  const { start, end } = availability[day];

  let slotsCreated = 0;

  for (let hour = start; hour < end; hour++) {
    for (let mins of [0, 15, 30, 45]) {
      const proposedStart = hour * 60 + mins;

      const todayString = getLocalDateString();
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      if (
        bookingDateInput.value === todayString &&
        proposedStart <= currentMinutes
      ) {
        continue;
      }

      const proposedEnd =
        proposedStart + selectedService.duration + bufferMinutes;

      if (proposedEnd > end * 60) continue;

      const bookingConflict = existingBookings.some((booking) => {
        const bookedStart = booking.startMinutes;
        const bookedEnd =
          booking.startMinutes + booking.duration + bufferMinutes;

        return overlaps(proposedStart, proposedEnd, bookedStart, bookedEnd);
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

      const timeButton = document.createElement("button");
      timeButton.type = "button";
      timeButton.className = "time-slot";

      const displayTime = formatTime(hour, mins);
      timeButton.textContent = displayTime;

      timeButton.addEventListener("click", () => {
        document.querySelectorAll(".time-slot").forEach((button) => {
          button.classList.remove("selected");
        });

        timeButton.classList.add("selected");

        selectedTime = displayTime;
        selectedStartMinutes = proposedStart;
      });

      timeSlotsDiv.appendChild(timeButton);
      slotsCreated++;
    }
  }

  if (slotsCreated === 0) {
    timeSlotsDiv.innerHTML = "<p>No open times left for this date.</p>";
  }
}

const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");

if (prevMonthBtn) {
  prevMonthBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });
}

if (nextMonthBtn) {
  nextMonthBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });
}

const signOutBtn = document.getElementById("signOutBtn");

if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "client-login.html";
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "client-login.html";
    return;
  }

  currentUser = user;

  await renderCalendar();
  await prefillClientInfo(user);
});

let isBookingSubmitting = false;

if (bookingForm) {
  bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isBookingSubmitting) return;

    if (!currentUser) {
      alert("Please log in before booking.");
      window.location.href = "client-login.html";
      return;
    }

    if (!bookingDateInput.value || !selectedTime) {
      alert("Please select a date and time.");
      return;
    }

    const nameInput =
      document.getElementById("clientName") ||
      document.getElementById("name") ||
      document.querySelector('input[placeholder="Full Name"]');

    const emailInput =
      document.getElementById("clientEmail") ||
      document.getElementById("email") ||
      document.querySelector('input[type="email"]');

    const phoneInput =
      document.getElementById("clientPhone") ||
      document.getElementById("phone") ||
      document.querySelector('input[placeholder="Phone Number"]');

    const notesInput =
      document.getElementById("notes") ||
      document.querySelector("textarea");

    const cuppingAddonInput = document.getElementById("cuppingAddon");

    const name = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";
    const phone = phoneInput ? formatPhoneNumber(phoneInput.value.trim()) : "";
    const notes = notesInput ? notesInput.value.trim() : "";

    if (!name || !email || !phone) {
      alert("Please fill in your name, email, and phone number.");
      return;
    }

    const submitButton = bookingForm.querySelector(".submit-btn");

    isBookingSubmitting = true;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerText = "Booking...";
    }

    const appointmentData = {
      userId: currentUser.uid,
      name,
      email,
      clientEmail: email,
      phone,
      service: selectedService.name,
      duration: selectedService.duration,
      date: bookingDateInput.value,
      time: selectedTime,
      startMinutes: selectedStartMinutes,
      cuppingAddon: cuppingAddonInput ? cuppingAddonInput.checked : false,
      notes,
      status: "confirmed",
      reminderSent: false,
      reminderSentAt: null,
      createdAt: new Date().toISOString()
    };

    const googleCalendarLink = createGoogleCalendarLink(appointmentData);
    appointmentData.googleCalendarLink = googleCalendarLink;

    try {
      await addDoc(collection(db, "appointments"), appointmentData);

      const templateParams = {
        email: appointmentData.email,
        client_email: appointmentData.email,
        client_name: appointmentData.name,
        service: appointmentData.service,
        date: appointmentData.date,
        time: appointmentData.time,
        phone: appointmentData.phone,
        notes: appointmentData.notes || "None",
        cupping: appointmentData.cuppingAddon ? "Yes" : "No",
        google_calendar_link: googleCalendarLink,
        manage_link: MANAGE_APPOINTMENT_LINK
      };

      try {
        await withTimeout(
          emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams
          ),
          12000,
          "Client confirmation email"
        );
      } catch (emailError) {
        console.warn("Client confirmation email did not send:", emailError);
      }

      try {
        await withTimeout(
          emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            ...templateParams,
            email: BUSINESS_EMAIL
          }),
          12000,
          "Business confirmation email"
        );
      } catch (businessEmailError) {
        console.warn(
          "Business confirmation email did not send:",
          businessEmailError
        );
      }

      sessionStorage.setItem("confirmedService", appointmentData.service);
      sessionStorage.setItem("confirmedDate", appointmentData.date);
      sessionStorage.setItem("confirmedTime", appointmentData.time);
      sessionStorage.setItem(
        "confirmedCupping",
        appointmentData.cuppingAddon ? "Yes" : "No"
      );
      sessionStorage.setItem("confirmedGoogleCalendarLink", googleCalendarLink);

      window.location.href = "confirmation.html";
    } catch (error) {
      console.error("Booking failed:", error);
      alert(`Booking failed: ${error.message}`);

      isBookingSubmitting = false;

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerText = "Book Appointment";
      }
    }
  });
}

