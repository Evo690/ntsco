import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const source = readFileSync(
  new URL("../src/app/theme-boot.js", import.meta.url),
  "utf8",
);
test("appearance bootstrap is inlined before styles and applied before any body content", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes(source.trim()));
  assert.ok(
    html.indexOf("appearance-boot:start") < html.indexOf('rel="stylesheet"'),
  );
  assert.ok(
    html.indexOf("portalAppearance.apply(document.body)") <
      html.indexOf('id="login-screen"'),
  );
});
test("appearance bootstrap and toggle work when browser storage is denied", () => {
  const classes = new Set(["light-mode"]);
  const body = {
    classList: {
      toggle: (key, on) => (on ? classes.add(key) : classes.delete(key)),
      remove: (...keys) => keys.forEach((key) => classes.delete(key)),
      add: (key) => classes.add(key),
      contains: (key) => classes.has(key),
    },
  };
  const document = {
    body,
    documentElement: { style: {}, dataset: {} },
    querySelector: () => null,
    get cookie() {
      throw new Error("denied");
    },
  };
  const window = {
    get localStorage() {
      throw new Error("denied");
    },
    get sessionStorage() {
      throw new Error("denied");
    },
  };
  runInNewContext(source, { window, document });
  window.portalAppearance.apply();
  window.portalAppearance.toggle();
  assert.equal(classes.has("light-mode"), false);
  assert.equal(document.documentElement.dataset.theme, "dark");
});
