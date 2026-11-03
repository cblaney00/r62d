# Voices

Everything bots and casters say is in `shared/comms.js` (`LINES`, `CAST`). The server picks a line with `compose` and sends
its clip ids with the chat message (`vo`); `public/js/voice.js` plays them (one person at a time, stale lines dropped).

## Sound he approved (fourth sample, 2026-11-03)
Piper + the VCTK voice model, then Praat to widen the pitch (overlap-add, stylized pitch: no buzz), then ffmpeg for the
game-chat sound. Tried and refused: Kokoro ("way too old and even more robotic"); WORLD vocoder ("jacket zipper");
high `noise_w` ("lag on certain words"). Kept low level: he said too loud twice.

## Recording again (after changing a line)
Tools are not installed on the machine; use a temporary nix shell. The model is about 77 MB and not kept in the repo:
`https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/vctk/medium/en_GB-vctk-medium.onnx` (and `.onnx.json` beside it).

    node tools/voice/jobs.mjs > jobs.jsonl
    nix shell nixpkgs#praat nixpkgs#ffmpeg --command <python with piper-tts> tools/voice/render.py model.onnx jobs.jsonl public/voice 8

`piper-tts` is not a Python package in nixpkgs: run python3 with `PYTHONPATH` made of every `site-packages` in the closure of
`nixpkgs#piper-tts`. Existing clips are skipped, and clip names come from the words and tone, so a changed line is only a new clip
(delete clips no longer listed). VCTK has no speakers under 18; ages are about 18-33.

## Rules for talking (`talk`, `talkAllowed` in server/bots.js)
Not constant: 12 s per bot, 5 s per team, except what can't wait. Clutch (one alive on the team): nobody talks, and the dead
stay silent after their last call. `hush` lines hold the team (not contact calls), and they walk. Copper/Bronze use `FUN` lines.

## Push to talk (`public/js/ptt.js`, `pttAsk` in bots.js)
Offline recogniser vosk-browser with the small English model, limited to the phrases in `PTT_PHRASES`. Loaded on first press.
Browsers only allow a microphone on localhost or https, so people joining over a plain http address get "no microphone".

## Next recording: Chatterbox (he allowed a newer engine, 2026-11-03; not recorded or heard by him yet)
Chatterbox Turbo on the graphics card: about 2.5x faster than real time, 3 GB of its memory. Installed in `/var/tmp/r62d-tts` (venv, `env.sh`, models in `hf/`, about 10 GB; may be cleared, then reinstall with pip on nixpkgs python311). It speaks from short real samples: `refs.py` fetches VCTK clips (CC-BY, credit in docs/credits.md if used) through the Hugging Face dataset viewer. VCTK starts at 18, so ages are about 18-32, not 16.
Plan: play him a sample first. Then record whole lines where a slot has few values (names, teams) and put every other slot at a comma, so joins sound natural and no fragment begins with "'s". Add many more lines per call.
