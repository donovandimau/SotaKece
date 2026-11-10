const assert=require('node:assert/strict');
const {validateCatalog}=require('../music-playlist.js');
const catalog=require('../music-playlist.json');
const tracks=validateCatalog(catalog);
assert.equal(tracks.length,catalog.length);
assert.equal(catalog.length,82);
assert.equal(catalog[0].id,'fiji-default-soundtrack-v1');
assert.equal(tracks[0].url,'https://xnxmumbvgtmlpenutlii.supabase.co/storage/v1/object/public/fiji-audio/fiji-default-soundtrack.mp3');
assert.equal(new Set(tracks.map(t=>t.id)).size,tracks.length);
assert(tracks.every(t=>t.url.startsWith('https://xnxmumbvgtmlpenutlii.supabase.co/storage/v1/object/public/fiji-audio/')));
for(const path of ['https://evil.example/song.mp3','//evil.example/song.mp3','../private.mp3','fiji-song-01.mp3?token=secret','fiji-song-01.mp3#x','fiji-song-01.mp3/other','fiji-song-01.svg','fiji-default-soundtrack.mp3?token=secret','fiji-default-soundtrack.mp3#x','fiji-default-soundtrack-v2.mp3','fiji-default-soundtrack.mp3/other'])assert.throws(()=>validateCatalog([{...catalog[0],path}]));
for(const value of [null,{},[],[{...catalog[0],title:''}],[catalog[0],catalog[0]],[{...catalog[0],id:'<script>'}]])assert.throws(()=>validateCatalog(value));
console.log('PASS: canonical catalogue, unique IDs, fixed public Supabase audio origin and malformed/duplicate/path injection rejection.');

require('node:test')('raw upload names become a clean title and a credit line',()=>{
  const {describe}=require('../music-playlist.js');
  assert.deepEqual(describe('DJ JORDAN_-_LAUTI AU REMIX #2024'),{title:'Lauti Au',artist:'DJ Jordan · Remix'});
  assert.deepEqual(describe('SELF INVITED - DJ MAXVILLE [ ISLAND MOOMBAH CHILL ] 2023 REMIX'),{title:'Self Invited',artist:'DJ Maxville Remix · Island Moombah Chill'});
  assert.deepEqual(describe('MOKU ENA MOSI [ 473 DJ ] REMIX 2022'),{title:'Moku Ena Mosi',artist:'473 DJ · Remix'});
  assert.deepEqual(describe('Vulindlela - Brenda Fassie'),{title:'Vulindlela',artist:'Brenda Fassie'});
  assert.deepEqual(describe('Brenda Fassie - Thola Amadlozi'),{title:'Thola Amadlozi',artist:'Brenda Fassie'});
  assert.deepEqual(describe('DJ Junior - Au Moce ft. DJ Nem & Voqa Kei Waitadralagi'),{title:'Au Moce',artist:'DJ Junior ft. DJ Nem & Voqa Kei Waitadralagi'});
  assert.deepEqual(describe('01 Laffy Taffy.mp3'),{title:'Laffy Taffy',artist:''});
  assert.deepEqual(describe('Bula Malaya'),{title:'Bula Malaya',artist:''});
  assert.equal(describe('DJ Rockwidit - Beautiful x 24K Magic x Party Animal (Remix 2016)').title,'Beautiful x 24K Magic x Party Animal');
  for(const track of require('../music-playlist.json')){const d=describe(track.title);assert(d.title&&!/[_#\[\]]/.test(d.title+d.artist),track.title);}
});
