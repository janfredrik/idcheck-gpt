import nodemailer from "nodemailer";
import pg from "pg";

const required = ["DATABASE_URL", "SMTP_HOST", "SMTP_PORT", "SMTP_FROM"];
for (const key of required) if (!process.env[key]) throw new Error(`${key} is required for the notification worker`);
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
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

function messageFor(event) {
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

async function claim() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT id,attempt_id,event_type,recipient,created_at FROM notification_outbox WHERE ((status IN ('queued','failed') AND next_attempt_at <= now()) OR (status='sending' AND locked_at < now()-interval '10 minutes')) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1");
    const event = result.rows[0];
    if (!event) { await client.query("COMMIT"); return null; }
    await client.query("UPDATE notification_outbox SET status='sending',attempts=attempts+1,locked_at=now() WHERE id=$1", [event.id]);
    await client.query("COMMIT"); return event;
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
}

while (!stopping) {
  try {
    const event = await claim();
    if (!event) { await new Promise((resolve) => setTimeout(resolve, 1800)); continue; }
    const message = messageFor(event);
    try {
      await transport.sendMail({ from: process.env.SMTP_FROM, to: event.recipient, ...message });
      await pool.query("UPDATE notification_outbox SET status='sent',sent_at=now(),locked_at=NULL WHERE id=$1", [event.id]);
    } catch {
      await pool.query("UPDATE notification_outbox SET status='failed',next_attempt_at=now()+LEAST(interval '1 hour',interval '30 seconds'*power(2,LEAST(attempts,7))),locked_at=NULL WHERE id=$1", [event.id]).catch(() => undefined);
      // Keep credentials, message contents, and recipient out of process logs.
      process.stderr.write("idcheck notification delivery failed; queued retry scheduled\n");
    }
  } catch {
    process.stderr.write("idcheck notification worker encountered an internal error\n");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
await transport.close();
await pool.end();
