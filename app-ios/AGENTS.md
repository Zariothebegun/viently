# Agent rules for Viently

## Active application

- The active product is app-ios/, an Expo SDK 58 / React Native 0.88 / React 19 TypeScript app.
- The main screen is currently app-ios/App.tsx. It is intentionally a single-screen feed; do not introduce Expo Router or route restructuring without explicit approval.
- app/ is an older web prototype and is not the active product.
- Voice, microphone access, screen capture, screen overlays and screen watching are out of scope.

## Before editing

1. Read ../02-contexto-do-produto.md first; it defines the product intent and teaching/question policy.
2. Read app-ios/package.json and the relevant source files.
3. Check existing tests in app-ios/tests/.
4. Keep changes focused and preserve the current feed interaction model.
5. Never claim a device test or runtime check that was not actually performed.

## Product and rendering rules

- The LLM returns structured data only. Never evaluate model output as code or render arbitrary HTML/JS.
- Validate every operation in src/lesson/generate.ts before rendering.
- Preserve line breaks, numbered notes, equations and technical notation.
- Use one text renderer for animated, completed and preview states.
- Paginate by semantic blocks/word boundaries; never silently drop text.
- Do not force 3D, graphs, quizzes or cards onto every page.
- Use at most one 3D model and four hotspots per page.
- Do not invent external model authorship or licence terms.
- Keep idle WebViews and animation loops paused; avoid unnecessary React renders.

## Commands and validation

From app-ios/:

```bash
npm test
npx tsc --noEmit
npx expo-doctor
npx expo export --platform ios
```

Run the relevant tests after each change and the full suite before finishing. GitHub Actions is required for final automated validation. Real iPhone testing is still required for visual layout, gestures, keyboard, WebView and performance.
