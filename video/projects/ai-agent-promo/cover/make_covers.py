#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ai-agent-promo 封面生成脚本（16:9 + 4:3）
用法：  python3 make_covers.py
产物：  cover-16x9.png (1920x1080，直接复制基准 cover-main-nebius.png)
        cover-4x3.png  (1600x1200，本脚本 PIL 重排)
改字号/间距：只改下面 RATIO_43 里的参数重跑即可。
素材：cover/assets/ 自带一份（源出 assets/logos/ + tmp/cover-assets 原始件，
      md5 已核对；tmp 会被清，所以素材随脚本持久化在这里）。
2026-11-03 由子代理整理；16:9 拼法原版见 journal/2026-11-02-ai-agent-promo-cover.md
"""
import os, re
import cairosvg
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(BASE, 'assets')          # 自带素材目录
LOGOS = os.path.abspath(os.path.join(BASE, '..', 'assets', 'logos'))  # 工程素材目录（备用）

CREAM = (236, 233, 225)
CORAL = (217, 119, 87)
AGNES_BLUE = (74, 99, 216)                # 提亮的品牌蓝 #3248AF（深底可读）
NEBIUS_LIME = (212, 244, 62)              # #D4F43E（已换下：N 现为智谱 Z 竖置）
ZHIPU = (91, 92, 242)                    # #5B5CF2 z.ai 紫
ZWHITE = (250, 250, 252)
XIAOMI_ORANGE = (255, 105, 0)             # 小米 #FF6900
BG_TOP, BG_BOT = (8, 11, 18), (18, 24, 34)  # #080B12 -> #121822

CJK = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
FONT = os.path.join(A, 'ArchivoBlack.ttf')

# 4:3 版参数（1600x1200；字间距按要求收到 56px）
RATIO_43 = dict(W=1600, H=1200, row1_h=380, star_h=106, row2_h=230,
                gap=56, tag_fs=52, y1=120, y2=628, margin=80)
RATIO_169 = dict(W=1920, H=1080, row1_h=430, star_h=120, row2_h=250,
                 gap=64, tag_fs=56, y1=100, y2=560, margin=100)


def _from_logos_or_assets(name):
    """优先工程素材目录 assets/logos/，退回 cover/assets/ 自带副本"""
    p = os.path.join(LOGOS, name)
    return p if os.path.exists(p) else os.path.join(A, name)


def rasterize(path, size, recolor=None):
    s = open(path).read()
    if recolor:
        s = re.sub(r'fill="#[0-9a-fA-F]{3,6}"', f'fill="#{recolor}"', s)
        s = re.sub(r'fill="currentColor"', f'fill="#{recolor}"', s)
    tmp = path + '.render.tmp.png'
    cairosvg.svg2png(bytestring=s.encode(), write_to=tmp,
                     output_width=size, output_height=size)
    im = Image.open(tmp).convert('RGBA')
    os.remove(tmp)
    return im


def tight(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def fit(im, h):
    return im.resize((max(1, int(round(im.width * h / im.height))), h), Image.LANCZOS)


def tint(im, color):
    arr = np.array(im)
    r, g, b = color
    out = np.dstack([np.full(arr.shape[:2], r, np.uint8),
                     np.full(arr.shape[:2], g, np.uint8),
                     np.full(arr.shape[:2], b, np.uint8),
                     arr[..., 3]])
    return Image.fromarray(out)


# ---------- 素材 ----------
anthropic = tight(rasterize(_from_logos_or_assets('anthropic.svg'), 512, 'ECE9E1'))
star = tight(rasterize(_from_logos_or_assets('claude.svg'), 256, 'D97757'))
# 彩色谷歌 G（assets/logos 里只有单色版，彩色版随脚本放在 cover/assets/）
gg = tight(rasterize(os.path.join(A, 'google-color.svg'), 512))
# Nebius 官方 N 标（assets/logos/nebius.svg 是 wordmark 不是 N 单标，N 单标随脚本放在 cover/assets/）
nebius = tight(rasterize(os.path.join(A, 'nebius-mark.svg'), 512, 'D4F43E'))
tdocs = Image.open(os.path.join(A, 'tdocs-app.png')).convert('RGBA').resize((512, 512), Image.LANCZOS)

# Agnes：从蓝底圆角块抠白色 swirl
ag = np.array(Image.open(_from_logos_or_assets('agnes.png')).convert('RGBA'))
mask = (ag[..., 3] > 200) & (ag[..., 0] > 200) & (ag[..., 1] > 200) & (ag[..., 2] > 200)
sw = np.dstack([np.full(ag.shape[:2], 255, np.uint8)] * 3 + [(mask * 255).astype(np.uint8)])
swirl = tight(Image.fromarray(sw))


def mimo_e_from(png):
    """取 Xiaomi MiMo 词标第一行的小写 m（两拱三竖），逆时针转 90° → 圆角 E，染小米橙"""
    big = Image.open(png).convert('RGBA')
    if big.width > 2048:
        big = big.resize((2048, int(big.height * 2048 / big.width)), Image.LANCZOS)
    ma = big.split()[3]
    px = ma.load()
    rows = [y for y in range(big.height) if any(px[x, y] > 40 for x in range(0, big.width, 2))]
    bands, start, prev = [], rows[0], rows[0]
    for y in rows[1:]:
        if y - prev > 12:
            bands.append((start, prev)); start = y
        prev = y
    bands.append((start, prev))
    band = bands[0]
    cols = [x for x in range(big.width) if any(px[x, y] > 40 for y in range(band[0], band[1]))]
    cstart, prev, cbands = cols[0], cols[0], []
    for x in cols[1:]:
        if x - prev > 18:
            cbands.append((cstart, prev)); cstart = x
        prev = x
    cbands.append((cstart, prev))
    g_m = cbands[3]  # [Xi]-a-o-[m]-i（首带 Xi 粘连）
    m = big.crop((g_m[0] - 4, band[0] - 4, g_m[1] + 4, band[1] + 4)).rotate(90, expand=True)
    return tint(tight(m), XIAOMI_ORANGE)


mimo_e = mimo_e_from(os.path.join(A, 'mimo-big.png'))


def text_img(ch, size, color):
    im = Image.new('RGBA', (1100, 1100), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((550, 550), ch, font=ImageFont.truetype(FONT, size), fill=color, anchor='mm')
    return tight(im)


def background(W, H):
    bg = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOT)))
    glow = Image.new('L', (W, H), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W // 2 - int(W * 0.405), int(H * 0.11), W // 2 + int(W * 0.405), int(H * 0.91)], fill=46)
    glow = glow.filter(ImageFilter.GaussianBlur(int(W * 0.083)))
    blue = Image.new('RGB', (W, H), (26, 42, 84))
    return Image.composite(blue, bg, glow).convert('RGBA')



def zhipu_N(h):
    """智谱式 Z（紫圆角块+白 Z），顺时针转 90°：上横→右竖、下横→左竖、斜线→左上到右下 = N。"""
    size = h
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.18), fill=ZHIPU)
    lw = max(3, int(size * 0.115))
    m = int(size * 0.26)
    d.line([(m, m), (size - m, m)], fill=ZWHITE, width=lw)
    d.line([(size - m, m), (m, size - m)], fill=ZWHITE, width=lw)
    d.line([(m, size - m), (size - m, size - m)], fill=ZWHITE, width=lw)
    return img.rotate(-90, expand=True, resample=Image.BICUBIC)

def agnes_A(h):
    g = text_img('A', 560, AGNES_BLUE + (255,))
    g = fit(g, h)
    sw = fit(swirl, int(h * 0.34))
    g.alpha_composite(sw, ((g.width - sw.width) // 2, int(g.height * 0.52)))
    return g


def compose_43(path, W, H, row1_h, star_h, row2_h, gap, tag_fs, y1, y2, margin):
    bg = background(W, H)
    d = ImageDraw.Draw(bg)

    # 第一行 AI：Anthropic 官方标（A+斜杠，斜杠即 I）；Claude 星芒点缀斜杠顶端
    a_mark = fit(anthropic, row1_h)
    x0 = (W - a_mark.width) // 2
    bg.alpha_composite(a_mark, (x0, y1))
    st = fit(star, star_h)
    bg.alpha_composite(st, (x0 + a_mark.width - st.width - 26, y1 - int(star_h * 0.82)))

    # 第二行 AGENT
    glyphs = [
        agnes_A(row2_h),
        fit(gg, int(row2_h * 1.05)),   # 圆形 G 略过冲
        fit(mimo_e, row2_h),
        fit(nebius, row2_h),  # 主人 11:20 收回智谱方案，恢复 Nebius N（zhipu_N 函数保留备用）
        fit(tdocs, int(row2_h * 1.03)),  # 圆角块稍收
    ]
    row2_w = sum(g.width for g in glyphs) + gap * 4
    if row2_w > W - 2 * margin:  # 放不下就整体缩一行
        k = (W - 2 * margin) / row2_w
        glyphs = [g.resize((max(1, int(g.width * k)), max(1, int(g.height * k))), Image.LANCZOS) for g in glyphs]
        row2_w = sum(g.width for g in glyphs) + int(gap * k) * 4
        gap = int(gap * k)
    x = (W - row2_w) // 2
    row2_h_max = max(g.height for g in glyphs)
    for g in glyphs:
        bg.alpha_composite(g, (x, y2 + (row2_h_max - g.height) // 2))
        x += g.width + gap

    # 右下角主题句：珊瑚竖条 + 思源黑体/Noto CJK Bold
    f_tag = ImageFont.truetype(CJK, tag_fs)
    tag = '把它们接进你的设备'
    tw = d.textlength(tag, font=f_tag)
    tx, ty = W - int(W * 0.056) - tw, H - int(H * 0.083)
    d.rectangle([tx - tag_fs * 0.45, ty + tag_fs * 0.14, tx - tag_fs * 0.24, ty + tag_fs * 1.14], fill=CORAL)
    d.text((tx, ty), tag, font=f_tag, fill=(245, 244, 240))

    bg.convert('RGB').save(path)
    print('saved', path, Image.open(path).size)


if __name__ == '__main__':
    # ① 16:9 重画（N 已换智谱 Z 竖置，不再复制 nebius 旧底图）
    p = RATIO_169
    compose_43(os.path.join(BASE, 'cover-16x9.png'), p['W'], p['H'], p['row1_h'],
               p['star_h'], p['row2_h'], p['gap'], p['tag_fs'], p['y1'], p['y2'], p['margin'])

    # ② 4:3 重排
    p = RATIO_43
    compose_43(os.path.join(BASE, 'cover-4x3.png'), p['W'], p['H'], p['row1_h'],
               p['star_h'], p['row2_h'], p['gap'], p['tag_fs'], p['y1'], p['y2'], p['margin'])
