# Sota Kece: expressive colour and social experience

Reviewed 3 November 2026. This is a design recommendation, not a measured uplift for Sota Kece.

## Evidence

- [Google Design: research behind Material 3 Expressive](https://design.google/library/expressive-material-design-google-research). Google reports 46 studies and more than 18,000 participants; preference for expressive interfaces reached up to 87% among 18–24-year-olds in its tests. This concerns a combined system of colour, shape, motion, size and clear grouping. It does not isolate one winning hue or prove retention for a Fijian social app. Familiar navigation, readable labels and usable playlists remain essential.
- [Wilms & Oberfeld, 2018](https://pubmed.ncbi.nlm.nih.gov/28612080/). A 62-participant laboratory experiment found effects of saturation and brightness on arousal. Arousal is not the same as enjoyment, trust, participation or retention. The abstract was verified through PubMed after the Firecrawl scrape failed; search excerpts also identified the author-hosted paper.
- [Jonauskaite et al., 2020](https://pubmed.ncbi.nlm.nih.gov/32900287/). Colour-emotion associations across 4,598 people in 30 nations shared patterns but also varied with nation, language and geography. This does not establish a palette specifically preferred by young Fijians.

## Applied palette — design judgement informed by that evidence

| Colour | Value | Role |
|---|---|---|
| Electric violet | #6B35CE | Selected navigation and music controls; white text |
| Hibiscus pink | #F7D9EE | Social shortcuts and people cards; dark plum text |
| Coral | #FFDBCA | Talanoa shortcuts; dark plum text |
| Sunshine yellow | #FFD447 | Main action and highlights; dark plum text |
| Lime | #D6F6AD | 3D-world shortcut; dark green text |
| Sky blue | #C4E7FF | Patterned backdrop, with pink and yellow light |
| Plum ink | #272044 | Reading text and heading contrast |

The energetic colour sits in the interface. Natural-light young-adult photographs retain their original encoding and colour; no saturation filter is applied. Original Fiji-flag ring and separate central music-note artwork restore the moving circular music identity. Reduced-motion settings stop rotation.

## Fuller experience

Home now contains the existing example room with Talanoa notes, Top Mates and room soundtrack, plus the actual playlist. Room Studio and page design remain native controls. Home, Music and My space move the same room/player elements between slots, preserving listeners, draft values and the single audio owner. The new Home links surface existing People, Talanoa, Music, Skins and 3D connections routes. Example notes and the 16 Top Mates are explicitly labelled as examples; no live activity or membership claim is introduced. Fresh guests start with Hibiscus Heat; existing saved personal skins are preserved. The flag is visible on phones as well as desktop, with idle rotation and faster movement during actual playback.

## Next evidence to collect

With young Fijian participants, compare the previous and proposed interfaces on finding a friend, choosing a song, personalising a room, perceived energy, cultural fit, readability and comfort. Record task success and preference before claiming engagement gains. Keep a calmer personal design option available through the existing page designer.

## Implementation checks

Seven public destinations fit at 1440px and 390px without horizontal overflow. Muted real-track playback reached readyState 4 and continued across routes with one audio element and an unchanged search filter; the ring speed changed from 12 seconds to 2.4 seconds during playback. Room Studio, page design and signup entry opened through their existing controls. 54 targeted checks passed. Full suite: 548 tests, 540 passed, 4 existing companion/Connect failures, 4 skipped. The legacy gallery-only CSS no longer hides the Home playlist; a regression test covers that integration.
