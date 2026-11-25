# William Byrd Baseball · Lifts

A simple session board for the weight room. Pick a phase and a day, or the warm-up. Each exercise is a card: demo, sets × reps, load when it is a short line, and the cues. Tap a card to open it large and step to the next one.

The rest timer sits on the session. Its buttons are that day’s rest times.

Program: Pierre's Elite Performance (PEP). Curated for William Byrd Baseball.

No build step. From this folder, `python3 -m http.server`. The pages are `noindex`. There is no analytics.

Weeks are collapsed. A day is one template. When the percent changes across the weeks of that phase, the card shows one line such as `78.5 / 80 / 82.5%`.

`data/program.json` is the whole program the site reads:

```text
{
  title, credit,
  warmup: { blocks: [ { title, note, exercises: [ Card ] } ] },
  phases: [ { id, title, subtitle, days: [ { id, title, blurb, rests: [seconds], blocks } ] } ]
}
Card: { name, rx?, load?, cues?: [string], demos?: [ { src, poster } ] }
```

Demo files live in `media/demos/`.
