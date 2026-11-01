import sys; sys.path.insert(0,'/tmp/blend')
import bpy, numpy as np, time, math
from body import load_body
BODY_T=(('caucasian-male-young.target',1.0),('universal-male-young-maxmuscle-averageweight.target',0.35),('proportions/male-young-averagemuscle-averageweight-idealproportions.target',0.6))
def reset():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
def make_body():
    body=load_body(targets=BODY_T)
    body.scale=(0.01,0.01,0.01); bpy.context.view_layer.update()
    bpy.context.view_layer.objects.active=body; body.select_set(True); bpy.ops.object.transform_apply(scale=True); bpy.ops.object.shade_smooth()
    body.modifiers.new('col','COLLISION'); body.collision.thickness_outer=0.006; body.collision.cloth_friction=8
    return body
def build_cloth(panels, seams, name='cloth', extra=None):
    """panels: list of (meshdata, y, flip). seams: list of (panelA, panelB, segname[, segnameB])"""
    verts=[];faces=[];offs=[];segs=[];ranges=[]
    for (m,y,flip) in panels:
        pts,T,seg,nb=m; off=len(verts)
        if callable(y):
            for x,z in pts: verts.append(y(x,z))
        else:
            for x,z in pts: verts.append((x*0.01,y,z*0.01))
        fs=len(faces)
        for t in T: faces.append([off+i for i in (t[::-1] if flip else t)])
        offs.append(off); segs.append(seg); ranges.append((fs,len(faces)))
    edges=[];pairs=[]
    for sm in seams:
        a,b,sa=sm[0],sm[1],sm[2]; sb=sm[3] if len(sm)>3 else sa
        ia=segs[a][sa]; ib=segs[b][sb]
        if len(sm)>4 and sm[4]: ib=ib[::-1]
        assert len(ia)==len(ib),(sa,sb,len(ia),len(ib))
        for i,j in zip(ia,ib): edges.append((offs[a]+i,offs[b]+j)); pairs.append((offs[a]+i,offs[b]+j))
    if extra:
        ex=extra(np.array(verts),offs,segs)
        edges+=ex; pairs+=ex
    me=bpy.data.meshes.new(name); me.from_pydata(verts,edges,faces); me.update()
    ob=bpy.data.objects.new(name,me); bpy.context.scene.collection.objects.link(ob)
    return ob, dict(offs=offs,segs=segs,pairs=pairs,faces=faces,ranges=ranges,nverts=len(verts))
def cloth_mod(ob, frames, mass=0.15, bend=0.05, tension=15, shear=5, sew=4.0, quality=8, self_col=False, grav_on=8):
    cl=ob.modifiers.new('cloth','CLOTH'); s=cl.settings
    s.quality=quality; s.mass=mass; s.air_damping=1.0
    s.tension_stiffness=tension; s.compression_stiffness=tension; s.shear_stiffness=shear; s.bending_stiffness=bend
    s.use_sewing_springs=True; s.sewing_force_max=sew
    s.effector_weights.gravity=0.0
    s.effector_weights.keyframe_insert('gravity',frame=1)
    s.effector_weights.keyframe_insert('gravity',frame=grav_on)
    s.effector_weights.gravity=1.0; s.effector_weights.keyframe_insert('gravity',frame=grav_on+12)
    cs=cl.collision_settings; cs.distance_min=0.004; cs.use_self_collision=self_col; cs.self_distance_min=0.003; cs.collision_quality=3
    cl.point_cache.frame_end=frames
    sc=bpy.context.scene; sc.frame_start=1; sc.frame_end=frames
    return cl
def coords(ob):
    dg=bpy.context.evaluated_depsgraph_get(); ev=ob.evaluated_get(dg)
    co=np.empty(len(ev.data.vertices)*3); ev.data.vertices.foreach_get('co',co); return co.reshape(-1,3)
def run(ob, f0, f1, capture=(), log=10):
    sc=bpy.context.scene; out={}; t0=time.time()
    for f in range(f0,f1+1):
        sc.frame_set(f)
        if f in capture: out[f]=coords(ob)
        if f%log==0: print('frame',f,round(time.time()-t0,1),flush=True)
    return out
def add_wind(strength=3.0, turb=1.5, loc=(0.6,-1.0,-0.6), aim=(0,0,0.4), size=0.35):
    from mathutils import Vector
    bpy.ops.object.effector_add(type='WIND', location=loc); w=bpy.context.active_object
    d=Vector(aim)-Vector(loc); w.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    w.field.strength=strength; w.field.flow=0.5; w.field.noise=1.5; w.field.seed=7
    bpy.ops.object.effector_add(type='TURBULENCE', location=(0,0,0.4)); t=bpy.context.active_object
    t.field.strength=turb; t.field.size=size; t.field.flow=0.3; t.field.seed=3
    return w,t
def save_body_npz(body,path):
    co=np.empty(len(body.data.vertices)*3); body.data.vertices.foreach_get('co',co)
    faces=[list(p.vertices) for p in body.data.polygons]
    tris=[]
    for f in faces:
        for k in range(1,len(f)-1): tris.append((f[0],f[k],f[k+1]))
    np.savez(path,co=co.reshape(-1,3),tris=np.array(tris))

def wrap_maps(off=3.5, proj='/tmp/blend/proj.npz', fall=4.0, sigma=1.2, zclamp=12.0):
    """Retourne des fonctions (x,z)->y (en m) pour placer les panneaux avant/arrière enroulés autour du corps."""
    from scipy import ndimage
    from scipy.interpolate import RegularGridInterpolator
    d=np.load(proj); xs,zs,F,B=d['xs'],d['zs'],d['F'],d['B']
    valid=~np.isnan(F)
    dist,(iz,ix)=ndimage.distance_transform_edt(~valid,return_indices=True)
    dist=dist*(xs[1]-xs[0])
    Fn=F[iz,ix]; Bn=B[iz,ix]; mid=(Fn+Bn)/2
    w=np.exp(-dist/fall)
    Fy=np.where(valid,F-off,mid+(Fn-off-mid)*w)
    By=np.where(valid,B+off,mid+(Bn+off-mid)*w)
    # ne jamais traverser : on garde l'écart minimal
    Fy=ndimage.gaussian_filter(Fy,sigma/(xs[1]-xs[0])); By=ndimage.gaussian_filter(By,sigma/(xs[1]-xs[0]))
    Fy=np.minimum(Fy,np.where(valid,F-off*0.6,Fy)); By=np.maximum(By,np.where(valid,B+off*0.6,By))
    jc=int(np.argmin(np.abs(zs-zclamp)))
    for j in range(len(zs)):
        if zs[j]<zclamp: Fy[j]=Fy[jc]; By[j]=By[jc]
    fi=RegularGridInterpolator((zs,xs),Fy,bounds_error=False,fill_value=None)
    bi=RegularGridInterpolator((zs,xs),By,bounds_error=False,fill_value=None)
    front=lambda x,z:(x*0.01,float(fi([[z,x]])[0])*0.01,z*0.01)
    back=lambda x,z:(x*0.01,float(bi([[z,x]])[0])*0.01,z*0.01)
    return front,back

def cut_head(body, zcut=0.715):
    import bmesh
    bm=bmesh.new(); bm.from_mesh(body.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z>zcut], context='VERTS')
    bm.to_mesh(body.data); bm.free(); body.data.update()
