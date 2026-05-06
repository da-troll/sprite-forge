#!/usr/bin/env python3
"""Create animated GIF from frame images."""
import argparse
import sys
from pathlib import Path
from PIL import Image

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--frames', nargs='+', required=True)
    p.add_argument('--gif-out', required=True)
    p.add_argument('--size', type=int, default=128)
    p.add_argument('--fps', type=int, default=8)
    args = p.parse_args()

    frames = []
    for fp in args.frames:
        try:
            img = Image.open(fp).convert('RGBA').resize((args.size, args.size), Image.NEAREST)
            # Convert to P mode for GIF
            frames.append(img.convert('RGB').quantize(colors=256, method=Image.Quantize.FASTOCTREE))
        except Exception as e:
            print(f'Warning: skipping {fp}: {e}', file=sys.stderr)

    if not frames:
        print('No valid frames', file=sys.stderr)
        sys.exit(1)

    duration = int(1000 / args.fps)
    out = Path(args.gif_out)
    out.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        str(out),
        format='GIF',
        append_images=frames[1:],
        save_all=True,
        duration=duration,
        loop=0,
        optimize=False,
    )
    print(f'GIF saved: {out} ({len(frames)} frames @ {args.fps}fps)')

if __name__ == '__main__':
    main()
