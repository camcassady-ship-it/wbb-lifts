#!/usr/bin/env python3
"""Attach mapped demo videos and transcribed slide text onto data/program.json.

Reads image_text.json and manifest.json from the extracted media folder
(default /tmp/lifts-media). Copies only mapped mp4/jpg pairs into media/demos/.
Clips marked [unclear] with no programPath are not copied.
"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEDIA = Path("/tmp/lifts-media")
OUT_DIR = ROOT / "media" / "demos"

TRAP_NOTE = (
    "Folder filename maps by hash to the Phase 2 Day 4 A-block GIF. "
    "program.json names that A1 “Back Squat OR Front Squat”. "
    "The folder name may be an alternate exercise shown in the demo; do not overwrite the program name."
)
LUNGE_NOTE = (
    "Lunge Circuit slide text: Forward Lunge 20 yards. Backward Lunge 20 yd. "
    "Focus on the lead quad. Drive engagement in the lead quad. "
    "Lateral Lunge 20 yd down and back. Focus on and engage the adductors (groin). "
    "Hamstring Lunge Walks 2 x 20 yds. Lead with the heel, keep your body low and pull your body forward with your lead leg hamstring. "
    "REPEAT 3X. Also on that deck: Reverse Lunge/ Split Squat (60-70%- explode out of the bottom spot) 4x5. "
    "Alt Split Stance Jump 4x6. Those lines do not use the same names or sets as this PDF page, so they are not merged into the prescription."
)


def load(path):
    return json.loads(Path(path).read_text())


def find_exercise(program, path):
    # phase-2/training/day-1/a-block/A4
    phase_id, day_set, day_id, section_id, order = path.split("/")
    for phase in program["phases"]:
        if phase["id"] != phase_id:
            continue
        for day in phase["daySets"].get(day_set, []):
            if day["id"] != day_id:
                continue
            for section in day.get("sections") or []:
                if section["id"] != section_id:
                    continue
                for ex in section["exercises"]:
                    if ex.get("order") == order:
                        return ex
    raise SystemExit("programPath did not resolve: " + path)


def add_note(obj, text):
    if not text:
        return
    notes = obj.setdefault("sourceNotes", [])
    if text not in notes:
        notes.append(text)


def add_demo(ex, demo):
    demos = ex.setdefault("demos", [])
    if any(d["id"] == demo["id"] for d in demos):
        return False
    demos.append(demo)
    return True


def assign_ids(program):
    for phase in program["phases"]:
        for set_name, days in phase["daySets"].items():
            for day in days:
                for section in day.get("sections") or []:
                    for ex in section.get("exercises") or []:
                        order = ex.get("order") or "x"
                        ex["id"] = f"{phase['id']}-{set_name}-{day['id']}-{section['id']}-{order}"
    for phase in program["warmup"]["phases"]:
        for i, ex in enumerate(phase["exercises"], 1):
            ex["id"] = f"warmup-{phase['id']}-{i}"


def apply_slide_text(program, text):
    agility = {ex["name"]: ex for ex in program["warmup"]["phases"][0]["exercises"]}
    if len(agility) != 14:
        raise SystemExit("expected 14 agility drills, found %s" % len(agility))
    for item in text["warmup_agility"]:
        ex = agility.get(item["name"])
        if not ex:
            raise SystemExit("agility name missing from program: " + item["name"])
        ex["howToTitle"] = item.get("how_to_title")
        ex["howTo"] = item.get("how_to") or []
        benefits = list(item.get("benefits_muscular") or [])
        if item.get("benefits_sports"):
            benefits.append(item["benefits_sports"])
        if benefits:
            ex["benefits"] = benefits
        if item.get("how_to_title_note"):
            add_note(ex, item["how_to_title_note"])
    program["warmup"]["phases"][0]["sourceNotes"] = [
        "All 14 agility drill names and how-tos are transcribed from the PEP Warm Up instruction-card images (slides 3–16). The condensed deck uses the same cards."
    ]

    mobility = program["warmup"]["phases"][1]["exercises"]
    dynamic = program["warmup"]["phases"][2]["exercises"]
    for slide in text["warmup_mobility"]:
        for item in slide["items"]:
            path = item.get("programPath") or ""
            if not path.startswith("warmup.mobility["):
                continue
            idx = int(path[path.index("[") + 1:path.index("]")])
            ex = mobility[idx]
            # Cameron: use Inch Worm everywhere; do not keep the Inch Warm conflict note.
            bullets = list(item.get("bullets") or [])
            if item.get("bullets_cobra") or item.get("bullets_dog"):
                bullets += ["Cobra: " + b for b in item.get("bullets_cobra") or []]
                bullets += ["Downward Dog: " + b for b in item.get("bullets_dog") or []]
            if bullets:
                ex["benefits"] = bullets
            note = item.get("nameNote") or ""
            if note and "Inch Warm" not in note and "Inch Worm" not in note:
                add_note(ex, note)
            spelling = item.get("spellingNote")
            if spelling:
                add_note(ex, spelling)
    for slide in text["warmup_dynamic"]:
        for item in slide["items"]:
            path = item.get("programPath") or ""
            if not path.startswith("warmup.dynamic["):
                continue
            idx = int(path[path.index("[") + 1:path.index("]")])
            ex = dynamic[idx]
            if item.get("bullets"):
                ex["benefits"] = list(item["bullets"])
            if item.get("nameNote"):
                add_note(ex, item["nameNote"])
            if item.get("spellingNote"):
                add_note(ex, item["spellingNote"])

    # Phase 2 deload day 3: quote the slide circuit beside the PDF names.
    for phase in program["phases"]:
        if phase["id"] != "phase-2":
            continue
        for day in phase["daySets"].get("deload", []):
            if day["id"] == "day-3":
                add_note(day, LUNGE_NOTE)


def demo_record(item, placement, force_note=None):
    label = item.get("folderFilename") or None
    notes = []
    if force_note:
        notes.append(force_note)
    rec = {
        "id": item["id"],
        "src": f"media/demos/{item['id']}.mp4",
        "poster": f"media/demos/{item['id']}.jpg",
    }
    if label:
        rec["label"] = label
    if notes:
        rec["sourceNotes"] = notes
    return rec


def apply_videos(program, manifest):
    used = {}
    attached = 0
    skipped_unclear = 0
    skipped_unmapped = 0
    agility = {ex["name"]: ex for ex in program["warmup"]["phases"][0]["exercises"]}
    seen_skip = set()

    for item in manifest["items"]:
        placements = item["placements"]
        mapped = []
        for p in placements:
            path = p.get("programPath")
            unclear = p.get("exerciseNameUnclear") or p.get("exerciseName") == "[unclear]"
            if path:
                mapped.append(p)
            elif not unclear and p.get("exerciseName") in agility:
                mapped.append(p)
        if not mapped:
            # no program path and not a named agility drill
            if item["id"] not in seen_skip:
                any_clear = any(
                    p.get("exerciseName") and not p.get("exerciseNameUnclear") and p.get("exerciseName") != "[unclear]"
                    for p in placements
                )
                if any_clear:
                    skipped_unmapped += 1
                else:
                    skipped_unclear += 1
                seen_skip.add(item["id"])
            continue
        used[item["id"]] = item
        paths_done = set()
        for p in mapped:
            path = p.get("programPath")
            paths = path if isinstance(path, list) else ([path] if path else [])
            # Front Lunge to OH Press.gif is the hash reused on the chest-press slide.
            # Manifest paths are already the overhead-press row only. Do not also attach it to B1.
            note = None
            label_name = (item.get("folderFilename") or "") 
            if label_name == "Trap Bar Dead Lift.gif":
                note = TRAP_NOTE
            if paths:
                for one in paths:
                    if one in paths_done:
                        continue
                    paths_done.add(one)
                    if one.startswith("warmup."):
                        ex = agility[p["exerciseName"]] if p.get("exerciseName") in agility else None
                        if one == "warmup.agility[0]":
                            ex = program["warmup"]["phases"][0]["exercises"][0]
                    else:
                        ex = find_exercise(program, one)
                    if ex and add_demo(ex, demo_record(item, p, note)):
                        attached += 1
            elif p.get("exerciseName") in agility:
                ex = agility[p["exerciseName"]]
                if add_demo(ex, demo_record(item, p, note)):
                    attached += 1
    return used, attached, skipped_unclear, skipped_unmapped


def main():
    program = load(ROOT / "data" / "program.json")
    text = load(MEDIA / "image_text.json")
    manifest = load(MEDIA / "manifest.json")
    apply_slide_text(program, text)
    assign_ids(program)
    used, attached_links, skipped_unclear, skipped_unmapped = apply_videos(program, manifest)

    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)
    missing = []
    for item_id, item in used.items():
        for ext in (".mp4", ".jpg"):
            src = MEDIA / f"{item_id}{ext}"
            if not src.exists():
                missing.append(str(src))
            else:
                shutil.copy2(src, OUT_DIR / f"{item_id}{ext}")
    if missing:
        raise SystemExit("missing media files: " + ", ".join(missing))

    # Confirm Inch Warm is not stored.
    blob = json.dumps(program)
    if "Inch Warm" in blob:
        raise SystemExit("Inch Warm still present")

    exercises_with = 0
    for phase in program["phases"]:
        for days in phase["daySets"].values():
            for day in days:
                for section in day.get("sections") or []:
                    for ex in section.get("exercises") or []:
                        if ex.get("demos"):
                            exercises_with += 1
    for phase in program["warmup"]["phases"]:
        for ex in phase["exercises"]:
            if ex.get("demos"):
                exercises_with += 1

    out = ROOT / "data" / "program.json"
    out.write_text(json.dumps(program, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({
        "videosCopied": len(used),
        "demoAttachments": attached_links,
        "exercisesWithDemos": exercises_with,
        "skippedUnclear": skipped_unclear,
        "skippedUnmappedNamed": skipped_unmapped,
        "manifestItems": len(manifest["items"]),
    }, indent=2))


if __name__ == "__main__":
    main()
