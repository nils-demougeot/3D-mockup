import sys; sys.path.insert(0,'/tmp/blend')
from simlib import *
from tshirt_pattern import tshirt, SEAMS
import pickle
SP=1.05
reset(); body=make_body(); save_body_npz(body,'/tmp/blend/body_mesh.npz')
F=tshirt(True).mesh(SP); B=tshirt(False).mesh(SP)
wf,wb=wrap_maps(off=3.0,fall=6.0)
ob,info=build_cloth([(F,wf,False),(B,wb,True)],[(0,1,s) for s in SEAMS],'shirt')
print('verts',info['nverts'])
DRAPE=70; END=DRAPE+150
cl=cloth_mod(ob,END)
caps=run(ob,1,DRAPE,capture=(DRAPE,))
add_wind(strength=40.0,turb=15.0,size=0.25)
caps.update(run(ob,DRAPE+1,END,capture=tuple(range(DRAPE+10,END+1,10))))
pickle.dump({'F':F,'B':B,'info':info,'caps':caps,'drape':DRAPE},open('/tmp/blend/tshirt_sim.pkl','wb'))
print('saved',sorted(caps))
