// Small web adaptations of the Android rules, not the full native runtime.
export const colorCount=score=>score>=170&&Math.floor((score-170)/16)%2===0?7:score>=100?6:score>=72?5:score>=40?4:score>=18?3:2;
export function launch(dx,dy){const d=Math.hypot(dx,dy);if(d<14)return null;const speed=Math.min(1,d/150)*790;return {vx:-dx/d*speed,vy:-dy/d*speed};}
export function stepBubble(b,dt){const n={...b,x:b.x+b.vx*dt,y:b.y+b.vy*dt};if(n.y>438&&Math.abs(n.x-200)<46)return {...n,won:true};if(n.x<42){n.x=42;n.vx=Math.abs(n.vx)*.9;}if(n.x>358){n.x=358;n.vx=-Math.abs(n.vx)*.9;}if(n.y<42){n.y=42;n.vy=Math.abs(n.vy)*.9;}if(n.y>438){n.y=438;n.vy=-Math.abs(n.vy)*.9;}const drag=Math.exp(-.36*dt);n.vx*=drag;n.vy*=drag;if(Math.hypot(n.vx,n.vy)<8){n.vx=0;n.vy=0;}return n;}
export function seedFrom(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function random(seed){let a=seed;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function shuffled(a,rng){const v=[...a];for(let i=v.length-1;i>0;i--){const k=Math.floor(rng()*(i+1));[v[i],v[k]]=[v[k],v[i]];}return v;}
