"use client";

import { useEffect, useMemo, useState } from "react";

type Tenant = { id: string; name: string };
type Phase = "loading" | "setup" | "form" | "waiting" | "eligible" | "tap" | "done" | "failed";

const genericError = "Vi kunne ikke bekrefte identiteten din automatisk, kontakt IT-avdelingen.";

export function Demo() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [search, setSearch] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [mobile, setMobile] = useState("");
  const [csrf, setCsrf] = useState("");
  const [account, setAccount] = useState("");
  const [tap, setTap] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [simulationReady, setSimulationReady] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/config", { cache: "no-store" }).then((response) => response.json()).then((config) => {
      if (!active) return;
      if (!config.enabled || !Array.isArray(config.tenants) || !config.tenants.length) { setPhase("setup"); return; }
      setTenants(config.tenants); setPhase("form");
    }).catch(() => { if (active) setPhase("setup"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (phase !== "waiting") { setSimulationReady(false); return; }
    const timer = window.setTimeout(() => setSimulationReady(true), 1600);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "tap") return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (!remaining) { setTap(""); setNotice("Koden er utløpt. Lukk denne siden og start en ny forespørsel."); setPhase("done"); }
    };
    update(); const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [phase, expiresAt]);

  const filteredTenants = useMemo(() => tenants.filter((item) => item.name.toLocaleLowerCase("no").includes(search.toLocaleLowerCase("no"))), [tenants, search]);

  async function startSimulation(decision: "approved" | "denied") {
    if (!tenant || busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id, mobile, decision }), cache: "no-store"
      });
      const result = await response.json();
      if (result.ok) { setAccount(result.account); setCsrf(result.csrf); setPhase("eligible"); }
      else { setNotice(genericError); setPhase("failed"); }
    } catch { setNotice(genericError); setPhase("failed"); }
    finally { setBusy(false); }
  }

  async function issueTap() {
    if (busy || !csrf) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/tap", { method: "POST", headers: { "X-CSRF-Token": csrf }, cache: "no-store" });
      const result = await response.json();
      if (!result.ok) { setNotice(genericError); setPhase("failed"); setCsrf(""); return; }
      setTap(result.tap); setExpiresAt(Date.parse(result.expiresAt)); setPhase("tap");
    } catch { setNotice(genericError); setPhase("failed"); setCsrf(""); }
    finally { setBusy(false); }
  }

  async function closeFlow() {
    setTap(""); setCsrf(""); setMobile(""); setAccount(""); setNotice(""); setTenant(null); setSearch("");
    await fetch("/api/session", { method: "DELETE", cache: "no-store" }).catch(() => undefined);
    setPhase(tenants.length ? "form" : "setup");
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return <main className="shell">
    <div className="aurora aurora-one" aria-hidden="true" />
    <div className="aurora aurora-two" aria-hidden="true" />
    <header className="topbar">
      <a className="brand" href="/" aria-label="idcheck hjem">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>idcheck<span className="brand-dot">.</span></span>
      </a>
      <div className="secure-label"><span className="lock-icon">⌑</span> Sikker kontogjenoppretting</div>
    </header>

    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-line" /> EN ENKLERE VEI TILBAKE</div>
        <h1>Tilgang igjen.<br /><span>Trygt og enkelt.</span></h1>
        <p className="intro">Bekreft identiteten din, og få en midlertidig innloggingskode fra IT-systemet til organisasjonen din.</p>
        <div className="trust-row">
          <div className="trust-icon">◈</div>
          <div><strong>Personvernet ditt først</strong><span>Opplysningene dine brukes bare til å bekrefte identiteten.</span></div>
        </div>
        <div className="steps-rail" aria-label="Steg i gjenopprettingen">
          <span className={phase === "form" ? "rail-active" : "rail-done"}>01 <i>Organisasjon</i></span><b />
          <span className={phase === "waiting" ? "rail-active" : ["eligible", "tap", "done"].includes(phase) ? "rail-done" : ""}>02 <i>Identitet</i></span><b />
          <span className={["eligible", "tap", "done"].includes(phase) ? "rail-active" : ""}>03 <i>Tilgang</i></span>
        </div>
      </div>

      <div className="card-wrap">
        <div className="card-glow" aria-hidden="true" />
        <section className="recovery-card" aria-live="polite">
          <div className="card-head">
            <div><div className="card-kicker">KONTOGJENOPPRETTING</div><h2>{phase === "tap" ? "Koden din er klar" : phase === "eligible" ? "Identiteten er bekreftet" : phase === "done" ? "Forespørselen er avsluttet" : "Kom i gang"}</h2></div>
            <span className="step-badge">{["tap", "done"].includes(phase) ? "03 / 03" : phase === "eligible" ? "02 / 03" : "01 / 03"}</span>
          </div>

          {phase === "loading" && <div className="loading-state"><span className="spinner" /> Henter organisasjoner …</div>}

          {phase === "setup" && <div className="setup-message"><span className="notice-symbol">i</span><div><strong>Demomiljøet klargjøres</strong><p>Organisasjonen er ikke konfigurert ennå. Ta kontakt med IT-avdelingen.</p></div></div>}

          {(phase === "form" || phase === "waiting") && <>
            <p className="card-intro">Velg organisasjonen din og skriv inn mobilnummeret som er registrert på kontoen.</p>
            <label className="field-label" htmlFor="org">ORGANISASJON</label>
            <div className="combobox-wrap">
              <span className="field-icon">⌂</span>
              <input id="org" role="combobox" aria-expanded={listOpen} aria-controls="org-list" aria-autocomplete="list" autoComplete="off" placeholder="Søk etter organisasjon" value={tenant?.name ?? search} onFocus={() => setListOpen(true)} onChange={(event) => { setTenant(null); setSearch(event.target.value); setListOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setListOpen(false); if (event.key === "Enter" && filteredTenants.length === 1) { setTenant(filteredTenants[0]); setSearch(""); setListOpen(false); } }} />
              <span className="chevron">⌄</span>
              {listOpen && <div className="tenant-list" id="org-list" role="listbox">{filteredTenants.length ? filteredTenants.map((item) => <button key={item.id} type="button" role="option" aria-selected={tenant?.id === item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setTenant(item); setSearch(""); setListOpen(false); }}>{item.name}<span>↗</span></button>) : <div className="no-results">Ingen treff. Kontroller skrivemåten.</div>}</div>}
            </div>

            <label className="field-label phone-label" htmlFor="mobile">MOBILNUMMER</label>
            <div className="phone-field"><span className="field-icon">⌕</span><span className="country-prefix">+47</span><span className="prefix-divider" /><input id="mobile" inputMode="tel" autoComplete="tel-national" placeholder="4xx xx xxx" value={mobile} onChange={(event) => setMobile(event.target.value)} disabled={phase === "waiting"} /></div>

            {phase === "form" ? <>
              <button className="primary-button" type="button" disabled={!tenant || !mobile.trim()} onClick={() => { setNotice(""); setPhase("waiting"); }}>Fortsett med Vipps <span aria-hidden="true">→</span></button>
              <div className="provider-row"><span className="vipps-chip"><b>V</b> Vipps</span><span className="provider-soon">BankID <small>Kommer senere</small></span></div>
              <p className="form-footnote"><span>♧</span> Vi sammenligner nummeret med organisasjonens kontoopplysninger.</p>
            </> : <div className="simulation-panel">
              <div className="waiting-header"><span className="spinner" /><div><strong>Venter på bekreftelse i Vipps</strong><span>Dette er en utviklingsdemo. Ingen Vipps-forespørsel er sendt.</span></div></div>
              {!simulationReady ? <p className="simulation-hint">Klargjør demosvar …</p> : <>
                <div className="simulation-divider"><span>SIMULER VIPPS-RESULTAT</span></div>
                <button className="approve-button" type="button" disabled={busy} onClick={() => startSimulation("approved")}>✓ &nbsp; Simuler godkjenning</button>
                <button className="reject-button" type="button" disabled={busy} onClick={() => startSimulation("denied")}>Simuler avvisning</button>
              </>}
              <button className="text-button" type="button" onClick={closeFlow}>Avbryt</button>
            </div>}
          </>}

          {phase === "failed" && <div className="result-block error-block"><div className="result-icon error-icon">!</div><p>{notice || genericError}</p><button className="primary-button" type="button" onClick={closeFlow}>Prøv igjen <span aria-hidden="true">→</span></button></div>}

          {phase === "eligible" && <div className="result-block">
            <div className="result-icon success-icon">✓</div>
            <p className="success-copy">Identiteten er bekreftet for kontoen</p>
            <div className="account-preview"><span className="avatar">{account.charAt(0).toUpperCase()}</span><div><small>BRUKERKONTO</small><strong>{account}</strong></div><span className="verified-mark">✓</span></div>
            <div className="real-tap-notice"><span>!</span><p><strong>Demo med ekte engangskode</strong><br />Neste steg oppretter en reell TAP i demotenanten. Bruk kun med en godkjent testkonto.</p></div>
            <button className="primary-button" type="button" disabled={busy} onClick={issueTap}>{busy ? "Oppretter kode …" : "Lag engangskode"}<span aria-hidden="true">→</span></button>
            <button className="text-button" type="button" onClick={closeFlow}>Avbryt</button>
          </div>}

          {phase === "tap" && <div className="tap-block">
            <div className="real-banner"><span>●</span> Ekte engangskode · demotenant</div>
            <p className="tap-instruction">Bruk denne koden til å logge inn og sette opp en ny sikkerhetsmetode. Koden vises bare her.</p>
            <div className="tap-code" aria-label="Engangskode">{tap}</div>
            <button className="copy-button" type="button" onClick={() => navigator.clipboard.writeText(tap).then(() => setNotice("Koden er kopiert."), () => setNotice("Kunne ikke kopiere. Marker koden og kopier den."))}>▢ &nbsp; Kopier kode</button>
            <div className="expiry-row"><span>Utløper om</span><strong>{minutes}:{seconds}</strong></div>
            <div className="expiry-track"><span style={{ width: `${Math.max(0, secondsLeft / 3600 * 100)}%` }} /></div>
            <p className="tap-warning">Lukk siden når du har kopiert koden. idcheck lagrer den ikke og kan ikke vise den igjen.</p>
            {notice && <p className="copy-notice" role="status">{notice}</p>}
            <button className="text-button" type="button" onClick={() => { setTap(""); setPhase("done"); }}>Ferdig — fjern koden fra skjermen</button>
          </div>}

          {phase === "done" && <div className="result-block done-block"><div className="result-icon success-icon">✓</div><p>{notice || "Forespørselen er avsluttet. Engangskoden vises ikke igjen."}</p><button className="primary-button" type="button" onClick={closeFlow}>Tilbake til start <span aria-hidden="true">→</span></button></div>}

          <div className="card-bottom"><span className="bottom-lock">⌑</span><span>Beskyttet tilkobling</span><span className="bottom-separator">·</span><span>Ingen passord lagres</span></div>
        </section>
        <p className="demo-note"><span className="demo-dot" /> DEMOMILJØ · SIMULERT VIPPS · EKTE TAP I DEMOTENANT</p>
      </div>
    </section>

    <footer className="footer"><span>© 2026 idcheck</span><span>Kontogjenoppretting med personvern i sentrum</span><a href="mailto:it@example.invalid">Trenger du hjelp?</a></footer>
  </main>;
}
