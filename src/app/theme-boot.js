/* Inlined by the build before styles and network scripts. No app/API dependency. */
(() => {
  const readStorage = (storage, key) => {
    try {
      return window[storage].getItem(key);
    } catch (_) {
      return null;
    }
  };
  const writeStorage = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (_) {
      /* Still work for this visit. */
    }
  };
  const userKey = (base) => {
    const name =
      readStorage("sessionStorage", "fy_user_name") ||
      readStorage("localStorage", "fy_user_name");
    let user =
      readStorage("sessionStorage", "fy_logged_in_user") ||
      readStorage("localStorage", "fy_logged_in_user");
    if (!user) {
      try {
        user = decodeURIComponent(
          document.cookie
            .split("; ")
            .find((c) => c.startsWith("fy_u="))
            ?.slice(5) || "",
        );
      } catch (_) {}
    }
    const id =
      name?.trim() && name.trim() !== "Student"
        ? name.trim()
        : user?.trim() && !/^\+?[0-9\s\-]{8,15}$/.test(user.trim())
          ? user.trim()
          : "";
    return id ? `${base}_${id.replace(/[^a-zA-Z0-9_]/g, "_")}` : base;
  };
  const deviceKey = (key) => key.replace("fy_theme_", "fy_appearance_");
  const read = (key) =>
    readStorage("localStorage", userKey(key)) ||
    readStorage("localStorage", deviceKey(key)) ||
    readStorage("localStorage", key);
  let mode = read("fy_theme_mode") === "dark" ? "dark" : "light";
  let preset = read("fy_theme_preset") || "default";
  const validPreset = (value) =>
    ["ocean", "purple", "emerald"].includes(value) ? value : "default";
  preset = validPreset(preset);
  const apply = (body = document.body) => {
    const light = mode === "light";
    document.documentElement.style.colorScheme = mode;
    document.documentElement.style.backgroundColor = light
      ? "#f6f3ef"
      : "#111719";
    document.documentElement.dataset.theme = mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = light ? "#f6f3ef" : "#111719";
    if (body) {
      body.classList.toggle("light-mode", light);
      body.classList.remove("theme-ocean", "theme-purple", "theme-emerald");
      if (preset !== "default") body.classList.add(`theme-${preset}`);
    }
  };
  const save = (key, value) => {
    writeStorage(userKey(key), value);
    // Appearance only: retain the last choice on the signed-out screen.
    writeStorage(deviceKey(key), value);
  };
  window.portalAppearance = {
    read,
    apply,
    setMode(value, persist = true) {
      mode = value === "dark" ? "dark" : "light";
      if (persist) save("fy_theme_mode", mode);
      apply();
    },
    setPreset(value, persist = true) {
      preset = validPreset(value);
      if (persist) save("fy_theme_preset", preset);
      apply();
      return preset;
    },
    toggle() {
      this.setMode(
        document.body.classList.contains("light-mode") ? "dark" : "light",
      );
    },
  };
  apply();
})();
