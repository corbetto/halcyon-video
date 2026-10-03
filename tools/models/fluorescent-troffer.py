"""Original generic recessed troffer, fitted to Halcyon's 5 x 2.5 ft module.
Run Blender -b -t 2 -P this file. No reference artwork or third-party meshes.
Store coordinates are feet, X long axis, Y up, origin at the ceiling plane.
"""
import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name,color,metal,rough):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
 p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m
paint=material('TrofferPaint',(.88,.89,.86),.04,.5)
steel=material('TrofferHardware',(.38,.40,.42),.65,.38)
glass=material('TrofferTubeGlass',(.91,.93,.93),0,.28)
parts=[]
def mesh(name,vertices,faces,mat,bevel=0):
 me=bpy.data.meshes.new(name);me.from_pydata([(x,-z,y) for x,y,z in vertices],[],faces);me.update()
 ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(mat)
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 assert all(e.is_manifold for e in bm.edges),name;bm.to_mesh(me);bm.free()
 bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 if bevel:
  mod=ob.modifiers.new('Folded edge easing','BEVEL');mod.width=bevel;mod.segments=1
  bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.012);bpy.ops.object.mode_set(mode='OBJECT')
 ob.select_set(False);ob['units']='feet';parts.append(ob);return ob

def corners(hx,hz,y):return [(-hx,y,-hz),(hx,y,-hz),(hx,y,hz),(-hx,y,hz)]
def ring(name,profile,mat,bevel=0):
 # Closed radial cross-section swept around four mitred corners, welded.
 verts=[v for hx,hz,y in profile for v in corners(hx,hz,y)];faces=[]
 for j in range(len(profile)):
  n=(j+1)%len(profile)
  for i in range(4):faces.append((4*j+i,4*j+(i+1)%4,4*n+(i+1)%4,4*n+i))
 return mesh(name,verts,faces,mat,bevel)
def box(name,x0,x1,y0,y1,z0,z1,mat,bevel=0):
 v=[(x,y,z) for y in (y0,y1) for x,z in [(x0,z0),(x1,z0),(x1,z1),(x0,z1)]]
 return mesh(name,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,bevel)
# Welded folded pan: open below, closed top; the sloped reflector returns
# clear the preserved flat lens at -0.08..-0.04 and the two tube channels.
levels=[(2.415,1.165,-.02),(2.415,1.165,.035),(2.26,1.01,.285),
        (2.25,1.00,.27),(2.403,1.153,.03),(2.403,1.153,-.02)]
v=[p for hx,hz,y in levels for p in corners(hx,hz,y)];f=[]
for a,b in [(0,1),(1,2),(3,4),(4,5),(5,0)]:
 for i in range(4):f.append((4*a+i,4*a+(i+1)%4,4*b+(i+1)%4,4*b+i))
f.extend([(8,9,10,11),(15,14,13,12)])
mesh('Folded recessed reflector pan',v,f,paint,.002)
# Narrow folded door rim sits proud of the existing grid underside (-.075).
# Clear opening stays exactly 4.88 x 2.38: no new masking of the light lens.
ring('Mitred door rim and lens seat',[(2.48,1.23,-.14),(2.44,1.19,-.14),
 (2.44,1.19,-.035),(2.415,1.165,-.035),(2.415,1.165,-.02),
 (2.455,1.205,-.02),(2.455,1.205,-.09),(2.48,1.23,-.09)],paint,.0015)
# Two folded retaining spring clips and two short barrel hinges. Their folded
# ends meet the door rim; there are no floating decorative strips.
for x in [-1.55,1.55]:
 # U-shaped latch profile extruded along X, around the front rim.
 yz=[(-.127,1.218),(-.127,1.24),(-.079,1.24),(-.079,1.205),
     (-.087,1.205),(-.087,1.232),(-.119,1.232),(-.119,1.218)]
 verts=[(xx,y,z) for xx in [x-.09,x+.09] for y,z in yz];n=len(yz)
 faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh('Lens door spring latch',verts,faces,steel,.001)
 box('Rear hinge mounting leaf',x-.12,x+.12,-.103,-.094,-1.221,-1.175,steel,.001)
# Seamed service cover on the rear of the pan, with four corner fasteners.
box('Rear ballast service cover',-1.82,1.82,.286,.305,-.19,.19,paint,.005)
# Tubes follow the two procedural lens hot bands (long axis X).
def cylinderX(name,x0,x1,y,z,r,mat,segments=12):
 verts=[(x,y+math.sin(2*math.pi*i/segments)*r,z+math.cos(2*math.pi*i/segments)*r) for x in (x0,x1) for i in range(segments)]
 faces=[tuple(range(segments-1,-1,-1)),tuple(range(segments,2*segments))]+[(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
 ob=mesh(name,verts,faces,mat)
 for p in ob.data.polygons:
  if len(p.vertices)==4:p.use_smooth=True
 return ob
for z in [-.4284,.4284]:
 cylinderX('Nonemissive fluorescent tube',-2.20,2.20,.12,z,.043,glass)
 for side in [-1,1]:
  a=side*2.20;b=side*2.245
  cylinderX('Tube metal end cap',min(a,b),max(a,b),.12,z,.046,steel)
  box('Tube lampholder',side*2.26-.025,side*2.26+.025,.085,.245,z-.071,z+.071,paint,.005)
for x in [-1.55,1.55]:cylinderX('Rear door hinge barrel',x-.12,x+.12,-.099,-1.217,.018,steel,10)
for x in [-1.70,1.70]:
 for z in [-.13,.13]:box('Service cover fastener',x-.012,x+.012,.305,.311,z-.012,z+.012,steel,.002)
scene=bpy.context.scene;scene.unit_settings.system='IMPERIAL';scene.unit_settings.scale_length=.3048
scene['provenance']='Original generic folded-sheet troffer fitted to established Halcyon module and lens. Hidden pan, clips and hardware are construction estimates, not a manufacturer replica. No reference artwork.'
scene['contract']='Feet; X long, Y up, +Y into ceiling. 5x2.5 module. Runtime lens stays 4.88x2.38x.04 at Y=-.06; material and light output owned by app.'
scene['parts']='Folded pan, mitred lens door with seat, spring latches, hinge leaves and barrels, rear service cover, two tubes and lampholders.'
for ob in parts:
 bm=bmesh.new();bm.from_mesh(ob.data);assert all(e.is_manifold for e in bm.edges),ob.name;bm.free();assert ob.data.uv_layers
bpy.context.preferences.filepaths.save_version=0
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  area.spaces.active.region_3d.view_distance=7;area.spaces.active.region_3d.view_location=Vector((0,0,.08))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools/models/fluorescent-troffer.blend'))
source_parts=len(parts)
for mat,name in [(paint,'TrofferHousing'),(steel,'TrofferHardware'),(glass,'TrofferTubes')]:
 obs=[o for o in scene.objects if o.type=='MESH' and o.data.materials[0]==mat]
 for ob in obs:ob.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();bpy.context.object.name=name;bpy.context.object.select_set(False)
obs=[o for o in scene.objects if o.type=='MESH']
for ob in obs:ob.data.calc_loop_triangles()
path=ROOT/'public/models/fluorescent-troffer.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_extras=True)
metrics={'triangles':sum(len(o.data.loop_triangles) for o in obs),'draws':len(obs),'materials':3,'images':0,'glb_bytes':path.stat().st_size,'source_parts':source_parts,'module_ft':[5,2.5],'lens_ft':[4.88,.04,2.38],'lens_center_y_ft':-.06}
(ROOT/'docs/fluorescent-troffer-cost.json').write_text(json.dumps(metrics,indent=2)+'\n');print(metrics)
