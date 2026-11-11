// Imported first by every test that loads the game server: point saved data at a throwaway folder,
// so tests never touch the real profiles and match history in data/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.R62D_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'r62d-test-'));
if (process.env.R62D_TEST_TRAINING) fs.copyFileSync(process.env.R62D_TEST_TRAINING, path.join(process.env.R62D_DATA, 'pro-training.json')); // a copy of real pro practice, to test with trained pros
