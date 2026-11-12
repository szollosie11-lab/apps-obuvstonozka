// Basic opt-in only: do not load a Google resource, queue events or replay activity before consent.
export function createTracker(env, context) {
  const id='G-CK4WVT66VV', qa=new URL(env.location.href).searchParams.get('qa')==='1';
  let allowed=false,epoch=0; const log=[];
  const permitted=new Set(['preview_observed','preview_start','preview_complete','store_click']);
  function event(name,extra={}) {
    if(!allowed||!permitted.has(name))return false;
    const c=context(), p={game:c.game,ui_language:c.lang,entry_source:c.source,creative:c.creative,...extra};
    if(qa){log.push({name,...p});return true;}
    env.gtag('event',name,{...p,send_to:id,page_location:env.location.origin+'/play/',page_referrer:'',page_title:'Play First preview'});
    return true;
  }
  function grant(){
    if(allowed)return; allowed=true;epoch++;
    if(!qa){
      env['ga-disable-'+id]=false;env.dataLayer=env.dataLayer||[];env.gtag=function(){env.dataLayer.push(arguments);};
      env.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      env.gtag('set','ads_data_redaction',true);env.gtag('set','url_passthrough',false);
      env.gtag('js',new Date());
      env.gtag('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,cookie_domain:'apps.obuvstonozka.eu',cookie_expires:7200,cookie_update:false,page_location:env.location.origin+'/play/',page_referrer:'',page_title:'Play First preview'});
      const script=env.document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+id;env.document.head.append(script);
    }
    event('preview_observed');
  }
  function revoke(){allowed=false;epoch++;if(!qa)env['ga-disable-'+id]=true;}
  return {grant,revoke,event,start(){return event('preview_start')?epoch:0;},complete(token,won){if(token&&token===epoch)event('preview_complete',{outcome:won?'success':'ended'});},get enabled(){return allowed;},get diagnostics(){return {qa,events:log.slice()};}};
}

export async function setupAnalytics(context){
 const words=await fetch('./analytics-i18n.json').then(r=>r.json()),root=document.getElementById('analyticsControls');
 const tracker=createTracker(window,context);let choice=null;try{choice=sessionStorage.getItem('play_analytics_v1');}catch{}
 const qa=tracker.diagnostics.qa;
 function remember(v){try{sessionStorage.setItem('play_analytics_v1',v);}catch{}}
 function render(){const c=context(),w=words[c.lang]||words.en;root.replaceChildren();
  const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('p'),status=document.createElement('p');
  summary.textContent=w[0];body.textContent=w[1];status.textContent=tracker.enabled?w[6]:w[7];status.setAttribute('role','status');
  details.append(summary,body,status);root.append(details);
  const privacy=document.createElement('a');privacy.href='privacy.html?lang='+c.lang;privacy.textContent='Google Analytics · privacy';details.append(privacy);
  if(!tracker.enabled){const label=document.createElement('label'),age=document.createElement('input');age.type='checkbox';age.id='analyticsAdult';label.append(age,document.createTextNode(' '+w[2]));
   const buttons=document.createElement('div');buttons.className='controls';const allow=document.createElement('button'),deny=document.createElement('button');allow.textContent=w[3];deny.textContent=w[4];allow.id='analyticsAllow';deny.id='analyticsDecline';allow.disabled=true;age.onchange=()=>allow.disabled=!age.checked;
   allow.onclick=()=>{if(!age.checked)return;choice='yes';remember('yes');tracker.grant();render();};deny.onclick=()=>{choice='no';remember('no');tracker.revoke();render();};buttons.append(allow,deny);details.append(label,buttons);
  }else{const withdraw=document.createElement('button');withdraw.textContent=w[5];withdraw.id='analyticsWithdraw';withdraw.onclick=()=>{tracker.revoke();remember('no');for(const cookie of document.cookie.split(';')){const name=cookie.split('=')[0].trim();if(/^_ga(?:_|$)/.test(name))for(const domain of ['',location.hostname,'.'+location.hostname])document.cookie=name+'=; Max-Age=0; path=/'+(domain?'; domain='+domain:'');}render();};details.append(withdraw);}
  if(qa){const diag=document.createElement('output');diag.id='analyticsQa';diag.textContent='QA — no data sent to Google';root.append(diag);}
 }
 if(choice==='yes')tracker.grant();render();
 return {...tracker,render,event:(...args)=>{const sent=tracker.event(...args);if(qa)root.dataset.qaEvents=JSON.stringify(tracker.diagnostics.events);return sent;},start:()=>{const token=tracker.start();if(qa)root.dataset.qaEvents=JSON.stringify(tracker.diagnostics.events);return token;},complete:(...args)=>{tracker.complete(...args);if(qa)root.dataset.qaEvents=JSON.stringify(tracker.diagnostics.events);}};
}
