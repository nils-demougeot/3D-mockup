import numpy as np
from pattern import Pattern, bez
def mirror(pts): return np.asarray(pts)[::-1]*np.array([-1,1])
def tshirt(front=True, sleeve_half=9.0, zf=61.0, zb=67.3, NPx=9.5, slen=21, hem=-1.5):
    zneck = zf if front else zb
    NP=np.array([NPx,69.5])
    if front: neck_r=bez(np.array([0,zneck]),np.array([NPx*0.58,zneck]),np.array([NPx*0.97,(zneck+69.5)/2]),NP,24)
    else: neck_r=bez(np.array([0,zneck]),np.array([NPx*0.53,zneck]),np.array([NPx*0.93,68.3]),NP,24)
    SH=np.array([27.0,65.3])
    d=np.array([np.cos(np.radians(-47)),np.sin(np.radians(-47))]); n=np.array([d[1],-d[0]])  # n pointe vers le bas/intérieur
    ST=SH+slen*d                       # bout du dessus de manche
    SB=ST+2*sleeve_half*n            # bout du dessous
    # point d'aisselle
    AX=np.array([26.6,40.5])
    p=Pattern()
    p.add('neck_r',neck_r[:-1].tolist()+[NP.tolist()])
    p.add('shoulder_r',[NP,(NP+SH)/2+np.array([0,0.4]),SH])
    p.add('sleevetop_r',[SH,ST])
    p.add('cuff_r',[ST,SB])
    p.add('underarm_r',[SB,AX])
    p.add('side_r',[AX,[26.4,25],[26.2,10],[26.6,hem]])
    p.add('hem',[[26.6,hem],[0,hem-0.3],[-26.6,hem]])
    p.add('side_l',mirror([AX,[26.4,25],[26.2,10],[26.6,hem]]))
    p.add('underarm_l',mirror([SB,AX]))
    p.add('cuff_l',mirror([ST,SB]))
    p.add('sleevetop_l',mirror([SH,ST]))
    p.add('shoulder_l',mirror([NP,(NP+SH)/2+np.array([0,0.4]),SH]))
    p.add('neck_l',mirror(neck_r))
    return p
SEAMS=['shoulder_r','sleevetop_r','underarm_r','side_r','side_l','underarm_l','sleevetop_l','shoulder_l']
OPEN=['neck_r','neck_l','cuff_r','cuff_l','hem']
