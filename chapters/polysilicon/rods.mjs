// One U-shaped silicon rod pair (a "hairpin"): two vertical rods on their chucks, a horizontal bridge,
// and a rounded knuckle at each top corner. Used by the build (static art, recorded shapes) and inlined
// into the page, where it is rebuilt every frame as the rods thicken. Pure: takes the kit and lathe.
export function hairpin(k, G, P, u, r) {
  const V = G.viewOf(P);
  const [a, b] = u.feet;
  const zt = u.zTop;
  const A = [a[0], a[1], zt];
  const B = [b[0], b[1], zt];
  const far = G.dot3(A, V) < G.dot3(B, V) ? 0 : 1;
  const tops = [A, B];
  const axis = G.unit3(G.sub3(B, A));
  const length = G.len3(G.sub3(B, A));
  const F = G.frameAlong(A, axis);
  const rods = [a, b]
    .map((p, index) => ({ index, depth: G.dot3([p[0], p[1], (u.zBase + zt) / 2], V), svg: k.solidSvg(k.cylinder(p[0], p[1], r, u.zBase, zt - u.zBase, P, 36), { tone: "hi", crease: "none" }) }))
    .sort((x, y) => x.depth - y.depth)
    .map((x) => x.svg)
    .join("");
  const ball = (index) => k.solidSvg(G.sphereOf(tops[index], r, P, { steps: 32 }), { tone: "hi", crease: "none" });
  const bridge = k.solidSvg(G.disc(0, length, r, F, P, { steps: 36 }), { tone: "hi", crease: "none" });
  return rods + ball(far) + bridge + ball(1 - far);
}

// The recorded shapes of the same hairpin, for the audit.
export function hairpinShapes(A, G, u, r, meta) {
  const [a, b] = u.feet;
  const zt = u.zTop;
  const P0 = [a[0], a[1], zt];
  const P1 = [b[0], b[1], zt];
  const F = G.frameAlong(P0, G.unit3(G.sub3(P1, P0)));
  const length = G.len3(G.sub3(P1, P0));
  return [
    A.cylinder(a[0], a[1], r, u.zBase, zt - u.zBase, { ...meta }),
    A.cylinder(b[0], b[1], r, u.zBase, zt - u.zBase, { ...meta }),
    A.disc(F, 0, length, r, { ...meta }),
    A.ball(P0, r, { ...meta }),
    A.ball(P1, r, { ...meta }),
  ];
}
