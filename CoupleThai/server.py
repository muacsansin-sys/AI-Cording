import json
import os
import random
import string
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / 'data' / 'store.json'
PORT = int(os.environ.get('PORT', '3000'))


def ensure_data_file():
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text(
            json.dumps({'users': [], 'couples': [], 'messages': [], 'events': []}, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )


def read_store():
    ensure_data_file()
    return json.loads(DATA_FILE.read_text(encoding='utf-8'))


def write_store(store):
    ensure_data_file()
    DATA_FILE.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding='utf-8')


def make_id(prefix):
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f'{prefix}-{random.randint(1000, 9999)}-{suffix}'


def make_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def detect_language(text):
    return 'th' if any('\u0e00' <= char <= '\u0e7f' for char in text) else 'ko'


def translate_text(text, source=None):
    source = source or detect_language(text)
    mapping = {
        'ko': {
            '안녕': 'สวัสดี',
            '안녕, 오늘 어땠어?': 'สวัสดี วันนี้เป็นยังไงบ้าง?',
            '보고 싶어': 'คิดถึงนะ',
            '사랑해': 'รักนะ',
            '고마워': 'ขอบคุณนะ',
            '잘 자': 'ฝันดีนะ',
        },
        'th': {
            'สวัสดี': '안녕',
            'สวัสดี วันนี้เป็นยังไงบ้าง?': '안녕, 오늘 어땠어?',
            'คิดถึงนะ': '보고 싶어',
            'รักนะ': '사랑해',
            'ขอบคุณนะ': '고마워',
            'ฝันดีนะ': '잘 자',
        },
    }
    return mapping.get(source, {}).get(
        text.strip(),
        f'[{"태국어" if source == "ko" else "한국어"} 번역 준비중] {text}',
    )


def now():
    return datetime.utcnow().isoformat() + 'Z'


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_json(204, {})

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == '/api/health':
            self.send_json(200, {'status': 'ok'})
            return

        if parsed.path == '/api/messages':
            store = read_store()
            couple_id = parse_qs(parsed.query).get('coupleId', [''])[0]
            self.send_json(200, {'messages': [item for item in store['messages'] if item.get('coupleId') == couple_id]})
            return

        if parsed.path == '/api/events':
            store = read_store()
            couple_id = parse_qs(parsed.query).get('coupleId', [''])[0]
            self.send_json(200, {'events': [item for item in store['events'] if item.get('coupleId') == couple_id]})
            return

        self.serve_static(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == '/api/profile/create':
            body = self.read_json_body()
            store = read_store()
            couple = {'id': make_id('couple'), 'code': make_code(), 'createdAt': now()}
            user = {'id': make_id('user'), 'name': body.get('name', '사용자'), 'coupleId': couple['id'], 'role': 'owner'}
            store['couples'].append(couple)
            store['users'].append(user)
            write_store(store)
            self.send_json(200, {'user': user, 'couple': couple})
            return

        if parsed.path == '/api/profile/join':
            body = self.read_json_body()
            store = read_store()
            code = str(body.get('code', '')).upper()
            couple = next((item for item in store['couples'] if item['code'] == code), None)
            if not couple:
                self.send_json(404, {'error': '존재하지 않는 커플 코드입니다.'})
                return
            user = {'id': make_id('user'), 'name': body.get('name', '사용자'), 'coupleId': couple['id'], 'role': 'partner'}
            store['users'].append(user)
            write_store(store)
            self.send_json(200, {'user': user, 'couple': couple})
            return

        if parsed.path == '/api/messages':
            body = self.read_json_body()
            store = read_store()
            message = {'id': make_id('message'), **body, 'createdAt': now()}
            store['messages'].append(message)
            write_store(store)
            self.send_json(200, {'message': message})
            return

        if parsed.path == '/api/events':
            body = self.read_json_body()
            store = read_store()
            event = {'id': make_id('event'), **body, 'createdAt': now()}
            store['events'].append(event)
            write_store(store)
            self.send_json(200, {'event': event})
            return

        if parsed.path == '/api/translate':
            body = self.read_json_body()
            text = body.get('text', '')
            source = body.get('source') or detect_language(text)
            self.send_json(200, {
                'translatedText': translate_text(text, source),
                'source': source,
                'target': 'th' if source == 'ko' else 'ko',
            })
            return

        self.send_json(404, {'error': 'Not found'})

    def read_json_body(self):
        length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(length).decode('utf-8') if length else '{}'
        try:
            return json.loads(body or '{}')
        except json.JSONDecodeError:
            return {}

    def send_json(self, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self, path_name):
        if path_name in ('', '/'):
            path_name = '/index.html'
        target = (ROOT / path_name.lstrip('/')).resolve()
        if not str(target).startswith(str(ROOT)):
            self.send_json(403, {'error': 'Forbidden'})
            return
        if not target.exists() or not target.is_file():
            self.send_json(404, {'error': 'Not found'})
            return

        mime = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
        }.get(target.suffix.lower(), 'application/octet-stream')

        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(target.read_bytes())


if __name__ == '__main__':
    ensure_data_file()
    server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'LoveBridge is running at http://localhost:{PORT}')
    server.serve_forever()
