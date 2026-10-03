"""Original generic folded theater carton. No external mesh or printed artwork.
Blender authoring: blender -b -t 2 -P /absolute/path/to/this/script.
Outer dimensions are existing application anchors; hidden construction is estimated.
"""
import bpy, bmesh, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
W,H,D,T=.32,.42,.18,.0012
mat=bpy.data.materials.new('CandyCartonPaper'); mat.use_nodes=True
mat.diffuse_color=(.85,.82,.75,1)
p=mat.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.85,.82,.75,1);p.inputs['Roughness'].default_value=.65
parts=[]
def mesh(name,vs,fs,front=False):
 me=bpy.data.meshes.new(name);me.from_pydata([(x,-z,y) for x,y,z in vs],[],fs);me.update()
 ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(mat)
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
 assert all(e.is_manifold for e in bm.edges),name
 bm.to_mesh(me);bm.free()
 uv=me.uv_layers.new(name='ReplaceablePrintUV')
 for poly in me.polygons:
  # Broad front/back faces read upright from outside. Side/fold faces sample
  # unprinted margin of the existing wrap rather than squashing product copy.
  nx,ny,nz=poly.normal
  for li in poly.loop_indices:
   x,by,y=me.vertices[me.loops[li].vertex_index].co;z=-by
   if front and abs(ny)>.99 and abs(poly.center.y)>D/2-T*.5:
    u=(x/W+.5) if ny<0 else (.5-x/W);v=y/H+.5
   elif abs(nz)>.7:u=.005+(x/W+.5)*.035;v=.30+(z/D+.5)*.35
   elif abs(ny)>.7:u=.005+(x/W+.5)*.035;v=.30+(y/H+.5)*.35
   else:u=.005+(z/D+.5)*.035;v=.30+(y/H+.5)*.35
   uv.data[li].uv=(u,v)
 me.calc_loop_triangles();parts.append({'name':name,'vertices':len(me.vertices),'triangles':len(me.loop_triangles),'manifold':True})
 ob['provenance']='Original generic construction; nominal envelope from current CandyDisplay. Hidden folds estimated.'
 return ob

def profile(w,d,r):
 return [(-w/2+r,d/2),(w/2-r,d/2),(w/2,d/2-r),(w/2,-d/2+r),(w/2-r,-d/2),(-w/2+r,-d/2),(-w/2,-d/2+r),(-w/2,d/2-r)]
vs=[]
for y,pr in [(-H/2,profile(W,D,.002)),(H/2,profile(W,D,.002)),(-H/2,profile(W-2*T,D-2*T,.0015)),(H/2,profile(W-2*T,D-2*T,.0015))]:
 vs.extend((x,y,z) for x,z in pr)
fs=[]
for i in range(8):
 j=(i+1)%8
 fs.extend([(i,j,8+j,8+i),(16+i,24+i,24+j,16+j),(i,16+i,16+j,j),(8+i,8+j,24+j,24+i)])
mesh('Scored_continuous_paperboard_sleeve',vs,fs,True)
# Closed folded cross-section, with tuck behind the front wall. Small clearance
# reveals the paper cut edge without changing either nominal collision envelope.
for sign,label in [(1,'Top'),(-1,'Bottom')]:
 y=H/2-T
 cross=[(-D/2+T,y),(D/2-2*T,y),(D/2-T,y-T),(D/2-T,y-.035),(D/2-2*T,y-.035),(D/2-2*T,y-2*T),(D/2-3*T,y-T),(-D/2+T,y-T)]
 vs=[(x,sign*yy,z) for x in [-W/2+2*T,W/2-2*T] for z,yy in cross]
 k=len(cross);fs=[tuple(reversed(range(k))),tuple(range(k,2*k))]+[(i,(i+1)%k,(i+1)%k+k,i+k) for i in range(k)]
 mesh(label+'_folded_tuck_closure',vs,fs)
 # Dust flaps are below the crown, meeting the sleeve side wall at the fold.
 for side in [-1,1]:
  poly=[(side*(W/2-T),-D/2+2*T),(side*(W/2-T-.032),-D/2+.016),(side*(W/2-T-.032),D/2-.020),(side*(W/2-T),D/2-2*T)]
  vs=[(x,sign*yy,z) for yy in [y-2*T,y-3*T] for x,z in poly]
  mesh(label+('_left' if side<0 else '_right')+'_dust_flap',vs,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)])
# Internal manufacturer's seam: thin lapped strip at the rear spine, not a rib.
vs=[(x,y,z) for x in [-W/2+2*T,-W/2+.018] for y in [-H/2+2*T,H/2-2*T] for z in [-D/2+T,-D/2+2*T]]
mesh('Rear_internal_glue_lap',vs,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)])
scene=bpy.context.scene;scene.unit_settings.system='IMPERIAL';scene.unit_settings.scale_length=.3048
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_distance=.85
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools/models/candy-carton.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/candy-carton.glb'),export_format='GLB',export_yup=True,export_apply=True,export_extras=True)
metrics={'nominalRackFeet':[W,H,D],'nominalBagFeet':[.24,.32,.12],'constructionEstimatesFeet':{'board':T,'cornerFold':.002,'tuck':.035,'glueLap':.018},'parts':parts,'triangles':sum(p['triangles'] for p in parts),'materials':1,'embeddedTextures':0,'glbBytes':(ROOT/'public/models/candy-carton.glb').stat().st_size}
(ROOT/'tools/models/candy-carton-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
print(json.dumps(metrics))
