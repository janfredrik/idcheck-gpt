# idcheck

Selvbetjent kontogjenoppretting for Microsoft Entra ID. Første versjon er avgrenset til én demotenant: brukeren skriver mobilnummer og velger et **simulert Vipps-svar**, mens konto-oppslag og eventuell TAP skjer mot den virkelige demotenanten.

> **Demoen utsteder ekte, innloggingsgyldige engangskoder.** Bruk en egen testtenant med disponibel testkonto. Skjerm tjenesten bak HTTPS og tilgangskontroll. Ikke bruk reelle ansattkontoer.

## Innhold

- Norsk, mobiltilpasset gjenopprettingsflyt med organisasjonssøk, stor arbeidsflate og bla-gjennom-guide for å sette opp en passkey direkte i Microsoft Authenticator med TAP. Guiden har QR-koder til App Store og Google Play.
- Simulert Vipps-godkjenning/avvisning; BankID er deaktivert.
- Ekte Graph-oppslag, fast tenant, testkonto-allowlist, gruppekrav, TAP-policy og fail-closed kontroll av aktive katalogroller. PIM-berettigelser kontrolleres ikke i denne demoen.
- Ekte 60-minutters engangs-TAP, vist kun i opprinnelig svar. TAP-verdien vises ikke igjen og sendes aldri på e-post.
- PostgreSQL for sesjoner, engangsutstedelse, rate limiting, revisjon og varslingskø.
- SMTP-varsler til IT ved forsøk og en egen sikkerhetsmelding til brukerens `mail`-adresse når TAP opprettes. Valgfritt SMS-varsel via Pling kan sendes til samme mobilnummer. Ingen varsler inneholder TAP-verdien.
- Docker Compose for Unraid og GitHub Actions for GHCR-image.

Ekte Vipps, BankID/Signicat, produksjonstenants og adminpanel er ikke med ennå.

## Entra-oppsett

### Egen appregistrering for demo

Opprett appregistreringen i din egen app-eier-tenant, med støtte for kontoer fra flere organisasjoner. Bruk en dedikert demoapp som ikke har produksjonstilgang. Registrer Web redirect URI-en `${PUBLIC_BASE_URL}/api/admin/consent-callback`; sett `PUBLIC_BASE_URL` til den eksakte HTTPS-origin-en appen skal bruke. Dette er bare callback for admin consent. Ekte Vipps redirect-URI kommer senere.

Legg til disse **Microsoft Graph / Application permissions**:

| Rettighet | Bruk |
|---|---|
| `User.Read.All` | Lese konto, mobilnummer, e-postadresse, status og medlemskap |
| `UserAuthMethod-TAP.ReadWrite.All` | Kontrollere eksisterende TAP og opprette TAP |
| `Policy.Read.AuthenticationMethod` | Kontrollere TAP-policyen |
| `RoleManagement.Read.Directory` | Kontrollere aktive katalogroller |

Før en lenke opprettes, fjern ubrukte Graph-rettigheter fra appregistreringen. idcheck ber om `.default`, så Microsofts consent-side viser samtlige rettigheter som er konfigurert på denne appen. For denne demoversjonen skal det bare være de fire over.

App-eieren logger inn på idcheck og åpner `/admin`, lager en kortlivet engangslenke og sender den til demotenantens administrator. Administratoren logger inn i riktig tenant og kontrollerer rettighetene før godkjenning. Microsoft returnerer nettleseren til den registrerte callbacken. Callbacken bruker `state` som utløper etter 15 minutter og kan bare brukes én gang; den kontrollerer også at appen faktisk kan kalle Graph med de nødvendige rettighetene. Hvis callbacken sier at tilgang ikke kan kontrolleres, opprett en ny lenke etter å ha rettet consent.

Microsoft Graph application permissions krever en administratorrolle som kan godkjenne Graph app roles, for eksempel **Privileged Role Administrator**. «API permissions» i appregistreringen betyr ikke i seg selv at kunden har gitt consent. Consent-lenken er låst til `DEMO_TENANT_ID`; den aktiverer ikke andre tenants.

Opprett en client secret og noter utløpsdatoen. Microsoft begrenser levetiden til opptil 24 måneder. Sett påminnelse om rotasjon før utløp, med overlapp mellom ny og gammel secret.

### Admin consent for demotenanten

Sett `PUBLIC_BASE_URL` til appens eksakte HTTPS-origin. Registrer callbacken `${PUBLIC_BASE_URL}/api/admin/consent-callback` under **Web → Redirect URIs** i demoappregistreringen. App-eieren åpner `https://<idcheck-host>/admin` med appens Basic Authentication og lager en engangslenke. Send lenken til en administrator i `DEMO_TENANT_ID`-tenanten, som logger inn hos Microsoft og kontrollerer rettighetslisten.

Etter godkjenning returnerer Microsoft administratorens nettleser til callbacken. Callbacken bruker en lagret engangs-`state` som utløper etter 15 minutter, kontrollerer tenant-ID og verifiserer Graph-tokenets nødvendige rettigheter. Den henter ikke TAP-verdier. Avvist eller utløpt resultat krever en ny lenke. Consent-lenken kan ikke legge til eller godkjenne andre tenants.

### Klargjør testkonto

Opprett en ikke-privilegert medlemskonto i demotenanten. Sett `mobilePhone` i E.164-format, for eksempel `+4741234567`. Bruk ikke gjestekonto, administrator, nødtilgangskonto eller tjenestekonto.

Opprett en sikkerhetsgruppe, for eksempel `idcheck-enabled`. Legg bare testkontoer i gruppen, og noter gruppens object ID og testkontoenes object IDs.

Gå til **Entra ID → Authentication methods → Policies → Temporary Access Pass**:

- Aktiver metoden og inkluder `idcheck-enabled`.
- Kontroller at policyen tillater 60 minutter og engangsbruk.
- For passkey i Authenticator: aktiver **Passkey (FIDO2)**, opprett en profil som tillater Microsoft Authenticator og målrett profilen mot testgruppen. Følg [Microsofts oppsett for Authenticator-passkeys](https://learn.microsoft.com/en-us/entra/identity/authentication/how-to-enable-authenticator-passkey).
- Kontroller at Conditional Access lar testkontoen registrere sikkerhetsinformasjon og bruke TAP til passkey-registreringen.
- Test at kontoen kan logge inn i Authenticator med TAP og opprette en passkey. Mobilkravene er iOS 17+ eller Android 14+; se [Microsofts mobilveiledning](https://learn.microsoft.com/en-us/entra/identity/authentication/how-to-register-passkey-authenticator).

idcheck endrer ikke Entra-policyer eller grupper automatisk. Ukjent eller utilstrekkelig oppsett gir avvisning.

### Runtime-konfigurasjon

Kopier `.env.example` til `.env` på serveren. Ikke legg `.env` i Git eller i image. Sett:

- `IDCHECK_MODE=demo`, `DEMO_ENABLED=true`, `DEMO_TAP_ENABLED=true`.
- `DEMO_TENANT_ID`, `DEMO_TENANT_NAME`, `DEMO_ALLOWED_USER_IDS` (komma-separerte object IDs) og `DEMO_ALLOWED_GROUP_ID`.
- `ENTRA_CLIENT_ID` og `ENTRA_CLIENT_SECRET` for demoappregistreringen.
- `ALERT_EMAIL` for demotenantens kontaktperson.
- `PUBLIC_BASE_URL` for den eksakte eksterne HTTPS-origin-en.
- `RATE_LIMIT_HMAC_KEY` med minst 32 tilfeldige bytes; generer med `openssl rand -hex 32`.
- Sterke, tilfeldige `POSTGRES_PASSWORD` og `APP_ACCESS_PASSWORD`. Heksadesimale passord for PostgreSQL unngår URL-escaping-problemer.
- SMTP-innstillinger. Varslingsarbeideren krever SMTP for å starte.
- Valgfritt: sett `SMS_SEND_ENABLED=true` og legg nettlesersesjonen fra Pling i `PLING_SESSION_COOKIE`. Når den er `false`, køes eller sendes ingen SMS. Konto-ID (`13144`) og avsender (`Vivicta`) er fastlåst i koden. Cookie er en innloggingshemmelighet og skal bare ligge i `.env` på serveren.

`.env.example` inneholder ingen fungerende tenant-ID eller hemmelighet. Ufullstendig konfigurasjon deaktiverer demoflyten. I produksjon kreves `APP_ACCESS_USER` og et passord på minst 20 tegn.

## Kjør med Docker Compose

Installer eller bruk Docker Compose på Unraid:

```sh
cp .env.example .env
# Fyll inn verdiene beskrevet over i .env.
docker compose up -d --build
docker compose ps
```

Appen lytter som standard bare på `127.0.0.1:3000`. Koble reverse proxy til denne porten, krev HTTPS, og sett/overskriv `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Host` og `X-Forwarded-Proto`. Ikke publiser PostgreSQL eller app-porten direkte på internett.

Ved bruk av publisert image, sett `IDCHECK_IMAGE=ghcr.io/<github-owner>/<repo>:<tag>` i `.env` og kjør:

```sh
docker compose pull
docker compose up -d
```

PostgreSQL bruker volumet `idcheck_data`. Ta backup og test gjenoppretting. Migrering kjøres før web og varslingsarbeider starter.

## GitHub Actions → GHCR

Push til `main` publiserer `main`, commit-SHA og `latest`. Semver-tag som `v0.1.0` publiserer versjonstaggen. Pull requests bygger uten å publisere. Workflowen bruker `GITHUB_TOKEN`; legg ingen Entra- eller SMTP-hemmeligheter i GitHub Actions.

Etter første publisering, velg synlighet for pakken under GitHub Packages. Unraid må ha lesetilgang dersom pakken er privat.

## Sikkerhetsgrenser for demo

- Simulert Vipps er ikke identitetsbevis. Testmiljøets tilgangskontroll og konto-allowlist avgrenser testen.
- Serveren er fastlåst til én tenant og ignorerer ikke en mismatch mellom tenant-ID i request og konfigurasjon.
- Krev eksakt, entydig `mobilePhone`-match. Duplikater og manglende treff avvises likt.
- Kontoen må være aktiv, intern, allowlistet, medlem av `idcheck-enabled`, omfattet av TAP-policyen og uten aktive Entra-roller. PIM-berettigelser kontrolleres ikke i denne demoversjonen fordi demotenanten mangler P2/Governance-lisens; ikke bruk oppsettet i en tenant der PIM-berettigelser er i bruk.
- Graph-feil gir avvisning. Mobilnummer lagres ikke i revisjon eller rate limiting, som bruker HMAC-referanser. Når SMS er aktivert, beholdes nummeret midlertidig i varslingskøen fram til ett sende-forsøk og redigeres deretter bort.
- TAP opprettes etter eksplisitt klikk. DB-lås serialiserer utstedelse per konto; et uavklart Graph-resultat forsøkes ikke automatisk på nytt.
- TAP vises én gang, med `no-store`, og går aldri i PostgreSQL, e-post eller SMS. Når det finnes en gyldig e-postadresse i `mail`-attributtet, legges et varsel til brukeren i SMTP-køen. Hvis SMS er aktivert, legges et tilsvarende varsel til mobilnummeret i køen. Meldingen sier at TAP-en ble opprettet, men inneholder ikke koden. SMS får ett sende-forsøk fordi Pling-kallet ikke har en idempotensnøkkel; dette begrenser risikoen for fakturerte duplikater. Mottakerdata redigeres bort fra kø-raden etter forsøket.
- CSRF-token, Origin-kontroll, `SameSite=Strict` og sikkerhetsheadere beskytter utstedelsesflyten.
- Forsøk registreres og varsel legges i kø før ventesiden vises. Avbrutte og utløpte forsøk varsles også.

Refresh etter at Graph har opprettet TAP kan ikke hente koden igjen. Et uavklart `issuing`-forsøk må undersøkes manuelt; kontroller Entra før låsen endres. E-postkøen prøver SMTP på nytt. «Sendt» betyr at SMTP godtok meldingen, ikke at mottakeren leste den. Revisjon og varslingsrader beholdes i 90 dager.

## Før ekstern pilot

Bruk VPN eller sterkere organisasjonsautentisering enn Basic Authentication. Gjennomgå tilgangsgrenser, tenant-spesifikke varsler, client-secret-rotasjon og alle avvisningstilfeller mot en dedikert testtenant. Ekte Vipps må erstatte simuleringen før denne brukes som identitetskontroll.
