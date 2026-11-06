/* ==========================================================================
   DevSphere — Application Shell Interactions (Phase 2)
   Minimal JS: theme toggle, drawer toggles, dropdown coordination.
   All shell state is stored in <body> classes so CSS handles layout.
   ========================================================================== */

(function () {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const backdrop = document.querySelector(".app-backdrop");

  /* ---------- Theme ---------- */
  const storedTheme = localStorage.getItem("ds-theme");
  if (storedTheme === "dark" || storedTheme === "light") {
    root.setAttribute("data-theme", storedTheme);
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    root.setAttribute("data-theme", "dark");
  }
  syncThemeIcons();

  document.querySelectorAll('[data-action="toggle-theme"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const next =
        root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("ds-theme", next);
      syncThemeIcons();
    });
  });

  function syncThemeIcons() {
    const isDark = root.getAttribute("data-theme") === "dark";
    document.querySelectorAll('[data-action="toggle-theme"]').forEach((btn) => {
      btn.setAttribute("aria-pressed", isDark ? "true" : "false");
      const icon = btn.querySelector("i");
      if (icon) {
        icon.className = isDark ? "fa-regular fa-sun" : "fa-regular fa-moon";
      }
    });
  }

  /* ---------- Sidebar / Right panel toggles ---------- */
  document.querySelectorAll('[data-action="toggle-sidebar"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 1023px)").matches) {
        body.classList.toggle("is-sidebar-open");
      } else {
        body.classList.toggle("is-sidebar-collapsed");
      }
      updateBackdrop();
      btn.setAttribute(
        "aria-expanded",
        body.classList.contains("is-sidebar-open") ? "true" : "false",
      );
    });
  });

  document.querySelectorAll('[data-action="toggle-right"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 1200px)").matches) {
        body.classList.toggle("is-right-open");
      } else {
        body.classList.toggle("is-right-closed");
      }
      updateBackdrop();
      btn.setAttribute(
        "aria-expanded",
        body.classList.contains("is-right-open") ? "true" : "false",
      );
    });
  });

  /* ---------- Backdrop ---------- */
  if (backdrop) {
    backdrop.addEventListener("click", closeDrawers);
  }
  document.querySelectorAll('[data-action="close-drawer"]').forEach((el) => {
    el.addEventListener("click", closeDrawers);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawers();
  });

  function closeDrawers() {
    body.classList.remove("is-sidebar-open", "is-right-open");
    updateBackdrop();
  }

  function updateBackdrop() {
    if (!backdrop) return;
    const isOpen =
      body.classList.contains("is-sidebar-open") ||
      body.classList.contains("is-right-open");
    backdrop.classList.toggle("is-visible", isOpen);
  }

  /* ---------- Close dropdowns when another opens ---------- */
  const dropdowns = document.querySelectorAll("details.dropdown");
  dropdowns.forEach((dd) => {
    dd.addEventListener("toggle", () => {
      if (dd.open) {
        dropdowns.forEach((other) => {
          if (other !== dd) other.open = false;
        });
      }
    });
  });

  /* ---------- Task row selection (visual only) ---------- */
  document.querySelectorAll(".task-row[data-task]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".task-row__check")) return;
      document
        .querySelectorAll(".task-row")
        .forEach((r) => r.classList.remove("task-row--selected"));
      row.classList.add("task-row--selected");
    });
  });

  /* ---------- Task completion toggle (visual only) ---------- */
  document.querySelectorAll(".task-row__check").forEach((check) => {
    check.addEventListener("click", (e) => {
      e.stopPropagation();
      const row = check.closest(".task-row");
      if (row) row.classList.toggle("task-row--done");
    });
  });

  document.querySelectorAll(".focus-item__check").forEach((check) => {
    check.addEventListener("click", () => {
      const item = check.closest(".focus-item");
      if (item) item.classList.toggle("focus-item--done");
    });
  });

  /* ---------- Mobile panel toggles (messenger, ai assistant) ---------- */
  document.querySelectorAll('[data-action="toggle-thread"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const container = btn.closest(".messenger");
      if (container) container.classList.toggle("is-thread-open");
    });
  });

  document.querySelectorAll('[data-action="toggle-history"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const container = btn.closest(".ai-assistant");
      if (container) container.classList.toggle("is-history-open");
    });
  });

  /* ---------- AI typing indicator demo: hide after 3s ---------- */
  const typing = document.querySelector(".typing-indicator");
  if (typing) {
    setTimeout(() => {
      typing.style.display = "none";
    }, 3000);
  }

  /* ---------- Right-panel tabs (whiteboard, others) ---------- */
  document.querySelectorAll("[data-rp-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const group = tab.closest("[data-rp-tabs]");
      if (!group) return;
      group.querySelectorAll("[data-rp-tab]").forEach((t) => {
        t.classList.toggle("is-active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      const target = tab.dataset.rpTab;
      document.querySelectorAll("[data-rp-panel]").forEach((p) => {
        p.hidden = p.dataset.rpPanel !== target;
      });
    });
  });

  /* ---------- Whiteboard: item comment badge → select + open Comments tab ---------- */
  document.querySelectorAll(".wb-object__comments").forEach((badge) => {
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      const obj = badge.closest(".wb-object");
      document
        .querySelectorAll(".wb-object")
        .forEach((o) => o.classList.remove("is-selected"));
      obj?.classList.add("is-selected");
      const commentsTab = document.querySelector('[data-rp-tab="comments"]');
      if (commentsTab) commentsTab.click();
    });
  });

  /* ---------- Whiteboard canvas: click object → select, show Properties ---------- */
  document.querySelectorAll(".wb-object").forEach((obj) => {
    obj.addEventListener("click", (e) => {
      if (e.target.closest(".wb-object__comments")) return;
      document
        .querySelectorAll(".wb-object")
        .forEach((o) => o.classList.remove("is-selected"));
      obj.classList.add("is-selected");
      const propsTab = document.querySelector('[data-rp-tab="properties"]');
      if (propsTab) propsTab.click();
    });
  });

  /* ---------- All comments drawer ---------- */
  document
    .querySelectorAll('[data-action="open-all-comments"]')
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const el = document.getElementById("allComments");
        el?.classList.add("is-open");
        el?.setAttribute("aria-hidden", "false");
        document.body.classList.add("is-right-open");
      });
    });
  document
    .querySelectorAll('[data-action="close-all-comments"]')
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const el = document.getElementById("allComments");
        el?.classList.remove("is-open");
        el?.setAttribute("aria-hidden", "true");
        document.body.classList.remove("is-right-open");
      });
    });
})();
