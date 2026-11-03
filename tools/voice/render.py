#!/usr/bin/env python3
# Records the lines listed by jobs.mjs: Piper (VCTK voices) -> Praat (livelier pitch) -> ffmpeg (game-chat sound, Opus).
# Usage: render.py <model.onnx> <jobs.jsonl> <out dir> <workers>. Skips what exists. See docs/voice.md.
import json, os, subprocess, sys, tempfile, wave, multiprocessing as mp
HERE = os.path.dirname(os.path.abspath(__file__))
CHAT = "highpass=f=220,lowpass=f=4300,equalizer=f=2200:t=q:w=1.2:g=3,acompressor=threshold=-20dB:ratio=3:attack=5:release=70:makeup=3,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,volume=0.45"
voice = None
def init(model):
    global voice, SC
    from piper import PiperVoice, SynthesisConfig as SC
    voice = PiperVoice.load(model)
def one(a):
    j, out = a
    dst = f"{out}/{j['v']}/{j['id']}.ogg"
    if os.path.exists(dst): return 0
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    sid = voice.config.speaker_id_map[j['v']]
    with tempfile.TemporaryDirectory() as d:
        r, m = d + '/r.wav', d + '/m.wav'
        with wave.open(r, 'wb') as w:
            voice.synthesize_wav(j['text'], w, syn_config=SC(speaker_id=sid, length_scale=j['ls'], noise_scale=0.667, noise_w_scale=0.5))
        p = subprocess.run(['praat', '--run', HERE + '/pitch.praat', r, m, str(j['k']), str(j['up'])], capture_output=True)
        src = m if os.path.exists(m) else r  # (a clip too short for pitch work stays as it is)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', CHAT, '-ar', '24000', '-ac', '1', '-c:a', 'libopus', '-b:a', '20k', '-application', 'voip', dst], check=True)
    return 1
if __name__ == '__main__':
    model, jobs, out, n = sys.argv[1:5]
    todo = [(json.loads(l), out) for l in open(jobs) if l.strip()]
    with mp.Pool(int(n), init, (model,)) as pool:
        done = 0
        for i, r in enumerate(pool.imap_unordered(one, todo, 8)):
            done += r
            if i % 500 == 0: print(i, '/', len(todo), flush=True)
    print('done', done, 'new of', len(todo))
