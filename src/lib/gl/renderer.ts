import { buildBust, type BustMesh, type Lod } from '../bust/mesh'
import type { Identity } from '../bust/identity'

/**
 * A WebGL2 micro-renderer, written for exactly one scene.
 *
 * WHY THERE IS NO LIBRARY HERE. three.js is ~86 kB gzipped before you draw anything, and its
 * tree-shaken "minimal" build measures *larger* than the claim; OGL would cost ~15 kB and a sixth
 * runtime dependency. This app has five dependencies and a charter about not carrying what it
 * cannot justify. What the Long Room actually needs is: one perspective camera, one material, N
 * rigid transforms, and a frame loop. That is the file below, and it costs no dependency at all.
 *
 * Everything here is deliberately absent: no scene graph, no raycaster, no orbit controls, no
 * loaders, no post-processing, no shadow maps, no alpha anywhere. Every surface is opaque, because
 * overdraw — not triangle count — is what actually misses 60fps on a phone, and it is invisible in
 * a triangle-count dashboard.
 */

// ── Minimal 4×4 matrix maths, column-major to match GLSL ──────────────────────────────────────

export type Mat4 = Float32Array

export function identityM(): Mat4 {
  const m = new Float32Array(16)
  m[0] = m[5] = m[10] = m[15] = 1
  return m
}

export function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2)
  const m = new Float32Array(16)
  m[0] = f / aspect
  m[5] = f
  m[10] = (far + near) / (near - far)
  m[11] = -1
  m[14] = (2 * far * near) / (near - far)
  return m
}

export function lookAt(eye: number[], target: number[], up: number[]): Mat4 {
  const z = norm3([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]])
  const x = norm3(cross3(up, z))
  const y = cross3(z, x)
  const m = new Float32Array(16)
  m[0] = x[0]; m[1] = y[0]; m[2] = z[0]; m[3] = 0
  m[4] = x[1]; m[5] = y[1]; m[6] = z[1]; m[7] = 0
  m[8] = x[2]; m[9] = y[2]; m[10] = z[2]; m[11] = 0
  m[12] = -dot3(x, eye); m[13] = -dot3(y, eye); m[14] = -dot3(z, eye); m[15] = 1
  return m
}

/** Translate + uniform scale + yaw. The only rigid transform a bust on a plinth ever needs. */
export function placement(tx: number, ty: number, tz: number, scale: number, yaw: number): Mat4 {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const m = new Float32Array(16)
  m[0] = c * scale; m[1] = 0; m[2] = -s * scale; m[3] = 0
  m[4] = 0; m[5] = scale; m[6] = 0; m[7] = 0
  m[8] = s * scale; m[9] = 0; m[10] = c * scale; m[11] = 0
  m[12] = tx; m[13] = ty; m[14] = tz; m[15] = 1
  return m
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const o = new Float32Array(16)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      o[i * 4 + j] =
        a[j] * b[i * 4] + a[4 + j] * b[i * 4 + 1] + a[8 + j] * b[i * 4 + 2] + a[12 + j] * b[i * 4 + 3]
    }
  }
  return o
}

const cross3 = (a: number[], b: number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot3 = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm3 = (a: number[]) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

// ── Shaders ───────────────────────────────────────────────────────────────────────────────────

const VERT = `#version 300 es
in vec3 aPos;
in vec3 aNormal;
in float aOcclusion;

uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;

out vec3 vNormalView;
out float vOcclusion;
out float vDepth;

void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vec4 view = uView * world;
  // Uniform scale + yaw only, so the upper-left 3x3 is orthogonal up to scale and the normal
  // matrix is just that block. No inverse-transpose needed, and none is computed.
  vNormalView = normalize((uView * uModel * vec4(aNormal, 0.0)).xyz);
  vOcclusion = aOcclusion;
  vDepth = -view.z;
  gl_Position = uProj * view;
}`

/**
 * The material: analytic three-light NPR with a curvature-free wrap and baked cavity occlusion.
 *
 * Zero textures, zero real lights, ~25 ALU ops. The lighting is defined in *view* space, which is
 * a deliberate constraint: the camera in the Long Room only ever travels forward down one axis and
 * never orbits, so view-space light cannot slide around the face and break the sculptural read.
 * If a free-orbit camera is ever added, this must become world-space or the illusion dies.
 */
const FRAG = `#version 300 es
precision mediump float;

in vec3 vNormalView;
in float vOcclusion;
in float vDepth;

uniform vec3 uStone;
uniform vec3 uKey;
uniform vec3 uFill;
uniform vec3 uRim;
uniform vec3 uFog;
uniform float uFogNear;
uniform float uFogFar;
uniform float uAccent;

out vec4 outColor;

// Upper-left front — the standard raking light a sculptor photographs a bust under, because it is
// the direction that makes brow, nose and chin each throw form onto the plane below them.
const vec3 L_KEY = vec3(-0.512, 0.640, 0.573);
const vec3 L_FILL = vec3(0.688, -0.229, 0.688);

void main() {
  vec3 n = normalize(vNormalView);

  // Half-Lambert across the FULL range.
  //
  // The first version clamped N·L to [0,1] before the *0.5+0.5 remap, which compressed every
  // orientation into [0.5,1]: a front face read 0.59 and a profile 0.51, so the head had no
  // terminator, no form, and all of its visible structure came from ambient occlusion alone. It
  // looked like an eroded rock. Wrapping the signed dot product is the entire difference between
  // a sphere and a face.
  float key = pow(dot(n, L_KEY) * 0.5 + 0.5, 1.9);
  float fill = pow(dot(n, L_FILL) * 0.5 + 0.5, 2.6);
  // Rim rides the silhouette edge and is weighted to the top, so it reads as a room rather than
  // as an outline traced around the head.
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.5) * clamp(n.y * 0.5 + 0.62, 0.0, 1.0);

  float ao = mix(0.28, 1.0, clamp(vOcclusion, 0.0, 1.0));

  vec3 c = uStone * ao;
  c += uKey * key * ao;
  c += uFill * fill * ao;
  c += uRim * rim * (0.3 + 0.7 * uAccent);

  // Aerial perspective: the far crowd sinks toward the room colour, which is what gives the
  // corridor its depth without a single extra triangle.
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  c = mix(c, uFog, fog);

  outColor = vec4(c, 1.0);
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`shader compile failed: ${log}`)
  }
  return sh
}

// ── The renderer ──────────────────────────────────────────────────────────────────────────────

export interface Palette {
  stone: [number, number, number]
  key: [number, number, number]
  fill: [number, number, number]
  rim: [number, number, number]
  fog: [number, number, number]
}

export interface BustInstance {
  identity: Identity
  lod: Lod
  /** World position of the bust's base. */
  x: number
  y: number
  z: number
  scale: number
  yaw: number
  /** 0 = ordinary stone, 1 = accented. Used once per room, for the one that matters. */
  accent: number
}

interface Upload {
  vao: WebGLVertexArrayObject
  buffers: WebGLBuffer[]
  indexCount: number
}

export class GalleryRenderer {
  private gl: WebGL2RenderingContext
  private program!: WebGLProgram
  private uniforms!: Record<string, WebGLUniformLocation | null>
  private uploads = new Map<string, Upload>()
  private meshes = new Map<string, BustMesh>()
  private lost = false

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false, // fill rate first — MSAA is the most expensive thing you can switch on
      depth: true,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    })
    if (!gl) throw new Error('webgl2 unavailable')
    this.gl = gl

    // preventDefault() is mandatory. Without it `webglcontextrestored` never fires and the canvas
    // stays black forever — a bug that only reproduces on backgrounded mobile tabs and laptop GPU
    // switches, so it escapes desktop QA every time.
    canvas.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault()
        this.lost = true
      },
      false,
    )
    canvas.addEventListener('webglcontextrestored', () => {
      this.uploads.clear()
      this.createResources()
      this.lost = false
    })

    this.createResources()
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
  }

  /** Every GL object is created here so context restore is one call, not a rebuild. */
  private createResources() {
    const gl = this.gl
    const program = gl.createProgram()!
    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.bindAttribLocation(program, 0, 'aPos')
    gl.bindAttribLocation(program, 1, 'aNormal')
    gl.bindAttribLocation(program, 2, 'aOcclusion')
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`link failed: ${gl.getProgramInfoLog(program)}`)
    }
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    this.program = program
    this.uniforms = Object.fromEntries(
      ['uProj', 'uView', 'uModel', 'uStone', 'uKey', 'uFill', 'uRim', 'uFog', 'uFogNear', 'uFogFar', 'uAccent'].map(
        (n) => [n, gl.getUniformLocation(program, n)],
      ),
    )
  }

  /**
   * Meshes are cached by identity+LOD and kept on the CPU permanently, so a context restore is a
   * re-upload rather than a re-bake. Regenerating geometry on restore is how a backgrounded tab
   * turns into a two-second freeze.
   */
  private upload(key: string, identity: Identity, lod: Lod): Upload {
    const existing = this.uploads.get(key)
    if (existing) return existing

    let mesh = this.meshes.get(key)
    if (!mesh) {
      mesh = buildBust(identity, lod)
      this.meshes.set(key, mesh)
    }

    const gl = this.gl
    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)

    // `Float32Array<ArrayBufferLike>` does not narrow to `BufferSource` under TS 5.9's typed-array
    // generics, because the buffer could in principle be a SharedArrayBuffer. It never is here.
    const mk = (data: Float32Array, loc: number, size: number) => {
      const b = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, b)
      gl.bufferData(gl.ARRAY_BUFFER, data as BufferSource, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
      return b
    }

    const buffers = [
      mk(mesh.positions, 0, 3),
      mk(mesh.normals, 1, 3),
      mk(mesh.occlusion, 2, 1),
    ]
    const ib = gl.createBuffer()!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices as BufferSource, gl.STATIC_DRAW)
    buffers.push(ib)
    gl.bindVertexArray(null)

    const up = { vao, buffers, indexCount: mesh.indices.length }
    this.uploads.set(key, up)
    return up
  }

  /** Clamp the backing store. Fill rate, not geometry, is what misses frame budget. */
  resize(cssWidth: number, cssHeight: number) {
    const cap = window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2
    const dpr = Math.min(window.devicePixelRatio || 1, cap)
    const w = Math.max(1, Math.round(cssWidth * dpr))
    const h = Math.max(1, Math.round(cssHeight * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  render(instances: BustInstance[], eye: number[], target: number[], palette: Palette, fogNear: number, fogFar: number) {
    if (this.lost) return
    const gl = this.gl
    const w = this.canvas.width
    const h = this.canvas.height
    gl.viewport(0, 0, w, h)
    gl.clearColor(palette.fog[0], palette.fog[1], palette.fog[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    gl.useProgram(this.program)
    const proj = perspective((52 * Math.PI) / 180, w / h, 0.1, 60)
    const view = lookAt(eye, target, [0, 1, 0])
    gl.uniformMatrix4fv(this.uniforms.uProj, false, proj)
    gl.uniformMatrix4fv(this.uniforms.uView, false, view)
    gl.uniform3fv(this.uniforms.uStone, palette.stone)
    gl.uniform3fv(this.uniforms.uKey, palette.key)
    gl.uniform3fv(this.uniforms.uFill, palette.fill)
    gl.uniform3fv(this.uniforms.uRim, palette.rim)
    gl.uniform3fv(this.uniforms.uFog, palette.fog)
    gl.uniform1f(this.uniforms.uFogNear, fogNear)
    gl.uniform1f(this.uniforms.uFogFar, fogFar)

    // Front-to-back keeps early-Z doing real work on tile-based mobile GPUs.
    const ordered = [...instances].sort((a, b) => b.z - a.z)
    for (const inst of ordered) {
      const key = `${inst.identity.interocular.toFixed(4)}:${inst.identity.gonialAngle.toFixed(4)}:${inst.identity.occiput.toFixed(4)}:${inst.lod}`
      const up = this.upload(key, inst.identity, inst.lod)
      gl.bindVertexArray(up.vao)
      gl.uniformMatrix4fv(
        this.uniforms.uModel,
        false,
        placement(inst.x, inst.y, inst.z, inst.scale, inst.yaw),
      )
      gl.uniform1f(this.uniforms.uAccent, inst.accent)
      gl.drawElements(gl.TRIANGLES, up.indexCount, gl.UNSIGNED_SHORT, 0)
    }
    gl.bindVertexArray(null)
  }

  /**
   * Release every GL object. Persistent context loss on mobile is almost always a resource leak in
   * your own code rather than a browser fault, and the LOD-swap and reseed paths are where it
   * leaks, so this must actually be called on unmount.
   */
  dispose() {
    const gl = this.gl
    for (const up of this.uploads.values()) {
      for (const b of up.buffers) gl.deleteBuffer(b)
      gl.deleteVertexArray(up.vao)
    }
    this.uploads.clear()
    this.meshes.clear()
    gl.deleteProgram(this.program)
  }
}

/** Is a GPU path available at all? Cheap enough to call before committing to the 3D screen. */
export function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    return !!c.getContext('webgl2')
  } catch {
    return false
  }
}
