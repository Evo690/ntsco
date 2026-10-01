import { test, expect } from "@playwright/test";
const local = "http://localhost:3000";
async function routes(page) {
  await page.route("**/*", (route) =>
    route.request().url().startsWith(local) ? route.continue() : route.abort(),
  );
}
test("saved dark appearance paints before the app bundle or authentication can run", async ({
  page,
}) => {
  await routes(page);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/main.js?*", async (route) => {
    await gate;
    await route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem("fy_user_name", "Alex Test");
    localStorage.setItem("fy_theme_mode_Alex_Test", "dark");
    localStorage.setItem("fy_theme_preset_Alex_Test", "ocean");
    window.entryFrames = [];
    const sample = () => {
      const login = document.getElementById("login-screen");
      if (login && window.entryFrames.length < 120)
        window.entryFrames.push({
          light: document.body.classList.contains("light-mode"),
          background: getComputedStyle(login).backgroundColor,
        });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator("#login-theme-toggle")).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/light-mode/);
    await expect(page.locator("body")).toHaveClass(/theme-ocean/);
    await expect(page.locator("#login-screen")).toHaveCSS(
      "background-color",
      "rgb(17, 23, 25)",
    );
    expect(await page.evaluate(() => typeof window.setThemeMode)).toBe(
      "undefined",
    );
    await expect
      .poll(() => page.evaluate(() => window.entryFrames.length))
      .toBeGreaterThan(1);
    expect(
      await page.evaluate(() =>
        window.entryFrames.every(
          (frame) => !frame.light && frame.background === "rgb(17, 23, 25)",
        ),
      ),
    ).toBe(true);
    // The small login control works even with the large application bundle stalled.
    await page
      .locator("#login-screen")
      .getByRole("button", { name: "Toggle light and dark theme" })
      .click();
    await expect(page.locator("body")).toHaveClass(/light-mode/);
    await page
      .locator("#login-screen")
      .getByRole("button", { name: "Toggle light and dark theme" })
      .click();
    await expect(page.locator("body")).not.toHaveClass(/light-mode/);
  } finally {
    release();
  }
  await page.waitForLoadState();
  await expect(page.locator("body")).not.toHaveClass(/light-mode/);
});
test("login theme survives reload, stays in sync with Settings, and preserves inputs", async ({
  page,
}) => {
  await routes(page);
  await page.goto("/");
  await page.locator("#login-user").fill("student");
  await page.locator("#login-pass").fill("not-a-real-password");
  const toggle = page
    .locator("#login-screen")
    .getByRole("button", { name: "Toggle light and dark theme" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).not.toHaveClass(/light-mode/);
  await expect(page.locator(".auth-sun")).toBeVisible();
  await expect(page.locator(".auth-moon")).not.toBeVisible();
  await expect(page.locator("#login-user")).toHaveValue("student");
  await expect(page.locator("#login-pass")).toHaveValue("not-a-real-password");
  await page.reload();
  await expect(page.locator("body")).not.toHaveClass(/light-mode/);
  await page.evaluate(() => {
    initTopbarEnhancements();
    renderThemeSettings();
  });
  await expect(page.locator("#theme-mode-dark")).toHaveClass(/active/);
  await page.evaluate(() => setThemeMode("light"));
  await expect(page.locator(".auth-moon")).toBeVisible();
  await page.reload();
  await expect(page.locator("body")).toHaveClass(/light-mode/);
  expect(
    await page.locator('meta[name="theme-color"]').getAttribute("content"),
  ).toBe("#f6f3ef");
});
test("signed-out login keeps the last device theme without overriding a different account choice", async ({
  page,
}) => {
  await routes(page);
  await page.goto("/");
  await page.evaluate(() => {
    sessionStorage.setItem("fy_user_name", "Alex");
    setThemeMode("dark");
    sessionStorage.removeItem("fy_user_name");
  });
  await page.reload();
  await expect(page.locator("body")).not.toHaveClass(/light-mode/);
  await page.evaluate(() => {
    sessionStorage.setItem("fy_user_name", "Sam");
    localStorage.setItem("fy_theme_mode_Sam", "light");
  });
  await page.reload();
  await expect(page.locator("body")).toHaveClass(/light-mode/);
});
test("night login fits phone and desktop, including errors, password visibility and privacy", async ({
  page,
}) => {
  await routes(page);
  await page.goto("/");
  await page.locator("#login-theme-toggle").click();
  await page.evaluate(() => {
    attemptLogin = async () => {
      throw new Error(
        "Invalid credentials. Please check your username and password.",
      );
    };
  });
  await page.locator("#login-user").fill("student");
  await page.locator("#login-pass").fill("wrong");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.locator("#login-pass")).toHaveAttribute("type", "text");
  await page.locator("#login-submit").click();
  await expect(page.locator("#login-error")).toBeVisible();
  await expect(page.locator("#login-submit")).toBeEnabled();
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page
        .locator("#login-screen")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await page.locator("#login-submit").scrollIntoViewIfNeeded();
    await expect(page.locator("#login-submit")).toBeInViewport();
  }
  await page.getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page.locator("#privacy-modal-backdrop")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#login-screen")).toBeVisible();
});
