# Voice lines to record

Every line the game shows as speech or a character's thought, grouped by who says it. Each line has an ID: save the take as `src/audio/voice/<id>.mp3` so it can be wired in later. Lines in *italics* are optional narration.

**How to record:** one take per file, a phone voice memo is fine. Quiet room, about 20 cm from the mic. Leave half a second of silence before and after; we trim it. Say the line exactly as written: the subtitle shows the same words.

## Cast
| voice | who | direction |
|---|---|---|
| **Recruiter** | Aegis agency man behind the desk | Smooth, polite, quietly threatening. A salesman who knows he's won. |
| **Mateo** | The donor, locked in the clinic | Young, scared, but thinking clearly. Low voice, almost to himself. |
| **Detective** | Investigator reading the clues 12 hours later | Calm, dry, noir. Short sentences, like notes spoken aloud. |
| **Dispatcher** | Harbour radio operator | Clipped and official, as if through a radio (we add the radio effect). |
| **Advocate** | Mateo's patient advocate, on the radio | Warm, urgent, relieved. |
| *Narrator* | *Optional: the stage directions in the opening scene* | *Neutral, quiet storyteller.* |

## 1. Opening: the rigged contract (Recruiter, Mateo)
| id | who | line |
|---|---|---|
| `recruiter-01` | Recruiter | "Your overseas lab placement was canceled, Mateo. Which leaves the fourteen thousand five hundred dollar processing and medical screening bond you owe Aegis." |
| `recruiter-02` | Recruiter | "Walk out with what papers?" *(after Mateo demands his passport)* |
| `recruiter-03` | Recruiter | "One voluntary kidney donation clears your debt tonight." *(after Mateo offers to work it off)* |
| `mateo-01` | Mateo | "Demand your passport." → record as: "I want my passport back." |
| `mateo-02` | Mateo | "Offer to work it off." → record as: "Let me work it off." |
| `mateo-03` | Mateo | "Push the paper away." → record as: "No. I'm not signing that." |
| `mateo-04` | Mateo | *(choice: sign and snap the nib; no line, record a sharp breath)* |
| *`narr-01`* | *Narrator* | *"He locks your passport in the desk drawer. He pushes a medical affidavit across the blotter."* |
| *`narr-02`* | *Narrator* | *"He slides a medical affidavit across the blotter."* |
| *`narr-03`* | *Narrator* | *"The guard takes your wrist. Your thumb leaves a print on the affidavit as the recruiter drags the nib across the blotter."* |
| *`narr-04`* | *Narrator* | *"The nib breaks under your hand. It cuts a groove through the paper into the desk blotter. A mark someone might find."* |
| *`narr-05`* | *Narrator* | *"The two men leave. The lock clicks."* |

The three choice buttons don't have spoken lines in the game yet; `mateo-01` to `-03` give him a voice when you pick one.

## 2. Mateo, locked in
| id | line | when |
|---|---|---|
| `mateo-05` | "The only way out is the window." | The lock clicks behind him |
| `mateo-06` | "Six inches of tinted glass. Nobody knows. I have to leave a trail they can't ignore." | Third time he pounds the window |
| `mateo-07` | "Let them find the time it happened." | He sets the pocket watch |
| `mateo-08` | "Across the road, people stop and look in." | Tint peeled off the window |
| `mateo-09` | "Now hide it." | Receipt embossed |
| `mateo-10` | "Proof they took my passport." | Receipt hidden *(game text says "his"; first person for his voice)* |
| `mateo-11` | "The street only sees its reflection." | Finds the one-way glass |
| `mateo-12` | "Out of reach of a broom." | Hides the closet key |
| `mateo-13` | "A number worth keeping." | Pockets the advocate's card |
| `mateo-14` | "Wedged in the printer frame." | Plants the card |
| `mateo-15` | "I do not consent." | Writes the real signature |
| `mateo-16` | "The hours slip by." | Winds the watch forward |
| `mateo-17` | *(hurt: a pained gasp, 2–3 takes)* | Caught by the guard |

## 3. Detective, 12 hours later
| id | line | when |
|---|---|---|
| `det-01` | "Twelve hours later. Read what Mateo left behind." | Start of the investigation |
| `det-02` | "A nib scratch." | Case 1 begins (the mark remembers) |
| `det-03` | "A sedative stain." | Case 2 begins |
| `det-04` | "A ribbon impression." | Case 3 begins |
| `det-05` | "It fits the copying board." | Finds the carbon paper |
| `det-06` | "Same agency stamp on the ad and the receipt. A G seventeen." | Copying board lines up |
| `det-07` | "Four thousand a month. Same account buys kidneys." | The job ad |
| `det-08` | "Pressed into the pad. Four. Zero. Nine." | File number found |
| `det-09` | "Same file number as the receipt." | Drawer unlocks |
| `det-10` | "File four-oh-nine ties the job offer to the passport." | Case 1 closed |
| `det-11` | "Still looped round the Pier nine cooler." | Seal K7 found |
| `det-12` | "K seven. Pier nine. Out at twelve forty." | Gate ticket |
| `det-13` | "Pier nine cold storage." | Old stencil on the cooler |
| `det-14` | "The closet key. Under the radiator." | A glint |
| `det-15` | "Right where Mateo hid it." | Closet key recovered |
| `det-16` | "A courier manifest. Pier nine." | Closet opens |
| `det-17` | "Seal K seven matches the Pier nine gate ticket." | Case 2 closed |
| `det-18` | "Six-forty kilohertz. Harbour service." | Advocate's frequency on the roster |
| `det-19` | "Saint Jude Maritime. Suite B. Four a.m." | Ribbon imprint |
| `det-20` | "The lab door is wired to the recruitment terminal." | Reaching the lab door |
| `det-21` | "The records are safe. The keypad still needs the code." | Records secured at the terminal |
| `det-22` | "Mateo's file is still marked for surgery." | Lab gate |
| `det-23` | "The dispatch key. Now the ham radio." | Glass case opened |
| `det-24` | "The advocate confirms Suite B, four a.m." | Case 3 closed |
| `det-25` | "The current file has been reopened at the desk." | Retry after being caught |
| `det-26` | "There it is." | A puzzle reveals its clue |
| `det-27` | "Take the key." | Key comes free |
| `det-28` | "It's open." | Drawer opens |

## 4. Radio
| id | who | line |
|---|---|---|
| `dispatch-01` | Dispatcher | "Harbour dispatch. Suite B, Saint Jude. We're moving." |
| `advocate-01` | Advocate | "Suite B. Four o'clock." |
| `dispatch-02` | Dispatcher | "Suite B. We have him." *(the ending, 3:54 a.m.)* |

## 5. Optional: room objects (Detective)
What the detective says when examining the 12 props. Record if you want every object voiced.

| id | object | line |
|---|---|---|
| `obj-cabinet` | Archive cabinet | "Twelve files, all cancelled the same afternoon as Mateo's." |
| `obj-shelf` | Records shelf | "'Generous compensation for a life-changing gift.' No hospital named." |
| `obj-bin` | Wastepaper basket | "A telegram. 'Buyer lands Thursday. Match must be ready.'" |
| `obj-coats` | Coat rack | "A one-way ferry stub from Pier nine, punched for midnight." |
| `obj-bench` | Waiting bench | "A child's drawing of a boat. Signed 'for papa'." |
| `obj-records` | Patient records | "Blood types and tissue panels. No names, no next of kin." |
| `obj-typewriter` | Typist's desk | "'Dear family, Mateo is very happy. Please do not visit.'" |
| `obj-safe` | Office safe | "Scratched by the dial. Fourteen five hundred, times twelve." |
| `obj-gurney` | Examination gurney | "A wristband. Patient four-oh-nine. Do not discharge." |
| `obj-medcab` | Medicine cabinet | "Sedatives logged by the case. Last night's line is initialled by the guard." |
| `obj-notices` | Notice board | "'Couriers use the rear corridor after eleven.' And a torn missing-person poster." |
| `obj-poster` | Wanted poster | "Wanted for questioning. Last seen at the Oak Hackathon. Approach with snacks." |

**Count:** 51 core lines (Mateo 17, Detective 28, Recruiter 3, radio 3), plus 5 optional narration lines and 12 optional object lines. Numbers are written out the way they should be spoken; the subtitles still show the digits.
