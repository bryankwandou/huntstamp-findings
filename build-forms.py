# -*- coding: utf-8 -*-
"""Turn the two Typeform answer files into one page with per-field copy buttons.

Generated rather than hand-written so the published text is byte-identical to the
reviewed markdown; there is no transcription step to get wrong.

Fields are emitted in the order the real Typeform asks them:

  1. What are you submitting?                    choice
  2. Briefly describe the problem in one sentence text
  3. What device and browser were you using?     shared, in the page header
  4. When did it happen?                         shared, in the page header
  5. How often does this happen?                 choice
  6. Screenshot upload                           cannot be text; listed separately
  7. How do you think this could be improved?    text
  8. Anything else you would like to add?        text
  9. + 10. the two consent questions             shared, in the page header
"""
import io, re, html

FILES = ["TYPEFORM-ANSWERS.md", "NEW-TYPEFORM-ANSWERS.md"]

# The five per-submission fields, in Typeform order. Matching on a prefix keeps
# this robust to the exact wording used in the markdown headings.
ORDER = [
    "What are you submitting",
    "Briefly describe the problem",
    "How often does this happen",
    "How do you think this could be improved",
    "Anything else you would like to add",
]


def field_rank(label):
    for i, prefix in enumerate(ORDER):
        if label.startswith(prefix):
            return i
    return len(ORDER)


def parse(path):
    src = io.open(path, encoding="utf-8").read()
    blocks = re.split(r"^# (\d+) · (F-\d+)\s*$", src, flags=re.M)
    out = []
    for i in range(1, len(blocks), 3):
        num, fid, body = blocks[i], blocks[i + 1], blocks[i + 2]
        body = body.split("\n---\n")[0]
        item = {"num": num, "fid": fid, "fields": [], "notes": []}

        # Choice answers: **Question** → **Answer**, all on one line.
        for q, a in re.findall(r"\*\*([^*\n]+?)\*\*\s*→\s*\*\*([^*\n]+?)\*\*", body):
            item["fields"].append(
                {"label": q.strip().rstrip("?") + "?", "value": a.strip(), "kind": "choice"}
            )

        # Text answers: a bold label alone on its line, then a fenced block.
        # The label must not span lines, or it swallows the choice questions above it.
        for label, code in re.findall(
            r"^\*\*([^*\n]+?)\*\*\s*\n```\n(.*?)\n```", body, re.S | re.M
        ):
            item["fields"].append(
                {"label": label.strip(), "value": code, "kind": "text"}
            )

        for note in re.findall(r"^> (.+)$", body, flags=re.M):
            item["notes"].append(note.strip())

        item["fields"].sort(key=lambda f: field_rank(f["label"]))
        out.append(item)
    return out


items = []
for f in FILES:
    items += parse(f)


def esc(s):
    return html.escape(s, quote=True)


rows = []
problems = []
for it in items:
    labels = [f["label"] for f in it["fields"]]
    if len(it["fields"]) != 5:
        problems.append(f'{it["num"]} {it["fid"]}: {len(it["fields"])} fields -> {labels}')
    for lb in labels:
        if field_rank(lb) == len(ORDER):
            problems.append(f'{it["num"]} {it["fid"]}: unrecognised label {lb!r}')

    one = next((f["value"] for f in it["fields"] if f["label"].startswith("Briefly")), "")
    fields_html = []
    for f in it["fields"]:
        v = esc(f["value"])
        if f["kind"] == "choice":
            fields_html.append(
                f'<div class="fld choice"><div class="q">{esc(f["label"])}</div>'
                f'<div class="a"><span class="pick">{v}</span></div></div>'
            )
        else:
            fields_html.append(
                f'<div class="fld"><div class="q">{esc(f["label"])}'
                f'<button class="copy" type="button">Copy</button></div>'
                f'<pre class="a">{v}</pre></div>'
            )
    notes = "".join(f'<p class="note">{esc(n)}</p>' for n in it["notes"])
    rows.append(
        f'<section class="sub" id="s{it["num"]}">'
        f'<div class="hd"><span class="n">{it["num"]}</span>'
        f'<span class="fid">{it["fid"]}</span>'
        f'<span class="sum">{esc(one)}</span></div>'
        f'{notes}{"".join(fields_html)}</section>'
    )

index = "".join(f'<a href="#s{it["num"]}"><b>{it["num"]}</b> {it["fid"]}</a>' for it in items)

io.open("forms-body.html", "w", encoding="utf-8").write(
    '<div class="idx">' + index + "</div>\n" + "\n".join(rows)
)

print("parsed", len(items), "submissions")
if problems:
    print("\nPROBLEMS:")
    for p in problems:
        print("  " + p)
    raise SystemExit(1)
print("every submission has all five fields, in Typeform order")
