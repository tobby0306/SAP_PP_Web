import subprocess, time, json, urllib.request, socket, base64, os, sys
sys.stdout.reconfigure(encoding='utf-8')

edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
cmd = [edge_path, '--headless=new', '--remote-debugging-port=9222', '--disable-gpu', 'http://localhost:8080/index.html?v=11']
proc = subprocess.Popen(cmd)
time.sleep(2.5)

try:
    tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json').read().decode('utf-8'))
    page_tab = [t for t in tabs if t.get('type') == 'page'][0]
    ws_url = page_tab['webSocketDebuggerUrl']

    part = ws_url.replace('ws://', '')
    host_port, path = part.split('/', 1)
    host, port = host_port.split(':')
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((host, int(port)))

    key = base64.b64encode(os.urandom(16)).decode('utf-8')
    handshake = (
        f'GET /{path} HTTP/1.1\r\n'
        f'Host: {host}:{port}\r\n'
        f'Upgrade: websocket\r\n'
        f'Connection: Upgrade\r\n'
        f'Sec-WebSocket-Key: {key}\r\n'
        f'Sec-WebSocket-Version: 13\r\n\r\n'
    )
    s.sendall(handshake.encode('utf-8'))
    res = s.recv(4096).decode('utf-8', errors='ignore')

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

    def recv_msg(target_id=None, timeout=4.0):
        s.settimeout(timeout)
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
                text = payload.decode('utf-8', errors='ignore')
                try:
                    d = json.loads(text)
                    if target_id is not None and d.get('id') == target_id:
                        return d
                    if 'exceptionThrown' in d.get('method', ''):
                        print('EXCEPTION THROWN:', json.dumps(d, ensure_ascii=False))
                except:
                    pass
            except socket.timeout:
                break
        return None

    send_frame(json.dumps({'id': 1, 'method': 'Runtime.enable'}))
    recv_msg(timeout=1.0)

    test_js = """
    (() => {
        const out = { steps: [] };

        // Test 1: Navigation tab exists and click to switch
        const inspectorTabBtn = document.getElementById('tab-btn-wo-inspector');
        out.tabFound = !!inspectorTabBtn;
        if (inspectorTabBtn) {
            inspectorTabBtn.click();
            const panel = document.getElementById('tab-wo-inspector');
            out.panelActive = panel ? panel.classList.contains('active') : false;
        }

        // Test 2: Check presets count
        const presetBtns = Array.from(document.querySelectorAll('.preset-chip-btn'));
        out.presetCount = presetBtns.length;

        // Test 3: Load Healthy Preset
        const btnHealthy = document.getElementById('btn-preset-PRESET_HEALTHY');
        if (btnHealthy) {
            btnHealthy.click();
            out.healthyScore = document.getElementById('inspector-score-num').innerText;
            out.healthyVerdict = document.getElementById('inspector-verdict-badge').innerText;
        }

        // Test 4: Load E005 Preset
        const btnE005 = document.getElementById('btn-preset-PRESET_E005_ERROR');
        if (btnE005) {
            btnE005.click();
            out.e005Score = document.getElementById('inspector-score-num').innerText;
            out.e005Ticket = document.querySelector('.ticket-id-tag').innerText;
        }

        // Test 5: Load Subcontract Lack 541 Preset
        const btnSub = document.getElementById('btn-preset-PRESET_SUB_541_LACK');
        if (btnSub) {
            btnSub.click();
            out.subScore = document.getElementById('inspector-score-num').innerText;
            out.subPillarStatus = document.querySelectorAll('.pillar-card.status-fail').length;
        }

        // Test 6: Load Routing AutoGR Error Preset
        const btnRt = document.getElementById('btn-preset-PRESET_ROUTING_AUTOGR_ERR');
        if (btnRt) {
            btnRt.click();
            out.rtScore = document.getElementById('inspector-score-num').innerText;
        }

        // Test 7: Load COGI Month End Preset & toggle What-If Tweaker
        const btnCogi = document.getElementById('btn-preset-PRESET_COGI_MONTH_END');
        if (btnCogi) {
            btnCogi.click();
            out.cogiInitialScore = document.getElementById('inspector-score-num').innerText;
            
            // Toggle COGI clean checkbox
            const cogiToggle = document.getElementById('tweaker-opt_cogi_clean');
            if (cogiToggle) {
                cogiToggle.click();
                out.cogiToggledScore = document.getElementById('inspector-score-num').innerText;
            }
        }

        // Test 8: Custom WO inspection
        const input = document.getElementById('wo-inspector-input');
        if (input) {
            input.value = '100088899911';
            window.runWoInspection();
            out.customWoTested = true;
        }

        return out;
    })()
    """

    send_frame(json.dumps({'id': 2, 'method': 'Runtime.evaluate', 'params': {'expression': test_js, 'returnByValue': True}}))
    msg = recv_msg(target_id=2, timeout=5.0)

    print("TEST RESULT:")
    print(json.dumps(msg, ensure_ascii=False, indent=2))

finally:
    proc.terminate()
