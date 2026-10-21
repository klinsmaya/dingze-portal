export type AccountFields = { username: string; nickname: string; phone: string; email: string };

export const emptyAccount: AccountFields = { username: "", nickname: "", phone: "", email: "" };

/** Trimmed values for the API; blank optional fields are omitted. */
export function accountPayload(value: AccountFields) {
  return {
    username: value.username.trim(),
    nickname: value.nickname.trim(),
    phone: value.phone.trim() || undefined,
    email: value.email.trim() || undefined,
  };
}
