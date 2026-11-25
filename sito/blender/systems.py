# Render dei quattro tipi di impianto per la sezione "Impianti" (studio grafite, Cycles).
import bpy, math, os, sys
args = [a for a in sys.argv if not a.endswith('.py')]
OUT = args[1] if len(args) > 1 else 'out'
SAMPLES = int(os.environ.get('SAMPLES', '64'))
K = float(os.environ.get('RESK', '1'))
BLEND = os.path.join(OUT, 'lsascensori.blend')

def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1.0,)

def new_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = SAMPLES; s.cycles.use_denoising = True
    s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Medium High Contrast'
    s.render.resolution_x, s.render.resolution_y = int(960 * K), int(720 * K)
    w = bpy.data.worlds.new('W'); s.world = w
    w.node_tree.nodes['Background'].inputs['Color'].default_value = lin('#2A2D31')
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.5
    return s

M = {}
def mat(name, color, rough=0.5, metal=0.0, alpha=1.0, trans=0.0):
    m = bpy.data.materials.new(name); b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = lin(color); b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if trans: b.inputs['Transmission Weight'].default_value = trans; b.inputs['IOR'].default_value = 1.45
    M[name] = m; return m

def mats():
    M.clear()
    mat('floor', '#1B1D20', 0.6); mat('wall', '#24272B', 0.8)
    mat('inox', '#C9CED3', 0.28, 1.0); mat('dark', '#3A3F45', 0.45, 0.8); mat('grey', '#8D949B', 0.5, 0.6)
    mat('glass', '#DDE6EE', 0.02, 0.0, trans=1.0); mat('alu', '#B9BDC1', 0.3, 1.0)
    mat('red', '#C8222A', 0.45); mat('stone', '#B9B2A6', 0.85); mat('wood', '#8A6A48', 0.6)
    mat('seat', '#2B2E33', 0.7); mat('led', '#FFFFFF', 0.5); mat('yellow', '#E8B10C', 0.55)
    mat('checker', '#9AA0A6', 0.35, 1.0); mat('crate', '#A88456', 0.75)
    e = M['led'].node_tree.nodes['Principled BSDF']; e.inputs['Emission Color'].default_value = lin('#EAF4FF'); e.inputs['Emission Strength'].default_value = 20

def box(size, loc, m, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.scale = size; bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(M[m])
    if bevel:
        b = o.modifiers.new('b', 'BEVEL'); b.width = bevel; b.segments = 2
    return o

def cyl(r, d, loc, m, rot=(0, 0, 0), v=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d, location=loc, rotation=rot, vertices=v)
    o = bpy.context.active_object; o.data.materials.append(M[m])
    for p in o.data.polygons: p.use_smooth = len(p.vertices) == 4
    return o

def studio(cam_loc, tgt_loc, lens=40):
    s = bpy.context.scene
    box((30, 30, 0.02), (0, 0, -0.01), 'floor')
    box((30, 0.1, 12), (0, 6, 6), 'wall')
    def L(loc, e, size, rot):
        d = bpy.data.lights.new('l', 'AREA'); d.energy = e; d.size = size
        o = bpy.data.objects.new('l', d); o.location = loc; o.rotation_euler = rot; s.collection.objects.link(o)
    L((-3, -3, 5), 900, 4, (math.radians(45), 0, math.radians(-40)))
    L((4, -1, 3), 300, 2, (math.radians(70), 0, math.radians(60)))
    L((0, 4, 5), 400, 3, (math.radians(-40), 0, 0))
    cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); s.collection.objects.link(cam); s.camera = cam
    cd.lens = lens
    t = bpy.data.objects.new('t', None); t.location = tgt_loc; s.collection.objects.link(t)
    cam.location = cam_loc
    c = cam.constraints.new('TRACK_TO'); c.target = t; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'

def render(name):
    s = bpy.context.scene; s.render.filepath = os.path.join(OUT, f'sys-{name}.png')
    bpy.ops.render.render(write_still=True); print('render', name, flush=True)

# 1) ascensore: dal modello principale, cabina al piano 1 con porte aperte vista dall'atrio
bpy.ops.wm.open_mainfile(filepath=BLEND)
s = bpy.context.scene
s.cycles.samples = SAMPLES
s.render.resolution_x, s.render.resolution_y = int(960 * K), int(720 * K)
FH = 3.2
cab = bpy.data.objects['Cabina']; cab.location.z = FH
cw = bpy.data.objects['Contrappeso']; cw.location.z = 5 * FH - FH + 0.6
for o in bpy.data.objects:
    if 'closed' in o.keys() and (o.name.startswith('AntaCabina') or o.name.startswith('AntaPiano1_')):
        o.location.x = 0.25 + o['open']
cam = s.camera; tg = bpy.data.objects['T']
cam.location = (1.2, -4.6, FH + 1.5); tg.location = (0.25, 0, FH + 1.1); cam.data.lens = 34
s.render.filepath = os.path.join(OUT, 'sys-lift.png'); bpy.ops.render.render(write_still=True); print('render lift', flush=True)

# 2) montacarichi: cabina in lamiera, pavimento mandorlato, porta a soffietto aperta, bancale con casse
new_scene(); mats()
W, D, H = 1.6, 2.0, 2.1
box((W, D, 0.06), (0, 0, 0.03), 'checker')
box((0.04, D, H), (-W / 2, 0, H / 2 + 0.06), 'grey'); box((0.04, D, H), (W / 2, 0, H / 2 + 0.06), 'grey')
box((W, 0.04, H), (0, D / 2, H / 2 + 0.06), 'grey'); box((W + 0.04, D, 0.05), (0, 0, H + 0.08), 'dark')
for z in (0.5, 1.0, 1.5):
    for s_ in (-1, 1): box((0.03, D - 0.1, 0.12), (s_ * (W / 2 - 0.03), 0, z), 'yellow')
for k in range(9):  # porta a soffietto impacchettata a sinistra
    box((0.03, 0.03, H - 0.1), (-W / 2 + 0.06 + k * 0.035, -D / 2, H / 2 + 0.06), 'dark')
box((W + 0.2, 0.12, 0.25), (0, -D / 2 - 0.02, H + 0.2), 'yellow')
box((1.0, 1.2, 0.14), (0.1, 0.2, 0.13), 'wood', bevel=0.01)
for (x, y, z, sx) in ((-0.15, 0.0, 0.5, 0.45), (0.3, 0.05, 0.48, 0.4), (0.05, 0.45, 0.47, 0.42), (0.05, 0.2, 0.95, 0.4)):
    box((sx, sx, sx * 0.9), (x, y, z), 'crate', bevel=0.01)
box((0.18, 0.04, 0.3), (W / 2 - 0.12, -D / 2 + 0.06, 1.2), 'dark')
cyl(0.02, 0.02, (W / 2 - 0.12, -D / 2 + 0.035, 1.25), 'red', rot=(math.pi / 2, 0, 0))
box((W - 0.2, D - 0.3, 0.01), (0, 0, H + 0.05), 'led')
studio((2.6, -4.4, 2.0), (0, 0, 1.0), 38); render('cargo')

# 3) piattaforma elevatrice: castelletto in alluminio e vetro accanto a un pianerottolo
new_scene(); mats()
W, D, H = 1.1, 1.3, 3.6
for x in (-W / 2, W / 2):
    for y in (-D / 2, D / 2):
        box((0.06, 0.06, H), (x, y, H / 2), 'alu', bevel=0.004)
for z in (0.02, 1.2, 2.3, H - 0.03):
    box((W, 0.05, 0.05), (0, D / 2, z), 'alu'); box((0.05, D, 0.05), (-W / 2, 0, z), 'alu'); box((0.05, D, 0.05), (W / 2, 0, z), 'alu')
for (sz, loc) in (((W - 0.06, 0.012, H - 0.1), (0, D / 2, H / 2)), ((0.012, D - 0.06, H - 0.1), (-W / 2, 0, H / 2)), ((0.012, D - 0.06, H - 0.1), (W / 2, 0, H / 2))):
    box(sz, loc, 'glass')
box((W - 0.1, D - 0.1, 0.06), (0, 0, 0.9), 'dark'); box((W - 0.14, D - 0.14, 0.01), (0, 0, 0.935), 'floor')
box((0.05, 0.4, 0.04), (W / 2 - 0.08, 0, 1.85), 'alu')  # corrimano
box((0.04, 0.12, 0.2), (W / 2 - 0.06, -0.3, 1.9), 'dark'); cyl(0.015, 0.02, (W / 2 - 0.085, -0.3, 1.93), 'red', rot=(0, math.pi / 2, 0))
box((W - 0.1, 0.04, 0.9), (0, -D / 2, 1.35), 'glass')  # porta in vetro al piano superiore
box((1.6, 1.5, 2.25), (-W / 2 - 0.85, 0.1, 1.12), 'stone')  # pianerottolo/muratura
box((1.6, 1.5, 0.05), (-W / 2 - 0.85, 0.1, 2.27), 'wood')
for k in range(7):
    box((0.9, 0.3, 0.32 * (k + 1)), (-W / 2 - 2.3 + 0.0, -1.2 + k * 0.3, 0.16 * (k + 1)), 'stone')
studio((3.2, -4.6, 2.6), (-0.4, 0, 1.6), 34); render('platform')

# 4) servoscala: scala in pietra, guida su colonnine, poltroncina con braccioli e pedana
new_scene(); mats()
N, R, T = 11, 0.18, 0.28
for k in range(N):
    box((1.1, T, R * (k + 1)), (0, k * T, R * (k + 1) / 2), 'stone', bevel=0.006)
box((0.12, N * T + 0.4, R * N + 1.2), (-0.62, N * T / 2, (R * N + 1.2) / 2), 'wall')
ang = math.atan2(R, T)
L = math.hypot(N * T, N * R) + 0.3
rail_c = (0.47, N * T / 2 - 0.1, N * R / 2 + 0.42)
cyl(0.035, L, rail_c, 'alu', rot=(-(math.pi / 2 - ang), 0, 0), v=20)
box((0.03, L, 0.09), (0.47, rail_c[1], rail_c[2] - 0.06), 'alu', rot=(ang, 0, 0))
for k in range(0, N, 3):
    box((0.05, 0.05, 0.42), (0.47, k * T + 0.1, R * (k + 1) + 0.21), 'alu')
# poltroncina a metà rampa
k0 = 4.5; y0 = k0 * T; z0 = R * (k0 + 1) + 0.42
box((0.2, 0.3, 0.32), (0.36, y0, z0 + 0.05), 'dark', bevel=0.02)
box((0.5, 0.45, 0.1), (0.1, y0, z0 + 0.28), 'seat', bevel=0.03)
box((0.5, 0.08, 0.55), (0.1, y0 + 0.24, z0 + 0.58), 'seat', bevel=0.03, rot=(math.radians(-6), 0, 0))
for s_ in (-1, 1): box((0.06, 0.36, 0.05), (0.1 + s_ * 0.26, y0 - 0.02, z0 + 0.5), 'dark', bevel=0.01)
box((0.36, 0.26, 0.03), (0.1, y0 - 0.32, z0 - 0.3), 'dark', bevel=0.01)
box((0.04, 0.06, 0.06), (0.36, y0 - 0.2, z0 + 0.54), 'red')
studio((3.0, -2.6, 2.6), (0.2, 1.4, 1.2), 32); render('stair')
