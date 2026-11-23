"""Gera os SVGs da marca Sonora (símbolo S + onda sonora).

Rodar:  python brand/gerar_logo.py   (requer: pip install fonttools)
Os textos do logo horizontal viram curvas a partir de brand/fontes/Sora-Variable.ttf
(licença OFL, em brand/fontes/OFL.txt), então o SVG não depende de fonte instalada.
Todas as medidas estão numa grade de 640x640 com centro em (320, 320).
A metade de baixo do S é a de cima girada 180°, então só a de cima é desenhada.
"""
from pathlib import Path

OUT = Path(__file__).parent / "logo"
OUT.mkdir(exist_ok=True)

NAVY = "#09124F"
ROYAL = "#16266D"
BLUE = "#4169E1"
WHITE = "#FFFFFF"

# Metade superior do S: faixa de cima com corte diagonal + descida curva à esquerda.
S_TOP = "M300 138H532L482 215H330C290 215 258 250 240 300H165C182 205 232 138 300 138Z"

# Onda: (deslocamento do centro em x, meia-altura). Espelhada para a direita.
BARS_FULL = [(0, 75), (21, 55), (42, 36), (63, 20), (84, 7)]
BARS_SMALL = [(0, 78), (26, 52), (52, 28)]


def s_shape(fill):
    return (
        f'<path fill="{fill}" d="{S_TOP}"/>'
        f'<path fill="{fill}" d="{S_TOP}" transform="rotate(180 320 320)"/>'
    )


def wave(fill, accent=None, bars=BARS_FULL, width=12, spikes=True):
    out = []
    for dx, half in bars:
        color = accent if (accent and dx <= 21) else fill
        for x in {320 - dx, 320 + dx}:
            h = max(half * 2, width)
            out.append(
                f'<rect x="{x - width / 2:g}" y="{320 - h / 2:g}" width="{width}" '
                f'height="{h}" rx="{width / 2:g}" fill="{color}"/>'
            )
    if spikes:
        out.append(f'<path fill="{fill}" d="M224 315V325L176 320Z"/>')
        out.append(f'<path fill="{fill}" d="M416 315V325L464 320Z"/>')
    return "".join(out)


def symbol(fill, accent=None, small=False):
    if small:
        return s_shape(fill) + wave(fill, accent, BARS_SMALL, width=16, spikes=False)
    return s_shape(fill) + wave(fill, accent)


def svg(view_box, body, w=None, h=None, title="Sonora"):
    size = f' width="{w}" height="{h}"' if w else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}"{size} '
        f'role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'
    )


# Recorte justo do símbolo (x 108–532, y 138–502) com respiro.
SYM_VB = "88 118 464 404"

GLOW = (
    '<defs><radialGradient id="bg" cx="50%" cy="45%" r="70%">'
    f'<stop offset="0" stop-color="{ROYAL}"/><stop offset="1" stop-color="{NAVY}"/>'
    '</radialGradient>'
    '<filter id="glow" x="-30%" y="-30%" width="160%" height="160%">'
    '<feGaussianBlur stdDeviation="14" result="b"/>'
    '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>'
    "</filter></defs>"
)

FILES = {
    # Símbolo solto
    "simbolo-branco.svg": svg(SYM_VB, symbol(WHITE)),
    "simbolo-navy.svg": svg(SYM_VB, symbol(NAVY)),
    "simbolo-navy-destaque.svg": svg(SYM_VB, symbol(NAVY, accent=BLUE)),
    "simbolo-preto.svg": svg(SYM_VB, symbol("#000000")),
    # Ícone de app (quadrado arredondado)
    "icone-app.svg": svg(
        "0 0 640 640",
        f'<rect width="640" height="640" rx="140" fill="{NAVY}"/>'
        f'<g transform="translate(320 320) scale(.78) translate(-320 -320)">{symbol(WHITE)}</g>',
    ),
    "icone-app-brilho.svg": svg(
        "0 0 640 640",
        GLOW
        + '<rect width="640" height="640" rx="140" fill="url(#bg)"/>'
        + f'<g filter="url(#glow)" transform="translate(320 320) scale(.78) translate(-320 -320)">{symbol(WHITE)}</g>',
    ),
    # Favicon / tamanhos pequenos: onda simplificada, sem agulhas
    "favicon.svg": svg(
        "0 0 640 640",
        f'<rect width="640" height="640" rx="120" fill="{NAVY}"/>'
        f'<g transform="translate(320 320) scale(.86) translate(-320 -320)">{symbol(WHITE, small=True)}</g>',
    ),
}


FONT_FILE = Path(__file__).parent / "fontes" / "Sora-Variable.ttf"
_fonts = {}


def text_path(text, x, baseline, size, weight, tracking, fill, skew=0):
    """Converte o texto em curvas usando a Sora no peso pedido.

    Devolve (svg, largura). tracking é o espaço extra entre letras, em px.
    skew inclina como itálico (a Sora não tem itálico próprio).
    """
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont

    if weight not in _fonts:
        _fonts[weight] = instantiateVariableFont(TTFont(FONT_FILE), {"wght": weight})
    font = _fonts[weight]
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    paths, pen_x = [], 0.0
    for i, ch in enumerate(text):
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        d = pen.getCommands()
        if d:
            paths.append(f'<path transform="translate({pen_x:.1f} 0)" d="{d}"/>')
        pen_x += glyphs[name].width
        if i < len(text) - 1:
            pen_x += tracking / scale
    width = pen_x * scale
    sk = f" skewX({-skew})" if skew else ""
    svg_out = (
        f'<g fill="{fill}" transform="translate({x} {baseline}){sk} '
        f'scale({scale:.5f} {-scale:.5f})">{"".join(paths)}</g>'
    )
    return svg_out, width


def wordmark(sym_fill, text_fill, tag_fill, accent=None, bg=None):
    # Logo horizontal: símbolo à esquerda, nome e descritor à direita (em curvas).
    name, name_w = text_path("SONORA", 600, 368, 168, 700, 10, text_fill, skew=12)
    tag, tag_w = text_path("CHURCH MEDIA PLATFORM", 606, 450, 40, 500, 0, tag_fill)
    # Ajusta o espaçamento do descritor para ter a mesma largura do nome.
    gap = (name_w - tag_w) / (len("CHURCH MEDIA PLATFORM") - 1)
    tag, tag_w = text_path("CHURCH MEDIA PLATFORM", 606, 450, 40, 500, gap, tag_fill)
    right = 600 + max(name_w, tag_w) + 30 + 88
    width = round(right - 88)
    body = ""
    if bg:
        body += f'<rect x="88" y="118" width="{width}" height="404" fill="{bg}"/>'
    body += f"<g>{symbol(sym_fill, accent)}</g>{name}{tag}"
    return svg(f"88 118 {width} 404", body)


FILES["logo-horizontal-claro.svg"] = wordmark(NAVY, NAVY, BLUE, accent=BLUE)
FILES["logo-horizontal-escuro.svg"] = wordmark(WHITE, WHITE, "#9FB4F5", bg=NAVY)

for name, content in FILES.items():
    (OUT / name).write_text(content, encoding="utf-8")
    print("ok", name)
