// Update footer year (only if #year exists)
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");

  console.log("nav btn:", toggle, "menu:", navLinks);

  if (toggle && navLinks) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();

      const isOpen = navLinks.classList.toggle("open");
      toggle.classList.toggle("is-open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    // Close menu when clicking a link
    navLinks.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        navLinks.classList.remove("open");
        toggle.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!navLinks.contains(e.target) && !toggle.contains(e.target)) {
        navLinks.classList.remove("open");
        toggle.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }
});
  // Simple mailto form (no backend needed)
  const form = document.getElementById("requestForm");
  if (form) {
    form.addEventListener("submit", (e) => {
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

      const to = "sandersonlaurie1@gmail.com";
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    });
  }
// Close mobile nav after tapping a link
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    const nav = document.querySelector('.nav');               // your nav container
    const navLinks = document.querySelector('.nav-links');    // the dropdown panel
    const toggle = document.querySelector('.nav-toggle');     // hamburger button

    // Only do this if your menu is currently open
    navLinks?.classList.remove('open');
    nav?.classList.remove('open');
    toggle?.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  });
});

