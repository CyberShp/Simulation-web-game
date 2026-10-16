/** Load a release's byte-identical Godot pack from verified static parts. */
export function installScenePackLoader(engine, configuration, onProgress = () => {}) {
  const manifest = configuration.scenePack;
  if (!manifest) return;
  const preload = engine.preloadFile.bind(engine);
  engine.preloadFile = async (file, path) => {
    if (file !== configuration.mainPack) return preload(file, path);
    const pack = new Uint8Array(manifest.byteLength);
    let offset = 0;
    const digest = async data => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), byte => byte.toString(16).padStart(2, '0')).join('');
    for (const part of manifest.parts) {
      const response = await fetch(part.url);
      if (!response.ok) throw Error('山院画卷未能载入，请重试');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== part.byteLength || await digest(bytes) !== part.sha256) throw Error('山院画卷校验未通过，请刷新重试');
      pack.set(bytes, offset);
      offset += bytes.byteLength;
      onProgress(offset, manifest.byteLength);
    }
    if (offset !== manifest.byteLength || await digest(pack) !== manifest.sha256) throw Error('山院画卷尚未完整载入，请重试');
    return preload(pack.buffer, path || file);
  };
}
