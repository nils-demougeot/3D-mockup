import sys; sys.path.insert(0,'/tmp/blend')
from simlib import *
from hoodie_pattern import body as hbody, hood, seglen
import pickle
SP=1.1
reset(); bdy=make_body()
F=hbody(True); B=hbody(False)
lf=seglen(dict(F.segs)['neck_r']); lb=seglen(dict(B.segs)['neck_r'])
Fm=F.mesh(SP); Bm=B.mesh(SP); Hp=hood(lf,lb); Hm=Hp.mesh(SP)
wf,wb=wrap_maps(off=3.2,fall=6.0)
yf0=wf(0,62.5)[1]*100
hoodR=lambda u,v:( 0.115, (yf0+u)*0.01, (62.5+v)*0.01)
hoodL=lambda u,v:(-0.115, (yf0+u)*0.01, (62.5+v)*0.01)
SEAMS=['shoulder_r','sleevetop_r','underarm_r','side_r','side_l','underarm_l','sleevetop_l','shoulder_l']
seams=[(0,1,s) for s in SEAMS]
seams+=[(2,0,'hneck_f','neck_r'),(2,1,'hneck_b','neck_r',True),
        (3,0,'hneck_f','neck_l',True),(3,1,'hneck_b','neck_l'),
        (2,3,'hback'),(2,3,'htop')]
ob,info=build_cloth([(Fm,wf,False),(Bm,wb,True),(Hm,hoodR,False),(Hm,hoodL,True)],seams,'hoodie')
print('verts',info['nverts'],flush=True)
DRAPE=80; END=DRAPE+150
cloth_mod(ob,END,mass=0.25,bend=0.3,tension=20,shear=8,sew=5.0)
caps=run(ob,1,DRAPE,capture=(DRAPE,))
add_wind(strength=40.0,turb=15.0,size=0.25)
caps.update(run(ob,DRAPE+1,END,capture=tuple(range(DRAPE+10,END+1,10))))
pickle.dump({'F':Fm,'B':Bm,'H':Hm,'info':info,'caps':caps,'drape':DRAPE},open('/tmp/blend/hoodie_sim.pkl','wb'))
print('saved',sorted(caps))
