# Patrons 2D (cm, x à droite, z en haut) + maillage triangulaire uniforme
import numpy as np
from scipy.spatial import Delaunay

def bez(p0,p1,p2,p3,n):
    t=np.linspace(0,1,n)[:,None]
    return (1-t)**3*p0+3*(1-t)**2*t*p1+3*(1-t)*t**2*p2+t**3*p3

def resample(poly, spacing):
    poly=np.asarray(poly,float)
    seg=np.linalg.norm(np.diff(poly,axis=0),axis=1); L=np.concatenate([[0],np.cumsum(seg)])
    n=max(2,int(round(L[-1]/spacing))+1)
    s=np.linspace(0,L[-1],n)
    return np.stack([np.interp(s,L,poly[:,0]),np.interp(s,L,poly[:,1])],1)

class Pattern:
    """Contour = suite de segments nommés (polyline). Chaque segment a une étiquette (couture ou ouverture)."""
    def __init__(self): self.segs=[]
    def add(self,name,pts): self.segs.append((name,np.asarray(pts,float)))
    def mesh(self, spacing):
        bpts=[]; labels=[]  # label of the edge starting at point
        seg_idx={}
        for name,pts in self.segs:
            r=resample(pts,spacing)
            start=len(bpts)
            for k in range(len(r)-1):
                bpts.append(r[k]); labels.append(name)
            seg_idx[name]=list(range(start,start+len(r)-1))+[(start+len(r)-1)%10**9]
        bpts=np.array(bpts); nb=len(bpts)
        # fix last index of each seg -> start of next seg
        order=[n for n,_ in self.segs]
        for i,n in enumerate(order):
            nxt=order[(i+1)%len(order)]
            seg_idx[n][-1]=seg_idx[nxt][0]
        # points intérieurs (grille hexagonale)
        mn=bpts.min(0); mx=bpts.max(0)
        pts=[]
        dy=spacing*np.sqrt(3)/2
        from matplotlib.path import Path as MPath
        path=MPath(bpts)
        ys=np.arange(mn[1],mx[1],dy)
        for j,y in enumerate(ys):
            xs=np.arange(mn[0]+(spacing/2 if j%2 else 0),mx[0],spacing)
            pts.extend([(x,y) for x in xs])
        pts=np.array(pts)
        inside=path.contains_points(pts)
        pts=pts[inside]
        # distance au bord
        from scipy.spatial import cKDTree
        dense=np.concatenate([resample(np.vstack([bpts,bpts[:1]]),spacing/4)])
        d,_=cKDTree(dense).query(pts)
        pts=pts[d>spacing*0.6]
        allp=np.vstack([bpts,pts])
        tri=Delaunay(allp)
        T=tri.simplices
        cent=allp[T].mean(1)
        keep=path.contains_points(cent)
        T=T[keep]
        # orientation CCW
        a=allp[T[:,0]];b=allp[T[:,1]];c=allp[T[:,2]]
        cr=(b[:,0]-a[:,0])*(c[:,1]-a[:,1])-(b[:,1]-a[:,1])*(c[:,0]-a[:,0])
        T[cr<0]=T[cr<0][:,[0,2,1]]
        T=T[np.abs(cr)>1e-9]
        return allp,T,seg_idx,nb
