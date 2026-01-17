// Update footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Mobile nav
const toggle = document.querySelector(".nav-toggle");

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("primaryNav");

  if (!toggle || !nav) return;

  // Start closed on mobile
  toggle.setAttribute("aria-expanded", "false");
  nav.classList.remove("open");

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Optional: close menu when a link is clicked (mobile)
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
});


toggle?.addEventListener("click", () => {
  const isOpen = links.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(isOpen));
});

// Simple mailto form (no backend needed)
const form = document.getElementById("requestForm");
form?.addEventListener("submit", (e) => {
  e.preventDefault();

  const data = new FormData(form);
  const name = data.get("name");
  const phone = data.get("phone");
  const when = data.get("when");
  const details = data.get("details");

  const subject = encodeURIComponent("Appointment Request — Focal Point Massage Therapy");
  const body = encodeURIComponent(
`Name: ${name}
Phone: ${phone || "N/A"}
Preferred day/time: ${when}

Details:
${details}

— Sent from the website`
  );

  // Change this email to your real one
  const to = "hello@focalpointmassage.com";
  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
});
