import type { ReferenceCriteria } from "./types";

const FIELD_CANDIDATES = [
  "Name",
  "Address",
  "Dated",
  "Date",
  "Designation",
  "Signature",
  "Phone",
  "Email",
  "Institute",
  "Domain Name",
];

const SECTION_CANDIDATES = [
  "Subject",
  "Declaration",
  "Undertaking",
  "Authorization",
  "Terms and Conditions",
  "Enclosure",
];

/**
 * Produces conservative, template-specific checks from the reference itself.
 * We only require labels/headings which are actually present in that reference,
 * avoiding stale requirements from a previously selected template.
 */
export function deriveReferenceCriteria(text: string): ReferenceCriteria {
  const lower = text.toLowerCase();
  const contains = (value: string) => lower.includes(value.toLowerCase());

  return {
    mandatoryFields: FIELD_CANDIDATES.filter(contains),
    expectedSections: SECTION_CANDIDATES.filter(contains),
  };
}
