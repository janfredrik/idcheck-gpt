"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

type Tenant = { id: string; name: string };
type Phase = "loading" | "setup" | "form" | "waiting" | "eligible" | "tap" | "done" | "failed";

const genericError = "Vi kunne ikke bekrefte identiteten din automatisk, kontakt IT-avdelingen.";
const guidePages = [
  { title: "Installer Microsoft Authenticator", eyebrow: "FØR DU BEGYNNER" },
  { title: "Logg inn med jobbbrukeren din", eyebrow: "1 · BRUKERNAVN" },
  { title: "Skriv inn engangskoden", eyebrow: "2 · TEMPORARY ACCESS PASS" },
  { title: "Velg Authenticator app", eyebrow: "3 · SIKKERHETSINFORMASJON" },
  { title: "Skann QR-koden og fullfør", eyebrow: "4 · REGISTRER APPEN" },
];

function StoreQr({ href, label }: { href: string; label: string }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(href, { width: 160, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => { if (active) setSource(url); })
      .catch(() => { if (active) setSource(""); });
    return () => { active = false; };
  }, [href]);

  return <a className="store-qr" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Åpne ${label}`}>
    {source ? <img src={source} alt={`QR-kode for ${label}`} /> : <span className="qr-loading" aria-hidden="true" />}
    <span className="qr-open">Åpne {label} <span aria-hidden="true">↗</span></span>
  </a>;
}

function MiniBrowser({ children }: { children: React.ReactNode }) {
  return <div className="mini-browser" aria-hidden="true"><div className="browser-bar"><i /><i /><i /><span>mysignins.microsoft.com/security-info</span></div>{children}</div>;
}

export function Demo() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [search, setSearch] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [mobile, setMobile] = useState("");
  const [attemptToken, setAttemptToken] = useState("");
  const [csrf, setCsrf] = useState("");
  const [account, setAccount] = useState("");
  const [tap, setTap] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [simulationReady, setSimulationReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [guideStep, setGuideStep] = useState(0);
  const [emailNoticeQueued, setEmailNoticeQueued] = useState(false);
  const [reference, setReference] = useState("");

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

  useEffect(() => { if (phase === "tap") setGuideStep(0); }, [phase]);

  const filteredTenants = useMemo(() => tenants.filter((item) => item.name.toLocaleLowerCase("no").includes(search.toLocaleLowerCase("no"))), [tenants, search]);

  async function beginFlow() {
    if (!tenant || busy) return;
    setBusy(true); setNotice(""); setReference("");
    try {
      const response = await fetch("/api/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: tenant.id, mobile }), cache: "no-store" });
      const result = await response.json();
      if (!result.ok) { setReference(typeof result.reference === "string" ? result.reference : ""); setNotice(genericError); setPhase("failed"); return; }
      setReference(typeof result.reference === "string" ? result.reference : ""); setAttemptToken(result.attemptToken); setPhase("waiting");
    } catch { setNotice(genericError); setPhase("failed"); }
    finally { setBusy(false); }
  }

  async function startSimulation(decision: "approved" | "denied") {
    if (!tenant || !attemptToken || busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id, mobile, decision, attemptToken }), cache: "no-store"
      });
      const result = await response.json();
      if (result.ok) { setReference(typeof result.reference === "string" ? result.reference : reference); setAccount(result.account); setCsrf(result.csrf); setPhase("eligible"); }
      else { setReference(typeof result.reference === "string" ? result.reference : reference); setAttemptToken(""); setNotice(genericError); setPhase("failed"); }
    } catch { setAttemptToken(""); setNotice(genericError); setPhase("failed"); }
    finally { setBusy(false); }
  }

  async function issueTap() {
    if (busy || !csrf) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/tap", { method: "POST", headers: { "X-CSRF-Token": csrf }, cache: "no-store" });
      const result = await response.json();
      if (!result.ok) { setReference(typeof result.reference === "string" ? result.reference : reference); setNotice(genericError); setPhase("failed"); setCsrf(""); return; }
      setReference(typeof result.reference === "string" ? result.reference : reference); setTap(result.tap); setExpiresAt(Date.parse(result.expiresAt)); setEmailNoticeQueued(result.emailNoticeQueued === true); setPhase("tap");
    } catch { setNotice(genericError); setPhase("failed"); setCsrf(""); }
    finally { setBusy(false); }
  }

  async function closeFlow() {
    setTap(""); setCsrf(""); setMobile(""); setAccount(""); setNotice(""); setTenant(null); setSearch(""); setGuideStep(0); setEmailNoticeQueued(false); setReference("");
    await fetch("/api/session", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptToken }), cache: "no-store" }).catch(() => undefined);
    setAttemptToken("");
    setPhase(tenants.length ? "form" : "setup");
  }

  function moveGuide(direction: -1 | 1) {
    setGuideStep((current) => Math.min(guidePages.length - 1, Math.max(0, current + direction)));
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const isTap = phase === "tap";

  return <main className={`shell${isTap ? " shell-guide" : ""}`}>
    <div className="aurora aurora-one" aria-hidden="true" />
    <div className="aurora aurora-two" aria-hidden="true" />
    <header className="topbar">
      <a className="brand" href="/" aria-label="idcheck hjem">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>idcheck<span className="brand-dot">.</span></span>
      </a>
      <div className="secure-label"><span className="lock-icon">⌑</span> Sikker kontogjenoppretting</div>
    </header>

    <section className={`hero${isTap ? " hero-guide" : ""}`}>
      <div className="stage-heading">
        <div>
          <span className="stage-eyebrow">{phase === "tap" ? "KONTOGJENOPPRETTING · STEG 3" : phase === "eligible" ? "KONTOGJENOPPRETTING · STEG 2" : "KONTOGJENOPPRETTING · STEG 1"}</span>
          <h1>{phase === "tap" ? "Sett opp Authenticator" : phase === "eligible" ? "Identiteten er bekreftet" : phase === "done" ? "Forespørselen er avsluttet" : "Få tilgang til kontoen"}</h1>
        </div>
        <div className="steps-rail" aria-label="Steg i gjenopprettingen">
          <span className={phase === "form" || phase === "waiting" ? "rail-active" : "rail-done"}><i>1</i> Identitet</span><b />
          <span className={phase === "eligible" ? "rail-active" : ["tap", "done"].includes(phase) ? "rail-done" : ""}><i>2</i> Bekreftelse</span><b />
          <span className={isTap ? "rail-active" : phase === "done" ? "rail-done" : ""}><i>3</i> Ny sikkerhetsmetode</span>
        </div>
      </div>

      <div className={`card-wrap${isTap ? " tap-wrap" : ""}`}>
        <section className={`recovery-card${isTap ? " is-tap" : ""}`}>
          {phase === "loading" && <div className="loading-state"><span className="spinner" /> Henter organisasjoner …</div>}

          {phase === "setup" && <div className="simple-state"><div className="result-icon">i</div><h2>Demomiljøet klargjøres</h2><p>Organisasjonen er ikke konfigurert ennå. Ta kontakt med IT-avdelingen.</p></div>}

          {(phase === "form" || phase === "waiting") && <div className="form-layout">
            <div className="form-main">
              <div className="card-head"><div><div className="card-kicker">BEKREFT KONTOEN DIN</div><h2>Velg organisasjon og mobilnummer</h2></div><span className="step-badge">01 / 03</span></div>
              <label className="field-label" htmlFor="org">ORGANISASJON</label>
              <div className="combobox-wrap">
                <span className="field-icon">⌂</span>
                <input id="org" role="combobox" aria-expanded={listOpen} aria-controls="org-list" aria-autocomplete="list" autoComplete="off" placeholder="Søk etter organisasjon" value={tenant?.name ?? search} disabled={phase === "waiting" || busy} onFocus={() => setListOpen(true)} onChange={(event) => { setTenant(null); setSearch(event.target.value); setListOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setListOpen(false); if (event.key === "Enter" && filteredTenants.length === 1) { setTenant(filteredTenants[0]); setSearch(""); setListOpen(false); } }} />
                <span className="chevron">⌄</span>
                {listOpen && <div className="tenant-list" id="org-list" role="listbox">{filteredTenants.length ? filteredTenants.map((item) => <button key={item.id} type="button" role="option" aria-selected={tenant?.id === item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setTenant(item); setSearch(""); setListOpen(false); }}>{item.name}<span>↗</span></button>) : <div className="no-results">Ingen treff. Kontroller skrivemåten.</div>}</div>}
              </div>

              <label className="field-label phone-label" htmlFor="mobile">MOBILNUMMER</label>
              <div className="phone-field"><span className="field-icon">⌕</span><span className="country-prefix">+47</span><span className="prefix-divider" /><input id="mobile" inputMode="tel" autoComplete="tel-national" placeholder="4xx xx xxx" value={mobile} onChange={(event) => setMobile(event.target.value.replace(/^\s*(?:\+47|0047)\s*/, ""))} disabled={phase === "waiting" || busy} /></div>

              {phase === "form" ? <>
                <button className="primary-button" type="button" disabled={!tenant || !mobile.trim() || busy} onClick={beginFlow}>{busy ? "Starter forespørsel …" : "Fortsett med Vipps"} <span aria-hidden="true">→</span></button>
              </> : <div className="simulation-panel">
                <div className="waiting-header"><span className="spinner" /><div><strong>Venter på bekreftelse i Vipps</strong><span>Demo: ingen Vipps-forespørsel er sendt.</span></div></div>
                {!simulationReady ? <p className="simulation-hint">Klargjør demosvar …</p> : <>
                  <div className="simulation-divider"><span>SIMULER VIPPS-RESULTAT</span></div>
                  <button className="approve-button" type="button" disabled={busy} onClick={() => startSimulation("approved")}>✓ &nbsp; Simuler godkjenning</button>
                  <button className="reject-button" type="button" disabled={busy} onClick={() => startSimulation("denied")}>Simuler avvisning</button>
                </>}
                <button className="text-button" type="button" disabled={busy} onClick={closeFlow}>Avbryt</button>
              </div>}
            </div>
            <aside className="form-side" aria-label="Om gjenopprettingen">
              <div className="side-illustration" aria-hidden="true"><span className="orbit orbit-a" /><span className="orbit orbit-b" /><div className="shield-art"><b>✓</b></div><span className="spark spark-a">✦</span><span className="spark spark-b">✦</span></div>
              <div className="side-caption"><span className="side-number">01</span><div><strong>Trygg vei tilbake</strong><p>Du bekrefter identiteten med Vipps før en engangskode kan opprettes.</p></div></div>
            </aside>
          </div>}

          {phase === "failed" && <div className="simple-state result-block error-block"><div className="result-icon error-icon">!</div><h2>Vi fikk ikke bekreftet deg</h2><p>{notice || genericError}</p>{reference && <p className="error-reference">Referanse: <code>{reference}</code></p>}<button className="primary-button" type="button" onClick={closeFlow}>Prøv igjen <span aria-hidden="true">→</span></button></div>}

          {phase === "eligible" && <div className="simple-state eligible-state">
            <div className="result-icon success-icon">✓</div><h2>Identiteten er bekreftet</h2>
            <p>Du kan opprette en engangskode for denne kontoen.</p>
            <div className="account-preview"><span className="avatar">{account.charAt(0).toUpperCase()}</span><div><small>BRUKERKONTO</small><strong>{account}</strong></div><span className="verified-mark">✓</span></div>
            <button className="primary-button" type="button" disabled={busy} onClick={issueTap}>{busy ? "Oppretter kode …" : "Lag engangskode"}<span aria-hidden="true">→</span></button>
            <button className="text-button" type="button" onClick={closeFlow}>Avbryt</button>
          </div>}

          {phase === "tap" && <div className="tap-layout">
            <aside className="tap-panel" aria-label="Din engangskode">
              <div className="card-head"><div><div className="card-kicker">TEMPORARY ACCESS PASS</div><h2>Engangskoden din</h2></div><span className="live-pill"><i /> Aktiv</span></div>
              <p className="tap-instruction">Bruk koden til å logge inn og registrere Microsoft Authenticator.</p>
              <div className="tap-code" aria-label="Engangskode">{tap}</div>
              <button className="copy-button" type="button" onClick={() => navigator.clipboard.writeText(tap).then(() => setNotice("Koden er kopiert."), () => setNotice("Kunne ikke kopiere. Marker koden og kopier den."))}>▢ &nbsp; Kopier engangskode</button>
              <div className="expiry-row"><span>Utløper om</span><strong>{minutes}:{seconds}</strong></div>
              <div className="expiry-track"><span style={{ width: `${Math.max(0, secondsLeft / 3600 * 100)}%` }} /></div>
              {notice && <p className="copy-notice" role="status">{notice}</p>}
              <div className="mail-notice"><span aria-hidden="true">✉</span><p>{emailNoticeQueued ? "Varsel er lagt i kø til e-postadressen i kontoen. Selve koden sendes aldri på e-post." : "Fant ingen gyldig e-postadresse i kontoen. Kontakt IT hvis du trenger varsel på e-post."}</p></div>
              <p className="tap-warning">Engangskoden kan bare brukes én gang. Hvis du ikke ba om den, kontakt IT-avdelingen.</p>
              <button className="text-button" type="button" onClick={() => { setTap(""); setPhase("done"); }}>Ferdig — fjern koden fra skjermen</button>
            </aside>

            <section className="guide-panel" aria-label="Veiledning for Microsoft Authenticator">
              <div className="guide-heading"><div><span className="card-kicker">SLIK KOMMER DU I GANG</span><h2>{guidePages[guideStep].title}</h2></div><span className="guide-count">{String(guideStep + 1).padStart(2, "0")} <i>/</i> {String(guidePages.length).padStart(2, "0")}</span></div>
              <div className="guide-progress" aria-hidden="true"><span style={{ width: `${((guideStep + 1) / guidePages.length) * 100}%` }} /></div>
              <div className="guide-slide" key={guideStep} aria-live="polite" aria-atomic="true">
                {guideStep === 0 && <div className="install-slide">
                  <div className="app-icon-large" aria-hidden="true"><span>✦</span></div>
                  <div className="install-copy"><span className="slide-eyebrow">{guidePages[guideStep].eyebrow}</span><h3>Last ned Microsoft Authenticator</h3><p>Skann QR-koden for telefonen din, eller åpne appbutikken direkte.</p></div>
                  <div className="store-options">
                    <div className="store-option"><StoreQr href="https://apps.apple.com/app/microsoft-authenticator/id983156458" label="App Store" /><div><strong>iPhone · iOS</strong><span>Last ned fra App Store</span><a href="https://apps.apple.com/app/microsoft-authenticator/id983156458" target="_blank" rel="noopener noreferrer">Åpne App Store ↗</a></div></div>
                    <div className="store-option"><StoreQr href="https://play.google.com/store/apps/details?id=com.azure.authenticator" label="Google Play" /><div><strong>Android</strong><span>Last ned fra Google Play</span><a href="https://play.google.com/store/apps/details?id=com.azure.authenticator" target="_blank" rel="noopener noreferrer">Åpne Google Play ↗</a></div></div>
                  </div>
                </div>}

                {guideStep === 1 && <div className="instruction-slide">
                  <div className="slide-visual"><MiniBrowser><div className="mock-signin"><div className="ms-mark"><i /><i /><i /><i /></div><strong>Logg på</strong><span>Jobb- eller skolekonto</span><div className="mock-input">navn@firma.no</div><div className="mock-next">Neste <b>→</b></div></div></MiniBrowser></div>
                  <div className="instruction-copy"><span className="slide-eyebrow">{guidePages[guideStep].eyebrow}</span><h3>Bruk jobb-e-postadressen din</h3><p>Åpne <a href="https://mysignins.microsoft.com/security-info" target="_blank" rel="noopener noreferrer">Sikkerhetsinformasjon</a>. Skriv inn brukernavnet (UPN) du bruker på jobb, og velg <strong>Neste</strong>.</p><span className="guide-tip">Bruk hele adressen, for eksempel navn@firma.no.</span></div>
                </div>}

                {guideStep === 2 && <div className="instruction-slide">
                  <div className="slide-visual"><MiniBrowser><div className="mock-signin mock-tap"><div className="ms-mark"><i /><i /><i /><i /></div><strong>Skriv inn passordet</strong><span>Bruk en midlertidig tilgangskode</span><div className="mock-input mock-code"><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="mock-next">Logg på <b>→</b></div></div></MiniBrowser></div>
                  <div className="instruction-copy"><span className="slide-eyebrow">{guidePages[guideStep].eyebrow}</span><h3>Bruk koden som vises her</h3><p>Velg alternativet for midlertidig tilgangskode og skriv inn TAP-en fra feltet til venstre. Koden er engangsbruk.</p><span className="guide-tip warning-tip">Ikke lukk denne siden før du er logget inn og har kopiert koden.</span></div>
                </div>}

                {guideStep === 3 && <div className="instruction-slide">
                  <div className="slide-visual"><MiniBrowser><div className="mock-security"><div className="security-top"><span>My Sign-ins</span><b>JD</b></div><strong>Sikkerhetsinformasjon</strong><div className="security-row"><span>＋</span><div><b>Legg til påloggingsmetode</b><small>Authenticator app</small></div><i>›</i></div><div className="security-row muted-row"><span>✓</span><div><b>Authenticator app</b><small>Microsoft Authenticator</small></div></div></div></MiniBrowser></div>
                  <div className="instruction-copy"><span className="slide-eyebrow">{guidePages[guideStep].eyebrow}</span><h3>Legg til en ny metode</h3><p>Etter innlogging åpnes Sikkerhetsinformasjon. Velg <strong>Legg til påloggingsmetode</strong>, deretter <strong>Authenticator app</strong> og <strong>Legg til</strong>.</p><span className="guide-tip">La nettleservinduet stå åpent — du skal snart skanne en QR-kode.</span></div>
                </div>}

                {guideStep === 4 && <div className="instruction-slide">
                  <div className="slide-visual final-visual"><div className="mock-phone"><div className="phone-notch" /><div className="phone-app-head"><span>Authenticator</span><b>＋</b></div><div className="phone-art"><span>✦</span><i>＋</i></div><strong>Legg til konto</strong><p>Jobb- eller skolekonto</p><div className="phone-scan"><span className="scan-corner corner-a" /><span className="scan-corner corner-b" /><span className="scan-corner corner-c" /><span className="scan-corner corner-d" /><b>Skann QR-koden<br />fra nettleseren</b></div><div className="phone-done">Konto lagt til <span>✓</span></div></div><div className="scan-arrow" aria-hidden="true">↗</div><div className="qr-placeholder"><span>QR</span><small>fra sikkerhetsinformasjon</small></div></div>
                  <div className="instruction-copy"><span className="slide-eyebrow">{guidePages[guideStep].eyebrow}</span><h3>Skann og bekreft kontoen</h3><p>I Authenticator: trykk <strong>＋</strong> → <strong>Jobb- eller skolekonto</strong> → <strong>Skann QR-kode</strong>. Skann koden som vises i nettleseren, og fullfør bekreftelsen.</p><span className="guide-tip warning-tip">Fullfør med en gang. Engangs-TAP kan ikke brukes på nytt, og registrering kan måtte fullføres innen 10 minutter.</span><a className="help-link" href="https://learn.microsoft.com/en-us/entra/identity/authentication/howto-authentication-temporary-access-pass" target="_blank" rel="noopener noreferrer">Microsofts veiledning ↗</a></div>
                </div>}
              </div>
              <div className="guide-controls">
                <button className="guide-prev" type="button" onClick={() => moveGuide(-1)} disabled={guideStep === 0}>← <span>Forrige</span></button>
                <div className="guide-dots" role="tablist" aria-label="Velg veiledningssteg">{guidePages.map((page, index) => <button key={page.eyebrow} type="button" role="tab" aria-selected={guideStep === index} aria-label={`Steg ${index + 1}: ${page.title}`} onClick={() => setGuideStep(index)} className={guideStep === index ? "active" : ""} />)}</div>
                {guideStep < guidePages.length - 1 ? <button className="guide-next" type="button" onClick={() => moveGuide(1)}>Neste <span aria-hidden="true">→</span></button> : <button className="guide-next finish-guide" type="button" onClick={() => { setTap(""); setPhase("done"); }}>Fjern koden <span aria-hidden="true">✓</span></button>}
              </div>
            </section>
          </div>}

          {phase === "done" && <div className="simple-state done-block"><div className="result-icon success-icon">✓</div><h2>Forespørselen er avsluttet</h2><p>{notice || "Engangskoden vises ikke igjen."}</p><button className="primary-button" type="button" onClick={closeFlow}>Tilbake til start <span aria-hidden="true">→</span></button></div>}
        </section>
      </div>
    </section>
  </main>;
}
