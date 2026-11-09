(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BulaSkins = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const presets = [
    {id:'lagoon',name:'Lagoon Club',category:'Island',note:'Salt air. Good company.',bg:'#e1f4f3',panel:'#ffffff',ink:'#173e49',muted:'#506b72',accent:'#086779',cover:'#86ded5',pattern:'waves',font:'rounded'},
    {id:'kula',name:'Kula Classic',category:'Classic',note:'A little loud. All you.',bg:'#fae8ed',panel:'#ffffff',ink:'#412132',muted:'#775866',accent:'#b52b50',cover:'#f3abc0',pattern:'dots',font:'rounded'},
    {id:'midnight',name:'Midnight Mixtape',category:'Dark',note:'For the after-hours crowd.',bg:'#17172c',panel:'#25253e',ink:'#f4f1ff',muted:'#c1b9dc',accent:'#c6a8ff',cover:'#48416e',pattern:'stars',font:'rounded'},
    {id:'bloom',name:'Island Bloom',category:'Island',note:'Full colour. Soft heart.',bg:'#fcecdf',panel:'#fffaf5',ink:'#4b3040',muted:'#796074',accent:'#ad376e',cover:'#f2b88c',pattern:'flowers',font:'serif'},
    {id:'palm',name:'Palm Social',category:'Island',note:'Your little green corner.',bg:'#e4eedc',panel:'#fbfff7',ink:'#274231',muted:'#5c715f',accent:'#326342',cover:'#a7c98a',pattern:'stripes',font:'rounded'},
    {id:'sunset',name:'Golden Hour',category:'Bright',note:'Stay for one more sunset.',bg:'#fff0d9',panel:'#fffdf8',ink:'#583725',muted:'#80684d',accent:'#a34321',cover:'#ffbf7a',pattern:'waves',font:'serif'},
    {id:'pixel',name:'Pixel Party',category:'Bright',note:'Main-character energy.',bg:'#eee6ff',panel:'#fffaff',ink:'#3e255a',muted:'#755b87',accent:'#7938bc',cover:'#c5a4f0',pattern:'checker',font:'mono'},
    {id:'notebook',name:'Notebook',category:'Classic',note:'Leave a little note.',bg:'#eeeee8',panel:'#fffef5',ink:'#303f55',muted:'#697283',accent:'#3558a1',cover:'#c2d2e4',pattern:'grid',font:'mono'},
    {"id":"electric","name":"Bula Electric","category":"Bright","note":"Big bula. Bigger energy.","bg":"#151025","panel":"#261c3b","ink":"#fff5fd","muted":"#d1bedf","accent":"#6cedee","cover":"#ba399f","pattern":"checker","font":"rounded"},
    {"id":"masi","name":"Masi Social","category":"Masi-inspired","note":"Island roots. Your story.","bg":"#efe1c6","panel":"#fff8eb","ink":"#3d2920","muted":"#705d4c","accent":"#6e3827","cover":"#d9b984","pattern":"masi","font":"serif"},
    {"id":"drua","name":"Drua Day","category":"Sport","note":"Bring the whole crew.","bg":"#d9f1ff","panel":"#ffffff","ink":"#102c50","muted":"#475d78","accent":"#1458a0","cover":"#66c5ef","pattern":"stripes","font":"rounded"},
    {"id":"hibiscus","name":"Hibiscus Heat","category":"Island","note":"Full bloom. Full volume.","bg":"#ffe1f0","panel":"#fff9fd","ink":"#531932","muted":"#795063","accent":"#bb2066","cover":"#ee69a5","pattern":"flowers","font":"rounded"},
    {"id":"reef","name":"Reef Rave","category":"Bright","note":"Ocean air. Electric nights.","bg":"#08232d","panel":"#103440","ink":"#e8ffff","muted":"#b7d9de","accent":"#64f2d7","cover":"#0d776d","pattern":"waves","font":"mono"},
    {"id":"kava","name":"Yaqona Nights","category":"Dark","note":"Good stories. Late nights.","bg":"#231b17","panel":"#352b25","ink":"#fff0d5","muted":"#d4c1ac","accent":"#edc086","cover":"#624b35","pattern":"masi","font":"serif"},
    {"id":"mango","name":"Mango Season","category":"Island","note":"A little sunshine goes a long way.","bg":"#fff0cf","panel":"#fffaf0","ink":"#5c3619","muted":"#78604d","accent":"#a6450e","cover":"#ffc05c","pattern":"dots","font":"rounded"},
    {"id":"candy","name":"Candy Crush","category":"Soft","note":"Sweet colours. Big personality.","bg":"#f6e5ff","panel":"#fffbff","ink":"#4a255d","muted":"#725583","accent":"#8a399c","cover":"#e4a3e8","pattern":"checker","font":"rounded"},
    {"id":"cloud","name":"Cloud Nine","category":"Soft","note":"Soft days. Good company.","bg":"#e8eefb","panel":"#fcfdff","ink":"#273750","muted":"#536782","accent":"#3d5ea7","cover":"#bacdf8","pattern":"stars","font":"serif"},
    {"id":"ink","name":"Ink & Paper","category":"Classic","note":"Your words take the stage.","bg":"#e7e4dd","panel":"#fffdf5","ink":"#232b31","muted":"#59636c","accent":"#343e46","cover":"#c9c4b7","pattern":"grid","font":"mono"},
    {"id":"disco","name":"Disco Cousins","category":"Bright","note":"One more song for the cousins.","bg":"#27113d","panel":"#3a1c4c","ink":"#fff2fc","muted":"#dab8e7","accent":"#ffb2e9","cover":"#9e327e","pattern":"dots","font":"rounded"},
    {"id":"acid","name":"Lime Limelight","category":"Bright","note":"Main stage. Main character.","bg":"#162110","panel":"#26351c","ink":"#f2ffe5","muted":"#c4d9b2","accent":"#c7ff48","cover":"#5e732a","pattern":"checker","font":"mono"},
    {"id":"varsity","name":"Schoolyard Stories","category":"Sport","note":"Same mates. New stories.","bg":"#eee5e0","panel":"#fffaf6","ink":"#3d2328","muted":"#70555c","accent":"#8f2d40","cover":"#ca7f89","pattern":"stripes","font":"serif"},
    {"id":"comic","name":"Comic Crew","category":"Bright","note":"Big laughs. Bold lines.","bg":"#fff3bc","panel":"#fffdf1","ink":"#2b263f","muted":"#605772","accent":"#6a37a5","cover":"#f9d647","pattern":"dots","font":"mono"},
    {"id":"afterglow","name":"Island Afterglow","category":"Dark","note":"Stay for one more story.","bg":"#221326","panel":"#39223b","ink":"#fff0eb","muted":"#e4bfc7","accent":"#ffbe94","cover":"#a05c76","pattern":"waves","font":"serif"},
    {"id":"mint","name":"Mint Condition","category":"Soft","note":"Fresh space. Fresh start.","bg":"#dcefe8","panel":"#f8fffb","ink":"#224638","muted":"#577468","accent":"#25634a","cover":"#a4d2bb","pattern":"flowers","font":"rounded"}
  ];
  presets.push(...[
  {
    "id": "school-natabua-high-school",
    "catalogueId": "school-natabua-high-school",
    "name": "Natabua",
    "category": "Schools",
    "note": "Cool days. Warm memories.",
    "bg": "#e0f1fa",
    "panel": "#f9feff",
    "ink": "#24415a",
    "muted": "#526c81",
    "accent": "#2b617f",
    "cover": "#a9d6e8",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "glass",
    "artwork": "/assets/skins/core/school-natabua-high-school.svg",
    "border": "/assets/skins/core/school-natabua-high-school-border.svg",
    "artDescription": "Natabua: ice illustration",
    "designNote": "Original fan design; decorative palette, no official crest.",
    "songs": [
      {
        "title": "In Scientia Fortitudo",
        "performer": "Natabua students",
        "url": "https://www.facebook.com/thefijitimes/videos/local-news-natabua-high-school-students-singing-their-school-song-in-scientia-fo/957525369265531/",
        "relationship": "documented school association"
      },
      {
        "title": "Cool as Ice",
        "performer": "Makare featuring Natabua High School",
        "url": "https://open.spotify.com/track/759Q6k8aRhkxSZUkiAQPpZ",
        "relationship": "published school collaboration"
      }
    ]
  },
  {
    "id": "school-marist-brothers-high-school",
    "catalogueId": "school-marist-brothers-high-school",
    "name": "Marist",
    "category": "Schools",
    "note": "Red Fire. Same mates.",
    "bg": "#2b111c",
    "panel": "#431d2b",
    "ink": "#fff2e6",
    "muted": "#dcc0bb",
    "accent": "#ffbc8c",
    "cover": "#a33d4e",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/school-marist-brothers-high-school.svg",
    "border": "/assets/skins/core/school-marist-brothers-high-school-border.svg",
    "artDescription": "Marist: fire illustration",
    "designNote": "Original fan design; decorative palette, no official crest.",
    "songs": [
      {
        "title": "Redfire Guide My Soul",
        "performer": "Marist Brothers High School performance",
        "url": "https://www.youtube.com/watch?v=i3xElGelmGk",
        "relationship": "published school-themed recording"
      }
    ]
  },
  {
    "id": "school-suva-grammar-school",
    "catalogueId": "school-suva-grammar-school",
    "name": "Suva Grammar",
    "category": "Schools",
    "note": "Grammar memories.",
    "bg": "#f5e7cb",
    "panel": "#fff9ed",
    "ink": "#4f351b",
    "muted": "#715d43",
    "accent": "#875016",
    "cover": "#e8b45a",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/school-suva-grammar-school.svg",
    "border": "/assets/skins/core/school-suva-grammar-school-border.svg",
    "artDescription": "Suva Grammar: school illustration",
    "designNote": "Original fan design; decorative palette, no official crest.",
    "songs": [
      {
        "title": "Grammar Tu Ga",
        "performer": "Natalie Raikadroka, Patco Muzik, Drixstar, Mr. Grin",
        "url": "https://open.spotify.com/track/4CodGFhOr6srF38IBtdN4d",
        "relationship": "documented alumni anthem"
      }
    ]
  },
  {
    "id": "school-queen-victoria-school",
    "catalogueId": "school-queen-victoria-school",
    "name": "QVS",
    "category": "Schools",
    "note": "School days. Lifelong stories.",
    "bg": "#dceaf8",
    "panel": "#f8fcff",
    "ink": "#173b61",
    "muted": "#50647d",
    "accent": "#17548d",
    "cover": "#7eb2da",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/school-queen-victoria-school.svg",
    "border": "/assets/skins/core/school-queen-victoria-school-border.svg",
    "artDescription": "QVS: school illustration",
    "designNote": "Original fan design; decorative palette, no official crest.",
    "songs": [
      {
        "title": "Na Noqu Koronivuli",
        "performer": "QVS students / supporters",
        "url": "https://www.facebook.com/lescoolx/videos/na-noqu-koronivuli-au-na-bole-mate-kina-qvs-school-song-/1190279593271289/",
        "relationship": "school-song performance reference"
      }
    ]
  },
  {
    "id": "school-ratu-kadavulevu-school",
    "catalogueId": "school-ratu-kadavulevu-school",
    "name": "RKS",
    "category": "Schools",
    "note": "Lodoni. Friends for life.",
    "bg": "#101f42",
    "panel": "#1d3059",
    "ink": "#f6f1dc",
    "muted": "#c6cce2",
    "accent": "#f7cd66",
    "cover": "#283f6c",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/school-ratu-kadavulevu-school.svg",
    "border": "/assets/skins/core/school-ratu-kadavulevu-school-border.svg",
    "artDescription": "RKS: school illustration",
    "designNote": "Original fan design; decorative palette, no official crest.",
    "songs": [
      {
        "title": "Noqu Koronivuli Uasivi",
        "performer": "RKS students / school choir",
        "url": "https://www.youtube.com/watch?v=ouXJM0Y-H7A",
        "relationship": "documented school association"
      },
      {
        "title": "Mai Lodoni Mai",
        "performer": "Published recording produced by Red River Badamu",
        "url": "https://www.youtube.com/watch?v=0OLC-2ccSgQ",
        "relationship": "published school-themed recording"
      }
    ]
  },
  {
    "id": "school-adi-cakobau-school",
    "catalogueId": "school-adi-cakobau-school",
    "name": "ACS",
    "category": "Schools",
    "note": "Sawani stories.",
    "bg": "#ece2fa",
    "panel": "#fffaff",
    "ink": "#402758",
    "muted": "#695878",
    "accent": "#74409b",
    "cover": "#d6b1e8",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "raised",
    "artwork": "/assets/skins/core/school-adi-cakobau-school.svg",
    "border": "/assets/skins/core/school-adi-cakobau-school-border.svg",
    "artDescription": "ACS: lily illustration",
    "designNote": "Original fan design; decorative palette, no official crest.",
    "songs": [
      {
        "title": "Seni Waterlily",
        "performer": "ACS Year 13 students",
        "url": "https://www.facebook.com/fijisun/videos/acs-year-13s-visit-parliamentmore-than-80-year-13-students-from-adi-cakobau-scho/2348721745561716/",
        "relationship": "documented school association"
      }
    ]
  },
  {
    "id": "school-fnu",
    "catalogueId": "school-fnu",
    "name": "FNU",
    "category": "Schools",
    "note": "Make your next chapter.",
    "bg": "#dce9dc",
    "panel": "#f7fcf4",
    "ink": "#203f30",
    "muted": "#526e5a",
    "accent": "#246347",
    "cover": "#8dbd8b",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/school-fnu.svg",
    "border": "/assets/skins/core/school-fnu-border.svg",
    "artDescription": "FNU: book illustration",
    "designNote": "Original fan design; decorative palette, no official crest.",
    "songs": []
  },
  {
    "id": "school-usp",
    "catalogueId": "school-usp",
    "name": "USP",
    "category": "Schools",
    "note": "Our Pacific. Our future.",
    "bg": "#0a3040",
    "panel": "#144858",
    "ink": "#effffe",
    "muted": "#bfd8db",
    "accent": "#77efcd",
    "cover": "#137c8c",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "glass",
    "artwork": "/assets/skins/core/school-usp.svg",
    "border": "/assets/skins/core/school-usp-border.svg",
    "artDescription": "USP: canoe illustration",
    "designNote": "Original fan design; decorative palette, no official crest.",
    "songs": [
      {
        "title": "Garland of Achievement",
        "performer": "USP Choir",
        "url": "https://www.youtube.com/watch?v=RYheeIzwggY",
        "relationship": "official institutional association"
      }
    ]
  },
  {
    "id": "core-masi",
    "catalogueId": "masi",
    "name": "Masi / masi kesa",
    "category": "Culture",
    "note": "Island roots. Your story.",
    "bg": "#ecdfc5",
    "panel": "#fff8e9",
    "ink": "#412a1b",
    "muted": "#755c46",
    "accent": "#7a412c",
    "cover": "#d1ad78",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/masi.svg",
    "border": "/assets/skins/core/masi-border.svg",
    "artDescription": "Masi / masi kesa: cloth illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": []
  },
  {
    "id": "masi-white",
    "catalogueId": "masi-white",
    "name": "White Masi",
    "category": "Culture",
    "note": "Quiet cloth. Bright stories.",
    "bg": "#f0ede4",
    "panel": "#fffdf8",
    "ink": "#3e4142",
    "muted": "#666c6d",
    "accent": "#756035",
    "cover": "#ded5bd",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/masi-white.svg",
    "border": "/assets/skins/core/masi-white-border.svg",
    "artDescription": "White Masi: cloth illustration",
    "designNote": "Original cloth-inspired artwork; not a documented regional pattern.",
    "songs": []
  },
  {
    "id": "masi-smoked",
    "catalogueId": "masi-smoked",
    "name": "Smoked Masi",
    "category": "Culture",
    "note": "Warm fibres. Deep memories.",
    "bg": "#382820",
    "panel": "#4c382d",
    "ink": "#fff3dc",
    "muted": "#d9c5ae",
    "accent": "#efc187",
    "cover": "#826447",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/masi-smoked.svg",
    "border": "/assets/skins/core/masi-smoked-border.svg",
    "artDescription": "Smoked Masi: cloth illustration",
    "designNote": "Original cloth-inspired artwork; not a documented regional pattern.",
    "songs": []
  },
  {
    "id": "masi-lau",
    "catalogueId": "masi-lau",
    "name": "Lau • Cloth Study",
    "category": "Culture",
    "note": "A cloth-inspired island space.",
    "bg": "#e9d9bd",
    "panel": "#fff7e7",
    "ink": "#4c3525",
    "muted": "#765e48",
    "accent": "#795336",
    "cover": "#c8aa75",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/masi-lau.svg",
    "border": "/assets/skins/core/masi-lau-border.svg",
    "artDescription": "Lau • Cloth Study: cloth illustration",
    "designNote": "Original cloth-inspired artwork; not a documented regional pattern.",
    "songs": [
      {
        "title": "Lomaloma",
        "performer": "Josateki Koroituicakau",
        "url": "https://www.youtube.com/watch?v=EBVu0YstnPQ",
        "relationship": "documented place and belonging story"
      }
    ]
  },
  {
    "id": "masi-cakaudrove",
    "catalogueId": "masi-cakaudrove",
    "name": "Cakaudrove • Cloth Study",
    "category": "Culture",
    "note": "A painted-cloth inspiration.",
    "bg": "#2b111c",
    "panel": "#431d2b",
    "ink": "#fff2e6",
    "muted": "#dcc0bb",
    "accent": "#ffbc8c",
    "cover": "#a33d4e",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/masi-cakaudrove.svg",
    "border": "/assets/skins/core/masi-cakaudrove-border.svg",
    "artDescription": "Cakaudrove • Cloth Study: cloth illustration",
    "designNote": "Original cloth-inspired artwork; not a documented regional pattern.",
    "songs": [
      {
        "title": "Cakaudrove Bua Macuata",
        "performer": "Nem & Talei featuring Sofaia",
        "url": "https://www.facebook.com/100066729187071/videos/cakaudrove-bua-macuatanem-talei-ft-sofaia/401283551221438/",
        "relationship": "direct named-place association"
      }
    ]
  },
  {
    "id": "grog",
    "catalogueId": "grog",
    "name": "Grog Circle",
    "category": "Culture",
    "note": "Pull up a mat. Stay for a story.",
    "bg": "#382820",
    "panel": "#4c382d",
    "ink": "#fff3dc",
    "muted": "#d9c5ae",
    "accent": "#efc187",
    "cover": "#826447",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/grog.svg",
    "border": "/assets/skins/core/grog-border.svg",
    "artDescription": "Grog Circle: tanoa illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Kauwai",
        "performer": "Vegas 6 with Naomi from Marama",
        "url": "https://www.abc.net.au/pacific/programs/sista-sounds/sista-sounds/106894994",
        "relationship": "documented genre fit; suggested skin pairing"
      },
      {
        "title": "Lomaloma",
        "performer": "Josateki Koroituicakau",
        "url": "https://www.youtube.com/watch?v=EBVu0YstnPQ",
        "relationship": "documented place and belonging story"
      },
      {
        "title": "Noqu Vanua",
        "performer": "Kuki",
        "url": "https://www.youtube.com/watch?v=F4HnJgZ_YeQ",
        "relationship": "thematic suggestion"
      }
    ]
  },
  {
    "id": "sigidrigi",
    "catalogueId": "sigidrigi",
    "name": "Sigidrigi Veranda",
    "category": "Culture",
    "note": "One more harmony.",
    "bg": "#141b30",
    "panel": "#222a44",
    "ink": "#f4eeff",
    "muted": "#c0c8df",
    "accent": "#c4b7fc",
    "cover": "#475077",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "glass",
    "artwork": "/assets/skins/core/sigidrigi.svg",
    "border": "/assets/skins/core/sigidrigi-border.svg",
    "artDescription": "Sigidrigi Veranda: guitar illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Kauwai",
        "performer": "Vegas 6 with Naomi from Marama",
        "url": "https://www.abc.net.au/pacific/programs/sista-sounds/sista-sounds/106894994",
        "relationship": "documented genre fit; suggested skin pairing"
      },
      {
        "title": "Lomaloma",
        "performer": "Josateki Koroituicakau",
        "url": "https://www.youtube.com/watch?v=EBVu0YstnPQ",
        "relationship": "documented place and belonging story"
      }
    ]
  },
  {
    "id": "woven-mats",
    "catalogueId": "woven-mats",
    "name": "Ibe / Woven Mats",
    "category": "Culture",
    "note": "Made of stories. Woven together.",
    "bg": "#e9d9bd",
    "panel": "#fff7e7",
    "ink": "#4c3525",
    "muted": "#765e48",
    "accent": "#795336",
    "cover": "#c8aa75",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/woven-mats.svg",
    "border": "/assets/skins/core/woven-mats-border.svg",
    "artDescription": "Ibe / Woven Mats: weave illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": []
  },
  {
    "id": "village",
    "catalogueId": "village",
    "name": "My Village",
    "category": "Culture",
    "note": "The place that knows my name.",
    "bg": "#dce9dc",
    "panel": "#f7fcf4",
    "ink": "#203f30",
    "muted": "#526e5a",
    "accent": "#246347",
    "cover": "#8dbd8b",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/village.svg",
    "border": "/assets/skins/core/village-border.svg",
    "artDescription": "My Village: village illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Noqu Vanua",
        "performer": "Kuki",
        "url": "https://www.youtube.com/watch?v=F4HnJgZ_YeQ",
        "relationship": "thematic suggestion"
      },
      {
        "title": "Lomaloma",
        "performer": "Josateki Koroituicakau",
        "url": "https://www.youtube.com/watch?v=EBVu0YstnPQ",
        "relationship": "documented place and belonging story"
      }
    ]
  },
  {
    "id": "navala",
    "catalogueId": "navala",
    "name": "Navala / Bure Village",
    "category": "Culture",
    "note": "Home beneath the hills.",
    "bg": "#382820",
    "panel": "#4c382d",
    "ink": "#fff3dc",
    "muted": "#d9c5ae",
    "accent": "#efc187",
    "cover": "#826447",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/navala.svg",
    "border": "/assets/skins/core/navala-border.svg",
    "artDescription": "Navala / Bure Village: bure illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": []
  },
  {
    "id": "salusalu",
    "catalogueId": "salusalu",
    "name": "Salusalu",
    "category": "Culture",
    "note": "Wear the good memories.",
    "bg": "#f8dedc",
    "panel": "#fff8f5",
    "ink": "#562a36",
    "muted": "#7d5861",
    "accent": "#a83859",
    "cover": "#ed929f",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "raised",
    "artwork": "/assets/skins/core/salusalu.svg",
    "border": "/assets/skins/core/salusalu-border.svg",
    "artDescription": "Salusalu: garland illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Fijian happy birthday song — Sofitel Nadi performance",
        "performer": "Sofitel Nadi singers (visitor recording)",
        "url": "https://www.youtube.com/watch?v=kVaqjEvtQro",
        "relationship": "documented birthday performance"
      },
      {
        "title": "Na Watiqu",
        "performer": "Paradise Rootz featuring Cakau Ni Mana & Nasio Domoni",
        "url": "https://www.youtube.com/watch?v=Nzo7f-veMO0",
        "relationship": "thematic suggestion"
      }
    ]
  },
  {
    "id": "core-drua",
    "catalogueId": "drua",
    "name": "Drua / Canoe Heritage",
    "category": "Culture",
    "note": "Carry our stories across the sea.",
    "bg": "#0a3040",
    "panel": "#144858",
    "ink": "#effffe",
    "muted": "#bfd8db",
    "accent": "#77efcd",
    "cover": "#137c8c",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/drua.svg",
    "border": "/assets/skins/core/drua-border.svg",
    "artDescription": "Drua / Canoe Heritage: canoe illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Lomaloma",
        "performer": "Josateki Koroituicakau",
        "url": "https://www.youtube.com/watch?v=EBVu0YstnPQ",
        "relationship": "documented place and belonging story"
      }
    ]
  },
  {
    "id": "province-ba",
    "catalogueId": "province-ba",
    "name": "Ba",
    "category": "Provinces",
    "note": "My vanua. My people.",
    "bg": "#f5e7cb",
    "panel": "#fff9ed",
    "ink": "#4f351b",
    "muted": "#715d43",
    "accent": "#875016",
    "cover": "#e8b45a",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/province-ba.svg",
    "border": "/assets/skins/core/province-ba-border.svg",
    "artDescription": "Ba: river illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": []
  },
  {
    "id": "province-bua",
    "catalogueId": "province-bua",
    "name": "Bua",
    "category": "Provinces",
    "note": "Rooted in Bua.",
    "bg": "#dce9dc",
    "panel": "#f7fcf4",
    "ink": "#203f30",
    "muted": "#526e5a",
    "accent": "#246347",
    "cover": "#8dbd8b",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/province-bua.svg",
    "border": "/assets/skins/core/province-bua-border.svg",
    "artDescription": "Bua: forest illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Cakaudrove Bua Macuata",
        "performer": "Nem & Talei featuring Sofaia",
        "url": "https://www.facebook.com/100066729187071/videos/cakaudrove-bua-macuatanem-talei-ft-sofaia/401283551221438/",
        "relationship": "direct named-place association"
      }
    ]
  },
  {
    "id": "province-cakaudrove",
    "catalogueId": "province-cakaudrove",
    "name": "Cakaudrove",
    "category": "Provinces",
    "note": "A northern story.",
    "bg": "#101f42",
    "panel": "#1d3059",
    "ink": "#f6f1dc",
    "muted": "#c6cce2",
    "accent": "#f7cd66",
    "cover": "#283f6c",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/province-cakaudrove.svg",
    "border": "/assets/skins/core/province-cakaudrove-border.svg",
    "artDescription": "Cakaudrove: mountain illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Cakaudrove Bua Macuata",
        "performer": "Nem & Talei featuring Sofaia",
        "url": "https://www.facebook.com/100066729187071/videos/cakaudrove-bua-macuatanem-talei-ft-sofaia/401283551221438/",
        "relationship": "direct named-place association"
      }
    ]
  },
  {
    "id": "province-kadavu",
    "catalogueId": "province-kadavu",
    "name": "Kadavu",
    "category": "Provinces",
    "note": "Island roots. Ocean stories.",
    "bg": "#0a3040",
    "panel": "#144858",
    "ink": "#effffe",
    "muted": "#bfd8db",
    "accent": "#77efcd",
    "cover": "#137c8c",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "glass",
    "artwork": "/assets/skins/core/province-kadavu.svg",
    "border": "/assets/skins/core/province-kadavu-border.svg",
    "artDescription": "Kadavu: reef illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Sili Wai Na Me",
        "performer": "Polynesian Cultural Center performers",
        "url": "https://www.youtube.com/shorts/G4UB9C_jzss",
        "relationship": "documented provincial motif"
      }
    ]
  },
  {
    "id": "province-lau",
    "catalogueId": "province-lau",
    "name": "Lau",
    "category": "Provinces",
    "note": "Islands close to my heart.",
    "bg": "#e9d9bd",
    "panel": "#fff7e7",
    "ink": "#4c3525",
    "muted": "#765e48",
    "accent": "#795336",
    "cover": "#c8aa75",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/province-lau.svg",
    "border": "/assets/skins/core/province-lau-border.svg",
    "artDescription": "Lau: islands illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Lomaloma",
        "performer": "Josateki Koroituicakau",
        "url": "https://www.youtube.com/watch?v=EBVu0YstnPQ",
        "relationship": "documented place and belonging story"
      }
    ]
  },
  {
    "id": "province-lomaiviti",
    "catalogueId": "province-lomaiviti",
    "name": "Lomaiviti",
    "category": "Provinces",
    "note": "Home across the water.",
    "bg": "#dceaf8",
    "panel": "#f8fcff",
    "ink": "#173b61",
    "muted": "#50647d",
    "accent": "#17548d",
    "cover": "#7eb2da",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "glass",
    "artwork": "/assets/skins/core/province-lomaiviti.svg",
    "border": "/assets/skins/core/province-lomaiviti-border.svg",
    "artDescription": "Lomaiviti: harbour illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": []
  },
  {
    "id": "province-macuata",
    "catalogueId": "province-macuata",
    "name": "Macuata",
    "category": "Provinces",
    "note": "Where land and sea meet.",
    "bg": "#dce9dc",
    "panel": "#f7fcf4",
    "ink": "#203f30",
    "muted": "#526e5a",
    "accent": "#246347",
    "cover": "#8dbd8b",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/province-macuata.svg",
    "border": "/assets/skins/core/province-macuata-border.svg",
    "artDescription": "Macuata: mangrove illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Cakaudrove Bua Macuata",
        "performer": "Nem & Talei featuring Sofaia",
        "url": "https://www.facebook.com/100066729187071/videos/cakaudrove-bua-macuatanem-talei-ft-sofaia/401283551221438/",
        "relationship": "direct named-place association"
      }
    ]
  },
  {
    "id": "province-nadroga-navosa",
    "catalogueId": "province-nadroga-navosa",
    "name": "Nadroga-Navosa",
    "category": "Provinces",
    "note": "Stallion spirit. Home pride.",
    "bg": "#f5e7cb",
    "panel": "#fff9ed",
    "ink": "#4f351b",
    "muted": "#715d43",
    "accent": "#875016",
    "cover": "#e8b45a",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/province-nadroga-navosa.svg",
    "border": "/assets/skins/core/province-nadroga-navosa-border.svg",
    "artDescription": "Nadroga-Navosa: horse illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "O Nadroga Okwe E Kodaki O America",
        "performer": "VLY featuring Ruci Tuiwai",
        "url": "https://www.youtube.com/watch?v=-zlSweeyPoY",
        "relationship": "direct named-place association"
      },
      {
        "title": "Nadroga Okwe",
        "performer": "Fo Sho",
        "url": "https://www.youtube.com/watch?v=p5sH9jCcrQ4",
        "relationship": "direct named-place association"
      },
      {
        "title": "Ki Nadroga",
        "performer": "Taus Vocal",
        "url": "https://www.youtube.com/watch?v=Idxw6grGj54",
        "relationship": "documented place and romance story"
      }
    ]
  },
  {
    "id": "province-naitasiri",
    "catalogueId": "province-naitasiri",
    "name": "Naitasiri",
    "category": "Provinces",
    "note": "Stories from the highlands.",
    "bg": "#dce9dc",
    "panel": "#f7fcf4",
    "ink": "#203f30",
    "muted": "#526e5a",
    "accent": "#246347",
    "cover": "#8dbd8b",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/province-naitasiri.svg",
    "border": "/assets/skins/core/province-naitasiri-border.svg",
    "artDescription": "Naitasiri: mountain illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": []
  },
  {
    "id": "province-namosi",
    "catalogueId": "province-namosi",
    "name": "Namosi",
    "category": "Provinces",
    "note": "A valley full of memories.",
    "bg": "#382820",
    "panel": "#4c382d",
    "ink": "#fff3dc",
    "muted": "#d9c5ae",
    "accent": "#efc187",
    "cover": "#826447",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/province-namosi.svg",
    "border": "/assets/skins/core/province-namosi-border.svg",
    "artDescription": "Namosi: valley illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": []
  },
  {
    "id": "province-ra",
    "catalogueId": "province-ra",
    "name": "Ra",
    "category": "Provinces",
    "note": "Rise with Ra.",
    "bg": "#2b111c",
    "panel": "#431d2b",
    "ink": "#fff2e6",
    "muted": "#dcc0bb",
    "accent": "#ffbc8c",
    "cover": "#a33d4e",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/province-ra.svg",
    "border": "/assets/skins/core/province-ra-border.svg",
    "artDescription": "Ra: rooster illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Ara Na Yadra (Ko ‘Ra’ Me Sautu Ka Qaqa)",
        "performer": "Voqa Kei Valenisau",
        "url": "https://www.youtube.com/watch?v=yJZ8QC1jE8U",
        "relationship": "direct named-place association"
      }
    ]
  },
  {
    "id": "province-rewa",
    "catalogueId": "province-rewa",
    "name": "Rewa",
    "category": "Provinces",
    "note": "The river brings us together.",
    "bg": "#dceaf8",
    "panel": "#f8fcff",
    "ink": "#173b61",
    "muted": "#50647d",
    "accent": "#17548d",
    "cover": "#7eb2da",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "glass",
    "artwork": "/assets/skins/core/province-rewa.svg",
    "border": "/assets/skins/core/province-rewa-border.svg",
    "artDescription": "Rewa: river illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Rosi Ni Rewa",
        "performer": "Senibua Koula Sigidrigi",
        "url": "https://music.apple.com/us/artist/senibua-koula-sigidrigi/1752317228",
        "relationship": "named-place recording metadata"
      }
    ]
  },
  {
    "id": "province-serua",
    "catalogueId": "province-serua",
    "name": "Serua",
    "category": "Provinces",
    "note": "Coastline stories.",
    "bg": "#f8dedc",
    "panel": "#fff8f5",
    "ink": "#562a36",
    "muted": "#7d5861",
    "accent": "#a83859",
    "cover": "#ed929f",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "raised",
    "artwork": "/assets/skins/core/province-serua.svg",
    "border": "/assets/skins/core/province-serua-border.svg",
    "artDescription": "Serua: coast illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": []
  },
  {
    "id": "province-tailevu",
    "catalogueId": "province-tailevu",
    "name": "Tailevu",
    "category": "Provinces",
    "note": "Our place. Our people.",
    "bg": "#dce9dc",
    "panel": "#f7fcf4",
    "ink": "#203f30",
    "muted": "#526e5a",
    "accent": "#246347",
    "cover": "#8dbd8b",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/province-tailevu.svg",
    "border": "/assets/skins/core/province-tailevu-border.svg",
    "artDescription": "Tailevu: village illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": []
  },
  {
    "id": "island",
    "catalogueId": "island",
    "name": "My Island",
    "category": "Places",
    "note": "Home is an island feeling.",
    "bg": "#0a3040",
    "panel": "#144858",
    "ink": "#effffe",
    "muted": "#bfd8db",
    "accent": "#77efcd",
    "cover": "#137c8c",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "glass",
    "artwork": "/assets/skins/core/island.svg",
    "border": "/assets/skins/core/island-border.svg",
    "artDescription": "My Island: island illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Noqu Vanua",
        "performer": "Kuki",
        "url": "https://www.youtube.com/watch?v=F4HnJgZ_YeQ",
        "relationship": "thematic suggestion"
      },
      {
        "title": "Lomaloma",
        "performer": "Josateki Koroituicakau",
        "url": "https://www.youtube.com/watch?v=EBVu0YstnPQ",
        "relationship": "documented place and belonging story"
      }
    ]
  },
  {
    "id": "vanua-levu",
    "catalogueId": "vanua-levu",
    "name": "Vanua Levu",
    "category": "Places",
    "note": "Northern roots.",
    "bg": "#dce9dc",
    "panel": "#f7fcf4",
    "ink": "#203f30",
    "muted": "#526e5a",
    "accent": "#246347",
    "cover": "#8dbd8b",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/vanua-levu.svg",
    "border": "/assets/skins/core/vanua-levu-border.svg",
    "artDescription": "Vanua Levu: forest illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Cakaudrove Bua Macuata",
        "performer": "Nem & Talei featuring Sofaia",
        "url": "https://www.facebook.com/100066729187071/videos/cakaudrove-bua-macuatanem-talei-ft-sofaia/401283551221438/",
        "relationship": "direct named-place association"
      }
    ]
  },
  {
    "id": "taveuni",
    "catalogueId": "taveuni",
    "name": "Taveuni / Tagimoucia",
    "category": "Places",
    "note": "A garden of memories.",
    "bg": "#2b111c",
    "panel": "#431d2b",
    "ink": "#fff2e6",
    "muted": "#dcc0bb",
    "accent": "#ffbc8c",
    "cover": "#a33d4e",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "raised",
    "artwork": "/assets/skins/core/taveuni.svg",
    "border": "/assets/skins/core/taveuni-border.svg",
    "artDescription": "Taveuni / Tagimoucia: flower illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Tagimoucia",
        "performer": "K.K.U (Kula Kei Uluivuya)",
        "url": "https://open.spotify.com/track/6W6J3EacEZ2GrS3ENrKkI3",
        "relationship": "documented named-island association"
      }
    ]
  },
  {
    "id": "rotuma",
    "catalogueId": "rotuma",
    "name": "Rotuma",
    "category": "Places",
    "note": "My island. My own story.",
    "bg": "#f8dedc",
    "panel": "#fff8f5",
    "ink": "#562a36",
    "muted": "#7d5861",
    "accent": "#a83859",
    "cover": "#ed929f",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "raised",
    "artwork": "/assets/skins/core/rotuma.svg",
    "border": "/assets/skins/core/rotuma-border.svg",
    "artDescription": "Rotuma: coast illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Hanua Helava",
        "performer": "Rako Pasefika",
        "url": "https://www.youtube.com/watch?v=GHUaMCU06sM",
        "relationship": "Rotuman repertoire association"
      }
    ]
  },
  {
    "id": "yasawa",
    "catalogueId": "yasawa",
    "name": "Yasawa",
    "category": "Places",
    "note": "A little closer to home.",
    "bg": "#0a3040",
    "panel": "#144858",
    "ink": "#effffe",
    "muted": "#bfd8db",
    "accent": "#77efcd",
    "cover": "#137c8c",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "glass",
    "artwork": "/assets/skins/core/yasawa.svg",
    "border": "/assets/skins/core/yasawa-border.svg",
    "artDescription": "Yasawa: islands illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": []
  },
  {
    "id": "lomaloma",
    "catalogueId": "lomaloma",
    "name": "Lomaloma",
    "category": "Places",
    "note": "A harbour in my heart.",
    "bg": "#dceaf8",
    "panel": "#f8fcff",
    "ink": "#173b61",
    "muted": "#50647d",
    "accent": "#17548d",
    "cover": "#7eb2da",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "glass",
    "artwork": "/assets/skins/core/lomaloma.svg",
    "border": "/assets/skins/core/lomaloma-border.svg",
    "artDescription": "Lomaloma: harbour illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Lomaloma",
        "performer": "Josateki Koroituicakau",
        "url": "https://www.youtube.com/watch?v=EBVu0YstnPQ",
        "relationship": "documented place and belonging story"
      }
    ]
  },
  {
    "id": "nadi",
    "catalogueId": "nadi",
    "name": "Nadi Homecoming",
    "category": "Places",
    "note": "Welcome home.",
    "bg": "#e0f1fa",
    "panel": "#f9feff",
    "ink": "#24415a",
    "muted": "#526c81",
    "accent": "#2b617f",
    "cover": "#a9d6e8",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "glass",
    "artwork": "/assets/skins/core/nadi.svg",
    "border": "/assets/skins/core/nadi-border.svg",
    "artDescription": "Nadi Homecoming: flight illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Nadi International Airport",
        "performer": "Makare",
        "url": "https://music.apple.com/us/song/nadi-international-airport/1656187589",
        "relationship": "direct named-place recording"
      },
      {
        "title": "Coming Home",
        "performer": "Knox (Inoke Kalounisiga)",
        "url": "https://music.apple.com/us/album/fading-ep/946880959",
        "relationship": "thematic suggestion"
      }
    ]
  },
  {
    "id": "diaspora",
    "catalogueId": "diaspora",
    "name": "Coming Home",
    "category": "Places",
    "note": "Miles apart. Close at heart.",
    "bg": "#141b30",
    "panel": "#222a44",
    "ink": "#f4eeff",
    "muted": "#c0c8df",
    "accent": "#c4b7fc",
    "cover": "#475077",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "glass",
    "artwork": "/assets/skins/core/diaspora.svg",
    "border": "/assets/skins/core/diaspora-border.svg",
    "artDescription": "Coming Home: journey illustration",
    "designNote": "Original illustrative landscape or motif; not a place photograph.",
    "songs": [
      {
        "title": "Coming Home",
        "performer": "Knox (Inoke Kalounisiga)",
        "url": "https://music.apple.com/us/album/fading-ep/946880959",
        "relationship": "thematic suggestion"
      },
      {
        "title": "Noqu Vanua",
        "performer": "Kuki",
        "url": "https://www.youtube.com/watch?v=F4HnJgZ_YeQ",
        "relationship": "thematic suggestion"
      }
    ]
  },
  {
    "id": "occasion-birthday",
    "catalogueId": "occasion-birthday",
    "name": "Birthday",
    "category": "Celebrations",
    "note": "A whole new year of you.",
    "bg": "#ece2fa",
    "panel": "#fffaff",
    "ink": "#402758",
    "muted": "#695878",
    "accent": "#74409b",
    "cover": "#d6b1e8",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "raised",
    "artwork": "/assets/skins/core/occasion-birthday.svg",
    "border": "/assets/skins/core/occasion-birthday-border.svg",
    "artDescription": "Birthday: balloons illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Fijian happy birthday song — Sofitel Nadi performance",
        "performer": "Sofitel Nadi singers (visitor recording)",
        "url": "https://www.youtube.com/watch?v=kVaqjEvtQro",
        "relationship": "documented birthday performance"
      },
      {
        "title": "Siga Ni Sucu ‘Kaila Tu’ (Rauni)",
        "performer": "Children’s Songbook repertoire",
        "url": "https://www.churchofjesuschrist.org/study/manual/childrens-songbook/youve-had-a-birthday-round?lang=fij",
        "relationship": "published Fijian-language birthday repertoire"
      }
    ]
  },
  {
    "id": "occasion-first-birthday",
    "catalogueId": "occasion-first-birthday",
    "name": "First Birthday",
    "category": "Celebrations",
    "note": "One little year. So much love.",
    "bg": "#e1f0e7",
    "panel": "#fafffa",
    "ink": "#284b3d",
    "muted": "#5b7668",
    "accent": "#356b53",
    "cover": "#a8d8c2",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "raised",
    "artwork": "/assets/skins/core/occasion-first-birthday.svg",
    "border": "/assets/skins/core/occasion-first-birthday-border.svg",
    "artDescription": "First Birthday: balloons illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Fijian happy birthday song — Sofitel Nadi performance",
        "performer": "Sofitel Nadi singers (visitor recording)",
        "url": "https://www.youtube.com/watch?v=kVaqjEvtQro",
        "relationship": "documented birthday performance"
      },
      {
        "title": "Siga Ni Sucu ‘Kaila Tu’ (Rauni)",
        "performer": "Children’s Songbook repertoire",
        "url": "https://www.churchofjesuschrist.org/study/manual/childrens-songbook/youve-had-a-birthday-round?lang=fij",
        "relationship": "published Fijian-language birthday repertoire"
      }
    ]
  },
  {
    "id": "occasion-milestone-birthday",
    "catalogueId": "occasion-milestone-birthday",
    "name": "Milestone Birthday",
    "category": "Celebrations",
    "note": "Here is to your next chapter.",
    "bg": "#141b30",
    "panel": "#222a44",
    "ink": "#f4eeff",
    "muted": "#c0c8df",
    "accent": "#c4b7fc",
    "cover": "#475077",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "glass",
    "artwork": "/assets/skins/core/occasion-milestone-birthday.svg",
    "border": "/assets/skins/core/occasion-milestone-birthday-border.svg",
    "artDescription": "Milestone Birthday: sparkle illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Fijian happy birthday song — Sofitel Nadi performance",
        "performer": "Sofitel Nadi singers (visitor recording)",
        "url": "https://www.youtube.com/watch?v=kVaqjEvtQro",
        "relationship": "documented birthday performance"
      }
    ]
  },
  {
    "id": "occasion-wedding",
    "catalogueId": "occasion-wedding",
    "name": "Wedding",
    "category": "Celebrations",
    "note": "Our story starts here.",
    "bg": "#f0ede4",
    "panel": "#fffdf8",
    "ink": "#3e4142",
    "muted": "#666c6d",
    "accent": "#756035",
    "cover": "#ded5bd",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/occasion-wedding.svg",
    "border": "/assets/skins/core/occasion-wedding-border.svg",
    "artDescription": "Wedding: rings illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Na Watiqu",
        "performer": "Paradise Rootz featuring Cakau Ni Mana & Nasio Domoni",
        "url": "https://www.youtube.com/watch?v=Nzo7f-veMO0",
        "relationship": "thematic suggestion"
      },
      {
        "title": "Noqu Senibua",
        "performer": "Kuki",
        "url": "https://www.youtube.com/watch?v=JxXZrDvrIZI",
        "relationship": "thematic suggestion"
      }
    ]
  },
  {
    "id": "occasion-masi-wedding",
    "catalogueId": "occasion-masi-wedding",
    "name": "Masi Wedding",
    "category": "Celebrations",
    "note": "Two stories. One beautiful day.",
    "bg": "#ecdfc5",
    "panel": "#fff8e9",
    "ink": "#412a1b",
    "muted": "#755c46",
    "accent": "#7a412c",
    "cover": "#d1ad78",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/occasion-masi-wedding.svg",
    "border": "/assets/skins/core/occasion-masi-wedding-border.svg",
    "artDescription": "Masi Wedding: rings illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Na Watiqu",
        "performer": "Paradise Rootz featuring Cakau Ni Mana & Nasio Domoni",
        "url": "https://www.youtube.com/watch?v=Nzo7f-veMO0",
        "relationship": "thematic suggestion"
      }
    ]
  },
  {
    "id": "occasion-tevutevu",
    "catalogueId": "occasion-tevutevu",
    "name": "Tevutevu",
    "category": "Celebrations",
    "note": "Family. Love. Together.",
    "bg": "#e9d9bd",
    "panel": "#fff7e7",
    "ink": "#4c3525",
    "muted": "#765e48",
    "accent": "#795336",
    "cover": "#c8aa75",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/occasion-tevutevu.svg",
    "border": "/assets/skins/core/occasion-tevutevu-border.svg",
    "artDescription": "Tevutevu: weave illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Na Watiqu",
        "performer": "Paradise Rootz featuring Cakau Ni Mana & Nasio Domoni",
        "url": "https://www.youtube.com/watch?v=Nzo7f-veMO0",
        "relationship": "thematic suggestion"
      }
    ]
  },
  {
    "id": "occasion-anniversary",
    "catalogueId": "occasion-anniversary",
    "name": "Anniversary",
    "category": "Celebrations",
    "note": "Still choosing each other.",
    "bg": "#f5e7cb",
    "panel": "#fff9ed",
    "ink": "#4f351b",
    "muted": "#715d43",
    "accent": "#875016",
    "cover": "#e8b45a",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "raised",
    "artwork": "/assets/skins/core/occasion-anniversary.svg",
    "border": "/assets/skins/core/occasion-anniversary-border.svg",
    "artDescription": "Anniversary: rings illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Na Watiqu",
        "performer": "Paradise Rootz featuring Cakau Ni Mana & Nasio Domoni",
        "url": "https://www.youtube.com/watch?v=Nzo7f-veMO0",
        "relationship": "thematic suggestion"
      },
      {
        "title": "Noqu Senibua",
        "performer": "Kuki",
        "url": "https://www.youtube.com/watch?v=JxXZrDvrIZI",
        "relationship": "thematic suggestion"
      }
    ]
  },
  {
    "id": "occasion-childbirth",
    "catalogueId": "occasion-childbirth",
    "name": "Newborn Welcome",
    "category": "Celebrations",
    "note": "A little life. A whole lot of love.",
    "bg": "#e1f0e7",
    "panel": "#fafffa",
    "ink": "#284b3d",
    "muted": "#5b7668",
    "accent": "#356b53",
    "cover": "#a8d8c2",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "raised",
    "artwork": "/assets/skins/core/occasion-childbirth.svg",
    "border": "/assets/skins/core/occasion-childbirth-border.svg",
    "artDescription": "Newborn Welcome: cradle illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "A Wi Cava A Wi Dreu — Sere Ni Vaka Moce Gone",
        "performer": "Lagasere kei Dr T performance",
        "url": "https://www.youtube.com/watch?v=euiClsWxGgc",
        "relationship": "published Fijian lullaby performance"
      }
    ]
  },
  {
    "id": "occasion-roqoroqo",
    "catalogueId": "occasion-roqoroqo",
    "name": "i Roqoroqo Welcome",
    "category": "Celebrations",
    "note": "A family welcome.",
    "bg": "#e9d9bd",
    "panel": "#fff7e7",
    "ink": "#4c3525",
    "muted": "#765e48",
    "accent": "#795336",
    "cover": "#c8aa75",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/occasion-roqoroqo.svg",
    "border": "/assets/skins/core/occasion-roqoroqo-border.svg",
    "artDescription": "i Roqoroqo Welcome: cradle illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "A Wi Cava A Wi Dreu — Sere Ni Vaka Moce Gone",
        "performer": "Lagasere kei Dr T performance",
        "url": "https://www.youtube.com/watch?v=euiClsWxGgc",
        "relationship": "published Fijian lullaby performance"
      }
    ]
  },
  {
    "id": "occasion-mother-support",
    "catalogueId": "occasion-mother-support",
    "name": "Mother & Baby",
    "category": "Celebrations",
    "note": "Held in love.",
    "bg": "#ece2fa",
    "panel": "#fffaff",
    "ink": "#402758",
    "muted": "#695878",
    "accent": "#74409b",
    "cover": "#d6b1e8",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "raised",
    "artwork": "/assets/skins/core/occasion-mother-support.svg",
    "border": "/assets/skins/core/occasion-mother-support-border.svg",
    "artDescription": "Mother & Baby: moon illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": []
  },
  {
    "id": "occasion-baby-shower",
    "catalogueId": "occasion-baby-shower",
    "name": "Baby Shower",
    "category": "Celebrations",
    "note": "Something wonderful is coming.",
    "bg": "#e0f1fa",
    "panel": "#f9feff",
    "ink": "#24415a",
    "muted": "#526c81",
    "accent": "#2b617f",
    "cover": "#a9d6e8",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "raised",
    "artwork": "/assets/skins/core/occasion-baby-shower.svg",
    "border": "/assets/skins/core/occasion-baby-shower-border.svg",
    "artDescription": "Baby Shower: clouds illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": []
  },
  {
    "id": "occasion-faith-birth",
    "catalogueId": "occasion-faith-birth",
    "name": "Faith Blessing",
    "category": "Celebrations",
    "note": "Blessings for this new beginning.",
    "bg": "#f0ede4",
    "panel": "#fffdf8",
    "ink": "#3e4142",
    "muted": "#666c6d",
    "accent": "#756035",
    "cover": "#ded5bd",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/occasion-faith-birth.svg",
    "border": "/assets/skins/core/occasion-faith-birth-border.svg",
    "artDescription": "Faith Blessing: dove illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": []
  },
  {
    "id": "occasion-graduation",
    "catalogueId": "occasion-graduation",
    "name": "Graduation",
    "category": "Celebrations",
    "note": "Look how far you have come.",
    "bg": "#101f42",
    "panel": "#1d3059",
    "ink": "#f6f1dc",
    "muted": "#c6cce2",
    "accent": "#f7cd66",
    "cover": "#283f6c",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/occasion-graduation.svg",
    "border": "/assets/skins/core/occasion-graduation-border.svg",
    "artDescription": "Graduation: cap illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Garland of Achievement",
        "performer": "USP Choir",
        "url": "https://www.youtube.com/watch?v=RYheeIzwggY",
        "relationship": "official institutional association"
      }
    ]
  },
  {
    "id": "occasion-school-reunion",
    "catalogueId": "occasion-school-reunion",
    "name": "School Reunion",
    "category": "Celebrations",
    "note": "Remember when?",
    "bg": "#f5e7cb",
    "panel": "#fff9ed",
    "ink": "#4f351b",
    "muted": "#715d43",
    "accent": "#875016",
    "cover": "#e8b45a",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/occasion-school-reunion.svg",
    "border": "/assets/skins/core/occasion-school-reunion-border.svg",
    "artDescription": "School Reunion: book illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Grammar Tu Ga",
        "performer": "Natalie Raikadroka, Patco Muzik, Drixstar, Mr. Grin",
        "url": "https://open.spotify.com/track/4CodGFhOr6srF38IBtdN4d",
        "relationship": "documented alumni anthem"
      },
      {
        "title": "Noqu Koronivuli Uasivi",
        "performer": "RKS students / school choir",
        "url": "https://www.youtube.com/watch?v=ouXJM0Y-H7A",
        "relationship": "documented school association"
      },
      {
        "title": "Seni Waterlily",
        "performer": "ACS Year 13 students",
        "url": "https://www.facebook.com/fijisun/videos/acs-year-13s-visit-parliamentmore-than-80-year-13-students-from-adi-cakobau-scho/2348721745561716/",
        "relationship": "documented school association"
      },
      {
        "title": "Redfire Guide My Soul",
        "performer": "Marist Brothers High School performance",
        "url": "https://www.youtube.com/watch?v=i3xElGelmGk",
        "relationship": "published school-themed recording"
      }
    ]
  },
  {
    "id": "occasion-family-reunion",
    "catalogueId": "occasion-family-reunion",
    "name": "Family Reunion",
    "category": "Celebrations",
    "note": "Back together. Right where we belong.",
    "bg": "#dce9dc",
    "panel": "#f7fcf4",
    "ink": "#203f30",
    "muted": "#526e5a",
    "accent": "#246347",
    "cover": "#8dbd8b",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/occasion-family-reunion.svg",
    "border": "/assets/skins/core/occasion-family-reunion-border.svg",
    "artDescription": "Family Reunion: tree illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Coming Home",
        "performer": "Knox (Inoke Kalounisiga)",
        "url": "https://music.apple.com/us/album/fading-ep/946880959",
        "relationship": "thematic suggestion"
      },
      {
        "title": "Noqu Vanua",
        "performer": "Kuki",
        "url": "https://www.youtube.com/watch?v=F4HnJgZ_YeQ",
        "relationship": "thematic suggestion"
      },
      {
        "title": "Lomaloma",
        "performer": "Josateki Koroituicakau",
        "url": "https://www.youtube.com/watch?v=EBVu0YstnPQ",
        "relationship": "documented place and belonging story"
      }
    ]
  },
  {
    "id": "memory-love",
    "catalogueId": "memory-love",
    "name": "Love",
    "category": "Love & Memories",
    "note": "A little space for us.",
    "bg": "#f8dedc",
    "panel": "#fff8f5",
    "ink": "#562a36",
    "muted": "#7d5861",
    "accent": "#a83859",
    "cover": "#ed929f",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "raised",
    "artwork": "/assets/skins/core/memory-love.svg",
    "border": "/assets/skins/core/memory-love-border.svg",
    "artDescription": "Love: heart illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Noqu Senibua",
        "performer": "Kuki",
        "url": "https://www.youtube.com/watch?v=JxXZrDvrIZI",
        "relationship": "thematic suggestion"
      },
      {
        "title": "Na Watiqu",
        "performer": "Paradise Rootz featuring Cakau Ni Mana & Nasio Domoni",
        "url": "https://www.youtube.com/watch?v=Nzo7f-veMO0",
        "relationship": "thematic suggestion"
      },
      {
        "title": "Isa Lei Lia",
        "performer": "FIJI (George Veikoso)",
        "url": "https://www.thecoconet.tv/songbook/islandjams/isa-lei-lia-fiji-george-veikoso/",
        "relationship": "documented performance; thematic suggestion"
      }
    ]
  },
  {
    "id": "memory-broken-hearted",
    "catalogueId": "memory-broken-hearted",
    "name": "Brokenhearted",
    "category": "Love & Memories",
    "note": "Some feelings need their own sky.",
    "bg": "#141b30",
    "panel": "#222a44",
    "ink": "#f4eeff",
    "muted": "#c0c8df",
    "accent": "#c4b7fc",
    "cover": "#475077",
    "pattern": "plain",
    "font": "rounded",
    "cardStyle": "round",
    "material": "glass",
    "artwork": "/assets/skins/core/memory-broken-hearted.svg",
    "border": "/assets/skins/core/memory-broken-hearted-border.svg",
    "artDescription": "Brokenhearted: rain illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Noqu Daulomani",
        "performer": "Naseda",
        "url": "https://www.youtube.com/watch?v=1mJ7FOtaw1w",
        "relationship": "documented lost-love story; restricted suggestion"
      }
    ]
  },
  {
    "id": "memory-childhood-memory",
    "catalogueId": "memory-childhood-memory",
    "name": "Childhood Memories",
    "category": "Love & Memories",
    "note": "The garden. The stories. Home.",
    "bg": "#382820",
    "panel": "#4c382d",
    "ink": "#fff3dc",
    "muted": "#d9c5ae",
    "accent": "#efc187",
    "cover": "#826447",
    "pattern": "plain",
    "font": "serif",
    "cardStyle": "square",
    "material": "paper",
    "artwork": "/assets/skins/core/memory-childhood-memory.svg",
    "border": "/assets/skins/core/memory-childhood-memory-border.svg",
    "artDescription": "Childhood Memories: dalo illustration",
    "designNote": "Original artwork inspired by the researched theme.",
    "songs": [
      {
        "title": "Lai Tei Dalo Ko Tamaqu (also Lei spelling)",
        "performer": "Traditional repertoire / Coconet presentation",
        "url": "https://www.thecoconet.tv/coco-kids/coco-kids-jams/lai-tei-dalo/",
        "relationship": "documented lullaby, with sensitive historical context"
      }
    ]
  }
]);
  // Append only: existing saved IDs and the home collage keep their order.
  presets.push(
    {id:'studio-ocean',name:'Ocean',category:'New picks',note:'Good company. Open horizons.',bg:'#dff6f5',panel:'#ffffff',ink:'#123d50',muted:'#496575',accent:'#046e86',cover:'#82d9d5',pattern:'waves',font:'rounded',cardStyle:'round'},
    {id:'studio-masi',name:'Masi',category:'New picks',note:'Your roots. Your own story.',bg:'#efe4cc',panel:'#fffaf0',ink:'#30281f',muted:'#655440',accent:'#665034',cover:'#e3cba2',pattern:'masi',font:'serif',material:'paper',cardStyle:'square'},
    {id:'studio-coral',name:'Coral Sunset',category:'New picks',note:'Stay for one more story.',bg:'#fff0e7',panel:'#fffaf7',ink:'#412b3b',muted:'#735560',accent:'#b7384b',cover:'#f5a486',pattern:'waves',font:'rounded',material:'raised',cardStyle:'round'},
    {id:'studio-retro',name:'Bebo Retro',category:'New picks',note:'Your space. Your people. Your playlist.',bg:'#ede5ff',panel:'#fffbff',ink:'#2f174d',muted:'#6b547c',accent:'#7130a4',cover:'#efb0da',pattern:'checker',font:'rounded',material:'paper',cardStyle:'soft',effect:'sticker'}
  );
  // Artwork and layout belong to the built-in design, never to imported CSS.
  const artRoot='/assets/skins/studio/';
  const artStyles={
    'studio-ocean':{look:'ocean',coverArt:artRoot+'ocean-20261025.webp',bg:'#081e2c',panel:'#102f41',ink:'#eefbff',muted:'#b4d8e3',accent:'#6de6dd',material:'glass'},
    'studio-masi':{look:'masi',coverArt:'/assets/masi-supplied.png',coverRepeat:true,bg:'#d6c1a0',panel:'#fff6e7',ink:'#312418',muted:'#6c543a',accent:'#7d402a',material:'paper'},
    'studio-coral':{look:'coral',coverArt:artRoot+'coral-20261025.webp',bg:'#2b152d',panel:'#48263c',ink:'#fff2ef',muted:'#e3bfcb',accent:'#ffb38d',material:'glass',font:'serif'},
    'studio-retro':{look:'retro',coverArt:artRoot+'retro-20261025.svg',bg:'#2b124a',panel:'#fff1fa',ink:'#39104b',muted:'#795577',accent:'#b82181',material:'paper'},
    'memory-broken-hearted':{look:'rain',coverArt:artRoot+'rain-20261025.webp',bg:'#0d1021',panel:'#171b32',ink:'#f1edff',muted:'#b9b9d8',accent:'#eeb0e3',material:'glass',font:'serif'}
  };
  for(const p of presets)Object.assign(p,artStyles[p.id]||{look:p.material==='paper'?'paper':'social'});
  const identities=typeof module==='object'&&module.exports?require('./skin-identities.js'):globalThis.SotaSkinIdentities;
  if(identities){presets.push(...identities.presets.map(p=>({...p})));for(const p of presets)Object.assign(p,identities.styles[p.id]||{});}
  // Regional presentation follows the identity merge. Saved IDs, credited
  // identities, source artwork/borders and attributed song references survive.
  const regional=typeof module==='object'&&module.exports?require('./pacific-themes.js'):globalThis.SotaPacificThemes;
  if(regional)for(const p of presets)Object.assign(p,regional.styles[p.id]||{});
  function song(ref){
    const match=String(ref||'').match(/^([a-z0-9-]+):(\d{1,2})$/);if(!match)return null;
    const p=presets.find(p=>p.id===match[1]),s=p?.songs?.[Number(match[2])];
    return s&&safeUrl(s.url)?{...s,ref:match[0],skinName:p.name}:null;
  }
  const patterns = ['waves','dots','stars','flowers','stripes','checker','grid','masi','plain'];
  const fonts = ['rounded','serif','mono','sans','display','handwritten'];
  const fontStacks = {rounded:'Manrope, system-ui, sans-serif',serif:'Georgia, serif',mono:'ui-monospace, monospace',
    sans:'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display:'Impact, "Arial Black", sans-serif',handwritten:'"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive'};
  const customizationDefaults={customName:'',showArtwork:true,textScale:100,headingScale:100,coverHeight:195,coverX:0,coverY:100,textAlign:'left',musicPosition:'auto',avatarPath:'',motionPath:'',motionStyle:'',motionVariant:0,motionIntensity:1,motionFocusX:0.5,motionFocusY:0.5};
  const marker = /^\/\* bv-skin:v1 ([^\n]*?) \*\/\n?/;
  const hex = (v, fallback) => /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : fallback;
  function boundedNumber(value,min,max,fallback) {
    if(typeof value!=='number'&&(typeof value!=='string'||!value.trim()))return fallback;
    const number=Number(value);return Number.isFinite(number)?Math.min(max,Math.max(min,number)):fallback;
  }
  function customName(value) {
    if(typeof value!=='string')return '';
    // Drop unpaired surrogates, including a pair cut by the 40-code-unit limit,
    // so a pasted/imported label cannot make encodeURIComponent throw.
    return Array.from(value).filter(char=>char.length===2||!/[\uD800-\uDFFF]/.test(char)).join('').slice(0,40).replace(/[\uD800-\uDBFF]$/,'');
  }
  function safeUrl(value, audio=false) {
    try {
      const u=new URL(String(value||'').trim());
      if(u.protocol!=='https:'||u.username||u.password||u.href.length>320)return '';
      if(audio&&!/\.(mp3|m4a|ogg|opus|wav)$/i.test(u.pathname))return '';
      return u.href;
    }catch(_){return '';}
  }
  function safeMediaPath(value,kind) {
    const text=String(value||'');return new RegExp('^[a-f0-9-]{36}/'+kind+'/[a-f0-9-]{36}\\.(?:'+(kind==='music'?'mp3|m4a|ogg|opus|wav':'jpg|jpeg|png|webp')+')$','i').test(text)?text:'';
  }
  function normalize(raw) {
    const input = raw && typeof raw === 'object' ? raw : {};
    const preset = presets.find(p => p.id === input.id) || presets[0];
    return {id:preset.id,accent:hex(input.accent,preset.accent),background:hex(input.background,preset.bg),
      pattern:patterns.includes(input.pattern)?input.pattern:preset.pattern,
      font:fonts.includes(input.font)?input.font:preset.font,
      layout:['wide','reverse','stacked'].includes(input.layout)?input.layout:'classic',
      customName:customName(input.customName),showArtwork:typeof input.showArtwork==='boolean'?input.showArtwork:true,
      textScale:boundedNumber(input.textScale,90,140,100),headingScale:boundedNumber(input.headingScale,80,150,100),
      coverHeight:boundedNumber(input.coverHeight,180,420,195),coverX:boundedNumber(input.coverX,0,100,0),coverY:boundedNumber(input.coverY,0,100,100),
      textAlign:['center','right'].includes(input.textAlign)?input.textAlign:'left',
      musicPosition:['top','bottom'].includes(input.musicPosition)?input.musicPosition:'auto',
      note:String(input.note??preset.note).slice(0,80),interests:String(input.interests??'').slice(0,160),
      songRef:song(input.songRef)?String(input.songRef):'',trackUrl:safeUrl(input.trackUrl,true),trackTitle:String(input.trackTitle??'').slice(0,80),
      trackPath:safeMediaPath(input.trackPath,'music'),coverPath:safeMediaPath(input.coverPath,'covers'),avatarPath:safeMediaPath(input.avatarPath,'covers'),
      motionPath:safeMediaPath(input.motionPath,'covers'),motionStyle:['parallax','particles','fluid','glitch','cinemagraph'].includes(input.motionStyle)?input.motionStyle:'',
      motionVariant:Math.round(boundedNumber(input.motionVariant,0,2,0)),motionIntensity:boundedNumber(input.motionIntensity,0.2,1.8,1),
      motionFocusX:boundedNumber(input.motionFocusX,0,1,0.5),motionFocusY:boundedNumber(input.motionFocusY,0,1,0.5),
      panel:hex(input.panel,preset.panel),cover:hex(input.cover,preset.cover),
      cardStyle:['soft','square','round'].includes(input.cardStyle)?input.cardStyle:(preset.cardStyle||'soft'),
      effect:['flat','glow','sticker'].includes(input.effect)?input.effect:(preset.effect||'flat'),
      atmosphere:['bubbles','stars','waves','sparks','masi'].includes(input.atmosphere)?input.atmosphere:'none',
      motionEnergy:input.motionEnergy==='calm'?'calm':'bold'};
  }
  function read(css) {
    const text = String(css??'').slice(0,4000), match = text.match(marker);
    if (!match) return {settings:normalize(),legacy:text};
    try { return {settings:normalize(JSON.parse(decodeURIComponent(match[1]))),legacy:text.slice(match[0].length)}; }
    catch (_) { return {settings:normalize(),legacy:text.replace(marker,'')}; }
  }
  function encode(settings, legacy='') {
    const saved=normalize(settings);
    // Old skins retain their exact header footprint and custom-CSS allowance.
    // read()/normalize() rehydrate omitted new defaults without a v1 migration.
    for(const [key,value] of Object.entries(customizationDefaults))if(saved[key]===value)delete saved[key];
    const header = `/* bv-skin:v1 ${encodeURIComponent(JSON.stringify(saved))} */\n`;
    if (header.length > 4000) throw new Error('Skin settings are too long.');
    if (header.length + String(legacy).length > 4000) throw new Error('Your custom CSS is too long. Shorten it before saving.');
    return header + String(legacy);
  }
  function luminance(colour) {
    const rgb = [1,3,5].map(i=>parseInt(colour.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  }
  function foreground(bg) { return contrast(bg,'#172433')>=4.5?'#172433':contrast(bg,'#ffffff')>=4.5?'#ffffff':'#000000'; }
  function contrast(a,b) { const x=luminance(a),y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
  function motif(pattern) {
    const light='rgba(255,255,255,.25)',dark='rgba(25,40,60,.08)';
    return {waves:`repeating-radial-gradient(ellipse at 0 0,transparent 0 20px,${light} 21px 23px,transparent 24px 45px)`,
      dots:`radial-gradient(${dark} 1.5px,transparent 1.5px)`,
      stars:`radial-gradient(${light} 1px,transparent 1px)`,
      flowers:`radial-gradient(ellipse at 30% 35%,${light} 0 12px,transparent 13px),radial-gradient(ellipse at 65% 65%,${light} 0 12px,transparent 13px)`,
      stripes:`repeating-linear-gradient(125deg,transparent 0 22px,${light} 23px 28px,transparent 29px 48px)`,
      checker:`conic-gradient(${light} 25%,transparent 0 50%,${light} 0 75%,transparent 0)`,
      grid:`linear-gradient(${dark} 1px,transparent 1px),linear-gradient(90deg,${dark} 1px,transparent 1px)`,masi:'url(/assets/masi-band.svg)',plain:'none'}[pattern]||'none';
  }
  function tokens(raw) {
    const s=normalize(raw),p=presets.find(p=>p.id===s.id);
    const visuals=typeof module==='object'&&module.exports?require('./skin-visuals.js'):globalThis.SotaSkinVisuals;
    const hero=visuals?.cover(p)||p.coverArt||p.artwork;
    const photographic=p.artworkType==='photographic',surfaceArt=photographic?hero:p.artwork;
    // Materials follow the chosen palette; saved v1 settings remain compatible.
    const paper=p.material==='paper'||['masi','kava','notebook','ink','varsity','comic'].includes(s.id);
    const raised=p.material==='raised'||['kula','bloom','palm','mango','candy','cloud','mint'].includes(s.id);
    const light=luminance(s.panel)>.5;
    const edge=`color-mix(in srgb,${s.accent} ${paper?'24':'18'}%,${s.panel})`;
    const sheen=`color-mix(in srgb,${s.panel} 91%,${light?'#ffffff':'#b3eaff'})`;
    const materialShadow=paper?`0 3px 0 color-mix(in srgb,${s.accent} 17%,${s.background}),0 8px 20px ${s.accent}14,inset 0 0 0 1px ${edge}`:
      raised?`7px 7px 18px color-mix(in srgb,${s.background} 82%,${p.ink}),-5px -5px 14px ${light?'#ffffff99':'#ffffff0c'},inset 0 1px 0 ${light?'#ffffff':'#ffffff26'}`:
      `0 12px 28px ${light?'#102b3c18':'#00000040'},inset 0 1px 0 ${light?'#ffffff':'#ffffff30'},inset 0 0 0 1px ${edge}`;
    const texture=paper?`repeating-linear-gradient(0deg,transparent 0 3px,${light?'#5c361908':'#fff1d507'} 3px 4px),radial-gradient(${light?'#6e382718':'#fff1d514'} .6px,transparent .8px)`:
      raised?`linear-gradient(135deg,${sheen},${s.panel} 55%,color-mix(in srgb,${s.panel} 95%,${s.accent}))`:
      `linear-gradient(135deg,${light?'#ffffff99':'#ffffff14'},transparent 55%,${s.accent}0d)`;
    const finish=s.effect==='glow'?`,0 0 16px ${s.accent}44`:s.effect==='sticker'?`,4px 4px 0 ${s.accent}`:'';
    const controlShadow=`0 3px 8px ${s.accent}24,inset 0 1px 0 #ffffff40,inset 0 -2px 0 #00000012`;
    return {'--bv-hero':!s.showArtwork?'none':hero?`url("${hero}")`:motif(s.pattern),
      '--bv-hero-size':visuals?'cover':p.coverRepeat?'240px auto':'cover','--bv-hero-repeat':!visuals&&p.coverRepeat?'repeat':'no-repeat','--bv-hero-position':visuals?.position(p)||'center',
      '--bv-art':s.showArtwork&&surfaceArt?`url("${surfaceArt}")`:'none','--bv-border':!photographic&&p.border?`url("${p.border}")`:'none',
      '--bv-bg':s.background,'--bv-panel':s.panel,'--bv-ink':s.panel===p.panel?p.ink:foreground(s.panel),'--bv-muted':s.panel===p.panel?p.muted:foreground(s.panel),
      '--bv-accent':s.accent,'--bv-on-accent':foreground(s.accent),
      '--bv-chat-in':s.panel,'--bv-chat-in-ink':s.panel===p.panel?p.ink:foreground(s.panel),
      '--bv-chat-out':s.accent,'--bv-chat-out-ink':foreground(s.accent),
      '--bv-link':contrast(s.accent,s.panel)>=4.5?s.accent:s.panel===p.panel?p.ink:foreground(s.panel),
      '--bv-cover':s.cover,'--bv-cover-ink':foreground(s.cover),
      '--bv-radius':s.cardStyle==='square'?'2px':s.cardStyle==='round'?'22px':'10px',
      '--bv-card-shadow':s.effect==='glow'?'0 0 16px '+s.accent+'44':s.effect==='sticker'?'4px 4px 0 '+s.accent:'none',
      '--bv-surface':s.panel,'--bv-surface-image':texture,'--bv-surface-size':paper?'auto,7px 9px':'auto',
      '--bv-surface-shadow':materialShadow,'--bv-surface-edge':edge,
      '--bv-surface-card-shadow':materialShadow+finish,
      '--bv-surface-blur':paper||raised?'none':'blur(10px)',
      '--bv-glass-surface':paper||raised?s.panel:`color-mix(in srgb,${s.panel} 94%,transparent)`,
      '--bv-control-shadow':controlShadow,'--bv-control-card-shadow':controlShadow+finish,
      '--bv-cover-sheen':`linear-gradient(135deg,#ffffff30,transparent 48%,${s.accent}18)`,
      '--bv-pattern':motif(s.pattern),'--bv-pattern-size':['dots','stars','grid'].includes(s.pattern)?'24px 24px':s.pattern==='checker'?'48px 48px':s.pattern==='masi'?'120px 32px':'160px 140px',
      '--bv-font':fontStacks[s.font],
      '--bv-text-scale':String(s.textScale/100),'--bv-heading-scale':String(s.headingScale/100),
      '--bv-cover-height':s.coverHeight+'px','--bv-cover-x':s.coverX+'%','--bv-cover-y':s.coverY+'%',
      '--bv-cover-shift-x':(-s.coverX)+'%','--bv-cover-shift-y':(-s.coverY)+'%','--bv-text-align':s.textAlign};
  }
  function inline(raw) { return Object.entries(tokens(raw)).map(([k,v])=>`${k}:${v}`).join(';'); }
  function safeLegacy(css) {
    const text = String(css??'').replace(/\/\*[\s\S]*?\*\//g,'');
    if (/<|>|@|url\s*\(|expression\s*\(|javascript\s*:|behavior\s*:|\\/i.test(text)) return '';
    const allowed=/^(color|background-color|border(?:-(?:color|width|style|radius|top|right|bottom|left))?|border-(?:top|right|bottom|left)-(?:color|width|style)|font-(?:family|size|weight|style)|line-height|letter-spacing|text-(?:align|decoration|transform)|padding(?:-(?:top|right|bottom|left))?|margin(?:-(?:top|right|bottom|left))?|box-shadow|opacity)$/;
    const rules=[];
    for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors=match[1].split(',').map(s=>s.trim()).filter(s=>/^[\w\s.#:>+~\[\]="'()-]+$/.test(s)&&!/(^|[\s>+~])(?:html|body)|:root|:has\(/i.test(s));
      const declarations=match[2].split(';').filter(d=>allowed.test(d.split(':')[0].trim().toLowerCase())).join(';');
      if(selectors.length&&declarations)rules.push(selectors.map(s=>`#view.bv-room ${s}`).join(',')+'{'+declarations+'}');
    }
    return rules.join('\n');
  }
  return {presets,patterns,fonts,normalize,read,encode,tokens,inline,safeLegacy,contrast,foreground,safeUrl,song};
});

