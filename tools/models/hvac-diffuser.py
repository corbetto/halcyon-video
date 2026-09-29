"""Original generic slotted HVAC diffuser, authored in store feet with Blender 5.2.
Run: blender -b -t 2 -P tools/models/hvac-diffuser.py
Blender (x,-store_z,height) exports Y-up as store (x,height,z).
"""
from pathlib import Path
import bpy, bmesh, json
ROOT = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'IMPERIAL'
scene.unit_settings.scale_length = .3048
roles = {}
for name, color, rough in [
    ('PaintedSteel', (.79,.81,.82,1), .57),
    ('RecessShadow', (.058,.067,.072,1), .92),
    ('LouverMetal', (.66,.70,.72,1), .54),
]:
    m = bpy.data.materials.new(name)
    m.diffuse_color = color
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = .05
    roles[name] = m

class Builder:
    def __init__(self):
        self.vertices=[]; self.faces=[]
    def box(self,x0,x1,y0,y1,z0,z1):
        # Store-space bounds; every shell has its own welded corners.
        base=len(self.vertices)
        self.vertices.extend([(x,y,z) for y in (y0,y1) for z in (z0,z1) for x in (x0,x1)])
        self.faces.extend([tuple(base+i for i in f) for f in
            ((0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5))])
    def ring(self, outer, inner, ytop, ybottom):
        # One continuous closed pressed bezel, open through its center.
        ox,oz=outer; ix,iz=inner
        outlines=[[( -ox,-oz),(ox,-oz),(ox,oz),(-ox,oz)],
                  [(-ix,-iz),(ix,-iz),(ix,iz),(-ix,iz)]]
        base=len(self.vertices)
        for y in (ytop,ybottom):
            for line in outlines:
                self.vertices.extend((x,y,z) for x,z in line)
        for i in range(4):
            j=(i+1)%4
            self.faces.extend([tuple(base+k for k in (i,j,4+j,4+i)),
                               tuple(base+k for k in (8+4+i,8+4+j,8+j,8+i)),
                               tuple(base+k for k in (i,8+i,8+j,j)),
                               tuple(base+k for k in (4+i,4+j,12+j,12+i))])
    def slat(self,x0,x1,zcenter,halfwidth,ytop,ybottom,thick):
        # Bent blade: the sloping underside deflects air across the room.
        z0=zcenter-halfwidth; z1=zcenter+halfwidth
        base=len(self.vertices)
        self.vertices.extend((x,y,z) for x in (x0,x1) for y,z in
            ((ytop,z0),(ytop+thick,z0),(ybottom+thick,z1),(ybottom,z1)))
        self.faces.extend([tuple(base+k for k in f) for f in
            ((0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0))])
    def finish(self,name,material):
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata([(x,-z,y) for x,y,z in self.vertices], [], self.faces)
        mesh.update()
        obj=bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(obj)
        mesh.materials.append(roles[material])
        bm=bmesh.new(); bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        assert all(e.is_manifold for e in bm.edges), name
        bm.to_mesh(mesh); bm.free()
        uv=mesh.uv_layers.new(name='SurfaceFeet')
        for polygon in mesh.polygons:
            axis=max(range(3),key=lambda i:abs(polygon.normal[i]))
            axes=[i for i in range(3) if i!=axis]
            for loop_idx in polygon.loop_indices:
                co=mesh.vertices[mesh.loops[loop_idx].vertex_index].co
                uv.data[loop_idx].uv=(co[axes[0]],co[axes[1]])
        obj['units']='feet'; obj['part_role']=material
        mesh.calc_loop_triangles()
        return obj, len(mesh.loop_triangles)

frame=Builder(); frame.ring((2.485,1.235),(2.29,1.04),.015,-.14)
# Inner return/fold is thinner and a little deeper than the broad outer lip.
frame.ring((2.29,1.04),(2.225,.975),-.085,-.185)
well=Builder(); well.box(-2.225,2.225,-.035,-.005,-.975,.975)
slats=Builder()
for index in range(10):
    slats.slat(-2.20,2.20,-.81+index*.18,.067,-.105,-.176,.032)
# Stamped center stiffener gives the long blades an actual supporting spine.
slats.box(-.027,.027,-.215,-.075,-.92,.92)
parts={}
for builder,name,role in [(frame,'DiffuserFrame','PaintedSteel'),(well,'RecessPan','RecessShadow'),(slats,'DirectionalLouvers','LouverMetal')]:
    obj,triangles=builder.finish(name,role)
    parts[name]={'material':role,'triangles':triangles,'vertices':len(obj.data.vertices),'manifold':True}
out=ROOT/'public/models/hvac-diffuser.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_extras=True,export_yup=True)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=6
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools/models/hvac-diffuser.blend'))
(ROOT/'docs/hvac-diffuser-cost.json').write_text(json.dumps({
    'units':'store feet', 'store_bounds_feet':{'x':[-2.485,2.485],'y':[-.215,.015],'z':[-1.235,1.235]},
    'parts':parts,'total_triangles':sum(p['triangles'] for p in parts.values()),
    'glb_bytes':out.stat().st_size,'textures':0,'material_roles':list(roles)
},indent=2)+'\n')
