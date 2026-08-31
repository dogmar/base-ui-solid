# Porting guide: `@base-ui/react` → `@base-ui/solid` (SolidJS 2.0)

This package is a port of `packages/react` to **SolidJS 2.0** (`solid-js@2.0.0-rc.4`)
with an **identical public API surface** wherever Solid's model allows it. Ports are
mechanical: every file in `packages/solid/src` mirrors its counterpart in
`packages/react/src` (same directory, same file name, same exported names, same
JSDoc), with the framework-specific parts translated using the rules below.

Read `node_modules/solid-js/CHEATSHEET.md` before porting — Solid 2.0 differs from
both React and Solid 1.x. The rules below are the project-specific decisions.

## Ground rules

1. **Components run once.** Never destructure `componentProps`. Use
   `omit(componentProps, ...keys)` (from `solid-js`) for `elementProps`, and read
   everything else as `componentProps.foo` (lazily) or wrap in accessors:
   `const disabled = () => componentProps.disabled ?? false;`.
2. **Defaults belong at the read site**, not in destructuring:
   React `const { disabled = false } = props` → Solid `const disabled = () => props.disabled ?? false`.
3. **Drop `'use client'`** directives and `React.forwardRef`. Components are plain
   functions taking `componentProps` only; the user's ref arrives as
   `componentProps.ref` (callback, `{ current }` object, or array of either — see
   `solid-utils/refs.ts`). Pass it into `useRenderElement`'s `ref` array where the
   React version passed `forwardedRef`.
4. **Keep names.** Hooks keep their `useXxx` names even though they are not React
   hooks. Public exports, props, data-attributes, namespaces
   (`export namespace Foo { export type Props = ... }`) stay identical to React.

## State and props objects

5. **Component `state` objects use getters** so reads are reactive at merge time:
   ```ts
   const state: Toggle.State = {
     get disabled() { return disabled(); },
     get pressed() { return pressed(); },
   };
   ```
   The object identity is stable; `useRenderElement` tracks the getter reads.
6. **Internal prop objects (`rootProps` etc.) use getters for reactive values**:
   ```ts
   const rootProps = {
     role: 'switch',
     get 'aria-checked'() { return checked() ? 'true' : 'false'; },
     onClick(event: MouseEvent) { ... },
   };
   ```
7. **`useRenderElement` works like the React version**, but `enabled` may be an
   accessor, `state` should use getters, and refs accept any `RefInput` shape.
   `props` entries keep React semantics including props-getter functions
   (`getButtonProps`) receiving the merged-so-far props.

## Attributes and events (Solid JSX semantics)

8. **`aria-*` values must be strings.** Solid renders boolean attribute values as
   presence/absence (`true` → `""`, `false` → removed). Convert:
   `'aria-pressed': pressed` → `get 'aria-pressed'() { return pressed() ? 'true' : 'false' }`.
   For "present only when true" attributes React wrote as `value || undefined`
   (e.g. `'aria-required': required || undefined`), `required ? 'true' : undefined`.
9. **Attribute names are lowercase** in internal prop objects: `tabIndex` →
   `tabindex`, `readOnly` → `readonly`, `htmlFor` → `for`. Event handlers stay
   camelCase (`onClick`, `onKeyDown`). `className` in internal objects → `class`.
10. **Events are native DOM events.** `React.MouseEvent` → `MouseEvent`,
    `event.nativeEvent` → `event`. `BaseUIEvent`/`preventBaseUIHandler` semantics
    are preserved by `merge-props` (it mutates the native event object).
    There is no React #9023 workaround needed; delete comments referencing it and
    the corresponding `event.nativeEvent.defaultPrevented` checks become
    `event.defaultPrevented` where still meaningful.
10a. **Focus events don't bubble like React's.** React's `onFocus`/`onBlur`
    use `focusin`/`focusout` semantics (they fire for focus changes on
    descendants). Solid's `onFocus`/`onBlur` attach the native non-bubbling
    events. When the React handler relies on catching descendant focus
    (a root/wrapper element listening for focus inside), port it to
    `onFocusIn`/`onFocusOut`; when it only cares about the element itself,
    keep `onFocus`/`onBlur`.
11. **`style` values** may be objects (hyphenated keys per Solid's `JSX.CSSProperties`)
    or strings. React camelCase style objects must be translated to hyphenated keys
    (`clipPath` → `'clip-path'`). Pure style constants from `@base-ui/utils`
    (e.g. `visuallyHidden`) are React-flavored: re-create hyphenated copies in
    `packages/solid/src/solid-utils/` when needed rather than importing those.

## Hooks and effects

12. `React.useState` → `createSignal(..., { ownedWrite: true })` (the option allows
    writes from effects/owned scopes, which ported code does).
13. `useControlled` (from `@base-ui/utils`) → `useControlled` from
    `../solid-utils/useControlled`: `controlled` becomes an accessor
    (`controlled: () => componentProps.checked`), `default` is read once. Returns
    `[accessor, setter]`.
14. `React.useRef` for DOM elements → `createRef<T>()` from `solid-utils/refs`
    (keeps `.current` reads working) or a plain `let` variable.
    `useMergedRefs` → `useMergedRefs` from `solid-utils/refs` (not reactive, no hook rules).
15. `useIsoLayoutEffect(fn, [deps])` → `createRenderEffect(() => [deps...], ([deps]) => { fn })`.
    `React.useEffect(fn, [deps])` → `createEffect(compute, apply)` (two-arg form —
    single-arg is an error in Solid 2.0). A cleanup returned from React's effect
    becomes the value returned from the apply function.
16. `useTimeout`/`useAnimationFrame`/`useInterval` → same names from
    `../solid-utils/timers` (class instances with `onCleanup` wired).
17. `useStableCallback(fn)` → delete the wrapper; plain functions are already stable.
    `React.useCallback(fn, deps)` / `React.useMemo(obj, deps)` → plain function /
    object-with-getters (or `createMemo` when a cached computation is genuinely needed).
18. `useId`/`useBaseUiId` → `useBaseUiId(() => componentProps.id)` from
    `../internals/useBaseUiId`; returns an accessor.
19. `useValueChanged(value, cb)` → `useValueChanged(() => value(), cb)` from
    `../internals/useValueChanged`.
20. `useTransitionStatus(open, ...)` → `useTransitionStatus(() => open(), ...)`;
    `mounted` and `transitionStatus` come back as accessors.

20a. **Register/release effects need an idempotence guard.** The React pattern
    "effect writes a registration signal its compute tracks, cleanup releases
    it" oscillates in Solid 2.0 (`createRenderEffect` can re-run its apply
    phase with an unchanged computed value). Guard with a last-synced check
    and release in `onCleanup` instead of a per-apply cleanup — see
    `utils/useRegisteredLabelId.ts`.
20b. **In tests, cascaded updates (effect → signal write → effect) may need a
    second `flush()`** or a `waitFor`: one `flush()` does not always drain
    writes queued by the effects it runs.

## Contexts

21. React `createContext<T | undefined>(undefined)` + optional read →
    `createOptionalContext<T>()` + `useOptionalContext(Ctx)` from
    `solid-utils/optionalContext`. (Solid 2.0's default-less contexts throw when
    read without a provider; the helper preserves the `undefined` behavior and
    keeps Base UI's custom error messages for required contexts.)
22. Context **values carry accessors** for reactive fields
    (`value: Accessor<string[]>`), functions stay plain. Providing:
    `<FooContext value={contextValue}>{...}</FooContext>` — the context object is
    its own provider in Solid 2.0 (no `.Provider`).
23. `JSX.Element` children flow through as-is; `React.ReactNode` → `JSX.Element`.

## Render output

24. A React component returning wrapped JSX (`<Ctx.Provider>{element}</Ctx.Provider>`)
    becomes a Solid component returning
    `<FooContext value={ctx}>{useRenderElement(...)}</FooContext>`.
25. Conditional rendering with reactive conditions must go through JSX
    (`<Show>`, or the `enabled` accessor of `useRenderElement`) — never early
    `return null` based on a reactive read.
26. `render` prop: function form `(props, state) => JSX` is called **once**;
    spreading `{...props}` in its JSX keeps everything reactive. The element form
    accepts a real DOM element (`render={<hr />}`). `React.cloneElement`-based
    logic does not exist; do not port checks that rely on element introspection.

## Types

27. `BaseUIComponentProps<'div', State>` exists with the same name/shape in
    `internals/types.ts` (Solid JSX based). `HTMLProps`, `NativeButtonProps`,
    `NonNativeButtonProps`, `Orientation` etc. are all there.
28. `React.CSSProperties` → `JSX.CSSProperties | string` (alias `StyleValue`).
    `import type { JSX } from '@solidjs/web'` (NOT from `solid-js`).
29. Solid's JSX types boolean attributes as `boolean | ""` (e.g. `disabled`).
    When a component reads such a prop, redeclare it as `boolean | undefined`
    in the component's Props interface (matching the React surface) — most
    Base UI prop interfaces already redeclare `disabled` with JSDoc anyway.

## Imports from `@base-ui/utils`

Import **pure, DOM-only modules directly** (they have no React dependency):
`empty`, `error`, `warn`, `clamp`, `mergeObjects`, `owner`, `shadowDom`,
`addEventListener`, `areArraysEqual`, `formatNumber`, `generateId`,
`isElementDisabled`, `useTimeout` (for the `Timeout` class), `useAnimationFrame`
(for `AnimationFrame`), `useInterval` (for `Interval`), `visuallyHidden` (styles —
but see rule 11), etc.
Never import React hook modules (`useControlled`, `useMergedRefs`, `useId`,
`useIsoLayoutEffect`, `useStableCallback`, ...) — use the Solid equivalents above.

## Testing

- Tests live next to sources (`Foo.test.tsx`), use Vitest globals +
  `@solidjs/testing-library` + `@testing-library/user-event` +
  `@testing-library/jest-dom` matchers.
- After a signal write, call `flush()` (from `solid-js`) before asserting.
- Port the intent of the React test file; skip tests that exercise React-only
  mechanics (cloneElement merging, SSR/hydration, `React.lazy`).
- Run: `pnpm vitest run src/<component>` and `pnpm exec tsc -p tsconfig.json`
  from `packages/solid` (prefix commands with
  `npm_config_verify_deps_before_run=false` in restricted environments).

## Exemplars

Study these before porting anything:
- `src/separator/Separator.tsx` — minimal component, render/class/style handling.
- `src/toggle/Toggle.tsx` — interactive: `useControlled`, `useButton`, event
  details, state attributes, group context.
- `src/internals/useRenderElement.tsx`, `src/merge-props/mergeProps.ts` — the engine.
