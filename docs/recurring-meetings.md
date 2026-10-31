# Recurring meetings

## Series model

A recurring meeting is one definition row with a `series_id`, a JSON `recurrence_rule`, a start date/time, and an optional `recurrence_end_date`. The rule can describe weekly selected weekdays or monthly day-of-month recurrence with an interval. For example, monthly day `15` and interval `1` means the 15th of every month; interval `2` means every other month.

The API expands a definition for the requested month. The frontend can therefore show future occurrences even when there is only one database row. An occurrence carries the series identity and occurrence date so editing controls can act on the definition correctly.

## Exceptions and splits

- Edit this occurrence: create an exception row for the exact occurrence and a standalone replacement row.
- Delete this occurrence: create an exception row marking that exact occurrence cancelled.
- Edit the whole series: update the definition row.
- Delete the whole series: delete the definition row and its related series data according to the route behavior.
- Edit future occurrences: set the old definition's end date immediately before the selected occurrence and create a new definition beginning at that occurrence.
- Delete future occurrences: set the old definition's end date immediately before the selected occurrence.

These choices are presented in the custom in-app dialog; do not use the browser's native `prompt()` or `confirm()` for recurrence decisions.

## Important edge cases

- A monthly day that does not exist in a month is skipped rather than silently moved to another date.
- End dates are inclusive for the definition's valid occurrence range.
- Exceptions use exact date/time identity so one occurrence can be removed without changing other weeks/months.
- Time zone labels are preserved as entered; changing the therapist's display time zone does not rewrite existing stored meeting times.

When changing recurrence behavior, update backend expansion logic, API response metadata, edit/delete flows, and tests together.
