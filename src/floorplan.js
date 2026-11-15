import {stations} from './casebook.js';
// Solid footprints in metres [minX, maxX, minZ, maxZ].
// Room 1, the intake lobby (z −2.95..6.45).
const lobby=[[-2.27,2.19,-.51,1.57],[-.39,.40,-2.02,-1.27],[-4.32,-2.29,-2.62,-1.48],[2.87,4.43,-2.95,-2.00],[-4.36,-3.68,-1.25,2.12],[-4.35,-3.88,4.24,5.78],
  [-2.72,-2.38,1.83,2.17],[-2.12,-.98,-2.95,-2.22],[-.1,1.1,5.7,6.38]];
// Room 2, the phlebotomy lab (z 6.45..10.25).
const lab=[[-4.35,-3.75,6.70,7.30],[-4.45,-3.80,7.70,9.50],[-2.95,.75,9.75,10.19],[.22,1.58,7.62,8.38],[.66,1.14,8.45,8.92],[1.0,1.76,9.66,10.19],
  [4.02,4.47,6.56,7.54],[1.75,3.45,6.52,7.2],[-1.4,-.4,6.7,7.2],[-3.65,-2.75,6.6,7.1],[1.85,2.55,7.65,8.35],[1.85,2.81,8.67,9.33],[2.9,3.7,8.4,10.15],[4.1,4.47,8.25,9.65]];
// Room 3, the dispatch office (z 10.25..14.6).
const dispatch=[[-.75,.75,11.85,12.55],[1.9,3.3,13.75,14.55],[-1.43,.23,13.87,14.55],[3.62,4.38,10.95,12.9],[-3.05,-2.15,13.5,14.3],[-4.47,-4.3,11.6,12.4],[1.5,1.94,10.4,11.04]];
// Interior walls: the lobby/lab partition and the lab/dispatch wall, each with a door gap.
// The holding cell in the dispatch office's north-east corner: west wall (doorway z 11.1–11.92), south wall, east wall, and the luggage inside.
export const cell=[[1.4,1.48,10.31,11.1],[1.4,3.2,11.92,12.0],[3.12,3.2,10.31,12.0]];
export const walls=[[-4.47,-2.63,6.38,6.52],[-1.57,4.47,6.38,6.52],[-4.47,-3.8,10.19,10.31],[-2.9,4.47,10.19,10.31],...cell];
export const footprints=[...lobby,...lab,...dispatch,...walls];
// Tall things block a standing player's line of sight from a patrolling guard.
export const tallFootprints=[...walls,[-4.32,-2.29,-2.62,-1.48],[2.87,4.43,-2.95,-2.00],[-2.95,.75,9.75,10.19],[4.02,4.47,6.56,7.54],[1.75,3.45,6.52,7.2],[-3.05,-2.15,13.5,14.3]];
export const ROOM_SOUTH=14.6;
// Doors between rooms: solid only while closed. [minX,maxX,minZ,maxZ]
export const doors={lab:[-2.63,-1.57,6.38,6.52],dispatch:[-3.8,-2.9,10.19,10.31]};
export const roomOf=z=>z<6.45?1:z<10.25?2:3;
const X=x=>25+(x+4.47)*27,Z=z=>20+(z+2.95)*27;
const rect=([a,b,c,d],fill)=>`<rect x="${X(a)}" y="${Z(c)}" width="${(b-a)*27}" height="${(d-c)*27}" fill="${fill}" stroke="#8b7759"/>`;
export function floorplan(x,z,yaw,id,curio,open={}){const p=stations[id]?.at;const H=Z(ROOM_SOUTH)-20;return `<figure class="floorplan"><figcaption>Ground floor plan</figcaption><svg viewBox="0 0 292 ${Math.ceil(H+46)}" role="img" aria-label="Map of the clinic with your position and the current objective"><defs><pattern id="mapHatch" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 5L5 0" stroke="#b59767" stroke-width=".5"/></pattern></defs><rect x="25" y="20" width="242" height="${H}" fill="#d7c5a2" stroke="#786445" stroke-width="3"/><rect x="25" y="${Z(6.45)}" width="242" height="${Z(10.25)-Z(6.45)}" fill="#cdb894"/><rect x="25" y="${Z(10.25)}" width="242" height="${Z(ROOM_SOUTH)-Z(10.25)}" fill="#c4ae88"/>${[...lobby,...lab,...dispatch].map(f=>rect(f,'url(#mapHatch)')).join('')}${walls.map(f=>rect(f,'#786445')).join('')}${Object.entries(doors).map(([k,f])=>rect(f,open[k]?'#e9dcc0':'#a14c3c')).join('')}<g class="map-words"><text x="143" y="31">Board</text><text x="144" y="120">Desk</text><text x="80" y="72">Archive</text><text x="70" y="186">Window</text><text x="225" y="111">Guard</text><text x="146" y="${Z(5.2)}">1. Intake lobby</text><text x="${X(-1.2)}" y="${Z(9.3)}">2. Phlebotomy lab</text><text x="${X(-.4)}" y="${Z(11.1)}">3. Dispatch office</text></g>${curio?curio.map(([cx,cz])=>`<circle cx="${X(cx)}" cy="${Z(cz)}" r="2.6" fill="#7a5b35" opacity=".7"/>`).join(''):''}<path d="M267 83v32" stroke="#a14c3c" stroke-width="5"/><path d="M25 151v43" stroke="#507b7e" stroke-width="5"/>${p?`<g transform="translate(${X(p[0])} ${Z(p[2])})"><circle r="9" fill="#eac289" stroke="#8b4926"/><path d="M0 -5l5 5-5 5-5-5Z" fill="#a5592a"/></g>`:''}<g transform="translate(${X(x)} ${Z(z)}) rotate(${-yaw*180/Math.PI})"><circle r="7" fill="#f5e5c1" stroke="#344f51"/><path d="M0 -11 5 5 0 2 -5 5Z" fill="#2e5d61"/></g></svg><div class="map-key"><span>▲ You</span>${p?'<span>◆ Current lead</span>':''}<span class="unsearched">● Not searched</span></div></figure>`;}
