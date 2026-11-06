// Templates das pecas. Todo texto vem de config.json. Nenhum texto fixo de plano aqui.
const C = { pet: '#065264', am: '#FDC51D', tq: '#07C5C8', rs: '#FB3D6A', rsd: '#D61F4A' };

export function criarPecas(cfg) {
  const nome = cfg.plano.nome;
  const t = (s) => String(s ?? '').replaceAll('{plano}', `plano ${nome}`).replaceAll('{nome}', nome);
  const temHandle = !/\[|PREENCHER/i.test(cfg.handle);

  // ---------- decoracao vetorial abstrata (sem crianca, sem figura humana) ----------
  const arc = (cx, cy, r, a0, a1, color, w) => {
    const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    const large = ((a1 - a0 + 360) % 360) > 180 ? 1 : 0;
    return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  const svg = (inner, style, w = 1080, h = 1350) =>
    `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="${style}">${inner}</svg>`;
  const wave = (w, amp, color, sw, y = 0) => {
    let d = `M0 ${y}`;
    const seg = 120;
    for (let x = 0; x < w; x += seg) d += ` q${seg / 4} ${-amp} ${seg / 2} 0 t${seg / 2} 0`;
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  };
  const decor = {
    // arcos entrelacados no estilo do simbolo, sangrando pelo canto
    cantoSup: (dark) => `<div class="decor">${svg(
      arc(990, 410, 190, 100, 280, C.am, 60) + arc(1110, 530, 160, 190, 20, C.tq, 60) + `<circle cx="925" cy="600" r="30" fill="${C.rs}"/>`, 'left:0;top:0')}</div>`,
    cantoInf: () => `<div class="decor">${svg(
      arc(1030, 1340, 190, 180, 340, C.tq, 56) + arc(880, 1400, 130, 200, 360, C.am, 52) + `<circle cx="1030" cy="1120" r="28" fill="${C.rs}"/>`, 'left:0;top:0')}</div>`,
    ondas: (dy = 0) => `<div class="decor">${svg(
      wave(1200, 46, C.am, 16, 1190 + dy) + wave(1200, 46, C.tq, 16, 1236 + dy) + wave(1200, 46, C.rs, 16, 1282 + dy), 'left:-40px;top:0')}</div>`,
    bolinhas: () => `<div class="decor">${svg(
      `<circle cx="1000" cy="1200" r="90" fill="${C.am}"/><circle cx="880" cy="1290" r="52" fill="${C.tq}"/><circle cx="1010" cy="1330" r="40" fill="${C.rs}"/>`, 'left:0;top:0')}</div>`
  };
  const decorStory = (variante, tema) => {
    const w = 1080, h = 1920;
    const AM = tema === 'amarelo' ? '#FFFFFF' : C.am;
    const a = variante === 'a'
      ? arc(980, 260, 300, 90, 290, C.am, 80) + arc(1120, 520, 260, 180, 20, C.tq, 80) + `<circle cx="880" cy="500" r="44" fill="${C.rs}"/>` +
        arc(100, 1700, 300, 270, 90, C.tq, 80) + arc(-40, 1500, 260, 0, 200, C.am, 80) + `<circle cx="210" cy="1500" r="44" fill="${C.rs}"/>`
      : arc(1000, 150, 260, 90, 270, C.tq, 70) + `<circle cx="880" cy="230" r="38" fill="${C.rs}"/>` + wave(1300, 60, AM, 18, 1790) + wave(1300, 60, C.rs, 18, 1850);
    return `<div class="decor">${svg(a, 'left:0;top:0', w, h)}</div>`;
  };

  // ---------- pecas de carrossel / post (1080x1350) ----------
  const logoPara = (tema) => tema === 'petroleo'
    ? 'assets/logos/facaamigos-horizontal-sem-assinatura-mono-branco.svg'
    : tema === 'amarelo'
      ? 'assets/logos/facaamigos-horizontal-sem-assinatura-mono-petroleo.svg'
      : 'assets/logos/facaamigos-horizontal-sem-assinatura.svg';
  const seta = (cor) => `<svg viewBox="0 0 52 30"><path d="M2 15h44M32 3l14 12-14 12" fill="none" stroke="${cor}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const setaCima = `<svg viewBox="0 0 48 48"><path d="M24 42V8M10 22 24 8l14 14" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const moldura = (tema, i, n, inner, deco, opts = {}) => `
    ${deco || ''}
    <div class="hdr"><img src="${logoPara(tema)}" alt=""><div class="cnt">${String(i).padStart(2, '0')}/${String(n).padStart(2, '0')}</div></div>
    ${inner}
    ${opts.semFooter ? '' : `<div class="ftr" style="color:${tema === 'petroleo' ? '#fff' : C.pet}">
      <div class="tag"><i></i>${nome}</div>
      ${opts.semSeta ? '' : `<div class="swipe">Arraste ${seta(tema === 'petroleo' ? C.pet : '#fff')}</div>`}
    </div>`}`;

  const slideCarrossel = (s, i, n) => {
    const tema = s.tema || 'petroleo';
    let inner = '', deco = '', opts = {};
    if (s.tipo === 'capa') {
      deco = decor.cantoSup() + decor.ondas(-120);
      inner = `<div class="body" style="top:300px;bottom:340px;gap:44px;justify-content:center">
        <span class="pill-k">${t(s.kicker)}</span>
        <h1 class="cover">${t(s.titulo)}</h1>
        <p class="sub" style="color:#E6F4F6;max-width:760px">${t(s.sub)}</p></div>`;
    } else if (s.tipo === 'texto') {
      deco = tema === 'amarelo' ? decor.bolinhas() : decor.cantoInf();
      inner = `<div class="body"><div class="kicker">${t(s.kicker)}</div><h2 class="slide">${t(s.titulo)}</h2><p class="txt">${t(s.texto)}</p></div>`;
    } else if (s.tipo === 'seis') {
      deco = decor.cantoSup();
      inner = `<div class="body" style="top:330px"><div class="kicker">${t(s.kicker)}</div><h2 class="slide">${t(s.titulo)}</h2>
        <div class="six">${[1, 2, 3, 4, 5, 6].map((k) => `<b>${k}</b>`).join('')}</div><p class="txt">${t(s.texto)}</p></div>`;
    } else if (s.tipo === 'chips') {
      deco = decor.cantoInf();
      const cores = [C.am, C.tq, C.rs];
      inner = `<div class="body"><div class="kicker">${t(s.kicker)}</div><h2 class="slide" style="font-size:84px">${t(s.titulo)}</h2>
        <div class="chips">${s.chips.map((c, k) => `<div class="chip" style="--c:${cores[k % 3]}"><i></i>${t(c)}</div>`).join('')}</div>
        <p class="txt">${t(s.texto)}</p></div>`;
    } else if (s.tipo === 'passo') {
      deco = decor.cantoInf();
      inner = `<div class="body" style="gap:30px"><div class="num c${s.n}">${s.n}</div><div class="kicker">${t(s.kicker)}</div>
        <h2 class="slide">${t(s.titulo)}</h2><p class="txt">${t(s.texto)}</p>
        <div class="dots">${[1, 2, 3].map((k) => `<i class="${k === s.n ? 'on' : ''}"></i>`).join('')}</div></div>`;
    } else if (s.tipo === 'faq') {
      deco = '';
      inner = `<div class="body" style="top:250px;gap:30px"><div class="kicker">${t(s.kicker)}</div>
        <div class="faq">${s.itens.map((q) => `<div><h3>${t(q.q)}</h3><p>${t(q.a)}</p></div>`).join('')}</div></div>`;
    } else if (s.tipo === 'cta') {
      deco = decor.ondas(40);
      opts.semSeta = true; opts.semFooter = true;
      inner = `<div class="body" style="top:230px;bottom:330px;gap:36px">
        <div class="logo-card"><img src="assets/logos/facaamigos-simbolo.svg" alt=""></div>
        <h2 class="slide">${t(s.titulo)}</h2><p class="txt">${t(s.texto)}</p>
        <div class="btn">${t(cfg.assinaturaCTA)} ${setaCima}</div>
        ${temHandle ? `<div class="handle" style="color:#E6F4F6">${cfg.handle}</div>` : ''}</div>`;
    }
    return { cls: `piece t-${tema}`, w: 1080, h: 1350, html: moldura(tema, i, n, inner, deco, opts) };
  };

  const pecas = [];
  const add = (id, p, alt) => pecas.push({ id, alt: t(alt), ...p });

  const A = cfg.carrosselA.slides;
  A.forEach((s, i) => add(`carrossel-a-${String(i + 1).padStart(2, '0')}`, slideCarrossel(s, i + 1, A.length), s.alt));
  const B = cfg.carrosselB.slides;
  B.forEach((s, i) => add(`carrossel-b-${String(i + 1).padStart(2, '0')}`, slideCarrossel(s, i + 1, B.length), s.alt));

  // ---------- post estatico ----------
  {
    const p = cfg.post;
    const html = `${decor.cantoSup()}
      <div class="hdr"><img src="${logoPara('petroleo')}" alt=""></div>
      <div class="body" style="top:260px;bottom:340px;gap:44px;width:900px">
        <span class="pill-k">${t(p.kicker)}</span>
        <h1 class="cover" style="font-size:108px">${t(p.titulo)}</h1>
        <p class="sub" style="color:#E6F4F6">${t(p.sub)}</p></div>
      <div class="ftr" style="bottom:90px"><div class="btn" style="font-size:48px;padding:22px 52px">${t(p.cta)} ${setaCima.replace('stroke-width="5.5"', 'stroke-width="5.5"')}</div></div>`;
    add('post-apresentacao', { cls: 'piece t-petroleo', w: 1080, h: 1350, html }, p.alt);
  }

  // ---------- stories (1080x1920; topo/rodape 250px livres) ----------
  const stLogo = (tema) => `<div class="st-logo"><img src="${logoPara(tema)}" alt=""></div>`;
  const S = cfg.stories;
  {
    const s = S.s1;
    const fs = Math.min(330, Math.floor(1500 / nome.length));
    add('story-1-teaser', { cls: 'piece t-petroleo', w: 1080, h: 1920, html: `${decorStory('a')}${stLogo('petroleo')}
      <div class="st-body" style="gap:30px"><span class="pill-k">${t(s.kicker)}</span>
      <h1 style="font-size:${fs}px;font-weight:700;line-height:.95">${t(s.titulo)}</h1>
      <p class="txt" style="font-size:56px;max-width:800px">${t(s.texto)}</p></div>` }, s.alt);
  }
  {
    const s = S.s2;
    add('story-2-como-funciona', { cls: 'piece t-gelo', w: 1080, h: 1920, html: `${decorStory('b')}${stLogo('gelo')}
      <div class="st-body"><div class="kicker" style="font-size:38px">${t(s.kicker)}</div><h2 style="font-size:100px">${t(s.titulo)}</h2>
      <div style="display:flex;flex-direction:column;gap:28px">${s.passos.map((p, k) => `<div class="step"><div class="n">${k + 1}</div><span>${t(p)}</span></div>`).join('')}</div></div>` }, s.alt);
  }
  {
    const s = S.s3;
    add('story-3-perguntas', { cls: 'piece t-petroleo', w: 1080, h: 1920, html: `${decorStory('b')}${stLogo('petroleo')}
      <div class="st-body" style="gap:44px"><div class="kicker" style="font-size:38px">${t(s.kicker)}</div><h2 style="font-size:104px">${t(s.titulo)}</h2>
      <div class="sticker-zone"></div><p class="nota">${t(s.nota)}</p></div>` }, s.alt);
  }
  {
    const s = S.s4;
    add('story-4-link-na-bio', { cls: 'piece t-gelo', w: 1080, h: 1920, html: `${decorStory('b')}${stLogo('gelo')}
      <div class="st-body" style="gap:44px"><div class="kicker" style="font-size:38px">${t(s.kicker)}</div><h2 style="font-size:112px">${t(s.titulo)}</h2>
      <p class="txt">${t(s.texto)}</p>
      <svg width="130" height="150" viewBox="0 0 130 150" style="align-self:center"><path d="M65 8v110M25 80l40 42 40-42" fill="none" stroke="${C.rsd}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div class="link-zone"></div></div>` }, s.alt);
  }
  {
    const s = S.s5;
    const dias = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];
    const marcados = { '0,0': C.am, '0,2': C.tq, '1,1': C.rs, '1,3': C.am, '2,0': C.tq, '2,4': C.rs, '3,2': C.am };
    const cel = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      const x = 40 + c * 140, y = 130 + r * 100, col = marcados[`${r},${c}`];
      cel.push(`<rect x="${x}" y="${y}" width="124" height="84" rx="22" fill="${col || '#E3F0F3'}"/>`);
    }
    const ilus = `<svg width="780" height="620" viewBox="0 0 780 620" style="display:block;align-self:center;overflow:visible">
      <rect x="20" y="30" width="740" height="540" rx="56" fill="#fff" stroke="${C.pet}" stroke-width="8"/>
      <path d="M20 86a56 56 0 0 1 56-56h628a56 56 0 0 1 56 56v40H20z" fill="${C.pet}"/>
      <g transform="translate(20 20)">${dias.map((d, c) => `<text x="${102 + c * 140}" y="96" text-anchor="middle" font-family="Nunito" font-weight="900" font-size="30" fill="#fff" letter-spacing="2">${d}</text>`).join('')}${cel.join('')}</g>
      <g transform="translate(560 470) rotate(-28)"><rect width="330" height="46" rx="12" fill="${C.am}"/><rect x="-30" width="46" height="46" rx="12" fill="${C.rs}"/><path d="M330 0l52 23-52 23z" fill="#F3D7B0"/><path d="M366 14l16 9-16 9z" fill="${C.pet}"/></g>
      <rect x="-10" y="470" width="130" height="130" rx="30" fill="${C.tq}" transform="rotate(-10 55 535)"/>
      <circle cx="140" cy="590" r="56" fill="${C.rs}"/>
      <rect x="150" y="500" width="110" height="110" rx="26" fill="${C.am}" transform="rotate(12 205 555)"/>
    </svg>`;
    add('story-5-bastidores', { cls: 'piece t-gelo', w: 1080, h: 1920, html: `${decorStory('b')}${stLogo('gelo')}
      <div class="st-body" style="gap:40px"><div class="kicker" style="font-size:38px">${t(s.kicker)}</div><h2 style="font-size:104px">${t(s.titulo)}</h2>${ilus}
      <p class="txt" style="font-size:50px">${t(s.texto)}</p></div>` }, s.alt);
  }

  // ---------- capas de reels (1080x1920; area segura do grid 4:5 = y 285..1635) ----------
  const reel = (id, r, tema) => {
    const logoSrc = logoPara(tema);
    const dark = tema === 'petroleo', ama = tema === 'amarelo';
    const cores = ama ? [C.pet, '#FFFFFF', C.rsd, C.pet, '#FFFFFF', C.rsd] : [C.am, C.tq, C.rs, C.am, C.tq, C.rs];
    const html = `${decorStory('b', tema)}
      <div class="layer" style="left:90px;right:90px;top:285px;height:1350px;display:flex;flex-direction:column;justify-content:center;gap:48px">
        <img src="${logoSrc}" alt="" style="height:54px;width:auto;align-self:flex-start">
        <span class="pill-k" ${ama ? 'style="background:#065264;color:#fff"' : ''}>${t('{plano}')}</span>
        <h1 style="font-size:112px;font-weight:700;line-height:1.04">${t(r.titulo)}</h1>
        <div style="display:flex;gap:16px">${cores.map((c) => `<i style="width:70px;height:70px;border-radius:24px;background:${c};display:block"></i>`).join('')}</div>
      </div>`;
    add(id, { cls: `piece t-${tema}`, w: 1080, h: 1920, html }, r.alt);
  };
  reel('reel-capa-1', cfg.reels.r1, 'petroleo');
  reel('reel-capa-2', cfg.reels.r2, 'gelo');
  reel('reel-capa-3', cfg.reels.r3, 'amarelo');

  // ---------- destaque (capa de highlight; circulo seguro central) ----------
  {
    const ang = [0, 60, 120, 180, 240, 300];
    const cores = [C.am, C.tq, C.rs, C.am, C.tq, C.rs];
    const dots = ang.map((a, k) => {
      const x = 540 + 270 * Math.cos(((a - 90) * Math.PI) / 180), y = 960 + 270 * Math.sin(((a - 90) * Math.PI) / 180);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="58" fill="${cores[k]}"/>`;
    }).join('');
    const html = `<div class="decor">${svg(`<circle cx="540" cy="960" r="400" fill="#fff"/>${dots}`, 'left:0;top:0', 1080, 1920)}</div>
      <div class="layer" style="left:0;right:0;top:815px;text-align:center"><img src="assets/logos/facaamigos-simbolo.svg" alt="" style="width:310px"></div>
      <div class="layer" style="left:0;right:0;top:1010px;text-align:center;font:700 84px var(--display);color:${C.pet}">${t(cfg.destaque.rotulo)}</div>`;
    add('destaque-capa', { cls: 'piece t-petroleo', w: 1080, h: 1920, html }, cfg.destaque.alt);
  }

  return pecas;
}
