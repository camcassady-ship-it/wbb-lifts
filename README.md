# William Byrd Baseball · Lifts

Static reference for the Pierre's Elite Performance (PEP) Sports Performance Training Program, curated for William Byrd Baseball. A coach can run a session from a phone, iPad, or TV. A player can follow the same day. Nothing is logged to an account.

Program: Pierre's Elite Performance (PEP) Sports Performance Training Program. Curated for William Byrd Baseball.

This version includes the PEP Warm-Up (full and condensed text) and Phases 1–3:

- Phase 1 Eccentrics, weeks 1–3, plus week 4 deload
- Phase 2 Isometrics, weeks 5–7, plus week 8 deload
- Phase 3 Concentric, weeks 9–11

Pitcher Lift, 30 Day Speed, older RCB/Roanoke plans, and nutrition are not included. Prescriptions are copied from the program PDFs. Where a PDF is missing a number or two pages disagree, the page shows a source note instead of a guess.

## Open it

No build step. From this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/`. GitHub Pages is not turned on in this repo.

The site is unlisted: every page has `noindex, nofollow`, and `robots.txt` disallows all crawlers. There is no analytics.

## Links

Hash routes, and the same places as a query string:

- `#/phase/1/week/2/day/day-1` player checklist
- `#/phase/1/week/2/day/day-1/coach` coach mode
- `#/phase/1/week/2/day/day-1/stations` block grid
- `#/warmup` and `#/warmup/condensed`
- `#/exercises` and `#/exercise/back-squat-or-front-squat`
- `?phase=1&week=2&day=1&view=coach` (rewritten to the hash above)

Day ids are `day-1`, `day-2`, `day-3`, `day-4`, `schedule-day-3` (the schedule-page rest day in Phases 2 and 3), `off`, and `weekend`. A numeric `day=1` is accepted in the query string.

Coach mode walks the day in order: warm-up, pre-core, the A-block complex, then accessory blocks. Rest buttons use the times printed in the PDF (for example 20s and 30s between complex exercises, 4 and 5 minutes between complex sets, 1.5 minutes on accessory blocks). Arrow keys and swipe move between steps. Elite / Novice switches the max label between 1RM and 3RM. A max typed into the calculator is stored in `localStorage` on that device only.

## `data/program.json`

`schemaVersion` is `1`. The site reads this file at runtime. Add a future phase by appending to `phases`. Do not invent sets, reps, percentages, or cues.

```text
{
  schemaVersion, title, credit, percentageRule, percentageRulePhase3, scopeNote,
  warmup: {
    id, title, setup, sources,
    phases: [{ id, name, instructions, exercises: [{ name }], sourceNotes }]
  },
  phases: [{
    id, number, title, subtitle, source, image, calendarNote, intro, sourceNotes,
    weeks: [{ number, label, kind: "training"|"deload", daySet }],
    daySets: {
      "<daySet name>": [ Day, ... ]
    }
  }]
}
```

A training `Day`:

```text
{
  id, kind: "training", title, role, schedule: [string], guidelines: [string],
  a1ByWeek: { "<week number>": { text, percent, effort? } },
  sections: [ Section ], closer, sourceNotes, image?
}
```

A rest `Day` is `{ id, kind: "rest", title, role, quotes, sourceNotes }` with no sections.

A `Section`:

```text
{
  id, title, kind: "list"|"complex"|"accessory"|"holds",
  note, image, exercises: [ Exercise ],
  rest: {
    between: "A1-A2"|"A1-A4",
    betweenExercises: { label, presets: [seconds], quote },
    betweenSets: { label, presets, quote },
    during, alsoQuoted
  }
}
```

An `Exercise`:

```text
{
  order, name, variations?, sets, reps, repsByWeek?,
  loadText, tempo, rom, cues: [string], benefits: [string],
  column, maxKey,
  percents: [{ week, percent, label }],
  percentGroups: [{ source, items: [{ week, percent, label }] }],
  percentRange: { low, high, label },
  percentOfA1: { low, high, label },
  effortByWeek, cluster: { rest, presets, quote },
  duringRest, hold, restHint: { label, presets },
  sourceNotes
}
```

`percents` are percentages of the entered 1RM or 3RM. `percentOfA1` is the PDF line “30–40% of A1” (or 20–30%), applied to that day’s A1 load, not a new percent of max. `percentGroups` is used when two PDF pages print different percentages for the same lift; both groups stay visible. `effortByWeek` is left as words such as `7.5/10 Effort`.

`scripts/build_program_json.py` and `scripts/program_days.py` regenerate `data/program.json` from the transcribed PDF text. The site itself does not run them.
