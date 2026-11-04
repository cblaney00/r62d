# Voice (scrapped)

He tried talking to the bots through several rounds and decided on 2026-11-04 to scrap it: "good try but it's just too much". The microphone, recogniser (vosk-browser and its 41 MB model), voice setup, open mic and recorded bot voices are all gone. The code is in git history before that date. Don't bring it back unless he asks.

What was learned, in case he ever does:
- A recogniser limited to a sentence list forces natural speech onto its nearest sentence ("one just killed me" became "one to scout me"). Free dictation with the small Vosk model wrote his words nearly perfectly when he sat close.
- Further from his mic (JOUNIVO JV603) it still got much worse, and the larger Vosk lgraph model was slower than he talks, so it did not help. Whisper on his RTX 3060 was never tried.

Bots still understand team chat: `shared/commands.js`, `botHear` in server/bots.js. Lines they write: `shared/comms.js`. Teaching a new phrase: add it to the regexes and to `T` in `tests/comms.js`. Natural orders it still has no meaning for: "everybody go left", "run forward".
