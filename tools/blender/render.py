import bpy, math
from mathutils import Vector
def setup_render(path, res=(600,800), cam_loc=(0,-400,0), target=(0,0,0), ortho=None, samples=16, lens=60):
    sc=bpy.context.scene
    sc.render.engine='CYCLES'; sc.cycles.samples=samples; sc.cycles.device='CPU'
    sc.cycles.use_denoising=False
    sc.render.resolution_x,sc.render.resolution_y=res
    sc.render.filepath=path
    cam=bpy.data.cameras.new('cam'); co=bpy.data.objects.new('cam',cam); sc.collection.objects.link(co)
    co.location=cam_loc
    d=Vector(target)-Vector(cam_loc); co.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
    if ortho: cam.type='ORTHO'; cam.ortho_scale=ortho
    else: cam.lens=lens
    sc.camera=co
    w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True
    w.node_tree.nodes['Background'].inputs[0].default_value=(0.9,0.9,0.9,1); w.node_tree.nodes['Background'].inputs[1].default_value=0.6
    l=bpy.data.lights.new('sun','SUN'); l.energy=3.5; lo=bpy.data.objects.new('sun',l); sc.collection.objects.link(lo)
    lo.rotation_euler=(math.radians(50),0,math.radians(-30))
def render(): bpy.ops.render.render(write_still=True)
