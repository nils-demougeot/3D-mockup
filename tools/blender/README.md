# Génération des modèles 3D (Blender)

Les vêtements et le tote bag sont produits par **simulation de tissu** dans Blender (module Python `bpy`) :
patrons 2D → panneaux maillés → coutures (sewing springs) → drapé sur un mannequin MakeHuman (CC0) →
poses « vent » enregistrées en morph targets → export GLB (`assets/models/*.glb`).

```bash
python3 -m venv venv && ./venv/bin/pip install bpy scipy matplotlib
git clone --depth 1 https://github.com/makehumancommunity/makehuman /tmp/repos/mh   # mannequin CC0
./venv/bin/python t4.py              # carte de profondeur du corps (placement des panneaux)
./venv/bin/python build_tshirt.py    # simulation  -> /tmp/blend/tshirt_sim.pkl
./venv/bin/python make_tshirt.py     # export      -> assets/models/tshirt.glb
```

Les chemins `/tmp/blend` et `/tmp/repos/mh` sont codés en dur dans les scripts.
Mannequin : MakeHuman base mesh + cibles « caucasian-male-young », licence CC0.
