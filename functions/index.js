
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} = require("firebase-functions/v2/firestore");

const { onRequest } = require("firebase-functions/v2/https");

const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");
const { google } = require("googleapis");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const fetch = require("node-fetch");
const { defineSecret } = require("firebase-functions/params");
const TELNYX_API_KEY = defineSecret("TELNYX_API_KEY");

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

function getChicagoDateString(daysAhead = 0) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(
    parts.find((part) => part.type === "year").value
  );
  const month = Number(
    parts.find((part) => part.type === "month").value
  );
  const day = Number(
    parts.find((part) => part.type === "day").value
  );

  const targetDate = new Date(
    Date.UTC(year, month - 1, day + daysAhead)
  );

  return targetDate.toISOString().split("T")[0];
}

exports.sendAppointmentReminders = onSchedule(
  {
    schedule: "every day 9:00",
    timeZone: "America/Chicago",
    secrets: [TELNYX_API_KEY],
  },

  async () => {
    const tomorrowString = getChicagoDateString(1);

    console.log("Looking for appointments on:", tomorrowString);

    try {
      // Querying only by date avoids a possible compound-index problem.
    const snapshot = await admin
     .firestore()
     .collection("appointments")
     .get();

    console.log("Total appointments found:", snapshot.size);

    const tomorrowAppointments = snapshot.docs.filter((doc) => {
     const appointment = doc.data();

     console.log("Appointment date check:", {
     id: doc.id,
     date: appointment.date,
     status: appointment.status,
     email: appointment.email,
     reminderSent: appointment.reminderSent,
    });

  return appointment.date === tomorrowString;
});

console.log("Appointments for tomorrow:", tomorrowAppointments.length);

if (tomorrowAppointments.length === 0) {
  console.log("No appointments found for tomorrow.");
  return;
}

for (const doc of tomorrowAppointments) {
  const appointment = doc.data();

        console.log("Checking appointment:", {
          id: doc.id,
          date: appointment.date,
          status: appointment.status,
          email: appointment.email,
          reminderSent: appointment.reminderSent,
        });

        if (appointment.status !== "confirmed") {
          console.log("Skipping because status is not confirmed.");
          continue;
        }

        if (appointment.reminderSent === true) {
          console.log("Reminder already sent. Skipping.");
          continue;
        }

        if (!appointment.clientEmail && !appointment.email) {
          console.log("No client email. Skipping.");
          continue;
        }

  try {
    const recipientEmail = appointment.clientEmail || appointment.email;

    const response = await fetch(
      "https://api.emailjs.com/api/v1.0/email/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_id: "service_l51ekpl",
          template_id: "template_4l5qpcb",
          user_id: "geVjfrV3JuXFSSv4d",

          template_params: {
            email: recipientEmail,
            client_email: recipientEmail,
            client_name: appointment.name,
            service: appointment.service,
            date: appointment.date,
            time: appointment.time,
            phone: appointment.phone || "",
            notes: appointment.notes || "",
            cupping: appointment.cuppingAddon ? "Yes" : "No",
          },
      }),
    }
  );

    const resultText = await response.text();

    console.log("EmailJS status:", response.status);
    console.log("EmailJS response:", resultText);

    if (!response.ok) {
      throw new Error(
        `EmailJS failed: ${response.status} ${resultText}`
      );
    }

    if (!response.ok) {
      throw new Error(
        `EmailJS failed: ${response.status} ${resultText}`
      );
    }

    const rawPhone =
  appointment.clientPhone ||
  appointment.phone ||
  "";

const phoneDigits = rawPhone.replace(/\D/g, "");

let formattedPhone = "";

if (phoneDigits.length === 10) {
  formattedPhone = `+1${phoneDigits}`;
} else if (
  phoneDigits.length === 11 &&
  phoneDigits.startsWith("1")
) {
  formattedPhone = `+${phoneDigits}`;
}

if (formattedPhone) {
  const telnyxResponse = await fetch(
    "https://api.telnyx.com/v2/messages",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "+14322458690",
        to: formattedPhone,
        text:
          `Focal Point Massage Therapy: Hi ${appointment.name || ""}, ` +
          `this is a reminder of your appointment tomorrow at ${appointment.time}. ` +
          `To cancel or reschedule, please sign into your Client Booking Portal.`,
      }),
    }
  );

  const telnyxResult = await telnyxResponse.json();

  if (!telnyxResponse.ok) {
    console.error("Telnyx SMS failed:", telnyxResult);

    throw new Error(
      telnyxResult?.errors?.[0]?.detail ||
      "Telnyx SMS failed"
    );
  }

  console.log(
    "Telnyx reminder sent:",
    telnyxResult.data?.id
  );
} else {
  console.log(
    `No valid phone number for appointment ${doc.id}. Email sent only.`
  );
}

    await doc.ref.update({
      reminderSent: true,
      reminderSentAt: FieldValue.serverTimestamp(),
    });

    console.log("Reminder successfully sent to:", recipientEmail);
        } catch (error) {
        console.error(
          `Reminder failed for appointment ${doc.id}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error("Appointment query failed:", error);
  }
}
);
// ======================================================
// GOOGLE CALENDAR -> FIRESTORE SYNC
// ======================================================
function timeStringToMinutes(timeString) {
  const [hourMinute, ampm] = timeString.split(" ");
  let [hour, minute] = hourMinute.split(":").map(Number);

  if (ampm === "PM" && hour !== 12) {
    hour += 12;
  }

  if (ampm === "AM" && hour === 12) {
    hour = 0;
  }

  return hour * 60 + minute;
}

function googleBlockDocId(googleEventId) {
  return `google_${googleEventId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function googleEventToAppointmentTime(googleEvent) {
  if (!googleEvent.start?.dateTime || !googleEvent.end?.dateTime) {
    return null;
  }

  const start = new Date(googleEvent.start.dateTime);
  const end = new Date(googleEvent.end.dateTime);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(start);

  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value;

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");

  let hour = getPart("hour");
  const minute = getPart("minute");
  const dayPeriod = getPart("dayPeriod");

  // Your website stores time like "10:00 AM"
  const time = `${hour}:${minute} ${dayPeriod}`;

  const date = `${year}-${month}-${day}`;

  const duration = Math.round(
    (end.getTime() - start.getTime()) / 60000
  );

  return {
    date,
    time,
    duration,
  };
}


exports.googleCalendarWebhook = onRequest(
  {
    serviceAccount:
      "focal-point-scheduler@appspot.gserviceaccount.com",
  },

  async (req, res) => {
    try {
      // Google sends a special "sync" notification
      // when the watch connection is first created.
      const resourceState =
        req.headers["x-goog-resource-state"];

      console.log(
        "Google Calendar webhook received:",
        resourceState
      );

      if (resourceState === "sync") {
        console.log(
          "Google Calendar watch successfully connected."
        );

        res.status(200).send("Sync received.");
        return;
      }

      await getAuthClient();

      const db = getFirestore();

      // Remember the last time we checked Google Calendar.
      const syncRef = db
        .collection("system")
        .doc("googleCalendarSync");

      const syncDoc = await syncRef.get();

      let updatedMin;

      if (syncDoc.exists && syncDoc.data().lastCheckedAt) {
        const lastChecked =
          syncDoc.data().lastCheckedAt.toDate();

        // Back up two minutes in case notifications overlap
        // or arrive slightly late.
        updatedMin = new Date(
          lastChecked.getTime() - 2 * 60 * 1000
        ).toISOString();
      } else {
        // First run: look back 24 hours.
        updatedMin = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString();
      }

      console.log(
        "Checking Google events updated since:",
        updatedMin
      );

      const response =
        await calendar.events.list({
          calendarId: "sandersonlaurie1@gmail.com",
          updatedMin,
          showDeleted: true,
          singleEvents: true,
          maxResults: 250,
        });

      const events = response.data.items || [];

      console.log(
        "Recently changed Google events:",
        events.length
      );

      for (const googleEvent of events) {
        if (!googleEvent.id) {
          continue;
        }

        // Find the Firestore appointment connected
        // to this exact Google Calendar event.
        const appointmentSnapshot =
          await db
            .collection("appointments")
            .where(
              "googleCalendarEventId",
              "==",
              googleEvent.id
            )
            .limit(1)
            .get();

        // No matching website appointment means this was
// created manually in Apple/Google Calendar.
if (appointmentSnapshot.empty) {

  const blockRef = db
    .collection("blockedTimes")
    .doc(googleBlockDocId(googleEvent.id));

  // If the calendar event was deleted,
  // remove the blocked time from the website.
  if (googleEvent.status === "cancelled") {

    await blockRef.delete().catch(() => {});

    console.log(
      "Removed blocked time for deleted Google event:",
      googleEvent.id
    );

    continue;
  }

  const googleTime =
    googleEventToAppointmentTime(googleEvent);

  // Ignore all-day events for now.
  if (!googleTime) {

    console.log(
      "Skipping all-day/non-timed Google event:",
      googleEvent.summary || googleEvent.id
    );

    continue;
  }

  const startMinutes =
    timeStringToMinutes(googleTime.time);

  const endMinutes =
    startMinutes + googleTime.duration + 30;

  await blockRef.set(
    {
      date: googleTime.date,
      startMinutes: startMinutes,
      endMinutes: endMinutes,

      googleCalendarEventId:
        googleEvent.id,

      source: "googleCalendar",

      title:
        googleEvent.summary ||
        "Calendar Block",

      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  console.log(
    "Blocked website availability from Google event:",
    {
      date: googleTime.date,
      startMinutes: startMinutes,
      endMinutes: endMinutes,
    }
  );

  continue;
}

        const appointmentDoc =
          appointmentSnapshot.docs[0];

        const appointment =
          appointmentDoc.data();

        // We'll handle Google deletions separately.
        if (googleEvent.status === "cancelled") {
          console.log(
            "Google event was cancelled:",
            googleEvent.id
          );

          continue;
        }

        const googleTime =
          googleEventToAppointmentTime(
            googleEvent
          );

        // Skip all-day events.
        if (!googleTime) {
          console.log(
            "Skipping non-timed Google event:",
            googleEvent.id
          );

          continue;
        }

        console.log(
          "Comparing Google event:",
          {
            googleEventId: googleEvent.id,
            firestoreDate: appointment.date,
            googleDate: googleTime.date,
            firestoreTime: appointment.time,
            googleTime: googleTime.time,
            firestoreDuration:
              appointment.duration,
            googleDuration:
              googleTime.duration,
          }
        );

        // VERY IMPORTANT:
        // Only write to Firestore if Google actually
        // contains different scheduling information.
        //
        // This prevents:
        // Google -> Firestore -> Google -> Firestore
        // from becoming an endless loop.
        const changed =
          appointment.date !==
            googleTime.date ||
          appointment.time !==
            googleTime.time ||
          Number(appointment.duration) !==
            googleTime.duration;

        if (!changed) {
          console.log(
            "Appointment already matches Google."
          );

          continue;
        }

        await appointmentDoc.ref.update({
  date: googleTime.date,
  time: googleTime.time,
  duration: googleTime.duration,
  startMinutes:
    timeStringToMinutes(googleTime.time),
  lastGoogleCalendarSync:
    FieldValue.serverTimestamp(),
});

        console.log(
          "Firestore appointment updated from Google:",
          appointmentDoc.id
        );
      }

      await syncRef.set(
        {
          lastCheckedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      res.status(200).send(
        "Google Calendar changes processed."
      );
    } catch (error) {
      console.error(
        "Google Calendar webhook error:",
        error
      );

      res.status(500).send(
        "Calendar sync failed."
      );
    }
  }
);

// ======================================================
// START GOOGLE CALENDAR WATCH
// ======================================================

exports.startGoogleCalendarWatch = onRequest(
  {
    serviceAccount:
      "focal-point-scheduler@appspot.gserviceaccount.com",
  },

  async (req, res) => {
    try {
      await getAuthClient();

      const channelId =
        `focal-point-${Date.now()}`;

      const response =
        await calendar.events.watch({
          calendarId:
            "sandersonlaurie1@gmail.com",

          resource: {
            id: channelId,
            type: "web_hook",
            address:
              "https://us-central1-focal-point-scheduler.cloudfunctions.net/googleCalendarWebhook",
          },
        });

      console.log(
        "Google Calendar watch created:",
        response.data
      );

      res.status(200).json({
        success: true,
        channelId:
          response.data.id,
        resourceId:
          response.data.resourceId,
        expiration:
          response.data.expiration,
      });
    } catch (error) {
      console.error(
        "Failed to create calendar watch:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error.message,
      });
    }
  }
);