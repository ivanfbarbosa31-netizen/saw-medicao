/* importar-scan.js — referencia de importacao do JSON "nycxo-scan v1" para o esboco do NYCXO Medida.
 * Modulo isolado, sem DOM e sem dependencias. Funciona no navegador (window.NycxoScan) e no Node (require).
 * Unidade unica: mm. Planta: x = X do mundo, y = Z do mundo (y cresce para baixo, como o SVG do esboco).
 *
 * Saida de importarScan(json): { esboco, objetos, diagnostico }
 *   esboco  -> mesmo formato de novoEsboco() do PWA:
 *              { id, nome, pts:[[x,y]...], walls:[{id,mm,o:'lidar'}], fechado, aberturas:[{...}], altura, alturaO, pos }
 *              pts[k] = canto no INICIO da parede k; a parede k vai de pts[k] a pts[(k+1) % n].
 *              walls[k].mm = comprimento medido pelo LiDAR (o PWA usa pts so para a DIRECAO).
 *              aberturas[j] = { tipo:'porta'|'janela', parede:k, dist, larg, alt, peit, o:'lidar' }
 *   objetos -> lista de moveis/equipamentos (o esboco do PWA ainda nao tem onde guardar; devolvidos a parte)
 *   diagnostico -> { fechamento_mm, perimetro_mm, area_mm2, avisos:[...] }
 */
(function (raiz) {
  'use strict';

  const TOL_CANTO_MM = 600;      // distancia maxima entre a ponta de uma parede e o canto calculado
  const TOL_PARALELA = 0.1;      // |sen| abaixo disso: paredes quase colineares, canto = ponto medio
  const TOL_ABERTURA_MM = 300;   // distancia maxima abertura -> parede-mae (geometria)
  const COS_PARALELO = 0.85;     // alinhamento minimo entre a direcao da abertura e a da parede

  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const med = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const r1 = v => Math.round(v * 10) / 10;
  const unit = (a, b) => { const L = dist(a, b) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };

  // intersecao de duas retas (ponto + direcao unitaria); null se quase paralelas
  function intersecao(p1, d1, p2, d2) {
    const cr = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(cr) < TOL_PARALELA) return null;
    const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / cr;
    return [p1[0] + d1[0] * t, p1[1] + d1[1] * t];
  }

  // Encadeia as paredes (a ordem do RoomPlan e arbitraria e a direcao a->b tambem).
  // Comeca na parede 0, sentido a->b; a cada passo pega a parede nao usada com a ponta mais proxima.
  // Funciona tambem em comodos em L (nao depende de ordenar por angulo).
  function construirContorno(paredes) {
    const n = paredes.length;
    if (n < 3) return { ordem: [], vertices_mm: [], fechado: false, avisos: ['menos de 3 paredes'] };
    const usada = new Array(n).fill(false);
    const seq = [{ i: 0, a: paredes[0].planta.a, b: paredes[0].planta.b }];
    usada[0] = true;
    for (let passo = 1; passo < n; passo++) {
      const fim = seq[seq.length - 1].b;
      let melhor = null;
      for (let i = 0; i < n; i++) {
        if (usada[i]) continue;
        const { a, b } = paredes[i].planta;
        const da = dist(fim, a), db = dist(fim, b);
        const cand = da <= db ? { i, a, b, d: da } : { i, a: b, b: a, d: db };
        if (!melhor || cand.d < melhor.d) melhor = cand;
      }
      usada[melhor.i] = true;
      seq.push(melhor);
    }
    const avisos = [];
    const vertices = [];
    for (let k = 0; k < n; k++) {
      const ant = seq[(k + n - 1) % n], atu = seq[k];
      const dA = unit(ant.a, ant.b), dB = unit(atu.a, atu.b);
      const pontoMedio = med(ant.b, atu.a);
      let canto = intersecao(ant.a, dA, atu.a, dB);
      if (!canto || dist(canto, pontoMedio) > TOL_CANTO_MM) canto = pontoMedio;
      vertices.push([r1(canto[0]), r1(canto[1])]);
      if (dist(ant.b, atu.a) > TOL_CANTO_MM) avisos.push(`vao grande (${Math.round(dist(ant.b, atu.a))} mm) entre as paredes ${ant.i} e ${atu.i}`);
    }
    return { ordem: seq.map(s => s.i), vertices_mm: vertices, fechado: avisos.length === 0, avisos };
  }

  // Parede-mae da abertura: usa o indice do arquivo se valido, senao calcula pela geometria.
  function paredeMae(ab, paredes) {
    if (Number.isInteger(ab.parede) && paredes[ab.parede]) return { i: ab.parede, metodo: ab.parede_metodo || 'arquivo' };
    const c = ab.centro_planta_mm, dir = ab.direcao_planta;
    let melhor = null;
    paredes.forEach((p, i) => {
      const { a, b } = p.planta, L = dist(a, b) || 1, u = unit(a, b);
      if (dir && Math.abs(dir[0] * u[0] + dir[1] * u[1]) < COS_PARALELO) return;
      const t = Math.max(0, Math.min(L, (c[0] - a[0]) * u[0] + (c[1] - a[1]) * u[1]));
      const d = Math.hypot(c[0] - (a[0] + u[0] * t), c[1] - (a[1] + u[1] * t));
      if (d <= TOL_ABERTURA_MM && (!melhor || d < melhor.d)) melhor = { i, d };
    });
    return melhor ? { i: melhor.i, metodo: 'geometria' } : null;
  }

  function novoId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
  }

  function importarScan(json, opc) {
    opc = opc || {};
    const uid = opc.uid || novoId;
    const av = [];
    if (!json || json.formato !== 'nycxo-scan') throw new Error('Arquivo nao e um scan NYCXO (formato esperado: nycxo-scan).');
    if (json.versao !== 1) throw new Error('Versao de scan nao suportada: ' + json.versao + ' (esperada: 1).');
    if (json.unidade !== 'mm') throw new Error('Unidade inesperada: ' + json.unidade + ' (esperada: mm).');
    const paredes = json.paredes || [];
    if (paredes.length < 3) throw new Error('O scan tem menos de 3 paredes; nao da para montar o esboco.');

    // 1) contorno: o do arquivo (se consistente) ou recalculado
    let ct = json.contorno;
    const valido = ct && Array.isArray(ct.ordem) && ct.ordem.length === paredes.length &&
      new Set(ct.ordem).size === paredes.length && ct.ordem.every(i => paredes[i]) &&
      ct.vertices_mm && ct.vertices_mm.length === paredes.length;
    if (!valido) { ct = construirContorno(paredes); if (json.contorno) av.push('contorno do arquivo invalido; recalculado'); }
    av.push(...(ct.avisos || []));
    const n = ct.ordem.length;
    const pts = ct.vertices_mm.map(v => [v[0], v[1]]);

    // 2) paredes na ordem do contorno
    const posDaParede = new Map(ct.ordem.map((idx, k) => [idx, k]));
    const walls = ct.ordem.map(idx => ({ id: uid(), mm: Math.round(paredes[idx].comprimento_mm), o: 'lidar', scan_id: paredes[idx].id }));

    // 3) aberturas: parede-mae e distancia ao inicio da parede (no sentido do contorno)
    const aberturas = [];
    for (const ab of json.aberturas || []) {
      const mae = paredeMae(ab, paredes);
      if (!mae) { av.push(`abertura ${ab.indice} (${ab.tipo}) sem parede-mae; ignorada`); continue; }
      const k = posDaParede.get(mae.i), ini = pts[k], fim = pts[(k + 1) % n], u = unit(ini, fim);
      const c = ab.centro_planta_mm, larg = Math.round(ab.largura_mm);
      const proj = (c[0] - ini[0]) * u[0] + (c[1] - ini[1]) * u[1];
      let d = Math.round(proj - larg / 2);
      const maxd = Math.max(0, walls[k].mm - larg);
      if (d < 0 || d > maxd) { av.push(`abertura ${ab.indice} (${ab.tipo}) passa do limite da parede ${k + 1}; ajustada`); d = Math.max(0, Math.min(maxd, d)); }
      let tipo = ab.tipo;
      if (tipo === 'vao') { tipo = 'porta'; av.push(`abertura ${ab.indice}: vao livre importado como porta (o esboco so tem porta e janela)`); }
      aberturas.push({ id: uid(), tipo, parede: k, dist: d, larg, alt: Math.round(ab.altura_mm), peit: tipo === 'porta' ? 0 : Math.round(ab.peitoril_mm || 0), o: 'lidar' });
    }

    // 4) diagnostico (medidas do esboco montado)
    let s = 0;
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; s += p[0] * q[1] - q[0] * p[1]; }
    // fechamento como o PWA calcula: parte de pts[0] e soma mm ao longo da direcao de cada parede
    let P = pts[0].slice();
    for (let i = 0; i < n; i++) { const u = unit(pts[i], pts[(i + 1) % n]); P = [P[0] + u[0] * walls[i].mm, P[1] + u[1] * walls[i].mm]; }
    const diagnostico = {
      fechamento_mm: Math.round(dist(P, pts[0]) * 10) / 10,
      perimetro_mm: walls.reduce((t, w) => t + w.mm, 0),
      area_mm2: Math.round(Math.abs(s / 2)),
      avisos: av,
    };

    const alt = json.resumo && json.resumo.pe_direito_mm != null ? Math.round(json.resumo.pe_direito_mm) : null;
    const nome = String(opc.nome || (json.ambiente && json.ambiente.nome) || 'Scan LiDAR').slice(0, 40);
    const esboco = {
      id: uid(), nome, pts, walls, fechado: n > 2, aberturas,
      altura: alt, alturaO: alt == null ? null : 'lidar',
      pos: { x: 0, y: 0, w: 1200 },
    };
    return { esboco, objetos: json.objetos || [], diagnostico };
  }

  const API = { importarScan, construirContorno, paredeMae };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.NycxoScan = API;
})(typeof window !== 'undefined' ? window : globalThis);
