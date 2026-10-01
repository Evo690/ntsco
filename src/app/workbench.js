/* Shared presentation and progressive disclosure; domain controls stay in their tool. */
(() => {
  const root = document.body;
  const updateBrowserColor = () => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
    meta.content = getComputedStyle(root).getPropertyValue('--bg').trim();
  };
  new MutationObserver(updateBrowserColor).observe(root, {attributes:true,attributeFilter:['class']});
  updateBrowserColor();
  if (root.dataset.tool === 'attempt-test') {
    const setupDialogs = ['modal-passcode-lock','modal-launcher','modal-instructions'].map(id => document.getElementById(id)).filter(Boolean);
    const syncPreparation = () => root.classList.toggle('is-preparing', setupDialogs.some(el => el.style.display !== 'none'));
    const preparationObserver = new MutationObserver(syncPreparation);
    setupDialogs.forEach(el => preparationObserver.observe(el,{attributes:true,attributeFilter:['style']}));
    syncPreparation();
  }
  const home = "../index.html?module=settings&panel=functions";
  window.returnToConsole = () => {
    if (
      root.dataset.tool === "attempt-test" &&
      typeof window.exitExam === "function"
    ) {
      window.exitExam();
      return;
    }
    if (window.opener) {
      window.close();
      setTimeout(() => {
        location.href = home;
      }, 100);
    } else location.href = home;
  };
  document
    .querySelectorAll("[data-workbench-return], .tool-back")
    .forEach((link) =>
      link.addEventListener("click", (event) => {
        if (
          root.dataset.tool === "attempt-test" &&
          typeof window.exitExam === "function"
        ) {
          event.preventDefault();
          window.exitExam();
        }
      }),
    );
  document.querySelector(".tool-theme")?.addEventListener("click", () => {
    const light = root.classList.toggle("light-mode");
    let id = "";
    if (typeof getCurrentUserId === "function") id = getCurrentUserId();
    else {
      const name = sessionStorage.getItem("fy_user_name")?.trim();
      const user = sessionStorage.getItem("fy_logged_in_user")?.trim() || "";
      id =
        name && name !== "Student"
          ? name
          : root.dataset.tool === "attempt-test" ||
              !/^\+?[0-9\s\-]{8,15}$/.test(user)
            ? user
            : "";
    }
    const cleanId = id ? String(id).replace(/[^a-zA-Z0-9_]/g, "_") : "";
    localStorage.setItem(
      cleanId ? `fy_theme_mode_${cleanId}` : "fy_theme_mode",
      light ? "light" : "dark",
    );
  });
  document
    .querySelectorAll("input:not([aria-label]), select:not([aria-label])")
    .forEach((input) => {
      if (
        input.type === "hidden" ||
        (input.id && document.querySelector(`label[for="${input.id}"]`))
      )
        return;
      const label =
        input.closest(".toggle-item")?.querySelector(".toggle-label")
          ?.textContent ||
        input.placeholder ||
        input.id.replace(/[-_]/g, " ");
      if (label) input.setAttribute("aria-label", label.trim());
    });
  function enhanceControls() {
    document
      .querySelectorAll(
        ".year-pill, .format-card, .batch-item, .test-item, .schedule-item, .recent-item",
      )
      .forEach((element) => {
        if (element.matches("button,a") || element.dataset.keyboardReady)
          return;
        element.dataset.keyboardReady = "true";
        element.tabIndex = 0;
        element.setAttribute("role", "button");
        element.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            element.click();
          }
        });
      });
  }
  enhanceControls();
  new MutationObserver(enhanceControls).observe(root, {
    childList: true,
    subtree: true,
  });
  // Collection pickers are now inline, at every viewport width.
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.inert = false;
  const sheet = document.getElementById("test-detail-dialog");
  sheet?.addEventListener("click", (event) => {
    if (event.target !== sheet) return;
    const rect = sheet.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      sheet.close();
  });
  sheet?.addEventListener("close", () =>
    document.querySelector(".test-item-card.active")?.focus(),
  );
  if (root.dataset.tool !== "download-tests") return;
  const steps = [...document.querySelectorAll("[data-export-step]")];
  const panels = [...document.querySelectorAll("[data-export-panel]")];
  let current = 0;
  function goToStep(step) {
    current = Math.max(0, Math.min(2, step));
    steps.forEach((button, i) =>
      button.setAttribute("aria-current", i === current ? "step" : "false"),
    );
    panels.forEach((panel, i) => {
      panel.hidden = i !== current;
    });
    document.getElementById("export-prev").disabled = current === 0;
    document.getElementById("export-next").hidden = current === 2;
    document.getElementById("export-step-count").textContent =
      `Step ${current + 1} of 3`;
    document.getElementById("wizard-error").textContent = "";
    updateSummary();
  }
  function showStep(step) {
    goToStep(step);
    const heading = panels[current].querySelector("h2");
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    if (innerWidth <= 768)
      document
        .querySelector(".export-wizard")
        .scrollIntoView({ block: "start" });
  }
  steps.forEach((button, i) =>
    button.addEventListener("click", () => showStep(i)),
  );
  document
    .getElementById("export-prev")
    .addEventListener("click", () => showStep(current - 1));
  document
    .getElementById("export-next")
    .addEventListener("click", () => showStep(current + 1));
  function updateSummary() {
    const years = [...document.querySelectorAll(".year-pill.active")].map(
      (pill) => pill.textContent.trim(),
    );
    document.getElementById("export-summary-years").textContent =
      years.join(", ") || "No years selected";
    const enabled = [
      ...document.querySelectorAll(
        ".settings-grid input[type=checkbox]:checked",
      ),
    ];
    document.getElementById("export-summary-fields").textContent =
      `${enabled.length} options selected`;
    document.getElementById("export-summary-format").textContent =
      document.querySelector(".format-card.active .format-name")?.textContent ||
      "JSON";
  }
  document
    .querySelector(".export-wizard")
    .addEventListener("change", updateSummary);
  new MutationObserver(updateSummary).observe(
    document.querySelector(".export-panel-host"),
    { attributes: true, subtree: true, attributeFilter: ["class"] },
  );
  const progress = document.getElementById("progress-percent");
  const updateProgress = () => {
    const value = Math.max(
      0,
      Math.min(100, parseFloat(progress.textContent) || 0),
    );
    document
      .getElementById("export-ring")
      .style.setProperty("--progress", `${value}%`);
    document.getElementById("export-ring-value").textContent = `${value}%`;
  };
  new MutationObserver(updateProgress).observe(progress, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  goToStep(0);
  updateProgress();
})();
