import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * Planar mirrors refresh serially. Keep their individual resolved HDR images,
 * but share the temporary multisample colour/depth workspace used to draw them.
 * Three's Reflector and GPU copy path perform the original render and resolve.
 */
export class MirrorRenderTarget {
  private readonly copyMaterial = new THREE.ShaderMaterial({
    uniforms: { source: { value: null } },
    glslVersion: THREE.GLSL3,
    vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D source; out vec4 copiedColour; void main() { copiedColour = texelFetch(source, ivec2(gl_FragCoord.xy), 0); }',
    depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
  });
  private readonly copyQuad = new FullScreenQuad(this.copyMaterial);
  private scratch: THREE.WebGLRenderTarget | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private adapter: THREE.WebGLRenderer | null = null;
  private destination: THREE.WebGLRenderTarget | null = null;
  private didRender = false;
  private readonly targets = new Set<THREE.WebGLRenderTarget>();
  private targetsNeedInit = true;
  private readonly contextRestored = () => { this.targetsNeedInit = true; };
  private samples = new WeakMap<THREE.WebGLRenderTarget, number>();

  prepare(target: THREE.WebGLRenderTarget): void {
    if (this.samples.has(target)) return;
    this.samples.set(target, target.samples);
    this.targets.add(target);
    this.targetsNeedInit = true;
    // Reflector owns this target and still disposes its retained colour image.
    target.dispose();
    target.samples = 0;
    target.depthBuffer = false;
    target.stencilBuffer = false;
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget,
         draw: (...args: any[]) => void,
         scene: THREE.Scene, camera: THREE.Camera): void {
    this.prepare(target);
    const samples = this.samples.get(target)!;
    if (!this.scratch || this.scratch.samples !== samples ||
        this.scratch.texture.type !== target.texture.type ||
        this.scratch.texture.format !== target.texture.format) {
      this.scratch?.dispose();
      this.scratch = target.clone();
      this.scratch.texture.name = 'Mirrors.shared-workspace';
      this.scratch.samples = samples;
      this.scratch.depthBuffer = true;
    }
    this.scratch.setSize(target.width, target.height);
    if (this.renderer !== renderer) {
      this.renderer?.domElement?.removeEventListener('webglcontextrestored', this.contextRestored);
      this.renderer = renderer;
      renderer.domElement?.addEventListener('webglcontextrestored', this.contextRestored);
      this.targetsNeedInit = true;
      // Only Reflector's explicit target selection is redirected. Renderer
      // internals and other effects keep the real renderer and its state.
      this.adapter = Object.create(renderer) as THREE.WebGLRenderer;
      this.adapter.setRenderTarget = (next, face, level) => {
        if (next === this.destination) {
          this.didRender = true;
          renderer.setRenderTarget(this.scratch, face, level);
        } else renderer.setRenderTarget(next, face, level);
      };
    }
    // Other mirrors can be sampled by this reflection before their first
    // refresh. Allocate their retained images once, also after a context reset,
    // so Three never creates an orphan texture before initializing its target.
    if (this.targetsNeedInit) {
      this.targets.forEach(t => renderer.initRenderTarget(t));
      this.targetsNeedInit = false;
    }
    const previous = renderer.getRenderTarget();
    const xr = renderer.xr.enabled;
    const shadowUpdate = renderer.shadowMap.autoUpdate;
    this.destination = target;
    this.didRender = false;
    try {
      draw(this.adapter!, scene, camera);
      if (this.didRender) {
        // Leaving the workspace resolves MSAA, then the GPU copies the same
        // HDR texels into this mirror's persistent texture. No CPU readback.
        this.copyMaterial.uniforms.source.value = this.scratch.texture;
        renderer.setRenderTarget(target);
        // texelFetch preserves exact half-float pixels. Unlike r184's
        // copyTextureToTexture helper, this path also survives context restore:
        // that helper retains copy framebuffers from the lost GL context.
        this.copyQuad.render(renderer);
      }
    } finally {
      this.destination = null;
      renderer.xr.enabled = xr;
      renderer.shadowMap.autoUpdate = shadowUpdate;
      renderer.setRenderTarget(previous);
    }
  }

  dispose(): void {
    this.scratch?.dispose();
    this.copyMaterial.dispose();
    this.copyQuad.dispose();
    this.scratch = null;
    this.adapter = null;
    this.renderer?.domElement?.removeEventListener('webglcontextrestored', this.contextRestored);
    this.renderer = null;
    this.targets.clear();
  }
}
