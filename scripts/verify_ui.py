import subprocess, time, json, urllib.request, socket, base64, os, sys
sys.stdout.reconfigure(encoding='utf-8')

edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
cmd = [edge_path, '--headless=new', '--remote-debugging-port=9222', '--disable-gpu', 'http://localhost:8080/index.html?v=10']
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

    # Comprehensive interactive test
    test_suite_js = """
    (() => {
        const out = { steps: [] };

        // Test 1: Navigation tabs
        const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
        out.tabCount = tabBtns.length;

        // Test 2: Switch to decision tree tab and test sandbox switches
        const treeTabBtn = document.querySelector('[data-tab="tab-decision-tree"]');
        if (treeTabBtn) treeTabBtn.click();

        // Switch to Subcontracting Sandbox
        const subBtn = document.querySelector('[data-tree="sandbox_subcontract"]');
        if (subBtn) {
            subBtn.click();
            const subBox = document.getElementById('sandbox-subcontract-container');
            out.steps.push({
                action: 'open_subcontract_sandbox',
                subBoxVisible: subBox ? (subBox.style.display !== 'none') : false
            });

            const actionBtns = Array.from(subBox.querySelectorAll('.actions-buttons-grid .sim-action-btn'));
            
            // Initial check: None should have .active or only inspected
            out.steps.push({
                action: 'initial_step2_state',
                activeButtons: actionBtns.filter(b => b.classList.contains('active')).map(b => b.innerText.substring(0, 15))
            });

            // Click Action D
            const actD = actionBtns.find(b => b.getAttribute('onclick').includes('ACT_SUB_RECEIVE_101'));
            if (actD) {
                actD.click();
                out.steps.push({
                    action: 'click_action_D',
                    actDIsActive: actD.classList.contains('active'),
                    allActiveButtons: actionBtns.filter(b => b.classList.contains('active')).map(b => b.innerText.substring(0, 15)),
                    msgText: document.querySelector('#sim-sub-screen-body .sim-sap-msg-bar')?.innerText?.trim()
                });
            }

            // Click Action F (Standard SOP)
            const actF = actionBtns.find(b => b.getAttribute('onclick').includes('ACT_SUB_FULL_CLOSED_LOOP'));
            if (actF) {
                actF.click();
                out.steps.push({
                    action: 'click_action_F',
                    actFIsActive: actF.classList.contains('active'),
                    actDIsActive: actD.classList.contains('active'),
                    allActiveButtons: actionBtns.filter(b => b.classList.contains('active')).map(b => b.innerText.substring(0, 15)),
                    msgText: document.querySelector('#sim-sub-screen-body .sim-sap-msg-bar')?.innerText?.trim()
                });
            }
        }

        // Switch to E005 sandbox
        const e005Btn = document.querySelector('[data-tree="sandbox_e005"]');
        if (e005Btn) {
            e005Btn.click();
            const e005Box = document.getElementById('sandbox-e005-container');
            const e005ActionBtns = Array.from(e005Box.querySelectorAll('.actions-buttons-grid .sim-action-btn'));

            // Click Action A
            const actA = e005ActionBtns.find(b => b.getAttribute('onclick').includes('ACTION_CO02_CHANGE'));
            if (actA) {
                actA.click();
                out.steps.push({
                    action: 'e005_click_action_A',
                    actAIsActive: actA.classList.contains('active'),
                    allActiveButtons: e005ActionBtns.filter(b => b.classList.contains('active')).map(b => b.innerText.substring(0, 15))
                });
            }

            // Click Action E
            const actE = e005ActionBtns.find(b => b.getAttribute('onclick').includes('ACTION_STANDARD_CLOSED_LOOP'));
            if (actE) {
                actE.click();
                out.steps.push({
                    action: 'e005_click_action_E',
                    actEIsActive: actE.classList.contains('active'),
                    actAIsActive: actA.classList.contains('active'),
                    allActiveButtons: e005ActionBtns.filter(b => b.classList.contains('active')).map(b => b.innerText.substring(0, 15))
                });
            }
        }

        return out;
    })()
    """

    send_frame(json.dumps({
        'id': 200,
        'method': 'Runtime.evaluate',
        'params': {
            'expression': test_suite_js,
            'returnByValue': True
        }
    }))

    res = recv_msg(target_id=200, timeout=6.0)
    print('TEST_SUITE_RESULT:\n' + json.dumps(res, ensure_ascii=False, indent=2))
    s.close()
finally:
    proc.terminate()
