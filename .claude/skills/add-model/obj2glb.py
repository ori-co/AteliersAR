"""Convertit un export OBJ de Tinkercad (.zip, ou .obj avec son .mtl) en .glb pour 8th Wall.
Usage : python3 obj2glb.py entree.(zip|obj) sortie.glb
- un objet par pièce et par couleur, matériau non métallique, normales calculées
- Z vers le haut (Tinkercad) -> Y vers le haut (glTF), unités inchangées
- signale les couleurs utilisées mais absentes du .mtl"""
import sys, os, re, zipfile, tempfile, glob
import numpy as np, trimesh

def load(src):
    if src.lower().endswith('.zip'):
        tmp = tempfile.mkdtemp(); zipfile.ZipFile(src).extractall(tmp)
        src = glob.glob(os.path.join(tmp, '**', '*.obj'), recursive=True)[0]
    folder = os.path.dirname(src)
    mats, V, groups, cur, obj = {}, [], {}, None, 'obj'
    for line in open(src, encoding='utf-8', errors='ignore'):
        p = line.split()
        if not p: continue
        if p[0] == 'mtllib':
            path = os.path.join(folder, ' '.join(p[1:])); name = None
            if os.path.exists(path):
                for l in open(path, encoding='utf-8', errors='ignore'):
                    q = l.split()
                    if q and q[0] == 'newmtl': name = q[1]
                    elif q and q[0] == 'Kd' and name: mats[name] = [float(x) for x in q[1:4]]
        elif p[0] == 'o': obj = p[1] if len(p) > 1 else 'obj'
        elif p[0] == 'v': V.append([float(x) for x in p[1:4]])
        elif p[0] == 'usemtl': cur = p[1]
        elif p[0] == 'f':
            idx = [int(x.split('/')[0]) for x in p[1:]]
            idx = [i - 1 if i > 0 else len(V) + i for i in idx]
            for k in range(1, len(idx) - 1):
                groups.setdefault((obj, cur), []).append([idx[0], idx[k], idx[k + 1]])
    return np.array(V), groups, mats

def convert(src, dst):
    V, groups, mats = load(src)
    scene = trimesh.Scene()
    for (obj, name), faces in groups.items():
        if name not in mats:
            print(f"  ATTENTION : couleur '{name}' absente du .mtl ({len(faces)} faces), mise en gris")
        rgb = mats.get(name, [0.6, 0.6, 0.6])
        m = trimesh.Trimesh(V, np.array(faces), process=True)
        m.remove_unreferenced_vertices(); m.fix_normals()
        m.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
            name=str(name), baseColorFactor=rgb + [1.0], metallicFactor=0.0, roughnessFactor=0.8))
        scene.add_geometry(m, geom_name=f'{obj}_{name}')
        print(f"  {obj} / {name} : #{''.join(f'{round(c*255):02X}' for c in rgb)}, {len(faces)} faces")
    scene.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
    scene.export(dst, include_normals=True)
    print(f"{dst} : {len(scene.geometry)} objet(s)")

if __name__ == '__main__':
    convert(sys.argv[1], sys.argv[2])
