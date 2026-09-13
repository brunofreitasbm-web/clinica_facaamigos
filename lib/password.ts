export const PASSWORD_MIN_LENGTH = 6;

export type PasswordRequirement = {
  key: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    key: "length",
    label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    key: "uppercase",
    label: "Uma letra maiúscula",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    key: "special",
    label: "Um caractere especial",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function isPasswordStrong(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password));
}
