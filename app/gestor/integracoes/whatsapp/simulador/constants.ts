// Número de teste fixo do simulador — extraído de simulador-actions.ts
// porque um arquivo "use server" só pode exportar funções async; exportar
// uma constante ali quebra o build (bundler trata o módulo como "sem
// exports").
export const SIMULATOR_WA_ID = "5591999990000";
