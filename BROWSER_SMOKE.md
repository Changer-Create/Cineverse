# Cineverse browser smoke checklist

This checklist covers the browser behaviors that the dependency-free Node suite cannot execute.

## Environment limitation

The Codex container used for the first governance round did not provide Chromium, Chrome, Firefox,
Playwright, Selenium, or an equivalent browser driver. `npm run check` therefore protects static and
VM-testable contracts only; it is not a substitute for this release check.

## Run

1. Start the repository without remote services:

   ```sh
   python3 -m http.server 8000
   ```

2. Open `http://localhost:8000/index.html` in a supported desktop browser.
3. Complete the checks below with DevTools Console open.

## Application entry

- The page loads without an uncaught console error or a missing local resource.
- Navigation reaches 首页、影视库、匹配中心、电影雷达、月度计划、已观看、统计分析 and 设置.
- A movie can be created, edited, rated, planned, and given a watch record after making a JSON backup.
- Refresh preserves the edits; importing the backup restores the previous state.
- CSV export/import completes and formula-prefixed text remains text in a spreadsheet.
- Invalid or SVG avatar/wallpaper files are rejected; PNG/JPEG/WebP/GIF files still work.

## Admin entries

- With `movie-collection-admin-auth-v1` absent, opening `admin.html` redirects before protected admin modules initialize.
- With a valid local admin session, `admin.html` loads without an uncaught console error.
- `admin-console.html` renders content and quote lists; unsafe/non-HTTP quote source URLs do not become links.
- Saving content, navigation, and brand settings is reflected in the application after refresh.

## Unified TMDb detail state

- Opening an uncollected search result and returning does not change `movie-collection-v2`; the same search results remain visible.
- Starring an uncollected movie creates one `want` item with `favorite=true` and upgrades the current detail without reload.
- Selecting 想看 does not star the item; selecting 在看 is available only for TV.
- Selecting 看过 and cancelling/pressing Escape creates neither a movie nor a watch record.
- Saving 看过 creates exactly one movie and one real watch record, then unlocks personal detail sections in place.
- Starring an existing watched movie or watching TV changes only `personal.favorite`.
- Opening an already collected TMDb result uses the existing item and preserves ratings, tags, review, plans, timestamps, and watch history.
- DevTools Network shows only one detail + credits bundle for subsequent status/favorite actions on the same result.
- The poster uses normal cover cropping and aligns with the full height of the adjacent primary information area.

## Evidence

Record the browser/version, commit SHA, console output, network 404 count, and screenshots of the app
home page, settings page, unauthenticated admin redirect, and authenticated admin page.
