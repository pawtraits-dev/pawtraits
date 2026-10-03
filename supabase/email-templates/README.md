# Supabase auth emails (branded)

Paste each file into **Supabase → Authentication → Emails → Templates** (Message body, "Source" view) and set the subject. Same layout as the app’s emails (lib/messaging/templates/partials). Variables are Supabase’s ({{ .ConfirmationURL }}, {{ .Token }}, {{ .Email }}, {{ .NewEmail }}).

| Supabase template | File | Subject |
|---|---|---|
| Confirm signup | `confirm-signup.html` | Confirm your email for Pawtraits 🐾 |
| Reset password | `reset-password.html` | Reset your Pawtraits password |
| Magic link | `magic-link.html` | Your Pawtraits sign-in link |
| Change email address | `change-email.html` | Confirm your new email address |
| Invite user | `invite.html` | You’re invited to Pawtraits |
| Reauthentication | `reauthentication.html` | Your Pawtraits confirmation code |

The paw image loads from https://pawtraits.pics/assets/email/paw-96.png, so deploy the email refresh first.

Also in Supabase → Authentication → Emails → SMTP Settings: use custom SMTP (Resend: host smtp.resend.com, port 465, user `resend`, password = your Resend API key, sender `Pawtraits <noreply@pawtraits.pics>`). Supabase’s built-in sender is limited to a few emails an hour and comes from a Supabase address.
