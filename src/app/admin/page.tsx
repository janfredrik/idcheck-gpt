import { ConsentLink } from "@/components/consent-link";
import { getDemoConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export default function AdminPage() {
  const ready = Boolean(getDemoConfig() && process.env.PUBLIC_BASE_URL);
  return <main className="admin-shell">
    <a className="brand admin-brand" href="/">idcheck<span className="brand-dot">.</span></a>
    <section className="admin-card">
      <div className="card-kicker">OPPSETT · DEMOTENANT</div>
      <h1 className="admin-title">Koble til Entra ID</h1>
      <p className="admin-copy">Opprett en tidsbegrenset admin-consent-lenke for den ene demotenanten. Microsoft viser Graph-rettighetene som appen ber om før administratoren godkjenner dem.</p>
      {ready ? <ConsentLink /> : <p className="setup-alert">Fyll inn tenant, app, URL og testkonto-innstillinger i runtime-konfigurasjonen først.</p>}
      <p className="admin-footnote">Lenken utløper etter 15 minutter og kan bare brukes én gang. Registrer callbacken som nøyaktig Web redirect URI i appregistreringen.</p>
    </section>
  </main>;
}
