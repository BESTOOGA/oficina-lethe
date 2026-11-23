"""Gera dist/catalog.js a partir dos dados do OpenLethe (revisão fixa abaixo).

Uso, na pasta que contém o CLAUDE.md:

    python tools/gerar_catalogo.py

Os arquivos baixados ficam em tools/_cache_openlethe/ e são reaproveitados.
As 26 lutas e 55 inimigos da primeira versão da oficina são mantidos com os
mesmos IDs e nomes, para que rascunhos antigos continuem válidos.
"""
from __future__ import annotations

import collections
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

REV = "8f24cba5721482c85a7ab22ba2d2105914d175ac"
REPO = "LEAGUE-OF-NINE/OpenLethe"
RAW = f"https://raw.githubusercontent.com/{REPO}/{REV}/"
RES = "src/OpenLethe.Resources/"
STATIC = RES + "StaticData/static-data/"
LOCALE = RES + "Localize/en/"

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(__file__).resolve().parent / "_cache_openlethe"
OUT = ROOT / "dist" / "catalog.js"
MAX_UNITS = 12

KIND_LABEL = {
    "bossPool": "Chefe",
    "abBattlePool": "Anormalidade",
    "hardBattlePool": "Difícil",
    "hardAbBattlePool": "Anormalidade difícil",
    "battlePool": "Combate",
    "node": "Luta fixa",
}
KIND_ORDER = ["bossPool", "hardAbBattlePool", "abBattlePool", "hardBattlePool", "node", "battlePool"]


def fetch(path: str) -> bytes:
    target = CACHE / path.replace("/", "__")
    if not target.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(RAW + path, headers={"User-Agent": "oficina-lethe-catalog"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            target.write_bytes(resp.read())
    return target.read_bytes()


def load(path: str):
    return json.loads(fetch(path).decode("utf-8-sig"))


def tree() -> list[str]:
    target = CACHE / "tree.json"
    if not target.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        url = f"https://api.github.com/repos/{REPO}/git/trees/{REV}?recursive=1"
        req = urllib.request.Request(url, headers={"User-Agent": "oficina-lethe-catalog"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            target.write_bytes(resp.read())
    return [e["path"] for e in json.loads(target.read_text("utf-8"))["tree"] if e["type"] == "blob"]


def legacy_catalog() -> dict:
    text = OUT.read_text("utf-8")
    start = text.index("globalThis.LETHE_CATALOG = ") + len("globalThis.LETHE_CATALOG = ")
    data, _ = json.JSONDecoder().raw_decode(text[start:])
    legacy = data.get("legacy")
    if legacy:  # already regenerated once: keep the original selection
        ids = set(legacy["fights"])
        enemy_ids = set(legacy["enemies"])
        return {
            "fights": [f for f in data["fights"] if f["id"] in ids],
            "enemies": [e for e in data["enemies"] if e["id"] in enemy_ids],
        }
    return {"fights": data["fights"], "enemies": data["enemies"]}


def main() -> None:
    paths = tree()
    pick = lambda prefix, test=lambda p: True: [p for p in paths if p.startswith(prefix) and p.endswith(".json") and test(p)]
    wanted = (
        pick(STATIC + "battle-mirrordungeon/")
        + pick(STATIC + "mirrordungeon-theme-floor/")
        + pick(STATIC + "enemy/")
        + pick(STATIC + "abnormality-unit/")
        + pick(STATIC + "abnormality-event/")
        + pick(LOCALE, lambda p: re.search(r"/EN_(Enemies|AbEvents|ActionEvents|EGOgift_MirrorDungeon)", p) and "ResultLog" not in p)
        + [LOCALE + "EN_MirrorDungeonTheme-1.json", LOCALE + "EN_MirrorDungeonAbName.json"]
    )
    print(f"{len(wanted)} arquivos do OpenLethe ({REV[:8]})", file=sys.stderr)
    with ThreadPoolExecutor(16) as pool:
        list(pool.map(fetch, wanted))

    legacy = legacy_catalog()

    # --- battles and the theme pools that use them -------------------------
    battles: dict[int, dict] = {}
    for p in pick(STATIC + "battle-mirrordungeon/"):
        for b in load(p)["list"]:
            battles.setdefault(b["id"], b)
    theme_name = {x["id"]: x["name"] for x in load(LOCALE + "EN_MirrorDungeonTheme-1.json")["dataList"]}
    themes = []
    for p in sorted(pick(STATIC + "mirrordungeon-theme-floor/")):
        themes += load(p)["list"]
    themes.sort(key=lambda t: t["id"])
    uses: dict[int, list[tuple[int, str]]] = collections.defaultdict(list)
    for t in themes:
        opt = t["mapGenOption"]
        for kind in ("bossPool", "abBattlePool", "hardAbBattlePool", "hardBattlePool", "battlePool"):
            for b in opt.get(kind, []):
                uses[b].append((t["id"], kind))
        for step in t["mapGenSequence"]:
            if step["type"] == "FILL_EMPTY_BOSS":
                for b in step.get("numberList", []):
                    uses[b].append((t["id"], "bossPool"))
            for n in step.get("nodeList", []):
                if n.get("encounterId") and n["encounterId"] in battles:
                    uses[n["encounterId"]].append((t["id"], "bossPool" if n["encounterType"] == 6 else "node"))

    # --- unit names ---------------------------------------------------------
    names: dict[int, str] = {}
    for p in pick(LOCALE, lambda p: "/EN_Enemies" in p):
        for x in load(p).get("dataList", []):
            try:
                names.setdefault(int(x["id"]), x.get("name") or "")
            except (TypeError, ValueError):
                pass
    static: dict[int, dict] = {}
    for p in pick(STATIC + "enemy/") + pick(STATIC + "abnormality-unit/"):
        for x in load(p).get("list", []):
            static.setdefault(x["id"], x)

    def appearance_hint(uid: int) -> str:
        app = static.get(uid, {}).get("appearance") or ""
        t = re.sub(r"Appearance$", "", re.sub(r"^\d+_", "", app)).replace("_", " ")
        return re.sub(r"([a-z])([A-Z])", r"\1 \2", t).strip()

    def unit_name(uid: int) -> str | None:
        name = base_name(uid)
        if name and set(name) <= {"?", " "}:  # the game hides this one's name
            hint = appearance_hint(uid)
            return f"{name} ({hint})" if hint else f"{name} #{uid}"
        return name

    def base_name(uid: int) -> str | None:
        if names.get(uid):
            return names[uid]
        x = static.get(uid, {})
        for key in ("viewid", "sdPortrait"):
            try:
                v = int(x.get(key) or 0)
            except (TypeError, ValueError):
                v = 0
            if names.get(v):
                return names[v]
        m = re.match(r"(\d+)_", x.get("appearance") or "")
        if m and names.get(int(m.group(1))):
            return names[int(m.group(1))]
        return None

    legacy_names = {e["id"]: e["name"] for e in legacy["enemies"]}

    def usable(b: dict) -> bool:
        waves = b.get("waveList") or []
        if not waves:
            return False
        for w in waves:
            units = w.get("unitList") or []
            if not units or sum(u.get("unitCount", 1) for u in units) > MAX_UNITS:
                return False
            if any(not (unit_name(u["unitID"]) or legacy_names.get(u["unitID"])) for u in units):
                return False
        return True

    def composition(b: dict) -> str:
        return b["stageType"] + json.dumps([[(u["unitID"], u.get("unitCount", 1)) for u in w["unitList"]] for w in b["waveList"]])

    def fight_title(b: dict) -> str:
        seen: list[str] = []
        for w in b["waveList"]:
            for u in w["unitList"]:
                n = unit_name(u["unitID"]) or legacy_names.get(u["unitID"])
                if n not in seen:
                    seen.append(n)
        title = seen[0] if len(seen) == 1 else seen[0] + " e " + seen[1] if len(seen) == 2 else f"{seen[0]}, {seen[1]} +{len(seen) - 2}"
        return title

    # --- fights -------------------------------------------------------------
    fights = []
    taken = set()
    for f in legacy["fights"]:
        fights.append({**f, "group": "Seleção original da oficina"})
        taken.add(composition(f["battle"]))
    legacy_ids = {f["id"] for f in fights}
    candidates = sorted(
        (b for b in uses if b in battles and b not in legacy_ids),
        key=lambda b: (min(KIND_ORDER.index(k) for _, k in uses[b]), min(t for t, _ in uses[b]), b),
    )
    for bid in candidates:
        b = battles[bid]
        if not usable(b):
            continue
        key = composition(b)
        if key in taken:
            continue
        taken.add(key)
        theme_id, kind = min(uses[bid], key=lambda u: (u[0], KIND_ORDER.index(u[1])))
        kind = min((k for _, k in uses[bid]), key=KIND_ORDER.index)
        fight = {
            "id": bid,
            "name": fight_title(b),
            "type": b["stageType"],
            "group": theme_name.get(theme_id, f"Tema {theme_id}"),
            "kind": KIND_LABEL[kind],
            "battle": b,
        }
        if b.get("stageScriptList") or b.get("eventScriptName") or b.get("abnormalityEventList"):
            fight["scripted"] = True
        fights.append(fight)

    # --- enemies ------------------------------------------------------------
    usage: dict[int, collections.Counter] = collections.defaultdict(collections.Counter)
    bosses = set()
    for f in fights:
        for w in f["battle"]["waveList"]:
            for u in w["unitList"]:
                usage[u["unitID"]][f["type"]] += 1
        if f.get("kind") == "Chefe":
            bosses.add(f["battle"]["waveList"][0]["unitList"][0]["unitID"])
    for e in legacy["enemies"]:
        for t in e.get("types") or [e["type"]]:
            usage[e["id"]][t] += 0 if usage[e["id"]][t] else 1
    enemies = []
    for uid, count in usage.items():
        level = static.get(uid, {}).get("level")
        entry = {
            "id": uid,
            "name": legacy_names.get(uid) or unit_name(uid),
            "types": sorted(count, key=lambda t: -count[t]),
        }
        if level:
            entry["level"] = level
        if uid in bosses:
            entry["boss"] = True
        enemies.append(entry)
    enemies.sort(key=lambda e: (e["name"].lower(), e["id"]))

    # --- scenes -------------------------------------------------------------
    scenes = sorted({w["battleMapInfo"]["mapName"] for b in battles.values() for w in b["waveList"]
                     if (w.get("battleMapInfo") or {}).get("mapName")}, key=str.lower)

    # --- abnormality events -------------------------------------------------
    ab_name = {x["id"].rsplit("_", 1)[1]: x["content"] for x in load(LOCALE + "EN_MirrorDungeonAbName.json")["dataList"]}
    gift_name: dict[str, str] = {}
    for p in pick(LOCALE, lambda p: "/EN_EGOgift_MirrorDungeon" in p):
        for x in load(p).get("dataList", []):
            gift_name.setdefault(str(x.get("id")), x.get("name"))
    event_data: dict[int, dict] = {}
    for p in pick(STATIC + "abnormality-event/"):
        for x in load(p).get("list", []):
            event_data.setdefault(x["id"], x)
    event_text: dict[str, dict] = {}
    for p in pick(LOCALE, lambda p: re.search(r"/EN_(AbEvents|ActionEvents)", p) and "ResultLog" not in p):
        for x in load(p).get("dataList", []):
            event_text.setdefault(str(x.get("id")), x)
    pool = collections.Counter()
    for t in themes:
        pool.update(set(t["mapGenOption"].get("eventPool", [])))
    events = []
    for eid in sorted(pool):
        gifts = re.findall(r'"rewardId": (\d+)', json.dumps(event_data.get(eid, {})))
        row = {"id": eid, "desc": ((event_text.get(str(eid), {}).get("desc") or "").split("\n")[0]).strip()}
        name = next((ab_name[g] for g in gifts if g in ab_name), None)
        gift = next((gift_name[g] for g in gifts if gift_name.get(g) and g not in ab_name), None)
        if name:
            row["name"] = name
        if gift:
            row["gift"] = gift
        row["common"] = pool[eid] >= 10
        events.append(row)

    # --- write --------------------------------------------------------------
    catalog = {
        "source": f"https://github.com/{REPO}/tree/{REV}/src/OpenLethe.Resources",
        "legacy": {"fights": [f["id"] for f in legacy["fights"]], "enemies": [e["id"] for e in legacy["enemies"]]},
        "fights": fights,
        "enemies": enemies,
        "maps": scenes,
        "events": events,
    }
    compact = lambda v: json.dumps(v, ensure_ascii=False, separators=(",", ":"))
    lines = ["// Gerado por tools/gerar_catalogo.py a partir do OpenLethe. Não edite à mão.",
             "globalThis.LETHE_CATALOG = {",
             f'"source":{compact(catalog["source"])},',
             f'"legacy":{compact(catalog["legacy"])},',
             '"fights":[']
    lines.append(",\n".join(compact(f) for f in fights))
    lines.append('],"enemies":[')
    lines.append(",\n".join(compact(e) for e in enemies))
    lines.append(f'],"maps":{compact(scenes)},')
    lines.append('"events":[')
    lines.append(",\n".join(compact(e) for e in events))
    lines.append("]};")
    text = "\n".join(lines) + "\n"
    assert "</script" not in text.lower()
    OUT.write_text(text, encoding="utf-8")
    kinds = collections.Counter(f.get("kind", "original") for f in fights)
    print(f"{len(fights)} lutas {dict(kinds)}, {len(enemies)} inimigos, {len(scenes)} cenários, "
          f"{len(events)} encontros, {OUT.stat().st_size // 1024} KB", file=sys.stderr)


if __name__ == "__main__":
    main()
