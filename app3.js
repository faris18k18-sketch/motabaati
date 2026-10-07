// Reliability and faster daily recording.
var pendingSave=false, savingNow=false, changeVersion=0, selectedStudents=new Set();
var defaultTheme={brand:'#1f6f5f',bg:'#f6f7fb',card:'#ffffff',ink:'#172033'};
var quickNotes=['أحسنت، استمر على هذا المستوى','تحسّن في الطلاقة','يحتاج إلى ضبط الغنن','يحتاج إلى مراجعة المحفوظ','مشاركة مميزة','يحتاج إلى تحسين الانضباط'];
function localKey(kind){return 'motabaati3_'+kind+'_'+(currentUser?currentUser.username:'guest')}
function cachePending(){
  try{localStorage.setItem(localKey('pending'),JSON.stringify({data:state,at:Date.now()}));return true}
  catch(e){saveStatus.textContent='تعذر حفظ نسخة محلية — اضغط إعادة الحفظ';return false}
}
function recoverPending(){
  if(!currentUser)return;
  try{
    var raw=localStorage.getItem(localKey('pending'));
    if(raw&&confirm('توجد تعديلات على هذا الجهاز لم يُؤكد حفظها بالسحابة. هل تريد استعادتها؟')){
      var saved=JSON.parse(raw);if(validBackup(saved.data)){state=saved.data;ensure();scheduleSave()}
    }else if(raw){localStorage.removeItem(localKey('pending'))}
  }catch(e){saveStatus.textContent='تعذر استعادة التعديلات المحلية'}
}
scheduleSave=function(){
  if(!currentUser)return;
  pendingSave=true;changeVersion++;cachePending();
  saveStatus.textContent='تعديلات محفوظة محليًا — جارٍ الحفظ…';
  clearTimeout(saveTimer);saveTimer=setTimeout(save,500);
};
save=async function(){
  if(!currentUser||savingNow||!pendingSave)return;
  clearTimeout(saveTimer);savingNow=true;
  var version=changeVersion, snapshot=JSON.parse(JSON.stringify(state));
  try{
    await api('save_state',{data:snapshot});
    if(version===changeVersion){
      pendingSave=false;
      try{localStorage.removeItem(localKey('pending'));localStorage.setItem(localKey('backup'),JSON.stringify({data:snapshot,at:Date.now()}))}catch(e){}
      saveStatus.textContent='تم الحفظ بالسحابة ✓';
    }
  }catch(e){saveStatus.textContent='لم يُحفظ بالسحابة — إعادة الحفظ';}
  finally{savingNow=false;if(pendingSave&&version!==changeVersion){saveTimer=setTimeout(save,100)}}
};
saveStatus.tabIndex=0;saveStatus.title='اضغط لإعادة حفظ التعديلات';saveStatus.onclick=function(){save()};
saveStatus.onkeydown=function(e){if(e.key==='Enter'||e.key===' ')save()};
window.addEventListener('online',function(){if(pendingSave)save()});
window.addEventListener('pagehide',function(){if(pendingSave)cachePending()});
window.addEventListener('beforeunload',function(e){if(pendingSave){cachePending();e.preventDefault();e.returnValue=''}});
var originalLogout=logout;
logout=async function(){
  if(savingNow)return alert('انتظر اكتمال الحفظ ثم سجل الخروج.');
  if(pendingSave){await save();if(pendingSave)return alert('تعذر الحفظ بالسحابة. أعد الحفظ أو صدّر نسخة احتياطية قبل الخروج.')}
  clearTimeout(saveTimer);selectedStudents.clear();await originalLogout();
};
var originalRender=render;
render=function(){
  var oldWrap=content.querySelector('.tablewrap'),left=oldWrap?oldWrap.scrollLeft:0,top=oldWrap?oldWrap.scrollTop:0;
  var scope=mode+'|'+activeGroup+'|'+weekKey();
  if(render.lastScope!==scope)selectedStudents.clear();
  originalRender();render.lastScope=mode+'|'+activeGroup+'|'+weekKey();
  var table=content.querySelector('table'),g=getGroup();if(!table||!g)return;
  var head=table.querySelector('thead tr');
  if(!head.querySelector('.selectionHead')){
    if(mode==='tahfiz'){
      head.insertAdjacentHTML('afterbegin','<th class="selectionHead noPrint">اختيار</th>');
      table.querySelectorAll('tbody tr').forEach(function(row,i){
        row.insertAdjacentHTML('afterbegin','<td class="noPrint"><input type="checkbox" class="pick" aria-label="اختيار الطالب" value="'+esc(g.students[i].id)+'"></td>');
      });
    }else head.firstElementChild.classList.add('selectionHead');
  }
  content.querySelectorAll('.pick').forEach(function(el){el.checked=selectedStudents.has(el.value);el.onchange=function(){if(el.checked)selectedStudents.add(el.value);else selectedStudents.delete(el.value);updatePickCount()}});
  var oldBar=content.querySelector('.massbar');if(oldBar)oldBar.remove();
  var bar=document.createElement('div');bar.className='massbar noPrint row';
  bar.innerHTML='<button onclick="pickAll(true)">تحديد الكل</button><button onclick="pickAll(false)">إلغاء التحديد</button><span id="pickCount"></span><button class="primary" onclick="openBulk()">رصد جماعي</button>';
  table.closest('.tablewrap').before(bar);updatePickCount();
  content.querySelectorAll('textarea[data-sid]').forEach(function(el){
    var button=document.createElement('button');button.type='button';button.className='noPrint quickNoteButton';button.textContent='ملاحظة جاهزة';
    button.onclick=function(){openQuickNote(el)};el.after(button);
    el.oninput=function(){upd(el.dataset.sid,el.dataset.day,'notes',el.value)};
  });
  content.querySelectorAll('input[data-sid]:not([type=checkbox])').forEach(function(el){
    el.oninput=function(){if(el.dataset.cid)updCustom(el.dataset.sid,el.dataset.day,el.dataset.cid,el.value);else upd(el.dataset.sid,el.dataset.day,el.classList.contains('quranField')?'quran':el.classList.contains('reviewParts')?'reviewParts':'reviewText',el.value);if(mode==='tahfiz')updateTahfizPoints(el.dataset.sid)};
  });
  var wrap=content.querySelector('.tablewrap');wrap.scrollLeft=left;wrap.scrollTop=top;
};
function updatePickCount(){var el=document.getElementById('pickCount');if(el)el.textContent='المحدد: '+selectedStudents.size}
function pickAll(pick){selectedStudents.clear();if(pick)getGroup().students.forEach(function(s){selectedStudents.add(s.id)});content.querySelectorAll('.pick').forEach(function(el){el.checked=pick});updatePickCount()}
massAttendance=function(day){openBulk(day,'attendance')};
function featureModal(title,html){
  var el=document.getElementById('featureModal');
  if(!el){el=document.createElement('div');el.id='featureModal';el.className='modal';document.body.append(el)}
  el.innerHTML='<div class="modalbox"><div class="sectionTitle">'+esc(title)+'</div>'+html+'<div class="row" style="margin-top:14px"><button onclick="closeModal(\'featureModal\')">إغلاق</button></div></div>';el.classList.add('show');
}
function bulkFields(){
  return mode==='school'?[['attendance','الحضور'],['participation','المشاركة'],['behavior','السلوك والانضباط'],['quran','القرآن: تلاوة / حفظ'],['notes','ملاحظات']]:
    [['attendance','الحضور'],['uniform','الزي'],['reviewText','المراجعة اليومية'],['reviewParts','عدد أجزاء المراجعة'],['notes','ملاحظات']].concat((state.tahfiz.criteria||[]).map(function(c){return ['custom:'+c.id,c.name+' — عدد الصفحات']}));
}
function openBulk(day,field){
  if(!selectedStudents.size)return alert('حدد الطلاب أولًا.');
  featureModal('الرصد الجماعي','<div class="hint">سيُطبق على '+selectedStudents.size+' طالبًا في الفصل الحالي، للأسبوع '+esc(weekKey())+'.</div><div class="grid"><label>اليوم<select id="bulkDay">'+opts(days,day||days[0][0])+'</select></label><label>البند<select id="bulkField" onchange="renderBulkValue()">'+opts(bulkFields(),field||'attendance')+'</select></label></div><div id="bulkValueBox" style="margin:12px 0"></div><button class="primary" onclick="applyBulk()">تطبيق على المحددين</button>');
  renderBulkValue();
}
function renderBulkValue(){
  var field=document.getElementById('bulkField').value,values=null;
  if(field==='attendance')values=[['present','حاضر'],['late','متأخر'],['absent','غائب'],['excused','مستأذن']];
  if(field==='uniform')values=[['full','كامل'],['partial','ناقص'],['none','غير ملتزم']];
  if(field==='participation')values=[['3','ممتاز'],['2','جيد'],['1','يحتاج متابعة']];
  if(field==='behavior')values=[['3','ممتاز'],['2','جيد'],['1','ملاحظة']];
  var numeric=field==='reviewParts'||field.indexOf('custom:')===0;
  document.getElementById('bulkValueBox').innerHTML=values?'<select id="bulkValue">'+opts(values,values[0][0])+'</select>':'<label>القيمة <input id="bulkValue" '+(numeric?'type="number" min="0" step="'+(field==='reviewParts'?'0.25':'0.5')+'"':'type="text"')+'></label>'+(field==='notes'?'<div class="row" style="margin-top:8px">'+quickNotes.map(function(n,i){return '<button data-note="'+i+'" onclick="document.getElementById(\'bulkValue\').value=quickNotes[Number(this.dataset.note)]">'+esc(n)+'</button>'}).join('')+'<label><input type="checkbox" id="appendBulkNote" checked> إضافة إلى الملاحظات الحالية</label></div>':'');
}
function applyBulk(){
  var day=document.getElementById('bulkDay').value,field=document.getElementById('bulkField').value,value=document.getElementById('bulkValue').value;
  if(!days.some(function(d){return d[0]===day})||!bulkFields().some(function(f){return f[0]===field}))return;
  if(field==='reviewParts'||field.indexOf('custom:')===0){var n=Number(value),step=field==='reviewParts'?0.25:0.5;if(value===''||!Number.isFinite(n)||n<0||(field.indexOf('custom:')===0&&n<0.5)||Math.abs(n/step-Math.round(n/step))>0.00001)return alert('أدخل مقدارًا صالحًا؛ الحد الأدنى للبند نصف صفحة.')}
  if(value==='')return alert('أدخل القيمة أولًا.');
  var ids=getGroup().students.filter(function(s){return selectedStudents.has(s.id)}).map(function(s){return s.id});
  ids.forEach(function(id){var r=rec(id,day);if(field.indexOf('custom:')===0){r.custom=r.custom||{};r.custom[field.slice(7)]=value}else if(field==='notes'&&document.getElementById('appendBulkNote').checked){r.notes=[r.notes,value].filter(Boolean).join('\n')}else r[field]=value});
  scheduleSave();closeModal('featureModal');render();
}
function openQuickNote(target){
  featureModal('اختر ملاحظة جاهزة','<div id="quickNotesList" class="grid"></div>');
  quickNotes.forEach(function(note){var button=document.createElement('button');button.textContent=note;button.onclick=function(){target.value=[target.value,note].filter(Boolean).join('\n');upd(target.dataset.sid,target.dataset.day,'notes',target.value);closeModal('featureModal')};document.getElementById('quickNotesList').append(button)});
}
function validBackup(data){
  if(!data||typeof data!=='object')return false;
  return ['school','tahfiz'].every(function(k){var section=data[k];return section&&Array.isArray(section.groups)&&section.records&&typeof section.records==='object'&&!Array.isArray(section.records)&&section.groups.every(function(g){return g&&typeof g.id==='string'&&typeof g.name==='string'&&Array.isArray(g.students)&&g.students.every(function(s){return s&&typeof s.id==='string'&&typeof s.name==='string'})})});
}
exportBackup=function(){
  if(!currentUser)return;
  var backup={format:'motabaati',version:3,exportedAt:new Date().toISOString(),data:state,theme:readTheme()};
  var b=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download='motabaati-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},1000);
};
importBackup=function(ev){
  if(!currentUser||currentUser.role!=='admin'){ev.target.value='';return alert('استعادة النسخ متاحة لمدير النظام فقط.')}
  var f=ev.target.files[0];if(!f)return;
  var reader=new FileReader();reader.onload=function(){
    try{var parsed=JSON.parse(reader.result),data=parsed.format==='motabaati'?parsed.data:parsed;
      if(!validBackup(data))throw Error('invalid');
      if(!confirm('ستستبدل النسخة بيانات المدرسة والتحفيظ الحالية. هل تريد المتابعة؟'))return;
      try{localStorage.setItem(localKey('beforeImport'),JSON.stringify({data:state,at:Date.now()}))}catch(e){exportBackup()}
      state=data;ensure();activeGroup=null;selectedStudents.clear();if(parsed.theme)storeTheme(parsed.theme);scheduleSave();render();
    }catch(e){alert('الملف غير صالح لنسخة متابعتي. لم يتم تغيير البيانات.')}
    finally{ev.target.value=''}
  };reader.onerror=function(){alert('تعذر قراءة الملف');ev.target.value=''};reader.readAsText(f);
};
function restoreLocalBackup(){
  if(!currentUser||currentUser.role!=='admin')return;
  try{var raw=localStorage.getItem(localKey('beforeImport'))||localStorage.getItem(localKey('backup'));if(!raw)return alert('لا توجد نسخة محلية سابقة على هذا الجهاز.');
    var saved=JSON.parse(raw);if(!validBackup(saved.data))throw Error('invalid');
    if(confirm('استعادة النسخة المحلية بتاريخ '+new Date(saved.at).toLocaleString('ar-SA')+' واستبدال البيانات الحالية؟')){state=saved.data;ensure();scheduleSave();render()}
  }catch(e){alert('تعذر استعادة النسخة المحلية.')}
}
function readTheme(){try{return Object.assign({},defaultTheme,JSON.parse(localStorage.getItem('motabaati3_theme')||'{}'))}catch(e){return Object.assign({},defaultTheme)}}
function applyTheme(theme){
  Object.keys(defaultTheme).forEach(function(k){var color=theme[k];if(/^#[0-9a-f]{6}$/i.test(color))document.documentElement.style.setProperty('--'+k,color)});
  var brand=theme.brand||defaultTheme.brand,r=parseInt(brand.slice(1,3),16),g=parseInt(brand.slice(3,5),16),b=parseInt(brand.slice(5,7),16);
  document.documentElement.style.setProperty('--brand-text',(r*299+g*587+b*114)/1000>155?'#172033':'#ffffff');
}
function storeTheme(theme){var clean={};Object.keys(defaultTheme).forEach(function(k){clean[k]=/^#[0-9a-f]{6}$/i.test(theme[k])?theme[k]:defaultTheme[k]});try{localStorage.setItem('motabaati3_theme',JSON.stringify(clean))}catch(e){}applyTheme(clean)}
function openColors(){
  var theme=readTheme(),labels={brand:'اللون الرئيسي والأزرار',bg:'خلفية الصفحة',card:'البطاقات والجداول',ink:'النصوص'};
  featureModal('ألوان الصفحة','<div class="hint">تُحفظ الألوان على هذا الجهاز وتظهر فورًا عند اختيارها.</div><div class="grid" style="margin:12px 0">'+Object.keys(defaultTheme).map(function(k){return '<label class="setting">'+labels[k]+'<input type="color" data-color="'+k+'" value="'+theme[k]+'" oninput="changeColor(this.dataset.color,this.value)"></label>'}).join('')+'</div><button onclick="storeTheme(defaultTheme);openColors()">استعادة الألوان الأصلية</button>');
}
function changeColor(key,value){var theme=readTheme();theme[key]=value;storeTheme(theme)}
applyTheme(readTheme());
document.querySelector('.toolbar').insertAdjacentHTML('beforeend','<button onclick="openColors()">ألوان الصفحة</button><button class="adminOnly" onclick="restoreLocalBackup()">استعادة نسخة محلية</button>');
