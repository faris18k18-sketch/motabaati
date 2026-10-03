const EDGE_API="https://udfwqegfazlirpbcypda.supabase.co/functions/v1/motabaati2-api";
const SUPABASE_PUBLIC_KEY="sb_publishable_MI31i4XyXeBGW3dEUT47Ig_ZqhY28pO";
var sessionToken=localStorage.getItem("motabaati2_session")||"";
var currentUser=null;
var state={school:{groups:[],records:{}},tahfiz:{groups:[],points:{attendance:{present:20,late:10,absent:0,excused:0},uniform:{full:10,partial:5,none:0},reviewPerPart:15},records:{}}};
var mode='school', activeGroup=null, saveTimer=null;

var days=[['sun','الأحد'],['mon','الاثنين'],['tue','الثلاثاء'],['wed','الأربعاء'],['thu','الخميس']];

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})}
function sundayOf(v){
  var d=v?new Date(v+'T12:00:00'):new Date();
  d.setDate(d.getDate()-d.getDay());
  return d.toISOString().slice(0,10);
}
function weekKey(){return sundayOf(document.getElementById('weekDate').value)}
function ensure(){
  state=state||{};
  state.school=state.school||{groups:[],records:{}};
  state.school.groups=Array.isArray(state.school.groups)?state.school.groups:[];
  state.school.records=state.school.records||{};
  state.tahfiz=state.tahfiz||{groups:[],records:{},points:{}};
  state.tahfiz.groups=Array.isArray(state.tahfiz.groups)?state.tahfiz.groups:[];
  state.tahfiz.records=state.tahfiz.records||{};
  state.tahfiz.criteria=Array.isArray(state.tahfiz.criteria)?state.tahfiz.criteria:[];
  state.tahfiz.points=state.tahfiz.points||{};
  state.tahfiz.points.attendance=Object.assign({present:20,late:10,absent:0,excused:0},state.tahfiz.points.attendance||{});
  state.tahfiz.points.uniform=Object.assign({full:10,partial:5,none:0},state.tahfiz.points.uniform||{});
  if(state.tahfiz.points.reviewPerPart==null)state.tahfiz.points.reviewPerPart=15;
}

async function api(op,payload){
  const r=await fetch(EDGE_API,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLIC_KEY},
    body:JSON.stringify(Object.assign({op:op,token:sessionToken},payload||{}))
  });
  let j={}; try{j=await r.json()}catch{}
  if(!r.ok) throw Object.assign(new Error(j.error||'request_failed'),{status:r.status,data:j});
  return j;
}
function applyRole(){
  const admin=currentUser&&currentUser.role==='admin';
  document.querySelectorAll('.adminOnly').forEach(function(x){x.style.display=admin?'inline-block':'none'});
  schoolTab.style.display=admin?'inline-block':'none';
  if(!admin){mode='tahfiz';schoolTab.classList.remove('active');tahfizTab.classList.add('active')}
  userLabel.textContent=currentUser?(currentUser.username+' — '+(admin?'مدير النظام':'متابع التحفيظ')):'';
  logoutBtn.style.display=currentUser?'inline-block':'none';
}
async function restoreSession(){
  if(!sessionToken){loginModal.classList.add('show');saveStatus.textContent='غير مسجل';return}
  try{
    const j=await api('get_state');
    currentUser={username:j.username,role:j.role};state=j.data;ensure();applyRole();loginModal.classList.remove('show');weekDate.value=sundayOf();saveStatus.textContent='متصل بالسحابة ✓';render();
  }catch(e){
    localStorage.removeItem('motabaati2_session');sessionToken='';currentUser=null;loginModal.classList.add('show');saveStatus.textContent='انتهت الجلسة';
  }
}
async function login(){
  loginError.textContent='';
  const username=loginUser.value.trim();
  const password=loginPass.value;
  try{
    let j;
    try{
      j=await api('login',{username:username,password:password});
    }catch(firstError){
      if(firstError.status===401 && username==='faris_manager' && password==='Mtb@Faris#8264'){
        await api('initialize',{username:username,password:password,setup_code:'MTnp9hB_Wf7sJQZgq1FgX2s4Cvd6_bre'});
        j=await api('login',{username:username,password:password});
      }else{throw firstError}
    }
    sessionToken=j.token;
    localStorage.setItem('motabaati2_session',sessionToken);
    currentUser={username:j.username,role:j.role};
    const s=await api('get_state');
    state=s.data; ensure(); applyRole();
    loginModal.classList.remove('show');
    weekDate.value=sundayOf();
    saveStatus.textContent='متصل بالسحابة ✓';
    render();
  }catch(e){
    console.error(e);
    loginError.textContent=e.status===401?'اسم المستخدم أو كلمة المرور غير صحيحة':'حدث خطأ بعد تسجيل الدخول: '+(e.message||'غير معروف');
  }
}
async function logout(){
  try{await api('logout')}catch{}
  localStorage.removeItem('motabaati2_session');sessionToken='';currentUser=null;state={school:{groups:[],records:{}},tahfiz:{groups:[],records:{},points:{attendance:{present:20,late:10,absent:0,excused:0},uniform:{full:10,partial:5,none:0},reviewPerPart:15}}};content.innerHTML='';groups.innerHTML='';applyRole();loginModal.classList.add('show');saveStatus.textContent='غير مسجل';
}
function scheduleSave(){saveStatus.textContent='حفظ...';clearTimeout(saveTimer);saveTimer=setTimeout(save,500)}
async function save(){try{await api('save_state',{data:state});saveStatus.textContent='تم الحفظ بالسحابة ✓'}catch(e){saveStatus.textContent='فشل الحفظ'}}
function setMode(m){if(currentUser&&currentUser.role!=='admin'&&m==='school')return;mode=m;activeGroup=null;schoolTab.classList.toggle('active',m==='school');tahfizTab.classList.toggle('active',m==='tahfiz');settingsBtn.style.display=m==='tahfiz'?'inline-block':'none';render()}
function groupsArr(){return state[mode].groups}
function getGroup(){var gs=groupsArr();if(!gs.length)return null;if(!activeGroup||!gs.some(function(g){return g.id===activeGroup}))activeGroup=gs[0].id;return gs.find(function(g){return g.id===activeGroup})}
function openAddGroup(){groupName.value='';studentNames.value='';groupModal.classList.add('show')}
function closeModal(id){document.getElementById(id).classList.remove('show')}
function addGroup(){var name=groupName.value.trim();var names=studentNames.value.split(/
|,/).map(function(x){return x.trim()}).filter(Boolean);if(!name)return alert('اكتب اسم الفصل/الحلقة');var g={id:uid(),name:name,students:names.map(function(n){return {id:uid(),name:n}})};groupsArr().push(g);activeGroup=g.id;closeModal('groupModal');scheduleSave();render()}
function deleteGroup(){var g=getGroup();if(!g||!confirm('حذف '+g.name+'؟'))return;state[mode].groups=groupsArr().filter(function(x){return x.id!==g.id});activeGroup=null;scheduleSave();render()}
function addStudents(){var g=getGroup();if(!g)return;var txt=prompt('أدخل أسماء الطلاب، كل اسم في سطر');if(!txt)return;txt.split(/
|,/).map(function(x){return x.trim()}).filter(Boolean).forEach(function(n){g.students.push({id:uid(),name:n})});scheduleSave();render()}
function delStudent(id){var g=getGroup();if(!g||!confirm('حذف الطالب؟'))return;g.students=g.students.filter(function(s){return s.id!==id});scheduleSave();render()}
function recRoot(){var wk=weekKey(),r=state[mode].records;r[wk]=r[wk]||{};var g=getGroup();if(!g)return null;r[wk][g.id]=r[wk][g.id]||{};return r[wk][g.id]}
function rec(sid,day){var root=recRoot();root[sid]=root[sid]||{};root[sid][day]=root[sid][day]||{};return root[sid][day]}
function upd(sid,day,k,v){rec(sid,day)[k]=v;scheduleSave()}
function renderGroups(){groups.innerHTML=groupsArr().map(function(g){return '<button class="'+(g.id===activeGroup?'active':'')+'" onclick="activeGroup=''+g.id+'';render()">'+esc(g.name)+' <span class="badge">'+g.students.length+'</span></button>'}).join('')}
function render(){ensure();var g=getGroup();renderGroups();if(!g){content.innerHTML='<div class="card"><div class="sectionTitle">ابدأ بإضافة '+(mode==='school'?'فصل':'حلقة')+'</div><div class="hint">أضف الطلاب دفعة واحدة، وبعدها تظهر لك المتابعة الأسبوعية من الأحد إلى الخميس.</div></div>';return}if(mode==='school')renderSchool(g);else renderTahfiz(g);document.querySelectorAll('.adminOnlyInline').forEach(function(x){x.style.display=currentUser&&currentUser.role==='admin'?'flex':'none'})}
function opts(arr,val){return arr.map(function(x){return '<option value="'+x[0]+'" '+(x[0]===val?'selected':'')+'>'+x[1]+'</option>'}).join('')}
function renderSchool(g){var root=recRoot(),h='<div class="card"><div class="row" style="justify-content:space-between"><div><div class="sectionTitle">'+esc(g.name)+'</div><div class="hint">متابعة أسبوع '+weekKey()+'</div></div><div class="row noPrint adminOnlyInline"><button onclick="addStudents()">+ طلاب</button><button class="danger" onclick="deleteGroup()">حذف الفصل</button></div></div><div class="massbar noPrint">حدد أكثر من طالب باستخدام مربعات الاختيار ثم استخدم التعديل الجماعي للحضور من خلال زر اليوم.</div><div class="tablewrap"><table><thead><tr><th>اختيار</th><th>الطالب</th>';
days.forEach(function(d){h+='<th>'+d[1]+'<br><button onclick="massAttendance(''+d[0]+'')">حضور جماعي</button></th>'});h+='</tr></thead><tbody>';
g.students.forEach(function(s){h+='<tr><td><input class="pick" type="checkbox" value="'+s.id+'"></td><td class="name">'+esc(s.name)+'<br><button class="danger noPrint" onclick="delStudent(''+s.id+'')">حذف</button></td>';days.forEach(function(d){var r=((root[s.id]||{})[d[0]]||{});h+='<td class="day school-day"><div class="school-inline"><select onchange="upd(''+s.id+'',''+d[0]+'','attendance',this.value)"><option value="">الحضور</option>'+opts([['present','حاضر'],['late','متأخر'],['absent','غائب'],['excused','مستأذن']],r.attendance)+'</select><select onchange="upd(''+s.id+'',''+d[0]+'','participation',this.value)"><option value="">المشاركة</option>'+opts([['3','ممتاز'],['2','جيد'],['1','يحتاج متابعة']],r.participation)+'</select><input class="quranField" placeholder="القرآن: تلاوة/حفظ" value="'+esc(r.quran||'')+'" onchange="upd(''+s.id+'',''+d[0]+'','quran',this.value)"><select onchange="upd(''+s.id+'',''+d[0]+'','behavior',this.value)"><option value="">السلوك والانضباط</option>'+opts([['3','ممتاز'],['2','جيد'],['1','ملاحظة']],r.behavior)+'</select><textarea placeholder="ملاحظات" onchange="upd(''+s.id+'',''+d[0]+'','notes',this.value)">'+esc(r.notes||'')+'</textarea></div></td>'});h+='</tr>'});h+='</tbody></table></div></div>';content.innerHTML=h}
function massAttendance(day){var ids=[].slice.call(document.querySelectorAll('.pick:checked')).map(function(x){return x.value});if(!ids.length)return alert('حدد الطلاب أولًا');var v=prompt('اكتب: present للحاضر، late للمتأخر، absent للغائب، excused للمستأذن','present');if(!v)return;ids.forEach(function(id){rec(id,day).attendance=v});scheduleSave();render()}
