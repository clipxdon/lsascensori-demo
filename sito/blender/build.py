# LS Ascensori v2: impianto ascensore modellato in Blender (bpy headless).
# Unità metri, Z in alto. Blender Y positivo = verso il fondo del vano (in three.js: -Z).
# Uso: python build.py <outdir> [--render] [--samples N]
import bpy, bmesh, math, os, sys, json, time
from mathutils import Vector, Matrix

OUT = sys.argv[sys.argv.index('build.py') + 1] if 'build.py' in sys.argv[-3:] or True else 'out'
args = [a for a in sys.argv if not a.endswith('.py')]
OUT = args[1] if len(args) > 1 and not args[1].startswith('--') else 'out'
DO_RENDER = '--render' in sys.argv
SAMPLES = int(sys.argv[sys.argv.index('--samples') + 1]) if '--samples' in sys.argv else 48
os.makedirs(OUT, exist_ok=True)
T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene

# ------------------------------------------------------------------ dimensioni (identiche al sito)
FLOORS = 7
FH = 3.2              # interpiano
SW, SD = 2.6, 2.0     # vano interno
CAR_X = 0.25
CW, CH, CD = 1.15, 2.2, 1.35
FP = 0.2              # pannelli fissi frontali della cabina
OW = CW - 2 * FP      # luce porta
TOP = (FLOORS - 1) * FH + 3.6
WALL = 0.2
RAIL_L = CAR_X - CW / 2 - 0.13
RAIL_R = CAR_X + CW / 2 + 0.13
CWX = -SW / 2 + 0.34   # asse contrappeso

def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1.0,)

# ------------------------------------------------------------------ materiali (i nomi li riconosce il sito)
MATS = {}
def mat(name, color, rough=0.5, metal=0.0, emit=None, estr=0.0, noise_bump=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = lin(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = lin(emit); b.inputs['Emission Strength'].default_value = estr
    if noise_bump:
        tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = 18; nz.inputs['Detail'].default_value = 8
        bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = noise_bump
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector']); nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
        # macchie del cemento
        cr = nt.nodes.new('ShaderNodeValToRGB'); nz2 = nt.nodes.new('ShaderNodeTexNoise'); nz2.inputs['Scale'].default_value = 1.6
        nt.links.new(tc.outputs['Object'], nz2.inputs['Vector']); nt.links.new(nz2.outputs['Fac'], cr.inputs['Fac'])
        cr.color_ramp.elements[0].color = tuple(x * 0.78 for x in lin(color)[:3]) + (1,)
        cr.color_ramp.elements[1].color = lin(color)
        nt.links.new(cr.outputs['Color'], b.inputs['Base Color'])
    MATS[name] = m
    return m

mat('Cemento', '#8E8A83', 0.95, noise_bump=0.25)
mat('Intonaco', '#D9D5CC', 0.9)
mat('Atrio', '#D9D5CC', 0.9)
mat('Solaio', '#6A6864', 0.92, noise_bump=0.2)
mat('Inox', '#C9CED3', 0.28, 1.0)
mat('InoxScuro', '#4B5056', 0.4, 0.9)
mat('Acciaio', '#5A6066', 0.42, 0.85)
mat('Guida', '#AEB4BA', 0.18, 1.0)
mat('Staffa', '#2E3A45', 0.6, 0.3)
mat('Telaio', '#33383E', 0.5, 0.6)
mat('Specchio', '#FFFFFF', 0.03, 1.0)
mat('Granito', '#1E1F22', 0.3, 0.0)
mat('LED', '#FFFFFF', 0.6, emit='#EAF4FF', estr=30.0)
mat('Giallo', '#E8B10C', 0.55)
mat('Nero', '#151618', 0.6)
mat('Rosso', '#C8222A', 0.45, 0.1)
mat('Vetro', '#0A0C0F', 0.08, 0.5)
mat('Gomma', '#101112', 0.85)
mat('Fune', '#7F858B', 0.45, 0.9)
mat('Ghisa', '#2A2C30', 0.7, 0.4)
mat('Pulsante', '#D5DADF', 0.22, 1.0, emit='#7FA6FF', estr=0.0)
mat('Alluminio', '#B9BDC1', 0.35, 1.0)

# ------------------------------------------------------------------ helper geometrici
COLL = {}
def coll(name):
    if name not in COLL:
        c = bpy.data.collections.new(name); scn.collection.children.link(c); COLL[name] = c
    return COLL[name]

def finish(ob, m, group, bevel=0.0, smooth=False):
    ob.data.materials.append(MATS[m] if isinstance(m, str) else m)
    for c in ob.users_collection: c.objects.unlink(ob)
    coll(group).objects.link(ob)
    if bevel:
        bv = ob.modifiers.new('bv', 'BEVEL'); bv.width = bevel; bv.segments = 2; bv.limit_method = 'ANGLE'
    if smooth:
        for p in ob.data.polygons: p.use_smooth = True
    ob['grp'] = group
    return ob

def box(size, loc, m, group, bevel=0.0, rot=(0, 0, 0), name='box'):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object; ob.name = name
    ob.scale = size; bpy.ops.object.transform_apply(scale=True)
    return finish(ob, m, group, bevel)

def cyl(r, depth, loc, m, group, axis='Z', verts=24, name='cyl', bevel=0.0, r2=None):
    rot = {'Z': (0, 0, 0), 'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0)}[axis]
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot, vertices=verts)
    ob = bpy.context.active_object; ob.name = name
    ob = finish(ob, m, group, bevel)
    for p in ob.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return ob

def torus(R, r, loc, m, group, axis='X', name='torus'):
    rot = {'Z': (0, 0, 0), 'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0)}[axis]
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=32, minor_segments=8)
    ob = bpy.context.active_object; ob.name = name
    ob = finish(ob, m, group, smooth=True)
    return ob

def profile(points, z0, z1, x, y, m, group, name='prof'):
    """Estrude un profilo 2D (in XY) lungo Z: per guide a T e angolari."""
    bm = bmesh.new()
    bot = [bm.verts.new((x + px, y + py, z0)) for px, py in points]
    top = [bm.verts.new((x + px, y + py, z1)) for px, py in points]
    n = len(points)
    bm.faces.new(bot[::-1]); bm.faces.new(top)
    for i in range(n):
        bm.faces.new((bot[i], bot[(i + 1) % n], top[(i + 1) % n], top[i]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); scn.collection.objects.link(ob)
    return finish(ob, m, group)

def helix(R, r, h, turns, loc, m, group, name='molla'):
    pts = []
    N = int(turns * 24)
    for i in range(N + 1):
        a = i / 24 * 2 * math.pi
        pts.append((loc[0] + R * math.cos(a), loc[1] + R * math.sin(a), loc[2] + h * i / N))
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 2
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts): sp.points[i].co = (*p, 1)
    ob = bpy.data.objects.new(name, cu); scn.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.convert(target='MESH'); ob.select_set(False)
    return finish(ob, m, group, smooth=True)

# T89: ala 89 mm, altezza 62, anima 16 (profilo nel piano XY, anima verso +X)
def t_rail(w, h, t, tf):
    return [(0, -w / 2), (tf, -w / 2), (tf, -t / 2), (h, -t / 2), (h, t / 2), (tf, t / 2), (tf, w / 2), (0, w / 2)]

# ================================================================== VANO (statico)
G = 'Vano'
H_ALL = TOP + 1.6
# parete di fondo e laterali (fuori dal vano interno)
box((SW + 2 * WALL, WALL, H_ALL), (0, SD / 2 + WALL / 2, H_ALL / 2 - 1.5), 'Cemento', G, name='fondo')
box((WALL, SD + WALL, H_ALL), (-SW / 2 - WALL / 2, WALL / 2, H_ALL / 2 - 1.5), 'Cemento', G, name='sx')
# parete destra tagliata in sezione: resta solo una lesena sul fondo
box((WALL, 0.35, H_ALL), (SW / 2 + WALL / 2, SD / 2 - 0.175 + WALL / 2, H_ALL / 2 - 1.5), 'Cemento', G, name='dx')
box((SW, SD, 0.2), (0, 0, -1.5 - 0.1), 'Cemento', G, name='fossa')
# soletta di copertura sopra il macchinario
box((SW + 2 * WALL, SD + WALL, 0.25), (0, WALL / 2, TOP + 1.45), 'Solaio', G, name='tetto')

for i in range(FLOORS):
    z = i * FH
    # solaio di piano tagliato in sezione (davanti al vano) + soglia di piano in alluminio
    box((SW + 2 * WALL + 1.6, 0.9, 0.3), (0, -SD / 2 - 0.45, z - 0.15), 'Solaio', G, name=f'solaio{i}')
    box((SW + 2 * WALL + 1.6, 0.9, 0.012), (0, -SD / 2 - 0.45, z + 0.006), 'Granito' if i == 0 else 'Intonaco', G, name=f'pavimento{i}')
    box((OW + 0.12, 0.09, 0.02), (CAR_X, -SD / 2 - 0.045, z + 0.01), 'Alluminio', G, name=f'soglia{i}')
    for k in range(6):  # scanalature della soglia
        box((OW + 0.1, 0.004, 0.004), (CAR_X, -SD / 2 - 0.08 + k * 0.012, z + 0.021), 'Nero', G, name='scan')
    # telaio della porta di piano (stipiti + architrave inox)
    for s in (-1, 1):
        box((0.06, 0.07, 2.12), (CAR_X + s * (OW / 2 + 0.03), -SD / 2 - 0.035, z + 1.06), 'Inox', G, bevel=0.006, name='stipite')
    box((OW + 0.12, 0.07, 0.08), (CAR_X, -SD / 2 - 0.035, z + 2.14), 'Inox', G, bevel=0.006, name='architrave')
    # pannelli fissi accanto alla porta (dove scorrono le ante aperte)
    for s in (-1, 1):
        box((FP + 0.04, 0.03, 2.1), (CAR_X + s * (OW / 2 + 0.06 + FP / 2 + 0.02), -SD / 2 + 0.03, z + 1.05), 'InoxScuro', G, name='fisso')
    # bottoniera di piano e indicatore di piano sopra la porta
    bx = CAR_X + OW / 2 + 0.32
    box((0.09, 0.012, 0.26), (bx, -SD / 2 - 0.08, z + 1.12), 'Inox', G, bevel=0.003, name='bottoniera')
    cyl(0.018, 0.012, (bx, -SD / 2 - 0.092, z + 1.16), 'Pulsante', G, axis='Y', name='chiamata')
    cyl(0.018, 0.012, (bx, -SD / 2 - 0.092, z + 1.08), 'Pulsante', G, axis='Y', name='chiamata')
    box((0.34, 0.015, 0.12), (CAR_X, -SD / 2 - 0.08, z + 2.32), 'Vetro', G, bevel=0.004, name='display')
    # staffe guide (2 per interpiano) con piastra e bulloni
    for zz in (z + 0.4, z + 2.0):
        # guida sinistra: staffa verso la parete di fondo
        box((0.12, SD / 2 - 0.06, 0.08), (RAIL_L - 0.04, SD / 4 + 0.02, zz), 'Staffa', G, name='staffa')
        box((0.22, 0.012, 0.2), (RAIL_L - 0.04, SD / 2 - 0.006, zz), 'Staffa', G, name='piastra')
        # guida destra: staffa verso la parete destra
        box((0.12, SD / 2 - 0.06, 0.08), (RAIL_R + 0.04, SD / 4 + 0.02, zz), 'Staffa', G, name='staffa')
        box((0.22, 0.012, 0.2), (RAIL_R + 0.04, SD / 2 - 0.006, zz), 'Staffa', G, name='piastra')
        # contrappeso: staffa a C sulla parete sinistra
        box((0.34, 0.68, 0.06), (-SW / 2 + 0.17, 0, zz), 'Staffa', G, name='staffacw')
        for by in (-0.06, 0.06):
            cyl(0.012, 0.03, (RAIL_L - 0.04 + by, SD / 2 - 0.02, zz + 0.06), 'Acciaio', G, axis='Y', verts=6, name='bullone')
            cyl(0.012, 0.03, (RAIL_R + 0.04 + by, SD / 2 - 0.02, zz + 0.06), 'Acciaio', G, axis='Y', verts=6, name='bullone')
    # luce di vano sulla parete di fondo
    box((0.5, 0.03, 0.05), (0.7, SD / 2 - 0.02, z + 2.6), 'LED', G, name='luce')

# parete del piano terra con la porta (atrio): intonaco attorno alla porta, zoccolino
z0 = 0
for s in (-1, 1):
    w = 1.3
    box((w, WALL, FH - 0.3), (CAR_X + s * (OW / 2 + 0.06 + w / 2), -SD / 2 - WALL / 2 - 0.07, (FH - 0.3) / 2), 'Atrio', G, name='atrio')
    box((w, 0.012, 0.1), (CAR_X + s * (OW / 2 + 0.06 + w / 2), -SD / 2 - WALL - 0.076, 0.05), 'InoxScuro', G, name='zoccolino')
box((OW + 0.12, WALL, FH - 0.3 - 2.18), (CAR_X, -SD / 2 - WALL / 2 - 0.07, 2.18 + (FH - 0.3 - 2.18) / 2), 'Atrio', G, name='atrio_sopra')

# guide di cabina (T89) e del contrappeso (T50), dalla fossa al tetto
RH0, RH1 = -1.5, TOP + 0.4
profile(t_rail(0.089, 0.062, 0.016, 0.01), RH0, RH1, RAIL_L, 0, 'Guida', G, name='guida_sx')
profile([(-px, py) for px, py in t_rail(0.089, 0.062, 0.016, 0.01)][::-1], RH0, RH1, RAIL_R, 0, 'Guida', G, name='guida_dx')
for s in (-1, 1):
    pts = [(px, py) for px, py in t_rail(0.05, 0.05, 0.009, 0.006)]
    pts = [(-py, -px) if s < 0 else (py, px) for px, py in pts]
    if s > 0: pts = pts[::-1]
    profile(pts, RH0, RH1, CWX, s * 0.3, 'Guida', G, name='guida_cw')

# fossa: ammortizzatori a molla (cabina) e in poliuretano (contrappeso)
for s in (-1, 1):
    bxp = (CAR_X + s * 0.28, 0, -1.5)
    cyl(0.1, 0.03, (bxp[0], 0, -1.485), 'Ghisa', G, name='base')
    helix(0.065, 0.011, 0.42, 7, (bxp[0], 0, -1.47), 'Giallo', G)
    cyl(0.085, 0.02, (bxp[0], 0, -1.04), 'Ghisa', G, name='piatto')
cyl(0.08, 0.3, (CWX, 0, -1.35), 'Giallo', G, name='poliuretano')
# tenditore del limitatore di velocità
box((0.18, 0.08, 0.3), (RAIL_R - 0.1, -0.25, -1.3), 'Ghisa', G, name='tenditore')
cyl(0.09, 0.03, (RAIL_R - 0.1, -0.3, -1.2), 'Acciaio', G, axis='Y', name='pulegge_tend')

# macchinario in testata: banco, motore gearless, puleggia di trazione, freni, puleggia di rinvio, limitatore
MZ = TOP
box((SW, 0.16, 0.18), (0, -0.25, MZ - 0.09), 'Staffa', G, name='banco')
box((SW, 0.16, 0.18), (0, 0.25, MZ - 0.09), 'Staffa', G, name='banco')
MX = -0.35
cyl(0.33, 0.36, (MX + 0.32, 0, MZ + 0.36), 'Ghisa', G, axis='X', verts=40, bevel=0.01, name='motore')
for k in range(9):  # alette di raffreddamento
    cyl(0.345, 0.012, (MX + 0.17 + k * 0.035, 0, MZ + 0.36), 'Ghisa', G, axis='X', verts=40, name='aletta')
cyl(0.25, 0.14, (MX - 0.0, 0, MZ + 0.36), 'Acciaio', G, axis='X', verts=40, name='puleggia')
for k in range(5):  # gole delle funi
    torus(0.25, 0.008, (MX - 0.05 + k * 0.025, 0, MZ + 0.36), 'Nero', G, axis='X', name='gola')
for s in (-1, 1):
    box((0.14, 0.1, 0.16), (MX + 0.56, s * 0.2, MZ + 0.36), 'Rosso', G, bevel=0.01, name='freno')
box((0.5, 0.5, 0.06), (MX + 0.3, 0, MZ + 0.03), 'Acciaio', G, name='piastramotore')
cyl(0.2, 0.08, (CWX + 0.15, 0, MZ + 0.2), 'Acciaio', G, axis='X', verts=32, name='rinvio')
# limitatore di velocità
box((0.14, 0.16, 0.12), (RAIL_R - 0.1, -0.25, MZ + 0.06), 'Rosso', G, name='limitatore')
cyl(0.1, 0.03, (RAIL_R - 0.1, -0.3, MZ + 0.22), 'Acciaio', G, axis='Y', name='lim_puleggia')
# fune del limitatore (fissa, dalla testata alla fossa)
cyl(0.004, MZ + 0.22 + 1.2, (RAIL_R - 0.1 + 0.1, -0.3, (MZ + 0.22 - 1.2) / 2), 'Fune', G, verts=6, name='fune_lim')
cyl(0.004, MZ + 0.22 + 1.2, (RAIL_R - 0.1 - 0.1, -0.3, (MZ + 0.22 - 1.2) / 2), 'Fune', G, verts=6, name='fune_lim')
# quadro di manovra in testata
box((0.5, 0.25, 0.7), (0.75, 0.6, MZ + 0.5), 'InoxScuro', G, bevel=0.01, name='quadro')
log('vano fatto')

# ================================================================== CABINA (si muove)
G = 'Cabina'
W = 0.03
cx = CAR_X
box((CW, CD, 0.06), (cx, 0, -0.03), 'Granito', G, name='pavimento')
box((CW + 0.1, CD + 0.08, 0.14), (cx, 0, -0.13), 'Telaio', G, name='piattaforma')
box((CW, 0.015, 0.7), (cx, -CD / 2 - 0.03, -0.55), 'InoxScuro', G, name='grembiule')
box((CW, 0.015, 0.2), (cx, -CD / 2 - 0.1, -0.95), 'InoxScuro', G, rot=(math.radians(-30), 0, 0), name='grembiule2')
# pareti: fondo con specchio e corrimano, laterali a pannelli verticali
box((CW, W, CH), (cx, CD / 2 - W / 2, CH / 2), 'Inox', G, name='p_fondo')
box((CW - 0.24, 0.006, 1.3), (cx, CD / 2 - W - 0.003, 1.35), 'Specchio', G, name='specchio')
for s in (-1, 1):
    box((W, CD, CH), (cx + s * (CW / 2 - W / 2), 0, CH / 2), 'Inox', G, name='p_lato')
    for yy in (-0.22, 0.22):
        box((0.004, 0.006, CH), (cx + s * (CW / 2 - W - 0.002), yy, CH / 2), 'InoxScuro', G, name='giunto')
# corrimano tubolare sul fondo
cyl(0.018, CW - 0.2, (cx, CD / 2 - 0.075, 0.9), 'Inox', G, axis='X', verts=16, name='corrimano')
for s in (-1, 1):
    cyl(0.012, 0.06, (cx + s * (CW / 2 - 0.1), CD / 2 - 0.045, 0.9), 'Inox', G, axis='Y', verts=10, name='supporto')
# pulsantiera a colonna in vetro nero (display = piano che il sito disegna sopra)
px = cx + CW / 2 - W - 0.008
box((0.012, 0.2, 1.5), (px, -0.22, 1.1), 'Vetro', G, bevel=0.003, name='colonna')
for k in range(FLOORS):
    cyl(0.02, 0.008, (px - 0.009, -0.22, 1.32 - k * 0.075), 'Pulsante', G, axis='X', verts=20, name='tasto')
cyl(0.026, 0.01, (px - 0.009, -0.22, 0.72), 'Giallo', G, axis='X', verts=20, name='allarme')
# cielino: cornice + pannello LED
box((CW, CD, 0.04), (cx, 0, CH + 0.02), 'InoxScuro', G, name='cielino')
box((CW - 0.22, CD - 0.3, 0.012), (cx, 0.02, CH - 0.005), 'LED', G, name='led')
# fronte: pannelli fissi, traverso sopra la porta
for s in (-1, 1):
    box((FP, 0.03, CH), (cx + s * (OW / 2 + FP / 2), -CD / 2 + 0.015, CH / 2), 'Inox', G, name='fisso')
box((CW, 0.03, 0.1), (cx, -CD / 2 + 0.015, CH - 0.05), 'Inox', G, name='traverso')
# arcata: montanti, traversa superiore, traversa inferiore
for s in (-1, 1):
    box((0.07, 0.14, CH + 0.62), (cx + s * (CW / 2 + 0.07), 0, (CH + 0.62) / 2 - 0.2), 'Telaio', G, bevel=0.004, name='montante')
    # pattini di guida (sopra e sotto) con rulli
    for zz in (CH + 0.32, -0.26):
        box((0.08, 0.16, 0.14), (cx + s * (CW / 2 + 0.13), 0, zz), 'Acciaio', G, bevel=0.005, name='pattino')
        for yy in (-0.05, 0.05):
            cyl(0.035, 0.03, (cx + s * (CW / 2 + 0.16), yy, zz), 'Gomma', G, axis='Y', verts=16, name='rullo')
    # paracadute (sotto, a cavallo della guida)
    box((0.1, 0.2, 0.18), (cx + s * (CW / 2 + 0.15), 0, -0.48), 'Rosso', G, bevel=0.006, name='paracadute')
box((CW + 0.22, 0.16, 0.16), (cx, 0, CH + 0.38), 'Telaio', G, bevel=0.004, name='traversa')
box((CW + 0.22, 0.16, 0.12), (cx, 0, -0.26), 'Telaio', G, bevel=0.004, name='traversa_inf')
# attacco funi con molle
box((0.24, 0.12, 0.03), (cx, 0, CH + 0.48), 'Acciaio', G, name='attacco')
for k in range(4):
    helix(0.016, 0.004, 0.12, 6, (cx - 0.06 + k * 0.04, 0, CH + 0.5), 'Acciaio', G)
# operatore porte sul tetto cabina
box((CW + 0.1, 0.2, 0.18), (cx, -CD / 2 + 0.12, CH + 0.13), 'InoxScuro', G, bevel=0.006, name='operatore')
cyl(0.06, 0.1, (cx + 0.38, -CD / 2 + 0.2, CH + 0.16), 'Nero', G, axis='Y', verts=20, name='motorino')
# balaustra di sicurezza gialla sul tetto
for (x0, y0) in ((-1, 1), (1, 1)):
    box((0.03, 0.03, 0.7), (cx + x0 * (CW / 2 - 0.05), CD / 2 - 0.08, CH + 0.39), 'Giallo', G, name='balaustra')
box((CW - 0.07, 0.03, 0.03), (cx, CD / 2 - 0.08, CH + 0.73), 'Giallo', G, name='balaustra')
box((CW - 0.07, 0.03, 0.03), (cx, CD / 2 - 0.08, CH + 0.45), 'Giallo', G, name='balaustra')
for s in (-1, 1):
    box((0.03, CD - 0.2, 0.03), (cx + s * (CW / 2 - 0.05), 0.02, CH + 0.73), 'Giallo', G, name='balaustra')
# pulsantiera d'ispezione sul tetto
box((0.18, 0.1, 0.12), (cx - 0.3, 0.3, CH + 0.1), 'Giallo', G, bevel=0.01, name='ispezione')
cyl(0.025, 0.02, (cx - 0.3, 0.3, CH + 0.17), 'Rosso', G, verts=16, name='stop')
log('cabina fatta')

# ante di cabina: telescopiche centrali, 2 per lato (oggetti separati per l'animazione)
DOORS = []
def door_panels(prefix, y, group, z0=0.0):
    out = []
    for s, side in ((-1, 'S'), (1, 'D')):
        for k, (closed, yoff) in enumerate(((s * OW / 8, -0.01), (s * 3 * OW / 8, -0.035))):
            ob = box((OW / 4 + 0.012, 0.02, CH - 0.12), (CAR_X + closed, y + yoff, z0 + (CH - 0.12) / 2 + 0.01), 'Inox', group, bevel=0.003, name=f'{prefix}_{side}{k + 1}')
            ob['closed'] = closed; ob['open'] = s * (OW / 2 + FP / 2)
            out.append(ob)
    return out
DOORS = door_panels('AntaCabina', -CD / 2 - 0.02, 'AnteCabina')
LANDING = []
for i in range(FLOORS):
    LANDING += door_panels(f'AntaPiano{i}', -SD / 2 + 0.005, f'AntePiano{i}', z0=i * FH)

# ================================================================== CONTRAPPESO
G = 'Contrappeso'
for s in (-1, 1):
    box((0.1, 0.05, 1.5), (CWX, s * 0.24, 0.75), 'Telaio', G, name='cw_montante')
    for zz in (0.02, 1.5):
        box((0.1, 0.08, 0.08), (CWX, s * 0.27, zz), 'Acciaio', G, name='cw_pattino')
for k in range(10):
    box((0.16, 0.42, 0.12), (CWX, 0, 0.1 + k * 0.128), 'Ghisa', G, bevel=0.008, name='blocco')
box((0.14, 0.52, 0.08), (CWX, 0, 1.38), 'Rosso', G, name='cw_testa')
box((0.14, 0.52, 0.06), (CWX, 0, 0.03), 'Telaio', G, name='cw_base')
log('contrappeso fatto')

# ================================================================== pulizia, UV, join, export
def join_group(name):
    obs = [o for o in COLL[name].objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    for o in obs:
        bpy.context.view_layer.objects.active = o
        for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active; ob.name = name; ob.data.name = name
    return ob

def uv_world(ob, size=1.0):
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=size, correct_aspect=False, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')

VANO = join_group('Vano'); CAB = join_group('Cabina'); CWO = join_group('Contrappeso')
for ob in (VANO, CAB, CWO): uv_world(ob, 1.6)
# ante: origine al centro per traslarle; bevel applicato
for ob in DOORS + LANDING:
    bpy.context.view_layer.objects.active = ob
    for md in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    uv_world(ob, 1.6)
# ante di cabina figlie della cabina (si muovono con lei)
for ob in DOORS:
    ob.parent = CAB
log('join', len(VANO.data.vertices), len(CAB.data.vertices))

bpy.ops.object.select_all(action='DESELECT')
for ob in [VANO, CAB, CWO] + DOORS + LANDING: ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'impianto-raw.glb'), export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_cameras=False, export_lights=False,
                          export_normals=True, export_texcoords=True, export_extras=True)
log('glb', os.path.getsize(os.path.join(OUT, 'impianto-raw.glb')))

meta = {'floors': FLOORS, 'fh': FH, 'top': TOP, 'car': {'x': CAR_X, 'w': CW, 'h': CH, 'd': CD}, 'cwx': CWX,
        'rails': [RAIL_L, RAIL_R], 'ow': OW, 'fp': FP, 'sw': SW, 'sd': SD}
with open(os.path.join(OUT, 'impianto.json'), 'w') as f: json.dump(meta, f)

# ================================================================== RENDER di riserva (Cycles)
world = bpy.data.worlds.new('W'); scn.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = lin('#2A2D31')
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7
scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'
scn.view_settings.view_transform = 'AgX'; scn.view_settings.look = 'AgX - Medium High Contrast'
def light(kind, loc, energy, color='#FFFFFF', size=1.0, rot=(0, 0, 0)):
    d = bpy.data.lights.new('L', kind); d.energy = energy; d.color = lin(color)[:3]
    if kind == 'AREA': d.size = size
    o = bpy.data.objects.new('L', d); o.location = loc; o.rotation_euler = rot; scn.collection.objects.link(o)
    return o
for i in range(FLOORS):  # luce di atrio davanti a ogni piano
    light('AREA', (CAR_X, -SD / 2 - 1.6, i * FH + 2.7), 60, '#FFF1E0', 1.6, (math.radians(30), 0, 0))
cab_light = light('POINT', (CAR_X, 0, CH - 0.3), 120, '#EEF5FF')
cab_light.parent = CAB
light('AREA', (0, 0, TOP + 1.2), 120, '#DDE6F0', 2.0)
for i in range(FLOORS):
    light('AREA', (0.7, SD / 2 - 0.3, i * FH + 2.6), 25, '#FFF6E6', 0.5, (math.radians(-90), 0, 0))
light('AREA', (6, -6, 14), 900, '#DCE4EE', 6, (math.radians(55), 0, math.radians(45)))

cam_d = bpy.data.cameras.new('C'); cam = bpy.data.objects.new('C', cam_d); scn.collection.objects.link(cam); scn.camera = cam
tgt = bpy.data.objects.new('T', None); scn.collection.objects.link(tgt)
tr = cam.constraints.new('TRACK_TO'); tr.target = tgt; tr.track_axis = 'TRACK_NEGATIVE_Z'; tr.up_axis = 'UP_Y'

def set_doors(objs, f):
    for ob in objs:
        ob.location.x = CAR_X + ob['closed'] + (ob['open'] - ob['closed']) * f

def shot(name, cam_loc, target, lens, car_floor, doors_open, landing_floor=None, res=(1600, 1000)):
    CAB.location.z = car_floor * FH
    CWO.location.z = (FLOORS - 1) * FH - car_floor * FH + 0.6
    set_doors(DOORS, doors_open)
    for i in range(FLOORS):
        set_doors([o for o in LANDING if o.name.startswith(f'AntaPiano{i}_')], doors_open if i == landing_floor else 0)
    cam.location = cam_loc; tgt.location = target; cam_d.lens = lens
    k = float(os.environ.get('RESK', '1')); scn.render.resolution_x, scn.render.resolution_y = int(res[0] * k), int(res[1] * k)
    scn.render.filepath = os.path.join(OUT, f'render-{name}.png')
    bpy.ops.render.render(write_still=True); log('render', name)

if DO_RENDER:
    scn.cycles.samples = SAMPLES; scn.cycles.use_denoising = True
    scn.render.image_settings.file_format = 'PNG'
    # porte socchiuse al piano terra, vista frontale dall'atrio
    shot('ingresso', (CAR_X + 1.6, -SD / 2 - 4.4, 1.55), (CAR_X - 0.9, 0, 1.25), 32, 0, 0.75, landing_floor=0)
    # sezione: cabina che sale, vista 3/4 dalla destra
    shot('sezione', (3.6, -5.2, 2.5 * FH + 2.2), (-0.6, 0, 2.5 * FH + 1.2), 28, 2.5, 0.0)
    # dettaglio tecnico: arcata, pattini, paracadute
    shot('tecnico', (3.4, -2.6, 3 * FH + 1.9), (CAR_X + 0.2, 0, 3 * FH + 0.9), 30, 3, 1.0, landing_floor=3)
    # testata con macchinario e cabina all'ultimo piano
    shot('arrivo', (3.0, -4.2, 6 * FH + 3.2), (-0.2, 0, 6 * FH + 2.0), 24, 6, 1.0, landing_floor=6)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'lsascensori.blend'), compress=True)
log('fine')
