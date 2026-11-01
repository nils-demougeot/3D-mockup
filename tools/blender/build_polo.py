import sys; sys.path.insert(0,'/tmp/blend')
from simlib import *
from tshirt_pattern import tshirt, SEAMS
import pickle
SP=1.05
reset(); body=make_body()
kw=dict(zf=65.0,zb=68.4,NPx=8.2,slen=23,sleeve_half=8.6,hem=-3.5)
F=tshirt(True,**kw).mesh(SP); B=tshirt(False,**kw).mesh(SP)
wf,wb=wrap_maps(off=3.0,fall=6.0)
ob,info=build_cloth([(F,wf,False),(B,wb,True)],[(0,1,s) for s in SEAMS],'polo')
print('verts',info['nverts'],flush=True)
DRAPE=70; END=DRAPE+150
cloth_mod(ob,END,mass=0.18,bend=0.12,tension=18,shear=6)
caps=run(ob,1,DRAPE,capture=(DRAPE,))
add_wind(strength=40.0,turb=15.0,size=0.25)
caps.update(run(ob,DRAPE+1,END,capture=tuple(range(DRAPE+10,END+1,10))))
pickle.dump({'F':F,'B':B,'info':info,'caps':caps,'drape':DRAPE,'kw':kw},open('/tmp/blend/polo_sim.pkl','wb'))
print('saved',sorted(caps))
