# Security

- Supabase is server-side only. The frontend must not contain Supabase keys or call Supabase APIs.
- Auth is cookie-based. Use HTTPS in production so the auth cookie is protected in transit.
- Require authentication on every user data route and scope queries/mutations to the authenticated user.
- Keep `.env` files, service-role keys, Resend keys, and production domain-specific configuration out of Git.
- Use the authenticated Supabase path for normal API requests; reserve the service-role key for the reminder worker's narrow background job.
- Avoid logging client notes, payment details, tokens, or email credentials.
- Configure CORS to the exact frontend origin in production rather than using a wildcard.
- Treat client and payment information as sensitive healthcare/business data. Use least-privilege server access, backups, TLS, operating-system updates, and a documented retention policy before real-world use.

This documentation describes technical controls, not legal or regulatory compliance advice. Review local privacy, healthcare, and record-keeping requirements before production use.
