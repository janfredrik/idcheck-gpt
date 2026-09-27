"use client";

import QRCode from "qrcode";
import Image from "next/image";
import { useEffect, useState } from "react";

type Tenant = { id: string; name: string };
type Phase = "loading" | "setup" | "home" | "form" | "waiting" | "eligible" | "tap" | "done" | "failed";

const displayTenantName = "Dark Knight";

const genericError = "Vi kunne ikke bekrefte identiteten din automatisk, kontakt IT-avdelingen.";
const guidePages = [
  { title: "Installer Microsoft Authenticator", eyebrow: "FØR DU BEGYNNER" },
  { title: "Legg til jobb- eller skolekonto", eyebrow: "1 · LEGG TIL KONTO" },
  { title: "Logg inn med jobbbrukeren din", eyebrow: "2 · BRUKERNAVN" },
  { title: "Bruk engangskoden", eyebrow: "3 · TEMPORARY ACCESS PASS" },
  { title: "Opprett passkey i Authenticator", eyebrow: "4 · OPPRETT PASSKEY" },
  { title: "Aktiver passkey på mobilen", eyebrow: "5 · FULLFØR OPPSETTET" },
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

function AuthenticatorPhone({ children }: { children: React.ReactNode }) {
  return <div className="app-phone" aria-hidden="true"><div className="app-notch" /><div className="app-toolbar"><span>Authenticator</span><b>＋</b></div><div className="app-screen">{children}</div><div className="app-home-indicator" /></div>;
}

export function Demo() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [tenant, setTenant] = useState<Tenant | null>(null);
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
      setTenant(config.tenants[0]); setPhase("home");
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
      if (!result.ok) { setReference(typeof result.reference === "string" ? result.reference : reference); setNotice(typeof result.message === "string" ? result.message : genericError); setPhase("failed"); setCsrf(""); return; }
      setReference(typeof result.reference === "string" ? result.reference : reference); setTap(result.tap); setExpiresAt(Date.parse(result.expiresAt)); setEmailNoticeQueued(result.emailNoticeQueued === true); setPhase("tap");
    } catch { setNotice(genericError); setPhase("failed"); setCsrf(""); }
    finally { setBusy(false); }
  }

  async function closeFlow() {
    setTap(""); setCsrf(""); setMobile(""); setAccount(""); setNotice(""); setGuideStep(0); setEmailNoticeQueued(false); setReference("");
    await fetch("/api/session", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptToken }), cache: "no-store" }).catch(() => undefined);
    setAttemptToken("");
    setPhase(tenant ? "home" : "setup");
  }

  function moveGuide(direction: -1 | 1) {
    setGuideStep((current) => Math.min(guidePages.length - 1, Math.max(0, current + direction)));
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const isTap = phase === "tap";
  const isLanding = phase === "home";
  const accountDomain = account.includes("@") ? account.slice(account.lastIndexOf("@") + 1) : "";

  return <main className={`shell${isTap ? " shell-guide" : ""}`}>
    <div className="aurora aurora-one" aria-hidden="true" />
    <div className="aurora aurora-two" aria-hidden="true" />
    <header className="topbar">
      <a className="brand" href="/" aria-label="idcheck hjem">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>idcheck<span className="brand-dot">.</span></span>
      </a>
      <div className="secure-label"><span className="lock-icon">⌑</span> En løsning fra x99</div>
    </header>

    <section className={`hero${isTap ? " hero-guide" : ""}${isLanding ? " hero-landing" : ""}`}>
      {isLanding && <div className="landing-panel">
        <div className="landing-copy">
          <span className="landing-eyebrow"><i /> SELVBETJENT KONTOGJENOPPRETTING</span>
          <h1>idcheck <span className="landing-highlight">identifiserer deg</span> for å gi deg tilgang til kontoen din</h1>
        </div>
        <div className="landing-action">
          <div className="tenant-identity">
            <Image src="/dark-knight.png" alt="Dark Knight-logo" width={84} height={84} priority />
            <div><span>DEMOTENANT</span><strong>{displayTenantName}</strong></div>
            <span className="tenant-fixed" aria-label="Fast organisasjon">✓</span>
          </div>
          <p>Bekreft identiteten din med Vipps eller BankID (kommer) for å få tilgang til kontoen.</p>
          <button className="primary-button landing-button" type="button" onClick={() => setPhase("form")}>Start nå <span aria-hidden="true">→</span></button>
        </div>
      </div>}
      {!isLanding && <>
      <div className="stage-heading">
        <div>
          <span className="stage-eyebrow">{phase === "tap" ? "KONTOGJENOPPRETTING · STEG 3" : phase === "eligible" ? "KONTOGJENOPPRETTING · STEG 2" : phase === "done" ? "KONTOGJENOPPRETTING · FERDIG" : "KONTOGJENOPPRETTING · STEG 1"}</span>
          <h1>{phase === "tap" ? "Sett opp Authenticator" : phase === "eligible" ? "Identiteten er bekreftet" : phase === "done" ? "Forespørselen er avsluttet" : phase === "form" || phase === "waiting" ? "Skriv inn Vipps-nummeret ditt" : "Få tilgang til kontoen"}</h1>
        </div>
        <div className="steps-rail" aria-label="Steg i gjenopprettingen">
          <span className={phase === "form" || phase === "waiting" ? "rail-active" : phase === "eligible" || isTap || phase === "done" ? "rail-done" : ""}><i>1</i> Identitet</span><b />
          <span className={phase === "eligible" ? "rail-active" : ["tap", "done"].includes(phase) ? "rail-done" : ""}><i>2</i> Bekreftelse</span><b />
          <span className={isTap ? "rail-active" : phase === "done" ? "rail-done" : ""}><i>3</i> Ny sikkerhetsmetode</span>
        </div>
      </div>

      <div className={`card-wrap${isTap ? " tap-wrap" : ""}`}>
        <section className={`recovery-card${isTap ? " is-tap" : ""}`}>
          {phase === "loading" && <div className="loading-state"><span className="spinner" /> Klargjør sikker tilkobling …</div>}

          {phase === "setup" && <div className="simple-state"><div className="result-icon">i</div><h2>Demomiljøet klargjøres</h2><p>Organisasjonen er ikke konfigurert ennå. Ta kontakt med IT-avdelingen.</p></div>}

          {(phase === "form" || phase === "waiting") && <div className="form-layout">
            <form className="form-main" onSubmit={(event) => { event.preventDefault(); if (phase === "form") void beginFlow(); }}>
              <div className="card-head"><div><div className="card-kicker">BEKREFT KONTOEN DIN</div><h2>Skriv inn nummeret du bruker i Vipps</h2></div><span className="step-badge">01 / 03</span></div>
              <div className="tenant-mini"><Image src="/dark-knight.png" alt="" width={36} height={36} /><span>{displayTenantName}</span><i>Demotenant</i></div>
              <label className="field-label phone-label" htmlFor="mobile">VIPPS-NUMMER</label>
              <div className="phone-field"><span className="field-icon">⌕</span><span className="country-prefix">+47</span><span className="prefix-divider" /><input id="mobile" inputMode="tel" autoComplete="tel-national" placeholder="4xx xx xxx" value={mobile} onChange={(event) => setMobile(event.target.value.replace(/^\s*(?:\+47|0047)\s*/, ""))} disabled={phase === "waiting" || busy} /></div>

              {phase === "form" ? <>
                <button className="primary-button" type="submit" disabled={!tenant || !mobile.trim() || busy}>{busy ? "Starter forespørsel …" : "Fortsett med Vipps"} <span aria-hidden="true">→</span></button>
              </> : <div className="simulation-panel">
                <div className="waiting-header"><span className="spinner" /><div><strong>Venter på bekreftelse i Vipps</strong><span>Demo: ingen Vipps-forespørsel er sendt.</span></div></div>
                {!simulationReady ? <p className="simulation-hint">Klargjør demosvar …</p> : <>
                  <div className="simulation-divider"><span>SIMULER VIPPS-RESULTAT</span></div>
                  <button className="approve-button" type="button" disabled={busy} onClick={() => startSimulation("approved")}>✓ &nbsp; Simuler godkjenning</button>
                  <button className="reject-button" type="button" disabled={busy} onClick={() => startSimulation("denied")}>Simuler avvisning</button>
                </>}
                <button className="text-button" type="button" disabled={busy} onClick={closeFlow}>Avbryt</button>
              </div>}
            </form>
            <aside className="form-side" aria-label="Om gjenopprettingen">
              <div className="side-illustration" aria-hidden="true"><Image className="recovery-illustration" src="/recovery-security-illustration.png" alt="" width={1672} height={941} /></div>
              <div className="side-caption"><span className="side-number">01</span><div><strong>Trygg vei tilbake</strong><p>Du bekrefter identiteten med Vipps før en engangskode kan opprettes.</p></div></div>
            </aside>
          </div>}

          {phase === "failed" && <div className="simple-state result-block error-block"><div className="result-icon error-icon">!</div><h2>Forespørselen kunne ikke fullføres</h2><p>{notice || genericError}</p>{reference && <p className="error-reference">Referanse: <code>{reference}</code></p>}<button className="primary-button" type="button" onClick={closeFlow}>Prøv igjen <span aria-hidden="true">→</span></button></div>}

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
              <p className="tap-warning">Engangskoden kan bare brukes én gang.</p>
              <button className="text-button" type="button" onClick={() => { setTap(""); setPhase("done"); }}>Ferdig — fjern koden fra skjermen</button>
            </aside>

            <section className="guide-panel" aria-label="Veiledning for Microsoft Authenticator">
              <div className="guide-heading"><div><span className="card-kicker">SLIK KOMMER DU I GANG</span><h2>{guidePages[guideStep].title}</h2></div><span className="guide-count">{String(guideStep + 1).padStart(2, "0")} <i>/</i> {String(guidePages.length).padStart(2, "0")}</span></div>
              <div className="guide-progress" aria-hidden="true"><span style={{ width: `${((guideStep + 1) / guidePages.length) * 100}%` }} /></div>
              <div className="guide-slide" key={guideStep} aria-live="polite" aria-atomic="true">
                {guideStep === 0 && <div className="install-slide">
                  <div className="app-icon-large" aria-hidden="true"><Image src="/microsoft-authenticator-icon.png" alt="" width={1266} height={1243} /></div>
                  <div className="install-copy"><span className="slide-eyebrow">{guidePages[guideStep].eyebrow}</span><h3>Last ned Microsoft Authenticator</h3><p>Skann QR-koden for telefonen din, eller åpne appbutikken direkte.</p></div>
                  <div className="store-options">
                    <div className="store-option"><StoreQr href="https://apps.apple.com/app/microsoft-authenticator/id983156458" label="App Store" /><div><strong>iPhone · iOS</strong><span>Last ned fra App Store</span><a href="https://apps.apple.com/app/microsoft-authenticator/id983156458" target="_blank" rel="noopener noreferrer">Åpne App Store ↗</a></div></div>
                    <div className="store-option"><StoreQr href="https://play.google.com/store/apps/details?id=com.azure.authenticator" label="Google Play" /><div><strong>Android</strong><span>Last ned fra Google Play</span><a href="https://play.google.com/store/apps/details?id=com.azure.authenticator" target="_blank" rel="noopener noreferrer">Åpne Google Play ↗</a></div></div>
                  </div>
                </div>}

                {guideStep === 1 && <div className="instruction-slide">
                  <div className="slide-visual mobile-visual"><AuthenticatorPhone><div className="add-account-screen"><div className="phone-illustration"><span>✦</span><i>＋</i></div><p>La oss legge til din første konto!</p><button>Legg til konto</button><small>Jobb- eller skolekonto</small></div></AuthenticatorPhone></div>
                  <div className="instruction-copy"><span className="slide-eyebrow">{guidePages[guideStep].eyebrow}</span><h3>Start i Authenticator</h3><p>Åpne appen og trykk <strong>＋</strong> øverst. Velg <strong>Jobb- eller skolekonto</strong>, og trykk <strong>Logg på</strong>.</p><span className="guide-tip">Har du ikke lagt til en konto før, kan du også trykke «Legg til jobb- eller skolekonto» på startsiden.</span></div>
                </div>}

                {guideStep === 2 && <div className="instruction-slide">
                  <div className="slide-visual mobile-visual"><AuthenticatorPhone><div className="app-signin-screen"><div className="ms-mark"><i /><i /><i /><i /></div><strong>Logg på</strong><span>Jobb- eller skolekonto</span><div className="app-input">{account}</div><div className="app-blue-button">Neste <b>→</b></div></div></AuthenticatorPhone></div>
                  <div className="instruction-copy"><span className="slide-eyebrow">{guidePages[guideStep].eyebrow}</span><h3>Skriv inn jobbbrukeren din</h3><p>Skriv inn jobb-e-postadressen du vanligvis bruker til Microsoft 365. Domenet ditt er <strong>{accountDomain}</strong>.</p><span className="guide-tip">Bruk kontoen som fikk engangskoden. Av sikkerhetshensyn vises ikke hele e-postadressen.</span></div>
                </div>}

                {guideStep === 3 && <div className="instruction-slide">
                  <div className="slide-visual mobile-visual"><AuthenticatorPhone><div className="app-signin-screen app-tap-screen"><div className="ms-mark"><i /><i /><i /><i /></div><strong>Midlertidig tilgangskode</strong><span>Logg på med engangskoden</span><div className="app-input tap-dots"><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="app-blue-button">Logg på <b>→</b></div></div></AuthenticatorPhone></div>
                  <div className="instruction-copy"><span className="slide-eyebrow">{guidePages[guideStep].eyebrow}</span><h3>Logg inn med TAP</h3><p>Velg <strong>Midlertidig tilgangskode</strong> som innloggingsmåte hvis du blir spurt. Skriv inn koden fra feltet til venstre.</p><span className="guide-tip warning-tip">TAP-en kan bare brukes én gang. Fortsett oppsettet med en gang.</span></div>
                </div>}

                {guideStep === 4 && <div className="instruction-slide">
                  <div className="slide-visual mobile-visual"><AuthenticatorPhone><div className="account-added-screen"><div className="account-shield">✓</div><small>KONTO LAGT TIL</small><strong>Jobb- eller skolekonto</strong><div className="passkey-action"><span>◉</span><div><b>Opprett en passkey</b><small>Face ID, fingeravtrykk eller PIN</small></div><i>›</i></div><div className="app-blue-button">Opprett passkey <b>→</b></div></div></AuthenticatorPhone></div>
                  <div className="instruction-copy"><span className="slide-eyebrow">{guidePages[guideStep].eyebrow}</span><h3>Opprett passkey i appen</h3><p>Når kontoen er lagt til, åpne kontoen i Authenticator og trykk <strong>Opprett en passkey</strong>. Følg instruksjonene for å lagre passkey med Face ID, fingeravtrykk eller skjermlås. Når du blir bedt om å registrere mobilen, trykk <strong>Registrer enhet</strong> før du går videre til siste steg.</p></div>
                </div>}

                {guideStep === 5 && <div className="instruction-slide provider-slide">
                  <div className="slide-visual mobile-visual"><AuthenticatorPhone><div className="provider-screen"><div className="provider-icon">✓</div><strong>Passkey klar</strong><span>Authenticator er valgt som passkey-leverandør</span><div className="provider-toggle"><span>Authenticator</span><b>På</b><i>✓</i></div><small>Passkey lagres trygt på denne enheten</small></div></AuthenticatorPhone></div>
                  <div className="instruction-copy provider-copy"><span className="slide-eyebrow">{guidePages[guideStep].eyebrow}</span><h3>Slå på støtte på enheten</h3>
                    <div className="platform-steps"><div><strong>iPhone</strong><p>Krever iOS 17+. I Authenticator åpne <strong>Innstillinger</strong> og aktiver appen som passkey-leverandør. I iPhone-innstillinger: slå på Autofyll for passord og passkeys, og velg Authenticator.</p></div><div><strong>Android</strong><p>Krever Android 14+. Aktiver Authenticator som passkey-leverandør. Hvis du blir sendt til enhetsinnstillingene, velg Authenticator under <strong>Passord og kontoer → Flere leverandører</strong>.</p></div></div>
                    <a className="help-link" href="https://learn.microsoft.com/en-us/entra/identity/authentication/how-to-register-passkey-authenticator" target="_blank" rel="noopener noreferrer">Microsofts mobilveiledning ↗</a>
                  </div>
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
      </>}
    </section>
  </main>;
}
