/**
 * Método FaçaAmigos: 2ª etapa (Avaliação em Ambiente Natural, no Playground). Texto da Isabella.
 * Sempre visível: saudação + abertura. O resto abre sob demanda (informação progressiva).
 * Ação primária: sem visita marcada, "Escolher turno no WhatsApp"; com visita, o dia e o local aparecem em
 * destaque e o botão some. Não é um componente cliente: <details> abre sem JavaScript.
 */
export type MetodoVisit = { dateLabel: string; time: string; place: string };

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details className="mt-2 rounded border px-3 py-2" style={{ borderColor: "var(--color-divider)" }}>
      <summary className="cursor-pointer text-sm font-semibold">{titulo}</summary>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </details>
  );
}

export function MetodoCard({ childName, visit, whatsappHref }: { childName: string; visit: MetodoVisit | null; whatsappHref: string }) {
  return (
    <section id="metodo" className="card">
      <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0 mb-2">Método FaçaAmigos</h6>
      <p className="text-sm leading-relaxed m-0">
        Aqui é a Isabella, do FaçaAmigos. Obrigada por toda a confiança e por terem participado da anamnese. Ela foi o
        primeiro passo do Método FaçaAmigos, e agora vamos para a segunda etapa: a avaliação da criança em ambiente natural.
      </p>

      <div className="mt-3 rounded px-3 py-2" style={{ background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}>
        <div className="text-sm font-semibold">📅 Quando</div>
        {visit ? (
          <p className="text-sm m-0 mt-1">
            {visit.dateLabel} às {visit.time} · {visit.place}
          </p>
        ) : (
          <>
            <p className="text-sm m-0 mt-1">
              As avaliações serão às segundas e quartas-feiras, pela manhã ou à tarde. Qual turno fica melhor para vocês?
            </p>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn mt-2 inline-block">
              Escolher turno no WhatsApp
            </a>
          </>
        )}
      </div>

      <Bloco titulo="Por que o Método começa assim?">
        <p className="m-0">
          No Método FaçaAmigos, a avaliação inicial acontece onde a criança é mais ela mesma: brincando, escolhendo,
          interagindo e se movendo com liberdade. É assim que conseguimos enxergar de verdade como o(a) {childName} se
          comunica, se regula, se relaciona e resolve situações do dia a dia. Em um ambiente natural, o olhar é real e
          fiel. E é com ele que construímos um plano terapêutico sob medida. 💛
        </p>
      </Bloco>
      <Bloco titulo="Onde será">
        <p className="m-0">
          No FaçaAmigos Playground Inclusivo, no Parque Shopping Belém e no Shopping Bosque Grão Pará, um espaço
          acolhedor, colorido e pensado para a criança se sentir bem desde o primeiro minuto. Para quem está começando a
          terapia ou mudando de lugar, é uma forma leve de criar vínculo, sem pressão.
        </p>
      </Bloco>
      <Bloco titulo="Quem estará com a criança">
        <p className="m-0">Nossa equipe multiprofissional observa junta, ao mesmo tempo*:</p>
        <ul className="m-0 mt-1 list-none p-0">
          <li>🗣️ Fonoaudiologia</li>
          <li>🧩 Terapia Ocupacional</li>
          <li>🎯 Integração Sensorial</li>
          <li>📚 Psicopedagogia</li>
          <li>🧠 Psicologia</li>
          <li>e demais profissionais</li>
        </ul>
        <p className="m-0 mt-1 text-xs">*De acordo com a disponibilidade no horário agendado do Playground</p>
        <p className="m-0 mt-1">Cada área olha o(a) {childName} a partir do seu campo, e todas constroem um único plano. 🤝</p>
      </Bloco>
      <Bloco titulo="E depois?">
        <p className="m-0">
          Logo após a avaliação, vocês recebem a devolutiva com o que a equipe observou e o Plano Terapêutico
          Individualizado, construído em conjunto com a família. Daí seguimos para as terapias.
        </p>
      </Bloco>

      <p className="text-xs mt-3 mb-0" style={{ color: "var(--color-neutral-500)" }}>
        Qualquer dúvida, estou à disposição. Vai ser um prazer receber vocês! ✨ FaçaAmigos | Brincar também é cuidar
      </p>
    </section>
  );
}
