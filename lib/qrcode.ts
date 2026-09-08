import QRCode from "qrcode";

/**
 * Gera o QR code do cartaz de check-in como SVG (string), pra renderizar
 * embutido na página de impressão em app/recepcao/recursos/qr-checkin.
 * Server-side apenas — nunca chamado do cliente. `errorCorrectionLevel: "M"`
 * dá margem pra pequenas manchas/dobras no papel impresso sem comprometer a
 * leitura, sem inflar demais a densidade do código.
 */
export async function generateCheckinQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, width: 320 });
}
