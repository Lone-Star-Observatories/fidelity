// Same lossless decoder in the browser preview and packaging verification.
export async function decodeSnapshot(packed) {
  const bytes = Uint8Array.from(atob(packed), character => character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
