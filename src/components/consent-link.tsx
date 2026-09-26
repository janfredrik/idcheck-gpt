"use client";
import { useState } from "react";

export function ConsentLink() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  async function create() {
    setBusy(true); setMessage(""); setUrl("");
    try {
      const response = await fetch("/api/admin/consent-link", { method: "POST", cache: "no-store" });
      const result = await response.json();
      if (!result.ok) { setMessage(result.message ?? "Kunne ikke opprette lenken."); return; }
      setUrl(result.url); setMessage("Lenken er klar og utløper om 15 minutter.");
    } catch { setMessage("Kunne ikke opprette lenken. Kontroller oppsettet og prøv igjen."); }
    finally { setBusy(false); }
  }
  return <div className="consent-tool">
    <button className="primary-button" type="button" disabled={busy} onClick={create}>{busy ? "Oppretter lenke …" : "Lag admin-consent-lenke"}<span aria-hidden="true">→</span></button>
    {message && <p className="consent-message" role="status">{message}</p>}
    {url && <div className="consent-url"><a href={url} target="_blank" rel="noopener noreferrer">{url}</a><button type="button" onClick={() => navigator.clipboard.writeText(url).then(() => setMessage("Lenken er kopiert."), () => setMessage("Marker og kopier lenken manuelt."))}>Kopier</button></div>}
  </div>;
}
