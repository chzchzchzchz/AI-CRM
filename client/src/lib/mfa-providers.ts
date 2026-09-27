/**
 * Identity and MFA vendors the accounts and contacts filters look for in a tech stack.
 *
 * Both pages carried their own copy of this list. They matched, but two copies of one
 * definition is how the unworked-6QA count came to read 69 on one page and 6 on the
 * next; one list means the two filters can't quietly disagree.
 */
export const MFA_PROVIDERS = [
  "Ping Identity",
  "Okta",
  "Duo Security",
  "Azure AD",
  "OneLogin",
  "ForgeRock",
  "Auth0",
  "CyberArk",
  "RSA SecurID",
  "SailPoint",
  "Saviynt",
  "IBM Security Verify",
  "Oracle Identity",
  "SecureAuth",
  "Thales SafeNet",
] as const;
