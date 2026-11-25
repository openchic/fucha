## Context

See proposal.md for the user need. The renderer currently defines the app-shell palette in `styles/tokens.css`, while application preferences already have asynchronous read/write APIs backed by SQLite. Article styling is generated from `ThemeToken` and `theme.css`; `themed-preview` also allows an unset article page background to remain transparent.

## Goals / Non-Goals

**Goals:**

- Persist one app appearance choice: `system`, `light`, or `dark`.
- Apply the resolved appearance across application chrome, settings, controls, dialogs, and popovers.
- Let preview chrome, toolbars, and theme-editor controls follow the resolved app appearance. Keep both the article content page and theme-editor sample faithful to their selected article theme, while preserving stored theme data and generated article HTML.

**Non-Goals:**

- Changing the article theme selector, ThemeToken format, article CSS, or export pipeline.
- Adding a database migration, preload API, IPC channel, or dependency.

## Decisions

1. **Keep appearance state in the renderer and reuse preferences.** Store the selected mode under an app-specific preference key. Missing or invalid values fall back to `system`. The provider starts with the current system mode, loads the saved value, and keeps the system media query subscribed while the mode is `system`. Selecting an explicit mode writes the preference before updating the active mode; a write failure leaves the previous mode active and is shown in the appearance page.

   Electron's `nativeTheme.themeSource` was considered, but it would require a new main-process bridge for a preference that only controls renderer UI. `matchMedia('(prefers-color-scheme: dark)')` already reflects the host appearance in the Electron renderer and emits changes without restarting the app.

2. **Apply one resolved mode at the document root.** The appearance provider exposes the saved preference and sets the root `data-appearance` attribute and CSS `color-scheme`. Preview workspaces and their popovers inherit app colors through CSS. The desktop article canvas and phone screen keep light paper as the fallback for transparent article themes. The selected article theme supplies the article styles.

3. **Use semantic app-shell surface tokens.** Set the dark-mode `--color-surface` to `#232426`, add dark overrides for existing app colors, and replace fixed white backgrounds on application chrome and settings surfaces with the semantic surface class. Keep stored theme data and exported HTML unchanged. Use separate foreground tokens for primary buttons and tooltips so text remains legible when the palette reverses.

4. **Expose the choice in a dedicated Settings page.** Add an «外观» item beside «主题管理» and a route with a native radio group for «跟随系统」「浅色」「深色». Use a stacked-layer icon for «主题管理» and a sun icon for «外观» so the destinations are visually distinct. Show the equal options as a compact row at regular window widths and stack them on narrow windows. Keep only the option names, without descriptions, so the single-choice control uses less vertical space; leave 16px between its legend and options. Native radios provide keyboard and screen-reader behavior without introducing another control dependency. Use the existing accent tint for the selected option and keep the current visual tokens. Describe that edits to an existing custom theme apply to its articles the next time they are opened.

5. **Use native edit commands with Chinese labels.** Show a separate 「编辑」 menu whose text commands use Electron's native roles for undo, redo, cut, copy, paste, paste-and-match-style, delete, and select-all, with Chinese labels. Localize the substitutions and speech submenu labels and actions too. Let macOS place AutoFill, Dictation, and Emoji & Symbols in this menu instead of the application-name menu. Do not intercept text editing shortcuts in the main process or add renderer-side paste handling.

## Risks / Trade-offs

- [Some fixed white or black colors may remain on app chrome] → Audit every renderer `bg-white` and fixed color use, keep only article/device-preview paper surfaces fixed, then inspect Home, Settings, dialogs, and popovers in the real Electron window.
- [A saved explicit mode is read asynchronously at startup] → Render using the current system appearance immediately, then apply the saved override as soon as the preference read completes; preference failures safely fall back to system.
- [Dark palette colors may reduce contrast in existing controls] → Use paired foreground/background tokens for primary actions and tooltips, and inspect the selected, hover, focus, and disabled states in both modes.
