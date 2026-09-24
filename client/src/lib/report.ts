export const TEMPLATES: Record<string, { label: string; body: string }> = {
  standard: {
    label: "Bug Bounty Standard",
    body: `# [Vulnerability Title]

## Summary

A concise, impact-first description of the vulnerability.

## Affected Asset

\`https://api.example.com\`

## Severity

High

## Preconditions

- Authenticated user account

## Steps to Reproduce

1. Step one
2. Step two
3. Step three

## Proof of Concept

\`\`\`http
GET /api/v1/users/123 HTTP/2
Host: api.example.com
Authorization: Bearer [REDACTED]
\`\`\`

## Expected Result

The server should reject access to other users' resources.

## Actual Result

The server returns another user's data.

## Impact

Describe the concrete impact to users and the business.

## Remediation

Enforce object-level authorization on every request.

## References

- OWASP API1:2023
`,
  },
  deepdive: {
    label: "Technical Deep-Dive",
    body: `# [Vulnerability Title]

## Summary

## Root Cause

## HTTP Flow

\`\`\`http
POST /oauth/token HTTP/2
Host: example.com
\`\`\`

## Technical Analysis

## Exploitation Chain

1.
2.

## Impact

## Remediation

## References
`,
  },
  exec: {
    label: "Executive Summary",
    body: `# [Vulnerability Title] — Executive Summary

**Severity:** High
**Affected system:**

## What is the issue?

## What is the risk?

## What should be done?
`,
  },
};

export const SNIPPETS: Record<string, string> = {
  "HTTP Request": "```http\nGET /api/v1/resource HTTP/2\nHost: example.com\nAuthorization: Bearer [REDACTED]\n```\n",
  "HTTP Response": "```http\nHTTP/2 200 OK\nContent-Type: application/json\n\n{\n  \"id\": 123\n}\n```\n",
  "cURL": "```bash\ncurl -i 'https://example.com/api/v1/resource' \\\n  -H 'Authorization: Bearer [REDACTED]'\n```\n",
  "JSON": "```json\n{\n  \"key\": \"value\"\n}\n```\n",
  "Impact statement": "## Impact\n\nAn attacker can ... affecting ... users.\n",
  "Remediation": "## Remediation\n\n- \n",
  "CVSS": "**CVSS 3.1:** 7.5 (High) — `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N`\n",
};

// Quality checklist — section presence detection
export const QUALITY_SECTIONS = [
  { key: "title", label: "Title", test: (s: string) => /^#\s+\S/m.test(s) },
  { key: "affected", label: "Affected asset", test: (s: string) => /affected|asset/i.test(s) },
  { key: "severity", label: "Severity", test: (s: string) => /severity/i.test(s) },
  { key: "summary", label: "Summary", test: (s: string) => /##\s*summary/i.test(s) },
  { key: "precond", label: "Preconditions", test: (s: string) => /precondition/i.test(s) },
  { key: "repro", label: "Reproduction", test: (s: string) => /reproduc|steps to/i.test(s) },
  { key: "poc", label: "Proof of concept", test: (s: string) => /proof of concept|```http|```bash/i.test(s) },
  { key: "impact", label: "Impact", test: (s: string) => /##\s*.*impact/i.test(s) },
  { key: "remediation", label: "Remediation", test: (s: string) => /remediation|mitigation/i.test(s) },
  { key: "cvss", label: "CVSS", test: (s: string) => /cvss/i.test(s) },
  { key: "refs", label: "References", test: (s: string) => /##\s*reference/i.test(s) },
];

// Secret detection patterns
export const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "JWT", re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { name: "AWS Access Key", re: /AKIA[0-9A-Z]{16}/g },
  { name: "Bearer token", re: /Bearer\s+(?!\[REDACTED\])[A-Za-z0-9._-]{16,}/g },
  { name: "Authorization header", re: /Authorization:\s*(?!Bearer \[REDACTED\])\S{16,}/g },
  { name: "Private IP", re: /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/g },
  { name: "Email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { name: "Generic API key", re: /(?:api[_-]?key|secret|token)["'\s:=]+[A-Za-z0-9._-]{20,}/gi },
];

export function scanSecrets(text: string) {
  const found: { name: string; value: string }[] = [];
  const seen = new Set<string>();
  for (const p of SECRET_PATTERNS) {
    const matches = text.match(p.re);
    if (matches) for (const m of matches) {
      const key = `${p.name}:${m}`;
      if (!seen.has(key)) { seen.add(key); found.push({ name: p.name, value: m }); }
    }
  }
  return found;
}

export function redactAll(text: string) {
  let out = text;
  out = out.replace(SECRET_PATTERNS[0].re, "[REDACTED-JWT]");
  out = out.replace(SECRET_PATTERNS[1].re, "[REDACTED-AWS-KEY]");
  out = out.replace(SECRET_PATTERNS[2].re, "Bearer [REDACTED]");
  out = out.replace(SECRET_PATTERNS[3].re, "Authorization: [REDACTED]");
  out = out.replace(SECRET_PATTERNS[6].re, (m) => m.replace(/[A-Za-z0-9._-]{20,}/, "[REDACTED]"));
  return out;
}

export function reportBodyFromFinding(f: any, assetName?: string, endpointPath?: string) {
  const target = assetName || endpointPath ? `${assetName ?? ""}${endpointPath ? ` — \`${endpointPath}\`` : ""}` : "`[affected asset]`";
  return `# ${f.title}

## Summary

${f.observation ? f.observation : "A concise, impact-first description of the vulnerability."}

## Affected Asset

${target}

## Severity

${f.severity}${f.cvss ? ` (CVSS ${f.cvss})` : ""}

## Preconditions

-

## Steps to Reproduce

1.
2.
3.

## Proof of Concept

\`\`\`http
${f.endpoint_method ?? "GET"} ${endpointPath ?? "/path"} HTTP/2
Host: example.com
Authorization: Bearer [REDACTED]
\`\`\`

## Impact

Describe the concrete impact to users and the business.

## Remediation

## References

${f.cwe ? `- ${f.cwe}\n` : ""}`;
}

export function outline(text: string) {
  const lines = text.split("\n");
  const items: { level: number; text: string; line: number }[] = [];
  let inFence = false;
  lines.forEach((l, i) => {
    if (/^```/.test(l.trim())) inFence = !inFence;
    if (inFence) return;
    const m = /^(#{1,4})\s+(.*)/.exec(l);
    if (m) items.push({ level: m[1].length, text: m[2], line: i });
  });
  return items;
}
