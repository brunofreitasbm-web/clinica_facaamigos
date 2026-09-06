// lib/whatsapp/validators.ts
/**
 * Validadores puros usados na coleta de dados do chatbot — sem dependência
 * de banco/rede, testáveis isoladamente.
 */

/** Valida CPF (dígitos verificadores), aceitando string com ou sem pontuação. */
export function isValidCpf(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // todos os dígitos iguais

  const calcCheckDigit = (base: string, factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * (factorStart - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const digit1 = calcCheckDigit(digits.slice(0, 9), 10);
  const digit2 = calcCheckDigit(digits.slice(0, 10), 11);
  return digit1 === Number(digits[9]) && digit2 === Number(digits[10]);
}

export function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Converte "DD/MM/AAAA" pra "YYYY-MM-DD" civil, ou null se inválida/fora de 0-18 anos. */
export function parseBrazilianBirthDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dayStr, monthStr, yearStr] = match;
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  if (date.getTime() > Date.now()) return null;

  const ageMs = Date.now() - date.getTime();
  const ageYears = ageMs / (365.25 * 86_400_000);
  if (ageYears > 18.5) return null;

  return `${yearStr}-${monthStr}-${dayStr}`;
}

export function maskCpf(cpf: string | null): string {
  const digits = onlyDigits(cpf ?? "");
  if (digits.length !== 11) return "—";
  return `***.${digits.slice(3, 6)}.***-${digits.slice(9)}`;
}
