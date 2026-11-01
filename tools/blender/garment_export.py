import sys; sys.path.insert(0,'/tmp/blend')
import numpy as np, pickle, json
from glb import GLB, vnormals

def to3(co):  # Blender (m, Z-up, front -Y) -> three (cm, Y-up, front +Z)
    co=np.asarray(co)
    return np.stack([co[:,0]*100, co[:,2]*100, -co[:,1]*100],1)

def seam_fix(P, pairs):
    P=P.copy()
    for a,b in pairs:
        m=(P[a]+P[b])/2; P[a]=m; P[b]=m
    return P
def seam_normals(N, pairs):
    N=N.copy()
    for a,b in pairs:
        m=N[a]+N[b]; m/=np.linalg.norm(m)+1e-9; N[a]=m; N[b]=m
    return N

def boundary_inner_dir(P, T, loop):
    """direction sortante (vers l'extérieur du tissu) en chaque sommet de bord"""
    nb={}
    for t in T:
        for k in range(3):
            nb.setdefault(t[k],set()).update((t[(k+1)%3],t[(k+2)%3]))
    ls=set(loop); D=[]
    for i in loop:
        inner=[j for j in nb[i] if j not in ls]
        q=P[inner].mean(0) if inner else P[i]
        d=P[i]-q; D.append(d/(np.linalg.norm(d)+1e-9))
    return np.array(D)

def band_geom(P, N, loop, D, width=1.9, roll=0.35, rows=4, closed=True):
    L=len(loop); pos=[]; nrm=[]; uv=[]
    seg=np.linalg.norm(np.diff(P[loop],axis=0,append=P[loop][:1]),axis=1); s=np.concatenate([[0],np.cumsum(seg)])[:L]; tot=s[-1]+seg[-1]
    for r in range(rows+1):
        t=r/rows
        off=D*(width*t)[...,None] if np.ndim(t) else D*width*t
        bulge=np.sin(t*np.pi)*roll
        pos.append(P[loop]+off+N[loop]*bulge)
        uv.append(np.stack([s/tot*60, np.full(L,t)],1))
    pos=np.concatenate(pos); uv=np.concatenate(uv)
    idx=[]
    for r in range(rows):
        for i in range(L if closed else L-1):
            a=r*L+i; b=r*L+(i+1)%L; c=a+L; d=b+L
            idx+= [a,b,d,a,d,c]
    idx=np.array(idx).reshape(-1,3)
    return pos, idx, uv

def ordered(seglist): return list(seglist)

def export_garment(sim_pkl, out, pattern_bbox, base_frame, anim_frames, panels_meta, neck=None, extras=None, flipback=True):
    d=pickle.load(open(sim_pkl,'rb')); info=d['info']; caps=d['caps']
    faces=np.array(info['faces']); pairs=info['pairs']
    frames=[base_frame]+list(anim_frames)
    Ps=[seam_fix(to3(caps[f]),pairs) for f in frames]
    Ns=[seam_normals(vnormals(P,faces),pairs) for P in Ps]
    minX,maxX,minZ,maxZ=pattern_bbox; W=maxX-minX; H=maxZ-minZ
    # UV par panneau
    nV=len(Ps[0]); UV=np.zeros((nV,2))
    for k,pm in enumerate(panels_meta):
        pts=pm['pts']; off=info['offs'][k]
        u=(pts[:,0]-minX)/W; v=(pts[:,1]-minZ)/H
        if pm.get('mirror'): u=1-u
        UV[off:off+len(pts)]=np.stack([u,v],1)
    g=GLB(); prims=[]
    for k,pm in enumerate(panels_meta):
        a,b=info['ranges'][k]; F=faces[a:b]
        used=np.unique(F); remap=-np.ones(nV,int); remap[used]=np.arange(len(used))
        prim={'pos':Ps[0][used],'nrm':Ns[0][used],'uv':UV[used],'idx':remap[F],'material':pm['material'],
              'targets':[{'pos':P[used]-Ps[0][used],'nrm':N[used]-Ns[0][used]} for P,N in zip(Ps[1:],Ns[1:])]}
        prims.append(prim)
    if neck is not None:
        loop=neck
        D=boundary_inner_dir(Ps[0],faces,loop)
        bp=[];bn=[]
        for P,N in zip(Ps,Ns):
            Dk=boundary_inner_dir(P,faces,loop)
            pos,idx,uv=band_geom(P,N,loop,Dk)
            bp.append(pos)
        nrm0=vnormals(bp[0],idx)
        bnr=[vnormals(p,idx) for p in bp]
        prims.append({'pos':bp[0],'nrm':bnr[0],'uv':uv,'idx':idx,'material':'rib',
                      'targets':[{'pos':p-bp[0],'nrm':n-bnr[0]} for p,n in zip(bp[1:],bnr[1:])]})
    g.mesh('garment',prims,extras=extras,weights=[0]*(len(frames)-1))
    return g

def form_mesh(npz, neck_z=0.715, hip_z=-0.10, arm_cut=0.25, shoulder=(0.19,0.59), armdir=(0.682,-0.731)):
    d=np.load(npz); co=d['co']; T=d['tris']
    x,z=co[:,0],co[:,2]
    S=np.array(shoulder); A=np.array(armdir)
    rel=np.stack([np.abs(x)-S[0], z-S[1]],1)
    along=rel@A
    keepv=(z<neck_z)&(z>hip_z)&~((np.abs(x)>0.12)&(along>arm_cut))
    keepT=T[keepv[T].all(1)]
    # bords -> bouchons
    from collections import defaultdict
    ec=defaultdict(int)
    for t in keepT:
        for k in range(3):
            e=(t[k],t[(k+1)%3]); ec[e]+=1
    bedges=[(a,b) for (a,b) in ec if (b,a) not in ec]
    nxt={a:b for a,b in bedges}
    seen=set(); loops=[]
    for a in list(nxt):
        if a in seen: continue
        lp=[a]; seen.add(a); c=nxt[a]
        while c!=a and c in nxt and c not in seen:
            lp.append(c); seen.add(c); c=nxt[c]
        if len(lp)>5: loops.append(lp)
    P=co.copy(); tris=list(map(tuple,keepT)); caps=[]
    for lp in loops:
        mz=P[lp][:,2].mean()
        if mz>0.5: P[lp,2]=neck_z
        elif mz<0.0: P[lp,2]=hip_z
        else:
            sgn=np.sign(P[lp][:,0].mean())
            A3=np.array([sgn*A[0],0,A[1]]); S3=np.array([sgn*S[0],0,S[1]])
            for v in lp:
                rel3=P[v]-S3; al=rel3[0]*A3[0]+rel3[2]*A3[2]
                P[v]=P[v]+A3*(arm_cut-al)
        cidx=len(P); P=np.vstack([P,P[lp].mean(0)])
        for i in range(len(lp)):
            caps.append((lp[(i+1)%len(lp)],lp[i],cidx))
    used=np.unique(np.array(tris+caps))
    remap=-np.ones(len(P),int); remap[used]=np.arange(len(used))
    P3=to3(P[used]); body=remap[np.array(tris)]; cap=remap[np.array(caps)]
    Nb=vnormals(P3,body)
    # sommets des bouchons : normales plates séparées
    capv=np.unique(cap); 
    P_all=np.vstack([P3,P3[capv]]); m2=-np.ones(len(P3),int); m2[capv]=len(P3)+np.arange(len(capv))
    capT=m2[cap]
    N_all=np.vstack([Nb,np.zeros((len(capv),3))])
    cn=vnormals(P_all,capT)
    N_all[len(P3):]=cn[len(P3):]
    idx=np.vstack([body,capT])
    return P_all,N_all,idx,len(loops)

def tube_mesh(path, r, radial=10):
    path=np.asarray(path); n=len(path)
    T=np.gradient(path,axis=0); T/=np.linalg.norm(T,axis=1,keepdims=True)+1e-9
    up=np.array([0,0,1.0]); pos=[]
    for i in range(n):
        a=np.cross(T[i],up); 
        if np.linalg.norm(a)<1e-3: a=np.array([1.0,0,0])
        a/=np.linalg.norm(a); b=np.cross(T[i],a)
        for k in range(radial):
            th=2*np.pi*k/radial; pos.append(path[i]+r*(np.cos(th)*a+np.sin(th)*b))
    idx=[]
    for i in range(n-1):
        for k in range(radial):
            a0=i*radial+k; a1=i*radial+(k+1)%radial; b0=a0+radial; b1=a1+radial
            idx+=[a0,b0,a1,a1,b0,b1]
    # bouchons
    pos=np.array(pos); c0=len(pos); c1=c0+1
    pos=np.vstack([pos,path[0],path[-1]])
    for k in range(radial):
        idx+=[c0,(k+1)%radial,k]; idx+=[c1,(n-1)*radial+k,(n-1)*radial+(k+1)%radial]
    return pos,np.array(idx).reshape(-1,3)

def cord_paths(P, front_idx, anchor, length=28.0, step=1.0, spread=0.0):
    from scipy.spatial import cKDTree
    FP=P[front_idx]; tree=cKDTree(FP[:,:2])
    p=P[anchor].copy()+np.array([0,0,0.4]); pts=[p.copy()]
    for k in range(int(length/step)):
        p=p+np.array([spread*0.02*(k<6), -step, 0])
        ii=tree.query_ball_point(p[:2],1.6)
        if ii: p[2]=max(FP[ii][:,2].max()+0.45, p[2]-0.5)
        pts.append(p.copy())
    pts=np.array(pts)
    # lissage
    for _ in range(3): pts[1:-1]=(pts[:-2]+2*pts[1:-1]+pts[2:])/4
    return pts

def collar_geom(P, N, loop, D, xs, stand=2.6, leaf=4.2, point=6.8, rows=14, gap=1.3):
    """Col de polo : pied de col (montant) puis rabat replié vers l'extérieur avec pointes devant.
    xs = coordonnées x (cm) des sommets de la boucle pour repérer l'avant."""
    sel=[i for i,x in enumerate(xs)]
    L=len(loop); pos=[]; uv=[]
    D=np.array(D,float)
    for _ in range(6): D=(np.roll(D,1,0)+2*D+np.roll(D,-1,0))/4
    D/=np.linalg.norm(D,axis=1,keepdims=True)
    Ns=N[loop].copy()
    for _ in range(6): Ns=(np.roll(Ns,1,0)+2*Ns+np.roll(Ns,-1,0))/4
    Ns/=np.linalg.norm(Ns,axis=1,keepdims=True)
    # boucle ouverte : on coupe au centre devant (|x| petit et côté avant)
    seg=np.linalg.norm(np.diff(P[loop],axis=0,append=P[loop][:1]),axis=1); s=np.concatenate([[0],np.cumsum(seg)])[:L]
    front=np.array([P[i][2] for i in loop])  # z three : avant positif
    zc=front.max()
    for r in range(rows+1):
        t=r/rows
        row=[]
        for k,i in enumerate(loop):
            p=P[i]; nrm=Ns[k]; dd=D[k]
            frontness=max(0.0,(p[2]-(zc-12))/12)  # 0 dos -> 1 devant
            ln=leaf+(point-leaf)*frontness**3
            if t<=0.35: q=p+dd*stand*(t/0.35)+nrm*0.05
            elif t<=0.45:
                a=(t-0.35)/0.1*np.pi
                top=p+dd*stand
                q=top+nrm*(0.35*np.sin(a))+dd*0.25*np.sin(a)
            else:
                u=(t-0.45)/0.55
                top=p+dd*stand
                q=top+nrm*(0.5+2.6*u)-dd*ln*u
            row.append(q)
        pos.append(row); uv.append([[s[k]/s[-1]*30,t] for k in range(L)])
    pos=np.array(pos)
    for _ in range(3): pos[2:]=(np.roll(pos[2:],1,1)+2*pos[2:]+np.roll(pos[2:],-1,1))/4
    pos=pos.reshape(-1,3); uv=np.array(uv).reshape(-1,2)
    # couper l'avant : on retire les quads dont les deux sommets sont dans la zone centrale avant
    xsv=np.array(xs); cut=set(k for k in range(L) if abs(xsv[k])<gap and P[loop[k]][2]>zc-6)
    idx=[]
    for r in range(rows):
        for k in range(L):
            k2=(k+1)%L
            if k in cut or k2 in cut: continue
            a=r*L+k; b=r*L+k2; c=a+L; d=b+L
            idx+=[a,b,d,a,d,c]
    return pos,np.array(idx).reshape(-1,3),uv
