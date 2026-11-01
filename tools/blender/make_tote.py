import sys; sys.path.insert(0,'/tmp/blend')
import numpy as np, pickle
from garment_export import *
d=pickle.load(open('/tmp/blend/tote_sim.pkl','rb')); info=d['info']
Bm,Hm=d['B'],d['Hh']
bbox=(-19.5,19.5,-0.5,42.5)
anim=list(range(90,231,20))
hb=(0,2.5,0,59.5)
g=export_garment('/tmp/blend/tote_sim.pkl',None,bbox,80,anim,[{'pts':Bm[0],'material':'front'},{'pts':Bm[0],'material':'back','mirror':True},{'pts':Hm[0],'material':'strap'},{'pts':Hm[0],'material':'strap'}],neck=None,extras={'kind':'garment','bbox':bbox})
print('bytes',g.save('/home/user/3D-mockup/assets/models/tote.glb'))
