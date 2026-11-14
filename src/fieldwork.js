const tickets=[{id:'north',seal:'K4',pier:'Pier 9',time:'23:15'},{id:'maritime',seal:'K7',pier:'Pier 9',time:'00:40'},{id:'east',seal:'K7',pier:'Pier 3',time:'00:10'}];
export const workTitles={registration:'Register the carbon copy',weighbill:'Trace the cooler’s transfer',channel:'Find the advocate on air'};
export function startWork(id){return {id,x:-24,y:18,ticket:'',frequency:560};}
// Comfort mode widens the alignment and tuning windows.
let ease=1;export function setEase(v){ease=v;}
export function solved(p){if(p.id==='registration')return Math.abs(p.x)<=3*ease&&Math.abs(p.y)<=3*ease;if(p.id==='weighbill')return p.ticket==='maritime';return Math.abs(p.frequency-640)<=2+6*(ease-1)/2;}
export function adjust(p,key,value){if(p.id==='registration'){p.x=Math.max(-42,Math.min(42,p.x+(key==='x'?value:0)));p.y=Math.max(-36,Math.min(36,p.y+(key==='y'?value:0)));}else if(p.id==='channel')p.frequency=Math.max(520,Math.min(760,value));else if(key==='ticket')p.ticket=value;}
function nudge(axis,amount,name,glyph){return `<button data-action="work-adjust" data-axis="${axis}" data-step="${amount}" aria-label="${name}">${glyph}</button>`;}
const crosses=([x,y])=>`<path d="M${x-7} ${y}h14m-7 -7v14"/>`;
export function signal(p){return Math.max(.04,1-Math.abs(p.frequency-640)/65);}
export function workBody(p){let body='',action='';
 if(p.id==='registration'){
  action='Press the duplicate';const marks=[[32,26],[238,108]].map(crosses).join('');
  body=`<p>Place the red crosses over the black crosses, then press the sheet. Drag the carbon paper or use the arrows.</p><div class="carbon-table"><svg id="carbonTable" viewBox="-46 -37 364 210" aria-label="Registration board"><rect x="0" y="0" width="270" height="134" fill="#d6bf91" stroke="#614e39"/><g stroke="#211c18" stroke-width="3">${marks}</g><text x="56" y="58">AEGIS  /  AGENCY COPY</text><path d="M54 74h162m-162 9h122" fill="none" stroke="#8c7859"/><g id="carbonSheet"><rect x="0" y="0" width="270" height="134" fill="#445461" fill-opacity=".24" stroke="#894b34" stroke-dasharray="7 4"/><g stroke="#a83d26" stroke-width="2">${marks}</g></g></svg><div class="nudge-row">${nudge('x',-3,'Move paper left','←')}${nudge('y',-3,'Move paper up','↑')}${nudge('y',3,'Move paper down','↓')}${nudge('x',3,'Move paper right','→')}</div></div>`;
 } else if(p.id==='weighbill'){
  action='File the matching ticket';body=`<p>Find the ticket that matches both marks on the cooler.</p><div class="rub-sheet"><span>Your pencil rubbing</span><b>K7 &nbsp; / &nbsp; PIER 9</b></div><div class="freight-options">${tickets.map(t=>`<button class="freight-ticket" data-action="work-ticket" data-ticket="${t.id}" aria-pressed="false"><small>PORT AUTHORITY</small><strong>${t.seal}</strong><span>${t.pier}</span><b>${t.time}</b></button>`).join('')}</div>`;
 }else{
  action='Log the reply';body=`<p>The duty roster lists <strong>640 kHz</strong>. Turn the dial until the advocate’s voice comes through, then log the reply.</p><div class="tuning-set"><div class="tuner-strip"><i id="tunerNeedle"></i><span>520</span><span>580</span><span>640</span><span>700</span><span>760</span></div><div class="radio-read"><output id="tunerValue"></output><span>kHz</span><b id="signalRead"></b></div><div class="tune-input">${nudge('dial',-5,'Tune down five kilohertz','−')}<input id="tuner" type="range" min="520" max="760" step="2" value="${p.frequency}" aria-label="Receiver frequency">${nudge('dial',5,'Tune up five kilohertz','+')}</div></div>`;
 }
 return body+`<p class="message" id="workFeedback" role="status"></p><div class="panel-actions"><button class="gold-btn" data-action="work-submit">${action}</button><button class="plain-btn" data-action="back">Return to room</button></div>`;
}
export function paintWork(p,feedback=''){
 const label=document.getElementById('workFeedback');if(!label)return;
 if(p.id==='registration'){document.getElementById('carbonSheet').setAttribute('transform',`translate(${p.x} ${p.y})`);label.textContent=feedback||(solved(p)?'Both registration marks line up.':'Match both pairs of crosses.');}
 else if(p.id==='weighbill'){document.querySelectorAll('[data-ticket]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ticket===p.ticket)));label.textContent=feedback||(p.ticket?'Ticket selected. Check the seal and pier.':'Select one ticket.');}
 else {document.getElementById('tuner').value=p.frequency;document.getElementById('tunerValue').textContent=p.frequency;document.getElementById('tunerNeedle').style.left=((p.frequency-520)/240*100)+'%';document.getElementById('signalRead').textContent=solved(p)?'Voice clear':signal(p)>.70?'Voice breaking through':'Static';label.textContent=feedback||(solved(p)?'“Harbour advocate here. Suite B. Four o’clock. I’ve written it down.”':'Listen for the voice or watch the signal readout.');}
}
