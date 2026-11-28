import type { SessionPayload } from "@/lib/auth/session";

/** Who can submit a claim for money they spent. Agents don't claim expenses (for now). */
export const CLAIM_SUBMIT_ROLES = ["ADMIN", "WORKER"] as const;
/** Who can approve / reject / record pay-back — never on their own claim. */
export const CLAIM_REVIEW_ROLES = ["BOSS", "ADMIN"] as const;

export function canSubmitClaims(user: SessionPayload | null): boolean {
  return !!user && (CLAIM_SUBMIT_ROLES as readonly string[]).includes(user.role);
}

export function canReviewClaims(user: SessionPayload | null): boolean {
  return !!user && (CLAIM_REVIEW_ROLES as readonly string[]).includes(user.role);
}

export function canUseClaims(user: SessionPayload | null): boolean {
  return canSubmitClaims(user) || canReviewClaims(user);
}

/** Only accept file links our own upload route produced (private Blob proxy, or local dev). */
export function isOwnUploadUrl(url: string): boolean {
  return url.startsWith("/api/blob?u=") || url.startsWith("/uploads/");
}

export const MAX_RECEIPTS_PER_CLAIM = 6;
