export const MIN_PASSWORD_LENGTH = 8

export function meetsPasswordMinimum(password) {
  return Array.from(password).length >= MIN_PASSWORD_LENGTH
}
