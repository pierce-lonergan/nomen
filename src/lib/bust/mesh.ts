import type { Identity } from './identity'

/**
 * Bust geometry — a sculpted head, generated from a 24-float identity vector.
 *
 * No mesh files, no loaders, no textures. The entire crowd is arithmetic, which is what keeps a
 * roomful of distinct people inside a bundle that a name-memory app can justify carrying.
 *
 * ── The anti-uncanny commitments, which are load-bearing and not stylistic whim ───────────────
 *
 * Partial realism is what triggers the valley: a photoreal eye in a faceted head reads as injury
 * rather than style. So fidelity is held *uniform and low* on purpose, and five rules are enforced
 * here in the geometry rather than left to the shader:
 *
 *  1. **Hollow carved sockets, never eyeballs.** This is the classical bust solution. It is
 *     unambiguously sculptural, and it is immune to the wrong-gaze-vector failure that makes a
 *     rendered eye read as dead. There is no sclera, no iris and no corneal highlight anywhere.
 *  2. **The cranium is enlarged ~12%.** Away from human proportion, toward the maquette.
 *  3. **Truncation at the clavicle, with a clean section cut.** A head that ends in a flat plane
 *     is obviously an object. A head that fades out is a ghost.
 *  4. **No facial motion, ever.** Rigid rotation only. Idle blinking or breathing added for
 *     "life" is worse than stillness — partial facial motion is a documented valley trigger. If
 *     the scene needs life, the camera moves. The face does not.
 *  5. **Faceted by design.** Visible planar structure says "carved", and carved is a category the
 *     eye can assign instantly — which is the current account of why the valley happens at all.
 */

export interface BustMesh {
  positions: Float32Array
  normals: Float32Array
  /** Baked cavity occlusion, 0 = deeply occluded … 1 = fully open. One float per vertex. */
  occlusion: Float32Array
  indices: Uint16Array
  vertexCount: number
}

/** Segment counts per level of detail: foreground, midground, background. */
const LOD_SEGMENTS: [number, number][] = [
  [48, 40], // LOD0 — the face you are being asked about
  [28, 22], // LOD1 — the near crowd
  [16, 12], // LOD2 — the far crowd, where only the silhouette survives
]

export type Lod = 0 | 1 | 2

interface Feature {
  /** Anchor direction on the unit sphere. Normalised on use. */
  at: [number, number, number]
  /** Angular falloff radius, radians. */
  spread: number
  /** Displacement along the surface normal. Negative carves inward. */
  amp: number
}

/** Smoothstep, the only easing this file needs. */
function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

/**
 * The feature stack for one identity.
 *
 * Each entry is an anchored radial-falloff basis function. Sculpting by displacement from a smooth
 * base — rather than by blending stored morph targets — is what keeps the per-head data cost at 24
 * floats instead of the ~300KB a quantised blendshape basis would need.
 */
function featuresFor(id: Identity): Feature[] {
  const eyeX = 0.3 + id.interocular * 0.022
  const eyeY = 0.05 + id.eyeHeight * 0.02
  return [
    // Brow ridge — one wide bar, the single strongest cue to a "carved" reading.
    { at: [0, eyeY + 0.2 + id.eyeBrowGap * 0.015, 0.92], spread: 0.55, amp: 0.1 + id.foreheadSlope * 0.025 },
    // Eye sockets, carved hollow, and carved DEEP. Shadow does the work an eyeball would, so if
    // these are shallow the whole head reads as an egg — which is exactly what the first pass did.
    { at: [-eyeX, eyeY, 0.9], spread: 0.27, amp: -(0.17 + id.eyeDepth * 0.03) },
    { at: [eyeX, eyeY, 0.9], spread: 0.27, amp: -(0.17 + id.eyeDepth * 0.03) },
    // Nose: bridge, then tip, then flare. The single most identifying projection on a silhouette.
    { at: [0, eyeY - 0.04, 1], spread: 0.22, amp: 0.12 + id.noseBridge * 0.03 },
    { at: [0, -0.16 - id.nasionToSubnasale * 0.025, 1], spread: 0.14, amp: 0.2 + id.noseTip * 0.045 },
    { at: [0, -0.25, 0.97], spread: 0.16, amp: 0.075 + id.nostrilFlare * 0.028 },
    // Cheekbones — the widest thing on a face at distance, so they carry the silhouette.
    { at: [-0.7, -0.04, 0.55], spread: 0.4, amp: 0.075 + id.zygoProjection * 0.04 },
    { at: [0.7, -0.04, 0.55], spread: 0.4, amp: 0.075 + id.zygoProjection * 0.04 },
    // Mouth: a shallow trough, then the lips sitting in it.
    { at: [0, -0.4 - id.philtrum * 0.02, 0.92], spread: 0.26, amp: -0.06 },
    { at: [0, -0.38 - id.philtrum * 0.02, 0.96], spread: 0.15, amp: 0.045 + id.lipFullness * 0.03 },
    // Chin and jaw corners.
    { at: [0, -0.7 - id.lipToMenton * 0.025, 0.62], spread: 0.3, amp: 0.085 + id.chinRound * 0.035 },
    { at: [-0.76, -0.5, 0.28], spread: 0.36, amp: 0.055 + id.gonialAngle * 0.035 },
    { at: [0.76, -0.5, 0.28], spread: 0.36, amp: 0.055 + id.gonialAngle * 0.035 },
    // Occiput — invisible from the front, but it is most of the profile silhouette.
    { at: [0, 0.12, -1], spread: 0.6, amp: 0.06 + id.occiput * 0.035 },
    // Temples, carved in. This is what separates a skull from an egg, so it is not subtle either.
    { at: [-0.93, 0.34, 0.14], spread: 0.3, amp: -0.04 },
    { at: [0.93, 0.34, 0.14], spread: 0.3, amp: -0.04 },
    // The eye-socket bridge: a ridge between the sockets, or the two hollows merge into one band
    // across the face and it stops reading as a pair of eyes.
    { at: [0, eyeY + 0.02, 0.99], spread: 0.1, amp: 0.05 },
  ]
}

/** The smooth base head: an ellipsoid whose width varies down the vertical axis. */
function baseRadius(id: Identity, x: number, y: number, z: number): [number, number, number] {
  // Above the brow the skull widens; below it the face tapers to the chin. `t` is 0 at the chin
  // and 1 at the crown.
  const t = smooth((y + 1) / 2)
  const cranium = 1 + 0.12 // rule 2: away from human proportion, toward the maquette
  const widthTop = 0.86 + id.cranialWidth * 0.03
  const widthBottom = 0.66 + id.jawWidth * 0.035
  const width = widthBottom + (widthTop - widthBottom) * smooth(t * 1.15)

  const depthTop = 0.94 + id.cranialDepth * 0.03
  const depthBottom = 0.82
  const depth = depthBottom + (depthTop - depthBottom) * t

  const height = 1.06 + id.faceRatio * 0.035
  // Faces are not front-back symmetric: the front is flatter than the back.
  const frontFlatten = z > 0 ? 1 - 0.08 * smooth(z) : 1

  return [
    x * width * cranium * frontFlatten,
    y * height * cranium,
    z * depth * cranium * frontFlatten,
  ]
}

function normalise(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

/**
 * Build one bust.
 *
 * Topology is a UV grid, which buys vertex adjacency for free — and adjacency is what makes the
 * occlusion bake a handful of arithmetic rather than a raycaster.
 */
export function buildBust(id: Identity, lod: Lod = 0): BustMesh {
  const [segU, segV] = LOD_SEGMENTS[lod]
  const features = featuresFor(id)

  // The section cut: everything below this parametric latitude becomes the neck and the shoulder
  // plane rather than a chin, so the bust terminates as an object (rule 3).
  const CUT = 0.78

  const cols = segU + 1
  const rows = segV + 1
  const count = cols * rows
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const occlusion = new Float32Array(count)

  for (let j = 0; j < rows; j++) {
    const v = j / segV
    const phi = v * Math.PI
    for (let i = 0; i < cols; i++) {
      const u = i / segU
      const theta = u * Math.PI * 2

      // Rotated a half-turn about Y so theta = 0 lands on the BACK of the head: the UV seam, where
      // the first and last columns meet, then runs down the occiput instead of straight through
      // the bridge of the nose.
      //
      // BOTH x and z are negated, and that is the whole point. Negating z alone is a reflection,
      // not a rotation — it flips the handedness of the parameterisation, which silently inverts
      // every normal and reverses the triangle winding, so the head renders inside-out.
      const dx = -Math.sin(phi) * Math.sin(theta)
      const dy = Math.cos(phi)
      const dz = -Math.sin(phi) * Math.cos(theta)

      let [x, y, z] = baseRadius(id, dx, dy, dz)

      // Anchored displacement.
      let disp = 0
      for (const f of features) {
        const a = normalise(f.at)
        const dot = dx * a[0] + dy * a[1] + dz * a[2]
        const angle = Math.acos(Math.min(1, Math.max(-1, dot)))
        if (angle < f.spread) disp += f.amp * smooth(1 - angle / f.spread)
      }
      x += dx * disp
      y += dy * disp
      z += dz * disp

      // Neck and shoulder: below the cut the surface stops following the head and becomes a
      // tapered column, then flares to a flat clavicle plane.
      if (dy < -CUT) {
        const k = smooth((-dy - CUT) / (1 - CUT))
        const neck = 0.42 + 0.5 * k * k
        x = x * (1 - k) + dx * neck * (1 - k * 0.2) + dx * neck * k
        z = z * (1 - k) + dz * neck * (1 - k * 0.2) + dz * neck * k
        y = y * (1 - k) + (-1.12 - 0.06 * k) * k
      }

      const o = (j * cols + i) * 3
      positions[o] = x
      positions[o + 1] = y
      positions[o + 2] = z
    }
  }

  // ── Normals, from the grid ──────────────────────────────────────────────────────────────────
  const at = (i: number, j: number): [number, number, number] => {
    // Wrap by segU, NOT by cols. Column `segU` is a duplicate of column 0 at the same point in
    // space, so wrapping by cols makes column 0's left neighbour a copy of itself: the tangent
    // collapses to half length in the wrong direction and the seam renders as a hard crease down
    // the head. Wrapping by segU reaches the genuine previous ring.
    const ci = ((i % segU) + segU) % segU
    const cj = Math.min(rows - 1, Math.max(0, j))
    const o = (cj * cols + ci) * 3
    return [positions[o], positions[o + 1], positions[o + 2]]
  }

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const right = at(i + 1, j)
      const left = at(i - 1, j)
      const down = at(i, j + 1)
      const up = at(i, j - 1)

      const tu: [number, number, number] = [right[0] - left[0], right[1] - left[1], right[2] - left[2]]
      const tv: [number, number, number] = [down[0] - up[0], down[1] - up[1], down[2] - up[2]]
      // tv × tu, NOT tu × tv.
      //
      // `tv` runs from the north pole downward, so it points roughly −y; crossing tu into it
      // yields a normal pointing *into* the head. That inversion is invisible in a wireframe and
      // catastrophic everywhere else: it flips the lighting so the face is shaded as though it
      // faced away, and it flips the sign of the cavity term so eye sockets bake as bumps.
      let n = normalise([
        tv[1] * tu[2] - tv[2] * tu[1],
        tv[2] * tu[0] - tv[0] * tu[2],
        tv[0] * tu[1] - tv[1] * tu[0],
      ])
      // Poles are degenerate — the cross product collapses. Fall back to the axis.
      if (!Number.isFinite(n[0]) || Math.hypot(n[0], n[1], n[2]) < 1e-6) n = [0, j === 0 ? 1 : -1, 0]

      const o = (j * cols + i) * 3
      normals[o] = n[0]
      normals[o + 1] = n[1]
      normals[o + 2] = n[2]
    }
  }

  // ── Occlusion, by mesh cavity ───────────────────────────────────────────────────────────────
  // A vertex sitting behind the average of its neighbours — measured along its own normal — is in
  // a hollow. That single dot product is what turns a grey blob into a carved object, and it is
  // the difference between the eye sockets reading as sockets and reading as smudges.
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const idx = j * cols + i
      const c = at(i, j)
      const ring = [at(i + 1, j), at(i - 1, j), at(i, j + 1), at(i, j - 1)]
      let ax = 0
      let ay = 0
      let az = 0
      for (const p of ring) {
        ax += p[0]
        ay += p[1]
        az += p[2]
      }
      ax /= ring.length
      ay /= ring.length
      az /= ring.length

      const o = idx * 3
      const cavity =
        (ax - c[0]) * normals[o] + (ay - c[1]) * normals[o + 1] + (az - c[2]) * normals[o + 2]

      // Normalise against a SPHERE of the same tessellation, not against the segment count.
      //
      // The neighbour-average of a sphere of radius r sits ≈ r·h²/4 inside the surface, where h is
      // the angular spacing — so the raw cavity term scales with segV⁻², not segV⁻¹. Dividing by
      // the wrong power made the same head measurably darker at LOD2 than at LOD0 (median
      // occlusion 0.62 against 0.87), so busts got *dimmer* as they receded and fought the fog.
      // Dividing by the sphere's own value makes a smooth surface land on 1.0 at every LOD, and
      // leaves only genuine concavity — the sockets, the mouth trough, under the brow — to darken.
      // With correctly OUTWARD normals the neighbour-average of a convex surface sits inside it, so
      // the cavity term is negative and a sphere lands on exactly −1. Adding one puts a smooth
      // surface at zero, leaves genuine hollows positive, and pushes projections (the nose tip, the
      // brow) negative, where the clamp brightens them.
      const sphere = (Math.PI * Math.PI) / 4 / (segV * segV)
      const concavity = cavity / sphere + 1
      // 0.28/0.25 measured: full tonal range with nothing crushed. At 0.42/0.12, thirty per
      // cent of vertices clipped to the floor and the face read as dark blotches.
      occlusion[idx] = Math.min(1, Math.max(0.25, 1 - concavity * 0.28))
    }
  }

  // ── Indices ─────────────────────────────────────────────────────────────────────────────────
  const indices = new Uint16Array(segU * segV * 6)
  let k = 0
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * cols + i
      const b = a + cols
      indices[k++] = a
      indices[k++] = b
      indices[k++] = a + 1
      indices[k++] = a + 1
      indices[k++] = b
      indices[k++] = b + 1
    }
  }

  return { positions, normals, occlusion, indices, vertexCount: count }
}

/**
 * The flat silhouette of a bust, as an SVG path, for the no-WebGL fallback.
 *
 * The same generator, projected. In an austere typographic design language a clean filled outline
 * reads as deliberate rather than degraded — which is the only kind of fallback worth shipping.
 */
export function bustSilhouettePath(id: Identity, size = 100): string {
  const mesh = buildBust(id, 2)
  const { positions } = mesh
  // Take the outermost point per horizontal band on each side, then walk down one side and up the
  // other. A convex hull would be more correct and much slower for no visible gain at this size.
  const BANDS = 28
  const left = new Array<number>(BANDS).fill(Infinity)
  const right = new Array<number>(BANDS).fill(-Infinity)
  let minY = Infinity
  let maxY = -Infinity

  for (let i = 0; i < positions.length; i += 3) {
    minY = Math.min(minY, positions[i + 1])
    maxY = Math.max(maxY, positions[i + 1])
  }
  for (let i = 0; i < positions.length; i += 3) {
    const band = Math.min(
      BANDS - 1,
      Math.max(0, Math.floor(((positions[i + 1] - minY) / (maxY - minY)) * BANDS)),
    )
    left[band] = Math.min(left[band], positions[i])
    right[band] = Math.max(right[band], positions[i])
  }

  const px = (x: number) => (x * 0.38 + 0.5) * size
  const py = (band: number) => size - ((band + 0.5) / BANDS) * size
  const pts: string[] = []
  for (let b = BANDS - 1; b >= 0; b--) if (Number.isFinite(right[b])) pts.push(`${px(right[b]).toFixed(1)},${py(b).toFixed(1)}`)
  for (let b = 0; b < BANDS; b++) if (Number.isFinite(left[b])) pts.push(`${px(left[b]).toFixed(1)},${py(b).toFixed(1)}`)
  return `M ${pts.join(' L ')} Z`
}
