"""Publish World Pulse to GitHub.

    py publish.py "<one-line summary of what changed>" [timeline.svg ...]

1. Moves pages older than one week into archive/ (pulse/archive_old.py), then builds pulse/pulse-data.js (stops if the data has a problem).
2. Copies any timeline SVG files given into timelines/.
3. Safety check over every site file: no local computer paths, no keys or tokens, no em or en dashes.
4. Commits the changed site files BY NAME (never "add everything") and pushes to origin main.
"""
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE_EXT = ('.html', '.js', '.json', '.md', '.svg', '.py', '.txt', '.css')
SITE_DIRS = ('', 'pulse', 'timelines', 'archive', 'archive/timelines')
EXTRA = ('.nojekyll', '.gitignore')
BAD = [
    (re.compile(r'[A-Za-z]:[\\/]+Users[\\/]', re.I), 'a local computer path'),
    (re.compile(r'/c/Users/', re.I), 'a local computer path'),
    (re.compile(r'(ghp_|gho_|github_pat_|xox[bap]-|AKIA[0-9A-Z]{12}|sk-[A-Za-z0-9]{20})'), 'something that looks like a key or token'),
    (re.compile('[—–]'), 'an em or en dash'),
]


def run(cmd, check=True):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    if check and r.returncode != 0:
        print(r.stdout + r.stderr)
        sys.exit('FAILED: ' + ' '.join(cmd))
    return r


def site_files():
    out = []
    for d in SITE_DIRS:
        folder = os.path.join(ROOT, d)
        if not os.path.isdir(folder):
            continue
        for name in sorted(os.listdir(folder)):
            p = os.path.join(folder, name)
            if os.path.isfile(p) and name.lower().endswith(SITE_EXT):
                out.append(os.path.relpath(p, ROOT).replace('\\', '/'))
    return out + [e for e in EXTRA if os.path.exists(os.path.join(ROOT, e))]


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    summary = sys.argv[1]
    for svg in sys.argv[2:]:
        dest = os.path.join(ROOT, 'timelines', os.path.basename(svg))
        shutil.copyfile(svg, dest)
        print('copied', os.path.basename(svg))
    r = run([sys.executable, os.path.join('pulse', 'archive_old.py')])
    print(r.stdout.strip())
    run([sys.executable, os.path.join('pulse', 'build_pulse.py')])
    problems = []
    files = site_files()
    for f in files:
        if f == 'publish.py':
            continue
        text = open(os.path.join(ROOT, f), encoding='utf-8', errors='replace').read()
        for rx, what in BAD:
            m = rx.search(text)
            if m:
                problems.append('%s contains %s near "%s"' % (f, what, text[max(0, m.start() - 20):m.end() + 20].replace('\n', ' ')))
    if problems:
        print('NOT PUBLISHED:')
        for p in problems:
            print('  -', p)
        sys.exit(1)
    status = run(['git', 'status', '--porcelain', '--untracked-files=all', '--'] + files).stdout
    changed = [line[3:].split(' -> ')[-1].strip().strip('"') for line in status.splitlines() if line.strip()]
    if not changed:
        print('Nothing changed; nothing to publish.')
        return
    run(['git', 'add', '--'] + changed)
    msg = summary + '\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'
    run(['git', 'commit', '-m', msg])
    run(['git', 'push', 'origin', 'main'])
    print('Published %d file(s): %s' % (len(changed), ', '.join(changed)))
    print('Live in about a minute at https://howkoz.github.io/world-pulse/')


if __name__ == '__main__':
    main()
