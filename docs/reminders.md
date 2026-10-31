# Reminders and email

Reminders are private therapist tasks. A reminder can be a normal dated task or a recurring post-session reminder associated with a client/session pattern. The Reminders page displays times formatted in the therapist's configured browser/application time zone without requiring the user to manage a separate timezone label.

## Delivery flow

1. FastAPI stores the reminder and next delivery time.
2. The reminder worker queries due reminders using the server-only service-role key.
3. The worker sends the message through Resend using `RESEND_FROM` and the therapist's configured recipient address.
4. Successful delivery updates delivery metadata and schedules the next occurrence when applicable.

Keep worker credentials out of API responses and frontend. A worker failure should be observable in systemd logs and should not prevent ordinary reminder CRUD operations.

## Configuration

Set `RESEND_API_KEY`, a verified `RESEND_FROM`, and the recipient email in the backend environment. Resend may require domain verification before production delivery. Do not use a real sender address in examples or tracked configuration.

## Testing

During development, create a near-future reminder and run the worker in the foreground with a development environment. Confirm the stored next-run/delivery state, inspect Resend response errors, and verify that retry behavior does not send duplicates.
