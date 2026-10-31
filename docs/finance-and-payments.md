# Finance and payments

## Monthly summary rules

Financial summaries are calculated for the selected calendar month, including occurrences generated from recurring definitions that have no end date. Completed meetings are chargeable and count toward amount owed. Scheduled, cancelled, and otherwise incomplete meetings do not count as owed; scheduled meetings are shown as anticipated instead.

The client and money-management pages show:

- charged: completed meeting fees in the selected month;
- paid: payment ledger entries recorded in the selected month, plus supported legacy payment data;
- owed: charged minus payments, never treating an anticipated session as a debt;
- anticipated: scheduled/incomplete fees that may become chargeable later.

The status is explicit: a completed meeting is marked as owed until payment records cover it.

## Payment ledger

Payments belong to a client and include an amount, currency/value normalized for storage, date, and optional note. The client detail page's Payment Logs tab is the audit trail. Avoid deleting or overwriting logs when correcting data; add a compensating entry or a clearly documented edit path.

## Currency

ILS is the canonical stored currency. The UI defaults to dollars for display, lets the therapist enter either ILS or USD, and remembers the last currency used for a meeting/client preference. Exchange rates are obtained by the backend; frontend conversion is presentation convenience only.

When adding financial calculations, use the shared currency helpers and keep rounding/display decisions separate from stored numeric values.
