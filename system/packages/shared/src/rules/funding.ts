// Funder decisions (v2: offer, approve, decline; brief §8 "offer changes and declines need reasons").
import type { ApplicationStatus } from "../constants";

export const DECIDED: ApplicationStatus[] = ["approved", "declined", "withdrawn"];
export const isDecided = (s: ApplicationStatus) => DECIDED.includes(s);

/** Every offer after the first needs a reason the founder will see. */
export const offerNeedsReason = (isFirstOffer: boolean, reason: string) => !isFirstOffer && reason.trim().length === 0;

/** Approving commits the current offer to the programme budget (inventory 12.8). */
export function budgetCheck(p: { budget: number; committed: number }, amount: number) {
  const left = p.budget - p.committed;
  return { left, exceeds: amount > left, after: left - amount };
}

/** The founder can ask "why?" once per changed offer that has no reason (v2: askreason). */
export const canAskReason = (offers: { reason: string }[], alreadyAsked: boolean) =>
  offers.length > 1 && offers[offers.length - 1]!.reason.trim() === "" && !alreadyAsked;

export const canWithdraw = (s: ApplicationStatus) => !isDecided(s);
