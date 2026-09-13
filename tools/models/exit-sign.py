"""Original molded exit luminaire housing fitted to existing sign-face dimensions.
Feet; Blender x,-depth,height exports store x,height,depth. Not a brand replica.
The existing 15.6 x 8.76 inch sign face and wall-center anchor remain unchanged.
"""
from pathlib import Path
import bpy,bmesh,json
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
material=bpy.data.materials.new('ExitHousing');material.diffuse_color=(.82,.84,.80,1);material.use_nodes=True
p=material.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=material.diffuse_color;p.inputs['Roughness'].default_value=.6
# Continuous enclosure: back, outer walls, front bezel, inner returns and cavity floor.
rings=[(.69,.405,0),(.69,.405,.292),(.65,.365,.292),(.65,.365,.055)]
v=[(x*w,-d,y*h) for w,h,d in rings for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]]
f=[]
for ring in range(3):
 for i in range(4):j=(i+1)%4;f.append((ring*4+i,ring*4+j,(ring+1)*4+j,(ring+1)*4+i))
f.extend([(3,2,1,0),(12,13,14,15)])
me=bpy.data.meshes.new('Molded enclosure mesh');me.from_pydata(v,[],f);me.update()
o=bpy.data.objects.new('ExitHousing',me);bpy.context.collection.objects.link(o);me.materials.append(material)
bpy.context.view_layer.objects.active=o;o.select_set(True)
bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
mod=o.modifiers.new('Molded edge radii','BEVEL');mod.width=.006;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
bm=bmesh.new();bm.from_mesh(o.data);assert all(e.is_manifold for e in bm.edges);assert bm.calc_volume(signed=True)>0;bm.free()
o['construction']='One closed molded shell with recessed face seat, wall contact back and eased bezel; no intersecting blocks.'
o['face_plane_depth_ft']=.274;o['face_width_ft']=1.3;o['face_height_ft']=.73
scene=bpy.context.scene;scene.unit_settings.system='IMPERIAL';scene.unit_settings.scale_length=.3048
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools/models/exit-sign.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/exit-sign.glb'),export_format='GLB',export_extras=True)
o.data.calc_loop_triangles();metrics={'triangles':len(o.data.loop_triangles),'meshes':1,'material_roles':['ExitHousing'],'outer_size_ft':[1.38,.81,.292],'face_seat_depth_ft':.274,'manifold':True}
(ROOT/'tools/models/exit-sign-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
print(metrics)
