// lib/patient-duplicates-pure.ts
// Decisões PURAS de duplicidade de paciente: quando dois cadastros são a mesma
// criança e qual deles fica. Sem imports com alias `@/` para rodar em
// `node --test --experimental-strip-types` (tests/patient-duplicates-pure.test.ts).
//
// Regra do dono do projeto: responsável + telefone + nascimento idênticos = mesma
// família; a prova final é o NOME DA CRIANÇA, ainda que em parte (primeiro nome).
// Irmãos e gêmeos (mesmo responsável/telefone/nascimento, primeiro nome diferente)
// NUNCA se mesclam. O cadastro que fica é o mais avançado no fluxo.

export type PatientIdentity = {
  id: string;
  fullName: string;
  birthDate: string | null;
  status: string;
  createdAt: string;
  /** Estágio 1-5 (lib/patient-stage.ts: computeStage) já calculado por quem chama. */
  stage: number;
  /** Avaliação já realizada. */
  evaluated: boolean;
  /** Tem agendamento ativo de 1ª avaliação. */
  hasActiveEvaluation: boolean;
  guardianNames: string[];
  guardianPhones: string[];
};

const PLACEHOLDER_GUARDIANS = new Set(["responsavel", "responsavel (contato whatsapp)"]);

function strip(raw: string | null | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Primeiro nome em forma canônica: "Sofia" e "Sophia", "Joao" e "João" caem na
 * mesma chave (ph→f, y→i, w→u, letras dobradas viram uma).
 */
export function firstNameKey(name: string | null | undefined): string {
  const first = strip(name).split(" ")[0] ?? "";
  return first
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/y/g, "i")
    .replace(/w/g, "u")
    .replace(/(.)\1+/g, "$1");
}

/** Mesma criança pelo nome, ainda que em parte: o primeiro nome decide. */
export function sameChildName(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = firstNameKey(a);
  const kb = firstNameKey(b);
  return ka.length >= 2 && ka === kb;
}

function phoneTail(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : "";
}

function guardianKey(name: string | null | undefined): string {
  const s = strip(name);
  if (!s || PLACEHOLDER_GUARDIANS.has(s)) return "";
  return s.split(" ")[0];
}

/**
 * Responsável compatível: algum par com o mesmo primeiro nome. Nome ausente ou o
 * rótulo neutro "Responsável" não contradiz ninguém (o telefone e o nascimento
 * continuam exigidos).
 */
function guardiansCompatible(a: string[], b: string[]): boolean {
  const ka = a.map(guardianKey).filter(Boolean);
  const kb = b.map(guardianKey).filter(Boolean);
  if (ka.length === 0 || kb.length === 0) return true;
  return ka.some((k) => kb.includes(k));
}

export function isDuplicatePatient(a: PatientIdentity, b: PatientIdentity): boolean {
  if (a.id === b.id) return false;
  if (!a.birthDate || a.birthDate.slice(0, 10) !== b.birthDate?.slice(0, 10)) return false;

  const tailsA = new Set(a.guardianPhones.map(phoneTail).filter(Boolean));
  if (!b.guardianPhones.map(phoneTail).some((t) => t && tailsA.has(t))) return false;

  if (!guardiansCompatible(a.guardianNames, b.guardianNames)) return false;
  return sameChildName(a.fullName, b.fullName);
}

const INACTIVE = new Set(["arquivado", "alta", "evadido"]);

/** Pontuação de avanço: quem fica é o que tem maior. Arquivado/alta nunca vencem um ativo. */
function advancement(p: PatientIdentity): [number, number, number, number, number] {
  return [
    INACTIVE.has(p.status) ? 0 : 1,
    p.stage,
    p.evaluated ? 1 : 0,
    p.hasActiveEvaluation ? 1 : 0,
    // mais antigo vence o empate (menor createdAt => maior valor)
    -new Date(p.createdAt).getTime(),
  ];
}

export function pickSurvivor<T extends PatientIdentity>(group: T[]): T {
  return [...group].sort((x, y) => {
    const ax = advancement(x);
    const ay = advancement(y);
    for (let i = 0; i < ax.length; i++) {
      if (ax[i] !== ay[i]) return ay[i] - ax[i];
    }
    return x.id.localeCompare(y.id);
  })[0];
}

/**
 * Agrupa duplicados (fechamento transitivo: A~B e B~C => um grupo) e devolve, para
 * cada grupo com 2+ cadastros, quem fica e quem sai.
 */
export function planMerges<T extends PatientIdentity>(patients: T[]): { keep: T; drop: T[] }[] {
  const parent = new Map(patients.map((p) => [p.id, p.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  for (let i = 0; i < patients.length; i++) {
    for (let j = i + 1; j < patients.length; j++) {
      if (isDuplicatePatient(patients[i], patients[j])) parent.set(find(patients[i].id), find(patients[j].id));
    }
  }
  const groups = new Map<string, T[]>();
  for (const p of patients) {
    const root = find(p.id);
    groups.set(root, [...(groups.get(root) ?? []), p]);
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => {
      const keep = pickSurvivor(g);
      return { keep, drop: g.filter((p) => p.id !== keep.id) };
    });
}

/**
 * Rede de segurança de EXIBIÇÃO (fila de 1ª avaliação, cards): a mesma criança
 * vinda de duas origens (WhatsApp + rascunho + presencial) vira UM item, o de
 * maior `score`. Chave = primeiro nome canônico + 8 últimos dígitos do telefone;
 * item sem telefone nunca se funde (sem a prova, não arrisca esconder um irmão).
 * A mesclagem real dos cadastros é patient-merge.ts; isto só evita card repetido
 * enquanto ela não rodou.
 */
export function collapseByChild<T>(
  items: T[],
  pick: (item: T) => { name: string | null | undefined; phone: string | null | undefined; score: number },
): T[] {
  const best = new Map<string, { item: T; score: number; index: number }>();
  const out: { item: T; index: number }[] = [];
  items.forEach((item, index) => {
    const { name, phone, score } = pick(item);
    const tail = phoneTail(phone);
    const key = tail && firstNameKey(name) ? `${firstNameKey(name)}|${tail}` : null;
    if (!key) {
      out.push({ item, index });
      return;
    }
    const current = best.get(key);
    if (!current || score > current.score) best.set(key, { item, score, index: current?.index ?? index });
  });
  return [...out, ...[...best.values()].map(({ item, index }) => ({ item, index }))]
    .sort((a, b) => a.index - b.index)
    .map((x) => x.item);
}
