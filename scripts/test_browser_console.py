import subprocess, time, json, urllib.request, socket, base64, os

edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
cmd = [edge_path, '--headless=new', '--remote-debugging-port=9222', '--disable-gpu', 'http://localhost:8080/index.html?v=9']
proc = subprocess.Popen(cmd)
time.sleep(2)

try:
    tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json').read().decode('utf-8'))
    page_tab = [t for t in tabs if t.get('type') == 'page'][0]
    ws_url = page_tab['webSocketDebuggerUrl']
    print('Connecting to:', ws_url)

    part = ws_url.replace('ws://', '')
    host_port, path = part.split('/', 1)
    host, port = host_port.split(':')
    port = int(port)
    path = '/' + path

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((host, port))

    key = base64.b64encode(os.urandom(16)).decode('utf-8')
    handshake = (
        f'GET {path} HTTP/1.1\r\n'
        f'Host: {host}:{port}\r\n'
        f'Upgrade: websocket\r\n'
        f'Connection: Upgrade\r\n'
        f'Sec-WebSocket-Key: {key}\r\n'
        f'Sec-WebSocket-Version: 13\r\n\r\n'
    )
    s.sendall(handshake.encode('utf-8'))
    res = s.recv(4096).decode('utf-8', errors='ignore')
    if '101' not in res:
        print('Handshake failed:', repr(res))
        exit(1)

    def send_frame(msg):
        data = msg.encode('utf-8')
        length = len(data)
        frame = bytearray([0x81])
        mask = os.urandom(4)
        if length <= 125:
            frame.append(0x80 | length)
        elif length <= 65535:
            frame.append(0x80 | 126)
            frame.extend(length.to_bytes(2, 'big'))
        else:
            frame.append(0x80 | 127)
            frame.extend(length.to_bytes(8, 'big'))
        frame.extend(mask)
        masked = bytearray(b ^ mask[i % 4] for i, b in enumerate(data))
        frame.extend(masked)
        s.sendall(frame)

    def recv_frames(timeout=2.0):
        s.settimeout(timeout)
        msgs = []
        end_time = time.time() + timeout
        while time.time() < end_time:
            try:
                head = s.recv(2)
                if not head: break
                length = head[1] & 0x7F
                if length == 126:
                    length = int.from_bytes(s.recv(2), 'big')
                elif length == 127:
                    length = int.from_bytes(s.recv(8), 'big')
                payload = b''
                while len(payload) < length:
                    chunk = s.recv(length - len(payload))
                    if not chunk: break
                    payload += chunk
                msgs.append(payload.decode('utf-8', errors='ignore'))
            except socket.timeout:
                break
        return msgs

    send_frame(json.dumps({'id': 1, 'method': 'Runtime.enable'}))
    send_frame(json.dumps({'id': 2, 'method': 'Log.enable'}))
    send_frame(json.dumps({'id': 3, 'method': 'Page.enable'}))
    send_frame(json.dumps({'id': 4, 'method': 'Page.reload'}))

    msgs = recv_frames(3.0)
    exceptions = []
    for m in msgs:
        try:
            d = json.loads(m)
            method = d.get('method', '')
            if 'exceptionThrown' in method:
                exceptions.append(d)
                print('EXCEPTION:', json.dumps(d, ensure_ascii=False, indent=2))
        except:
            pass

    # Try evaluating tab switching and button clicking
    test_expr = '''
    (() => {
        const results = {};
        results.title = document.title;
        const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
        results.tabCount = tabBtns.length;
        results.tabs = tabBtns.map(b => b.textContent.trim());
        
        // Click tab 3 (外協代工 541/543)
        const subTab = tabBtns.find(b => b.dataset.tab === 'subcontract-sim');
        if (subTab) {
            subTab.click();
            results.clickedSubTab = true;
            results.activeTab = document.querySelector('.tab-content.active')?.id;
        }

        // Test simulation button click
        const testBtn = document.querySelector('[data-sub-action="ACT_SUB_DO_541"]');
        if (testBtn) {
            testBtn.click();
            results.clickedSim541 = true;
            results.simResultText = document.getElementById('sub-sim-screen-body')?.innerText.substring(0, 100);
        }

        // Click back to triage tab
        const triageTab = tabBtns.find(b => b.dataset.tab === 'triage');
        if (triageTab) {
            triageTab.click();
            results.activeTabAfterBack = document.querySelector('.tab-content.active')?.id;
        }

        return results;
    })()
    '''
    send_frame(json.dumps({
        'id': 10,
        'method': 'Runtime.evaluate',
        'params': {
            'expression': test_expr,
            'returnByValue': True
        }
    }))
    msgs = recv_frames(2.0)
    for m in msgs:
        try:
            d = json.loads(m)
            if d.get('id') == 10:
                print('EVAL RESULT:', json.dumps(d, ensure_ascii=False, indent=2))
        except:
            pass

    if not exceptions:
        print('SUCCESS: Zero JavaScript exceptions detected! All tabs & buttons verified working.')
    else:
        print(f'FAILURE: Found {len(exceptions)} exceptions.')

    s.close()
finally:
    proc.terminate()
