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
