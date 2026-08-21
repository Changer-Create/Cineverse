# Cineverse

Cineverse is a browser-based movie collection application served as static HTML, CSS, and JavaScript.

## Entry points

- `index.html`: main application.
- `admin.html`: administrator sign-in.
- `admin-console.html`: authenticated content administration.

The entry pages load `content-center.js`, which synchronously boots the ordered resource manifest in
`content-center-runtime-v1.js`. Resource order is currently part of the compatibility contract; change it
only together with the runtime regression tests.

## Local development

No build step is required. Serve the repository root with any static file server, for example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/index.html>.

## Checks

Node.js 18 or newer is required for the built-in test runner.

```sh
npm test          # runtime manifest and entry behavior
npm run check     # JavaScript syntax plus tests
```

The tests intentionally avoid network access and external packages. See `REFACTOR_AUDIT.md` for the
broader risk inventory and staged refactor plan.
