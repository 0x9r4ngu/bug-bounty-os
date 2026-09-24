export const VULN_CLASSES = ["XSS", "IDOR/BOLA", "Authentication", "Authorization", "Business Logic", "SSRF", "SQLi", "CSRF", "API", "OAuth", "Race Condition", "Cloud", "Mobile", "AI/LLM", "Other"];
export const SEVERITIES = ["Critical", "High", "Medium", "Low", "Informational"];
export const FINDING_STATUSES = ["Potential", "Confirmed", "Submitted", "Triaged", "Accepted", "Resolved", "Duplicate", "Rejected"];
export const REPORT_STATUSES = ["Draft", "In Progress", "Ready", "Submitted", "Accepted", "Resolved", "Rejected", "Archived"];
export const ASSET_TYPES = ["Web", "API", "Android", "iOS", "Cloud", "GraphQL", "WebSocket", "Network", "Repository", "AI/LLM", "Other"];
export const ENDPOINT_STATUSES = ["Untested", "In Progress", "Tested", "Potential Issue", "N/A", "Blocked"];
export const ENDPOINT_STATUS_COLOR: Record<string, string> = { Untested: "#8a8168", "In Progress": "#b99a3e", Tested: "#7c8850", "Potential Issue": "#7c8850", "N/A": "#9a927a", Blocked: "#cc3a63" };
export const EP_HEALTH_COLOR: Record<string, string> = { Active: "#7c8850", Offline: "#cc3a63", Redirect: "#7c8850", Unknown: "#8a8168", "Needs Verification": "#7c8850", "Out of Scope": "#9a927a" };
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
export const SUBDOMAIN_STATUS = ["Live", "Redirect", "Offline", "Unknown", "Out of Scope"];
export const SUBDOMAIN_STATUS_COLOR: Record<string, string> = { Live: "#7c8850", Redirect: "#7c8850", Offline: "#cc3a63", Unknown: "#8a8168", "Out of Scope": "#9a927a" };

export const VISIBILITY = {
  PUBLIC: { label: "Public", color: "#b99a3e" },
  PRIVATE: { label: "Private", color: "#7c8850" },
  INVITE_ONLY: { label: "Invite-only", color: "#b0743a" },
  VDP: { label: "VDP", color: "#8a8168" },
  INTERNAL: { label: "Internal", color: "#cc3a63" },
  CUSTOM: { label: "Custom", color: "#8a8168" },
} as const;
