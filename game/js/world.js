// world.js — the city of Solmar: road grid, four districts, instanced
// buildings, beachfront, docks, landmarks, colliders and the intersection
// graph that traffic, police and the GPS route all share.
G.world = {
  colliders: [],
  landmarks: {},
  nodes: [],
  parkedSpots: [],
  water: null,
  sun: null,
  sunTarget: null,
};

G.WORLD = {
  streetsX: [-280, -210, -140, -70, 0, 70, 140, 210, 280],
  avenuesZ: [-200, -140, -80, -20, 40, 100, 160],
  roadW: 16,
  minX: -312, maxX: 312, minZ: -242, maxZ: 196,
  beachZ: 176, waterZ: 214,
};

G.world.isRoad = function (x, z) {
  var w = G.WORLD, i;
  for (i = 0; i < w.streetsX.length; i++) if (Math.abs(x - w.streetsX[i]) < w.roadW / 2) return true;
  for (i = 0; i < w.avenuesZ.length; i++) if (Math.abs(z - w.avenuesZ[i]) < w.roadW / 2) return true;
  return false;
};
G.world.isWater = function (x, z) { return z > G.WORLD.waterZ; };
G.world.nearestNode = function (x, z) {
  var best = null, bd = 1e12;
  for (var i = 0; i < G.world.nodes.length; i++) {
    var n = G.world.nodes[i], d = G.dist2d(x, z, n.x, n.z);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
};
// A* over the intersection graph; returns world-space waypoints ending at the target.
G.world.findPath = function (ax, az, bx, bz) {
  var start = G.world.nearestNode(ax, az), goal = G.world.nearestNode(bx, bz);
  if (!start || !goal) return [{ x: bx, z: bz }];
  var open = [start], came = {}, gs = {}, fs = {};
  came[start.id] = null; gs[start.id] = 0; fs[start.id] = G.dist2d(start.x, start.z, goal.x, goal.z);
  var closed = {};
  while (open.length) {
    var bi = 0;
    for (var i = 1; i < open.length; i++) if (fs[open[i].id] < fs[open[bi].id]) bi = i;
    var cur = open.splice(bi, 1)[0];
    if (cur === goal) {
      var path = [], c = cur;
      while (c) { path.unshift({ x: c.x, z: c.z }); c = came[c.id]; }
      path.push({ x: bx, z: bz });
      return path;
    }
    closed[cur.id] = true;
    for (var k = 0; k < cur.neighbors.length; k++) {
      var nb = cur.neighbors[k];
      if (closed[nb.id]) continue;
      var tg = gs[cur.id] + G.dist2d(cur.x, cur.z, nb.x, nb.z);
      if (gs[nb.id] === undefined || tg < gs[nb.id]) {
        came[nb.id] = cur; gs[nb.id] = tg;
        fs[nb.id] = tg + G.dist2d(nb.x, nb.z, goal.x, goal.z);
        if (open.indexOf(nb) === -1) open.push(nb);
      }
    }
  }
  return [{ x: goal.x, z: goal.z }, { x: bx, z: bz }];
};

function canvasTexture(w, h, draw) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  var t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function buildingTexture(base, litRatio) {
  return canvasTexture(128, 256, function (ctx, w, h) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    var cols = 8, rows = 18, cw = w / cols, ch = h / rows;
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var lit = G.rng() < litRatio;
      ctx.fillStyle = lit ? '#ffd98a' : 'rgba(18,24,38,0.85)';
      ctx.fillRect(x * cw + 2, y * ch + 3, cw - 4, ch - 6);
    }
  });
}
function addCollider(cx, cz, w, d) {
  G.world.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
}

G.world.build = function (scene) {
  var W = G.WORLD;
  // ---- sky, fog, lights -------------------------------------------------
  var skyTex = canvasTexture(16, 256, function (ctx, w, h) {
    var gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2c3a6e'); gr.addColorStop(0.42, '#7a5a8c');
    gr.addColorStop(0.62, '#e2703a'); gr.addColorStop(0.72, '#ffb36b');
    gr.addColorStop(0.78, '#7a5a8c'); gr.addColorStop(1, '#2c3a6e');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  });
  skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping;
  var sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(0xdd8a5e, 150, 950);
  var sun = new THREE.DirectionalLight(0xffb36b, 1.35);
  sun.position.set(-260, 210, 330);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
  sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  G.world.sun = sun; G.world.sunTarget = sun.target;
  scene.add(new THREE.HemisphereLight(0x93a7e8, 0x5a4630, 0.6));
  var fill = new THREE.DirectionalLight(0xff9a7a, 0.25);
  fill.position.set(200, 120, -260);
  scene.add(fill);

  // ---- ground stack ------------------------------------------------------
  var base = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 1200),
    new THREE.MeshLambertMaterial({ color: 0x8d8578 })
  );
  base.rotation.x = -Math.PI / 2; base.position.set(0, -0.05, 60);
  base.receiveShadow = true;
  scene.add(base);

  var asphaltTex = canvasTexture(128, 128, function (ctx, w, h) {
    ctx.fillStyle = '#33333c'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (var i = 0; i < 260; i++) ctx.fillRect(G.rng() * w, G.rng() * h, 2, 2);
    ctx.fillStyle = '#e8c85a';
    ctx.fillRect(w / 2 - 2, 8, 4, 44); ctx.fillRect(w / 2 - 2, 76, 4, 44);
  });
  asphaltTex.repeat.set(1, 10);
  var roadMat = new THREE.MeshLambertMaterial({ map: asphaltTex });
  var i, j;
  for (i = 0; i < W.avenuesZ.length; i++) {
    var av = new THREE.Mesh(new THREE.PlaneGeometry(W.maxX - W.minX + 40, W.roadW), roadMat);
    av.rotation.x = -Math.PI / 2; av.rotation.z = Math.PI / 2;
    av.position.set(0, 0.02, W.avenuesZ[i]);
    av.receiveShadow = true;
    scene.add(av);
  }
  for (i = 0; i < W.streetsX.length; i++) {
    var st = new THREE.Mesh(new THREE.PlaneGeometry(W.roadW, 452), roadMat);
    st.rotation.x = -Math.PI / 2;
    st.position.set(W.streetsX[i], 0.02, -22);
    st.receiveShadow = true;
    scene.add(st);
  }
  // beach + sea
  var sand = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 46),
    new THREE.MeshLambertMaterial({ color: 0xe6c98f })
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.01, W.beachZ + 21);
  sand.receiveShadow = true;
  scene.add(sand);
  var waterTex = canvasTexture(128, 128, function (ctx, w, h) {
    ctx.fillStyle = '#1d5f7a'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,210,150,0.35)'; ctx.lineWidth = 2;
    for (var k = 0; k < 9; k++) {
      ctx.beginPath();
      var y = G.rng() * h;
      ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.3, y + 5, w * 0.6, y - 5, w, y);
      ctx.stroke();
    }
  });
  waterTex.repeat.set(30, 8);
  var water = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 260),
    new THREE.MeshPhongMaterial({ map: waterTex, color: 0x9fd4e8, shininess: 90, transparent: true, opacity: 0.94 })
  );
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.35, W.waterZ + 128);
  scene.add(water);
  G.world.water = water;

  // ---- intersection graph -------------------------------------------------
  for (i = 0; i < W.streetsX.length; i++) for (j = 0; j < W.avenuesZ.length; j++) {
    G.world.nodes.push({ id: i + ':' + j, x: W.streetsX[i], z: W.avenuesZ[j], ix: i, iz: j, neighbors: [] });
  }
  G.world.nodes.forEach(function (n) {
    G.world.nodes.forEach(function (m) {
      if (m === n) return;
      if ((m.ix === n.ix && Math.abs(m.iz - n.iz) === 1) || (m.iz === n.iz && Math.abs(m.ix - n.ix) === 1)) n.neighbors.push(m);
    });
  });

  // ---- blocks & buildings --------------------------------------------------
  var towerTexA = buildingTexture('#6a7086', 0.4);
  var towerTexB = buildingTexture('#7a6a72', 0.5);
  var hotelTex = buildingTexture('#a8845e', 0.55);
  var towerMat = new THREE.MeshLambertMaterial({ map: towerTexA, emissive: 0xffca7a, emissiveMap: towerTexA, emissiveIntensity: 0.55 });
  var towerMatB = new THREE.MeshLambertMaterial({ map: towerTexB, emissive: 0xffca7a, emissiveMap: towerTexB, emissiveIntensity: 0.55 });
  var hotelMat = new THREE.MeshLambertMaterial({ map: hotelTex, emissive: 0xffca7a, emissiveMap: hotelTex, emissiveIntensity: 0.5 });
  var wareMat = new THREE.MeshLambertMaterial({ color: 0x8a7f74 });
  var houseMat = new THREE.MeshLambertMaterial({ color: 0xd8c8ae });
  var roofMat = new THREE.MeshLambertMaterial({ color: 0x9a4a3a });
  var unitBox = new THREE.BoxGeometry(1, 1, 1);
  unitBox.translate(0, 0.5, 0);
  var towers = [], hotels = [], wares = [], houses = [], roofs = [];
  var dummy = new THREE.Object3D();
  var color = new THREE.Color();

  function blockInfo(bx0, bx1, bz0, bz1) {
    var cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
    return { cx: cx, cz: cz, w: bx1 - bx0, d: bz1 - bz0, district: G.districtAt(cx, cz) };
  }
  // landmark blocks are built by hand below; remember which blocks they own
  var landmarkBlocks = {
    club: { x: -105, z: 130 }, garage: { x: 175, z: 130 }, police: { x: 35, z: -110 },
    hospital: { x: -245, z: 10 }, arena: { x: 245, z: 70 }, warehouse: { x: 245, z: 10 },
  };
  function isLandmarkBlock(cx, cz) {
    for (var k in landmarkBlocks) {
      var L = landmarkBlocks[k];
      if (Math.abs(cx - L.x) < 40 && Math.abs(cz - L.z) < 34) return k;
    }
    return null;
  }
  for (i = 0; i < W.streetsX.length - 1; i++) for (j = 0; j < W.avenuesZ.length - 1; j++) {
    var bx0 = W.streetsX[i] + W.roadW / 2 + 2, bx1 = W.streetsX[i + 1] - W.roadW / 2 - 2;
    var bz0 = W.avenuesZ[j] + W.roadW / 2 + 2, bz1 = W.avenuesZ[j + 1] - W.roadW / 2 - 2;
    var info = blockInfo(bx0, bx1, bz0, bz1);
    // block ground tint
    var gcol = info.district === 'SUBURBS' ? 0x5f7d43 : (info.district === 'DOCKS' ? 0x77705f : (info.district === 'BEACHFRONT' ? 0xb09a72 : 0x6e6a72));
    var gnd = new THREE.Mesh(new THREE.PlaneGeometry(info.w, info.d), new THREE.MeshLambertMaterial({ color: gcol }));
    gnd.rotation.x = -Math.PI / 2; gnd.position.set(info.cx, 0.012, info.cz);
    gnd.receiveShadow = true;
    scene.add(gnd);
    if (isLandmarkBlock(info.cx, info.cz)) continue;
    if (info.district === 'DOWNTOWN') {
      var n = G.randInt(1, 2);
      for (var t = 0; t < n; t++) {
        var bw = G.rand(24, 38), bd = G.rand(24, 38), bh = G.rand(26, 66);
        var px = info.cx + (n === 1 ? 0 : (t === 0 ? -13 : 13)) + G.rand(-3, 3);
        var pz = info.cz + G.rand(-4, 4);
        towers.push({ x: px, z: pz, w: bw, d: bd, h: bh, alt: t === 1 });
        addCollider(px, pz, bw, bd);
      }
    } else if (info.district === 'BEACHFRONT') {
      var hw = G.rand(30, 44), hd = G.rand(18, 24), hh = G.rand(10, 23);
      hotels.push({ x: info.cx, z: info.cz - 6, w: hw, d: hd, h: hh });
      addCollider(info.cx, info.cz - 6, hw, hd);
    } else if (info.district === 'DOCKS') {
      if (G.rng() < 0.45) {
        // container yard
        for (var c = 0; c < 7; c++) {
          var cxx = info.cx + G.rand(-20, 20), czz = info.cz + G.rand(-14, 14);
          wares.push({ x: cxx, z: czz, w: 12, d: 5, h: 2.6 * G.randInt(1, 2), cont: true });
          addCollider(cxx, czz, 12, 5);
        }
      } else {
        var ww = G.rand(38, 50), wd = G.rand(24, 32), wh = G.rand(9, 14);
        wares.push({ x: info.cx, z: info.cz, w: ww, d: wd, h: wh });
        addCollider(info.cx, info.cz, ww, wd);
      }
    } else {
      // suburbs: four houses
      for (var hx = 0; hx < 2; hx++) for (var hz = 0; hz < 2; hz++) {
        var hxp = bx0 + 14 + hx * 26, hzp = bz0 + 13 + hz * 24;
        houses.push({ x: hxp, z: hzp, w: 13, d: 11, h: G.rand(5, 7) });
        roofs.push({ x: hxp, z: hzp, w: 15, d: 13, h: 3.4 });
        addCollider(hxp, hzp, 13, 11);
      }
    }
  }
  function fillInstanced(list, mat, geo, colorFn) {
    if (!list.length) return;
    var im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(function (b, idx) {
      dummy.position.set(b.x, 0, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      im.setMatrixAt(idx, dummy.matrix);
      if (colorFn) im.setColorAt(idx, colorFn(b));
    });
    im.castShadow = true; im.receiveShadow = true;
    scene.add(im);
    return im;
  }
  fillInstanced(towers.filter(function (b) { return !b.alt; }), towerMat, unitBox);
  fillInstanced(towers.filter(function (b) { return b.alt; }), towerMatB, unitBox);
  fillInstanced(hotels, hotelMat, unitBox);
  fillInstanced(wares.filter(function (b) { return !b.cont; }), wareMat, unitBox);
  fillInstanced(wares.filter(function (b) { return b.cont; }),
    new THREE.MeshLambertMaterial({ color: 0xffffff }), unitBox,
    function () { return color.setHSL(G.rng(), 0.5, 0.42); });
  fillInstanced(houses, houseMat, unitBox);
  var roofGeo = new THREE.ConeGeometry(0.72, 1, 4);
  roofGeo.translate(0, 0.5, 0); roofGeo.rotateY(Math.PI / 4);
  var roofIM = new THREE.InstancedMesh(roofGeo, roofMat, Math.max(roofs.length, 1));
  roofs.forEach(function (r, idx) {
    dummy.position.set(r.x, houses[idx] ? houses[idx].h : 6, r.z);
    dummy.scale.set(r.w, r.h, r.d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    roofIM.setMatrixAt(idx, dummy.matrix);
  });
  roofIM.castShadow = true;
  scene.add(roofIM);

  // ---- landmark buildings ---------------------------------------------------
  function landmark(x, z, w, d, h, mat, name, doorZ) {
    var m = new THREE.Mesh(unitBox, mat);
    m.scale.set(w, h, d); m.position.set(x, 0, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    addCollider(x, z, w, d);
    G.world.landmarks[name] = { x: x, z: z, doorX: x, doorZ: doorZ };
    return m;
  }
  var clubMat = new THREE.MeshLambertMaterial({ color: 0xc44a6e, emissive: 0x881133, emissiveIntensity: 0.35 });
  landmark(-105, 124, 40, 20, 13, clubMat, 'club', 148);
  var garageMat = new THREE.MeshLambertMaterial({ color: 0x4a7a9a, emissive: 0x11384a, emissiveIntensity: 0.3 });
  landmark(175, 124, 42, 20, 10, garageMat, 'garage', 148);
  G.world.landmarks.garage.zone = { x: 175, z: 146, r: 13 };
  var copMat = new THREE.MeshLambertMaterial({ color: 0x3a4a6e, emissive: 0x0a1a33, emissiveIntensity: 0.4 });
  landmark(35, -116, 40, 22, 16, copMat, 'police', -92);
  var hospMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8, emissive: 0x661111, emissiveIntensity: 0.25 });
  landmark(-245, 4, 38, 20, 12, hospMat, 'hospital', 28);
  landmark(245, 4, 46, 26, 12, wareMat, 'warehouse', 28);
  // docks arena: container walls forming a shootout yard
  [[245, 58, 46, 5], [245, 84, 46, 5], [224, 71, 5, 30], [266, 71, 5, 30]].forEach(function (c) {
    var m = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0x7a5a8a }));
    m.scale.set(c[2], 5.2, c[3]); m.position.set(c[0], 0, c[1]);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    addCollider(c[0], c[1], c[2], c[3]);
  });
  G.world.landmarks.arena = { x: 245, z: 71, doorX: 245, doorZ: 92 };
  G.world.landmarks.marina = { x: 288, z: 168, doorX: 288, doorZ: 168 };
  G.world.landmarks.safehouse = { x: -35, z: 128, doorX: -35, doorZ: 148 };
  landmark(-35, 122, 30, 16, 11, hotelMat, 'safehouseMesh', 148);

  // dock cranes
  var craneMat = new THREE.MeshLambertMaterial({ color: 0xd8722c });
  [[215, -60], [275, -140]].forEach(function (p) {
    var g = new THREE.Group();
    var mast = new THREE.Mesh(new THREE.BoxGeometry(2.4, 26, 2.4), craneMat);
    mast.position.y = 13; g.add(mast);
    var jib = new THREE.Mesh(new THREE.BoxGeometry(30, 1.8, 1.8), craneMat);
    jib.position.set(9, 25, 0); g.add(jib);
    g.position.set(p[0], 0, p[1]);
    g.traverse(function (o) { o.castShadow = true; });
    scene.add(g);
    addCollider(p[0], p[1], 3, 3);
  });

  // ---- palms & streetlights (instanced) --------------------------------------
  var palmPos = [];
  for (i = -300; i <= 300; i += 24) { palmPos.push({ x: i + G.rand(-3, 3), z: 171 + G.rand(-2, 2) }); palmPos.push({ x: i + 12, z: 186 + G.rand(-2, 2) }); }
  for (i = 0; i < 26; i++) palmPos.push({ x: G.rand(-290, 290), z: G.rand(178, 196) });
  var trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 7, 5);
  trunkGeo.translate(0, 3.5, 0);
  var trunkIM = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x8a6a4a }), palmPos.length);
  var frondGeo = new THREE.ConeGeometry(3.4, 1.6, 7);
  frondGeo.translate(0, 7.2, 0); frondGeo.scale(1, 1, 1);
  var frondIM = new THREE.InstancedMesh(frondGeo, new THREE.MeshLambertMaterial({ color: 0x3f7d3a }), palmPos.length);
  palmPos.forEach(function (p, idx) {
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(G.rand(-0.06, 0.06), G.rand(0, 6.28), G.rand(-0.06, 0.06));
    dummy.scale.set(1, G.rand(0.85, 1.2), 1);
    dummy.updateMatrix();
    trunkIM.setMatrixAt(idx, dummy.matrix);
    frondIM.setMatrixAt(idx, dummy.matrix);
  });
  trunkIM.castShadow = true; frondIM.castShadow = true;
  scene.add(trunkIM); scene.add(frondIM);

  var lightPos = [];
  for (i = 0; i < W.streetsX.length; i++) for (j = -220; j <= 190; j += 42) lightPos.push({ x: W.streetsX[i] + 9.4, z: j });
  for (i = 0; i < W.avenuesZ.length; i++) for (j = -300; j <= 300; j += 42) lightPos.push({ x: j, z: W.avenuesZ[i] + 9.4 });
  var poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6.4, 5);
  poleGeo.translate(0, 3.2, 0);
  var poleIM = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x2c2c34 }), lightPos.length);
  var bulbGeo = new THREE.BoxGeometry(0.7, 0.3, 0.7);
  bulbGeo.translate(0, 6.5, 0);
  var bulbIM = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), lightPos.length);
  lightPos.forEach(function (p, idx) {
    dummy.position.set(p.x, 0, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleIM.setMatrixAt(idx, dummy.matrix);
    bulbIM.setMatrixAt(idx, dummy.matrix);
  });
  scene.add(poleIM); scene.add(bulbIM);

  // parked-car spots along street edges
  for (i = 0; i < W.streetsX.length; i++) for (j = 0; j < 16; j++) {
    var pz = G.rand(-225, 185);
    if (Math.abs(pz - 160) < 12) continue;
    G.world.parkedSpots.push({ x: W.streetsX[i] + (G.rng() < 0.5 ? -6.4 : 6.4), z: pz, heading: G.rng() < 0.5 ? 0 : Math.PI });
  }
  for (i = 0; i < W.avenuesZ.length; i++) for (j = 0; j < 12; j++) {
    var px = G.rand(-295, 295);
    G.world.parkedSpots.push({ x: px, z: W.avenuesZ[i] + (G.rng() < 0.5 ? -6.4 : 6.4), heading: G.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 });
  }
};

G.world.update = function (dt, t) {
  if (G.world.water) G.world.water.material.map.offset.set(t * 0.008, Math.sin(t * 0.24) * 0.02);
  // keep the sun's shadow frustum centred on the action
  var f = G.focus;
  if (f && G.world.sun) {
    var sx = Math.round(f.x / 8) * 8, sz = Math.round(f.z / 8) * 8;
    G.world.sun.position.set(sx - 260, 210, sz + 330);
    G.world.sunTarget.position.set(sx, 0, sz);
  }
};
