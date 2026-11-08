"""Обновляет список предметов в helper.user.js данными с robrun.info.
Запуск: python tools/update-items.py"""
import json, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SITE = "https://robrun.info"
SCRIPT = Path(__file__).resolve().parent.parent / "helper.user.js"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "robrun-helper-updater"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")

def main():
    data = json.loads(get(SITE + "/search.json"))
    def has_map(i):
        try: return "/map/#find=" in get(f"{SITE}/items/{i['id']}/")
        except Exception: return False
    with ThreadPoolExecutor(8) as ex:
        maps = list(ex.map(has_map, data))
    items, seen = [], {}
    for i, m in zip(data, maps):
        ru = i["n"].strip()
        q = i["q"].lower()
        rest = q.replace(i["id"], "").strip()
        t = i["t"].lower()
        if rest.endswith(t): rest = rest[: -len(t)].strip()
        en = rest[len(ru):].strip() if rest.startswith(ru.lower()) else ""
        key = ru.lower()
        if key in seen:
            old = items[seen[key]]
            if m and not old[3]: old[2], old[3] = i["id"], 1  # берём вариант, который есть на карте
            continue
        seen[key] = len(items)
        items.append([ru, en, i["id"], 1 if m else 0])
    js = SCRIPT.read_text(encoding="utf-8")
    block = "/*ITEMS-START*/" + json.dumps(items, ensure_ascii=False) + "/*ITEMS-END*/"
    js, n = re.subn(r"/\*ITEMS-START\*/.*?/\*ITEMS-END\*/", lambda _: block, js, flags=re.S)
    if not n: sys.exit("Не нашёл метку ITEMS-START в helper.user.js")
    SCRIPT.write_text(js, encoding="utf-8")
    print(f"Готово: {len(items)} предметов, {sum(x[3] for x in items)} с местом на карте")

if __name__ == "__main__":
    main()
