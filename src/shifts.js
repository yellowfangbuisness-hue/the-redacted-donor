// One second of active reconstruction time advances fifteen minutes on the clinic clock.
export const DAY_LENGTH = 96;
export const SHIFT_LENGTH = DAY_LENGTH / 2;
export const isNight = time => time >= SHIFT_LENGTH;
export const untilShift = time => SHIFT_LENGTH - time % SHIFT_LENGTH;
const unit = n => Math.max(0, Math.min(1, n));
function smooth(a,b,n){const t=unit((n-a)/(b-a));return t*t*(3-2*t);}
export function daylight(time){
  const altitude=Math.sin(time/DAY_LENGTH*Math.PI*2);
  return {sun:smooth(-.33,.34,altitude), altitude, twilight:1-smooth(.02,.46,Math.abs(altitude))};
}
export function clockFace(time){
  const minutes=(360+Math.floor(time*1440/DAY_LENGTH))%1440;
  return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
}
export function skyName(time){
  if(time<5||time>93)return 'Dawn';if(time>=43&&time<53)return 'Dusk';return isNight(time)?'Night':'Day';
}
export function passTime(state,seconds){state.solarTime=(state.solarTime+seconds)%DAY_LENGTH;}
export function waitForShift(state){state.solarTime=isNight(state.solarTime)?2:SHIFT_LENGTH+2;}

// Changing daylight adjusts the search radius. Each patrol keeps its own continuous route clock.
export function patrolAt(elapsed,file){
  const period=[26,23,20][file], phase=elapsed%period, arrival=period-11.4, search=arrival+4, leave=search+5.1;
  if(phase<arrival||phase>=leave+2.3)return {phase:'away',offset:1,sweep:0,progress:0};
  if(phase<search){const p=(phase-arrival)/4;return {phase:'approach',offset:-1.06+p*.99,sweep:-.62,progress:p};}
  if(phase<leave){const p=(phase-search)/5.1;return {phase:'search',offset:-.07+Math.sin(p*Math.PI)*.11,sweep:.63*Math.sin(p*Math.PI*2-.8),progress:p};}
  const p=(phase-leave)/2.3;return {phase:'depart',offset:p*1.15,sweep:.60,progress:p};
}
export function patrolRange(night,soles){return (night?3.5:4.0)*(soles?.80:1);}
export const SEARCH_HALF_ANGLE=.67;
export function inSearchBeam(dx,dz,patrol,range){
  if(patrol.phase!=='search'||Math.hypot(dx,dz)>range||dx<=0)return false;
  return Math.abs(Math.atan2(dz,dx)-patrol.sweep)<SEARCH_HALF_ANGLE;
}
