# -*- coding: utf-8 -*-
"""Turn the two Typeform answer files into one page with per-field copy buttons.

Generated rather than hand-written so the published text is byte-identical to the
reviewed markdown; there is no transcription step to get wrong.
"""
import io, re, json, html

FILES = ["TYPEFORM-ANSWERS.md", "NEW-TYPEFORM-ANSWERS.md"]

def parse(path):
    src = io.open(path, encoding="utf-8").read()
    blocks = re.split(r"^# (\d+) · (F-\d+)\s*$", src, flags=re.M)
    out = []
    for i in range(1, len(blocks), 3):
        num, fid, body = blocks[i], blocks[i + 1], blocks[i + 2]
        body = body.split("\n---\n")[0]
        item = {"num": num, "fid": fid, "fields": [], "notes": []}

        for q, a in re.findall(r"\*\*(.+?)\*\* → \*\*(.+?)\*\*", body):
            item["fields"].append({"label": q.strip(), "value": a.strip(), "kind": "choice"})

        for label, code in re.findall(r"\*\*(.+?)\*\*\n```\n(.*?)\n```", body, re.S):
            item["fields"].append({"label": label.strip(), "value": code, "kind": "text"})

        for note in re.findall(r"^> (.+)$", body, flags=re.M):
            item["notes"].append(note.strip())
        out.append(item)
    return out

items = []
for f in FILES:
    items += parse(f)

def esc(s):
    return html.escape(s, quote=True)

rows = []
for it in items:
    one = next((f["value"] for f in it["fields"] if "one sentence" in f["label"]), "")
    fields_html = []
    for f in it["fields"]:
        v = esc(f["value"])
        if f["kind"] == "choice":
            fields_html.append(
                f'<div class="fld choice"><div class="q">{esc(f["label"])}</div>'
                f'<div class="a"><span class="pick">{v}</span></div></div>')
        else:
            fields_html.append(
                f'<div class="fld"><div class="q">{esc(f["label"])}'
                f'<button class="copy" type="button">Copy</button></div>'
                f'<pre class="a">{v}</pre></div>')
    notes = "".join(f'<p class="note">{esc(n)}</p>' for n in it["notes"])
    rows.append(
        f'<section class="sub" id="s{it["num"]}">'
        f'<div class="hd"><span class="n">{it["num"]}</span>'
        f'<span class="fid">{it["fid"]}</span>'
        f'<span class="sum">{esc(one)}</span></div>'
        f'{notes}{"".join(fields_html)}</section>')

index = "".join(
    f'<a href="#s{it["num"]}"><b>{it["num"]}</b> {it["fid"]}</a>' for it in items)

io.open("forms-body.html", "w", encoding="utf-8").write(
    '<div class="idx">' + index + "</div>\n" + "\n".join(rows))
print("parsed", len(items), "submissions")
for it in items:
    print(" ", it["num"], it["fid"], len(it["fields"]), "fields",
          "" if len(it["fields"]) >= 4 else "  <-- CHECK")
