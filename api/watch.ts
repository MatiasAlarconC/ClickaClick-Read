import type { VercelRequest, VercelResponse } from '@vercel/node'

// Standalone Apple Watch companion page.
// Returns self-contained HTML — no React bundle, no large JS deps.
// Supabase JS loaded from CDN so the tiny WatchOS WebKit can handle it.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>ClickaClick</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{background:#0d0d0d;color:#fff;font-family:system-ui,-apple-system,sans-serif;
  min-height:100dvh;display:flex;align-items:center;justify-content:center;
  padding:max(16px,env(safe-area-inset-top)) 14px max(16px,env(safe-area-inset-bottom))}
#app{width:100%;max-width:220px;display:flex;flex-direction:column;gap:10px}
input{width:100%;padding:12px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.12);
  border-radius:12px;color:#fff;font-size:15px;outline:none}
input[type=number]{font-size:26px;text-align:center;font-family:Georgia,serif}
.btn{width:100%;padding:14px;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
.btn-primary{background:#fff;color:#000}
.btn-danger{background:rgba(239,68,68,.18);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
.btn-ghost{background:transparent;color:rgba(255,255,255,.45);border:1px solid rgba(255,255,255,.12)}
.btn-pause{background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,.12)}
.row{display:flex;gap:8px}.row .btn{flex:1;padding:13px 8px}
.timer{font-size:52px;font-weight:800;letter-spacing:-2px;text-align:center;
  font-variant-numeric:tabular-nums;color:#22c55e;line-height:1}
.timer.paused{color:rgba(255,255,255,.4)}
.label{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.45)}
.muted{color:rgba(255,255,255,.45);font-size:12px}
.err{color:#ef4444;font-size:12px;text-align:center}
.bbook{width:100%;padding:10px 0;background:transparent;border:none;
  border-bottom:1px solid rgba(255,255,255,.08);cursor:pointer;text-align:left;
  display:flex;align-items:center;gap:10px}
.bbook:last-child{border-bottom:none}
.bt{font-size:13px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ba{font-size:11px;color:rgba(255,255,255,.45);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
</style>
</head>
<body>
<div id="app"><div class="muted" style="text-align:center">…</div></div>
<script>
const {createClient}=window.supabase
const sb=createClient('${SUPABASE_URL}','${SUPABASE_KEY}',{auth:{persistSession:true,autoRefreshToken:true}})

let _books=[]
let _secs=0,_acc=0,_start=0,_phase='running',_book=null,_timer=null

function el(id){return document.getElementById(id)}
function app(html){document.getElementById('app').innerHTML=html}
function pad(n){return String(n).padStart(2,'0')}
function fmt(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return h>0?pad(h)+':'+pad(m)+':'+pad(ss):pad(m)+':'+pad(ss)}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

async function init(){
  try{await sb.auth.refreshSession()}catch(e){}
  const {data:{session}}=await sb.auth.getSession()
  if(!session){showSignIn();return}
  await loadBook(session.user.id)
}

function showSignIn(err){
  app(\`
    <div style="font-family:Georgia,serif;font-size:18px;text-align:center;margin-bottom:8px">ClickaClick</div>
    \${err?'<div class="err">'+esc(err)+'</div>':''}
    <input id="em" type="email" placeholder="Email" autocomplete="username">
    <input id="pw" type="password" placeholder="Contraseña" autocomplete="current-password">
    <button class="btn btn-primary" onclick="doSignIn()">Entrar</button>
  \`)
}

async function doSignIn(){
  const email=el('em')?.value||'',pass=el('pw')?.value||''
  if(!email||!pass)return
  app('<div class="muted" style="text-align:center">…</div>')
  const{data,error}=await sb.auth.signInWithPassword({email,password:pass})
  if(error){showSignIn(error.message);return}
  await loadBook(data.user.id)
}

async function loadBook(uid){
  app('<div class="muted" style="text-align:center">…</div>')
  const{data:sess}=await sb.from('reading_sessions').select('book_id').eq('user_id',uid).order('started_at',{ascending:false}).limit(1)
  const bid=sess?.[0]?.book_id
  const q=sb.from('user_books').select('id,book_id,current_page,book:books(title,author,cover_url)').eq('user_id',uid).eq('status','reading')
  const{data}=bid?await q.eq('book_id',bid).maybeSingle():await q.order('added_at',{ascending:false}).limit(1).maybeSingle()
  if(!data){await showPicker(uid);return}
  _book=data;showSession()
}

async function showPicker(uid){
  const{data:books}=await sb.from('user_books').select('id,book_id,current_page,book:books(title,author)').eq('user_id',uid).eq('status','reading').order('added_at',{ascending:false}).limit(8)
  _books=books||[]
  if(!_books.length){app('<div class="muted" style="text-align:center;line-height:1.7">No tenés libros en progreso.<br>Agregá uno desde la app.</div>');return}
  app('<div class="label" style="margin-bottom:12px">¿Qué estás leyendo?</div>'+
    _books.map((b,i)=>'<button class="bbook" onclick="pickBook('+i+')"><div style="flex:1;min-width:0"><div class="bt">'+esc(b.book?.title||'Libro')+'</div><div class="ba">'+esc(b.book?.author||'')+'</div></div></button>').join(''))
}

function pickBook(i){_book=_books[i];showSession()}

function showSession(){
  const title=_book?.book?.title||'Libro'
  const short=title.length>22?title.slice(0,20)+'…':title
  _phase='running';_secs=0;_acc=0
  app(\`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <div style="flex:1;font-size:11px;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${esc(short)}</div>
      <button style="width:26px;height:26px;border-radius:50%;background:#1a1a1a;border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.45);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center" onclick="cancelSession()">×</button>
    </div>
    <div class="timer" id="tmr">00:00</div>
    <div class="row">
      <button class="btn btn-pause" id="pbtn" onclick="togglePause()">Pausa</button>
      <button class="btn btn-danger" onclick="endSession()">Terminar</button>
    </div>
  \`)
  startTick()
}

function startTick(){
  _start=Date.now()
  _timer=setInterval(()=>{
    _secs=_acc+Math.floor((Date.now()-_start)/1000)
    const e=el('tmr');if(e)e.textContent=fmt(_secs)
  },1000)
}
function stopTick(){clearInterval(_timer);_acc+=Math.floor((Date.now()-_start)/1000)}

function togglePause(){
  if(_phase==='running'){
    stopTick();_phase='paused'
    const t=el('tmr');if(t)t.className='timer paused'
    const b=el('pbtn');if(b){b.textContent='Continuar';b.style.color='#22c55e';b.style.borderColor='#22c55e'}
  }else{
    _phase='running'
    const t=el('tmr');if(t)t.className='timer'
    const b=el('pbtn');if(b){b.textContent='Pausa';b.style.color='';b.style.borderColor=''}
    startTick()
  }
}

function endSession(){
  if(_phase==='running')stopTick()
  _phase='ending'
  const cur=_book?.current_page||0
  app(\`
    <div class="muted" style="text-align:center">\${fmt(_secs)}</div>
    <div class="muted" style="text-align:center;margin-top:4px">¿En qué página quedaste?</div>
    <input type="number" id="pgi" value="\${cur}" inputmode="numeric" min="\${cur}">
    <button class="btn btn-primary" onclick="saveSession()">Guardar sesión</button>
    <button class="btn btn-ghost" onclick="showSession()">Volver</button>
  \`)
}

async function saveSession(){
  app('<div class="muted" style="text-align:center">Guardando…</div>')
  try{await sb.auth.refreshSession()}catch(e){}
  const{data:{session}}=await sb.auth.getSession()
  if(!session){showSignIn('Sesión expirada');return}
  const b=_book,cur=b?.current_page||0
  const ep=parseInt(el('pgi')?.value||'0')||cur
  const now=Date.now()
  await sb.from('reading_sessions').insert({
    user_id:session.user.id,book_id:b.book_id,
    started_at:new Date(now-_secs*1000).toISOString(),
    ended_at:new Date(now).toISOString(),
    duration_seconds:_secs,
    start_page:cur,end_page:ep,pages_read:Math.max(0,ep-cur)
  })
  if(ep!==cur)await sb.from('user_books').update({current_page:ep}).eq('id',b.id)
  app(\`
    <svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:0 auto">
      <circle cx="24" cy="24" r="22" stroke="#22c55e" stroke-width="2.5" fill="none"/>
      <path d="M14 24l8 8 13-13" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <div style="font-family:Georgia,serif;font-size:16px;text-align:center">Sesión guardada</div>
    <div class="muted" style="text-align:center">\${fmt(_secs)}</div>
    <button class="btn btn-ghost" style="margin-top:8px" onclick="init()">Nueva sesión</button>
  \`)
}

function cancelSession(){
  clearInterval(_timer);_book=null
  sb.auth.getSession().then(({data:{session}})=>{
    if(session)loadBook(session.user.id);else showSignIn()
  })
}

window.doSignIn=doSignIn
window.pickBook=pickBook
window.showSession=showSession
window.togglePause=togglePause
window.endSession=endSession
window.saveSession=saveSession
window.cancelSession=cancelSession
window.init=init

init()
</script>
</body>
</html>`)
}
