import type { MailReplyContacts } from './mail.ts';

function optionalMailbox(value: string | undefined, name: string) {
  const address = value?.trim();
  if (!address) return undefined;
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) {
    throw new Error(`${name} must be a single email address.`);
  }
  return address;
}

type MailEnvironment = Partial<Record<'MAIL_REPLY_TO'|'MAIL_SUPPORT_REPLY_TO',string>>;

export function mailReplyContacts(env: MailEnvironment = {
  MAIL_REPLY_TO: process.env.MAIL_REPLY_TO,
  MAIL_SUPPORT_REPLY_TO: process.env.MAIL_SUPPORT_REPLY_TO,
}): MailReplyContacts {
  return {
    general: optionalMailbox(env.MAIL_REPLY_TO, 'MAIL_REPLY_TO'),
    support: optionalMailbox(env.MAIL_SUPPORT_REPLY_TO, 'MAIL_SUPPORT_REPLY_TO'),
  };
}
