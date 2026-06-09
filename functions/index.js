const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} = require("firebase-functions/v2/firestore");

const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { google } = require("googleapis");

admin.initializeApp();

setGlobalOptions({
  maxInstances: 10,
});

const calendar = google.calendar("v3");

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const authClient = await auth.getClient();

  google.options({
    auth: authClient,
  });
}

function getEventTimes(appointment) {
  const [hourMinute, ampm] =
    appointment.time.split(" ");

  let [hour, minute] =
    hourMinute.split(":").map(Number);

  if (ampm === "PM" && hour !== 12) {
    hour += 12;
  }

  if (ampm === "AM" && hour === 12) {
    hour = 0;
  }

  const startDateTime =
    `${appointment.date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;

  const endMinutes =
    hour * 60 + minute + appointment.duration;

  const endHour =
    Math.floor(endMinutes / 60);

  const endMinute =
    endMinutes % 60;

  const endDateTime =
    `${appointment.date}T${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}:00`;

  return {
    start: startDateTime,
    end: endDateTime,
  };
}

function buildCalendarEvent(appointment) {
  const times = getEventTimes(appointment);

  return {
    summary: `${appointment.service} - ${appointment.name}`,

    description: `
    Client: ${appointment.name}

    Phone:
    ${appointment.phone || "N/A"}

    Email:
    ${appointment.email}

    Cupping Add-On:
    ${appointment.cuppingAddon ? "Yes" : "No"}

    Notes:
    ${appointment.notes || "None"}
    `,

    start: {
      dateTime: times.start,
      timeZone: "America/Chicago",
    },

    end: {
      dateTime: times.end,
      timeZone: "America/Chicago",
    },
  };
}

exports.createCalendarEvent = onDocumentCreated(
  {
    document: "appointments/{appointmentId}",
     serviceAccount:
      "focal-point-scheduler@appspot.gserviceaccount.com",
  },

  async (event) => {
    const snap = event.data;

    if (!snap) {
      console.log("No appointment data.");
      return;
    }

    const appointment = snap.data();

    try {
      await getAuthClient();

      const calendarEvent =
        buildCalendarEvent(appointment);

      const response =
        await calendar.events.insert({
          calendarId: "sandersonlaurie1@gmail.com",
          resource: calendarEvent,
        });

      console.log(
        "Calendar event created:",
        response.data.htmlLink
      );

    await snap.ref.update({
     googleCalendarEventId: response.data.id,
     googleCalendarEventLink: response.data.htmlLink,
    });

    } catch (error) {
      console.error(
        "Calendar creation failed:",
        error
      );
    }
  }
);

exports.updateCalendarEvent = onDocumentUpdated(
  {
    document: "appointments/{appointmentId}",
    serviceAccount: "focal-point-scheduler@appspot.gserviceaccount.com",
  },

  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Skip the automatic update that happens right after
    // createCalendarEvent saves googleCalendarEventId.
    if (before.googleCalendarEventId !== after.googleCalendarEventId) {
      console.log("Only Google Calendar event ID changed. Skipping update.");
      return;
    }

    if (!after.googleCalendarEventId) {
      console.log("No Google Calendar event ID found.");
      return;
    }

    const changed =
      before.date !== after.date ||
      before.time !== after.time ||
      before.duration !== after.duration ||
      before.cuppingAddon !== after.cuppingAddon ||
      before.service !== after.service ||
      before.startMinutes !== after.startMinutes ||
      before.notes !== after.notes;

    if (!changed) {
      console.log("No calendar-related changes.");
      return;
    }

    try {
      await getAuthClient();

      const updatedEvent = buildCalendarEvent(after);

      console.log("Updating event:", after.googleCalendarEventId);
      console.log("Calendar:", "sandersonlaurie1@gmail.com");

      await calendar.events.patch({
        calendarId: "sandersonlaurie1@gmail.com",
        eventId: after.googleCalendarEventId,
        resource: updatedEvent,
      });

      console.log("Calendar event patched successfully.");

    } catch (error) {
      console.error("Calendar patch failed:", error);
    }
  }
);
exports.deleteCalendarEvent = onDocumentDeleted(
  {
    document: "appointments/{appointmentId}",
    serviceAccount: "focal-point-scheduler@appspot.gserviceaccount.com",
  },

  async (event) => {
    const appointment = event.data.data();

    if (!appointment.googleCalendarEventId) {
      console.log("No Google Calendar event ID found for deleted appointment.");
      return;
    }

    try {
      await getAuthClient();

      await calendar.events.delete({
        calendarId: "sandersonlaurie1@gmail.com",
        eventId: appointment.googleCalendarEventId,
      });

      console.log("Calendar event deleted successfully.");

    } catch (error) {
      console.error("Calendar delete failed:", error);
    }
  }
);
