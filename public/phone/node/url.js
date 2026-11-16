// Node's url, for the phone (see fs.js)
export const fileURLToPath = u => new URL(String(u)).pathname;
export const pathToFileURL = p => new URL('file://' + p);
export default { fileURLToPath, pathToFileURL };
