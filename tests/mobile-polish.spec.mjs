import { test, expect } from "@playwright/test";
async function open(page) {
  await page.route("**/*", (r) =>
    r.request().url().startsWith("http://localhost:3000")
      ? r.continue()
      : r.abort(),
  );
  await page.goto("/");
}
test("phone login centers its form and brings Sign in into the first screen in both themes", async ({
  page,
}) => {
  await open(page);
  for (const mode of ["dark", "light"])
    for (const [width, height] of [
      [320, 568],
      [360, 640],
      [390, 740],
      [430, 932],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate((mode) => {
        setThemeMode(mode);
        document.getElementById("login-screen").scrollTop = 0;
      }, mode);
      await expect(page.locator(".auth-intro")).not.toBeVisible();
      await expect(page.locator(".auth-mobile-title")).toHaveCount(0);
      await expect(page.locator(".auth-desktop-title")).not.toBeVisible();
      await expect(page.locator("#login-submit")).toBeInViewport({ ratio: 1 });
      const bounds = await page.locator("#login-form").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left,
          right: innerWidth - r.right,
          overflow:
            document.getElementById("login-screen").scrollWidth > innerWidth,
        };
      });
      expect(Math.abs(bounds.left - bounds.right)).toBeLessThan(2);
      expect(bounds.left).toBeGreaterThanOrEqual(12);
      expect(bounds.overflow).toBe(false);
      for (const id of [
        "#login-user",
        "#login-pass",
        "#login-submit",
        "#login-theme-toggle",
        "#password-toggle",
      ]) {
        const size = await page.locator(id).boundingBox();
        expect(size.height).toBeGreaterThanOrEqual(44);
      }
    }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".auth-desktop-title")).toBeVisible();
  await expect(page.locator(".auth-mobile-title")).not.toBeVisible();
  await expect(page.locator(".auth-paper-stack")).toBeVisible();
});
test("phone form preserves values, password visibility and error recovery in a short viewport", async ({
  page,
}) => {
  await open(page);
  await page.setViewportSize({ width: 390, height: 740 });
  await page.locator("#login-user").fill("student");
  await page.locator("#login-pass").fill("incorrect");
  await page.locator("#password-toggle").click();
  await expect(page.locator("#login-pass")).toHaveAttribute("type", "text");
  await expect(page.locator(".password-eye-slash")).toBeVisible();
  await page.locator("#login-theme-toggle").click();
  await expect(page.locator("#login-user")).toHaveValue("student");
  await expect(page.locator("#login-pass")).toHaveValue("incorrect");
  await expect(page.locator("#login-user")).toHaveAttribute(
    "autocapitalize",
    "none",
  );
  await expect(page.locator("#login-pass")).toHaveAttribute(
    "enterkeyhint",
    "go",
  );
  await page.setViewportSize({ width: 390, height: 400 });
  await page.locator("#login-pass").scrollIntoViewIfNeeded();
  await page.locator("#login-pass").focus();
  await expect(page.locator("#login-pass")).toBeInViewport();
  await page.evaluate(() => {
    attemptLogin = async () => {
      throw new Error("Please check your username and password.");
    };
  });
  await page.locator("#login-submit").click();
  await expect(page.locator("#login-error")).toContainText("Please check");
  await expect(page.locator("#login-submit")).toBeEnabled();
});
test("phone detail sheet stays within the screen and keeps Close reachable after scrolling", async ({
  page,
}) => {
  await open(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.evaluate(() => {
    ensureDataForPage = async () => {};
    document.getElementById("login-screen").style.display = "none";
    APP_STATE.calendarEntries = [
      {
        name: "Full syllabus review",
        dateTime: new Date().toISOString(),
        syllabusLines: Array.from(
          { length: 35 },
          (_, i) => `Topic ${i + 1}: a longer preparation note.`,
        ),
      },
    ];
    nav("examcal");
  });
  const trigger = page.getByRole("button", { name: "View details" });
  await trigger.click();
  const dialog = page.locator("#calendar-detail-modal-backdrop");
  for (const mode of ["light", "dark"]) {
    await page.evaluate((mode) => setThemeMode(mode), mode);
    await dialog.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(
      dialog.getByRole("button", { name: "Close details" }),
    ).toBeInViewport({ ratio: 1 });
    const box = await dialog.boundingBox();
    expect(box.x).toBe(0);
    expect(box.width).toBe(360);
    expect(Math.abs(box.y + box.height - 740)).toBeLessThan(2);
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
  }
  await dialog.getByRole("button", { name: "Close details" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  for (const selector of [
    "#hamburger",
    ".workspace-theme",
    ".notif-btn",
    ".mobile-dock .dock-btn",
  ]) {
    for (const el of await page.locator(selector).all()) {
      const box = await el.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  }
});

test.describe("styled phone login stays direct", () => {
  test.use({
    hasTouch: true,
    viewport: { width: 320, height: 568 },
    reducedMotion: "reduce",
  });
  test("one tap on the button arrow submits once, with no decorative interception or extra step", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => {
      window.loginCalls = [];
      attemptLogin = (user, pass) => {
        window.loginCalls.push({ user, pass });
        return new Promise((resolve) => (window.finishLogin = resolve));
      };
      loadPortalData = async () => {};
    });
    await expect(page.locator(".auth-pocket-mark")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(page.locator(".auth-pocket-mark")).toHaveCSS(
      "pointer-events",
      "none",
    );
    await page.locator("#login-user").fill("test-student");
    await page.locator("#login-pass").fill("test-password");
    const submit = page.locator("#login-submit");
    await expect(submit).toBeInViewport({ ratio: 1 });
    const box = await submit.boundingBox();
    expect(box.y + box.height).toBeLessThan(548);
    // The decorative arrow remains part of the single, full-width submit target.
    await submit.tap({ position: { x: box.width - 25, y: box.height / 2 } });
    await expect(submit).toBeDisabled();
    expect(await page.evaluate(() => window.loginCalls)).toEqual([
      { user: "test-student", pass: "test-password" },
    ]);
    await page.evaluate(() => window.finishLogin());
    await expect(page.locator("#login-screen")).not.toBeVisible();
    await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  });
});
