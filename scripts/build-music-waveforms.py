"""Bake the starting queue's compact waveform overviews from its published audio files."""
import array
import base64
import concurrent.futures
import json
import math
from pathlib import Path
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
CATALOGUE = 'https://fijihistory.com/shared-music/catalogue.json'
AUDIO = 'https://xnxmumbvgtmlpenutlii.supabase.co/storage/v1/object/public/fiji-audio/'
BINS = 1024

def measure(track):
    with urllib.request.urlopen(AUDIO + track['path'], timeout=90) as response:
        audio = response.read()
    if len(audio) != track['size']:
        raise ValueError('Unexpected audio size for ' + track['id'])
    pcm = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', 'pipe:0', '-vn', '-ac', '1',
                          '-ar', '8000', '-f', 's16le', 'pipe:1'], input=audio,
                         capture_output=True, check=True).stdout
    samples = array.array('h')
    samples.frombytes(pcm)
    if sys.byteorder != 'little':
        samples.byteswap()
    energy = []
    for i in range(BINS):
        chunk = samples[i*len(samples)//BINS:(i+1)*len(samples)//BINS]
        energy.append(sum(n*n for n in chunk)/max(1,len(chunk)))
    scale = sorted(energy)[int(.99*BINS)] or max(energy) or 1
    peaks = bytes(round(255*min(1,math.sqrt(v/scale))) for v in energy)
    return track['id'], {'bytes':len(audio), 'seconds':round(len(samples)/8000, 3),
                         'peaks':base64.b64encode(peaks).decode('ascii')}

if __name__ == '__main__':
    if len(sys.argv) > 1:
        tracks = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))['tracks'][:8]
    else:
        with urllib.request.urlopen(CATALOGUE, timeout=30) as response:
            tracks = json.load(response)['tracks'][:8]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as workers:
        result = dict(workers.map(measure, tracks))
    target = ROOT / 'assets/music-waveforms.json'
    target.write_text(json.dumps(result,separators=(',',':'))+'\n', encoding='utf-8')
    print(f'{len(result)} tracks, {target.stat().st_size:,} bytes')
