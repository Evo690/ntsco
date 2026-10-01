import { test, expect } from "@playwright/test";
async function open(page) {
  await page.route("**/*", (r) =>
    r.request().url().startsWith("http://localhost:3000")
      ? r.continue()
      : r.abort(),
  );
  await page.goto("/");
  await page.evaluate(() => {
    ensureDataForPage = async () => {};
    chemLoadVisitorStat = () => {};
    scanAndUploadOnlineTests = () => {};
    document.getElementById("login-screen").style.display = "none";
    APP_STATE.calendarEntries = [
      {
        id: 101,
        name: "Physics review",
        dateTime: new Date(Date.now() + 86400000).toISOString(),
        mode: "Offline",
        venue: "Room 12",
        syllabus: "PHYSICS: Wave optics\nInterference\nCHEMISTRY: Equilibrium",
      },
      {
        id: 102,
        name: "Chemistry test",
        dateTime: new Date(Date.now() + 172800000).toISOString(),
        mode: "Online",
        venue: "Portal",
        syllabus: "",
      },
    ];
    renderExamCalendar(APP_STATE.calendarEntries);
    APP_STATE.timetable = [
      {
        classDate: getIstDateKey(),
        startTime: "09:00",
        subjects: "Physics",
        classType: "Classroom",
      },
      {
        classDate: getIstDateKey(),
        startTime: "11:00",
        subjects: "Chemistry",
        classType: "Classroom",
      },
      {
        classDate: getIstDateKey(),
        startTime: "14:00",
        subjects: "Mathematics",
        classType: "Classroom",
      },
    ];
  });
}
test("calendar View details opens the matching redesigned preparation brief and keeps print/focus", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    nav("examcal");
    printCalendarDetail = (index) =>
      (window.printedExam = APP_STATE.calendarEntries[index].id);
  });
  await expect(page.locator(".calendar-paper")).toHaveCount(2);
  await expect(page.locator(".exam-calendar-item")).toHaveCount(0);
  const card = page
    .locator(".calendar-paper")
    .filter({ hasText: "Physics review" });
  const button = card.getByRole("button", { name: "View details" });
  await button.click();
  const dialog = page.locator("#calendar-detail-modal-backdrop");
  await expect(dialog).toHaveClass(/calendar-brief-dialog/);
  await expect(dialog.locator("#calendar-detail-name")).toHaveText(
    "Physics review",
  );
  await expect(dialog.locator("#calendar-detail-venue")).toHaveText("Room 12");
  await expect(dialog.locator(".brief-subject")).toHaveCount(2);
  await expect(dialog).toContainText("Interference");
  await dialog.getByRole("button", { name: "Download PDF / Print" }).click();
  expect(await page.evaluate(() => window.printedExam)).toBe(101);
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
  await expect(dialog).not.toBeVisible();
  await page
    .locator(".calendar-paper")
    .filter({ hasText: "Chemistry test" })
    .getByRole("button", { name: "View details" })
    .click();
  await expect(dialog.locator(".brief-empty")).toContainText(
    "No syllabus has been published",
  );
});
test("calendar search does not discard entries or send View details to the wrong exam", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    APP_STATE.globalSearch = "Physics";
    nav("examcal");
  });
  await expect(page.locator(".calendar-paper")).toHaveCount(1);
  expect(await page.evaluate(() => APP_STATE.calendarEntries.length)).toBe(2);
  await page.getByRole("button", { name: "View details" }).click();
  await expect(page.locator("#calendar-detail-name")).toHaveText(
    "Physics review",
  );
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    APP_STATE.globalSearch = "";
    refreshActivePageData();
  });
  await expect(page.locator(".calendar-paper")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => getCalendarExamStatus(`${getIstDateKey()}T00:01:00+05:30`).label,
    ),
  ).toBe("Today");
  expect(
    await page.evaluate(() => getCalendarExamStatus("invalid").label),
  ).toBe("Date pending");
});
test("dark schedule and upcoming cards use night surfaces across all accent presets", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => setThemeMode("dark"));
  for (const preset of ["default", "ocean", "purple", "emerald"]) {
    await page.evaluate((preset) => {
      applyThemePreset(preset);
      nav("timetable");
    }, preset);
    await expect(page.locator(".schedule-overview")).toHaveCSS(
      "background-color",
      "rgb(28, 38, 42)",
    );
    await expect(page.locator(".agenda-event").first()).toHaveCSS(
      "background-color",
      "rgb(32, 44, 48)",
    );
    await expect(page.locator(".schedule-day.active")).not.toHaveCSS(
      "background-color",
      await page
        .locator(".schedule-day.active")
        .evaluate((el) => getComputedStyle(el).color),
    );
    await page.evaluate(() => nav("dashboard"));
    await expect(page.locator(".upcoming-card")).toHaveCSS(
      "background-color",
      "rgb(28, 38, 42)",
    );
  }
  await page.evaluate(() => {
    applyThemePreset("default");
    setThemeMode("light");
    nav("timetable");
  });
  await expect(page.locator(".schedule-overview")).toHaveCSS(
    "background-color",
    "rgb(245, 237, 206)",
  );
});
test("large calendars keep undated exams, escaped details, and printable schedule data", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const unsafe = '<img src=x onerror="window.injected=true">';
    APP_STATE.calendarEntries = Array.from({ length: 35 }, (_, i) => ({
      name: `Exam ${i}`,
      dateTime: new Date(Date.now() + i * 86400000).toISOString(),
    }));
    APP_STATE.calendarEntries.push({
      name: unsafe,
      dateTime: "invalid",
      venue: unsafe,
      syllabusLines: ["PHYSICS: Wave optics", unsafe],
    });
    nav("examcal");
    window.open = () => ({
      document: {
        open() {},
        write(html) {
          window.calendarPrintHtml = html;
        },
        close() {},
      },
    });
  });
  await expect(page.locator(".calendar-paper")).toHaveCount(36);
  const last = page.locator(".calendar-paper").last();
  await expect(last).toContainText("Date pending");
  await last.getByRole("button", { name: "View details" }).click();
  const dialog = page.locator("#calendar-detail-modal-backdrop");
  await expect(dialog.locator("#calendar-detail-name")).toContainText("<img");
  await expect(dialog.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await dialog.getByRole("button", { name: "Download PDF / Print" }).click();
  const html = await page.evaluate(() => window.calendarPrintHtml);
  expect(html).toContain("Wave optics");
  expect(html).toContain("&lt;img");
  expect(html).not.toContain("<img");
  expect(html).toContain("window.print()");
  await page.setViewportSize({ width: 360, height: 740 });
  expect(
    await page
      .locator("#workspace-content")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await dialog
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
});
