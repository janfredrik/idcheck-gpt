import nodemailer from "nodemailer";
import pg from "pg";

const required = ["DATABASE_URL", "SMTP_HOST", "SMTP_PORT", "SMTP_FROM", "ALERT_EMAIL"];
for (const key of required) if (!process.env[key]) throw new Error(`${key} is required for the notification worker`);
if (!Number.isInteger(Number(process.env.SMTP_PORT)) || Number(process.env.SMTP_PORT) < 1 || Number(process.env.SMTP_PORT) > 65535) throw new Error("SMTP_PORT must be a valid TCP port");
const smsSendingEnabled = process.env.SMS_SEND_ENABLED === "true";
const plingSessionCookie = process.env.PLING_SESSION_COOKIE?.trim() ?? "";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined, application_name: "idcheck-notifications" });
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
  connectionTimeout: 10000,
  socketTimeout: 15000
});
let stopping = false;
let lastPrune = 0;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

function messageFor(event) {
  if (event.event_type === "user_tap_notice") {
    const subject = "Engangskode opprettet for kontoen din";
    const text = `En midlertidig engangskode (TAP) ble opprettet for kontoen din i idcheck. Koden sendes aldri på e-post.\n\nHvis du ikke ba om dette, kontakt IT-avdelingen umiddelbart og be dem tilbakekalle engangskoden og undersøke kontoen.\n\nTidspunkt: ${new Date(event.created_at).toISOString()}. Referanse: ${event.attempt_id}.`;
    return { subject, text };
  }
  const names = {
    attempt_started: "Nytt idcheck-forsøk startet",
    attempt_rate_limited: "idcheck-forsøk stoppet av forsøksgrense",
    attempt_rejected: "idcheck kunne ikke bekrefte identiteten",
    attempt_verified: "idcheck identitet bekreftet",
    attempt_issued: "idcheck opprettet en engangskode",
    attempt_expired: "idcheck-forsøk utløpt",
    attempt_unknown: "idcheck fikk et uavklart resultat"
  };
  const label = names[event.event_type] ?? "idcheck-hendelse";
  return { subject: `[idcheck demo] ${label}`, text: `${label}. Tidspunkt: ${new Date(event.created_at).toISOString()}. Referanse: ${event.attempt_id}.\n\nIngen mobilnummer, identitetstoken eller engangskode er inkludert i varselet.` };
}

function smsText(reference) {
  return `En engangskode (TAP) ble opprettet for kontoen din i idcheck. Kontakt IT umiddelbart hvis dette ikke var deg. Referanse: ${reference} (testmiljø)`;
}

function mobileName(mobile) {
  const norwegian = /^\+47(\d{3})(\d{2})(\d{3})$/.exec(mobile);
  return norwegian ? `+47 ${norwegian[1]} ${norwegian[2]} ${norwegian[3]}` : mobile;
}

async function sendTapSms(event) {
  if (!smsSendingEnabled) throw new Error("SMS_DISABLED");
  if (!plingSessionCookie) throw new Error("PLING_SESSION_COOKIE_MISSING");
  if (!/^\+[1-9]\d{7,14}$/.test(event.recipient)) throw new Error("SMS_RECIPIENT_INVALID");
  const response = await fetch("https://login.pling.as/api/batches", {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "no,en-US;q=0.9,en;q=0.8",
      "Content-Type": "application/json;charset=utf-8",
      Cookie: plingSessionCookie,
      Origin: "https://login.pling.as",
      Referer: "https://login.pling.as/pling/send-text",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:154.0) Gecko/20100101 Firefox/154.0"
    },
    body: JSON.stringify({
      accountId: 13144,
      text: smsText(event.attempt_id),
      sender: "Vivicta",
      numberPoolId: null,
      scheduled: null,
      textMessages: [{ mobile: event.recipient }],
      recipients: [{ type: "MOBILE", name: mobileName(event.recipient), contactGroupId: null, contactId: null }],
      emails: [],
      price: 0,
      origin: "WEB",
      protocolId: 0,
      maxMessagesPerSecond: null,
      waveCount: null,
      waveIntervalMinutes: null
    }),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`PLING_HTTP_${response.status}`);
  const body = await response.json().catch(() => null);
  if (!body || typeof body.id !== "number" || body.status !== "PROCESSING") throw new Error("PLING_RESPONSE_INVALID");
}

async function claim() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT id,attempt_id,event_type,recipient,created_at FROM notification_outbox WHERE ((status IN ('queued','failed') AND next_attempt_at <= now()) OR (status='sending' AND locked_at < now()-interval '10 minutes' AND event_type <> 'user_tap_sms_notice')) AND (event_type <> 'user_tap_sms_notice' OR ($1 AND created_at > now()-interval '1 hour')) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1", [smsSendingEnabled]);
    const event = result.rows[0];
    if (!event) { await client.query("COMMIT"); return null; }
    await client.query("UPDATE notification_outbox SET status='sending',attempts=attempts+1,locked_at=now() WHERE id=$1", [event.id]);
    await client.query("COMMIT"); return event;
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
}

while (!stopping) {
  try {
    await pool.query("WITH expired AS (UPDATE attempts SET outcome='expired',reason_code='FLOW_EXPIRED',finished_at=now() WHERE outcome='started' AND created_at < now()-interval '5 minutes' RETURNING id) INSERT INTO notification_outbox (attempt_id,event_type,recipient) SELECT id,'attempt_expired',$1 FROM expired", [process.env.ALERT_EMAIL]);
    await pool.query("WITH expired_sessions AS (UPDATE flow_sessions SET status='expired' WHERE status='verified' AND expires_at < now() RETURNING attempt_id), expired_attempts AS (UPDATE attempts a SET outcome='expired',reason_code='FLOW_EXPIRED',finished_at=now() FROM expired_sessions s WHERE a.id=s.attempt_id AND a.outcome='verified' RETURNING a.id) INSERT INTO notification_outbox (attempt_id,event_type,recipient) SELECT id,'attempt_expired',$1 FROM expired_attempts", [process.env.ALERT_EMAIL]);
    await pool.query("WITH uncertain AS (UPDATE flow_sessions SET status='unknown' WHERE status='issuing' AND created_at < now()-interval '15 minutes' RETURNING attempt_id), marked AS (UPDATE attempts a SET outcome='unknown',reason_code='ISSUANCE_STALE',finished_at=now() FROM uncertain u WHERE a.id=u.attempt_id AND a.outcome='verified' RETURNING a.id) INSERT INTO notification_outbox (attempt_id,event_type,recipient) SELECT id,'attempt_unknown',$1 FROM marked", [process.env.ALERT_EMAIL]);
    if (Date.now() - lastPrune > 60 * 60 * 1000) {
      await pool.query("DELETE FROM flow_sessions WHERE expires_at < now()-interval '1 day'");
      await pool.query("DELETE FROM notification_outbox WHERE created_at < now()-interval '90 days' AND status IN ('sent','failed')");
      await pool.query("DELETE FROM attempts a WHERE created_at < now()-interval '90 days' AND NOT EXISTS (SELECT 1 FROM notification_outbox o WHERE o.attempt_id=a.id) AND NOT EXISTS (SELECT 1 FROM flow_sessions s WHERE s.attempt_id=a.id)");
      await pool.query("DELETE FROM admin_consent_states WHERE expires_at < now()-interval '1 day'");
      lastPrune = Date.now();
    }
    await pool.query("UPDATE notification_outbox SET status='failed',next_attempt_at='infinity',locked_at=NULL,recipient='[redacted]' WHERE event_type='user_tap_sms_notice' AND status IN ('queued','sending','failed') AND (created_at <= now()-interval '1 hour' OR $1=false)", [smsSendingEnabled]);
    const event = await claim();
    if (!event) { await new Promise((resolve) => setTimeout(resolve, 1800)); continue; }
    try {
      if (event.event_type === "user_tap_sms_notice") {
        await sendTapSms(event);
        await pool.query("UPDATE notification_outbox SET status='sent',sent_at=now(),locked_at=NULL,recipient='[redacted]' WHERE id=$1", [event.id]);
      } else {
        const message = messageFor(event);
        await transport.sendMail({ from: process.env.SMTP_FROM, to: event.recipient, ...message });
        await pool.query("UPDATE notification_outbox SET status='sent',sent_at=now(),locked_at=NULL,recipient=CASE WHEN event_type='user_tap_notice' THEN '[redacted]' ELSE recipient END WHERE id=$1", [event.id]);
      }
    } catch {
      if (event.event_type === "user_tap_sms_notice") {
        // The endpoint provides no idempotency key. A retry could charge for and send a duplicate SMS.
        await pool.query("UPDATE notification_outbox SET status='failed',next_attempt_at='infinity',locked_at=NULL,recipient='[redacted]' WHERE id=$1", [event.id]).catch(() => undefined);
      } else {
        await pool.query("UPDATE notification_outbox SET status='failed',next_attempt_at=now()+LEAST(interval '1 hour',interval '30 seconds'*power(2,LEAST(attempts,7))),locked_at=NULL WHERE id=$1", [event.id]).catch(() => undefined);
      }
      // Keep credentials, message contents, and recipient out of process logs.
      process.stderr.write("idcheck notification delivery failed\n");
    }
  } catch {
    process.stderr.write("idcheck notification worker encountered an internal error\n");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
await transport.close();
await pool.end();
