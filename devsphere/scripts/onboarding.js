/* ==========================================================================
   DevSphere — Onboarding Wizard
   Handles step switching, progress bar updates, role & workspace selection.
   No data persists — this is a UI demonstration.
   ========================================================================== */

(function () {
  "use strict";

  const wizard = document.querySelector(".ob-wizard");
  if (!wizard) return;

  const steps = ["role", "details", "workspace", "tools", "finish"];
  let currentIndex = 0;

  /* ---------- Show a step ---------- */
  function showStep(name) {
    const index = steps.indexOf(name);
    if (index === -1) return;
    currentIndex = index;

    // Toggle panels
    wizard.querySelectorAll(".ob-step-panel").forEach((panel) => {
      panel.hidden = panel.dataset.step !== name;
    });

    // Update progress bar (Account is step 0, always "done")
    wizard.querySelectorAll(".ob-progress .ob-step").forEach((el, i) => {
      el.classList.remove("ob-step--active", "ob-step--done");
      el.removeAttribute("aria-current");

      if (i === 0) {
        el.classList.add("ob-step--done");
      } else if (i - 1 < currentIndex) {
        el.classList.add("ob-step--done");
        el.querySelector(".ob-step__num").innerHTML =
          '<i class="fa-solid fa-check" style="font-size:9px;"></i>';
      } else if (i - 1 === currentIndex) {
        el.classList.add("ob-step--active");
        el.setAttribute("aria-current", "step");
        el.querySelector(".ob-step__num").textContent = i + 1;
      } else {
        el.querySelector(".ob-step__num").textContent = i + 1;
      }
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- Advance / back ---------- */
  wizard.addEventListener("click", (e) => {
    if (e.target.closest("[data-wizard-next]")) {
      if (currentIndex < steps.length - 1) {
        showStep(steps[currentIndex + 1]);
      }
      return;
    }

    const back = e.target.closest("[data-wizard-back]");
    if (back) {
      e.preventDefault();
      const targetStep = back.dataset.targetStep;
      if (targetStep) {
        showStep(targetStep);
      } else if (currentIndex > 0) {
        showStep(steps[currentIndex - 1]);
      }
    }
  });

  /* ---------- Role selection ---------- */
  const roleLabels = {
    Student:
      "You'll get a learning-focused dashboard with courses, assignments, and study groups.",
    "Software developer":
      "You'll get repositories, tasks, docs, and code editor tools.",
    Freelancer:
      "You'll get clients, invoices, deadlines, and project tracking.",
    Designer: "You'll get design systems, handoff, and feedback tools.",
    "Team member":
      "You'll get shared projects, messaging, and task coordination.",
    "Team leader":
      "You'll get team workload, capacity, and delivery tools by default.",
    "Business owner": "You'll get CRM, revenue, and customer management tools.",
    Educator:
      "You'll get classes, assignments, and learning material organization.",
    Researcher: "You'll get notes, references, and research planning tools.",
    "Content creator":
      "You'll get content planning, deliverables, and calendar tools.",
    Organization: "You'll get multi-team workspace and administration tools.",
    "Something else": "We'll ask a couple more questions in the next step.",
  };
  const roleIconMap = {
    Student: "fa-graduation-cap",
    "Software developer": "fa-code",
    Freelancer: "fa-briefcase",
    Designer: "fa-pen-ruler",
    "Team member": "fa-users",
    "Team leader": "fa-user-tie",
    "Business owner": "fa-building",
    Educator: "fa-chalkboard-user",
    Researcher: "fa-flask",
    "Content creator": "fa-podcast",
    Organization: "fa-sitemap",
    "Something else": "fa-ellipsis",
  };

  wizard.querySelectorAll(".ob-role").forEach((card) => {
    card.addEventListener("click", () => {
      wizard.querySelectorAll(".ob-role").forEach((c) => {
        c.classList.remove("ob-role--active");
        c.setAttribute("aria-checked", "false");
      });
      card.classList.add("ob-role--active");
      card.setAttribute("aria-checked", "true");

      const name = card.querySelector(".ob-role__name").textContent.trim();
      const summaryName = wizard.querySelector(".ob-selected__body strong");
      const summaryDesc = wizard.querySelector(".ob-selected__body span");
      const summaryIcon = wizard.querySelector(".ob-selected__icon i");
      if (summaryName) summaryName.textContent = name;
      if (summaryDesc) summaryDesc.textContent = roleLabels[name] || "";
      if (summaryIcon)
        summaryIcon.className = "fa-solid " + (roleIconMap[name] || "fa-user");
    });
  });

  /* ---------- Workspace selection ---------- */
  wizard.querySelectorAll(".ob-workspace").forEach((card) => {
    card.addEventListener("click", () => {
      wizard.querySelectorAll(".ob-workspace").forEach((c) => {
        c.classList.remove("ob-workspace--active");
        c.setAttribute("aria-checked", "false");
      });
      card.classList.add("ob-workspace--active");
      card.setAttribute("aria-checked", "true");
    });
  });

  /* ---------- Tool toggles ---------- */
  wizard.querySelectorAll(".ob-tool input").forEach((input) => {
    input.addEventListener("change", () => {
      const tool = input.closest(".ob-tool");
      if (tool) tool.classList.toggle("ob-tool--on", input.checked);
      updateToolCount();
    });
  });

  function updateToolCount() {
    const total = wizard.querySelectorAll(".ob-tool input").length;
    const selected = wizard.querySelectorAll(".ob-tool input:checked").length;
    const meta = wizard.querySelector('[data-step="tools"] .ob-actions__meta');
    if (meta) meta.textContent = `${selected} of ${total} tools selected`;
  }

  /* ---------- Initialise ---------- */
  showStep("role");
})();
