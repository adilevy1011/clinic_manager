# Frontend conventions

## Pages and navigation

Each top-level tab has its own HTML file and uses extensionless production URLs. Shared navigation is rendered by the page view helpers. Keep only the intended three summary tabs inside “Your Day”; calendar and other major areas belong to their own pages.

## JavaScript boundaries

- `api.js`: authenticated fetch helpers and endpoint paths.
- `data.js`: demo data and local fallback behavior.
- `currency.js`: conversion and input synchronization.
- `format.js`: dates, amounts, labels, and safe display formatting.
- `views.js`: pure-ish HTML rendering helpers.
- `main.js`: bootstrapping, event binding, navigation, and API orchestration.

Avoid direct fetch calls scattered through views. Use event delegation or guarded bindings where practical, because different HTML pages intentionally contain different elements. If an element is optional, check that it exists before setting `onsubmit`, `onclick`, or other properties.

## Forms and dialogs

Custom dropdowns and custom dialogs are part of the product UI. Preserve keyboard/focus behavior and scrollable modal bodies when adding fields. Recurrence edit/delete choices must use the custom dialog so the user can choose single, future, or entire-series behavior.

## Accessibility and responsive behavior

Keep labels associated with inputs, use buttons for actions, retain visible focus states, and test long forms on a narrow viewport. Editing cards and dialogs must scroll within the viewport instead of hiding lower fields behind the browser edge.
