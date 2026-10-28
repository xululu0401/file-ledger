(()=>{'use strict';
const C=AppCore,$=id=>document.getElementById(id),KEY='file-ledger-v1';
let before=null,after=null,report=null,ticket=0,busy=false,side='before',beforeDemo=false,afterDemo=false,demoMode=false;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function say(s,error=false){$('message').textContent=s;$('message').className=error?'error':'';}
function info(m){return m?`${m.files.length} 个文件 · ${m.files.reduce((s,f)=>s+f.size,0).toLocaleString()} 字节`:'等待选择';}
function render(){
 demoMode=beforeDemo||afterDemo; $('beforeInfo').textContent=info(before)+(beforeDemo?' · 演示构造数据':'');$('afterInfo').textContent=info(after)+(afterDemo?' · 演示构造数据':'');$('mode').textContent=demoMode?'含演示数据 · 构造文本':'本地文件 / 清单';$('cancel').hidden=!busy;
 report=before&&after?C.compare(before,after):null;
 $('stats').innerHTML=['未变','修改','新增','移除'].map(s=>`<div class="stat">${s}<b>${report?report.counts[s]:'—'}</b></div>`).join('');
 $('rename').innerHTML=report?.renames.length?'<div class="note">可能改名（候选，不重复计数）：'+report.renames.map(r=>`${esc(r.from)} → ${esc(r.to)}`).join('<br>')+'</div>':'';
 const rows=report?.rows.filter(r=>!$('changes').checked||r.status!=='未变');
 $('files').innerHTML=!report?'<div class="empty">选好两版文件，差异会出现在这里。<br>也可以先点“试用演示”。</div>':!rows.length?'<div class="empty">'+(report.rows.length?'当前筛选下没有变更。':'两个版本均为空。')+'</div>':rows.map(r=>`<article class="file"><span class="tag ${r.status==='未变'?'':'changed'}">${r.status}</span><div><div class="name">${esc(r.name)}</div><details><summary>查看完整指纹</summary><p>基线</p><code>${r.old?.sha256||'不存在'}</code><p>当前</p><code>${r.now?.sha256||'不存在'}</code></details></div><div class="size">基线 ${r.old?r.old.size.toLocaleString()+' B':'—'}<br>当前 ${r.now?r.now.size.toLocaleString()+' B':'—'}</div></article>`).join('');
 for(const id of ['csv','md','png','save'])$(id).disabled=busy||!report;
 $('jsonBefore').disabled=busy||!before;for(const id of ['jsonAfter','promote'])$(id).disabled=busy||!after;
}
function put(target,m){if(target==='before'){before=m;beforeDemo=false;}else{after=m;afterDemo=false;}}
function invalidate(){ticket++;busy=false;}
async function readFiles(files,target){const token=++ticket;busy=true;render();try{
 C.checkFiles(files);const out=[];
 for(let i=0;i<files.length;i++){say(`正在读取 ${i+1}/${files.length}：${files[i].name}`);const f=files[i],buffer=await f.arrayBuffer();if(token!==ticket)return;const sha256=await C.digest(buffer);if(token!==ticket)return;out.push({name:f.name,size:f.size,sha256});}
 if(token!==ticket)return;put(target,C.manifest(out));say('读取完成。旧结果已由本次文件替换。');
 }catch(e){if(token===ticket)say('读取失败：'+e.message+'。已保留上次有效结果。',true);}finally{if(token===ticket){busy=false;render();}}}
for(const [id,target] of [['pickBefore','before'],['pickAfter','after']])$(id).onclick=()=>{side=target;$('filesInput').value='';$('filesInput').click();};
$('filesInput').onchange=e=>{if(e.target.files.length)readFiles(Array.from(e.target.files),side);};
for(const [id,target] of [['importBefore','before'],['importAfter','after']])$(id).onclick=()=>{side=target;$('manifestInput').value='';$('manifestInput').click();};
$('manifestInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;const target=side,token=++ticket;busy=true;render();try{if(file.size>C.LIMIT.json)throw Error('清单JSON超过128 KiB');const text=await file.text();if(token!==ticket)return;put(target,C.parse(text));say('清单已导入；仅核对摘要，未读取原始文件。');}catch(err){if(token===ticket)say('导入失败：'+err.message+'。已保留上次有效结果。',true);}finally{if(token===ticket){busy=false;render();}}};
for(const [id,target] of [['emptyBefore','before'],['emptyAfter','after']])$(id).onclick=()=>{invalidate();put(target,C.manifest([]));say('已设置空版本。');render();};
$('cancel').onclick=()=>{invalidate();say('已取消本次读取，保留上次有效结果。');render();};
$('reset').onclick=()=>{invalidate();before=after=null;beforeDemo=afterDemo=false;$('changes').checked=false;say('工作区已清空。本机保存记录不受影响。');render();};
$('changes').onchange=render;
$('demo').onclick=async()=>{const token=++ticket;busy=true;render();try{const make=async obj=>C.manifest(await Promise.all(Object.entries(obj).map(async([name,text])=>{const bytes=new TextEncoder().encode(text);return {name,size:bytes.length,sha256:await C.digest(bytes)};})));const a=await make({'说明.txt':'hello','配置.json':'{"v":1}','旧标题.txt':'abc','废稿.txt':'old'}),b=await make({'说明.txt':'hello','配置.json':'{"v":2}','新标题.txt':'abc','交付.txt':'ready'});if(token!==ticket)return;before=a;after=b;beforeDemo=afterDemo=true;say('演示：配置修改，旧标题与新标题内容相同；另有一份废稿移除、一份交付文件新增。');}catch(e){if(token===ticket)say('演示加载失败：'+e.message,true);}finally{if(token===ticket){busy=false;render();}}};
function download(name,content,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('jsonBefore').onclick=()=>download('基线清单.json',JSON.stringify(before,null,2),'application/json');
$('jsonAfter').onclick=()=>download('当前清单.json',JSON.stringify(after,null,2),'application/json');
$('csv').onclick=()=>download('文件差异.csv',C.csv(report),'text/csv;charset=utf-8');
$('md').onclick=()=>{const cell=s=>String(s??'—').replace(/[\\`*_{}\[\]()#+.!<>|]/g,'\\$&');download('文件差异.md','# 文件对照台\n\n'+(demoMode?'演示数据（构造文本）\n\n':'')+'按文件名、字节数和SHA-256比较。清单不证明作者、版权或时间。\n\n| 状态 | 文件名 | 基线字节 | 当前字节 |\n|---|---|---:|---:|\n'+report.rows.map(r=>`|${r.status}|${cell(r.name)}|${r.old?.size??'—'}|${r.now?.size??'—'}|`).join('\n')+'\n\n可能改名（仍计入新增/移除）：\n'+(report.renames.map(r=>'- '+cell(r.from)+' → '+cell(r.to)).join('\n')||'无唯一匹配候选')+'\n','text/markdown;charset=utf-8');};
$('png').onclick=()=>{const c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');x.fillStyle='#f4f3ed';x.fillRect(0,0,1080,1350);x.fillStyle='#12685d';x.font='22px sans-serif';x.fillText('FILE LEDGER / VERSION CHECK',70,90);x.fillStyle='#192f33';x.font='bold 64px sans-serif';x.fillText('文件对照台',70,195);x.font='28px sans-serif';x.fillText(demoMode?'含演示数据 · 构造文本':'本地文件 / 清单对照',70,255);const colors=['#e4ece7','#f5e5ca','#dceee9','#ece5e2'];['未变','修改','新增','移除'].forEach((s,i)=>{const px=70+(i%2)*480,py=320+Math.floor(i/2)*235;x.fillStyle=colors[i];x.fillRect(px,py,450,205);x.fillStyle='#192f33';x.font='28px sans-serif';x.fillText(s,px+30,py+50);x.font='bold 76px sans-serif';x.fillText(String(report.counts[s]),px+30,py+150);});x.font='27px sans-serif';x.fillText(`基线 ${before.files.length} 个文件 · 当前 ${after.files.length} 个文件`,70,865);x.fillText(`可能改名 ${report.renames.length} 对（仍计入新增 / 移除）`,70,925);x.fillStyle='#556b70';x.font='25px sans-serif';['比较文件名、字节数与 SHA-256 指纹。','不证明原创、版权、作者身份或创建时间。','本卡仅含数量；逐文件明细请查看 CSV / Markdown。'].forEach((s,i)=>x.fillText(s,70,1040+i*48));x.fillStyle='#12685d';x.fillRect(70,1220,940,3);x.font='22px sans-serif';x.fillText('本地计算 · 文件内容不上传',70,1280);c.toBlob(blob=>{if(blob)download('文件对照摘要.png',blob,'image/png');else say('图片导出失败，请重试。',true);});};
$('promote').onclick=()=>{before=C.validate(after);beforeDemo=afterDemo;say('当前版已设为基线。下一次选择当前文件即可继续核对。');render();};
$('save').onclick=()=>{try{localStorage.setItem(KEY,JSON.stringify({before,after,beforeDemo,afterDemo}));$('storage').textContent='已保存本次快照（文件名、大小和摘要）；后续修改需再次保存。';say('已保存到本机，不含文件内容。');}catch{say('浏览器不允许保存或空间不足，请导出JSON清单。',true);}};
$('forget').onclick=()=>{try{localStorage.removeItem(KEY);$('storage').textContent='本机记录已清除，当前工作区仍可继续使用。';say('本机记录已清除。');}catch{say('无法访问本机存储。',true);}};
try{const saved=localStorage.getItem(KEY);if(saved){const obj=JSON.parse(saved);const a=C.validate(obj.before),b=C.validate(obj.after);before=a;after=b;beforeDemo=obj.beforeDemo===true;afterDemo=obj.afterDemo===true;$('storage').textContent='已恢复本机快照；原文件内容没有保存。';}}catch{say('本机记录不可用，请重新选择文件或导入清单。',true);}render();
})();
