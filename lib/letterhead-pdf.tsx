import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { LOGO_HORIZONTAL_PNG_BASE64 } from "@/lib/brand-assets";
import type { ClinicIdentity } from "@/lib/clinic-identity";

/**
 * Cabeçalho e rodapé padrão de qualquer PDF institucional (relatório de
 * convênio, compartilhamento com a família, laudo de instrumento). Usa a
 * mesma `ClinicIdentity` em todos — trocar o timbre em um lugar só reflete
 * em todo documento exportado do sistema.
 *
 * Import isolado do resto do design system (`lib/family-share-pdf.tsx`,
 * `lib/insurer-report-pdf.tsx`) para não duplicar o cabeçalho a cada PDF novo.
 */
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: "2 solid #065264",
  },
  // 5,82:1 é a proporção da marca com assinatura (ver lib/brand-assets.ts).
  // Distorcer a logo é proibido pelo brand/README.md.
  logo: { width: 150, height: 26 },
  identity: { marginTop: 6, fontSize: 7, color: "#555", textAlign: "right", maxWidth: 260 },
  identityLine: { marginBottom: 1 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#777",
    borderTop: "1 solid #ddd",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export function LetterheadHeader({ clinic }: { clinic: ClinicIdentity }) {
  const linhas = [
    clinic.razaoSocial && clinic.razaoSocial !== clinic.nomeFantasia ? clinic.razaoSocial : null,
    clinic.cnpj ? `CNPJ ${clinic.cnpj}` : null,
    clinic.endereco,
    [clinic.telefone, clinic.email].filter(Boolean).join(" · ") || null,
  ].filter((l): l is string => Boolean(l));

  return (
    <View style={styles.header} fixed>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é do @react-pdf/renderer, não HTML/next/image: não tem prop alt. */}
      <Image src={`data:image/png;base64,${LOGO_HORIZONTAL_PNG_BASE64}`} style={styles.logo} />
      {linhas.length > 0 && (
        <View style={styles.identity}>
          {linhas.map((l, i) => (
            <Text key={i} style={styles.identityLine}>
              {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

export function LetterheadFooter({ clinic }: { clinic: ClinicIdentity }) {
  return (
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) => `${footerLeft(clinic)} · página ${pageNumber} de ${totalPages}`}
    />
  );
}

function footerLeft(clinic: ClinicIdentity): string {
  return [clinic.nomeFantasia, clinic.responsavel].filter(Boolean).join(" · ");
}
