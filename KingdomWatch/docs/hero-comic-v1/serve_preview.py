"""Local QA server with enough accept queue for concurrent Creator asset preloads."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial

class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128

if __name__ == '__main__':
    build = Path(__file__).resolve().parents[2]/'build/web-mobile'
    PreviewServer(('127.0.0.1',8765),partial(SimpleHTTPRequestHandler,directory=str(build))).serve_forever()
