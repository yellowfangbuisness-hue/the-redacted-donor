# Graph Report - src  (2026-11-14)

## Corpus Check
- Corpus is ~28,801 words - fits in a single context window. You may not need a graph.

## Summary
- 403 nodes · 994 edges · 24 communities (23 shown, 1 thin omitted)
- Extraction: 93% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Game Flow & Save State
- Game Globals & Wiring
- Prop Models & Easter Egg
- Room Construction
- Audio & Diagnostics
- Movement, Targeting & Clock
- Icon Sprite Sheet
- Screens & Game Over
- Field-work Puzzles
- Campaign Rules
- Paper Document Painting
- Evidence Thumbnails
- HTML Shell & Title
- Case Data
- Records Annex
- Objectives & Journal
- Title Key Art
- Floor Plan & Collision
- Cutscene Camera & FX
- Rescue Key Art
- Case File Advance
- Player Movement
- Sound Settings
- Inspect HUD

## God Nodes (most connected - your core abstractions)
1. `furnish()` - 38 edges
2. `dialogAction()` - 31 edges
3. `updateHud()` - 26 edges
4. `interact()` - 25 edges
5. `buildRoom()` - 23 edges
6. `Icon Sprite Sheet (icons.svg)` - 22 edges
7. `panel()` - 20 edges
8. `persist()` - 18 edges
9. `cutscene()` - 17 edges
10. `enterGame()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Framed Caduceus Certificate` --conceptually_related_to--> `title()`  [AMBIGUOUS]
  art/title.jpg → game.js
- `title()` --references--> `Title Screen Key Art (title.jpg)`  [INFERRED]
  game.js → art/title.jpg
- `ending()` --references--> `Rescue Ending Key Art (rescue.jpg)`  [INFERRED]
  game.js → art/rescue.jpg
- `furnish()` --references--> `Wanted Poster Easter Egg Portrait Photo`  [INFERRED]
  props.js → art/wanted.jpg
- `Day/Night Timepiece Dial (#timepiece)` --references--> `updateClock()`  [INFERRED]
  shell.html → game.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **HUD status readouts updated each frame** — shell_hud, shell_objective_card, shell_score_counter, shell_composure_bulbs, shell_timepiece, shell_character_portrait [INFERRED 0.85]
- **Threat feedback cues (danger alert, gaze, screen effects)** — shell_danger_alert, shell_gaze_indicator, shell_screen_effects [INFERRED 0.65]
- **Story presentation flow (title, cinema, chapter card, fade)** — shell_title_screen, shell_cinema, shell_chapter_card, shell_screen_effects [INFERRED 0.75]
- **Case shutdown / time-out motif** — art_collapse_pocket_watch, art_collapse_detective_office, art_collapse_officer_silhouette [INFERRED 0.75]
- **Noir title scene composition** — art_title_detective_silhouette, art_title_detective_office, art_title_rainy_noir_city, art_title_sepia_noir_style [EXTRACTED 1.00]
- **Detective forensic/evidence icons** — icons_i_fingerprint, icons_i_scan, icons_i_droplet, icons_i_network, icons_i_notebook, icons_i_folder, icons_i_pulse, icons_i_aperture, icons_i_lock [INFERRED 0.65]
- **Input / control hint icons** — icons_i_keyboard, icons_i_mouse, icons_i_volume, icons_i_volume_off, icons_i_expand [INFERRED 0.75]
- **UI navigation/state icons** — icons_i_arrow, icons_i_back, icons_i_chevron, icons_i_close, icons_i_check, icons_i_crosshair, icons_i_recenter [INFERRED 0.75]

## Communities (24 total, 1 thin omitted)

### Community 0 - "Game Flow & Save State"
Cohesion: 0.09
Nodes (60): addExhibits(), fresh(), grant(), readRun(), record(), verifyLead(), back(), beginMemory() (+52 more)

### Community 1 - "Game Globals & Wiring"
Cohesion: 0.04
Nodes (43): annex, audio, camera, camSpace, canvas, cineLook, cineM, cineV (+35 more)

### Community 2 - "Prop Models & Easter Egg"
Cohesion: 0.10
Nodes (37): Wanted Poster Easter Egg Portrait Photo, WANTED Poster Easter Egg (last seen at the Oak Hackathon), cathedralRadio(), clothBook(), columnRadiator(), filingCabinet(), instrumentTrolley(), kit() (+29 more)

### Community 3 - "Room Construction"
Cohesion: 0.14
Nodes (22): bar(), border(), buildRoom(), bake(), barBetween(), cylinder(), lampArm(), makeDocument() (+14 more)

### Community 4 - "Audio & Diagnostics"
Cohesion: 0.13
Nodes (10): GameAudio, assertDotProductReveal(), assertShaderUniforms(), assertStateTransitions(), assertTextureFactory(), CLUE_REGISTRY, createDiagnostics(), dotReveal() (+2 more)

### Community 5 - "Movement, Targeting & Clock"
Cohesion: 0.15
Nodes (21): driveMemory(), hasClearPath(), inReach(), pointTo(), updateClock(), updateTargets(), worldTime(), Distance Pointer Arrow (#pointer) (+13 more)

### Community 6 - "Icon Sprite Sheet"
Cohesion: 0.11
Nodes (22): Icon Sprite Sheet (icons.svg), i-aperture icon, i-arrow icon, i-back icon, i-check icon, i-chevron icon, i-close icon, i-crosshair icon (+14 more)

### Community 7 - "Screens & Game Over"
Cohesion: 0.17
Nodes (20): Collapse Key Art (game-over illustration), Abandoned Detective Office, Sepia-Red Noir Engraving Style, Uniformed Officer Behind Frosted Door, Cracked Pocket Watch, actionCard(), board(), briefing() (+12 more)

### Community 8 - "Field-work Puzzles"
Cohesion: 0.23
Nodes (12): adjust(), crosses(), nudge(), paintWork(), signal(), solved(), startWork(), tickets (+4 more)

### Community 9 - "Campaign Rules"
Cohesion: 0.23
Nodes (11): buy(), canBuy(), loseCase(), memoryTasks(), objective(), readyTasks(), revive(), stages (+3 more)

### Community 10 - "Paper Document Painting"
Cohesion: 0.36
Nodes (11): agedPaper(), crease(), emblem(), paintClipping(), paintCover(), paintDocument(), paintPlaque(), paintTag() (+3 more)

### Community 11 - "Evidence Thumbnails"
Cohesion: 0.55
Nodes (11): drawManifest(), drawPaper(), drawPhone(), drawThumbnail(), drawVisa(), fillPath(), hatch(), inkLines() (+3 more)

### Community 12 - "HTML Shell & Title"
Cohesion: 0.20
Nodes (9): Boot Error Alert (#bootError), Chapter Card (#chapterCard), Cinematic Letterbox (#cinema), Game HTML Shell Template, Title Menu Buttons (begin, controls, newGame), Screen Effects (vignette, flash, fade), Title Sound Toggle (#titleSound), Title Screen (#title) (+1 more)

### Community 13 - "Case Data"
Cohesion: 0.22
Nodes (8): actions, cases, curios, discoveries, evidence, leads, stationsGuide, supplies

### Community 14 - "Records Annex"
Cohesion: 0.32
Nodes (4): buildAnnex(), add(), lathe(), rod()

### Community 15 - "Objectives & Journal"
Cohesion: 0.36
Nodes (8): stageTargets(), journal(), mainTarget(), mapDrawing(), mission(), placeName(), searchedList(), unsearched()

### Community 16 - "Title Key Art"
Cohesion: 0.38
Nodes (7): Title Screen Key Art (title.jpg), Case Files / Dossiers, Detective's Office Interior, Trench-Coated Detective Silhouette, Framed Caduceus Certificate, Rain-Soaked Night Cityscape, Sepia Engraved Noir Art Style

### Community 17 - "Floor Plan & Collision"
Cohesion: 0.38
Nodes (6): stations, floorplan(), footprints, ROOM_SOUTH, X(), Z()

### Community 18 - "Cutscene Camera & FX"
Cohesion: 0.29
Nodes (7): bezier(), easeIO(), easeOut(), holdPose(), lookQuat(), sampleFx(), updateCine()

### Community 19 - "Rescue Key Art"
Cohesion: 0.60
Nodes (5): Rescue Ending Key Art (rescue.jpg), Detective and Rescued Woman Walking Out, Harbour at Dawn Setting, Hospital / Clinic Doorway (Red Cross Emblem), 1940s Sepia Engraving Style

### Community 20 - "Case File Advance"
Cohesion: 0.67
Nodes (3): advanceFile(), caseNo(), chapter()

### Community 21 - "Player Movement"
Cohesion: 0.67
Nodes (3): isLow(), move(), solid()

### Community 22 - "Sound Settings"
Cohesion: 0.67
Nodes (3): putStored(), toggleSound(), updateSoundButton()

## Ambiguous Edges - Review These
- `title()` → `Framed Caduceus Certificate`  [AMBIGUOUS]
  art/title.jpg · relation: conceptually_related_to
- `Screen Effects (vignette, flash, fade)` → `Danger Alert (#danger)`  [AMBIGUOUS]
  shell.html · relation: conceptually_related_to
- `Icon Sprite Sheet (icons.svg)` → `Icon sprite usage not determinable from file`  [AMBIGUOUS]
  icons.svg · relation: rationale_for

## Knowledge Gaps
- **25 isolated node(s):** `First-person World Canvas (#world)`, `Gaze Indicator (#gaze)`, `Title Sound Toggle (#titleSound)`, `Boot Error Alert (#bootError)`, `Reticle and Marker Layer` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 90 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `furnish()` connect `Prop Models & Easter Egg` to `Game Globals & Wiring`, `Paper Document Painting`, `Movement, Targeting & Clock`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `furnish()` (e.g. with `Wanted Poster Easter Egg Portrait Photo` and `animate()`) actually correct?**
  _`furnish()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `First-person World Canvas (#world)`, `Gaze Indicator (#gaze)`, `Title Sound Toggle (#titleSound)` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Game Flow & Save State` be split into smaller, more focused modules?**
  _Cohesion score 0.08961748633879782 - nodes in this community are weakly interconnected._
- **Why does `buildRoom()` connect `Room Construction` to `Game Globals & Wiring`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `title()` and `Framed Caduceus Certificate`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Screen Effects (vignette, flash, fade)` and `Danger Alert (#danger)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._