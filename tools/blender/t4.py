import sys; sys.path.insert(0,'/tmp/blend')
import bpy, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from body import load_body
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
b=load_body(targets=(('caucasian-male-young.target',1.0),('universal-male-young-maxmuscle-averageweight.target',0.35),('proportions/male-young-averagemuscle-averageweight-idealproportions.target',0.6)))
dg=bpy.context.evaluated_depsgraph_get()
bvh=BVHTree.FromObject(b,dg)
xs=np.arange(-70,70.01,0.5); zs=np.arange(-10,95.01,0.5)
F=np.full((len(zs),len(xs)),np.nan); B=np.full((len(zs),len(xs)),np.nan)
for j,z in enumerate(zs):
    for i,x in enumerate(xs):
        h=bvh.ray_cast(Vector((x,-200,z)),Vector((0,1,0)))
        if h[0] is not None:
            F[j,i]=h[0].y
            h2=bvh.ray_cast(Vector((x,200,z)),Vector((0,-1,0)))
            B[j,i]=h2[0].y
np.savez('/tmp/blend/proj.npz',xs=xs,zs=zs,F=F,B=B)
print('done')
