import sys
target = sys.argv[1] if len(sys.argv) > 1 else 'js/app.js'
with open(target, encoding='utf-8') as f:
    text = f.read()

i = 0
n = len(text)
stack = []
line = 1
col = 1
history = []

while i < n:
    c = text[i]
    if c == '\n':
        line += 1
        col = 1
        i += 1
        continue
    if c == '/' and i + 1 < n and text[i+1] == '/':
        while i < n and text[i] != '\n':
            i += 1
        continue
    if c == '/' and i + 1 < n and text[i+1] == '*':
        i += 2
        while i + 1 < n and not (text[i] == '*' and text[i+1] == '/'):
            if text[i] == '\n': line += 1
            i += 1
        i += 2
        continue
    if c in ('"', "'", '`'):
        quote = c
        i += 1
        while i < n and text[i] != quote:
            if text[i] == '\\':
                i += 2
            else:
                if text[i] == '\n': line += 1
                i += 1
        i += 1
        continue
    if c in '{[(':
        stack.append((c, line, col))
    elif c in '}])':
        if not stack:
            print(f'Extra {c} at {line}:{col}')
        else:
            top, tl, tc = stack.pop()
            exp = {'{':'}', '[':']', '(':')'}[top]
            if c != exp:
                print(f'Mismatch: {top} from {tl}:{tc} closed by {c} at {line}:{col}')
    col += 1
    i += 1

if stack:
    print('Unclosed brackets remaining:', len(stack))
    for s in stack[:10]:
        print(' ', s)
else:
    print(f'{target}: All brackets balanced successfully!')
