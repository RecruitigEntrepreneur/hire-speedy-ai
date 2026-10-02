// Versand von Interview-Mails, auf Wunsch mit echter Kalendereinladung.
// Outlook erkennt eine Einladung nur, wenn sie als text/calendar-Teil mit
// method=REQUEST im Mailtext steckt. Die Resend-API kann keine eigenen
// MIME-Teile, deshalb bauen wir die Mail selbst und schicken sie über
// Resend-SMTP (Port 465, direkt verschlüsselt; 25/587 sind in Edge Functions
// gesperrt). Scheitert SMTP, geht dieselbe Mail über die API mit .ics-Anhang.

export interface InterviewMail {
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  ics?: { content: string; method: 'REQUEST' | 'CANCEL' };
}

export interface MailResult { sent: boolean; via?: 'smtp' | 'api'; id?: string; error?: string }

const enc = new TextEncoder();

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export const base64Utf8 = (value: string) => b64(enc.encode(value));

const wrap76 = (value: string) => value.replace(/.{1,76}/g, (m) => m + '\r\n').trimEnd();

/** Kopfzeilen mit Umlauten nach RFC 2047 kodieren. */
export function encodeHeader(value: string): string {
  // deno-lint-ignore no-control-regex
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${base64Utf8(value)}?=`;
}

const address = (name: string, email: string) => `${encodeHeader(name.replace(/"/g, "'"))} <${email}>`;

export function buildMime(mail: InterviewMail, seed: string = crypto.randomUUID()): string {
  const mixed = `mix-${seed}`;
  const alt = `alt-${seed}`;
  const domain = mail.fromEmail.split('@')[1] ?? 'matchunt.ai';
  const head = [
    `From: ${address(mail.fromName, mail.fromEmail)}`,
    `To: ${mail.to}`,
    ...(mail.replyTo ? [`Reply-To: ${mail.replyTo}`] : []),
    `Subject: ${encodeHeader(mail.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${seed}@${domain}>`,
    'MIME-Version: 1.0',
  ];
  const part = (type: string, body: string, extra: string[] = []) =>
    [`Content-Type: ${type}`, 'Content-Transfer-Encoding: base64', ...extra, '', wrap76(base64Utf8(body))].join('\r\n');
  const alternative = [
    `--${alt}`, part('text/plain; charset=UTF-8', mail.text),
    `--${alt}`, part('text/html; charset=UTF-8', mail.html),
    ...(mail.ics ? [`--${alt}`, part(`text/calendar; charset=UTF-8; method=${mail.ics.method}`, mail.ics.content)] : []),
    `--${alt}--`,
  ].join('\r\n');
  if (!mail.ics) {
    return [...head, `Content-Type: multipart/alternative; boundary="${alt}"`, '', alternative, ''].join('\r\n');
  }
  return [
    ...head,
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    '',
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    alternative,
    `--${mixed}`,
    part('application/ics; name="einladung.ics"', mail.ics.content, ['Content-Disposition: attachment; filename="einladung.ics"']),
    `--${mixed}--`,
    '',
  ].join('\r\n');
}

/** Punkt am Zeilenanfang verdoppeln (SMTP-Regel), Zeilenenden auf CRLF bringen. */
export function dotStuff(raw: string): string {
  return raw.replace(/\r?\n/g, '\r\n').split('\r\n').map((l) => (l.startsWith('.') ? '.' + l : l)).join('\r\n');
}

async function smtpSend(raw: string, from: string, to: string, apiKey: string): Promise<void> {
  const conn = await Deno.connectTls({ hostname: 'smtp.resend.com', port: 465 });
  const reader = conn.readable.getReader();
  const writer = conn.writable.getWriter();
  const dec = new TextDecoder();
  let buffer = '';
  const readReply = async (): Promise<{ code: number; text: string }> => {
    const deadline = Date.now() + 20000;
    while (true) {
      const lines = buffer.split('\r\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) {
          const text = lines.slice(0, i + 1).join('\n');
          buffer = lines.slice(i + 1).join('\r\n');
          return { code: Number(lines[i].slice(0, 3)), text };
        }
      }
      if (Date.now() > deadline) throw new Error('SMTP-Zeitüberschreitung');
      const { value, done } = await reader.read();
      if (done) throw new Error('SMTP-Verbindung geschlossen');
      buffer += dec.decode(value);
    }
  };
  const command = async (line: string, expect: number[]) => {
    await writer.write(enc.encode(line + '\r\n'));
    const reply = await readReply();
    if (!expect.includes(reply.code)) throw new Error(`SMTP ${line.split(' ')[0]}: ${reply.text}`);
  };
  try {
    const greeting = await readReply();
    if (greeting.code !== 220) throw new Error(`SMTP-Begrüßung: ${greeting.text}`);
    await command('EHLO matchunt.ai', [250]);
    await command(`AUTH PLAIN ${base64Utf8(`\u0000resend\u0000${apiKey}`)}`, [235]);
    await command(`MAIL FROM:<${from}>`, [250]);
    await command(`RCPT TO:<${to}>`, [250, 251]);
    await command('DATA', [354]);
    await writer.write(enc.encode(dotStuff(raw) + '\r\n.\r\n'));
    const done = await readReply();
    if (done.code !== 250) throw new Error(`SMTP DATA: ${done.text}`);
    await writer.write(enc.encode('QUIT\r\n')).catch(() => {});
  } finally {
    try { reader.releaseLock(); writer.releaseLock(); conn.close(); } catch { /* bereits zu */ }
  }
}

async function apiSend(mail: InterviewMail, apiKey: string): Promise<MailResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${mail.fromName.replace(/[<>"]/g, '')} <${mail.fromEmail}>`,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      ...(mail.ics ? { attachments: [{ filename: 'einladung.ics', content: base64Utf8(mail.ics.content), content_type: `text/calendar; charset=UTF-8; method=${mail.ics.method}` }] } : {}),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { sent: false, via: 'api', error: `Resend ${res.status}: ${JSON.stringify(body)}` };
  return { sent: true, via: 'api', id: body?.id };
}

export interface MailerDeps { env: (key: string) => string | undefined; smtp?: typeof smtpSend; fetchApi?: typeof apiSend }

/** Schickt eine Interview-Mail. Mit Kalendereinladung zuerst per SMTP, sonst über die API. */
export async function sendInterviewMail(mail: InterviewMail, deps: MailerDeps = { env: (k) => Deno.env.get(k) }): Promise<MailResult> {
  const apiKey = deps.env('RESEND_API_KEY');
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY fehlt' };
  if (!mail.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.to)) return { sent: false, error: 'Keine gültige Empfängeradresse' };
  if (mail.ics && deps.env('INTERVIEW_SMTP_DISABLED') !== 'true') {
    try {
      await (deps.smtp ?? smtpSend)(buildMime(mail), mail.fromEmail, mail.to, apiKey);
      return { sent: true, via: 'smtp' };
    } catch (error) {
      console.warn('Interview-Mail per SMTP gescheitert, versuche API:', error instanceof Error ? error.message : error);
    }
  }
  try {
    return await (deps.fetchApi ?? apiSend)(mail, apiKey);
  } catch (error) {
    return { sent: false, via: 'api', error: error instanceof Error ? error.message : String(error) };
  }
}
