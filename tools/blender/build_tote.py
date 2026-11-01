import sys; sys.path.insert(0,'/tmp/blend')
from simlib import *
from pattern import Pattern
import pickle
SP=1.0
W2=19; H=42; HX=9; HW=2.5
bag=Pattern()
bag.add('bottom',[[-W2,0],[W2,0]]); bag.add('side_r',[[W2,0],[W2,H]])
bag.add('top_c',[[W2,H],[HX+HW/2,H]]); bag.add('h2',[[HX+HW/2,H],[HX-HW/2,H]])
bag.add('top_b',[[HX-HW/2,H],[-HX+HW/2,H]]); bag.add('h1',[[-HX+HW/2,H],[-HX-HW/2,H]])
bag.add('top_a',[[-HX-HW/2,H],[-W2,H]]); bag.add('side_l',[[-W2,H],[-W2,0]])
Bm=bag.mesh(SP*0.84)
hd=Pattern(); L=59.5
hd.add('end1',[[0,0],[HW,0]]); hd.add('long_r',[[HW,0],[HW,L]]); hd.add('end2',[[HW,L],[0,L]]); hd.add('long_l',[[0,L],[0,0]])
Hm=hd.mesh(SP*0.84)
# chemin de l'anse (en cm, plan x-z)
def path(v):
    s1=2.75
    if v<=s1: return np.array([-HX,H+v]), np.array([0,1.0])
    if v>=L-s1: return np.array([HX,H+(L-v)]), np.array([0,-1.0])
    # demi-ellipse paramétrée par abscisse approx
    t=(v-s1)/(L-2*s1)*np.pi
    p=np.array([-HX*np.cos(t), H+s1+24*np.sin(t)]); tg=np.array([HX*np.sin(t),24*np.cos(t)]); tg/=np.linalg.norm(tg)
    return p,tg
def handle_map(y):
    def f(u,v):
        p,tg=path(v); nrm=np.array([tg[1],-tg[0]])
        q=p+nrm*(u-HW/2)
        return (q[0]*0.01,y,q[1]*0.01)
    return f
def extra(V,offs,segs):
    out=[]
    for hb,bp in ((2,0),(3,1)):
        for e,h in (('end1','h1'),('end2','h2')):
            a=[offs[hb]+i for i in segs[hb][e]]; b=[offs[bp]+i for i in segs[bp][h]]
            assert len(a)==len(b),(e,h,len(a),len(b))
            d1=sum(np.linalg.norm(V[i]-V[j]) for i,j in zip(a,b)); d2=sum(np.linalg.norm(V[i]-V[j]) for i,j in zip(a,b[::-1]))
            if d2<d1: b=b[::-1]
            out+=list(zip(a,b))
    return out
reset()
yb=0.012
ob,info=build_cloth([(Bm,lambda x,z:(x*0.01,-yb,z*0.01),False),(Bm,lambda x,z:(x*0.01,yb,z*0.01),True),
                     (Hm,handle_map(-yb-0.004),False),(Hm,handle_map(yb+0.004),True)],
                    [(0,1,'bottom'),(0,1,'side_r'),(0,1,'side_l')],'tote',extra=extra)
offs=info['offs']
# épingles au sommet des anses
vg=ob.vertex_groups.new(name='pin')
for hb in (2,3):
    pts=Hm[0]; idx=[offs[hb]+i for i,(u,v) in enumerate(pts) if abs(v-L/2)<14]
    vg.add(idx,1.0,'REPLACE')
print('verts',info['nverts'],flush=True)
DRAPE=80; END=DRAPE+150
cl=cloth_mod(ob,END,mass=0.3,bend=5.0,tension=40,shear=20,sew=6.0,quality=10,self_col=True,grav_on=6)
cl.settings.vertex_group_mass='pin'
caps=run(ob,1,DRAPE,capture=(DRAPE,))
add_wind(strength=25.0,turb=8.0,size=0.3)
caps.update(run(ob,DRAPE+1,END,capture=tuple(range(DRAPE+10,END+1,10))))
pickle.dump({'B':Bm,'Hh':Hm,'info':info,'caps':caps,'drape':DRAPE},open('/tmp/blend/tote_sim.pkl','wb'))
print('saved',sorted(caps))
