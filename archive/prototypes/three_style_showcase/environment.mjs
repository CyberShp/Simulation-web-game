/** Yunxiu courtyard slice, metres, Y up. Lighting and camera belong to the host. */
export async function buildEnvironment(THREE, scene, {loader, pixel = false} = {}) {
  if (!loader?.loadAsync) throw new Error('buildEnvironment requires a GLTFLoader');
  const asset = path => new URL(`./assets/${path}`, import.meta.url).href;
  const root = new THREE.Group();
  root.name = 'YunxiuMountainCourtyard';
  const random = seeded(126047);
  const textureLoader = new THREE.TextureLoader();
  const texture = async (file, color = false, repeat = 1) => {
    const map = await textureLoader.loadAsync(asset(`surfaces/${file}.jpg`));
    map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeat, repeat);
    map.anisotropy = 8;
    return map;
  };
  const [hall, pine, cliff, boulder,
    pathColor, pathNormal, pathRough, earthColor, earthNormal, earthRough] = await Promise.all([
    loader.loadAsync(asset('hall.glb')),
    loader.loadAsync(asset('nature/pine.glb')),
    loader.loadAsync(asset('nature/rock-face.glb')),
    loader.loadAsync(asset('nature/boulder.glb')),
    texture('paving-color', true), texture('paving-normal'), texture('paving-roughness'),
    texture('forest-color', true), texture('forest-normal'), texture('forest-roughness'),
  ]);
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.82, metalness: 0, ...extra});
  const materials = {
    limestone: mat(0xaaa996), darkStone: mat(0x535c58), trimStone: mat(0xb5b5a5),
    wood: mat(0x3b2216), edgeWood: mat(0x705034), roof: mat(0x25383d, {roughness: 0.67, side: THREE.DoubleSide}),
    ridge: mat(0x526564), brass: mat(0x917443, {metalness: 0.65, roughness: 0.43}),
    red: mat(0x613024), pineNeedles: mat(0x4c5136), moss: mat(0x536144),
    paper: mat(0xe7c682, {emissive: 0xffab38, emissiveIntensity: 0.7}),
  };
  const floorMaterial = mat(0xb6c0bb, {map: pathColor, normalMap: pathNormal, roughnessMap: pathRough,
    normalScale: new THREE.Vector2(0.50, 0.50), roughness: 0.93});
  const pathMaterial = mat(0xa1a899, {map: pathColor, normalMap: pathNormal, roughnessMap: pathRough,
    normalScale: new THREE.Vector2(0.65, 0.65), roughness: 0.95});
  const earthMaterial = mat(0x91917b, {map: earthColor, normalMap: earthNormal, roughnessMap: earthRough,
    normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1});
  // Distant ridges use broad mineral colour; the scanned atlas remains on its source rock geometry.
  const mountainMaterial = mat(0x667d78, {roughness: 1.0});

  const box = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const roof = roofGeometry(THREE);
  const batches = new Map();
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  function instance(name, geometry, material, position, size = [1, 1, 1], yaw = 0, tint = null) {
    if (!batches.has(name)) batches.set(name, {geometry, material, matrices: [], colors: []});
    transform.position.set(...position);
    transform.scale.set(...size);
    transform.rotation.set(0, yaw, 0);
    transform.updateMatrix();
    batches.get(name).matrices.push(transform.matrix.clone());
    batches.get(name).colors.push(tint ?? 0xffffff);
  }
  const block = (material, position, size, yaw = 0, tint = null) =>
    instance(`block-${material}`, box, materials[material], position, size, yaw, tint);
  const pole = (material, position, radius, height) =>
    instance(`pole-${material}`, cylinder, materials[material], position, [radius * 2, height, radius * 2]);
  function beam(a, b, radius, material) {
    const pa = new THREE.Vector3(...a), pb = new THREE.Vector3(...b);
    const d = pb.clone().sub(pa);
    transform.position.copy(pa).add(pb).multiplyScalar(0.5);
    transform.scale.set(radius * 2, d.length(), radius * 2);
    transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    transform.updateMatrix();
    const key = `pole-${material}`;
    if (!batches.has(key)) batches.set(key, {geometry: cylinder, material: materials[material], matrices: [], colors: []});
    batches.get(key).matrices.push(transform.matrix.clone());
    batches.get(key).colors.push(0xffffff);
  }
  function roofAt(position, size, yaw = 0) {
    instance('curved-roofs', roof, materials.roof, position, size, yaw);
  }
  function lantern(x, y, z, scale = 1) {
    block('paper', [x, y, z], [0.48 * scale, 0.66 * scale, 0.48 * scale]);
    for (const dx of [-0.28, 0.28]) for (const dz of [-0.28, 0.28]) {
      block('wood', [x + dx * scale, y, z + dz * scale], [0.065 * scale, 0.78 * scale, 0.065 * scale]);
    }
    for (const dy of [-0.40, 0.40]) block('edgeWood', [x, y + dy * scale, z], [0.7 * scale, 0.10 * scale, 0.7 * scale]);
    roofAt([x, y + 0.42 * scale, z], [0.98 * scale, 0.36 * scale, 0.98 * scale]);
    pole('brass', [x, y + 0.83 * scale, z], 0.055 * scale, 0.15 * scale);
  }
  function stoneLantern(x, z, scale = 1) {
    block('darkStone', [x, 0.18 * scale, z], [0.94 * scale, 0.36 * scale, 0.94 * scale]);
    block('limestone', [x, 1.04 * scale, z], [0.42 * scale, 1.52 * scale, 0.42 * scale]);
    block('trimStone', [x, 1.76 * scale, z], [0.84 * scale, 0.22 * scale, 0.84 * scale]);
    lantern(x, 2.20 * scale, z, scale);
  }
  function railing(a, b) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const count = Math.ceil(start.distanceTo(end) / 2.35);
    for (let i = 0; i <= count; i++) {
      const p = start.clone().lerp(end, i / count);
      block('limestone', [p.x, p.y + 0.70, p.z], [0.28, 1.4, 0.28]);
      block('trimStone', [p.x, p.y + 1.43, p.z], [0.40, 0.15, 0.40]);
    }
    for (const height of [0.48, 1.05]) beam([a[0], a[1] + height, a[2]], [b[0], b[1] + height, b[2]], 0.072, 'trimStone');
  }

  // Continuous ground, carved riverbed and rising wooded slopes.
  const terrain = new THREE.PlaneGeometry(190, 320, 126, 160);
  terrain.rotateX(-Math.PI / 2);
  const vertices = terrain.attributes.position;
  const terrainUV = terrain.attributes.uv;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i) - 60;
    vertices.setXYZ(i, x, terrainHeight(x, z), z);
    terrainUV.setXY(i, x / 7, z / 7);
  }
  terrain.computeVertexNormals();
  const land = new THREE.Mesh(terrain, earthMaterial);
  land.name = 'ContinuousWoodlandTerrain';
  land.receiveShadow = true;
  root.add(land);

  // The main paving is a stone surface with metre-scaled scanned joints.
  block('darkStone', [0, -0.18, 14], [44.7, 0.50, 53]);
  const court = plane(THREE, 44, 52, 0, 0.108, 14, floorMaterial, 8.8, 10.4);
  court.name = 'LimestoneForecourt';
  root.add(court);
  for (const x of [-22.1, 22.1]) for (let z = -12; z <= 40; z += 2) {
    block('trimStone', [x, 0.065, z], [0.42, 0.24, 1.96]);
  }
  for (const z of [-12.1, 40.1]) for (let x = -22; x <= 22; x += 2) {
    block('trimStone', [x, 0.065, z], [1.96, 0.24, 0.42]);
  }
  root.add(plane(THREE, 7.0, 29, 0, 0.018, 55, pathMaterial, 1.7, 7.25));
  root.add(plane(THREE, 11.0, 6, 27.5, 0.018, 10, pathMaterial, 2.75, 1.5));

  // Reuse the sealed, detailed native hall with distinct roof/wood/stone response.
  for (const config of [
    {name: 'MainHall', position: [0, 0.10, -24], scale: 2, yaw: 0},
    {name: 'WestResidence', position: [-23, 0.10, -6], scale: 0.95, yaw: Math.PI / 2},
    {name: 'EastAlchemyHall', position: [23, 0.10, -6], scale: 0.95, yaw: -Math.PI / 2},
  ]) {
    const model = hall.scene.clone(true);
    model.name = config.name;
    model.position.set(...config.position);
    model.scale.setScalar(config.scale);
    model.rotation.y = config.yaw;
    model.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = node.receiveShadow = true;
      const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
      const refined = sourceMaterials.map(original => {
        const material = original.clone();
        const label = material.name.toLowerCase();
        material.roughness = 0.83;
        if (/tile|ridge/.test(label)) {
          material.color.set(0x78909a);
          material.roughness = 0.66;
        } else if (/timber|cedar/.test(label)) {
          material.color.set(0xc5ac8e);
          material.roughness = 0.75;
        } else if (/stone/.test(label)) {
          material.color.set(0xc4c8bf);
          material.roughness = 0.94;
        } else if (/brass/.test(label)) {
          material.metalness = 0.7;
          material.roughness = 0.4;
        }
        return material;
      });
      node.material = Array.isArray(node.material) ? refined : refined[0];
    });
    root.add(model);
  }
  for (const x of [-12.7, 12.7]) stoneLantern(x, -12.3, 1.4);
  for (const x of [-17.5, 17.5]) stoneLantern(x, -0.5, 1.0);

  // Roofed colonnades frame the arena without interrupting the approach to the bridge.
  for (const side of [-1, 1]) {
    const x = side * 24;
    const start = side < 0 ? 5 : 18, end = 35;
    block('darkStone', [x, -0.02, (start + end) / 2], [5.2, 0.40, end - start + 1.8]);
    root.add(plane(THREE, 5.0, end - start + 1.5, x, 0.19, (start + end) / 2, floorMaterial, 1.0, (end - start) / 5));
    roofAt([x, 4.65, (start + end) / 2], [end - start + 3.5, 1.4, 6.0], Math.PI / 2);
    block('ridge', [x, 6.10, (start + end) / 2], [0.24, 0.22, end - start + 3.7]);
    for (const edge of [-1, 1]) {
      block('edgeWood', [x + edge * 2.18, 4.40, (start + end) / 2], [0.26, 0.30, end - start + 0.8]);
    }
    for (let z = start; z <= end + 0.1; z += 3.75) {
      for (const edge of [-1, 1]) {
        block('trimStone', [x + edge * 2.08, 0.40, z], [0.63, 0.45, 0.63]);
        pole('wood', [x + edge * 2.08, 2.45, z], 0.19, 3.86);
        block('edgeWood', [x + edge * 2.08, 4.1, z], [0.72, 0.24, 0.48]);
        beam([x + edge * 2.08, 3.76, z], [x + edge * 1.4, 4.28, z], 0.075, 'wood');
      }
      block('wood', [x, 4.25, z], [4.55, 0.22, 0.22]);
      lantern(x, 3.75, z, 0.65);
    }
    railing([x + side * 2.25, 0.2, start], [x + side * 2.25, 0.2, end]);
    // Tile courses and eave ends are repeated geometry, batched across both corridors.
    for (let z = start - 1.6; z < end + 1.6; z += 0.31) {
      for (const edge of [-1, 1]) beam([x + edge * 0.08, 6.06, z], [x + edge * 2.95, 5.00, z], 0.027, 'ridge');
    }
  }

  // A timber mountain gate and carved stone side rails close the foreground.
  for (const x of [-5.8, 5.8]) {
    block('limestone', [x, 0.38, 44], [1.05, 0.75, 1.05]);
    pole('red', [x, 3.5, 44], 0.31, 5.7);
    block('edgeWood', [x, 6.2, 44], [1.2, 0.36, 0.8]);
    lantern(x * 0.87, 5.55, 44.8, 0.95);
  }
  block('wood', [0, 6.12, 44], [13.0, 0.6, 0.6]);
  roofAt([0, 6.4, 44], [14.5, 1.7, 4.3]);
  block('ridge', [0, 8.13, 44], [14.4, 0.20, 0.20]);
  block('wood', [0, 5.62, 44.38], [3.2, 1.1, 0.22]);
  for (const dy of [-0.47, 0.47]) block('brass', [0, 5.62 + dy, 44.51], [3.0, 0.045, 0.025]);
  for (const x of [-0.8, 0, 0.8]) {
    for (const dx of [-0.15, 0, 0.15]) block('brass', [x + dx, 5.64, 44.53], [0.052, dx === 0 ? 0.47 : 0.31, 0.03]);
    block('brass', [x, 5.42, 44.53], [0.42, 0.05, 0.03]);
  }
  for (const side of [-1, 1]) {
    railing([side * 7.5, 0, 41.5], [side * 21.5, 0, 41.5]);
    stoneLantern(side * 8.4, 46, 1.25);
  }

  const water = riverMesh(THREE);
  water.name = 'JadeRiver';
  root.add(water);
  // Individual stone segments describe a shallow arch, with an open span above water.
  for (let i = 0; i <= 16; i++) {
    const x = 26 + i, rise = Math.sin(i / 16 * Math.PI) * 1.06;
    block('limestone', [x, rise - 0.20, 10], [0.98, 0.56, 5.8]);
    block('trimStone', [x, rise + 0.12, 10], [0.98, 0.10, 5.6]);
    if (i % 2 === 0) for (const side of [-1, 1]) {
      block('limestone', [x, rise + 0.82, 10 + side * 2.68], [0.32, 1.36, 0.32]);
      block('trimStone', [x, rise + 1.52, 10 + side * 2.68], [0.42, 0.16, 0.42]);
    }
    if (i < 16) for (const side of [-1, 1]) for (const h of [0.55, 1.24]) {
      beam([x, rise + h, 10 + side * 2.68], [x + 1, Math.sin((i + 1) / 16 * Math.PI) * 1.06 + h, 10 + side * 2.68], 0.075, 'trimStone');
    }
  }
  for (const x of [27, 41]) {
    block('darkStone', [x, -1.0, 10], [2.0, 2.0, 5.3]);
    for (const z of [6.5, 13.5]) stoneLantern(x, z, 0.85);
  }

  // Native scanned geometry, one instanced draw per source mesh/material.
  const treePlacements = [];
  const addTree = (x, z, height) => treePlacements.push({p: [x, terrainHeight(x, z) - 0.04, z],
    scale: [height / 6.81834, height / 6.81834, height / 6.81834], yaw: random() * Math.PI * 2});
  for (const [x, z, h] of [[-34, 20, 14], [-34, -10, 16], [-21, -35, 15], [20, -37, 17],
    [-31, 44, 13], [46, -13, 17], [49, 22, 16], [44, -32, 14], [-42, -31, 18]]) addTree(x, z, h);
  for (let i = 0; i < 27; i++) {
    const side = i % 2 ? 1 : -1;
    const x = i < 8 ? -34 + i * 10 : side * (43 + random() * 27);
    const z = i < 8 ? -47 - random() * 12 : -62 + random() * 83;
    addTree(x, z, 12 + random() * 10);
  }
  addModelInstances(THREE, root, pine.scene, treePlacements, 'ScannedPine', {colorVariation: 0.05, random});
  const rockPlacements = [], cliffPlacements = [];
  for (const side of [-1, 1]) for (let i = 0; i < 20; i++) {
    const z = -57 + i * 5.9;
    if (z > 4 && z < 16) continue;
    const x = riverCenter(z) + side * (6.2 + random() * 0.8);
    const s = 1.2 + random() * 0.7;
    rockPlacements.push({p: [x, -1.8, z + random() * 1.5 - 0.75], scale: [s * 2.3, s * 1.9, s * 2],
      yaw: random() * 6.28, pitch: (random() - 0.5) * 0.35, roll: (random() - 0.5) * 0.25});
  }
  for (const [x, z, s] of [[-32, 27, 3], [-32, -15, 3.5], [-17, -35, 3.0], [16, -37, 2.8],
    [44, 27, 3.1], [-28, 48, 3.0], [18, 51, 2.2], [47, -27, 2.7], [-42, 1, 4.0]]) {
    rockPlacements.push({p: [x, terrainHeight(x, z) - 0.2, z], scale: [s, s, s], yaw: random() * 6.28});
    rockPlacements.push({p: [x + 3, terrainHeight(x + 3, z + 1) - 0.15, z + 1], scale: [s * 0.48, s * 0.48, s * 0.48], yaw: random() * 6.28});
  }
  // Scanned outcrops stay embedded in the near terrace; distant geology is continuous.
  for (let i = 0; i < 8; i++) {
    const z = -20 + i * 10;
    cliffPlacements.push({p: [-44 - random() * 2, -7, z], scale: [2.8, 3.2, 2.8], yaw: random() * 6.28});
  }
  addModelInstances(THREE, root, cliff.scene, cliffPlacements, 'ScannedCliff', {colorVariation: 0.06, random});
  addModelInstances(THREE, root, boulder.scene, rockPlacements, 'ScannedBoulder', {colorVariation: 0.08, random});

  // Long, rounded ridge profiles overlap behind the scanned foreground cliffs.
  for (let band = 0; band < 3; band++) {
    const geometry = ridgeGeometry(THREE, band);
    const material = mountainMaterial.clone();
    if (band > 0) material.color.lerp(new THREE.Color(0xb0c2bd), band * 0.30);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `DistantRidge${band}`;
    mesh.receiveShadow = true;
    mesh.castShadow = band === 0;
    root.add(mesh);
  }

  // Pine needles, narrow grass and moss at the perimeter avoid a bare rectangular cutout.
  const grassGeometry = grassClumpGeometry(THREE);
  const needleGeometry = new THREE.BoxGeometry(0.018, 0.008, 0.20);
  for (let i = 0; i < 250; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (27 + random() * 8), z = -36 + random() * 88;
    if (x > 0 && z > 3 && z < 17) continue;
    instance('grass-tufts', grassGeometry, materials.moss, [x, terrainHeight(x, z), z],
      [0.65 + random() * 0.7, 0.65 + random() * 0.8, 0.65 + random() * 0.7], random() * 6.28);
  }
  for (let i = 0; i < 250; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (20.3 + random() * 1.1), z = -10 + random() * 49;
    instance('scattered-pine-needles', needleGeometry, materials.pineNeedles, [x, 0.091, z], [1, 1, 1], random() * 6.28);
  }

  for (const [name, batch] of batches) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    mesh.name = name;
    batch.matrices.forEach((matrix, i) => {
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(batch.colors[i]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = !/needles|grass/.test(name);
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
  root.userData.environmentStats = {
    trees: treePlacements.length, cliffs: cliffPlacements.length, boulders: rockPlacements.length,
    primitiveBatches: batches.size, pixel,
  };
  scene.add(root);
  return {
    root,
    bounds: new THREE.Box3(new THREE.Vector3(-90, -4, -117), new THREE.Vector3(90, 70, 87)),
    landmarks: {
      hall: new THREE.Vector3(0, 0.12, -24), hallStairs: new THREE.Vector3(0, 0.12, -13),
      battle: new THREE.Vector3(0, 0.12, 14), walkStart: new THREE.Vector3(-12, 0.12, 24),
      walkEnd: new THREE.Vector3(0, 0.12, 12), gate: new THREE.Vector3(0, 0.12, 44),
      bridge: new THREE.Vector3(34, 1.2, 10), river: new THREE.Vector3(35, -1.2, 0),
    },
    update(time, daylight = 1) {
      water.material.userData.uniforms.time.value = time;
      materials.paper.emissiveIntensity = 0.65 + (1 - Math.max(0, Math.min(1, daylight))) * 2.0;
    },
  };
}

function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

function riverCenter(z) { return 35 + Math.sin(z * 0.032) * 2.2; }

function terrainHeight(x, z) {
  const channel = Math.abs(x - riverCenter(z));
  const rear = Math.max(0, -z - 38), west = Math.max(0, -x - 32);
  const slope = Math.min(15, rear * 0.18) + Math.min(11, west * 0.24);
  const bumps = Math.sin(x * 0.12 + z * 0.095) * 0.75 + Math.sin(x * 0.26 - z * 0.14) * 0.22;
  const flatBlend = Math.min(1, Math.max(0, (Math.abs(x) - 29) / 6) + Math.max(0, (-z - 39) / 8));
  const ground = Math.abs(x) < 29 && z > -39 && z < 49 ? -0.20 : -0.25 + slope + bumps * flatBlend;
  const bank = Math.max(0, Math.min(1, (channel - 4.7) / 4.0));
  const smoothBank = bank * bank * (3 - 2 * bank);
  return -3.2 + (ground + 3.2) * smoothBank;
}

function plane(THREE, width, depth, x, y, z, material, uvX = 1, uvZ = 1) {
  const geometry = new THREE.PlaneGeometry(width, depth);
  geometry.rotateX(-Math.PI / 2);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvX, uv.getY(i) * uvZ);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

function roofGeometry(THREE) {
  const positions = [], uvs = [], indices = [];
  const nx = 30, nz = 12;
  for (const side of [-1, 1]) {
    const start = positions.length / 3;
    for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
      const x = ix / nx - 0.5, t = iz / nz;
      const y = 1 - 0.94 * Math.pow(t, 0.72) + 0.18 * Math.pow(t, 7) + 0.15 * Math.pow(Math.abs(x) * 2, 6) * t;
      positions.push(x, y, side * t * 0.5);
      uvs.push(ix / nx, iz / nz);
    }
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const a = start + iz * (nx + 1) + ix, b = a + 1, c = a + nx + 1, d = c + 1;
      indices.push(...(side > 0 ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addModelInstances(THREE, root, source, placements, name, {colorVariation = 0, random = Math.random} = {}) {
  source.updateMatrixWorld(true);
  source.traverse(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld);
    const material = Array.isArray(node.material) ? node.material.map(m => m.clone()) : node.material.clone();
    for (const m of Array.isArray(material) ? material : [material]) {
      m.roughness = Math.max(0.78, m.roughness ?? 0.8);
      if (m.map) m.map.anisotropy = 8;
    }
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
    mesh.name = `${name}-${node.name}`;
    const transform = new THREE.Object3D();
    placements.forEach((placement, i) => {
      transform.position.set(...placement.p);
      transform.scale.set(...placement.scale);
      transform.rotation.set(placement.pitch ?? 0, placement.yaw, placement.roll ?? 0);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
      const variation = 1 - colorVariation + random() * colorVariation * 2;
      mesh.setColorAt(i, new THREE.Color().setRGB(variation, variation, variation));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
  });
}

function ridgeGeometry(THREE, band) {
  const width = 240 + band * 60, depth = 58 + band * 14;
  const geometry = new THREE.PlaneGeometry(width, depth, 100, 34);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), localZ = positions.getZ(i);
    const fraction = (localZ + depth / 2) / depth;
    const ridgeProfile = Math.pow(Math.max(0, Math.sin(fraction * Math.PI)), 0.67);
    const broad = 20 + band * 9 + Math.sin(x * 0.045 + band * 1.7) * 6 + Math.cos(x * 0.089 - band) * 4;
    const shoulders = Math.sin(x * 0.19 + fraction * 2.8) * 2 + Math.cos(x * 0.29 - fraction * 6) * 0.8;
    const height = ridgeProfile * (broad + shoulders);
    const strata = height * 0.89 + Math.floor(height / 1.8) * 1.8 * 0.11;
    const z = -137 - band * 55 + localZ;
    positions.setXYZ(i, x, -5 + strata, z);
    uv.setXY(i, x / 9, z / 9);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function grassClumpGeometry(THREE) {
  const positions = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 2.399, x = Math.cos(a) * 0.23, z = Math.sin(a) * 0.23;
    const dx = Math.cos(a + 1.1) * 0.08, dz = Math.sin(a + 1.1) * 0.08;
    const tip = [x + Math.cos(a) * 0.18, 0.35 + (i % 3) * 0.12, z + Math.sin(a) * 0.18];
    positions.push(x - dx, 0, z - dz, ...tip, x + dx, 0, z + dz);
    positions.push(x + dx, 0, z + dz, ...tip, x - dx, 0, z - dz);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function riverMesh(THREE) {
  const geometry = new THREE.PlaneGeometry(15, 300, 16, 130);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const z = positions.getZ(i) - 60;
    positions.setXYZ(i, positions.getX(i) + riverCenter(z), -1.20, z);
  }
  geometry.computeVertexNormals();
  const uniforms = {time: {value: 0}};
  const material = new THREE.MeshPhysicalMaterial({color: 0x17464b, roughness: 0.22, metalness: 0.16,
    clearcoat: 0.65, clearcoatRoughness: 0.24});
  material.onBeforeCompile = shader => {
    shader.uniforms.envTime = uniforms.time;
    shader.vertexShader = `varying vec3 envWorld;\nuniform float envTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed.y += sin(position.z * 0.75 - envTime * 0.8) * 0.025;\nenvWorld = (modelMatrix * vec4(transformed,1.0)).xyz;`);
    shader.fragmentShader = `varying vec3 envWorld;\nuniform float envTime;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\nfloat wave = sin(envWorld.z * 4.9 + sin(envWorld.x * 2.3) * 2.4 - envTime * 1.1);\nfloat crossed = sin(envWorld.x * 7.1 + envWorld.z * 3.7 + cos(envWorld.z * 1.2) - envTime * 0.7);\nfloat glint = pow(max(0.0, wave * 0.52 + crossed * 0.48), 22.0);\ndiffuseColor.rgb += vec3(0.023,0.032,0.029) * glint;`);
  };
  material.customProgramCacheKey = () => 'yunxiu-river-v1';
  material.userData.uniforms = uniforms;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}
