import sys; sys.path.insert(0,'/tmp/blend')
import numpy as np, pickle
from garment_export import *
from tshirt_pattern import tshirt
from pattern import resample
d=pickle.load(open('/tmp/blend/polo_sim.pkl','rb')); info=d['info']; kw=d['kw']
F,B=d['F'],d['B']; pad=0.5
bbox=(F[0][:,0].min()-pad,F[0][:,0].max()+pad,min(F[0][:,1].min(),B[0][:,1].min())-pad,max(F[0][:,1].max(),B[0][:,1].max())+pad)
segF=info['segs'][0]; segB=info['segs'][1]; oF,oB=info['offs']
front=[oF+i for i in segF['neck_l'][:-1]+segF['neck_r']]
back=[oB+i for i in segB['neck_l'][:-1]+segB['neck_r']]
loop=front+back[::-1][1:-1]
allpts=np.vstack([F[0],B[0]])
xs=[allpts[i][0] for i in loop]
pf=tshirt(True,**kw); pb=tshirt(False,**kw)
anim=list(range(90,221,20))
extras={'kind':'garment','bbox':bbox,'segsFront':{n:p.tolist() for n,p in pf.segs},'segsBack':{n:p.tolist() for n,p in pb.segs}}
g=export_garment('/tmp/blend/polo_sim.pkl',None,bbox,70,anim,[{'pts':F[0],'material':'front'},{'pts':B[0],'material':'back','mirror':True}],neck=None,extras=extras)
caps=d['caps']; pairs=info['pairs']; frames=[70]+anim; faces=np.array(info['faces'])
cps=[];cns=[]
for f in frames:
    P=seam_fix(to3(caps[f]),pairs); N=seam_normals(vnormals(P,faces),pairs)
    Dk=boundary_inner_dir(P,faces,loop)
    pos,idx,uv=collar_geom(P,N,loop,Dk,xs)
    cps.append(pos)
cns=[vnormals(p,idx) for p in cps]
prims=[{'pos':cps[0],'nrm':cns[0],'uv':uv,'idx':idx,'material':'collar','targets':[{'pos':p-cps[0],'nrm':n-cns[0]} for p,n in zip(cps[1:],cns[1:])]}]
# boutons (suivent le tissu)
btn_t=[]
from scipy.spatial import cKDTree
tree=cKDTree(F[0])
for zz in (59.5,54.5):
    vi=oF+tree.query([0.0,zz])[1]
    pos_frames=[]
    for f in frames:
        P=seam_fix(to3(caps[f]),pairs); N=seam_normals(vnormals(P,faces),pairs)
        c=P[vi]+N[vi]*0.18; nz=N[vi]
        a=np.cross(nz,[0,1,0]); a/=np.linalg.norm(a); b=np.cross(nz,a)
        ring=[];
        R=0.55; K=20
        pts=[c+nz*0.12]
        for k in range(K):
            th=2*np.pi*k/K; pts.append(c+(np.cos(th)*a+np.sin(th)*b)*R+nz*0.08)
        for k in range(K):
            th=2*np.pi*k/K; pts.append(c+(np.cos(th)*a+np.sin(th)*b)*R-nz*0.1)
        pos_frames.append(np.array(pts))
    idx=[]
    for k in range(K):
        idx+=[0,1+k,1+(k+1)%K]
        a0=1+k;a1=1+(k+1)%K;b0=1+K+k;b1=1+K+(k+1)%K
        idx+=[a0,b0,a1,a1,b0,b1]
    idx=np.array(idx).reshape(-1,3)
    n0=vnormals(pos_frames[0],idx)
    prims.append({'pos':pos_frames[0],'nrm':n0,'idx':idx,'material':'button','targets':[{'pos':p-pos_frames[0],'nrm':vnormals(p,idx)-n0} for p in pos_frames[1:]]})
g.mesh('collar',prims,weights=[0]*len(anim))
P,N,idx,nl=form_mesh('/tmp/blend/body_mesh.npz')
g.mesh('form',[{'pos':P,'nrm':N,'idx':idx,'material':'form'}])
print('bytes',g.save('/home/user/3D-mockup/assets/models/polo.glb'))
