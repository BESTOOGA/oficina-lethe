// The floor shape and node kinds follow OpenLethe's CREATE_FIXED_FLOOR records
// in mirrordungeon-theme-floor and its MdMapGen.GenerateNewFloor implementation.
(() => {
  'use strict';

  const MAX_FIGHTS = 98;
  // The shipped enemy formation 2 has twelve slots. Preserve the base layout
  // while it fits, then use this larger formation for an expanded roster.
  const MAX_UNITS = 12;
  // The shipped MD records go up to four waves; leave a little headroom.
  const MAX_WAVES = 6;
  const formationSlots = new Map([[16, 3], [17, 4], [18, 5], [21, 6]]);
  const ORIGINAL_THEME_GIFTS = [
    9001, 9002, 9003, 9004, 9005, 9006, 9007, 9008, 9009, 9010,
    9011, 9012, 9013, 9014, 9015, 9016, 9017, 9018, 9019, 9020,
    9021, 9022, 9023, 9024, 9025, 9026, 9027, 9028, 9029, 9030,
    9031, 9032, 9033, 9034, 9035, 9036, 9037, 9038, 9039, 9040,
    9041, 9042, 9043, 9044, 9046, 9047, 9048, 9049, 9051, 9052,
    9053, 9054, 9056, 9057, 9059, 9061, 9062, 9063, 9064, 9066,
    9069, 9071, 9072, 9073, 9074, 9086, 9087, 9089, 9091, 9093,
    9095, 9097, 9099
  ];

  function isPositiveInteger(value) {
    return Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
  }

  function buildBattle(fight, battleId, catalog) {
    const template = catalog.fights.find(item => item.id === fight.templateId);
    if (!template) throw new Error('Escolha uma luta base do catálogo.');
    const battle = JSON.parse(JSON.stringify(template.battle));
    battle.id = battleId;
    if (fight.waves === undefined) return battle;
    if (!Array.isArray(fight.waves) || fight.waves.length < 1 || fight.waves.length > MAX_WAVES) {
      throw new Error('Cada luta tem de 1 a ' + MAX_WAVES + ' ondas.');
    }
    // Extra waves start as a copy of the base fight's last wave (music, formation).
    const baseWaves = battle.waveList;
    battle.waveList = fight.waves.map((_, i) => JSON.parse(JSON.stringify(baseWaves[Math.min(i, baseWaves.length - 1)])));
    const scenes = globalThis.LETHE_CATALOG.maps || [];
    battle.waveList.forEach((wave, i) => {
      const scene = Array.isArray(fight.maps) ? fight.maps[i] : null;
      if (scene) {
        if (!scenes.includes(scene)) throw new Error('Escolha um cenário da lista.');
        wave.battleMapInfo = { ...(wave.battleMapInfo || {}), mapName: scene };
      }
      // Chain battle: the Line packs flag every wave so the player picks a new
      // team before each one (see 2068131 in battle-mirrordungeon).
      if (fight.chain) wave.useUserSelection = true;
      else delete wave.useUserSelection;
    });
    battle.waveList.forEach((wave, waveIndex) => {
      const units = fight.waves[waveIndex];
      if (!Array.isArray(units) || !units.length) throw new Error('Cada onda precisa ter pelo menos um inimigo.');
      const originalSize = wave.unitList.reduce((sum, unit) => sum + (unit.unitCount ?? 1), 0);
      const same = units.length === wave.unitList.length && units.every((unit, i) => {
        const original = wave.unitList[i];
        return unit.id === original.unitID && unit.count === (original.unitCount ?? 1)
          && unit.level === (original.unitLevel ?? battle.stageLevel);
      });
      // An untouched wave keeps everything the game wrote for it, reinforcements
      // (subUnitList) included. Reinforcements belong to the original roster, so
      // they are dropped once the player changes the enemies.
      if (same) return;
      delete wave.subUnitList;
      wave.unitList = units.map(unit => {
        const enemy = catalog.enemies.find(item => item.id === unit.id && (item.types || [item.type]).includes(template.type));
        if (!enemy) throw new Error('Escolha um inimigo compatível com o tipo da luta.');
        if (!isPositiveInteger(unit.count) || !isPositiveInteger(unit.level)) {
          throw new Error('Use números inteiros positivos na quantidade e no nível de cada inimigo.');
        }
        return { unitID: enemy.id, unitCount: unit.count, unitLevel: unit.level };
      });
      const newSize = wave.unitList.reduce((sum, unit) => sum + unit.unitCount, 0);
      if (newSize > MAX_UNITS) throw new Error('A formação comporta até 12 inimigos por onda.');
      if (newSize > (formationSlots.get(wave.enemyPositionID) ?? originalSize)) wave.enemyPositionID = 2;
    });
    return battle;
  }

  // Generic Mirror Dungeon events, the same list pack 1024 hands to FILL_EMPTY_EVENT.
  // Event nodes ship with encounterId 0 and the game draws one of these for each.
  const EVENT_POOL = [
    901009, 901014, 901001, 901002, 901018, 901024, 901016, 901019, 901031, 901030,
    901011, 901059, 901010, 901013, 901034, 901033, 901021, 901063, 901085, 971055
  ];
  const MAP_LIMITS = { tree: 12, line: 30 };

  // The map is always exported as CREATE_FIXED_FLOOR, so what the editor shows is
  // exactly what the game builds. "tree" ports MdMapGen.GenerateMd4Graph with a
  // seeded RNG; "line" is the straight layout of the Railway (Line) packs.
  function normalizeMap(project) {
    const regular = Math.max(0, (project.fights?.length ?? 1) - 1);
    const map = project.map && typeof project.map === 'object' ? project.map : {};
    const shape = map.shape === 'tree' ? 'tree' : map.shape === 'line' ? 'line' : (project.map ? 'tree' : 'line');
    const limit = MAP_LIMITS[shape];
    let steps = Number.isInteger(map.steps) ? map.steps : Math.max(1, regular);
    steps = Math.min(limit, Math.max(1, steps));
    const events = Number.isInteger(map.events) ? Math.max(0, map.events) : 0;
    const seed = Number.isInteger(map.seed) ? map.seed >>> 0 : (project.packId >>> 0);
    return { shape, steps, events, seed };
  }

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randInt = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  function shuffle(list, r) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  function boolVec(r, len, weight, lo, hi) {
    const on = Math.max(weight + randInt(r, lo, hi), 2);
    return shuffle(Array.from({ length: len }, (_, i) => i < on), r);
  }

  // Returns grid cells {x, y} and edges between them; x is 0-based inside the grid.
  function treeGrid(width, r) {
    for (let attempt = 0; attempt < 64; attempt++) {
      const pop = [boolVec(r, width, width >> 1, 0, 2), boolVec(r, width, width >> 1, 1, 3), boolVec(r, width, width >> 1, 0, 2)];
      const has = (x, y) => x >= 0 && x < width && y >= 0 && y < 3 && cells.has(x * 3 + y);
      const cells = new Set();
      for (let x = 0; x < width; x++) for (let y = 0; y < 3; y++) {
        if (pop[y][x] || (!pop[1][x] && y !== 1) || (x > 0 && y === 1 && !pop[1][x - 1]) || (x === 0 && y !== 1)) cells.add(x * 3 + y);
      }
      const edges = new Set();
      for (let x = 0; x < width - 1; x++) for (let y = 0; y < 3; y++) {
        if (!has(x, y)) continue;
        for (let dy = -1; dy <= 1; dy++) if (has(x + 1, y + dy)) edges.add(x + ',' + y + '>' + (y + dy));
      }
      // Drop one of every pair of crossing diagonals, as the game does.
      for (const edge of [...edges]) {
        const [x, rest] = edge.split(','), [y, ny] = rest.split('>').map(Number);
        if (ny !== y - 1) continue;
        const cross = x + ',' + (y - 1) + '>' + y;
        if (edges.has(edge) && edges.has(cross)) edges.delete(r() < 0.5 ? cross : edge);
      }
      const list = [...cells].map(c => ({ x: Math.floor(c / 3), y: c % 3 }));
      const reachable = list.every(({ x, y }) => x === 0 || [...edges].some(e => e.startsWith((x - 1) + ',') && e.endsWith('>' + y)));
      const leaves = list.every(({ x, y }) => x === width - 1 || [...edges].some(e => e.startsWith(x + ',' + y + '>')));
      if (reachable && leaves) return { cells: list, edges };
    }
    // Fallback: a single middle lane.
    const cells = Array.from({ length: width }, (_, x) => ({ x, y: 1 }));
    return { cells, edges: new Set(cells.slice(0, -1).map(({ x }) => x + ',1>1')) };
  }

  // Lays out the floor. fights: [{type}] in editor order, the last one is the boss.
  // Returns nodes {sector, idx, kind, fight, next[]} plus the indices of unused fights.
  function buildLayout(project) {
    const map = normalizeMap(project);
    const fights = project.fights;
    const regularCount = fights.length - 1;
    const r = rng(map.seed);
    const width = map.steps;
    const grid = map.shape === 'tree'
      ? treeGrid(width, r)
      : { cells: Array.from({ length: width }, (_, x) => ({ x, y: 0 })), edges: new Set(Array.from({ length: width - 1 }, (_, x) => x + ',0>0')) };
    const row = map.shape === 'tree' ? 1 : 0;
    // Events: a stable shuffle, so raising the count only adds new "?" nodes.
    const order = shuffle(grid.cells.map((_, i) => i), rng(map.seed ^ 0x9e3779b9));
    const eventCount = regularCount === 0 ? grid.cells.length : Math.min(map.events, grid.cells.length);
    const isEvent = new Set(order.slice(0, eventCount));
    // Battles: earlier fights early in the floor, parallel branches take the next ones.
    const used = new Set();
    const perColumn = new Map();
    const nodes = [{ sector: 0, idx: 0, kind: 'start', fight: null, next: [...new Set(grid.cells.filter(c => c.x === 0).map(c => c.y))].sort() }];
    grid.cells.slice().sort((a, b) => a.x - b.x || a.y - b.y).forEach(cell => {
      const i = grid.cells.indexOf(cell);
      const next = cell.x === width - 1 ? [row] : [...grid.edges].filter(e => e.startsWith(cell.x + ',' + cell.y + '>')).map(e => Number(e.split('>')[1])).sort();
      const node = { sector: cell.x + 1, idx: cell.y, kind: 'event', fight: null, next };
      if (!isEvent.has(i)) {
        const j = perColumn.get(cell.x) ?? 0;
        perColumn.set(cell.x, j + 1);
        node.kind = 'battle';
        node.fight = (Math.floor(cell.x * regularCount / width) + j) % regularCount;
        used.add(node.fight);
      }
      nodes.push(node);
    });
    nodes.push({ sector: width + 1, idx: row, kind: 'shop', fight: null, next: [0] });
    nodes.push({ sector: width + 2, idx: 0, kind: 'boss', fight: fights.length - 1, next: [] });
    const unused = [];
    for (let i = 0; i < regularCount; i++) if (!used.has(i)) unused.push(i);
    return { map, nodes, unused, events: eventCount, cells: grid.cells.length };
  }

  // Abnormality encounters for the "?" nodes. allowed: event ids that can show
  // up; up: the rate-up ones, exported as specialEventPool, which the event
  // picker draws first with specialEventProb (MdEventPicker.Pick). Without the
  // field, the 20 generic events of pack 1024 are allowed, as before.
  function normalizeEvents(project) {
    const known = new Set((globalThis.LETHE_CATALOG.events || []).map(e => e.id));
    const raw = project.events && typeof project.events === 'object' ? project.events : {};
    const clean = list => [...new Set((Array.isArray(list) ? list : []).filter(id => known.has(id)))];
    const allowed = Array.isArray(raw.allowed) ? clean(raw.allowed) : EVENT_POOL.filter(id => known.has(id));
    const up = clean(raw.up).filter(id => allowed.includes(id));
    const chance = Number.isInteger(raw.chance) ? Math.min(100, Math.max(1, raw.chance)) : 50;
    return { allowed, up, chance };
  }
  function eventPools(project) {
    const { allowed, up, chance } = normalizeEvents(project);
    const regular = allowed.filter(id => !up.includes(id));
    return { all: allowed, regular, up, chance: up.length && !regular.length ? 1 : chance / 100 };
  }

  // Floors where the pack can be offered, as 0-based floor numbers.
  // normal: Normal Mirror Dungeon, floors 1-5. hard: Hard, floors 1-15.
  const FLOOR_LIMITS = { normal: 5, hard: 15 };
  function normalizeFloors(project) {
    const raw = project.floors && typeof project.floors === 'object' ? project.floors : { normal: [0], hard: [0] };
    const clean = (list, max) => [...new Set((Array.isArray(list) ? list : []).filter(f => Number.isInteger(f) && f >= 0 && f < max))].sort((a, b) => a - b);
    return { normal: clean(raw.normal, FLOOR_LIMITS.normal), hard: clean(raw.hard, FLOOR_LIMITS.hard) };
  }
  // exceptionConditions as the game tables write them: dungeonIdx 0 is Normal,
  // 1-3 are Hard floors 1-5, 6-10 and 11-15; selectableFloors is the offset inside
  // those five floors, and is left out when all five are allowed (see 1108, 1501).
  function floorConditions(floors) {
    const conditions = [];
    if (floors.normal.length) conditions.push({ dungeonIdx: 0, selectableFloors: floors.normal });
    for (let act = 0; act < 3; act++) {
      const offsets = floors.hard.filter(f => Math.floor(f / 5) === act).map(f => f % 5);
      if (!offsets.length) continue;
      conditions.push(offsets.length === 5 && act > 0 ? { dungeonIdx: act + 1 } : { dungeonIdx: act + 1, selectableFloors: offsets });
    }
    if (!conditions.length) throw new Error('Escolha pelo menos um andar em que o pacote aparece.');
    return conditions;
  }

  function buildTheme(id, name, battles, layout) {
    const finalBattle = battles[battles.length - 1];
    const typeOf = battle => battle.stageType === 'Abnormality' ? 5 : 1;
    const nodeList = layout.nodes.map(node => ({
      sector: node.sector,
      idx: node.idx,
      encounterType: { start: 0, event: 3, shop: 10, boss: 6 }[node.kind] ?? typeOf(battles[node.fight]),
      encounterId: node.kind === 'battle' || node.kind === 'boss' ? battles[node.fight].id : 0,
      connectedNextNodeIdxList: node.next
    }));
    const placed = [...new Set(layout.nodes.filter(n => n.kind === 'battle').map(n => n.fight))].map(i => battles[i]);
    const hasEvents = layout.nodes.some(n => n.kind === 'event');
    const sequence = [{ type: 'CREATE_FIXED_FLOOR', numberList: [layout.map.steps + 1, 3, 1], nodeList }];
    if (hasEvents) {
      if (!layout.events.all.length) throw new Error('O mapa tem eventos “?”. Libere pelo menos um encontro de abno.');
      sequence.push({ type: 'FILL_EMPTY_EVENT', numberList: layout.events.all });
    }
    return {
      id,
      desc: name,
      unlockCondition: { unlockCode: 101 },
      exceptionConditions: floorConditions(layout.floors),
      mapGenOption: {
        bossPool: [finalBattle.id],
        battlePool: placed.filter(b => b.stageType === 'Normal').map(b => b.id),
        abBattlePool: placed.filter(b => b.stageType === 'Abnormality').map(b => b.id),
        hardBattlePool: [], hardAbBattlePool: [],
        eventPool: hasEvents ? layout.events.regular : [],
        ...(hasEvents && layout.events.up.length ? { specialEventPool: layout.events.up, specialEventProb: layout.events.chance } : {})
      },
      egoGiftPool: [...ORIGINAL_THEME_GIFTS],
      specificEgoGiftPool: [],
      mapGenSequence: sequence,
      uiConfigs: {
        showBossIds: [finalBattle.waveList[0].unitList[0].unitID],
        packSpriteId: 'Canto_I',
        textColor: 'af241c',
        mapOptions: [
          { key: 'SetColor_Basic', value: 'af241c' },
          { key: 'SetColor_Cleared', value: '423231' },
          { key: 'MirrorDungeon4_Base' }
        ]
      }
    };
  }

  function themeIds(project) {
    const rate = project.rateUp ?? 1;
    if (![1, 2, 4].includes(rate)) throw new Error('Escolha 1, 2 ou 4 entradas no sorteio.');
    const ids = [project.packId];
    // MdMapGen samples distinct eligible IDs uniformly, and ignores a weight on
    // an individual theme. Extra tickets must therefore be real, named themes.
    // Each six-digit project ID owns three stable aliases outside the project
    // ID range. All entries reference the very same battle records.
    for (let slot = 1; slot < rate; slot++) ids.push(10000000 + project.packId * 3 + slot - 1);
    return ids;
  }

  function buildFiles(project) {
    const name = typeof project?.name === 'string' ? project.name.trim() : '';
    if (!name) throw new Error('Dê um nome ao pacote.');
    if (!Number.isInteger(project.packId) || project.packId < 100000 || project.packId > 999999) {
      throw new Error('O identificador do pacote precisa ter seis dígitos.');
    }
    if (!Array.isArray(project.fights) || !project.fights.length || project.fights.length > MAX_FIGHTS) {
      throw new Error('Escolha de 1 a ' + MAX_FIGHTS + ' lutas.');
    }
    // Reserve 100 encounter IDs per mod. Keep them beyond the original MD
    // data and inside the signed integer range used by the client.
    const firstId = 500000000 + project.packId * 100;
    const battles = project.fights.map((fight, index) => buildBattle(fight, firstId + index + 1, globalThis.LETHE_CATALOG));
    const theme = buildTheme(project.packId, name, battles, { ...buildLayout(project), floors: normalizeFloors(project), events: eventPools(project) });
    const skin = globalThis.LETHE_SKINS.resolve(project);
    theme.uiConfigs = { ...skin.appearance, showBossIds: theme.uiConfigs.showBossIds };
    const toJson = value => JSON.stringify(value, null, 2) + '\n';
    const filename = 'oficina-' + project.packId + '.json';
    const themes = themeIds(project).map(id => ({ ...theme, id }));
    const files = {
      ['custom_limbus_data/mirrordungeon-theme-floor/' + filename]: toJson({ list: themes }),
      ['custom_limbus_data/battle-mirrordungeon/' + filename]: toJson({ list: battles })
    };
    // Lethe reads custom_limbus_locale/<lang>/<list>/*.json as an object keyed by id
    // (the game's own { dataList: [...] } shape left every title as "Unknown").
    // mirrorDungeonThemeList names the packs; stageNodeText titles the battles,
    // keyed by battle id like the game's MirrorDungeonNode texts.
    const packTitles = toJson(Object.fromEntries(themes.map(({ id }) => [String(id), { id, name }])));
    const fightTitles = toJson(Object.fromEntries(battles.map((battle, i) => {
      const fight = project.fights[i];
      const template = globalThis.LETHE_CATALOG.fights.find(item => item.id === fight.templateId);
      const title = (typeof fight.title === 'string' && fight.title.trim()) || template.name;
      return [String(battle.id), { id: battle.id, title, desc: '' }];
    })));
    for (const language of ['EN', 'KR', 'JP']) {
      files['custom_limbus_locale/' + language + '/mirrorDungeonThemeList/' + filename] = packTitles;
      files['custom_limbus_locale/' + language + '/stageNodeText/' + filename] = fightTitles;
    }
    globalThis.LETHE_SKINS.addCoverFiles(files, project, themes);
    // Uploaded bosses ship their enemy, skill, buff, locale and sprite files.
    if (globalThis.LetheBosses) Object.assign(files, globalThis.LetheBosses.exportFiles(project));
    return files;
  }

  globalThis.LetheExport = { buildFiles, buildLayout, normalizeMap, themeIds, MAX_FIGHTS, MAX_UNITS, MAX_WAVES, MAP_LIMITS, FLOOR_LIMITS, normalizeFloors, floorConditions, normalizeEvents, EVENT_POOL };
})();
