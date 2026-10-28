// Imported first by every test that loads the game server: point saved data at a throwaway folder,
// so tests never touch the real profiles and match history in data/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.R62D_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'r62d-test-'));
