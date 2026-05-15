const $ = s => document.querySelector(s);

const DEFAULT_CONFIG = {
  SUPABASE_URL: "https://wfqnckfxbsunbnhonk.supabase.co",
  SUPABASE_ANON_KEY: "",
  GOOGLE_SHEETS_WEBHOOK_URL: "",
  BRAND_NAME: "2FLY Payment Verification Hub",
  GCASH_ACCOUNTS: [
    { id:"gcash_1", label:"GCash 1", accountName:"Lorna Diaz", accountNumber:"0912 669 9412" },
    { id:"gcash_2", label:"GCash 2", accountName:"Account Name 2", accountNumber:"09XX XXX XXXX" },
    { id:"gcash_3", label:"GCash 3", accountName:"Account Name 3", accountNumber:"09XX XXX XXXX" }
  ]
};

let supabaseClient, currentUser, currentProfile;

function getConfig(){
  const saved = localStorage.getItem("2fly_payment_hub_config");
  return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
}
function saveConfig(cfg){ localStorage.setItem("2fly_payment_hub_config", JSON.stringify(cfg)); }
function isConfigured(){
  const cfg = getConfig();
  return cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("PASTE");
}
function requireSetup(){
  if(!isConfigured()){
    window.location.href = "setup.html";
    return false;
  }
  return true;
}
function money(v){
  return new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",maximumFractionDigits:2}).format(Number(v||0));
}
function localDT(v){
  if(!v) return "—";
  return new Date(v).toLocaleString("en-PH",{year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function today(){ return new Date().toISOString().slice(0,10); }
function notice(id,msg,type=""){
  const el = document.getElementById(id);
  if(!el) return;
  el.className = `notice ${type}`.trim();
  el.textContent = msg;
  el.hidden = !msg;
}
function init(){
  if(!requireSetup()) return null;
  const cfg = getConfig();
  supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  return supabaseClient;
}
async function requireAuth(){
  init();
  const {data,error} = await supabaseClient.auth.getUser();
  if(error || !data.user){ window.location.href="login.html"; return null; }
  currentUser = data.user;
  const {data:profile} = await supabaseClient.from("profiles").select("*").eq("id", currentUser.id).single();
  currentProfile = profile || { id: currentUser.id, email: currentUser.email, full_name: currentUser.email, role:"admin" };
  const label = $("#userLabel");
  if(label) label.textContent = `${currentProfile.full_name || currentUser.email} • ${currentProfile.role || "admin"}`;
  return currentUser;
}
async function logout(){ await supabaseClient.auth.signOut(); window.location.href="login.html"; }
window.logout = logout;

function paymentLabel(v){
  const cfg = getConfig();
  const found = cfg.GCASH_ACCOUNTS.find(a=>a.id===v);
  if(found) return `${found.label} — ${found.accountName}`;
  return ({cash:"Cash",bank_transfer:"Bank Transfer",other:"Other"}[v]) || v || "—";
}
function fillMethods(selectId="paymentMethod"){
  const el = document.getElementById(selectId);
  if(!el) return;
  const cfg = getConfig();
  el.innerHTML = `<option value="">Select payment method</option>` +
    cfg.GCASH_ACCOUNTS.map(a=>`<option value="${a.id}">${a.label} — ${a.accountName} — ${a.accountNumber}</option>`).join("") +
    `<option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="other">Other</option>`;
}
function fillFilterMethods(id="paymentMethodFilter"){
  const el = document.getElementById(id);
  if(!el) return;
  const cfg = getConfig();
  el.innerHTML = `<option value="all">All Methods</option>` +
    cfg.GCASH_ACCOUNTS.map(a=>`<option value="${a.id}">${a.label}</option>`).join("") +
    `<option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="other">Other</option>`;
}
function esc(s){return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function pill(status){return `<span class="pill ${status}">${String(status||"pending").replace("_"," ").toUpperCase()}</span>`}

async function setupPage(){
  const cfg = getConfig();
  $("#supabaseUrl").value = cfg.SUPABASE_URL || "";
  $("#anonKey").value = cfg.SUPABASE_ANON_KEY || "";
  $("#sheetsUrl").value = cfg.GOOGLE_SHEETS_WEBHOOK_URL || "";
  $("#gcash1Name").value = cfg.GCASH_ACCOUNTS[0]?.accountName || "";
  $("#gcash1Number").value = cfg.GCASH_ACCOUNTS[0]?.accountNumber || "";
  $("#gcash2Name").value = cfg.GCASH_ACCOUNTS[1]?.accountName || "";
  $("#gcash2Number").value = cfg.GCASH_ACCOUNTS[1]?.accountNumber || "";
  $("#gcash3Name").value = cfg.GCASH_ACCOUNTS[2]?.accountName || "";
  $("#gcash3Number").value = cfg.GCASH_ACCOUNTS[2]?.accountNumber || "";

  $("#setupForm").addEventListener("submit", e=>{
    e.preventDefault();
    const newCfg = {
      ...DEFAULT_CONFIG,
      SUPABASE_URL: $("#supabaseUrl").value.trim().replace(/\/rest\/v1\/?$/,"").replace(/\/$/,""),
      SUPABASE_ANON_KEY: $("#anonKey").value.trim(),
      GOOGLE_SHEETS_WEBHOOK_URL: $("#sheetsUrl").value.trim(),
      GCASH_ACCOUNTS: [
        {id:"gcash_1", label:"GCash 1", accountName:$("#gcash1Name").value.trim(), accountNumber:$("#gcash1Number").value.trim()},
        {id:"gcash_2", label:"GCash 2", accountName:$("#gcash2Name").value.trim(), accountNumber:$("#gcash2Number").value.trim()},
        {id:"gcash_3", label:"GCash 3", accountName:$("#gcash3Name").value.trim(), accountNumber:$("#gcash3Number").value.trim()}
      ]
    };
    saveConfig(newCfg);
    notice("setupNotice","Saved. Going to login page...","good");
    setTimeout(()=>window.location.href="login.html",700);
  });
}

async function loginPage(){
  if(!requireSetup()) return;
  init();
  $("#loginForm").addEventListener("submit", async e=>{
    e.preventDefault();
    notice("loginNotice","Logging in...","");
    const email = e.target.email.value.trim();
    const password = e.target.password.value;
    const {error} = await supabaseClient.auth.signInWithPassword({email,password});
    if(error){ notice("loginNotice", error.message || "Login failed.", "bad"); return; }
    window.location.href="admin.html";
  });
}

async function uploadProof(file, order, ref){
  if(!file) return null;
  const safe = x => String(x||"file").replace(/[^a-zA-Z0-9_-]/g,"-");
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${today()}/${safe(order)}-${safe(ref)}-${Date.now()}.${ext}`;
  const {error} = await supabaseClient.storage.from("payment-proofs").upload(path,file,{cacheControl:"3600",upsert:false});
  if(error) throw error;
  return supabaseClient.storage.from("payment-proofs").getPublicUrl(path).data.publicUrl;
}
async function duplicateRef(ref){
  if(!ref) return null;
  const {data} = await supabaseClient.from("payments").select("id,order_id,status,amount").eq("reference_number",ref).limit(1);
  return data && data[0] ? data[0] : null;
}
async function submitPage(){
  await requireAuth(); fillMethods();
  $("#paymentForm").addEventListener("submit", async e=>{
    e.preventDefault();
    const f=e.target;
    notice("formNotice","Uploading...","");
    try{
      const order_id=f.order_id.value.trim();
      if(!order_id){notice("formNotice","Order ID is required. For walk-in use WALKIN-YYYYMMDD-001.","bad");return;}
      const ref=f.reference_number.value.trim();
      let status="pending";
      let notes=f.notes.value.trim() || null;
      const dup = await duplicateRef(ref);
      if(dup){ status="duplicate"; notes=`[AUTO DUPLICATE WARNING] Possible duplicate of ${dup.order_id}. ${notes||""}`.trim(); }
      const proof = await uploadProof(f.proof.files[0], order_id, ref);
      const payload={
        order_id, customer_name:f.customer_name.value.trim() || "Walk-in Customer",
        customer_type:f.customer_type.value, payment_method:f.payment_method.value,
        amount:Number(f.amount.value||0), reference_number:ref || null, proof_image_url:proof,
        status, notes, submitted_by:currentUser.id
      };
      const {error}=await supabaseClient.from("payments").insert(payload);
      if(error) throw error;
      f.reset(); fillMethods();
      notice("formNotice", status==="duplicate" ? "Uploaded but marked as DUPLICATE." : "Payment uploaded successfully.","good");
    }catch(err){notice("formNotice",err.message||"Upload failed.","bad")}
  });
}

async function fetchPayments(filters={}){
  let q=supabaseClient.from("payments").select("*").order("created_at",{ascending:false}).limit(500);
  if(filters.status && filters.status!=="all") q=q.eq("status",filters.status);
  if(filters.customer_type && filters.customer_type!=="all") q=q.eq("customer_type",filters.customer_type);
  if(filters.payment_method && filters.payment_method!=="all") q=q.eq("payment_method",filters.payment_method);
  if(filters.date){q=q.gte("created_at",`${filters.date}T00:00:00`).lte("created_at",`${filters.date}T23:59:59`)}
  if(filters.search){const s=filters.search.trim();if(s)q=q.or(`order_id.ilike.%${s}%,customer_name.ilike.%${s}%,reference_number.ilike.%${s}%`)}
  const {data,error}=await q; if(error) throw error; return data||[];
}
function summarize(list){
  const verified=list.filter(p=>p.status==="verified");
  const sum=a=>a.reduce((t,p)=>t+Number(p.amount||0),0);
  const byMethod={}, byType={};
  verified.forEach(p=>{byMethod[p.payment_method]=(byMethod[p.payment_method]||0)+Number(p.amount||0);byType[p.customer_type]=(byType[p.customer_type]||0)+Number(p.amount||0)});
  return {total:sum(verified),verified:verified.length,pending:list.filter(p=>p.status==="pending").length,review:list.filter(p=>p.status==="needs_review").length,byMethod,byType};
}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v}
function renderMetrics(s){
  setText("metricTotal",money(s.total)); setText("metricVerified",s.verified); setText("metricPending",s.pending); setText("metricReview",s.review);
  setText("metricOnline",money(s.byType.online||0)); setText("metricWalkin",money(s.byType.walkin||0));
  setText("metricGcash1",money(s.byMethod.gcash_1||0)); setText("metricGcash2",money(s.byMethod.gcash_2||0)); setText("metricGcash3",money(s.byMethod.gcash_3||0)); setText("metricCash",money(s.byMethod.cash||0));
}
function renderCards(list){
  const mount=$("#paymentList"); if(!mount)return;
  if(!list.length){mount.innerHTML=`<div class="empty">No payments found.</div>`;return;}
  mount.innerHTML=list.map(p=>`<div class="payment">
    <div class="payment-top"><div><div class="title">${esc(p.order_id)}</div><div class="helper">${esc(p.customer_name)} • ${localDT(p.created_at)}</div>
    <div class="meta">${pill(p.status)}<span class="pill">${String(p.customer_type).toUpperCase()}</span><span class="pill">${paymentLabel(p.payment_method)}</span><span class="pill">${money(p.amount)}</span><span class="pill">REF: ${esc(p.reference_number||"—")}</span></div></div>
    <button class="btn secondary small" onclick="openModal('${p.id}')">View</button></div>
    ${p.notes?`<div class="notice">${esc(p.notes)}</div>`:""}
    <div class="actions"><button class="btn good small" onclick="updateStatus('${p.id}','verified')">Verify</button><button class="btn warn small" onclick="updateStatus('${p.id}','needs_review')">Needs Review</button><button class="btn bad small" onclick="updateStatus('${p.id}','rejected')">Reject</button>${currentProfile?.role==="owner"?`<button class="btn bad small" onclick="deletePayment('${p.id}')">Delete</button>`:""}</div>
  </div>`).join("");
}
async function openModal(id){
  const {data,error}=await supabaseClient.from("payments").select("*").eq("id",id).single();
  if(error){alert(error.message);return;}
  $("#modalContent").innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px"><div><h2>${esc(data.order_id)}</h2><p>${esc(data.customer_name)} • ${localDT(data.created_at)}</p></div><button class="btn secondary small" onclick="closeModal()">Close</button></div>
  <div class="grid two"><div class="metric"><div class="metric-label">Amount</div><div class="metric-value">${money(data.amount)}</div></div><div class="metric"><div class="metric-label">Status</div><div class="metric-value">${String(data.status).replace("_"," ")}</div></div></div>
  <div class="meta"><span class="pill">${paymentLabel(data.payment_method)}</span><span class="pill">REF: ${esc(data.reference_number||"—")}</span></div>
  ${data.notes?`<div class="notice">${esc(data.notes)}</div>`:""}
  ${data.proof_image_url?`<a href="${data.proof_image_url}" target="_blank"><img class="proof" src="${data.proof_image_url}"></a>`:`<div class="empty">No proof uploaded.</div>`}
  <div class="actions"><button class="btn good" onclick="updateStatus('${data.id}','verified')">Verify / Good to Go</button><button class="btn warn" onclick="updateStatus('${data.id}','needs_review')">Needs Review</button><button class="btn bad" onclick="updateStatus('${data.id}','rejected')">Reject</button></div>`;
  $("#modal").classList.add("show");
}
function closeModal(){ $("#modal")?.classList.remove("show"); }
window.openModal=openModal; window.closeModal=closeModal;
async function updateStatus(id,status){
  try{
    const payload={status,updated_at:new Date().toISOString()};
    if(status==="verified"){payload.verified_by=currentUser.id;payload.verified_at=new Date().toISOString();}
    const {data,error}=await supabaseClient.from("payments").update(payload).eq("id",id).select().single();
    if(error)throw error;
    if(status==="verified") await syncSheets(data);
    closeModal(); if(window.loadAdmin) await window.loadAdmin(); if(window.loadReports) await window.loadReports();
  }catch(err){alert(err.message)}
}
window.updateStatus=updateStatus;
async function deletePayment(id){
  if(currentProfile?.role!=="owner"){alert("Only owner can delete.");return;}
  if(!confirm("Delete payment?"))return;
  const {error}=await supabaseClient.from("payments").delete().eq("id",id);
  if(error){alert(error.message);return;}
  closeModal(); if(window.loadAdmin) await window.loadAdmin();
}
window.deletePayment=deletePayment;

async function syncSheets(p){
  const cfg=getConfig(); if(!cfg.GOOGLE_SHEETS_WEBHOOK_URL)return;
  const payload={payment:{...p,payment_method:paymentLabel(p.payment_method),verified_by:currentProfile?.full_name||currentUser?.email||""}};
  try{await fetch(cfg.GOOGLE_SHEETS_WEBHOOK_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})}catch(e){console.warn(e)}
}

async function adminPage(){
  await requireAuth(); fillFilterMethods();
  window.loadAdmin=async()=>{
    const list=await fetchPayments({status:$("#statusFilter").value,customer_type:$("#typeFilter").value,payment_method:$("#paymentMethodFilter").value,search:$("#searchInput").value});
    renderMetrics(summarize(list)); renderCards(list);
  };
  ["statusFilter","typeFilter","paymentMethodFilter"].forEach(id=>document.getElementById(id).addEventListener("change",window.loadAdmin));
  $("#searchInput").addEventListener("input",()=>setTimeout(window.loadAdmin,250));
  await window.loadAdmin();
}
function renderRows(list){
  const body=$("#reportRows"); if(!list.length){body.innerHTML=`<tr><td colspan="9">No records.</td></tr>`;return;}
  body.innerHTML=list.map(p=>`<tr><td>${localDT(p.created_at)}</td><td>${esc(p.order_id)}</td><td>${esc(p.customer_name)}</td><td>${String(p.customer_type).toUpperCase()}</td><td>${paymentLabel(p.payment_method)}</td><td>${money(p.amount)}</td><td>${esc(p.reference_number||"—")}</td><td>${String(p.status).replace("_"," ").toUpperCase()}</td><td>${p.proof_image_url?`<a href="${p.proof_image_url}" target="_blank">View</a>`:"—"}</td></tr>`).join("");
}
async function reportsPage(){
  await requireAuth(); fillFilterMethods(); $("#reportDate").value=today();
  window.loadReports=async()=>{
    const list=await fetchPayments({date:$("#reportDate").value,customer_type:$("#typeFilter").value,payment_method:$("#paymentMethodFilter").value,status:"all"});
    renderMetrics(summarize(list)); renderRows(list);
  };
  ["reportDate","typeFilter","paymentMethodFilter"].forEach(id=>document.getElementById(id).addEventListener("change",window.loadReports));
  await window.loadReports();
}

document.addEventListener("DOMContentLoaded", async()=>{
  const page=document.body.dataset.page;
  try{
    if(page==="setup") await setupPage();
    if(page==="login") await loginPage();
    if(page==="submit") await submitPage();
    if(page==="admin") await adminPage();
    if(page==="reports") await reportsPage();
  }catch(err){console.error(err); alert(err.message || "Something went wrong.");}
});
