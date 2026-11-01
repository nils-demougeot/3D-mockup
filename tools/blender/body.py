import bpy, bmesh, numpy as np
from mathutils import Vector

TD='/tmp/repos/mh/makehuman/data/targets/macrodetails/'
def apply_target(V, name, w):
    for line in open(TD+name):
        if line.startswith('#') or not line.strip(): continue
        p=line.split(); i=int(p[0]); V[i]+= w*np.array([float(p[1]),float(p[2]),float(p[3])])

def load_body(path='/tmp/repos/mh/makehuman/data/3dobjs/base.obj', scale=10.0, targets=(('universal-male-young-averagemuscle-averageweight.target',1.0),)):
    V=[]; VT=[]; faces=[]; group=None
    for line in open(path):
        if line.startswith('v '):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('g '):
            group=line.split()[1]
        elif line.startswith('f ') and group=='body':
            faces.append([int(t.split('/')[0])-1 for t in line.split()[1:]])
    V=np.array(V)
    for n,w in targets: apply_target(V,n,w)
    V=V*scale
    used=sorted(set(i for f in faces for i in f))
    remap={o:n for n,o in enumerate(used)}
    verts=[(V[i][0], -V[i][2], V[i][1]) for i in used]  # Blender Z-up : y_obj->z, z_obj->-y
    fcs=[[remap[i] for i in f] for f in faces]
    me=bpy.data.meshes.new('body'); me.from_pydata(verts,[],fcs); me.update()
    ob=bpy.data.objects.new('body',me); bpy.context.scene.collection.objects.link(ob)
    return ob

if __name__=='__main__':
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    b=load_body()
    import numpy as np
    co=np.array([v.co[:] for v in b.data.vertices])
    print('verts',len(co),'min',co.min(0),'max',co.max(0))
    # sections: arm direction - take vertices with x>max shoulder
    z=co[:,2]
    for zz in [150,140,130,120,110,100,90]:
        sl=co[np.abs(z-zz)<1]
        if len(sl): print(zz, 'x range',sl[:,0].min(),sl[:,0].max(),'y range',sl[:,1].min(),sl[:,1].max())
