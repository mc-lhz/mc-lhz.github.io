#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
移动端跨浏览器渲染冒烟测试（Chromium / Firefox / WebKit）。

背景：这站把「近期随笔」做成了 iframe 嵌入（public/index.html 只负责壳），
主页面又是 quirks 模式的手写静态页 —— 这些在单引擎上测不出来。
已踩过的坑：
  1. iframe 的 loading="lazy"：Chromium 首屏加载，Firefox/WebKit 要滚动到附近才请求，
     手机端首屏的随笔区会长时间是空白占位框。所以断言里明确要求「不滚动也能拿到高度」。
  2. .menu 写死 120px 高度而顶栏只有 80px，会把首屏整体顶下 24px，
     视口顶部 0~24px 露出裸背景（没有薄纱材质）。
  3. iframe 高度写死 / flex-basis 覆盖 JS 写入的高度，都会导致 iframe 内出现滚动条。

用法：
    python scripts/verify-mobile.py                      # 测线上
    python scripts/verify-mobile.py http://127.0.0.1:4322/   # 测本地 preview
    python scripts/verify-mobile.py <url> --shots out/    # 顺便存截图

依赖：pip install playwright && playwright install chromium firefox webkit
没装的引擎会自动跳过并在结尾提示（不算失败）。
"""
import argparse
import json
import os
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("缺少 playwright：pip install playwright && playwright install chromium firefox webkit")

DEVICES = ["iPhone 13", "Pixel 5"]
BROWSERS = ["chromium", "firefox", "webkit"]

# 主页面断言
JS_MAIN = """() => {
  const q = s => document.querySelector(s);
  const box = s => { const e = q(s); if (!e) return null;
    const r = e.getBoundingClientRect();
    return { top: Math.round(r.top), h: Math.round(r.height) }; };
  const f = q('iframe.news-iframe');
  return {
    vw: innerWidth,
    docScrollW: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    bannerTop: box('.banner-carousel') ? box('.banner-carousel').top : null,
    menuTop: box('.menu ul li') ? box('.menu ul li').top : null,
    cards: document.querySelectorAll('.glass-card').length,
    totp: !!q('.totp-card'),
    iframeH: f ? Math.round(f.getBoundingClientRect().height) : null,
    iframeAutoHeight: f ? (f.dataset.autoHeight || null) : null,  // '1' = JS 已按内容定高
  };
}"""
# 随笔 iframe 内部断言
JS_ESSAY = """() => {
  const de = document.documentElement;
  return {
    items: document.querySelectorAll('.news-item').length,
    needsScroll: de.scrollHeight > de.clientHeight + 1,
    scrollH: de.scrollHeight, clientH: de.clientHeight,
  };
}"""
# 3D 背景 iframe 断言
JS_3D = """() => {
  const c = document.querySelector('canvas');
  let webgl = false;
  try { webgl = !!(c && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) {}
  return { canvas: !!c, webgl: webgl, size: c ? (c.width + 'x' + c.height) : null };
}"""


def check(rec, name, ok, detail=""):
    rec["checks"].append({"name": name, "ok": bool(ok), "detail": str(detail)})
    return bool(ok)


def run_device(pw, browser_name, device, url, shot_dir):
    rec = {"browser": browser_name, "device": device, "checks": []}
    try:
        browser = getattr(pw, browser_name).launch()
    except Exception as e:
        rec["skipped"] = f"launch failed: {str(e)[:120]}"
        return rec
    try:
        ctx = browser.new_context(**pw.devices[device])
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:140]))
        # 关键：不滚动，直接看随笔区是否已经渲染
        page.goto(url, wait_until="load", timeout=60000)
        page.wait_for_timeout(3000)
        main = page.evaluate(JS_MAIN)
        rec["main"] = main

        check(rec, "无横向溢出", not main["horizontalOverflow"],
              f'scrollW={main["docScrollW"]} vw={main["vw"]}')
        check(rec, "顶端薄纱覆盖到 y=0", main["bannerTop"] == 0, f'banner.top={main["bannerTop"]}')
        check(rec, "菜单未溢出视口(top>=0)", main["menuTop"] is None or main["menuTop"] >= 0,
              f'menu.top={main["menuTop"]}')
        check(rec, "项目卡片 8 张", main["cards"] == 8, main["cards"])
        check(rec, "TOTP 卡存在", main["totp"])

        # 随笔 iframe：不滚动也必须已经加载并自适应高度（防 loading=lazy 回归）
        fr_essay = [f for f in page.frames if "recent-essays" in f.url]
        if check(rec, "随笔 iframe 首屏即加载(未滚动)", bool(fr_essay),
                 "未找到 /recent-essays/ frame"):
            essay = fr_essay[0].evaluate(JS_ESSAY)
            rec["essay"] = essay
            check(rec, "随笔 iframe 高度已自适应", main["iframeAutoHeight"] == "1",
                  f'autoHeight={main["iframeAutoHeight"]} h={main["iframeH"]}')
            check(rec, "随笔列表 5 条", essay["items"] == 5, essay["items"])
            check(rec, "随笔 iframe 内无滚动条", not essay["needsScroll"],
                  f'scrollH={essay["scrollH"]} clientH={essay["clientH"]}')

        fr_3d = [f for f in page.frames if "background3D" in f.url]
        if check(rec, "3D 背景 iframe 存在", bool(fr_3d)):
            bg = fr_3d[0].evaluate(JS_3D)
            rec["bg3d"] = bg
            check(rec, "3D 背景 canvas + WebGL", bg["canvas"] and bg["webgl"], bg["size"])

        check(rec, "无 JS 运行时错误", not errors, errors[:3])

        if shot_dir:
            os.makedirs(shot_dir, exist_ok=True)
            rec["shot"] = os.path.join(shot_dir, f"{browser_name}-{device.replace(' ', '')}.png")
            page.screenshot(path=rec["shot"])
        ctx.close()
    except Exception as e:
        rec["error"] = str(e)[:200]
    finally:
        browser.close()
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url", nargs="?", default="https://mc-lhz.github.io/")
    ap.add_argument("--shots", default=None, help="截图输出目录")
    ap.add_argument("--device", action="append", help="只跑指定设备（可重复）")
    args = ap.parse_args()

    devices = args.device or DEVICES
    results, skipped = [], []
    with sync_playwright() as pw:
        for bname in BROWSERS:
            for device in devices:
                rec = run_device(pw, bname, device, args.url, args.shots)
                if "skipped" in rec:
                    skipped.append(f"{bname}: {rec['skipped']}")
                results.append(rec)

    print(json.dumps(results, ensure_ascii=False, indent=2))

    failed, ran = 0, 0
    for rec in results:
        if "checks" not in rec:
            continue
        ran += 1
        bad = [c for c in rec["checks"] if not c["ok"]]
        status = "PASS" if not bad else "FAIL"
        if bad:
            failed += 1
        print(f"[{status}] {rec['browser']:8s} {rec['device']:10s} "
              f"{len(rec['checks']) - len(bad)}/{len(rec['checks'])}"
              + ("" if not bad else "  -> " + "; ".join(f"{c['name']}({c['detail']})" for c in bad)))
    for s in skipped:
        print(f"[SKIP] {s}")

    print(f"\n{args.url}  共 {ran} 组通过引擎，失败 {failed} 组" + (f"，跳过 {len(skipped)} 个引擎" if skipped else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())