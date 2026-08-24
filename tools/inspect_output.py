import sys
from pathlib import Path
p = Path(sys.argv[1])
text = p.read_bytes()
print('len', len(text))
for enc in ['utf-8', 'utf-16', 'utf-16-le', 'utf-16-be', 'latin1']:
    try:
        s = text.decode(enc)
        print('ENC', enc)
        print(s[:2000])
        print('---')
    except Exception as e:
        print('FAIL', enc, repr(e))
