# ntsc. — Your study space

A responsive, static student portal with a warm paper/lilac visual system, priority-based navigation, an on-demand page drawer, and feature-organized application sources. Light mode is the default; saved dark-mode and accent preferences remain supported.

## Develop

Requires Node.js 22+.

```sh
npm ci
npm run dev                 # Builds and serves on 0.0.0.0:3000
npm run build               # Rebuild after editing src/ JavaScript or CSS
npm test                    # Integration contracts, build, chart logic
npx playwright install chromium
npm run test:e2e             # Isolated browser UI tests
```

`PORT=8080 npm run dev` changes the port. The development server accepts preview hosts. It is not an authentication proxy. In an environment with an existing Chromium binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for the browser tests.

## Product structure

- **Primary navigation:** Overview, Results (the same direct/unpublished-result lookup previously named Forced Results), Classes, Messages, Noticeboard—in that order. Desktop shows the top navigation only; phones show the bottom navigation only. Classes opens the student timetable (the legacy `timetable` route remains compatible). The More/Others tab is removed. The header menu retains secondary pages and phone access to Settings.
- **Overview:** today's schedule, latest result snapshot, upcoming exams, and everyday links. The longer-view/recent-score-chart section has been removed. The secondary Tools link opens the existing Advanced functions panel in Settings.
- **Courses, schedule, inbox, study shelf, notices:** dedicated collection/reading layouts with the existing filters, pagination, attachments, and data flows.
- **Results:** a direct-ID lookup and test-history ledger. Detail pages have no capability tags or technical fetch banner; subject marks, ranks, averages, highest scores, percentiles, and answer counts are visible by default. Additional statistics, PDFs, solutions, and ordinary result leaderboards remain available.
- **Exam Hall:** dated paper cards, available scores, syllabus actions, and direct links to result lookup.
- **Classes / timetable:** weekday-first day selection, a chronological class agenda, real schedule counts, and attendance access. On narrow screens the selected day scrolls fully into view.
- **Recorded classes:** a Settings-only standalone recording collection. It is not the primary Classes route and is no longer embedded in a portal iframe.
- **Neural Network / model lab:** separate prediction and simulated-leaderboard workflows with structured inputs, reference anchors, output panels, optional generation settings, and collapsed calculation details. Original inference, sync, filter, pagination, and export actions remain intact.
- **Detail sheets:** syllabus, exam calendar, course information, attendance, privacy, and the legacy result entrypoint share a native dialog controller with Escape dismissal and focus return. Calendar cards open a dedicated exam brief with date/venue/mode, subject-grouped syllabus, pending states, and the existing printable schedule. Search preserves the complete calendar collection and detail destinations; same-day status uses IST.
- **Practice:** compound/reagent/pKa modes retain their controls and access restrictions.
- **Settings:** appearance, practice configuration, data controls, and an initially closed **Advanced functions** section.
- **Test collection:** a full-width searchable card collection and native detail dialog; date-based download locks and paper/solution actions remain enforced.
- **Download builder:** three steps—period, details, download—with a live selection summary and progress ring. Original export options, formats, start/cancel, and logs are retained.
- **Other standalone functions:** inline batch/exam collection pickers, a recording theatre with a recent queue, and a restyled attempt launcher/instructions/session.

The standalone **Master Leaderboard has been removed**. Ordinary result leaderboards, synthetic leaderboard generation, and the downloader's leaderboard export options are separate existing functions and remain available.

## Architecture

| Location | Responsibility |
| --- | --- |
| `index.html` | Authentication, shared shell, feature markup, integration/modal targets |
| `core.js` | API configuration, state, request helpers, normalization and formatting |
| `src/app/` | Navigation, account-scoped storage/cache, authentication, session bootstrap and presentation controllers |
| `src/features/` | Charts, renderers, results, attendance, messages, resources, appearance, chemistry practice, prediction and recordings |
| `src/manifest.json` | Explicit initialization order for 25 source files |
| `scripts/build.mjs`, `scripts/assets.mjs` | Assemble `main.js` and `styles.css`; refresh content-versioned asset references in every page |
| `src/styles/` | Local fonts, compatibility layer, tokens, shell, auth, modules and standalone layouts; `manifest.json` defines shared CSS order |
| `assets/fonts/` | Self-hosted font subsets and licenses |
| `functions/` | Seven independently addressable function pages with their existing domain scripts |
| `tests/` | Original DOM/function contracts, chart unit tests, deterministic browser fixtures and UI tests |

### Compatibility boundaries

This is a feature-organized source architecture, **not an ES-module runtime rewrite**. Classic-script scope and initialization order intentionally preserve the globals used by the portal, dynamically generated markup, standalone functions, and scraper. Edit `src/`, not the generated `main.js` or `styles.css`. The checked-in bundle supports static hosting without a deployment build service.

Legacy feature styles load first. The shared design system owns new presentation: `tokens.css`, `workspace.css`, `auth.css`, `modules.css`, `priority-pages.css`, `detail-pages.css`, `mobile.css`, and `workbench.css`. Function-specific structural compatibility styles live in `src/styles/tools/`. Local Space Grotesk and DM Sans are the primary UI fonts.

`src/app/workspace.js` handles password visibility, session/date presentation, drawer focus/inert state, utility filtering, and deep links. `src/app/workbench.js` handles shared function navigation, accessible controls, theme switching, the detail sheet, and download-step presentation. Neither introduces new API calls.

Return links use `index.html?module=settings&panel=functions`, restoring Settings and opening its advanced section after authentication. Older `?module=tools` links resolve to that same Settings section; there is no public Tools page or primary navigation entry. Attempt-session exits still use the existing confirmation path.

### Function routing and detail sheets

Every Settings function launcher uses the explicit route map in `src/app/session.js` and opens the corresponding standalone page; attempt-test still uses its access check. The old recording iframe bridge has been removed. Each function page has one visible workbench header. Legacy headers retain their integration IDs but are hidden, inert and excluded from the accessibility tree. The attempt launcher hides the empty exam interface until setup is complete.

`src/features/detail-dialogs.js` owns native detail-sheet creation, opening and closing. Existing data handlers populate these sheets rather than creating independent legacy overlay styles. No new API client is introduced.

### Asset delivery and cache safety

The shared stylesheet is built into a single `styles.css`, in manifest order, with font URLs rebased to its output location. The portal does not depend on nested CSS imports loading successfully. Run `npm run build` after source CSS edits, just as for JavaScript edits.

Every local stylesheet and script reference in the main page and the seven function pages receives a content-hash `?v=` parameter. Rebuilding updates the references only when their content changes. This prevents new markup from reusing an old cached stylesheet or script. `_headers` additionally requests revalidation on Cloudflare Pages; the development server already sends `Cache-Control: no-cache`.

A browser regression test deliberately supplies stale assets at unversioned URLs and blocks source stylesheet requests. It verifies the complete dashboard layout, current asset delivery, and overflow at phone/tablet/desktop widths, including long test names and both themes.

### Charts and data integrity

Charts render from existing result payloads, not demonstration data. Missing or invalid values are not silently treated as zero. Question charts require all three counts. Subject bars require a score and a positive maximum, and keep exact numeric labels when drawn values need clamping. Empty accounts display explicit empty states. Fixtures are confined to tests and never injected into the application.

### Appearance and Settings actions

Light mode retains its warm lilac palette. Dark mode uses charcoal surfaces, a sea-glass accent, dark-specific preset swatches, and matching native control/browser theme colors across the portal and all seven function pages. Timetable, Overview schedule and upcoming-exam panels use neutral night surfaces with restrained blue/mauve/mint accents instead of light-mode pastel fills. Settings launchers use one explicit destination map; the attempt passcode gate and quick-ID workflows are retained. Refresh Portal Data refreshes portal sections rather than requesting data for the non-data Settings route. Clearing the data cache preserves appearance preferences.

### Validation

Architecture tests retain original DOM integration IDs and global entrypoints, excluding only the intentionally deleted Master Leaderboard route. Browser tests cover authentication transitions/errors, Settings-only function access, routes, themes, desktop/mobile layouts, results/solutions, chart data, native-sheet keyboard focus, future-date locks, wizard configuration persistence, scrolling, and attempt exit hooks.

Tests block external requests and use isolated fixtures. They **do not validate production credentials, backend authorization, real exam submissions, cloud sync, live video playback, or model accuracy**. Verify those with an authorized account before release.

## Deployment

Run `npm run build` and deploy the static repository, including `src/styles/`, `assets/`, `functions/`, model files, and existing JSON datasets. No new backend or framework server is required. Existing third-party API/script dependencies still require network access; UI fonts do not.

### First-paint appearance and login

`src/app/theme-boot.js` is inlined into `index.html` by the build, before stylesheets and network scripts. It sets the page background/browser color immediately and applies the saved body classes before the login markup is parsed; appearance no longer waits for authentication or the app bundle. Edit the source file, not the generated inline block.

The login sun/moon control uses the same appearance controller as Settings and works while the main app is still loading. Existing per-account preferences take precedence, with appearance-only `fy_appearance_mode` / `fy_appearance_preset` keys retaining the last explicit choice on the signed-out screen. Light remains the default. Storage access failures fall back safely within this small bootstrap. The login has dedicated night surfaces, inputs, focus/error/autofill states, and mobile layouts; sign-in and server verification are unchanged.

Regression coverage includes a stalled app bundle with first-frame sampling, theme persistence/account precedence, keyboard activation, unchanged input values, and dark login error/privacy flows at phone and desktop widths.

### Phone layout refinements

`src/styles/mobile.css` is the final shared stylesheet layer (nine sources total). The login goes directly from the header to a centered form on phones with the sign-in action above the fold on small phones, larger input text, a password-visibility icon, and keyboard hints. The mobile shell includes larger touch targets, safe-area padding, readable schedule/calendar/result text, and native bottom-sheet details with a sticky close header. Desktop layout and authentication flows are preserved. The viewport supports safe-area insets and content resizing for the on-screen keyboard where supported.

The phone login adds a pocket-notebook treatment (paper-edge shadow, ruled separators and a small decorative card motif) in both themes. All decoration is CSS/inline SVG, hidden from assistive technology and non-interactive. The existing one-step form, autofill attributes and full-width submit target remain; short-height layouts leave room below Sign in without an entrance animation or added screen.
