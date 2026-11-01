# Écriture GLB minimale (numpy) : maillages, UV, cibles de morphing, extras
import json, struct, numpy as np
class GLB:
    def __init__(self):
        self.bin=bytearray(); self.views=[]; self.acc=[]; self.meshes=[]; self.nodes=[]; self.mats=[]; self.matidx={}
    def _view(self, data, target=None):
        while len(self.bin)%4: self.bin.append(0)
        off=len(self.bin); self.bin+=data
        v={'buffer':0,'byteOffset':off,'byteLength':len(data)}
        if target: v['target']=target
        self.views.append(v); return len(self.views)-1
    def accessor(self, arr, kind):
        arr=np.ascontiguousarray(arr)
        if kind=='idx':
            a=arr.astype(np.uint32).ravel(); vi=self._view(a.tobytes(),34963)
            self.acc.append({'bufferView':vi,'componentType':5125,'count':int(a.size),'type':'SCALAR'})
        else:
            a=arr.astype(np.float32); n=a.shape[1]; vi=self._view(a.tobytes(),34962)
            d={'bufferView':vi,'componentType':5126,'count':int(a.shape[0]),'type':{2:'VEC2',3:'VEC3',4:'VEC4'}[n]}
            if kind=='pos': d['min']=a.min(0).tolist(); d['max']=a.max(0).tolist()
            self.acc.append(d)
        return len(self.acc)-1
    def material(self, name, color=(1,1,1,1), rough=0.9, metal=0.0, double=True):
        if name in self.matidx: return self.matidx[name]
        self.mats.append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':list(color),'roughnessFactor':rough,'metallicFactor':metal},'doubleSided':double})
        self.matidx[name]=len(self.mats)-1; return self.matidx[name]
    def mesh(self, name, prims, extras=None, target_names=None, weights=None):
        P=[]
        for p in prims:
            attrs={'POSITION':self.accessor(p['pos'],'pos'),'NORMAL':self.accessor(p['nrm'],'nrm')}
            if p.get('uv') is not None: attrs['TEXCOORD_0']=self.accessor(p['uv'],'uv')
            d={'attributes':attrs,'indices':self.accessor(p['idx'],'idx'),'material':self.material(p.get('material','default'))}
            if p.get('targets'):
                d['targets']=[{'POSITION':self.accessor(t['pos'],'pos'),'NORMAL':self.accessor(t['nrm'],'nrm')} for t in p['targets']]
            P.append(d)
        m={'name':name,'primitives':P}
        if extras: m['extras']=extras
        if target_names: m.setdefault('extras',{})['targetNames']=target_names
        if weights is not None: m['weights']=list(weights)
        self.meshes.append(m)
        self.nodes.append({'name':name,'mesh':len(self.meshes)-1})
    def save(self, path, extras=None):
        while len(self.bin)%4: self.bin.append(0)
        j={'asset':{'version':'2.0','generator':'merch-studio'},'scene':0,'scenes':[{'nodes':list(range(len(self.nodes)))}],
           'nodes':self.nodes,'meshes':self.meshes,'materials':self.mats,'accessors':self.acc,'bufferViews':self.views,
           'buffers':[{'byteLength':len(self.bin)}]}
        if extras: j['scenes'][0]['extras']=extras
        js=json.dumps(j,separators=(',',':')).encode()
        while len(js)%4: js+=b' '
        out=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(self.bin))
        out+=struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(self.bin),0x004E4942)+bytes(self.bin)
        open(path,'wb').write(out); return len(out)

def vnormals(P,T):
    n=np.zeros_like(P)
    a=P[T[:,0]];b=P[T[:,1]];c=P[T[:,2]]
    fn=np.cross(b-a,c-a)
    for k in range(3): np.add.at(n,T[:,k],fn)
    l=np.linalg.norm(n,axis=1,keepdims=True); l[l==0]=1
    return n/l
