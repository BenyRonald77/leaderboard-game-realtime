import { randomBytes } from "crypto";

export const randomToken = (bytes = 24) => randomBytes(bytes).toString("hex");

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function randomFriendCode(): string {
  let s = "";
  for (let i = 0; i < 7; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}
