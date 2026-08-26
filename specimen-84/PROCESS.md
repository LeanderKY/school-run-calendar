# SPECIMEN 84 — NON-AI-SLOP PRODUCTION LOOP

## The brief, rewritten
Build SPECIMEN 84 like an award-level interactive digital artifact, not an AI landing page. Do not add effects because they are fashionable. Every visual rule and every interaction must belong to the fiction: the visitor is investigating a recovered object and the file changes because of that investigation.

The experience must be more than scroll animation. Scrolling can move between acts, but the memorable moments must require deliberate user input: rotate, scan, tune, hold, drag, focus, reveal, compare, or listen.

## Anti-AI rules
1. No generic hero + cards + CTA rhythm.
2. No rounded feature-card grids, glass panels, glow pills, fake dashboards, floating badges, or “tech” decoration without narrative meaning.
3. No effect may exist only to prove technical skill.
4. One visual system must govern typography, spacing, motion, sound, 3D, interaction, and copy.
5. The 3D object must be evidence, not decoration.
6. Every chapter must have a different *task*, not only a different layout.
7. Interaction instructions must feel diegetic: instrument labels, evidence procedures, operator notes.
8. Reward curiosity quietly. No gamified popups, confetti, achievement toasts, or progress XP.
9. Use asymmetry, editorial pacing, negative space, and intentional friction where appropriate.
10. Keep an escape hatch: every interaction must be understandable and reversible.
11. Mobile must have an equivalent interaction, not a crippled desktop imitation.
12. Prefer native browser APIs and the existing custom WebGL renderer over adding libraries unless a library solves a real problem better.

## What award-winning references taught us
- Awarded experiences tend to have one memorable behavioral law, not a bag of effects.
- Their interaction metaphor matches the subject.
- Typography and composition carry identity before animation begins.
- They let the user *do* the premise.
- Motion has states, anticipation, resistance, and consequence; it is not just fade/translate.
- Dense technical moments are balanced with quiet space.
- Sound is optional but purposeful.
- A single unusual interaction can be more memorable than ten common ones.

## Core law
**THE FILE ONLY EXISTS WHILE YOU INVESTIGATE IT.**

The visitor is not reading a report. They are operating the report.

## Interaction architecture
### Act 01 — ACQUIRE
Goal: establish the object as something you can touch, not just watch.
Interaction: click/hold the object to freeze scroll influence and enter a brief direct-manipulation state. Small parallax and model resistance make it feel physical.
Test: does touching it immediately feel different from normal website dragging?

### Act 02 — OPTICAL SCAN
Goal: turn the existing scan chapter into an instrument.
Interaction: drag a horizontal scanning plane over the skull. The shader changes only the scanned slice. Measurement labels update from scanner position. Three anatomical/evidence anomalies can be discovered.
Test: is scanning visually satisfying even before reading labels? Are discoveries tied to places on the model?

### Act 03 — SIGNAL / 13.8 Hz
Goal: make “IT HEARD US” something the visitor proves.
Interaction: drag a physical-looking calibration scale from noisy 9–18 Hz toward 13.8. Near the correct value the waveform coheres, background interference drops, and the hidden line becomes readable.
Test: can the user understand cause and effect without a tutorial card?

### Act 04 — FRAGMENT / HOLD TO STABILIZE
Goal: create tension with a different gesture.
Interaction: press and hold on a corrupted transcript strip. While held, jitter collapses and fragments align; releasing corrupts it again. Optional procedural low-frequency audio reacts to stability.
Test: does holding feel necessary to read, not annoying?

### Act 05 — RECONSTRUCTION
Goal: replace passive timeline with manual sequencing.
Interaction: four evidence strips can be dragged along one forensic rail. One ordering causes visual continuity and reveals what happened between frames 211–214. No “correct!” popup; the interface simply becomes unnervingly coherent.
Test: can the puzzle be solved by observation in under ~30s?

### Act 06 — DARK ROOM / RELEASE
Goal: finale using the pointer/touch as light.
Interaction: the page is deliberately underexposed; dragging a light cone reveals scrape marks, hidden operator notes and one impossible silhouette. The skull subtly counter-rotates toward the light source.
Test: does it create an ending, not another demo?

## Resources / implementation policy
- Existing ScatteringSkull GLB remains primary model.
- Existing custom WebGL2 renderer remains primary renderer.
- Add shader uniforms rather than adopting Three.js solely for effects.
- Pointer Events + setPointerCapture for drag interactions.
- Web Audio API for optional procedural tone/noise after an explicit user gesture.
- CSS masks / radial gradients for dark-room reveal.
- Canvas waveform remains native 2D Canvas.
- No external UI library.
- Add a library only if a concrete blocker is documented here first.

## Mandatory change loop — RUN AFTER EVERY CHANGE
1. **Re-read this file.**
2. State what changed and which act it belongs to.
3. Check **concept**: does it serve the core law, or is it merely cool?
4. Check **visual design**: hierarchy, typography, spacing, contrast, negative space, alignment, accidental symmetry, generic AI patterns.
5. Check **graphics/3D**: clipping, scale, camera, material, lighting, z-order, scanner/light alignment, ugly tangencies.
6. Check **interaction**: discoverability, pointer capture, scroll conflict, touch behavior, escape/reversibility, accidental text selection.
7. Check **code**: syntax, missing DOM refs, state leaks, resize behavior, DPR, reduced motion, WebGL failure, audio lifecycle.
8. Check **performance**: no wasteful per-frame DOM writes, no unnecessary allocations in hot loops where avoidable, no giant new dependency.
9. Check **mobile** explicitly.
10. If any answer feels weak, fix it before moving to the next act.
11. Append a short entry to the pass log.
12. Re-read this file again before the next code change.

## Six full improvement passes
After all six acts exist, run the entire experience six times with a different lens each time.

### PASS 1 — Identity / anti-AI
Delete generic patterns. Check if a screenshot with animations frozen still looks authored and recognizable.

### PASS 2 — Interaction quality
Use every interaction repeatedly. Remove gimmicks, improve resistance, feedback, hit areas and input transitions.

### PASS 3 — Graphic design
Typography, rhythm, crop, grids, whitespace, contrast, texture, hierarchy. Fix anything that looks like generated portfolio filler.

### PASS 4 — Narrative / pacing
Check reveal order, copy, tension, quiet moments, repetition and ending. Each act needs a reason to exist.

### PASS 5 — Technical / mobile / performance
Console errors, loading, WebGL fallback, touch, viewport changes, DPR, reduced-motion, audio unlock, network failure.

### PASS 6 — Leander test
Assume the visitor is Leander: impatient with boring setup, likes technically impressive things, notices when something feels fake/template-like, wants an immediate “wait, what?” moment and interactions worth showing someone else. Remove anything he would scroll past. Strengthen the moments he would replay or show to a friend.

## Definition of done
Not “all planned features exist.” Done means:
- first 5 seconds have identity without relying on animation;
- at least 3 interactions are genuinely replayable;
- every act has a distinct user verb;
- no obvious AI-template section survives;
- desktop and mobile both feel intentionally designed;
- there is a memorable ending;
- after six passes, remaining imperfections are documented rather than ignored.

## Pass log
- RESET: Created the production loop after comparing current award-winning interactive sites. Core problem identified: the previous version had art direction, but the model behaved mostly as decoration and scrolling did most of the work.
