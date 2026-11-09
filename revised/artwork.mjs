import {esc} from './core.mjs';

// Original generated photorealistic artwork. Only these project-owned paths can be selected by data.
export const ARTWORK=Object.freeze({
 hero:{file:'hero.webp',alt:'AI-generated photorealistic scene of Fijian friends sharing fruit and conversation on a veranda',shape:'wide'},
 making:{file:'making.webp',alt:'AI-generated photorealistic scene of two Fijian women making paper flowers together',shape:'wide'},
 outside:{file:'outside.webp',alt:'AI-generated photorealistic scene of Fijian friends walking beside a lagoon',shape:'wide'},
 music:{file:'music.webp',alt:'AI-generated photorealistic scene of Fijian friends enjoying an acoustic guitar on a veranda',shape:'wide'},
 food:{file:'food.webp',alt:'AI-generated photorealistic scene of a Fijian family sharing Sunday lunch',shape:'wide'},
 photos:{file:'photos.webp',alt:'AI-generated photorealistic scene of Fijian friends looking through printed photographs',shape:'wide'},
 culture:{file:'culture.webp',alt:'AI-generated photorealistic scene of a Fijian elder sharing a family photo album',shape:'wide'},
 ani:{file:'ani.webp',alt:'AI-generated photorealistic portrait of Ani, a fictional Fijian sample person',shape:'square'},
 jo:{file:'jo.webp',alt:'AI-generated photorealistic portrait of Jo, a fictional Fijian sample person',shape:'square'},
 lani:{file:'lani.webp',alt:'AI-generated photorealistic portrait of Lani, a fictional Fijian sample person',shape:'square'},
 eli:{file:'eli.webp',alt:'AI-generated photorealistic portrait of Eli, a fictional Fijian sample person',shape:'square'},
 mika:{file:'mika.webp',alt:'AI-generated photorealistic portrait of Mika, a fictional Fijian sample person',shape:'square'},
 sela:{file:'sela.webp',alt:'AI-generated photorealistic portrait of Sela, a fictional Fijian sample person',shape:'square'},
 identity:{file:'identity.webp',alt:'AI-generated photorealistic white frangipani flower with rain droplets and green leaves',shape:'square'},
 'album-lagoon':{file:'album-lagoon.webp',alt:'Sea glass: AI-generated photorealistic scene of Fijian friends sitting beside a lagoon',shape:'square'},
 'album-gold':{file:'album-gold.webp',alt:'The long way home: AI-generated photorealistic scene of Fijian friends walking home at sunset',shape:'square'},
 'album-coral':{file:'album-coral.webp',alt:'After the rain: AI-generated photorealistic scene of a Fijian woman tending hibiscus flowers',shape:'square'},
 'album-night':{file:'album-night.webp',alt:'Somewhere, together: AI-generated photorealistic scene of Fijian friends talking on a veranda at dusk',shape:'square'}
});
export const IDENTITY_ART=Object.freeze([['identity','Island bloom'],['album-lagoon','Sea glass'],['album-gold','Golden hour'],['album-coral','After the rain'],['album-night','Moonlight']]);
export const artworkSource=key=>'./assets/'+(Object.prototype.hasOwnProperty.call(ARTWORK,key)?ARTWORK[key]:ARTWORK.identity).file;
export function artworkImage(key,{className='',decorative=false,eager=false}={}){const art=Object.prototype.hasOwnProperty.call(ARTWORK,key)?ARTWORK[key]:ARTWORK.identity;return `<img class="artwork ${esc(className)}" src="${artworkSource(key)}" width="${art.shape==='wide'?1200:512}" height="${art.shape==='wide'?800:512}" alt="${decorative?'':esc(art.alt)}" loading="${eager?'eager':'lazy'}" decoding="async"${eager?' fetchpriority="high"':''}>`;}
export function identityArtwork(p,mode='demo'){if(mode!=='demo')return p?.emoji?null:'identity';if(['ani','jo','lani','eli','mika','sela'].includes(p?.id))return p.id;return IDENTITY_ART.some(([key])=>key===p?.avatarArt)?p.avatarArt:'identity';}
export const topicArtwork=key=>['making','outside','music','food','photos','culture'].includes(key)?key:'hero';
export function circleArtwork(c){return c?.id==='makers'?'making':c?.id==='sounds'||c?.type==='music'?'music':c?.id==='weekend'?'food':'hero';}
export function coverArtwork(p,mode='demo'){if(mode==='demo'&&p?.id!=='you'){return ({'Art & making':'making',Music:'music',Outdoors:'outside','Food & family':'food',Photography:'photos'}[p?.interest]||'culture');}return ({lagoon:'outside',coral:'hero',indigo:'album-night',forest:'culture'}[p?.theme]||'outside');}
export function albumArtwork(track){return ['lagoon','gold','coral','night'].includes(track?.id)?'album-'+track.id:track?.kind==='community'?'music':track?.kind==='local'?'album-night':'album-lagoon';}
