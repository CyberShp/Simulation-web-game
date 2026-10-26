"""Continuous adult head and swept, centre-parted hair for the v2 disciple.

Call build_head(ctx), then build_hair(ctx), with build_asset_character as ctx.
Coordinates are metres, +Z up and -Y forward. Meshes register in ctx.PARTS,
carry UVMap, and use the existing head/hair vertex groups. No scene reset,
material creation, export, normalization or rendering happens in this module.
"""
import math
from mathutils import Vector

TAU = math.tau
HEAD_ROWS = (
    (1.487, .031, .034, -.020),
    (1.501, .048, .047, -.017),
    (1.524, .068, .057, -.010),
    (1.548, .076, .063, -.003),
    (1.578, .086, .073, .004),
    (1.611, .085, .076, .008),
    (1.651, .082, .074, .010),
    (1.684, .070, .063, .013),
    (1.710, .043, .040, .014),
    (1.723, .005, .005, .014),
)


def _gauss(x, centre, width):
    return math.exp(-((x-centre)/width)**2)


def _profile(z):
    """Cubic Hermite profile with slopes measured in metres."""
    rows = HEAD_ROWS
    for i in range(len(rows)-1):
        if z <= rows[i+1][0]:
            a, b = rows[i], rows[i+1]
            t = max(0.0, (z-a[0])/(b[0]-a[0]))
            before, after = rows[max(0, i-1)], rows[min(len(rows)-1, i+2)]
            result = []
            for k in range(1, 4):
                m0 = (b[k]-before[k])/(b[0]-before[0])
                m1 = (after[k]-a[k])/(after[0]-a[0])
                result.append((2*t**3-3*t*t+1)*a[k] + (t**3-2*t*t+t)*(b[0]-a[0])*m0
                              + (-2*t**3+3*t*t)*b[k] + (t**3-t*t)*(b[0]-a[0])*m1)
            return result
    return rows[-1][1:]


def _facial_offset(x, z):
    """Positive values move the continuous front surface towards the viewer."""
    cheek = .0050*_gauss(abs(x), .052, .021)*_gauss(z, 1.581, .019)
    cheek_hollow = -.0033*_gauss(abs(x), .054, .019)*_gauss(z, 1.549, .016)
    socket = -.0048*_gauss(abs(x), .035, .017)*_gauss(z, 1.611, .010)
    brow = .0042*_gauss(abs(x), .034, .023)*_gauss(z, 1.630, .009)
    bridge = .0160*_gauss(x, 0, .0105)*_gauss(z, 1.603, .024)
    tip = .0260*_gauss(x, 0, .012)*_gauss(z, 1.579, .009)
    alae = .0065*_gauss(abs(x), .012, .006)*_gauss(z, 1.574, .007)
    philtrum = .0038*_gauss(x, 0, .013)*_gauss(z, 1.555, .011)
    mouth = .0055*_gauss(x, 0, .027)*_gauss(z, 1.543, .015)
    upper_lip = .0018*_gauss(x, 0, .020)*_gauss(z, 1.546, .0028)
    lower_lip = .0022*_gauss(x, 0, .020)*_gauss(z, 1.540, .0030)
    lip_seam = -.0011*_gauss(x, 0, .022)*_gauss(z, 1.5435, .0013)
    chin = .0070*_gauss(x, 0, .029)*_gauss(z, 1.513, .011)
    return cheek+cheek_hollow+socket+brow+bridge+tip+alae+philtrum+mouth+upper_lip+lower_lip+lip_seam+chin


def face_y(x, z):
    """Front-surface landmark query, also available to texture/QA callers."""
    rx, ry, cy = _profile(z)
    frontal = math.sqrt(max(0.0, 1-(x/max(rx, .001))**2))
    return cy-ry*frontal-_facial_offset(x, z)*frontal**4


def _head_shell(ctx):
    vertices, faces, uv = [], [], []
    segments, levels = 144, 104
    for row in range(levels):
        z = 1.487+(1.723-1.487)*row/(levels-1)
        rx, ry, cy = _profile(z)
        for j in range(segments+1):
            a = -math.pi+TAU*j/segments
            x = math.sin(a)*rx
            forward = max(0.0, math.cos(a))
            y = cy-math.cos(a)*ry-_facial_offset(x, z)*forward**4
            vertices.append((x, y, z)); uv.append((j/segments, row/(levels-1)))
    stride = segments+1
    for row in range(levels-1):
        for j in range(segments):
            k = row*stride+j
            faces.append((k, k+1, k+stride+1, k+stride))
    faces += [tuple(reversed(range(segments))), tuple((levels-1)*stride+j for j in range(segments))]
    return ctx.mesh('V2 continuous facial anatomy', vertices, faces, ctx.M['skin'], 'head', uv)


def _eye(ctx, sign):
    cx, cz, width = sign*.0355, 1.611, .0132
    # The exposed eye is an almond patch fitted within the socket. Its skin rim
    # returns to the same facial surface over 2.7 mm, including both canthi.
    def contour(a, scale=1):
        dx = width*math.cos(a)*scale
        dz = (.0042 if math.sin(a) >= 0 else .0030)*math.sin(a)*scale
        return cx+dx, cz+dz+sign*dx*.060

    def eye_surface(x, z):
        dz = z-cz-sign*(x-cx)*.060
        height = .0042 if dz >= 0 else .0030
        r2 = ((x-cx)/width)**2+(dz/height)**2
        return face_y(x, z)-(.00065+.0013*max(0, 1-r2))

    n, rings = 64, 8
    vertices = [(cx, eye_surface(cx, cz), cz)]; uv = [(.5, .5)]
    faces = []
    for row in range(1, rings+1):
        r = row/rings
        for j in range(n+1):
            a = TAU*j/n
            x, z = contour(a, r)
            vertices.append((x, eye_surface(x, z), z))
            uv.append((.5+.5*r*math.cos(a), .5+.5*r*math.sin(a)))
    for j in range(n): faces.append((0, 1+j, 2+j))
    for row in range(rings-1):
        for j in range(n):
            k = 1+row*(n+1)+j
            faces.append((k, k+1, k+n+2, k+n+1))
    ctx.mesh('V2 scleral aperture '+str(sign), vertices, faces, ctx.M['sclera'], 'head', uv)

    vertices, uv, faces = [], [], []
    for row in range(7):
        t = row/6
        for j in range(n+1):
            a = TAU*j/n
            x, z = contour(a)
            x += .0018*math.cos(a)*t
            z += (.0026 if math.sin(a) > 0 else .0018)*math.sin(a)*t
            lift = .00065*(1-t)+.00038*math.sin(math.pi*t)
            vertices.append((x, face_y(x, z)-lift, z)); uv.append((j/n, t))
    for row in range(6):
        for j in range(n):
            k = row*(n+1)+j
            faces.append((k, k+1, k+n+2, k+n+1))
    ctx.mesh('V2 fitted eyelid skin '+str(sign), vertices, faces, ctx.M['skin'], 'head', uv)

    # Iris and pupil follow the same curved corneal surface. Their circular
    # boundary is clipped by the lids, preserving its correct visible size.
    for name, radius, material, lift in [('iris', .0058, ctx.M['iris'], .00014),
                                         ('pupil', .0020, ctx.M['hair'], .00024)]:
        vertices = [(cx, eye_surface(cx, cz)-lift, cz)]; uv = [(.5,.5)]; faces = []
        for row in range(1, 7):
            r = row/6
            for j in range(n+1):
                a = TAU*j/n
                height = .0042 if math.sin(a) >= 0 else .0030
                limit = .985/math.sqrt((math.cos(a)/width)**2+(math.sin(a)/height)**2)
                extent = min(radius, limit)*r
                dx, dz = extent*math.cos(a), extent*math.sin(a)
                x, z = cx+dx, cz+dz+sign*dx*.060
                vertices.append((x, eye_surface(x,z)-lift,z));uv.append((.5+dx/(2*radius),.5+dz/(2*radius)))
        for j in range(n):faces.append((0,1+j,2+j))
        for row in range(5):
            for j in range(n):
                k = 1+row*(n+1)+j;faces.append((k,k+1,k+n+2,k+n+1))
        ctx.mesh('V2 '+name+' '+str(sign),vertices,faces,material,'head',uv)

    vertices, uv, faces = [], [], []
    for i in range(33):
        t = i/32
        x = sign*(.017+.043*t)
        z = 1.633+.0027*math.sin(math.pi*t)-.0030*t
        half = .0013*(math.sin(math.pi*(.05+.90*t))**.7)
        for j in range(3):
            zz = z+(j-1)*half
            vertices.append((x, face_y(x, zz)-.00045, zz)); uv.append((t, j/2))
    for i in range(32):
        for j in range(2):
            k = i*3+j; faces.append((k, k+1, k+4, k+3))
    ctx.mesh('V2 tapered brow '+str(sign), vertices, faces, ctx.M['hair'], 'head', uv)


def _lips(ctx):
    vertices, faces, uv = [], [], []
    for row in range(9):
        v = row/8
        for j in range(65):
            u = j/64; x = (u*2-1)*.023
            taper = math.sin(math.pi*u)**.65
            seam = 1.5435+.00065*_gauss(abs(x), .006, .004)-.0005*_gauss(x, 0, .003)
            z = seam + ((v-.5)*.0062)*taper
            vertices.append((x, face_y(x, z)-.00020, z)); uv.append((u, v))
    for row in range(8):
        for j in range(64):
            k = row*65+j; faces.append((k, k+1, k+66, k+65))
    ctx.mesh('V2 integrated lip surface', vertices, faces, ctx.M['lip'], 'head', uv)
    # Two recessed nostril patches follow the nose wing rather than an outline.
    for sign in [-1, 1]:
        cx, cz = sign*.0100, 1.5721
        vertices = [(cx, face_y(cx, cz)-.00022, cz)]; uv = [(.5, .5)]; faces = []
        for j in range(33):
            a = TAU*j/32; x = cx+.0021*math.cos(a); z = cz+.00065*math.sin(a)
            vertices.append((x, face_y(x, z)-.00025, z)); uv.append((.5+.5*math.cos(a), .5+.5*math.sin(a)))
        for j in range(32): faces.append((0, j+1, j+2))
        ctx.mesh('V2 nostril recess '+str(sign), vertices, faces, ctx.M['skinshadow'], 'head', uv)


def _ear(ctx, sign):
    # The pinna is a single closed volume. Broad relief forms its helix and
    # concha; the root overlaps the cranial shell beneath the hairline.
    vertices, faces, uv = [], [], []
    segments, rows = 48, 28
    for i in range(rows+1):
        t = math.pi*i/rows
        for j in range(segments+1):
            a = TAU*j/segments
            yy = math.sin(t)*math.cos(a)
            zz = math.cos(t)
            xx = math.sin(t)*math.sin(a)
            relief = .0013*math.cos(3*a)*math.sin(t)**2
            x = sign*(.083+.013*xx+relief)
            y = .003+.013*yy+.003*zz
            z = 1.589+.027*zz
            vertices.append((x, y, z)); uv.append((j/segments, i/rows))
    for i in range(rows):
        for j in range(segments):
            k = i*(segments+1)+j; faces.append((k, k+1, k+segments+2, k+segments+1))
    ctx.mesh('V2 anatomical ear '+str(sign), vertices, faces, ctx.M['skin'], 'head', uv)


def build_head(ctx):
    """Build the adult head, fitted eye/lip surfaces, and attached ears."""
    start = len(ctx.PARTS)
    _head_shell(ctx)
    for sign in [-1, 1]:
        _eye(ctx, sign); _ear(ctx, sign)
    _lips(ctx)
    return ctx.PARTS[start:]


def _catmull(points, count):
    points = [Vector(p) for p in points]
    result = []
    for j in range(count):
        u = j/(count-1)*(len(points)-1); i = min(len(points)-2, int(u)); t = u-i
        a, b, c, d = points[max(0, i-1)], points[i], points[i+1], points[min(len(points)-1, i+2)]
        result.append((2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t**3)*.5)
    return result


def _lock(ctx, name, points, width, depth, material, weights='head', count=36, sides=16, normal=None):
    """Broad flattened closed lock, with a few shallow sculpted furrows."""
    centres = _catmull(points, count)
    vertices, uv, faces = [], [], []
    for i, p in enumerate(centres):
        t = i/(count-1)
        tangent = (centres[min(i+1, count-1)]-centres[max(0, i-1)]).normalized()
        outward = Vector(normal) if normal else Vector((p.x, p.y-.014, (p.z-1.621)*.72))
        outward -= tangent*outward.dot(tangent)
        if outward.length < .0001: outward = Vector((0, 1, 0))
        outward.normalize(); across = tangent.cross(outward).normalized()
        taper = min(1, .30+4.0*t)*(.025+.975*math.sin(math.pi/2*(1-t))**.45)
        for j in range(sides+1):
            a = TAU*j/sides
            rib = 1+.055*math.cos(6*a+.30*math.sin(t*4))
            co = p+across*(math.cos(a)*width*taper)+outward*(math.sin(a)*depth*taper*rib)
            vertices.append(tuple(co)); uv.append((j/sides, t))
    stride = sides+1
    for i in range(count-1):
        for j in range(sides):
            k = i*stride+j; faces.append((k, k+1, k+stride+1, k+stride))
    faces.extend((tuple(reversed(range(sides))), tuple((count-1)*stride+j for j in range(sides))))
    return ctx.mesh(name, vertices, faces, material, weights, uv)


def _scalp(ctx):
    vertices, faces, uv = [], [], []
    segments, rows = 176, 64
    for i in range(rows):
        v = i/(rows-1)
        for j in range(segments+1):
            a = -math.pi+TAU*j/segments
            front = max(0, math.cos(a)); side = abs(math.sin(a))
            edge_z = 1.552+.107*front**2+.029*side
            edge_z += .008*_gauss(a, 0, .16)
            angle = math.acos(max(-1, min(1, (edge_z-1.621)/.119)))*(1-v)
            # Shallow continuous relief follows swept hair flow over the skull.
            phase = 22*abs(a)+6*(1-v)+1.3*math.sin(3*a)*(1-v)
            relief = (.00052*math.cos(phase)+.00022*math.cos(1.7*phase+.8))*math.sin(angle)
            x = (.0915+relief)*math.sin(angle)*math.sin(a)
            y = .014-(.0845+relief)*math.sin(angle)*math.cos(a)
            z = 1.621+(.118+relief)*math.cos(angle)
            valley = .0012*_gauss(x, 0, .003)*math.sin(angle)*front
            y += valley*front
            z -= valley*.4
            vertices.append((x, y, z)); uv.append((j/segments, v))
    stride = segments+1
    for i in range(rows-1):
        for j in range(segments):
            k = i*stride+j; faces.append((k, k+1, k+stride+1, k+stride))
    faces.append(tuple(reversed(range(segments))))
    return ctx.mesh('V2 parted scalp volume', vertices, faces, ctx.M['hair'], 'head', uv)


def build_hair(ctx):
    """Build a continuous swept scalp, sculpted knot and five rear locks."""
    start = len(ctx.PARTS)
    _scalp(ctx)
    for sign in [-1, 1]:
        _lock(ctx, 'V2 temple lock '+str(sign),
              [(sign*.075,-.038,1.654),(sign*.083,-.021,1.610),(sign*.084,-.023,1.566),(sign*.079,-.024,1.525)],
              .0046, .0020, ctx.M['hair'], count=40)

    # Long rear hair has depth, unequal ends and broad overlapping sections.
    for i, x in enumerate([-.050,-.026,0,.026,.050]):
        end = [1.270,1.226,1.239,1.218,1.273][i]
        _lock(ctx, 'V2 rear hair mass '+str(i),
              [(x*.46,.077,1.701),(x*.91,.091,1.605),(x*1.06,.093,1.478),
               (x*.98+.003*math.sin(i),.104,1.340),(x*.79,.103,end)],
              [.022,.025,.026,.024,.020][i], .009, ctx.M['hair'], 'hair', 52, 20, (0,1,0))

    # Single sculpted bun surface with soft folds, ready for directional texture.
    bun = ctx.sphere('V2 gathered top knot', (0,.023,1.758), (.033,.037,.032), ctx.M['hair'], 'head', 64, 32)
    for vertex in bun.data.vertices:
        p = vertex.co-Vector((0,.023,1.758))
        a = math.atan2(p.y/.037,p.x/.033)
        factor = 1+.035*math.sin(5*a+3*p.z/.032)
        vertex.co.x *= factor; vertex.co.y = .023+p.y*factor
    ctx.tube('V2 silver hair pin', [(-.064,.023,1.754),(.065,.023,1.754)], [.0017,.0014], ctx.M['metal'], 'head', 12)
    ctx.sphere('V2 jade pin end', (-.067,.023,1.754), (.0045,.0032,.0032), ctx.M['jade'], 'head', 20, 12)
    # Soft narrow tie lays over the upper rear hair and follows its rig group.
    _lock(ctx, 'V2 hanging silk tie', [(0,.097,1.693),(.005,.107,1.612),(.010,.108,1.527),(.005,.119,1.461)],
          .006,.0010,ctx.M.get('facing',ctx.M['hair']),'hair',32,12,(0,1,0))
    return ctx.PARTS[start:]
