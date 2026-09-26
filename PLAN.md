# idcheck — implementeringsplan

Status: Implementering pågår. Kjerneflyten, Entra Graph-adapteren, ekte TAP-utstedelse, revisjons-/varslingskø, Docker Compose og GHCR-workflow er kodet. Lokal produksjonsbygging passerer. Demoen er ikke koblet mot en faktisk Entra-tenant ennå; konfigurasjon og tenanttest gjenstår.

## Mål for første leveranse

En kjørbar løsning på Unraid hvor brukeren velger organisasjon, skriver mobilnummer, simulerer godkjenning eller avvisning i Vipps, matches mot en ekte Entra-demotenant og kan få utstedt en ekte engangs-TAP.

Simuleringen er bevisst ikke identitetskontroll. Tillatelsen til å utstede ekte TAP kommer fra tilgang til det avskjermede testmiljøet, en fast konfigurert demotenant og eksplisitt godkjente testkontoer. Dette skal være synlig både i grensesnittet og i revisjonsloggen.

Produksjonsaktivering og ekte Vipps-integrasjon er senere leveranser. BankID vises som deaktivert med «Kommer senere».

## Beslutninger

- Simulert Vipps får utstede ekte TAP i én eksplisitt konfigurert demotenant.
- Demoen bruker en egen appregistrering som ikke gis rettigheter i produksjonstenants. Appregistreringen kan være multitenant for å teste onboardingmodellen.
- Demomodusen skal ikke kunne aktivere flere skrivbare tenants via nettleseren eller en callback.
- Bare eksplisitt oppførte Entra user object IDs kan få TAP i demomodusen. Mobilnummer alene gir ikke adgang til testkonto-listen.
- Demoen ligger bak tilgangskontroll i reverse proxy, eller er kun tilgjengelig over privat nett/VPN. Offentlig internett uten tilgangskontroll er ikke standardoppsettet.
- Organisasjonsregisteret og sikkerhetspolicyen administreres gjennom validert konfigurasjon i første versjon. Et offentlig administrasjonspanel inngår ikke.
- Det bygges ingen BankID-/Signicat-integrasjon nå, men identitetsleverandøren skal kunne byttes ut.
- Det brukes mobilnummer i `mobilePhone`, ikke fødselsnummer eller custom security attributes.
- Standard levetid er 60 minutter og `isUsableOnce: true`. Kundens TAP-policy kan begrense hvilken levetid som er tillatt.

## Teknisk oppdeling

Prosjektvalg: Next.js med TypeScript for grensesnitt og serverruter, PostgreSQL for varig tilstand og en varslingsarbeider fra samme containerimage. Eksakte støttede versjoner velges og låses ved oppstart av implementeringen.

Separate komponenter:

1. `IdentityProvider`: starter og fullfører identitetsflyten. Først `SimulatedVippsProvider`, senere ekte Vipps.
2. `DirectoryProvider`: søker og leser brukere i én valgt tenant.
3. `EligibilityPolicy`: avgjør om et entydig treff kan få TAP.
4. `TapIssuer`: oppretter TAP via Microsoft Graph.
5. `CredentialResolver`: returnerer app-ID og legitimasjon for valgt tenant. Først client secret, senere mulig sertifikat eller kundespesifikk app.
6. `AuditLog` og `NotificationOutbox`: registrerer forsøk og sender varsler med retry.

MSAL-instansene gjenbrukes per tenant og credential-konfigurasjon. Token- og Graph-operasjoner foregår bare på serveren. Det lages ingen egen access-token-cache ved siden av MSAL.

PostgreSQL lagrer tenantkonfigurasjonens referanser, kortlivede flyttransaksjoner, sesjoner, utstedelsesstatus, revisjonshendelser og varslingskø. TAP-verdier og client secrets lagres ikke i databasen. Database, låser og kø gjør at omstart eller flere samtidige forespørsler ikke opphever engangsreglene.

## Brukeropplevelse

1. Forside med norsk tekst, søkbar organisasjonsvelger og rolig animert bakgrunn. Animasjonen respekterer redusert bevegelse og skjuler ikke skjemaet.
2. Valgt organisasjon låses til servertransaksjonen. Bytte av organisasjon krever ny flyt.
3. Vipps er tilgjengelig; BankID er deaktivert.
4. Brukeren skriver mobilnummer, som normaliseres til E.164. Norske nasjonale numre behandles eksplisitt som +47.
5. En egen venteside viser «Venter på bekreftelse i Vipps» og knappene «Simuler godkjenning» og «Simuler avvisning». Testkontrollene er tydelig atskilt fra en ekte Vipps-bekreftelse.
6. Godkjenning konsumerer simuleringstransaksjonen på serveren og starter Graph-oppslag. Det gjøres ikke konto-oppslag før dette steget.
7. Ved ett tillatt treff vises maskert UPN og «Lag engangskode». Ellers vises alltid «Vi kunne ikke bekrefte identiteten din automatisk, kontakt IT-avdelingen».
8. Knappen sender POST til `/api/tap`. Serveren sjekker konto og policy på nytt og oppretter ekte TAP.
9. TAP vises én gang med kopieringsknapp, faktisk utløpstid og nedtelling. Sesjonen kan ikke brukes til ny utstedelse eller gjenhenting.
10. Brukeren får veiledning til Microsofts side for registrering av sikkerhetsinformasjon. TAP legges aldri i en lenke.

Alle sider i demomodusen viser «Simulert Vipps · ekte TAP i demotenant». Før utstedelse skal det fremgå at handlingen oppretter en reell innloggingskode.

## Sikkerhetsregler og isolasjon

### Før Graph-kall

- Tenant må komme fra serverens organisasjonsregister. Ingen klientstyrt Graph-URL, authority eller vilkårlig tenant-ID.
- I simulert modus må tenant-ID være identisk med den konfigurerte demotenanten.
- Oppstart av applikasjonen avvises hvis simulering er konfigurert sammen med andre skrivbare tenants eller mangler testkonto-listen.
- Testmiljøet må avskjermes før det eksponeres eksternt. En tydelig demotekst eller skjult URL er ikke tilgangskontroll.
- Flyten er bundet til en tilfeldig, kortlivet sesjon og engangs-state. Simuleringen behandles aldri som en ekte signert identitetsattest.

### Før godkjent treff og før TAP

- Hele det relevante oppslaget må fullføres; feil, avbrutt paginering eller uavklart resultat gir avvisning.
- Det skal finnes nøyaktig én konto med normalisert matchende mobilnummer i tenanten. Duplikater avvises før tillatelsesfiltrering.
- Kontoen skal være aktiv og være en tillatt intern medlemskonto.
- I demo må kontoens object ID stå i den eksplisitte testkonto-listen.
- Kontoen må være tillatt av `idcheck-enabled` og ikke omfattet av en sperreliste.
- Administratorer, nødtilgangskontoer og tjenestekontoer utelukkes. Rolleoppslag må dekke direkte roller, relevante gruppetildelinger og PIM-berettigelser før ekstern pilot. I den nåværende demoen er PIM-berettigelsessjekken midlertidig deaktivert fordi demotenanten mangler P2/Governance-lisens; aktive roller kontrolleres fortsatt.
- Kontoen skal omfattes av TAP-policyen, og ønsket levetid skal være tillatt. Første versjon kan støtte et avgrenset, dokumentert policyoppsett og avvise oppsett den ikke kan evaluere sikkert.
- Verifiseringen skal være fersk, og forsøksgrenser og utstedelseskarantene skal ikke være overskredet.
- Ukjent sikkerhetsstatus gir avvisning. Demoen skal aldri utelate kontroller fordi Graph svarer med feil.

Gruppen begrenser appens handlinger, men begrenser ikke den tenantvide Graph-applikasjonstillatelsen. Kundens tillit til appen og dens legitimasjon må beskrives i onboardingdokumentasjonen.

### Sesjoner og nettleser

- Cookie inneholder bare en ugjennomsiktig sesjonsreferanse; øvrige data ligger på serveren med kort TTL.
- `Secure`, `HttpOnly`, host-only cookies og passende `SameSite`.
- Ekte leverandør-callback via toppnivå-GET får en separat kortlivet Lax-korrelasjonscookie. Etterfølgende utstedelsesøkt kan bruke Strict.
- State/transaksjoner konsumeres atomisk på serveren. Cookie-sletting alene er utilstrekkelig.
- POST-only på endrende operasjoner, CSRF-token og Origin-kontroll.
- Ingen vilkårlig `returnUrl`; faste, eksakt registrerte callback-adresser.
- CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` og HTTPS.
- Ingen tredjepartsanalyse eller eksterne medieinnbygginger på identitets- og TAP-sidene.
- Rate limiting per IP, tenant og identitetsreferanse med betrodd proxykonfigurasjon. Mobilreferanser i begrensningstellerne pseudonymiseres med nøkkelbasert HMAC.
- Samme offentlige avvisningsmelding og responsstruktur for kontoavslag. Eksakte årsaker vises bare i beskyttet driftsinformasjon.

## TAP-utstedelse og feiltilstander

Tilstandsmodell: `started → awaiting_identity → verified → issuing → issued`, med avsluttende `rejected`, `expired` og `unknown` ved uavklart Graph-resultat.

- Serveren lagrer både tenant-ID og user-ID sammen med verifiseringstidspunktet.
- En atomisk overgang til `issuing` og en lås per tenant/bruker hindrer dobbeltklikk og parallelle flyter i å opprette flere TAP-er.
- Dersom et gyldig TAP allerede finnes, avvises ny selvbetjent utstedelse i første versjon. Ingen stille erstatning av en kode helpdesk eller en annen prosess kan ha opprettet.
- Graph-kallet setter eksplisitt `isUsableOnce: true` og validert levetid.
- Timeout eller prosesskrasj etter mulig Graph-opprettelse behandles som uavklart resultat. Ingen automatisk gjentakelse av POST.
- Uavklarte forsøk undersøkes ved hjelp av metode-metadata og revisjon; en eksisterende kode forsøkes ikke hentet eller vist igjen. En driftsprosedyre beskriver hvordan låsen kan avklares.
- En vellykket kode returneres bare i det opprinnelige svaret, med `Cache-Control: no-store`. Den lagres bare kortvarig i server-/nettleserminne.
- Ved mistet svar får brukeren ikke koden på nytt. Reload og tilbakeknapp skal ikke gjenopprette TAP fra applikasjonslagring.
- Nettleseren fjerner koden ved utløp. En engangskode kan allerede være brukt selv om nedtellingen fortsatt går.
- Rå Graph-responser, tokens, cookies og TAP må ikke havne i logger, feilverktøy, e-post eller proxyopptak.

## Varsler og revisjon

Et forsøk starter når brukeren sender organisasjon og mobilnummer for å begynne identitetsflyten. Hvert forsøk får en tilfeldig referanse og en start-hendelse. Avvisning, timeout, godkjenning og TAP-resultat registreres som senere hendelser.

Hvert forsøk skal varsles til tenantens konfigurerte kontaktperson, også avbrutte forsøk. Start og avslutning kan gi separate varsler, slik at det ikke kreves en callback for at forsøket blir synlig.

- Varslingsjobber lagres varig og leveres via konfigurert SMTP med retry.
- TAP, client secrets, rå identitetstokener og fullt mobilnummer inngår aldri i varslene.
- Hvis hendelse eller varslingsjobb ikke kan lagres, stoppes utstedelse.
- SMTP-feil etter varig kølegging håndteres med retry og driftsvarsel. Kølegging er ikke en garanti for at e-posten er mottatt.
- Testoppsettet kan bruke en lokal e-postmottaker; ekstern varslingslevering må testes før pilotbruk.
- Retensjon og dataminimering defineres i konfigurasjon og dokumenteres. Utgåtte identitets- og sesjonsdata ryddes automatisk.

## Entra-onboarding som skal leveres

Dokumentasjonen skal være en konkret oppskrift for app-eier og kundeadministrator, med egne steg for demotenanten.

### App-eier

1. Opprett dedikert appregistrering for demo og velg organisasjonskontoer i flere tenants.
2. Registrer den eksakte HTTPS-callbacken for admin consent.
3. Legg til application permissions og opprett client secret.
4. Oppbevar secret som runtime-hemmelighet på Unraid, aldri i Git, image eller frontend.
5. Dokumenter faktisk utløpsdato og rotasjon med overlapp før gammel secret utløper.

### Kunde-/demoadministrator

1. Gi admin consent med en rolle som kan godkjenne Microsoft Graph application permissions, for eksempel Privileged Role Administrator.
2. Opprett `idcheck-enabled` med direkte medlemskap for de valgte testkontoene i første pilot.
3. Kontroller mobilnumre og hvem som kan endre dem.
4. Aktiver TAP under Authentication methods-policyen for riktig målgruppe.
5. Tillat engangs-TAP og ønsket levetid innenfor policyens grenser.
6. Verifiser Conditional Access og at TAP kan brukes til å registrere ny MFA-metode.
7. Registrer kontaktperson, tillatte testkonto-ID-er og nødvendige gruppereferanser.
8. Kjør en lesende forhåndssjekk. Ekte TAP opprettes først ved den eksplisitte brukerhandlingen i flyten.

Planlagte Graph-rettigheter for den nåværende demoen: `User.Read.All`, `UserAuthMethod-TAP.ReadWrite.All`, `RoleManagement.Read.Directory` og `Policy.Read.AuthenticationMethod`. PIM-berettigelsessjekken må gjeninnføres før bruk i tenant med PIM. Ingen automatisk fallback til `UserAuthenticationMethod.ReadWrite.All`, og ingen custom security attribute-rettigheter nå.

Admin consent bruker tilfeldig engangs-state bundet til en autorisert onboardingøkt og forventet tenant. Slug er metadata på serveren, ikke state. Callbacken alene aktiverer ikke en tenant; faktisk Graph-tilgang må kontrolleres.

## Containere, GitHub Actions og Unraid

- Ett image med kommandoer for web, database-migrering og varslingsarbeider.
- Compose-oppsett med web, worker og PostgreSQL. Bare web eksponeres via reverse proxy; databasen er intern.
- Persistent databasevolum, dokumentert backup og gjenoppretting, healthchecks og restart-policy.
- Containerprosesser uten root og uten tilgang til Docker-socket. Secrets tilføres ved kjøring.
- `.env.example` uten hemmeligheter, eksempelkonfigurasjon for demo og Unraid-veiledning.
- GitHub Actions kjører typekontroll, lint, relevante tester og image-build på pull requests.
- Publisering til GHCR fra hovedgren og versjonstagger med begrenset workflow-token. Ubetrodde pull requests publiserer ikke og får ingen runtime-hemmeligheter.
- Images tagges med commit-SHA og versjon for reproduserbar utrulling og rollback.
- `linux/amd64` er første mål for Unraid. Ytterligere arkitekturer legges til ved behov.
- Databaseendringer og appversjoner dokumenteres slik at rollback ikke antar at enhver migrering er reversibel.

## Arbeidsrekkefølge og ferdigkriterier

### Milepæl 1 — prosjekt og gjennomgående demoflyt

Lever: prosjektstruktur, database, organisasjonsvelger, visuell forside, simulert Vipps og falsk katalog/TAP for automatisert lokal testing.

Ferdig når: godkjenning, avvisning, utløp og generisk feil kan gjennomføres uten eksterne tjenester; testmodus er tydelig synlig.

### Milepæl 2 — ekte demotenant og sperrer

Lever: MSAL, credential-oppslag, Graph-katalog, normalisering, testkonto-listen, tillatelses-/rollekontroller og lesende forhåndssjekk.

Ferdig når: valgt tenant og eksplisitte testkontoer er eneste mulige mål; feil tenant, duplikater, sperrede kontoer og usikre oppslag avvises med samme brukerrespons.

### Milepæl 3 — ekte TAP og varsling

Lever: atomisk utstedelse, kontroller mot eksisterende TAP, engangsvisning, købaserte varsler og revisjon.

Ferdig når: simulert godkjenning kan opprette ett ekte TAP på en godkjent testkonto, mens parallelle kall og replay ikke kan utstede flere; SMTP- og Graph-feil håndteres som beskrevet.

### Milepæl 4 — drift og dokumentasjon

Lever: Dockerfile, Compose, GitHub Actions/GHCR, Unraid-oppskrift, Entra-onboarding og driftsprosedyrer.

Ferdig når: image kan bygges, startes med tom database, migreres og omstartes uten å miste revisjon eller engangsstatus. Publisering og faktisk Unraid-utrulling verifiseres når repo og vert er tilgjengelige.

### Milepæl 5 — pilotgjennomgang

Lever: dokumentert test i demotenanten, inkludert faktisk innlogging med TAP og registrering av en ny metode på en disponibel testkonto.

Ferdig når: hele flyten er bekreftet i nettleser, ingen hemmeligheter finnes i logger, alle forsøk varsles, og relevante negative sikkerhetstester passerer.

## Tester som prioriteres

- Simulert identitet kan ikke utstede i en annen tenant, heller ikke med endret request body eller callback.
- En konto utenfor testkonto-listen kan aldri få TAP, selv ved korrekt mobilnummer.
- Telefonnormalisering, duplikater, null treff, deaktivert konto og rollekontroller.
- Tenantbytte, CSRF, utløpt state, replay, manipulert simulert godkjenning og sesjonsbytte.
- To samtidige `/api/tap`-kall og to uavhengige flyter mot samme bruker.
- Eksisterende TAP, Graph-timeout, prosesskrasj rundt opprettelse og forsøk etter omstart.
- Feil i database, varslingskø og SMTP.
- TAP og øvrige hemmeligheter er fraværende fra database, applikasjonslogger og proxylogger.
- Mobilvisning, tastaturnavigasjon, redusert bevegelse og full gjennomføring i nettleser.

Automatiserte tester bruker Graph-dobler. Reelle Graph-skriveoperasjoner kjøres bare i den dedikerte demotenanten og mot tillatte testkontoer; de kjøres ikke på vanlige pull requests.

## Opplysninger som trengs ved integrasjon, ikke for planlegging

- Demotenantens tenant-ID og testkontoenes object IDs.
- Appregistreringens client-ID og en secret som settes direkte i runtime-konfigurasjonen.
- Gruppereferanser og mobilnumre for testkontoene.
- Hostnavn/HTTPS-callback, ønsket tilgangskontroll og reverse proxy på Unraid.
- Varslingsadresse og SMTP-oppsett.
- GitHub-repo og ønsket synlighet for GHCR-imaget.

## Forbedringspotensial etter demo

- **Passkey-oppsett direkte på mobil:** Erstatt eller suppler nettleserveiledningen for Authenticator med en veiledning som viser hvordan brukeren registrerer en passkey direkte i Microsoft Authenticator-appen på mobilen, ved hjelp av TAP. Verifiser flyten mot demotenantens TAP-, autentiseringsmetode- og Conditional Access-policyer.
- **Kortere TAP-side:** Fjern teksten «Hvis du ikke ba om den, kontakt IT-avdelingen.» fra siden som viser engangskoden. Eventuell sikkerhetsbeskjed skal vurderes separat fra selve TAP-visningen.

## Dokumentasjonsgrunnlag

- Microsoft Graph TAP-opprettelse: https://learn.microsoft.com/en-us/graph/api/authentication-post-temporaryaccesspassmethods?view=graph-rest-1.0
- TAP-policy og bruk: https://learn.microsoft.com/en-us/entra/identity/authentication/howto-authentication-temporary-access-pass
- Graph-rettigheter: https://learn.microsoft.com/en-us/graph/permissions-reference
- Admin consent: https://learn.microsoft.com/en-us/entra/identity-platform/v2-admin-consent
- Vipps nettleserflyt: https://developer.vippsmobilepay.com/docs/APIs/login-api/api-guide/browser-flow-integration/

Dette dokumentet er en implementeringsplan, ikke en erklæring om at kontrollene allerede er implementert eller testet.
