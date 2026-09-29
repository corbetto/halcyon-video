import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import ts from 'typescript';

let source = await readFile(new URL('../src/hvac-diffuser-model.ts', import.meta.url), 'utf8');
source = source.replace("import { assetUrl } from './asset-url';", "const assetUrl = (path: string) => '/base/' + path;")
  .replace("from './model-resources'", `from '${new URL('../src/model-resources.ts', import.meta.url).href}'`)
  .replaceAll("from 'three'", `from '${import.meta.resolve('three')}'`)
  .replace("from 'three/examples/jsm/loaders/GLTFLoader.js'", `from '${import.meta.resolve('three/examples/jsm/loaders/GLTFLoader.js')}'`);
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { installHvacDiffusers } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

function sourceModel(onDispose?: () => void) {
  const group = new THREE.Group();
  for (const name of ['DiffuserFrame', 'RecessPan', 'DirectionalLouvers']) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2), new THREE.MeshStandardMaterial({name}));
    mesh.name = name;
    mesh.geometry.addEventListener('dispose', onDispose ?? (() => {}));
    group.add(mesh);
  }
  return group;
}
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes,no) => { resolve=yes; reject=no; });
  return {promise,resolve,reject};
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('diffuser family keeps fallback through preparation and retires detached or failed loads', async () => {
  const original = GLTFLoader.prototype.load;
  const accept: Array<(result: {scene: THREE.Group}) => void> = [];
  (GLTFLoader.prototype as any).load = function(url: string, done: (result: {scene: THREE.Group}) => void) {
    assert.equal(url, '/base/models/hvac-diffuser.glb');
    accept.push(done);
    return {};
  };
  try {
    for (const action of ['reveal','ancestor-detach','cancel','failure','late-load']) {
      const scene = new THREE.Scene(), ancestor = new THREE.Group(), parent = new THREE.Group();
      scene.add(ancestor); ancestor.add(parent);
      const fallback = [new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial()), new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial())];
      fallback.forEach(mesh => parent.add(mesh));
      let request!: () => Promise<void>, renders=0, shadows=0, queuedCancelled=0;
      const prep = deferred();
      let preparedSignal: AbortSignal | undefined;
      const ctx = {scene, scheduleDetailLoad: (start: () => Promise<void>) => {request=start;return () => {queuedCancelled++;};},
        prepareDetailModel: async (model: THREE.Group, signal: AbortSignal) => {
          preparedSignal=signal;
          assert.equal(model.visible,false);
          assert.ok(fallback.every(mesh => mesh.visible));
          await prep.promise;
        },
        requestRender: () => {renders++;}, requestShadowRefresh: () => {shadows++;}};
      const stop = installHvacDiffusers(ctx,parent,[{x:1,y:2,z:3},{x:-1,y:2,z:3,scale:.4}],fallback);
      assert.equal(accept.length,0);
      const requestPromise=request();
      let sourceDisposals=0;
      const source=sourceModel(() => sourceDisposals++);
      if (action==='late-load') ancestor.removeFromParent();
      accept.shift()!({scene:source});
      assert.equal(sourceDisposals,3);
      const model=parent.children.find(object => object.name==='HVAC diffuser family') as THREE.Group | undefined;
      if (action==='late-load') {
        assert.equal(model,undefined);
        assert.ok(fallback.every(mesh => mesh.visible));
        await requestPromise;
        stop();
        continue;
      }
      assert.ok(model);
      const instances=model.children as THREE.InstancedMesh[];
      assert.equal(instances.length,3);
      assert.ok(instances.every(mesh => mesh.isInstancedMesh && mesh.count===2));
      let installedDisposals=0;
      instances.forEach(mesh => mesh.geometry.addEventListener('dispose', () => installedDisposals++));
      if (action==='ancestor-detach') ancestor.removeFromParent();
      if (action==='cancel') {stop(); assert.equal(preparedSignal?.aborted,true);}
      if (action==='failure') prep.reject(new Error('shader preparation failed'));
      else prep.resolve();
      await requestPromise;
      await tick();
      if (action==='reveal') {
        assert.ok(fallback.every(mesh => !mesh.visible));
        assert.equal(model.visible,true);
        assert.equal(renders,1); assert.equal(shadows,1);
        stop();
      } else {
        assert.ok(fallback.every(mesh => mesh.visible));
        assert.equal(model.parent,null);
        assert.equal(renders,0); assert.equal(shadows,0);
        stop();
      }
      stop();
      assert.equal(queuedCancelled,1);
      assert.equal(installedDisposals,3);
    }
  } finally { GLTFLoader.prototype.load=original; }
});
