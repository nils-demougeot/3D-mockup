import sys; sys.path.insert(0,'/tmp/blend')
import numpy as np, pickle
from garment_export import *
from hoodie_pattern import body as hbody, hood, seglen
d=pickle.load(open('/tmp/blend/hoodie_sim.pkl','rb')); info=d['info']
F,B,Hm=d['F'],d['B'],d['H']
pad=0.5
bbox=(F[0][:,0].min()-pad,F[0][:,0].max()+pad,min(F[0][:,1].min(),B[0][:,1].min())-pad,max(F[0][:,1].max(),B[0][:,1].max())+pad)
pf=hbody(True); pb=hbody(False)
extras={'kind':'garment','bbox':bbox,'segsFront':{n:p.tolist() for n,p in pf.segs},'segsBack':{n:p.tolist() for n,p in pb.segs}}
anim=list(range(90,231,20))
hb=(Hm[0][:,0].min(),Hm[0][:,0].max(),Hm[0][:,1].min(),Hm[0][:,1].max())
g=export_garment('/tmp/blend/hoodie_sim.pkl',None,bbox,80,anim,[{'pts':F[0],'material':'front'},{'pts':B[0],'material':'back','mirror':True},{'pts':Hm[0],'material':'hood'},{'pts':Hm[0],'material':'hood','mirror':True}],neck=None,extras=extras)
# cordons
caps=d['caps']; pairs=info['pairs']; frames=[80]+anim
oF=info['offs'][0]; nF=len(F[0]); front_idx=np.arange(oF,oF+nF)
segH=info['segs']; 
anch=[]
for k in (2,3):
    hf=segH[k]['hfront']; anch.append(info['offs'][k]+hf[-5])
cord_prims=[]
for side,a in zip((1,-1),anch):
    paths=[]
    for f in frames:
        P=seam_fix(to3(caps[f]),pairs)
        paths.append(cord_paths(P,front_idx,a,spread=side))
    meshes=[tube_mesh(pth[:-3],0.33) for pth in paths]
    aglets=[tube_mesh(pth[-4:],0.4) for pth in paths]
    for (ms,mat) in ((meshes,'cord'),(aglets,'metal')):
        pos0,idx=ms[0]; n0=vnormals(pos0,idx)
        tg=[]
        for pos,_ in ms[1:]:
            nn=vnormals(pos,idx); tg.append({'pos':pos-pos0,'nrm':nn-n0})
        cord_prims.append({'pos':pos0,'nrm':n0,'idx':idx,'material':mat,'targets':tg})
g.mesh('cords',cord_prims,weights=[0]*len(anim))
P,N,idx,nl=form_mesh('/tmp/blend/body_mesh.npz')
g.mesh('form',[{'pos':P,'nrm':N,'idx':idx,'material':'form'}])
print('bytes',g.save('/home/user/3D-mockup/assets/models/hoodie.glb'))
