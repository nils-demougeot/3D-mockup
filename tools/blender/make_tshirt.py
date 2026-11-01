import sys; sys.path.insert(0,'/tmp/blend')
import numpy as np, pickle, json
from garment_export import *
from tshirt_pattern import tshirt
d=pickle.load(open('/tmp/blend/tshirt_sim.pkl','rb')); info=d['info']
F=d['F'];B=d['B']
allp=np.vstack([F[0],B[0]])
pad=0.5
bbox=(F[0][:,0].min()-pad,F[0][:,0].max()+pad,min(F[0][:,1].min(),B[0][:,1].min())-pad,max(F[0][:,1].max(),B[0][:,1].max())+pad)
segF=info['segs'][0]; segB=info['segs'][1]; oF,oB=info['offs']
front=[oF+i for i in segF['neck_l'][:-1]+segF['neck_r']]
back=[oB+i for i in segB['neck_l'][:-1]+segB['neck_r']]
loop=front+back[::-1][1:-1]
# contours de patron (cm) pour les coutures dessinées en texture
pf=tshirt(True); pb=tshirt(False)
segs={n:p.tolist() for n,p in pf.segs}
segsb={n:p.tolist() for n,p in pb.segs}
anim=list(range(90,221,20))
extras={'kind':'garment','bbox':bbox,'segsFront':segs,'segsBack':segsb,'animFrames':len(anim)}
g=export_garment('/tmp/blend/tshirt_sim.pkl',None,bbox,70,anim,[{'pts':F[0],'material':'front'},{'pts':B[0],'material':'back','mirror':True}],neck=loop,extras=extras)
P,N,idx,nl=form_mesh('/tmp/blend/body_mesh.npz')
print('form loops',nl,'verts',len(P))
g.mesh('form',[{'pos':P,'nrm':N,'idx':idx,'material':'form'}])
n=g.save('/home/user/3D-mockup/assets/models/tshirt.glb')
print('bytes',n)
