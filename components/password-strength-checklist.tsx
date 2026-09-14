import { Check } from "lucide-react";
import { PASSWORD_REQUIREMENTS } from "@/lib/password";

export function PasswordStrengthChecklist({ password }: { password: string }) {
  return (
    <ul className="mt-1.5 flex flex-col gap-0.5">
      {PASSWORD_REQUIREMENTS.map((requirement) => {
        const met = requirement.test(password);
        return (
          <li
            key={requirement.key}
            className={`flex items-center gap-1.5 text-[11px] transition-colors ${
              met ? "text-emerald-600" : "text-ink-faint"
            }`}
          >
            <span
              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                met ? "border-emerald-600 bg-emerald-600" : "border-ink-faint"
              }`}
            >
              {met && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
            </span>
            {requirement.label}
          </li>
        );
      })}
    </ul>
  );
}
