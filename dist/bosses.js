// Custom bosses uploaded as a Lethe mod ZIP. Every file of the mod folder is
// kept (base64) in IndexedDB, its units and the battles that use them join the
// catalog, and its files ship inside the exported pack. There is no size limit:
// the draft in localStorage only names the bosses.
(() => {
  'use strict';

  // Paths that belong to the uploaded mod's own pack or stage: the Oficina
  // writes its own theme, battles and titles, so these never ship.
  const SKIP = [
    /^custom_limbus_data\/mirrordungeon-theme-floor\//,
    /^custom_limbus_data\/battle-mirrordungeon\//,
    /^custom_encounters\//,
    /^custom_limbus_locale\/[^/]+\/mirrorDungeonThemeList\//,
    /^custom_limbus_locale\/[^/]+\/stageNodeText\//
  ];

  function toBase64(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(out);
  }
  function fromBase64(text) {
    const raw = atob(text);
    return Uint8Array.from(raw, ch => ch.charCodeAt(0));
  }
  const decoder = new TextDecoder();
  function json(boss, path) {
    try { return JSON.parse(decoder.decode(fromBase64(boss.files[path])).replace(/^﻿/, '')); }
    catch { return null; }
  }
  const paths = (boss, re) => Object.keys(boss.files).filter(p => re.test(p)).sort();

  // Locale files come either as Lethe's {id: {...}} or the game's {dataList: [...]}.
  function localeEntries(data) {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.dataList)) return data.dataList;
    return Object.entries(data).map(([id, v]) => ({ id, ...(v && typeof v === 'object' ? v : {}) }));
  }

  async function fromZip(buffer, fileName) {
    const raw = await globalThis.unpackZip(buffer);
    // The mod root is the folder that holds custom_limbus_data; everything under
    // it ships (custom_*, motion_appearances for the Motions plugin, …).
    const anchor = Object.keys(raw).map(p => p.match(/^(.*?)custom_limbus_data\//)).find(Boolean);
    if (!anchor) throw new Error('Não achei a pasta custom_limbus_data dentro do ZIP.');
    const root = anchor[1];
    const files = {};
    for (const [path, bytes] of Object.entries(raw)) {
      if (!path.startsWith(root)) continue;
      const rel = path.slice(root.length);
      if (!rel || /(^|\/)(\.DS_Store|Thumbs\.db)$|^__MACOSX\//i.test(rel)) continue;
      if (!rel.includes('/')) continue; // loose files at the mod root (notes, readme)
      files[rel] = toBase64(bytes);
    }
    const boss = { key: '', name: '', file: fileName, files };
    const info = describe(boss);
    if (!info.enemies.length) throw new Error('Não achei inimigos em custom_limbus_data/enemy nem em abnormality-unit dentro do ZIP.');
    if (!info.fights.length) throw new Error('O ZIP não tem nenhuma luta (battle-mirrordungeon ou custom_encounters) com os inimigos dele.');
    boss.name = info.enemies.find(e => e.boss)?.name || info.enemies[0].name;
    boss.key = 'boss-' + info.enemies.map(e => e.id).sort((a, b) => a - b).join('-');
    return boss;
  }

  // Enemies, battles and names found in a boss's files.
  function describe(boss) {
    const names = new Map(), titles = new Map();
    for (const p of paths(boss, /^custom_limbus_locale\/EN\/enemyList\//)) {
      for (const e of localeEntries(json(boss, p))) if (e.name) names.set(Number(e.id), e.name);
    }
    for (const p of paths(boss, /^custom_limbus_locale\/EN\/stageNodeText\//)) {
      for (const e of localeEntries(json(boss, p))) if (e.title) titles.set(Number(e.id), e.title);
    }
    const units = [];
    for (const p of paths(boss, /^custom_limbus_data\/(enemy|abnormality-unit)\/.+\.json$/)) {
      for (const u of json(boss, p)?.list || []) if (Number.isInteger(u.id)) units.push(u);
    }
    const ids = new Set(units.map(u => u.id));
    const battles = [];
    for (const p of paths(boss, /^custom_limbus_data\/battle-mirrordungeon\/.+\.json$/)) {
      for (const b of json(boss, p)?.list || []) battles.push(b);
    }
    for (const p of paths(boss, /^custom_encounters\/[^/]+\/encounter\.json$/)) {
      const b = json(boss, p);
      if (b && Array.isArray(b.waveList)) battles.push(b);
    }
    const seen = new Set();
    const fights = battles.filter(b => Number.isInteger(b.id) && Array.isArray(b.waveList) && b.waveList.length
      && b.waveList.every(w => Array.isArray(w.unitList) && w.unitList.length)
      && b.waveList.some(w => w.unitList.some(u => ids.has(u.unitID)))
      && !seen.has(b.id) && seen.add(b.id));
    const types = new Map();
    for (const b of fights) for (const w of b.waveList) for (const u of w.unitList) {
      if (!ids.has(u.unitID)) continue;
      if (!types.has(u.unitID)) types.set(u.unitID, new Set());
      types.get(u.unitID).add(b.stageType === 'Abnormality' ? 'Abnormality' : 'Normal');
    }
    const enemies = units.map(u => ({
      id: u.id,
      name: names.get(u.id) || names.get(u.nameID) || 'Inimigo ' + u.id,
      types: [...(types.get(u.id) || ['Normal'])],
      level: u.level,
      boss: types.has(u.id)
    }));
    return {
      enemies,
      fights: fights.map(b => ({
        id: b.id,
        name: titles.get(b.id) || enemies.find(e => b.waveList[0].unitList.some(u => u.unitID === e.id))?.name || 'Luta ' + b.id,
        type: b.stageType === 'Abnormality' ? 'Abnormality' : 'Normal',
        battle: b
      }))
    };
  }

  // Puts the bosses' enemies and fights into the catalog (replacing earlier
  // custom entries). Vanilla units a boss fight uses but the catalog lacks
  // get a placeholder, so the fight stays editable.
  function register(catalog, bosses) {
    catalog.fights = catalog.fights.filter(f => !f.custom);
    catalog.enemies = catalog.enemies.filter(e => !e.custom);
    const fightIds = new Set(catalog.fights.map(f => f.id));
    const enemyIds = new Set(catalog.enemies.map(e => e.id));
    const problems = [];
    for (const boss of bosses || []) {
      const info = describe(boss);
      for (const e of info.enemies) {
        if (enemyIds.has(e.id)) { problems.push(boss.name + ': o inimigo ' + e.id + ' já existe no jogo e foi ignorado.'); continue; }
        catalog.enemies.push({ ...e, custom: boss.key });
        enemyIds.add(e.id);
      }
      for (const f of info.fights) {
        if (fightIds.has(f.id)) { problems.push(boss.name + ': a luta ' + f.id + ' já existe e foi ignorada.'); continue; }
        catalog.fights.push({ ...f, group: 'Boss enviado · ' + boss.name, kind: 'Boss enviado', custom: boss.key });
        fightIds.add(f.id);
        for (const w of f.battle.waveList) for (const u of w.unitList) {
          if (enemyIds.has(u.unitID)) {
            const known = catalog.enemies.find(x => x.id === u.unitID);
            if (known && !known.types.includes(f.type)) known.types = [...known.types, f.type];
            continue;
          }
          catalog.enemies.push({ id: u.unitID, name: 'Unidade ' + u.unitID, types: [f.type], custom: boss.key });
          enemyIds.add(u.unitID);
        }
      }
    }
    return problems;
  }

  // Files of the bosses the project actually uses, ready for the pack.
  function exportFiles(project) {
    const out = {};
    const catalog = globalThis.LETHE_CATALOG;
    const usedEnemies = new Set(project.fights.flatMap(f => (f.waves || []).flat().map(u => u.id)));
    for (const boss of project.customBosses || []) {
      const fightIds = new Set(catalog.fights.filter(f => f.custom === boss.key).map(f => f.id));
      const enemyIds = new Set(catalog.enemies.filter(e => e.custom === boss.key).map(e => e.id));
      const used = project.fights.some(f => fightIds.has(f.templateId)) || [...enemyIds].some(id => usedEnemies.has(id));
      if (!used) continue;
      for (const [path, data] of Object.entries(boss.files)) {
        if (SKIP.some(re => re.test(path))) continue;
        out[path] = fromBase64(data);
      }
    }
    return out;
  }

  function validBoss(b) {
    return b && typeof b.key === 'string' && typeof b.name === 'string' && b.files && typeof b.files === 'object'
      && Object.values(b.files).every(v => typeof v === 'string');
  }
  // What the draft in localStorage keeps of a boss: its name only.
  const stub = b => ({ key: b.key, name: b.name, file: b.file || '' });
  const validStub = b => b && typeof b.key === 'string' && typeof b.name === 'string';
  const size = b => Object.values(b.files || {}).reduce((n, v) => n + Math.floor(v.length * 3 / 4), 0);

  // IndexedDB store with the full boss files, keyed by boss key.
  const DB = 'oficina-lethe', STORE = 'bosses';
  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('O navegador bloqueou o armazenamento dos bosses.'));
    });
  }
  async function run(mode, work) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode), store = tx.objectStore(STORE);
        const req = work(store);
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('Falha ao salvar o boss no navegador.'));
      });
    } finally { db.close(); }
  }
  const store = {
    put: boss => run('readwrite', s => s.put(boss)),
    remove: key => run('readwrite', s => s.delete(key)),
    get: key => run('readonly', s => s.get(key))
  };

  globalThis.LetheBosses = { fromZip, describe, register, exportFiles, validBoss, validStub, stub, size, store, SKIP };
})();
