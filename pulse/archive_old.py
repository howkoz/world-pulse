"""Move daily pages and pictures older than one week into archive/.

    py pulse/archive_old.py          (publish.py runs it before every build)

The rule (the same one build_pulse.py uses to mark what the home page shows):
- The current week is the latest scan date and the 6 days before it (7 scans).
- An edition older than that is ARCHIVED. Its World Desk page and timeline pictures move into
  archive/ with the same folder layout (archive/World-Desk-...html, archive/timelines/...svg), and
  the edition's links in pulse-data.json are pointed at the new place.
- A Story-*.html page stays where it is while its running story is still current (a thread whose
  "story" field names that page), and moves with its edition once the story is archived too.

Nothing is deleted: files are moved with "git mv", so their history stays. Links inside a moved page
that point at a file still outside the archive get "../" in front; links to the home page and the
pulse scripts keep working. Running it twice changes nothing.
"""
import json
import os
import re
import subprocess
import sys
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, 'pulse-data.json')
ARCH = 'archive'
WINDOW_DAYS = 7


def cutoff_of(data):
    latest = max(e['date'] for e in data['editions'])
    y, m, d = map(int, latest.split('-'))
    return (date(y, m, d) - timedelta(days=WINDOW_DAYS - 1)).isoformat()


def last_news(t):
    real = [u['ed'] for u in t['updates'] if u['tag'] != 'NO CHANGE']
    return real[-1] if real else t['updates'][-1]['ed']


def thread_archived(t, cutoff, now_utc):
    """A story is archived when it has had no real news for a week and nothing planned is still ahead."""
    nxt = t.get('next') or {}
    if nxt.get('utc') and nxt['utc'] > now_utc:
        return False
    return last_news(t) < cutoff


def git(*args):
    r = subprocess.run(['git'] + list(args), cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit('git %s failed: %s' % (' '.join(args), r.stderr.strip()))


LINK = re.compile(r'''(["'])((?:\.\./)?(?:World-Desk-[^"']+\.html|Story-[^"']+\.html|World-Pulse\.html|index\.html|Archive\.html|timelines/[^"']+|pulse/[^"']+))\1''')


def fix_links_in(path, in_archive, archived_set):
    """Rewrite local links in one HTML file so they point at where each target now lives."""
    text = open(path, encoding='utf-8', newline='').read()

    def repl(m):
        q, link = m.group(1), m.group(2)
        target = link[3:] if link.startswith('../') else link
        if target.startswith(ARCH + '/'):
            target = target[len(ARCH) + 1:]
        target_in_arch = target in archived_set
        if in_archive:
            new = target if target_in_arch else '../' + target
        else:
            new = ARCH + '/' + target if target_in_arch else target
        return q + new + q

    new_text = LINK.sub(repl, text)
    if new_text != text:
        open(path, 'w', encoding='utf-8', newline='').write(new_text)
        return True
    return False


def main():
    from datetime import datetime, timezone
    now_utc = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    data = json.load(open(SRC, encoding='utf-8'))
    cutoff = cutoff_of(data)
    keep_story = set()
    for t in data['threads']:
        if t.get('story') and not thread_archived(t, cutoff, now_utc):
            keep_story.add(t['story'])

    moved = []
    for e in data['editions']:
        if e['date'] >= cutoff:
            continue
        new_links = []
        for label, href in e['links']:
            if href.startswith('http') or href.startswith(ARCH + '/'):
                new_links.append([label, href])
                continue
            if href in keep_story:
                new_links.append([label, href])
                continue
            src = os.path.join(ROOT, href)
            dst = os.path.join(ROOT, ARCH, href)
            if os.path.exists(src):
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                git('mv', href.replace('\\', '/'), (ARCH + '/' + href).replace('\\', '/'))
                moved.append(href)
            new_links.append([label, ARCH + '/' + href])
        e['links'] = new_links

    # Every file now inside archive/, by its path relative to archive/.
    archived_set = set()
    arch_root = os.path.join(ROOT, ARCH)
    if os.path.isdir(arch_root):
        for dp, _, files in os.walk(arch_root):
            for f in files:
                archived_set.add(os.path.relpath(os.path.join(dp, f), arch_root).replace('\\', '/'))

    fixed = []
    for dp, _, files in os.walk(ROOT):
        if '.git' in dp.split(os.sep):
            continue
        for f in files:
            if not f.endswith('.html'):
                continue
            p = os.path.join(dp, f)
            rel = os.path.relpath(p, ROOT).replace('\\', '/')
            if fix_links_in(p, rel.startswith(ARCH + '/'), archived_set):
                fixed.append(rel)

    s = json.dumps(data, ensure_ascii=False, indent=1) + '\n'
    if s != open(SRC, encoding='utf-8', newline='').read():
        open(SRC, 'w', encoding='utf-8', newline='').write(s)
    print('Archive cut-off %s: moved %d file(s), fixed links in %d page(s).' % (cutoff, len(moved), len(fixed)))
    for m in moved:
        print('  moved', m)


if __name__ == '__main__':
    main()
