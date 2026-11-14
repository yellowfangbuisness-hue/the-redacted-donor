import {cases,leads,supplies} from './casebook.js';
import {DAY_LENGTH,SHIFT_LENGTH,isNight} from './shifts.js';
const stages=['contract','street','detective','memory','lock','recoverKey','closet','verify','board','gate','glass','radio','strip','end','gameOver'];
export function fresh(){return {version:2,stage:'contract',caseIndex:0,beat:0,coercion:'',confiscated:false,pounds:0,hp:100,score:0,soles:false,luminol:false,uv:false,overdrive:false,gates:[false,false],gateStep:'',hasWatch:false,solarTime:12,powder:0,found:[],awards:[],exhibits:[],links:[],guardTime:0,strip:0,loss:null,checkpoint:{exhibits:[],links:[]},stats:{seconds:0,caught:0,spent:0,items:[]},filed:false,codes:[],alarm:0};}
export function readRun(raw){
  try{const s=JSON.parse(raw);if(!s||![1,2].includes(s.version)||!stages.includes(s.stage)||!Number.isInteger(s.caseIndex)||!cases[s.caseIndex]||!['found','awards','exhibits','links'].every(k=>Array.isArray(s[k]))||!Array.isArray(s.checkpoint?.exhibits)||!Array.isArray(s.checkpoint?.links))return null;
    if(s.version===1){
      s.hasWatch=Boolean(s.ownedVisor);s.solarTime=(s.dark?SHIFT_LENGTH:0)+(30-Math.max(0,Math.min(30,Number(s.clock)||30)))*SHIFT_LENGTH/30;
      // Closed files retain their outcomes. An unpinned board lead can still be corroborated in the present.
      for(const i of s.links){if(cases[i]){addExhibits(s,cases[i].exhibitId);if(s.checkpoint.links.includes(i)&&!s.checkpoint.exhibits.includes(cases[i].exhibitId))s.checkpoint.exhibits.push(cases[i].exhibitId);}}
      if(s.stage==='board'&&!s.links.includes(s.caseIndex))s.stage='verify';
      delete s.dark;delete s.clock;delete s.ownedVisor;s.version=2;
    }
    s.found=s.found.filter(id=>cases[s.caseIndex].tasks.includes(id));
    return Object.assign(fresh(),s,{solarTime:((Number(s.solarTime)||0)%DAY_LENGTH+DAY_LENGTH)%DAY_LENGTH,hp:s.stage==='gameOver'?0:Math.max(1,Math.min(100,Number(s.hp)||100)),score:Math.trunc(Number(s.score)||0)});
  }catch{return null;}
}
export function grant(s,key,points){if(s.awards.includes(key))return 0;s.awards.push(key);s.score+=points;return points;}
export function addExhibits(s,...ids){for(const id of ids)if(!s.exhibits.includes(id))s.exhibits.push(id);}
export function startCase(s,i){s.caseIndex=i;s.stage='detective';s.found=[];s.alarm=0;s.benchWatched=false;s.powder=0;s.guardTime=0;s.solarTime=[12,55,62][i];s.loss=null;s.checkpoint={exhibits:[...s.exhibits],links:[...s.links]};}
export function loseCase(s,cause){if(s.stage==='gameOver')return;s.hp=0;s.loss={cause,steps:s.found.length,score:s.score};s.stats={...fresh().stats,...s.stats};s.stats.caught++;s.score-=50;s.stage='gameOver';}
export function revive(s){if(s.stage!=='gameOver')return;s.hp=100;s.exhibits=[...s.checkpoint.exhibits];s.links=[...s.checkpoint.links];startCase(s,s.caseIndex);}
export function readyTasks(s){return cases[s.caseIndex].tasks.filter(id=>!s.found.includes(id)&&(leads[id].after||[]).every(req=>s.found.includes(req)));}
export function memoryTasks(s){const shift=isNight(s.solarTime)?'night':'day';return readyTasks(s).filter(id=>leads[id].shift==='any'||leads[id].shift===shift);}
export function record(s,id){if(s.stage!=='memory'||!memoryTasks(s).includes(id))return null;
  s.found.push(id);let points=0,bonus=false;
  if(leads[id].shift==='night'){bonus=s.solarTime-SHIFT_LENGTH<8&&!s.awards.includes(id);points=grant(s,id,100+(bonus?50:0));}
  else if(['cache','secureKey','plant'].includes(id))points=grant(s,id,150);
  else if(['registration','weighbill','channel'].includes(id))points=grant(s,id,100);
  const complete=cases[s.caseIndex].tasks.every(v=>s.found.includes(v));
  if(complete){s.powder=0;s.stage=['lock','recoverKey','verify'][s.caseIndex];if(!s.caseIndex)addExhibits(s,1);else if(s.caseIndex===1)addExhibits(s,3,4);else addExhibits(s,6,7);}
  return {points,bonus,complete};
}
export function verifyLead(s,id){const c=cases[s.caseIndex];if(s.stage!=='verify'||c.verify!==id)return false;addExhibits(s,c.exhibitId);grant(s,id,75);s.stage='board';return true;}
export function canBuy(s,id){const item=supplies.find(v=>v.id===id);if(!item||s.score<item.cost||!s.hasWatch)return false;if(id==='salts')return s.hp<100;if(['soles','luminol','uv','overdrive'].includes(id))return !s[id];return s.stage==='memory'&&s.powder<=0;}
export function buy(s,id){if(!canBuy(s,id))return false;const cost=supplies.find(v=>v.id===id).cost;s.score-=cost;s.stats={...fresh().stats,...s.stats};s.stats.spent+=cost;s.stats.items=[...s.stats.items,id].slice(-20);if(id==='salts')s.hp=Math.min(100,s.hp+34);if(id==='powder')s.powder=30;if(['soles','luminol','uv','overdrive'].includes(id))s[id]=true;return true;}
export function stageTargets(s){if(s.stage==='memory'){const tasks=memoryTasks(s);return tasks.length?tasks:['rest'];}const id=({street:s.pounds<3?'street':'watch',detective:'desk',lock:'lock',recoverKey:'key',closet:'closet',verify:cases[s.caseIndex].verify,board:'board',gate:s.gateStep,glass:'glassCase',radio:'radio',strip:'street'})[s.stage];return id?[id]:[];}
export const verbs={...Object.fromEntries(Object.entries(leads).map(([id,l])=>[id,l.action])),street:'Pound on the glass',watch:'Take the pocket watch',desk:'Examine the document',lock:'Work the brass dials',key:'Reach under the pipe',closet:'Unlock the supply closet',board:'Connect the evidence',radio:'Tune the ham radio',terminal:'Report the lure ads and secure the records',keypad:'Spray the keypad with luminol',shredder:'Copy the forged consent form and hold the surgery',glassCase:'Smash the emergency glass',rest:'Wait for the next shift',verifyOffer:'Compare the agency stamps',verifyFreight:'Check the gate ticket against the tag',verifySignal:'Recover the advocate’s call log'};
export function objective(s){switch(s.stage){
  case 'contract':return 'Answer the recruiter';case 'street':return s.pounds<3?'Pound on the street window':'Pick up the pocket watch';case 'detective':return 'Examine the '+cases[s.caseIndex].document.replace(/\b[A-Z][a-z]/g,m=>m.toLowerCase());case 'memory':{const next=memoryTasks(s)[0];return next?verbs[next]:`Wait for ${isNight(s.solarTime)?'daylight':'nightfall'} at the staff bench`;}
  case 'lock':return 'Open the drawer with Mateo’s file number';case 'recoverKey':return 'Crouch and retrieve the key';case 'closet':return 'Unlock the medical supply closet';case 'verify':return verbs[cases[s.caseIndex].verify];case 'board':return 'Link the case to its lead';case 'gate':return verbs[s.gateStep]||'';case 'glass':return 'Smash the emergency glass for the dispatch key';case 'radio':return 'Tune the ham radio to the rescue team';case 'strip':return 'Peel the tint off the street window';default:return '';}}
