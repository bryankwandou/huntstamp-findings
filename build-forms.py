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
import io, re, json, html

FILES = ["TYPEFORM-ANSWERS.md", "NEW-TYPEFORM-ANSWERS.md", "NEW-TYPEFORM-ANSWERS-2.md", "NEW-TYPEFORM-ANSWERS-3.md", "NEW-TYPEFORM-ANSWERS-4.md", "NEW-TYPEFORM-ANSWERS-5.md"]

# Which image backs which finding. Kept in its own file so the mapping can be
# reviewed on its own, and so a finding without evidence says so rather than
# borrowing a screenshot from a neighbour.
EVIDENCE = json.load(io.open("evidence-map.json", encoding="utf-8"))

# The five per-submission fields, in Typeform order. Matching on a prefix keeps
# this robust to the exact wording used in the markdown headings.
ORDER = [
    "What are you submitting",
    "Briefly describe the problem",
    "How often does this happen",
    "How do you think this could be improved",
    "Anything else you would like to add",
]

# Every submission block carries all ten Typeform fields in full, including the
# four that are identical across a batch. They are repeated rather than shared,
# because each block has to stand alone as one complete form: a reviewer reading
# submission 27 should not have to scroll to a header to learn which browser it
# was taken in.
BATCH = [
    (1, 17, "Desktop PC / Windows 11 build 26200 / Chromium 148.0.7778.280 / no wallet connected (logged-out guest session)",
            "September 3, 2026, 04:00-09:48, UTC"),
    (18, 24, "Desktop PC / Windows 11 build 26200 / headless Chromium via Playwright / no wallet connected (logged-out guest session)",
             "September 4, 2026, 03:40-04:00, UTC"),
    (25, 31, "Desktop PC / Windows 11 build 26200 / headless Chromium via Playwright and curl / no wallet connected (logged-out guest session)",
             "September 4, 2026, 08:20-09:00, UTC"),
    (32, 41, "Desktop PC / Windows 11 build 26200 / Node.js https client against the public events API / no wallet connected (logged-out guest session)",
             "September 5, 2026, 01:00-02:30, UTC"),
    (42, 42, "Desktop PC / Windows 11 build 26200 / Node.js https client against the public events API / no wallet connected (logged-out guest session)",
             "September 5, 2026, 02:00-02:45, UTC"),
    (43, 99, "Desktop PC / Windows 11 build 26200 / Node.js https client against the public events API / no wallet connected (logged-out guest session)",
             "September 5, 2026, 03:00-03:30, UTC"),
]

CONSENT_1 = ("I have not included passwords, private keys, or seed phrases. "
             "I will not repeatedly exploit or publicly share an unresolved issue. "
             "Manic may reproduce the issue internally and contact me for more information.")
CONSENT_2 = "i create with ai, no manual testing."

# Two findings have no artefact. Neither gets an invented image: one is not
# being submitted at all, and the other is carried where no upload is asked for.
NO_CAPTURE = {
    "F-10": (
        "Nothing to upload, because this submission is not being sent. It is kept on the page "
        "so the withdrawal is on the record rather than quietly deleted."
    ),
    "F-17": (
        "No artefact exists for this one, and I will not manufacture one. The clipboard write "
        "fired once, the triggering element was never identified, and it did not happen again — "
        "so there is no captured text to render and no screen state to photograph. A picture of "
        "my own write-up would be evidence of the claim, not of the defect."
        "<br><br><b>File it in the sponsor form instead.</b> The “Anything Else?” field takes free "
        "text and asks for no upload, so the observation reaches Manic without either fabricating "
        "an image or leaving a required field empty. It is already written into "
        "<a href=\"/sponsor-form.txt\">sponsor-form.txt</a> under the heading for unreproduced "
        "observations."
    ),
    "default": (
        "No capture exists for this one. Reproduce the steps above and capture your own, or file "
        "it without an upload and say why."
    ),
}


def batch_for(num):
    n = int(num)
    for lo, hi, device, when in BATCH:
        if lo <= n <= hi:
            return device, when
    raise SystemExit("no batch covers submission " + num)


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
    device, when = batch_for(it["num"])
    fields_html.insert(2,
        f'<div class="fld"><div class="q">What device and browser were you using?'
        f'<button class="copy" type="button">Copy</button></div>'
        f'<pre class="a">{esc(device)}</pre></div>'
        f'<div class="fld"><div class="q">When did it happen?'
        f'<button class="copy" type="button">Copy</button></div>'
        f'<pre class="a">{esc(when)}</pre></div>')

    consents = (
        f'<div class="fld choice"><div class="q">{esc(CONSENT_1)}</div>'
        f'<div class="a"><span class="pick">A. I accept</span></div></div>'
        f'<div class="fld choice"><div class="q">{esc(CONSENT_2)}</div>'
        f'<div class="a"><span class="pick">A. I accept</span></div></div>')

    shots = EVIDENCE.get(it["fid"], [])
    if shots:
        figs = "".join(
            f'<figure class="shot">'
            f'<a href="evidence/{s_["file"]}" download><img src="evidence/{s_["file"]}" '
            f'alt="{esc(s_["caption"])}" loading="lazy"></a>'
            f'<figcaption>{esc(s_["caption"])}'
            f'<a class="dl" href="evidence/{s_["file"]}" download>Download {s_["file"]}</a>'
            f'</figcaption></figure>'
            for s_ in shots)
        upload = (f'<div class="fld upload"><div class="q">Please upload a screenshot or '
                  f'screen recording<span class="req">required</span></div>{figs}</div>')
    else:
        # The upload field is required, so a finding with no artefact needs a
        # route that is neither a fabricated image nor an abandoned submission.
        why = NO_CAPTURE.get(it["fid"], NO_CAPTURE["default"])
        upload = ('<div class="fld upload none"><div class="q">Please upload a screenshot or '
                  'screen recording<span class="req">required</span></div>'
                  f'<p class="nofile">{why}</p></div>')

    notes = "".join(f'<p class="note">{esc(n)}</p>' for n in it["notes"])

    # Drop the upload block where the real form asks for it: after the frequency
    # question, before the improvement question.
    joined = "".join(fields_html)
    marker = '<div class="fld choice"><div class="q">How often does this happen?</div>'
    idx = joined.find(marker)
    if idx >= 0:
        end = joined.index("</div></div>", idx) + len("</div></div>")
        joined = joined[:end] + upload + joined[end:]
    else:
        joined += upload
    joined += consents

    rows.append(
        f'<section class="sub" id="s{it["num"]}">'
        f'<div class="hd"><span class="n">{it["num"]}</span>'
        f'<span class="fid">{it["fid"]}</span>'
        f'<span class="sum">{esc(one)}</span>'
        f'<button class="copyall" type="button">Copy whole submission</button></div>'
        f'{notes}{joined}</section>'
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
