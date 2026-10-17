"""Fetch selected official free GDC ZIP members using HTTP ranges, not full archives."""
from pathlib import Path
import concurrent.futures
import io
import json
import struct
import urllib.request
import zipfile
import zlib

HERE = Path(__file__).resolve().parent
HEADERS = {'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'identity'}


def request(url, span):
    req = urllib.request.Request(url, headers={**HEADERS, 'Range': 'bytes=' + span})
    with urllib.request.urlopen(req, timeout=40) as r:
        if r.status != 206:
            raise ValueError(f'Range unsupported: {r.status}, {url}')
        return r.read(), dict(r.headers)


def index(year, part, count, url=None):
    path = HERE / f'index-{year}-{part}.json'
    if path.exists():
        return json.loads(path.read_text())
    url = url or f'https://downloads.sonniss.com/Sonniss.com-GDC{year}-GameAudioBundle{part}of{count}.zip'
    tail, headers = request(url, '-131072')
    total = int(headers['Content-Range'].split('/')[-1])
    pos = tail.rfind(b'PK\x05\x06')
    if pos < 0:
        raise ValueError('No ZIP end record')
    e = struct.unpack_from('<4s4H2LH', tail, pos)
    size, offset = e[5:7]
    if size == 0xffffffff or offset == 0xffffffff:
        locator = tail.rfind(b'PK\x06\x07', 0, pos)
        _, _, zoff, _ = struct.unpack_from('<4sLQL', tail, locator)
        zdata, _ = request(url, f'{zoff}-{zoff+55}')
        ze = struct.unpack_from('<4sQ2H2L4Q', zdata)
        size, offset = ze[-2:]
    if offset >= total - len(tail):
        directory = tail[offset-(total-len(tail)):offset-(total-len(tail))+size]
    else:
        directory, _ = request(url, f'{offset}-{offset+size-1}')
    entries = []
    pos = 0
    while directory[pos:pos+4] == b'PK\x01\x02':
        h = struct.unpack_from('<4s6H3L5H2L', directory, pos)
        flags, method, crc, compressed, uncompressed = h[3], h[4], h[7], h[8], h[9]
        n, extra_n, comment_n = h[10:13]
        name = directory[pos+46:pos+46+n].decode('utf8' if flags & 2048 else 'cp437')
        extra = directory[pos+46+n:pos+46+n+extra_n]
        local_offset = h[-1]
        ep = 0
        while ep+4 <= len(extra):
            tag, esize = struct.unpack_from('<HH', extra, ep)
            if tag == 1:
                zp = ep+4
                values = [uncompressed, compressed, local_offset]
                for vi in range(3):
                    if values[vi] == 0xffffffff:
                        values[vi] = struct.unpack_from('<Q', extra, zp)[0]
                        zp += 8
                uncompressed, compressed, local_offset = values
            ep += 4+esize
        entries.append(dict(name=name, method=method, crc=crc, compressed=compressed,
                            uncompressed=uncompressed, offset=local_offset))
        pos += 46+n+extra_n+comment_n
    result = dict(url=url, bytes=total, entries=entries)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    return result


def extract(idx, entry, output):
    output = Path(output)
    if output.exists() and zlib.crc32(output.read_bytes()) == entry['crc']:
        return
    offset = entry['offset']
    data, _ = request(idx['url'], f'{offset}-{offset+29}')
    h = struct.unpack('<4s5H3L2H', data)
    start = offset+30+h[-2]+h[-1]
    data, _ = request(idx['url'], f'{start}-{start+entry["compressed"]-1}')
    raw = zlib.decompress(data, -15) if entry['method'] == 8 else data
    if len(raw) != entry['uncompressed'] or zlib.crc32(raw) != entry['crc']:
        raise ValueError('ZIP member checksum mismatch')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(raw)


if __name__ == '__main__':
    def job(part):
        try:
            data = index(2024, part, 9)
            print(part, len(data['entries']), [e['name'] for e in data['entries'][:2]], flush=True)
        except Exception as e:
            print(part, type(e).__name__, str(e), flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(job, range(1, 10)))
