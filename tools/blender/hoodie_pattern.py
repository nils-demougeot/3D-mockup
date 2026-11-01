import numpy as np
from pattern import Pattern, bez, resample
def mirror(pts): return np.asarray(pts)[::-1]*np.array([-1,1])
ANG=-47
d=np.array([np.cos(np.radians(ANG)),np.sin(np.radians(ANG))]); n=np.array([d[1],-d[0]])
SH=C0_SH=None; NP=np.array([10.0,69.6])
LS=47.0; W0=21.0; W1=11.5
C0=np.array([20.3,58.6]); SH=C0+(W0/2)*(-n); SIDE=28.5; HEM=-6.0; RIB=6.5; HEMW=25.5
C0=np.array([20.3,58.6])
def sleeve_pts():
    w=lambda s: W1+(W0-W1)*(1-s/LS)
    C=lambda s: C0+s*d
    ST=C(LS)-(W1/2)*n; SB=C(LS)+(W1/2)*n
    pts=[SB]; s=LS
    while s>0:
        s-=0.5; p=C(s)+(w(s)/2)*n
        if p[0]<=SIDE+0.3: break
        pts.append(p)
    AX=np.array([SIDE,pts[-1][1]])
    return ST,SB,np.array(pts),AX
def body(front=True):
    zneck=62.5 if front else 67.6
    neck=bez(np.array([0,zneck]),np.array([6,zneck]),np.array([9.8,64.5 if front else 68.6]),NP,24)
    ST,SB,under,AX=sleeve_pts()
    p=Pattern()
    p.add('neck_r',neck)
    p.add('shoulder_r',[NP,SH])
    p.add('sleevetop_r',[SH,ST])
    p.add('cuff_r',[ST,SB])
    p.add('underarm_r',np.vstack([under,AX]))
    side=[AX,[SIDE,20],[SIDE-0.3,HEM+RIB+1],[HEMW,HEM+RIB-1],[HEMW,HEM]]
    p.add('side_r',side)
    p.add('hem',[[HEMW,HEM],[0,HEM-0.3],[-HEMW,HEM]])
    p.add('side_l',mirror(side))
    p.add('underarm_l',mirror(np.vstack([under,AX])))
    p.add('cuff_l',mirror([ST,SB]))
    p.add('sleevetop_l',mirror([SH,ST]))
    p.add('shoulder_l',mirror([NP,SH]))
    p.add('neck_l',mirror(neck))
    return p
def seglen(pts): pts=np.asarray(pts); return np.linalg.norm(np.diff(pts,axis=0),axis=1).sum()
def hood(lf, lb, side=1):
    """moitié de capuche (profil y,z) ; bord du cou = lf (devant) + lb (dos)"""
    # coordonnées 2D (u = avant->arrière, v = hauteur)
    A=np.array([0.0,0.0])          # bas avant (centre devant du cou)
    Bn=np.array([lf+lb*0.92,1.5])     # point bas arrière (milieu dos du cou)
    p=Pattern()
    neck=bez(A,np.array([lf*0.5,-2.5]),np.array([lf+lb*0.4,-1.0]),Bn,30)
    # ajuster la longueur : 2 segments de longueurs lf et lb
    L=np.concatenate([[0],np.cumsum(np.linalg.norm(np.diff(neck,axis=0),axis=1))]); neck=neck*( (lf+lb)/L[-1])
    L=np.concatenate([[0],np.cumsum(np.linalg.norm(np.diff(neck,axis=0),axis=1))])
    k=np.searchsorted(L,lf); 
    mid=neck[k-1]+(neck[k]-neck[k-1])*((lf-L[k-1])/(L[k]-L[k-1]))
    nf=np.vstack([neck[:k],mid]); nb=np.vstack([mid,neck[k:]])
    E=nb[-1]
    back=bez(E,E+np.array([4,10]),E+np.array([2,27]),np.array([E[0]-10,36]),30)
    top=bez(back[-1],back[-1]+np.array([-6,3]),np.array([4,36]),np.array([0.5,31]),20)
    front=bez(top[-1],np.array([-1.5,20]),np.array([-1.0,8]),A,20)
    p.add('hneck_f',nf); p.add('hneck_b',nb)
    p.add('hback',back); p.add('htop',top); p.add('hfront',front)
    return p
