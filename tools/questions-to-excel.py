"""Собирает вопросы из questions/*.md в Excel, отсеивая то, на что сайт ответить не может.
Запуск: python tools/questions-to-excel.py   → questions/voprosy.xlsx"""
import re, glob
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent / "questions"

# Причина удаления → корни слов. Порядок важен: первая совпавшая причина.
DROP = [
    ("Не может зайти / загрузка / вылеты / лаги", r"не (могу|может|можем|получается|пускает|пускают) .{0,15}(зайти|попасть|войти|загруз|прогруз)|не пуска|не заход|не запуска|не загруж|не грузит|не входит|грузит|загруж|загрузк|бесконечн|ждем информ|ждём информ|информацию о готов|о подготовке|waiting for status|loading|лаг|фриз|фпс|fps|пинг|ping|вылет|выкида|выбива|кикает|кикнуло|краш|crash|шейдер|il2cpp|failed|error|ошибк|черный экран|чёрный экран|тормоз|микро|войс|voice|звук|камер|разрешени|не регает|прогруж|релогн|перезаход|повисл|завис|ждем объект|ждём объект|проблем\w* со вход|зайти на лок|на свою хат|домой не|в дом не|в дом пуска|на территорию дома|запускает в игру|на карту через раз|выкинуло на карту|лосс|loss|у всех (заход|загруж|грузит)|во как зайти|driver|\.sys"),
    ("Баги и фиксы", r"\bбаг|bug|фикс|fix|пофикс|почин|сломал|глюч|глюк|не работает|не робит|забаг|откат|откатил|прогресс.*(слет|пропал|не сохран)|пропал|исчез|бекап|бэкап"),
    ("Сервера / DDoS / техработы", r"серв\w* (лег|легл|упал|упали|работа|не работа|включ|отбил|наеб|отрыг|лежат|запуст|будут|воркат|открыл|стабил)|серв\w* опять|что с серв|оптимизир|server\w* (work|down|up)|fresh server|ддос|ddos|дудос|додос|ддудос|атак|тех\W{0,2}работ|техработ|рестарт|restart|maintenance|\b200\b|компенс|манибек|возмест|возмещ|верн(ут|ите)|у всех (упал|лег|так)|у (вас|всех) работ|работает серв|rabotaet|снова серв|сервер\w* лежат|серваки? лежат|серв\w* там|что опять|(лути|лути-бей|лутибей|лок\w*|территори\w*).{0,20}(зайти|пуска|впуска)|(зайти|впуска|пуска).{0,20}(лути|лок|территори)|ожидани\w* информ|исправить ожидан|запустят|тех\W{0,2}обслуж|че с игрой|что с игрой|работа?е?т уже|трабл|софт|дюп|надюп|^ ?упал|открылл?и\?|сколько .{0,15}(проблем|длит)|warp|варп|1\.1\.1\.1|vpn|впн|онлайн"),
    ("Читеры / баны / модерация / поддержка", r"читер|\bчит|cheat|hack|хакер|бан\b|банят|забан|разбан|модер|админ|жалоб|\bжб\b|репорт|report|спам|реклам|порно|скам|обман|поддержк|support|куда .{0,20}писать|кому .{0,20}писать|\bkit\b|промо"),
    ("Поиск тиммейтов / набор в клан", r"кто (тим|со мной|играть|поиграть|пойдет|пойдёт|хочет|в пати|в клан|желающ|из)|ктов|кто пати|пати кто|пати хочет|в пати\?|ищу|ищем|возьмите|возьмет кто|в клан (кто|новичк)|к кому .{0,10}в клан|набор в|набираю|lf[gm]\b|looking for|с кем .{0,10}поиграть|поиграть можно|есть кто|го (в пати|играть)|в тиму|в тму|хочет тим|anyone from|новички с сервер|пишите в личку|в личку|в лс|channel|канал|чат"),
    ("Вопросы к разработчикам / планы", r"планиру|сделайте|добавьте|добавят|когда (добав|выйдет|выйдут|будет обнов|обнов|релиз|введут|сделают|починят|исправят|откроют|новый серв)|график открыт|будет ли|разраб|developer|dev\b|патч|patch|claude"),
    ("Дискорд, а не игра", r"раз в 2 часа|медленный режим|slowmode|роль в дискорд|дискорд"),
]
# Исключения: это вопросы по игре, даже если похожи на технические
KEEP = r"почин\w* (оруж|брон|ган|шмот|вещ|экип)|(оруж|брон|ган|шмот|вещ|экип)\w* .{0,15}почин|чинит|(смен|помен|один|русск|друг|кент|клан).{0,25}серв|серв.{0,25}(смен|помен|друг|кент)|на каком .{0,10}серв|какой .{0,5}серв"
MAT = r"бля|хуй|хуе|хуя|хуё|пизд|еба|ебу|заеб|наеб|сука|нахуй|нахер|охуе|ахуе|дурак|дебил|даун|пиздабол"
QWORD = r"\?|как |где |что |почему|сколько|когда|зачем|можно ли|кто знает"

def parse(path):
    text = Path(path).read_text(encoding="utf-8")
    for m in re.finditer(r"^- \((\d+)×\) (.*?)  \n  _(.*?)_(?:  \n  Скрипт ответил: (.*?) → (.*))?$", text, re.M):
        n, q, meta, topics, links = m.groups()
        q = re.sub(r"\s*\(изменено\).*$", "", q).strip()
        dates = meta.split(" · ")[-1]
        yield dict(q=q, n=int(n), dates=dates, topics=topics or "", links=(links or "").replace(" , ", "\n"))

def norm(s): return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", s.lower().replace("ё", "е"))).strip()

def reason(q):
    t = " " + q.lower().replace("ё", "е") + " "
    if len(q) > 350: return "Длинная простыня / копипаста"
    if re.search(KEEP, t) and not re.search(MAT, t): return None
    for name, rx in DROP:
        if re.search(rx, t): return name
    if re.search(MAT, t) and (not re.search(QWORD, t) or len(q) < 60): return "Эмоции / мат без вопроса"
    if len(norm(q)) < 6: return "Слишком коротко"
    return None

def main():
    items = {}
    for f in sorted(glob.glob(str(ROOT / "rr-voprosy-*.md"))):
        for it in parse(f):
            k = norm(it["q"])
            if not k: continue
            old = items.get(k)
            if not old or it["n"] > old["n"]: items[k] = it   # файлы пересекаются: берём наибольший счётчик
    keep, drop = [], []
    for it in items.values():
        r = reason(it["q"])
        (drop if r else keep).append((it, r))
    keep.sort(key=lambda x: -x[0]["n"]); drop.sort(key=lambda x: (x[1], -x[0]["n"]))

    wb = Workbook()
    head = Font(bold=True, color="121210"); fill = PatternFill("solid", fgColor="C6F432")
    wrap = Alignment(wrap_text=True, vertical="top")
    ws = wb.active; ws.title = "Вопросы"
    cols = [("№", 6), ("Вопрос игрока", 70), ("Сколько раз", 9), ("Даты", 14), ("Тема (по мнению скрипта)", 24), ("Ссылки скрипта", 40), ("Оценка", 18), ("Комментарий", 40)]
    ws.append([c for c, _ in cols])
    for i, (it, _) in enumerate(keep, 1):
        ws.append([i, it["q"], it["n"], it["dates"], it["topics"], it["links"], "", ""])
    for i, (_, w) in enumerate(cols, 1):
        ws.column_dimensions[ws.cell(1, i).column_letter].width = w
        ws.cell(1, i).font = head; ws.cell(1, i).fill = fill
    for row in ws.iter_rows(min_row=2):
        for c in row: c.alignment = wrap
    dv = DataValidation(type="list", formula1='"Интересный,Не по теме,Уже есть на сайте"', allow_blank=True)
    ws.add_data_validation(dv); dv.add(f"G2:G{len(keep)+1}")
    ws.freeze_panes = "C2"; ws.auto_filter.ref = ws.dimensions

    wd = wb.create_sheet("Удалено")
    wd.append(["Вопрос игрока", "Сколько раз", "Причина удаления"])
    for it, r in drop: wd.append([it["q"], it["n"], r])
    for col, w in zip("ABC", (80, 9, 38)): wd.column_dimensions[col].width = w
    for c in wd[1]: c.font = head; c.fill = fill
    for row in wd.iter_rows(min_row=2):
        for c in row: c.alignment = wrap
    wd.freeze_panes = "A2"; wd.auto_filter.ref = wd.dimensions

    st = wb.create_sheet("Итого")
    st.append(["Всего уникальных вопросов", len(items)]); st.append(["Осталось для проверки", len(keep)]); st.append(["Удалено", len(drop)]); st.append([])
    st.append(["Причина удаления", "Сколько"])
    from collections import Counter
    for r, c in Counter(r for _, r in drop).most_common(): st.append([r, c])
    st.column_dimensions["A"].width = 45
    out = ROOT / "voprosy.xlsx"; wb.save(out)
    print(f"{out}: всего {len(items)}, осталось {len(keep)}, удалено {len(drop)}")
    for r, c in Counter(r for _, r in drop).most_common(): print(f"  {c:5}  {r}")

if __name__ == "__main__":
    main()
