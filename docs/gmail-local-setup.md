# Local Fendora email setup

Sender: officialfendora@gmail.com.

1. Sign into this Google account and enable 2-Step Verification.
2. Create an App Password named Fendora. Never use or share the normal Gmail password.
3. In apps/web/.env.local, set the following values, replacing the placeholder with the App Password without spaces. Replace existing values rather than creating duplicate settings.

```dotenv
MAIL_FROM="Fendora <officialfendora@gmail.com>"
SMTP_URL="smtps://officialfendora%40gmail.com:APP_PASSWORD_WITHOUT_SPACES@smtp.gmail.com:465"
```

Never commit this file. Do not paste the password into chat.

Do not start the sending worker until the existing email backlog has been reviewed: it may contain old test messages. The local-operations worker queues notifications but does not send them. Stop that worker before switching to the email-enabled worker to avoid competing for the operations lease.

After sender configuration and backlog review, run from apps/web:

```sh
npm run worker -- --loop
```

This worker sends queued emails, processes reminders and expires stock holds. It must remain running for these tasks. Local links point to localhost and are usable only on this computer. No hosting or public email release is implied.

Verify a controlled test message, then payment, preparation, ready, dispatch and delivery notifications. Admin Operations shows pending/failed mail and retry controls. Google acceptance does not guarantee inbox placement.

References: https://support.google.com/mail/answer/185833 and https://developers.google.com/workspace/gmail/imap/imap-smtp
