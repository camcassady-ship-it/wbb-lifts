#!/usr/bin/env python3
"""Assemble data/program.json from the PEP PDF text. No invented prescriptions."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def E(order, name, sets, reps, cues, benefits=None, **k):
    d = {
        "order": order,
        "name": name,
        "sets": sets,
        "reps": reps,
        "cues": list(cues),
        "benefits": list(benefits or []),
    }
    for key, val in k.items():
        if val is not None:
            d[key] = val
    return d


def P(week, percent, label):
    return {"week": week, "percent": percent, "label": label}


def sec(sid, title, kind, exercises, **k):
    d = {"id": sid, "title": title, "kind": kind, "exercises": exercises}
    d.update({key: val for key, val in k.items() if val is not None})
    return d


def day(did, title, role, schedule, guidelines, sections, **k):
    d = {
        "id": did,
        "kind": "training",
        "title": title,
        "role": role,
        "schedule": schedule,
        "guidelines": guidelines,
        "sections": sections,
        "sourceNotes": k.get("sourceNotes") or [],
        "a1ByWeek": k.get("a1ByWeek") or {},
        "closer": k.get("closer"),
        "image": k.get("image"),
    }
    return d


def rest_day(did, title, quotes, source_notes=None):
    return {
        "id": did,
        "kind": "rest",
        "title": title,
        "role": "REST",
        "quotes": quotes,
        "sourceNotes": source_notes or [],
        "sections": [],
    }


P1_GUIDE_SUB = [
    "Never perform slow eccentric loads with loads greater then 85% of your 1RM or 3 RM",
    "Always use a spotter and safety bars when preforming slow eccentrics",
    "Always finish a slow eccentric focused lift with an explosive concentric movement",
    "Move the bar with aggression, intent, and total body tension",
    "Complete in block order (super sets, tri-sets, complexes) with 15-30 seconds rest between exercises",
    "Follow the exact (sets & reps) with 1.5- 2 mins rest between sets! Complete all sets in that block before the next",
]
P1_SCHED = [
    "Workout Length: 1.5 Hours",
    "Warm-Up: 15-20 Minutes",
    "Pre-Core Activation Development: 10 Minutes",
    "Full Body Training: 1 Hour",
]
P1_PRE_BENEFIT = (
    "Activating your core prior to training stimulates those deep intrinsic muscles that engage and stabilize. "
    "This increases your ability to control the loads/weights during exercise! This will greatly increase your speed "
    "and explosive power output, reducing your chances of injury!"
)
ACC_REST = {
    "betweenExercises": {"label": "15-30 seconds", "presets": [15, 30], "quote": "15-30 seconds rest between exercises"},
    "betweenSets": {"label": "1.5 minutes", "presets": [90], "quote": "Take 1.5 minutes rest between sets to fully recover!"},
    "alsoQuoted": "Schedule page also says 1.5- 2 mins rest between sets.",
}
A_REST_ALL = {
    "between": "A1-A4",
    "betweenExercises": {"label": "20-30 seconds", "presets": [20, 30], "quote": "Take 20-30 seconds rest between each exercise (A1 through A4)"},
    "betweenSets": {"label": "4-5 minutes", "presets": [240, 300], "quote": "4-5 minutes rest between each set."},
}
A_REST_A1A2 = {
    "between": "A1-A2",
    "betweenExercises": {"label": "20-30 seconds", "presets": [20, 30], "quote": "Take 20-30 seconds rest between each exercise (A1 to A2)"},
    "betweenSets": {"label": "4-5 minutes", "presets": [240, 300], "quote": "4-5 minutes rest between each set."},
}
FOAM = "Make sure to foam roll & stretch when finished the workout to speed up recovery!"
REST_QUOTE = (
    "Exercising places a tremendous amount of strain on the body! When you exercise you tear muscle fibers which the "
    "body must repair in order to make you stronger! In order to do this, your body must have time to recover. The body "
    "does not grow stronger or build endurance while you are exercising. It’s the period after your workout when your "
    "body makes all of these changes! If you want to see any performance benefits, its “VITAL” to give your body time "
    "to repair itself or your performance will not improve! In fact, your performance will likely suffer and plateau, "
    "leading to injuries!"
)
# Phase 2/3 schedule pages use a slightly different rest quote. Keep the phase-1 wording on phase 1
# and the later wording on phase 2/3 schedule rest days.
REST_QUOTE_P2 = (
    "Exercising places a tremendous amount of strain on the body! When you exercise, you tear muscle fibers, which the "
    "body must repair in order to make you stronger! In order to do this, your body must have time to recover! The body does "
    "not grow stronger or build endurance while your exercising! It’s the period after your workout when your body makes all of "
    "these changes! If you want to see any performance benefits, its “VITAL” to give your body time to repair itself or your "
    "performance will not improve! In fact, your performance will likely suffer and plateau, leading to injuries!"
)

WALL_BUG = [
    "Take Deep Breath In (By-Pass Lunges) And Fill Up Belly And Back With As Much Air As Possible (Should Take 5 Seconds)",
    "Exhale Out As Leg Extends",
]
WALL_BUG_BEN = [
    "Strengthens Deep Core Transverse Abdominals",
    "Improves Diaphragmatic Breathing, Learning To Synergistically Breath & Brace With Load",
]


def phase1_training():
    d1 = day(
        "day-1",
        "Day 1 — Full Body Athletic Development, Submaximal Effort",
        "Medium intensity, submaximal",
        P1_SCHED,
        P1_GUIDE_SUB,
        [
            sec("pre-core", "Pre-Core Activation", "list", [
                E("A1", "Wall Push Dead Bug", "1", "3-5x Per Side", WALL_BUG, WALL_BUG_BEN),
                E("A2", "Elevated Box Band Pallof Press Rotation with Hip Stretch", "1", "10-12x Per Side",
                  ["Stay Long And Tall Through The Spine", "Don’t Round Back", "Rotate Towards Knee Side",
                   "Head/Eyes Should Follow The Hand/Body In Rotation"],
                  ["Strengthen Side Oblique’s", "Improves Stabilization In The Core", "Improves Mobility & Stability In The Hip"]),
                E("A3", "Band Resisted Pallof Lateral Glute Walk", "1", "3-4x Per Side",
                  ["Keep Feet Under Hips And Body Square", "Fully Lock Out Arms And Keep In-Line With Chest"],
                  ["Develops Lateral Glute Strength", "Stabilizes Hips & Torso", "Strengthen Side Oblique’s"]),
                E("A4", "Plate Off-Set Band Stabilization Jump", "1", "8-10x Per Side",
                  ["Brace/Absorb On Impact", "Don’t Let The Weight Pull Up Down, Keep Opposite Side Oblique Tight"],
                  ["Stabilizes Hips & Torso", "Improves Deceleration", "Strengthen Side Oblique’s"],
                  sourceNotes=["The PDF prints “Don’t Let The Weight Pull Up Down, Keep Opposite Side Oblique Tight.”"]),
            ], note=P1_PRE_BENEFIT, image="assets/images/phase1-day1-precore.webp"),
            sec("a-block", "Force Velocity Continuum (Submaximal Effort)", "complex", [
                E("A1", "Back Squat OR Front Squat", "4", "4-5",
                  ["Brace Core-Control The Lowering", "Blast Up"],
                  ["Develop Lower Body Strength And Power", "Increase Power Production = Jump Higher"],
                  variations=["Back Squat", "Front Squat"], column="Maximal Strength",
                  loadText="Medium Intensity. Week 1: 78.5% 1 RM. Week 2: 80% 1 RM. Week 3: 82.5% 1 RM",
                  percents=[P(1, 78.5, "78.5% 1 RM"), P(2, 80, "80% 1 RM"), P(3, 82.5, "82.5% 1 RM")],
                  tempo="5 Second Eccentric Lowering", rom="Sports Specific or Just Below 90 Degrees", maxKey="Back Squat OR Front Squat"),
                E("A2", "Tuck Jump OR Hurdle Jump", "4", "4",
                  ["Quick Ground Contact", "Explode Off The Ground", "Be Aggressive/Push Ground Away"],
                  ["Increase Ground Reaction", "Increase Fast Twitch Muscle Fibers", "Increase Power Production"],
                  variations=["Tuck Jump", "Hurdle Jump"], column="Strength-Speed",
                  loadText="Bodyweight “Reactive”", tempo="Fast (Quick Ground Contact)", rom="Sports Specific"),
                E("A3", "DB Acceleration Squat Jumps", "4", "4",
                  ["Explosive From The Bottom", "Get Long And Tall", "Be Aggressive/Push Ground Away"],
                  ["Increase Acceleration", "Increase Power And Explosive Output", "Developing Greater Range Of Motion And Lower Body Strength"],
                  column="Speed-Strength", loadText="Use 30-40% of A1",
                  percentOfA1={"low": 30, "high": 40, "label": "Use 30-40% of A1"},
                  tempo="Fast (From Low Position)", rom="(Deep Position) Low Jumps"),
                E("A4", "Band Assisted Over-Speed Jumps", "4", "4",
                  ["Quick Ground Contact", "Explode Off The Ground", "Be Aggressive/Push Ground Away"],
                  ["Increase Ground Reaction", "Increase Top End Speed", "Increase Fast Twitch Muscle Fibers", "Increase Power Production"],
                  column="High Velocity", loadText="Band Assisted “Reactive” Jumps",
                  tempo="Fast (Quarter Squat Position)", rom="Sports Specific"),
            ], rest={**A_REST_ALL, "during": "During the rest period perform upper body external rotation x 8 reps per side."},
               image="assets/images/phase1-day1-ablock.webp"),
            sec("block-1", "Block 1", "accessory", [
                E("B1", "DB Incline Shoulder Stabilization Press", "3", "6x Per Side",
                  ["3 Second Lowering/Eccentric", "Don’t Bent Stabilized Arm", "Full Range of Motion"],
                  ["Increases Functional Strength", "Increases Shoulder Stability & Stabilization"],
                  sourceNotes=["The PDF prints “Don’t Bent Stabilized Arm.”"]),
                E("B2", "Single Arm Explosive Chess Pass", "3", "5x Per Side",
                  ["Be Explosive", "Fully Lock Out Arm", "Use Hips"],
                  ["Increases Force Production", "Increase Reactive Ability"],
                  sourceNotes=["The PDF spells this “Chess Pass.”"]),
                E("B3", "DB Contra-Lateral Reverse Lunge & Row", "3", "8-10x Per Side",
                  ["2 Second Lowering/Eccentric", "Keep Slight Forward Lean In Lunge", "Maintain Flat Back And Row Towards Belly Button-Rib Cage"],
                  ["Increase Front Leg Power/ Frist Step Acceleration", "Increase Back Strength For Arm Speed", "Develop Balance, Stability & Coordination"],
                  sourceNotes=["The PDF prints “Frist Step.”"]),
                E("B4", "Box Elevated Barbell Horizontal Row", "3", "10x",
                  ["2 Second Lowering/Eccentric", "Pause At Top For 1 Second", "Keep Body In Straight Alignment", "Engage Core, Squeeze Glutes And Hamstrings"],
                  ["Improves Posture And Spine Stability", "Develops Strong Lower Back And Core", "Increases Shoulder & Scapula Strength"]),
            ], rest=ACC_REST),
            sec("block-2", "Block 2", "accessory", [
                E("C1", "Elevated Hip Thrust", "3", "6-8x",
                  ["5 Second Hold/Isometric Pause At Top", "Lower With Control & Keep Core Engaged",
                   "Tuck Your Chin And Look Straight Ahead At Top- Follow Bar Back Down With Eyes & Body"],
                  ["Develop Glute & Hamstring Strength To Maximize Speed & Acceleration",
                   "Improve Core And Hip Complex For Added Stabilization And Stability",
                   "Develops Lower Back Strength And Spine Stability"]),
                E("C2", "Suspension Explosive “Y” Snatch", "3", "10x",
                  ["Fast Explosive Pull", "Maintain Proper Posture And Ailment At Top", "Engage Shoulders, Core And Glutes At Top"],
                  ["Develop Explosive Overhead Arm Speed", "Develops Shoulder And Core Stabilization", "Develops Coordination"],
                  sourceNotes=["The PDF prints “Ailment At Top.”"]),
                E("C3", "Pallof Twist - Swiss Ball Adductor Squeeze & Hold", "3", "3x Squeeze, 3x Twist, X 5 Per Side",
                  ["Squeeze Ball 3X Followed By 3X Twist", "Keep Ball Squeezed While Twisting To Maintain Engagement In Adductors"],
                  ["Helps Reduce Groin Strains", "Develops Stronger Core", "Improves Cutting-Agility"]),
            ], rest=ACC_REST),
            sec("block-3", "Block 3", "accessory", [
                E("D1", "Suspension Push-Up to Pike", "3", "10-15x",
                  ["2 Second Hold/Isometric Pause At Top", "Maintain Proper Control And Body Positioning",
                   "Don’t Sag Hip- Let Low Back Arch", "Keep Core Tight, Glutes Engaged"],
                  ["Develops Tremendous Functional Upper Body Strength", "Helps Integrate The Core And Upper Body"]),
                E("D2", "Side Plank with Hip Flexion", "3", "10x Per side",
                  ["Keep Body In A Straight Line", "Don’t Drop Hips", "Keep Foot In Dorsiflexion", "Drive Knee To Chest"],
                  ["Improves Hip Flexor Strength", "Stabilizes The Core And Hips", "Strengths Hip Complex"]),
            ], rest=ACC_REST),
        ],
        a1ByWeek={
            "1": {"text": "78.5% of 1 Rep Max or 3 Rep Max", "percent": 78.5},
            "2": {"text": "80% of 1 Rep Max or 3 Rep Max", "percent": 80},
            "3": {"text": "82.5% of 1 Rep Max or 3 Rep Max", "percent": 82.5},
        },
        closer=FOAM,
        sourceNotes=[
            "Day 1 overview also says: If it takes you 4 to 8 seconds to get the weight back up, it’s too heavy.",
            "Submaximal overview: When training with submaximal loads at intensities of 75–85% percent, the bar velocity typically can decrease after the first working set. If this happens, lower the weight or cut the set down by 1 or 2 reps to ensure high quality reps only!",
        ],
    )

    d2 = day(
        "day-2",
        "Day 2 — Lower Body Development Emphasis, Maximal Effort",
        "High intensity, maximal effort",
        ["Workout Length: 1.5 Hours", "Warm-Up 15-20: Minutes", "Pre-Core Activation Development: 10 Minutes", "Full Body Training: 1 Hour"],
        [
            "Use cluster sets to maximize performance",
            "Perform lift with a reactive tempo (as fast as possible) maintaining proper form and depth during each lift",
            "Always use a spotter and safety bars when preforming heavy lifts",
            "Move the bar with aggression, intent and with total body tension",
            "Complete in block order (super sets, tri-sets, complexes) with 15-30 seconds rest between exercises",
            "Follow the exact (sets & reps) with 1.5-2 minutes rest between sets! Complete all sets before the next",
        ],
        [
            sec("pre-core", "Pre-Core Activation", "list", [
                E("A1", "Wall Push Dead Bug", "1", "3-5 x Per Side", WALL_BUG, WALL_BUG_BEN),
                E("A2", "Single Leg Bridge Adductor with Squeeze", "1", "10 x Per Side",
                  ["Maintain Squeeze Between Legs", "Keep Hips and Torso"],
                  ["Strengthen Hip Control", "Improves Stabilization", "Reduces Groin Strains"]),
                E("A3", "Band Resisted Pallof Lateral Glute Walk", "1", "3-4x Per Side",
                  ["Maintain Resistance Against Bands With Knees", "Keep Feet Under Hips And Body Square", "Fully Lock Out Arms And Keep In-Line With Chest"],
                  ["Develops Lateral Glute Strength", "Stabilizes Hips & Torso", "Strengthen Oblique’s"]),
                E("A4", "Band Resisted Snap Down Jump", "1", "12x Per Side",
                  ["Maintain Resistance against Bands", "Raise Up onto Toes and Snap down Fast", "Keep Proper Posture", "Don’t Let Knees Cave"],
                  ["Stabilizes Hips and Torso", "Improves Deceleration", "Strengthen Core"]),
            ]),
            sec("a-block", "Force Velocity Continuum (Maximal Effort)", "complex", [
                E("A1", "Back Squat OR Front Squat", "4", "Do 1 Rep & Then Rest 20-30s ... Perform Another Rep. Repeat For Desired Reps.",
                  ["Brace Core-Control the Lowering", "Blast Up"],
                  ["Develop Lower Body Strength and Power", "Increase Power Production = Jump Higher"],
                  variations=["Back Squat", "Front Squat"], column="Maximal Strength",
                  loadText="High Intensity. Week 1: 90% 1RM. Week 2: 90% 1 RM. Week 3: 92.5% 1RM",
                  percents=[P(1, 90, "90% 1RM"), P(2, 90, "90% 1 RM"), P(3, 92.5, "92.5% 1RM")],
                  tempo="Fast Reactive As Fast As Possible with Control",
                  rom="Sports Specific or Just Below 90 Degrees",
                  cluster={"rest": "20-30 seconds", "presets": [20, 30], "quote": "Do 1 Rep & Then Rest 20-30s ... Perform Another Rep. Repeat For Desired Reps."},
                  repsByWeek={"1": "3-4 Reps Total Each Set", "2": "3-4 Reps Total Each Set", "3": "2-3 Reps Total Each Set"},
                  maxKey="Back Squat OR Front Squat"),
                E("A2", "Reactive Standing Squat Drop Jump", "4", "4",
                  ["Quick Ground Contact", "Explode Off the Ground", "Be Aggressive/Push Ground Away"],
                  ["Increase Ground Reaction", "Increase Fast Twitch Muscle Fibers", "Increase Power Production"],
                  column="Strength-Speed", loadText="Bodyweight “Reactive”", tempo="Fast (Quick Ground Contact)", rom="Sports Specific"),
                E("A3", "Delt Bent Over Lateral Drops", "4", "8 Per Side",
                  ["Maintain Upright Position with Proper Alignment", "Retract Scapula/Strong Upper Back", "Start at Shoulder Level"],
                  ["Faster Reaction Time", "Stronger Shoulders", "Develops Shoulder Stabilization", "Develops Upper Deceleration Abilities"],
                  column="Recovery Exercise", loadText="Enough Weight You Can Catch & Control", tempo="Quick Reaction",
                  rom="Start at Shoulder Level. Drop and Catch As Quick as Possible", duringRest=True),
                E("A4", "DB Wrist Rotations", "4", "15-20 Per Side",
                  ["Keep Wrist Straight", "Maintain Core Engagement", "Maintain Up Right Posture"],
                  ["Stronger Grip Strength", "Stronger Wrist", "Shoulder Strength"],
                  column="Recovery Exercise", loadText="Enough Weight You Can Do For Reps Outlined",
                  tempo="2-3 Seconds Between Rotation", rom="Place DB in Front of you with straight arms", duringRest=True),
            ], rest={**A_REST_A1A2, "during": "During the rest period perform exercises from A3 & A4."}),
            sec("block-1", "Block 1", "accessory", [
                E("B1", "Kettlebell Swing", "3", "10-12x",
                  ["Hip Hinge to Pick –Up Bell! Knees Inline with Ankles, Shoulder above Hips",
                   "Maintain Neutral Back, Flat feet and Shoulders Packed", "Stand Tall with Core & Glutes Engaged"],
                  ["Increased Power Production", "Increased Muscular Endurance", "Increased Aerobic Capacity", "Increased Anaerobic Capacity"]),
                E("B2", "Bulgarian Split Squat (Heavy)", "3", "8x Per Side",
                  ["2 Second Lowering/Eccentric", "Make sure to keep the Front foot flat on the ground",
                   "Sit hips back slow & drop back knee to the ground", "Keep Chest Up & Core Engaged"],
                  ["Most Sports are played on a single leg", "Develops a tremendous amount balance, stability and Power"]),
                E("B3", "Slow Eccentric Pull-Ups", "3", "6-8x",
                  ["2 Second Lowering/Eccentric", "Engage Core and Squeeze Glutes (Body Hollow Position)"],
                  ["Develops Stronger Upper Back And Grip Strength", "Helps Create Faster Arm Action When Sprinting"]),
            ], rest=ACC_REST),
            sec("holds", "After Block 1", "holds", [
                E("", "Body weight isometric split stance squat", "both sides", "as long as you can",
                  ["When Block 1 is complete, do a body weight isometric split stance squat on both sides for as long as you can! Record the time on both sides and try to break it next week!"],
                  hold=True),
                E("", "Isometric body weight locked out pull-up hold", "1", "as long as possible",
                  ["After you complete the body weight isometric split stance squat then you will hold a isometric body weight locked out pull-up hold for as long as possible! Record the time and try to break it next week!"],
                  hold=True),
            ]),
            sec("block-2", "Block 2", "accessory", [
                E("C1", "Back Extension", "3", "20+20x Sec. Hold",
                  ["1 Second Lowering/Eccentric", "Don’t Over Extend At Top", "Keep Core Engaged"],
                  ["Improves Posture And Spine Stability", "Develops Strong Lower Back And Core", "Develops Glute And Hamstring Strength"]),
                E("C2", "Bench Glute Abduction", "3", "30+30 Second Hold",
                  ["Sit With Erect Posture", "Feet Shoulder Width Apart", "Let Knees Fall In- Then Push Against Bands To Engage Glutes", "Toes Pointed Straight"],
                  ["Activates & Increases Glute Complex Firing", "Stabilizes Pelvis And Will Reduce Stress From Low Back Due To Greater Glute Engagement", "Increase Power Production = Jump Higher"]),
                E("C3", "Side Plank Adductor Holds", "3", "10-20 Sec.",
                  ["Don’t Let Hips Dip", "Squeeze Bottom Leg To Top Leg", "Keep Body In Straight Line And Maintain Core Engagement"],
                  ["Increases Hip, Core strength", "Increases Side Oblique & Groin Strength"]),
            ], rest=ACC_REST),
            sec("block-3", "Block 3", "accessory", [
                E("D1", "Pallof Press Alphabet", "2", "Write Aphabet Per Side",
                  ["Keep Core & Glutes Engaged", "Lock Out Arms & Keep In Front Of Body"],
                  ["Improves Core Stability", "Strengthens Deep Core Transverse Abdominals"],
                  sourceNotes=["The PDF prints “Write Aphabet Per Side.”"]),
                E("D2", "Single Leg Balance Pad Alphabet", "2", "Write Aphabet Per Leg",
                  ["Place Foot In Middle Of Pad", "Have A Slight Bend With The Leg On The Pad And Place Hands On Hips",
                   "Make Sure The Off Leg Which Is Writing The Alphabet Is Fully Moving Through The Full Hip"],
                  ["Develops Ankle, Knee, Hip Stabilization", "Increases Body Control and Awareness", "Creates Hip Flexor Strength"],
                  sourceNotes=["The reps cell prints “Aphabet.” The coaching point prints “Alphabet.”"]),
            ], rest=ACC_REST),
        ],
        a1ByWeek={
            "1": {"text": "90% of 1 Rep Max or 3 Rep Max (3-4 Reps Total Each Set)", "percent": 90},
            "2": {"text": "90% of 1 Rep Max or 3 Rep Max (3-4 Reps Total Each Set)", "percent": 90},
            "3": {"text": "92.5% of 1 Rep Max or 3 Rep Max (2-3 Reps Total Each Set)", "percent": 92.5},
        },
        closer=FOAM,
        sourceNotes=["High-intensity overview: loads of 90–97% percent of your 1 or 3 Rep Max, cluster sets, quality over quantity."],
    )

    d3 = day(
        "day-3",
        "Day 3 — Full Body Training with Lower Body Development Emphasis, High Volume",
        "Low intensity, high volume",
        ["Workout Length: 1.5 Hours", "Warm-Up 15-20: Minutes", "Pre-Core Activation Development: 10 Minutes", "Full Body Training: 1 Hour"],
        P1_GUIDE_SUB,
        [
            sec("pre-core", "Pre-Core Activation", "list", [
                E("A1", "Wall Push Dead Bug", "1", "3-5x Per Side",
                  ["Take Deep breath In (By-Pass Lunges) and Fill Up Belly and Back with as much air as possible (should take 5 Seconds)",
                   "Exhale Out as Leg Extends Out (Should take 5 Seconds)"],
                  ["Strengthens Deep Core Transverse Abdominals", "Improves Diaphragmatic Breathing, Learning to Synergistically Breath & Brace with Load"]),
                E("A2", "Mini Band Single Leg Glute Bridge with Abduction", "1", "10x Per Side",
                  ["Keep Core Engaged", "Don’t Let Hips Dip from either side", "Keep Toe Up & drive through heel", "Don’t let hips or Low Back Sag"],
                  ["Reduces hamstring pulls, strains", "Increases hip control", "Most Sports are played on a single leg", "Develops a tremendous amount balance, stability and power"]),
                E("A3", "Anterior Oblique Chop Step", "1", "10x Per Side",
                  ["Start in Staggered Stance", "Chop across body starting from hip to belly button in a controlled dynamic action"],
                  ["Develops Lateral Glute Strength", "Stabilizes Hips and Torso", "Strengthen Side Oblique’s"]),
                E("A4", "Split Stance Plate Off-Set Stabilization Jump", "1", "10x Per Side",
                  ["Brace/Absorb on Impact", "Don’t let the Weight Pull you Down, Keep Opposite Side Oblique Tight"],
                  ["Stabilizes Hips and Torso", "Improves Deceleration", "Strengthen Side Oblique’s"]),
            ]),
            sec("a-block", "Force Velocity Continuum (Low Intensity, High Volume)", "complex", [
                E("A1", "Barbell Split Squat", "4", "4-5",
                  ["Brace Core-Control The Lowering", "Blast Up From Bottom Position"],
                  ["Develop Lower Body Strength And Power", "Increase Power Production = Jump Higher"],
                  column="Maximal Strength",
                  loadText="Low Intensity. Week 1: 7.5/10 Effort. Week 2: 7.5/10 Effort. Week 3: 8.0/10 Effort",
                  percents=[
                      P(1, 75, "Schedule page: 75% of 1 Rep Max or 3 Rep Max"),
                      P(2, 75, "Schedule page: 75% of 1 Rep Max or 3 Rep Max"),
                      P(3, 78.5, "Schedule page: 78.5% of 1 Rep Max or 3 Rep Max"),
                  ],
                  tempo="5 Second Eccentric Lowering", rom="Sports Specific or Just Below 90 Degrees",
                  effortByWeek={"1": "7.5/10 Effort", "2": "7.5/10 Effort", "3": "8.0/10 Effort"},
                  maxKey="Barbell Split Squat",
                  sourceNotes=["The A-block load row prints effort (7.5/10, 7.5/10, 8.0/10). The Day 3 schedule page prints Week 1: 75% of 1 Rep Max or 3 Rep Max, Week 2: 75%, Week 3: 78.5%. Both are shown. This page does not convert one into the other."]),
                E("A2", "Split Stance Alternating Jumps", "4", "3 Reps Per Leg (6 Total Reps)",
                  ["Quick Ground Contact", "Explode Off The Ground", "Be Aggressive/Push Ground Away"],
                  ["Increase Ground Reaction", "Increase Fast Twitch Muscle Fibers", "Increase Power Production"],
                  column="Strength-Speed", loadText="Bodyweight “Reactive”", tempo="Fast (Quick Ground Contact)", rom="Sports Specific"),
                E("A3", "Incline Y-W-T Raises", "4", "8- 10",
                  ["Initiate Movement With Scapula Retraction", "Keep Thumps Up", "Control Full Range Of Movement"],
                  ["Develop Shoulder Stabilization & Upper Back Strength"],
                  column="Recovery Exercise", loadText="2.5 – 5lbs Weight Plates", tempo="2-3 Second Eccentric Lowering",
                  rom="Don’t Go Past Ears", duringRest=True,
                  sourceNotes=["The PDF prints “Keep Thumps Up.” The demo line on this row prints “Click For Demp.”"]),
                E("A4", "Band Anterior Tibialis", "4", "15-20",
                  ["Keep Foot In Neutral Position", "Go Through Full Range Of Motion", "Keep Tension On The Band"],
                  ["Reduces Ankle Injuries", "Builds Resilience"],
                  column="Recovery Exercise", loadText="Mini Band", tempo="Full Control Through All Ranges Of Movement",
                  rom="Full ROM", duringRest=True),
            ], rest={**A_REST_A1A2, "during": "During the rest period perform exercises from A3 & A4."}),
            sec("block-1", "Block 1", "accessory", [
                E("B1", "Barbell RDL", "3", "8x",
                  ["2-3 Second Lowering/Eccentric", "Hip Hinge To Initiate Movement", "Keep Core Engaged", "Keep Feet Glued To The Floor"],
                  ["Develop Powerful Hips & Glutes To Maximize Jumping And Sprinting", "Increase Flexibility In The Hamstrings"]),
                E("B2", "Single Leg Pistol Squat or Box Squat", "3", "8x Per Side",
                  ["2 Second Lowering/Eccentric", "Maintain Great Posture", "Chest Up-Flat Back", "Initiate Movement By Sitting Hips Back And Getting As Low As You Can Go"],
                  ["Most Sports Are Played On A Single Leg", "Develops A Tremendous Amount Of Balance, Stability And Power"],
                  variations=["Single Leg Pistol Squat", "Box Squat"]),
                E("B3", "DB Flat Bench Press (Heavy)", "3", "10-12x",
                  ["2 Second Lowering/Eccentric", "Control The Weight", "Retract Upper Back & Drive Feet Down Into The Ground", "Squeeze Glutes"],
                  ["Increases Functional Strength", "Increases Shoulder Stability & Stabilization"]),
            ], rest=ACC_REST),
            sec("block-2", "Block 2", "accessory", [
                E("C1", "Landmine Barbell Split Stance Press", "3", "10x Per Side",
                  ["Speed Movement, Press Fast But Control The Bar Back To Start", "Shoulder And Hips Should Be Square"],
                  ["Increases Functional Strength And Develops A Tremendous Amount Of Balance, Stability And Power", "Increases Shoulder Stability & Stabilization"]),
                E("C2", "DB Single Arm Row", None, "12x Per Side",
                  ["2 Second Lowering/Eccentric", "Keep Core Engaged", "Keep Slight Knee Bend", "Make Sure Shoulders Stay Aligned"],
                  ["Improves Posture and Hip, Core Stability", "Develops Strong Lats for Sprinting"],
                  sourceNotes=["The sets cell on this row is blank in the PDF. Reps print as 12x per side. The other Block 2 rows on the page print 3 sets. That number is not printed on this row."]),
                E("C3", "Lying Elevated Single Leg Hip Thrust (Each Set Change Leg Length)", "3", "10 + 10 Sec. Hold",
                  ["2 Second Lowering/Eccentric", "Keep Core Engaged", "Follow Hips Back Down When Descending", "Tuck Chin And Look Straight Ahead", "Toes Up, Drive Through Heels"],
                  ["Activates & Increases Glute Complex Firing", "Stabilizes Pelvis And Will Reduce Stress From Low Back Due To Greater Glute Engagement", "Increase Power Production = Jump Higher"]),
            ], rest=ACC_REST),
            sec("block-3", "Block 3", "accessory", [
                E("D1", "Calf Raises Complex", "1", "1-10",
                  ["2 Second Lowering/Eccentric", "Raise Up As High As You Can Go", "Drop Heels As Low As It Can Go"],
                  ["Increases Power & Stabilization For Jumping And Sprinting", "Helps Reduce Ankle Injuries"]),
            ], rest=ACC_REST),
        ],
        a1ByWeek={
            "1": {"text": "Schedule page: 75% of 1 Rep Max or 3 Rep Max. A-block load row: 7.5/10 Effort", "percent": 75, "effort": "7.5/10 Effort"},
            "2": {"text": "Schedule page: 75% of 1 Rep Max or 3 Rep Max. A-block load row: 7.5/10 Effort", "percent": 75, "effort": "7.5/10 Effort"},
            "3": {"text": "Schedule page: 78.5% of 1 Rep Max or 3 Rep Max. A-block load row: 8.0/10 Effort", "percent": 78.5, "effort": "8.0/10 Effort"},
        },
        closer=FOAM,
        sourceNotes=[
            "Day 3 schedule page percentages and the A-block effort row are both printed. The calculator uses the schedule-page percent only when a max is entered, and the effort rating stays in the PDF’s words.",
            "Overview: Day 3 is very similar to Day 1 with extra volume at the end of the week. Loads of 75–80% percent. Focus on qualtity > quantity still.",
        ],
    )
    off = rest_day(
        "off",
        "Off days — REST, full recovery",
        [REST_QUOTE],
        ["The Phase 1 PDF labels this “OFF DAYS REST - Full Recovery.” It is not a numbered training day."],
    )
    return [d1, d2, d3, off]


# Days for deload / phase 2 / phase 3 live in program_days.py, which imports this module.
