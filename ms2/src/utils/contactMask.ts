// src/utils/contactMask.ts
// Detect (but don't hard-block) messages that appear to contain contact info.

const PHONE_REGEX = /(?:\+?\d[\d\s\-().]{7,}\d)/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

export interface ContactCheckResult {
  hasPhone: boolean;
  hasEmail: boolean;
  warning: string | null;
}

export function checkForContactInfo(text: string): ContactCheckResult {
  const hasPhone = PHONE_REGEX.test(text);
  const hasEmail = EMAIL_REGEX.test(text);
  let warning: string | null = null;
  if (hasPhone || hasEmail) {
    warning =
      'Your message appears to contain contact information. For your privacy, please exchange contact details only after connecting through the platform.';
  }
  return { hasPhone, hasEmail, warning };
}
