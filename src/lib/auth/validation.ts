export type LoginFields = {
  email: string;
  password: string;
};

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginFields(
  emailValue: FormDataEntryValue | null,
  passwordValue: FormDataEntryValue | null,
): ValidationResult<LoginFields> {
  if (typeof emailValue !== "string" || typeof passwordValue !== "string") {
    return { success: false };
  }

  const email = emailValue.trim().toLowerCase();
  const password = passwordValue;

  if (
    email.length === 0 ||
    email.length > 254 ||
    !emailPattern.test(email) ||
    password.length === 0 ||
    password.length > 1024
  ) {
    return { success: false };
  }

  return { success: true, data: { email, password } };
}
