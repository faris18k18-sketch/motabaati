function tahfizPoints(r){
  var p=state.tahfiz.points||{attendance:{},uniform:{},reviewPerPart:0,custom:{}},
      a=(p.attendance||{})[r.attendance]||0,
      u=(p.uniform||{})[r.uniform]||0,
      rv=(parseFloat(r.reviewParts)||0)*(parseFloat(p.reviewPerPart)||0),
      customTotal=0,
      customVals=r.custom||{};
  (state.tahfiz.criteria||[]).forEach(function(c){if(customVals[c.id]==='yes')customTotal+=Number((p.custom||{})[c.id]||0)});
  return a+u+rv+customTotal
}
function updCustom(sid,day,id,v){var r=rec(sid,day);r.custom=r.custom||{};r.custom[id]=v;scheduleSave()}
function renderTahfiz(g){
  var root=recRoot(),
      isAdmin=currentUser&&currentUser.role==='admin',
      hint=isAdmin?'النقاط تحسب تلقائيًا حسب إعداداتك':'متابعة الحضور والزي والمراجعة اليومية',
      h='<div class="card"><div class="row" style="justify-content:space-between"><div><div class="sectionTitle">'+esc(g.name)+'</div><div class="hint">'+hint+'</div></div><div class="row noPrint adminOnlyInline"><button onclick="addStudents()">+ طلاب</button><button class="danger" onclick="deleteGroup()">حذف الحلقة</button></div></div><div class="tablewrap"><table><thead><tr><th>الطالب</th>';
  days.forEach(function(d){h+='<th>'+d[1]+'</th>'});
  if(isAdmin)h+='<th>مجموع الأسبوع</th>';
  h+='</tr></thead><tbody>';
  g.students.forEach(function(s){
    var total=0;
    h+='<tr><td class="name">'+esc(s.name)+'<br><button class="danger noPrint adminOnlyInline" data-id="'+esc(s.id)+'" onclick="delStudent(this.dataset.id)">حذف</button></td>';
    days.forEach(function(d){
      var r=((root[s.id]||{})[d[0]]||{}),pts=isAdmin?tahfizPoints(r):0;
      if(isAdmin)total+=pts;
      var attrs=' data-sid="'+esc(s.id)+'" data-day="'+d[0]+'"';
      h+='<td class="day tahfiz-day"><div class="tahfiz-inline">'
        +'<select'+attrs+' onchange="upd(this.dataset.sid,this.dataset.day,\'attendance\',this.value);'+(isAdmin?'render()':'')+'"><option value="">الحضور</option>'
        +opts([['present','حاضر'],['late','متأخر'],['absent','غائب'],['excused','مستأذن']],r.attendance)
        +'</select>'
        +'<select'+attrs+' onchange="upd(this.dataset.sid,this.dataset.day,\'uniform\',this.value);'+(isAdmin?'render()':'')+'"><option value="">الزي</option>'
        +opts([['full','كامل'],['partial','ناقص'],['none','غير ملتزم']],r.uniform)
        +'</select>'
        +'<input class="reviewText"'+attrs+' placeholder="المراجعة اليومية" value="'+esc(r.reviewText||'')+'" onchange="upd(this.dataset.sid,this.dataset.day,\'reviewText\',this.value)">'
        +'<input class="reviewParts"'+attrs+' type="number" min="0" step="0.25" placeholder="عدد الأجزاء" value="'+esc(r.reviewParts||'')+'" onchange="upd(this.dataset.sid,this.dataset.day,\'reviewParts\',this.value);'+(isAdmin?'render()':'')+'">'
        +(state.tahfiz.criteria||[]).map(function(c){
          var cv=(r.custom||{})[c.id]||'';
          return '<select'+attrs+' data-cid="'+esc(c.id)+'" title="'+esc(c.name)+'" onchange="updCustom(this.dataset.sid,this.dataset.day,this.dataset.cid,this.value);'+(isAdmin?'render()':'')+'"><option value="">'+esc(c.name)+'</option><option value="yes" '+(cv==='yes'?'selected':'')+'>تم</option><option value="no" '+(cv==='no'?'selected':'')+'>لم يتم</option></select>'
        }).join('')
        +'<textarea'+attrs+' placeholder="ملاحظات" onchange="upd(this.dataset.sid,this.dataset.day,\'notes\',this.value)">'+esc(r.notes||'')+'</textarea>'
        +(isAdmin?'<div class="badge">نقاط اليوم: '+pts+'</div>':'')
        +'</div></td>';
    });
    if(isAdmin)h+='<td><b>'+total+'</b></td>';
    h+='</tr>';
  });
  h+='</tbody></table></div></div>';
  content.innerHTML=h;
}
function openSettings(){
  var p=state.tahfiz.points||{},items=[['حضور: حاضر','attendance','present'],['حضور: متأخر','attendance','late'],['حضور: غائب','attendance','absent'],['حضور: مستأذن','attendance','excused'],['الزي: كامل','uniform','full'],['الزي: ناقص','uniform','partial'],['الزي: غير ملتزم','uniform','none']],h='';
  p.custom=p.custom||{};
  items.forEach(function(x){
    h+='<div class="setting"><span>'+x[0]+'</span><input type="number" data-a="'+x[1]+'" data-b="'+x[2]+'" value="'+p[x[1]][x[2]]+'" onchange="setPoint(this.dataset.a,this.dataset.b,this.value)"></div>'
  });
  h+='<div class="setting"><span>النقاط لكل جزء مراجعة</span><input type="number" value="'+p.reviewPerPart+'" onchange="state.tahfiz.points.reviewPerPart=Number(this.value);scheduleSave();render()"></div>';
  h+='<div style="grid-column:1/-1;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:4px"><div class="sectionTitle" style="font-size:15px">بنود إضافية للتحفيظ</div><div class="row"><input id="newCriterionName" placeholder="اسم البند مثل: الانضباط" style="flex:1"><input id="newCriterionPoints" type="number" min="0" placeholder="النقاط" style="width:110px"><button class="primary" onclick="addTahfizCriterion()">+ إضافة بند</button></div><div id="criteriaList" style="margin-top:10px"></div></div>';
  settingsGrid.innerHTML=h;renderCriteriaList();settingsModal.classList.add('show')
}
function renderCriteriaList(){
  var el=document.getElementById('criteriaList');if(!el)return;
  var p=state.tahfiz.points||{};p.custom=p.custom||{};
  var arr=state.tahfiz.criteria||[];
  el.innerHTML=arr.length?arr.map(function(c){
    return '<div class="setting"><span><b>'+esc(c.name)+'</b><div class="hint">يظهر للعضو بدون نقاط</div></span><span class="row"><input type="number" min="0" data-id="'+esc(c.id)+'" value="'+Number(p.custom[c.id]||0)+'" onchange="setCustomPoint(this.dataset.id,this.value)"><button class="danger" data-id="'+esc(c.id)+'" onclick="removeTahfizCriterion(this.dataset.id)">حذف</button></span></div>'
  }).join(''):'<div class="hint">لا توجد بنود إضافية.</div>'
}
function setCustomPoint(id,v){state.tahfiz.points.custom=state.tahfiz.points.custom||{};state.tahfiz.points.custom[id]=Number(v);scheduleSave();render()}
function addTahfizCriterion(){
  var n=document.getElementById('newCriterionName').value.trim(),
      v=Number(document.getElementById('newCriterionPoints').value||0);
  if(!n)return alert('اكتب اسم البند');
  var id=uid();
  state.tahfiz.criteria=state.tahfiz.criteria||[];
  state.tahfiz.criteria.push({id:id,name:n});
  state.tahfiz.points=state.tahfiz.points||{};
  state.tahfiz.points.custom=state.tahfiz.points.custom||{};
  state.tahfiz.points.custom[id]=v;
  document.getElementById('newCriterionName').value='';
  document.getElementById('newCriterionPoints').value='';
  scheduleSave();renderCriteriaList();render()
}
function removeTahfizCriterion(id){
  if(!confirm('حذف هذا البند؟'))return;
  state.tahfiz.criteria=(state.tahfiz.criteria||[]).filter(function(c){return c.id!==id});
  if(state.tahfiz.points&&state.tahfiz.points.custom)delete state.tahfiz.points.custom[id];
  scheduleSave();renderCriteriaList();render()
}
function setPoint(a,b,v){state.tahfiz.points[a][b]=Number(v);scheduleSave();render()}
function showReport(){
  var g=getGroup();if(!g)return;
  var root=recRoot(),isAdmin=currentUser&&currentUser.role==='admin',rows=[];
  g.students.forEach(function(s){
    var present=0,absent=0,total=0,notes=[];
    days.forEach(function(d){
      var r=((root[s.id]||{})[d[0]]||{});
      if(r.attendance==='present')present++;
      if(r.attendance==='absent')absent++;
      if(mode==='tahfiz'&&isAdmin)total+=tahfizPoints(r);
      if(r.notes)notes.push(d[1]+': '+r.notes)
    });
    rows.push({name:s.name,present:present,absent:absent,total:total,notes:notes.join(' | ')})
  });
  var h='<div class="kpis"><div class="kpi"><div class="hint">الفصل/الحلقة</div><b>'+esc(g.name)+'</b></div><div class="kpi"><div class="hint">عدد الطلاب</div><b>'+g.students.length+'</b></div><div class="kpi"><div class="hint">الأسبوع</div><b>'+weekKey()+'</b></div></div><div class="tablewrap" style="margin-top:12px"><table style="min-width:700px"><thead><tr><th>الطالب</th><th>حضور</th><th>غياب</th>'+(mode==='tahfiz'&&isAdmin?'<th>النقاط</th>':'')+'<th>ملاحظات</th></tr></thead><tbody>';
  rows.forEach(function(r){
    h+='<tr><td>'+esc(r.name)+'</td><td>'+r.present+'</td><td>'+r.absent+'</td>'+(mode==='tahfiz'&&isAdmin?'<td>'+r.total+'</td>':'')+'<td>'+esc(r.notes)+'</td></tr>'
  });
  h+='</tbody></table></div>';
  reportBody.innerHTML=h;reportModal.classList.add('show')
}
async function openMembers(){
  if(!currentUser||currentUser.role!=='admin')return;
  membersModal.classList.add('show');memberMsg.textContent='';await loadMembers();
}
async function loadMembers(){
  try{
    const j=await api('list_members'),ms=j.members||[];
    if(!ms.length){membersList.innerHTML='<div class="hint">لا يوجد أعضاء حتى الآن.</div>';return}
    membersList.innerHTML=ms.map(function(m){
      const active=m.is_active;
      return '<div class="setting" style="margin-bottom:8px"><div><b>'+esc(m.username)+'</b><div class="hint">متابع التحفيظ فقط — '+(active?'نشط':'موقوف')+'</div></div><button class="'+(active?'danger':'primary')+'" data-id="'+esc(m.id)+'" data-active="'+(!active)+'" onclick="toggleMember(this.dataset.id,this.dataset.active===\'true\')">'+(active?'إيقاف':'تفعيل')+'</button></div>'
    }).join('');
  }catch(e){membersList.innerHTML='<div style="color:#b42318">تعذر تحميل الأعضاء.</div>'}
}
async function createMember(){
  memberMsg.textContent='';
  const username=newMemberUser.value.trim(),password=newMemberPass.value;
  if(username.length<3||password.length<8){memberMsg.textContent='اسم المستخدم 3 أحرف فأكثر، وكلمة المرور 8 أحرف فأكثر.';return}
  try{
    await api('create_member',{username:username,password:password});
    memberMsg.textContent='تم إنشاء العضو بنجاح. صلاحياته: التحفيظ فقط.';
    newMemberUser.value='';newMemberPass.value='';await loadMembers();
  }catch(e){
    memberMsg.textContent=e.data&&e.data.error==='username_exists'?'اسم المستخدم مستخدم مسبقًا.':'تعذر إنشاء العضو.'
  }
}
async function toggleMember(id,active){try{await api('set_member_active',{user_id:id,active:active});await loadMembers()}catch(e){alert('تعذر تعديل العضو')}}
function openPassword(){newPassword.value='';passwordMsg.textContent='';passwordModal.classList.add('show')}
async function changePassword(){
  const password=newPassword.value;
  if(password.length<8){passwordMsg.textContent='كلمة المرور يجب أن تكون 8 أحرف فأكثر.';return}
  try{await api('change_password',{password:password});passwordMsg.textContent='تم تغيير كلمة المرور.';newPassword.value=''}catch(e){passwordMsg.textContent='تعذر تغيير كلمة المرور.'}
}
function exportBackup(){
  var b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download='motabaati-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href)
}
function importBackup(ev){
  var f=ev.target.files[0];if(!f)return;var r=new FileReader();
  r.onload=function(){try{state=JSON.parse(r.result);ensure();scheduleSave();render();alert('تم استيراد النسخة')}catch{alert('الملف غير صالح')}};
  r.readAsText(f)
}
restoreSession();