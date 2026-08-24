from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parent / "build"

class SPARequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        safe_path = path.lstrip("/")
        requested_path = (ROOT / safe_path).resolve()

        if path in ("/", ""):
            self._serve_file(ROOT / "index.html")
            return

        if requested_path.exists() and (requested_path.is_file() or requested_path.is_dir()):
            if requested_path.is_dir():
                index_file = requested_path / "index.html"
                if index_file.exists():
                    self._serve_file(index_file)
                    return
            else:
                return super().do_GET()

        self._serve_file(ROOT / "index.html")

    def _serve_file(self, file_path: Path):
        if not file_path.exists():
            self.send_error(404, "File not found")
            return

        content = file_path.read_bytes()
        content_type = "text/html; charset=utf-8"
        if file_path.suffix == ".js":
            content_type = "application/javascript; charset=utf-8"
        elif file_path.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif file_path.suffix == ".json":
            content_type = "application/json; charset=utf-8"
        elif file_path.suffix == ".svg":
            content_type = "image/svg+xml"
        elif file_path.suffix == ".png":
            content_type = "image/png"
        elif file_path.suffix == ".jpg" or file_path.suffix == ".jpeg":
            content_type = "image/jpeg"

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3001"))
    server = ThreadingHTTPServer(("127.0.0.1", port), SPARequestHandler)
    print(f"Serving SPA on http://127.0.0.1:{port}/")
    server.serve_forever()
