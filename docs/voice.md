# Talking to the bots

He scrapped recorded voices for the whole game (2026-11-03): bots and casters write in chat, and what matters most is bots
understanding him and answering. Don't bring voices back unless he asks. The recordings are in git history before that date.

- **Lines:** `shared/comms.js` (`LINES`, `CAST`, picked by `compose`; each person has favourites, recent lines don't repeat).
- **Understanding:** `shared/commands.js` `parseCommand` turns a sentence into an intent, who it's for (a name, an operator's name, "everyone") and a room or enemy. `COMMAND_WORDS` is what the microphone listens for. To teach a new phrase, add it to the regexes and to `T` in `tests/comms.js`.
- **Acting:** `botHear` in `server/bots.js` is called for every team chat from a person, typed or spoken, replies after a short delay (`game.replyQ`, `flushReplies`) and gives orders (`ai.cmd`: follow, hold, goto; run by `botCmd`). Told during prep, an attacker does it when the round starts. Typed sentences it doesn't understand get no reply; on the mic a bot says it didn't catch that.
- **Rules for talking** (`talk`, `talkAllowed`): 12 s per bot, 5 s per team, except what can't wait. Clutch: nobody talks. A call for quiet holds non-contact lines. Copper/Bronze use `FUN` lines. Direct answers ignore these limits.

## Microphone (`public/js/ptt.js`)
Offline recogniser vosk-browser with the small English model, listening for single words in any order (`grammar`): the command words plus this map's rooms and people's names. He said it only caught him close to the mic, so: the browser's noise filter is off (it treats distant voices as noise), `levelUp` lifts quiet speech to a steady level, a new press starts from the last press's level, the moment before and after the key is kept, and `askFinal` waits for the recogniser to catch up so words don't land in the next sentence. Settings → Sound → Microphone boost multiplies it. Browsers only allow a microphone on localhost or https, so people joining over a plain http address get "no microphone".

Testing without a person: synthetic speech was run through `pttTest(samples, rate, { raw, grammar })` in hidden Firefox at chosen volumes (the clips were not kept in the repo). Synthetic speech shows the effect of volume, not how well it knows his own voice, so he has the last word.

## Mic test results (2026-11-03)
Whole sentences (`micPhrases`, the default, about 2000 on Harbor) with synthetic speech, 4 voices, 46 sentences, scored by whether the sentence means the same to `parseCommand`: 172/184 (93%). Before the last fixes: very low volume (-34 dB) 151/184, added noise 161/184. Loose words and free dictation were clearly worse. His real voice is still untested.
- The old low figures were mostly the test: answers slipped onto the next clip. `pttTest` now waits until the recogniser goes quiet.
- A pause gives an answer of its own, so the first result after the key is not the last: `settle` waits for quiet. The recogniser sometimes answers empty and keeps the words for next time: `settle` feeds a little quiet and asks once more. It still happens now and then (about 3%), and those words land in front of the next sentence.
- A second recogniser (`stale`, new match) hears fine.
- Words the model lacks: `SOUNDS` in shared/commands.js listens for a sound-alike and reads it back (defuser/diffuser, chonk/chunk); digits in room names are read as words.
- `/api/miclog` keeps the last 300 things heard (words and level, no sound) in `mic-log.txt` in the data folder: read it first when tuning to him.
Test clips: `/var/tmp/r62d-tts/mic` + `phrases.txt` (may be gone). To rerun, link the clips under `public/` for the test only and fetch them in hidden Firefox.

## His own voice (2026-11-03)
He read 18 orders at his normal distance (about 45 cm) into a temporary test page; the recordings were kept only for this and deleted. By meaning to `parseCommand`: 16/18 before, 18/18 after (same clips, so tuned on them; other sentences may do worse). What helped:
- `gateNext` in ptt.js: levelling lifted room noise between words until the recogniser heard words in it ("in someone in"). Sound not above `GATE` (3) × the room's noise (`noiseAt`, tracked while idle too) is turned down to 5%. 2 and 4.5 measured worse.
- More sentences in `SAY`/`AT` (it can only choose what it knows), "watch the stairs" means hold, "where are the" means enemies, "someone see" counts, "plant it" no longer matches the IT Room.
- First press lost words while the model loaded: `pttPreload` loads model and sentences at round start once `r62d-ptt-used` is set (no microphone opened).
To repeat: record raw Float32 clips, serve them with CORS, and in hidden Firefox `import('/js/ptt.js')`, `pttVocab(rooms, [], [])`, `pttTest(samples, rate, { fresh: true })`, score with `parseCommand`.
## Voice setup
`public/js/voicetest.js`, `openVoiceTest`: shown once (`r62d-voicetest`) ~0.9 s after the welcome in the lobby, not on touch, not without `navigator.mediaDevices`, not in TV/tutorial/free; again from Settings → Sound (`#voiceTestBtn`). Sets Microphone boost to 200 if the mic is very quiet.

## Blended speech and open mic (2026-11-03)
He speaks fast with a rural accent (north-western Maryland) and blends words. `micPhrases` also listens for each sentence without "the", with "go" for "go to the" and "they"/"you" for "are they"/"are you"; `parseCommand` reads those. Test voices sped up 1.4× barely suffer (89/92 before, 91/92 after), so they don't show blending: only his voice can.
Open mic: `setOpenMic(on, cb)` in ptt.js, handled in `micBlock` (one piece of mic sound; a test can call it directly because a hidden browser's AudioContext never runs). A sentence starts after 2 pieces above the gate, ends after ~0.7 s of quiet or 8 s. `syncOpenMic` in main.js turns it on only while `playing()`, not TV/tutorial/touch; sentences with no intent or room are dropped. Choice: `r62d-micmode`, Settings `#micSeg`.

## Save my voice (2026-11-04)
In a real match the small recogniser forces natural, longer speech onto its sentence list ("in can you dusty someone in to upper corridor"), while the voice test goes fine; volume is not the cause. Next step: compare stronger recognisers on his real speech. Settings → Sound → Save my voice (`#micSaveSeg`, `setMicClip`/`takeClip` in ptt.js, `saveClip` in main.js, localhost-only `/api/micclip`) keeps each sentence as raw Float32 in `$R62D_DATA/mic-clips` (`<time>-<rate>.f32`, the last 60) with what was heard in `heard.txt`. Off by default and at every start. **He agreed to one match and to deletion afterwards: delete `mic-clips` when done, never commit it.**
Paused 2026-11-04 (he said not now), before any stronger recogniser was tried. His match recordings are still in `$R62D_DATA/mic-clips` for when this resumes: delete them when it is finished or if he says so. Candidates: the larger Vosk model `vosk-model-en-us-0.22-lgraph` (data only, same code; ~128 MB). Whisper in the browser needs code from outside: the safety check refused it from a CDN, so it would need his say-so and vendoring.

## Second listener (2026-11-04)
Tried `vosk-model-en-us-0.22-lgraph` (130 MB) on his 9 saved match clips: free dictation heard about what the small model does (best: "i died from hallway"), but took 6-12 s for a 2-3 s clip, slower than he talks, so it is not in. Those clips showed the real fault: much of what he says in a match is not a sentence on the list ("one just kill me" came out as "one to scout me").
So the small model now runs twice (`free` in ptt.js): the sentence list, and free dictation on the same sound. `pickHeard` in shared/commands.js keeps the sentence if free heard nothing or at least half its main words sound alike (`heardAgree`, consonants compared), else the free words go to chat and the bots read those. `/api/miclog` logs both: read it after his next match.
On his clips: wrong order gone from "one to scout me", "it's argus" and "kids" now heard where the sentence list gave nothing. Test voices at real speed (`pttTest` `paced`), 46 clips: empty answers 7 vs 9 without it, same wait after speech (~1 s). That test still slips answers onto the next clip now and then, with or without it, so the counts are rough. Known overrules of a right sentence: "wait here" / "we're here", "revive me" / "the vibe me", "defuse it" / "if is it". `node tests/comms.js` has the cases.
He offered his graphics card (a stronger recogniser such as Whisper could run on it) and said to ask permission later: not tried. His clips stay in `$R62D_DATA/mic-clips` until he decides.
