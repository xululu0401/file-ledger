(function(root){
'use strict';
const LIMIT={count:100,file:25*1048576,total:100*1048576,json:131072};
function checkFiles(files){
 if(!Array.isArray(files)||files.length>LIMIT.count)throw Error('每版最多100个文件');
 const seen=new Set(); let total=0;
 for(const f of files){
  if(!f||typeof f.name!=='string'||!f.name.trim()||f.name.length>120||/[\\/\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/u.test(f.name))throw Error('文件名须为1–120字符，不含路径或控制字符');
  if(seen.has(f.name))throw Error('同一版不能有重复文件名：'+f.name); seen.add(f.name);
  if(!Number.isSafeInteger(f.size)||f.size<0||f.size>LIMIT.file)throw Error('单文件须不超过25 MiB'); total+=f.size;
 } if(total>LIMIT.total)throw Error('每版文件总量须不超过100 MiB'); return total;
}
function validate(m){
 if(!m||m.format!=='file-ledger'||m.version!==1||m.algorithm!=='SHA-256')throw Error('不是文件对照台 v1 / SHA-256 清单');
 checkFiles(m.files);
 const files=m.files.map(f=>{if(typeof f.sha256!=='string'||!/^[0-9a-f]{64}$/i.test(f.sha256))throw Error('SHA-256摘要格式错误');return {name:f.name,size:f.size,sha256:f.sha256.toLowerCase()};});
 return {format:'file-ledger',version:1,algorithm:'SHA-256',files};
}
function manifest(files){return validate({format:'file-ledger',version:1,algorithm:'SHA-256',files});}
function parse(text){if(new TextEncoder().encode(text).length>LIMIT.json)throw Error('清单JSON超过128 KiB'); let obj;try{obj=JSON.parse(text);}catch{throw Error('清单不是有效JSON');}return validate(obj);}
async function digest(buffer){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),n=>n.toString(16).padStart(2,'0')).join('');}
function compare(before,after){
 const a=new Map(validate(before).files.map(f=>[f.name,f])),b=new Map(validate(after).files.map(f=>[f.name,f]));
 const rows=[...new Set([...a.keys(),...b.keys()])].sort().map(name=>{const old=a.get(name),now=b.get(name);return {name,old,now,status:!old?'新增':!now?'移除':old.sha256===now.sha256&&old.size===now.size?'未变':'修改'};});
 const key=f=>f.size+':'+f.sha256,removed=rows.filter(r=>r.status==='移除'),added=rows.filter(r=>r.status==='新增');
 const renames=[];for(const r of removed){const sameOld=removed.filter(x=>key(x.old)===key(r.old)),sameNew=added.filter(x=>key(x.now)===key(r.old));if(sameOld.length===1&&sameNew.length===1)renames.push({from:r.name,to:sameNew[0].name});}
 const counts=Object.fromEntries(['未变','修改','新增','移除'].map(s=>[s,rows.filter(r=>r.status===s).length]));return {rows,counts,renames};
}
function csv(report){const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';return '\uFEFF'+[['状态','文件名','基线字节','当前字节','基线SHA256','当前SHA256'],...report.rows.map(r=>[r.status,r.name,r.old?.size,r.now?.size,r.old?.sha256,r.now?.sha256])].map(row=>row.map(cell).join(',')).join('\r\n');}
const api={LIMIT,checkFiles,validate,manifest,parse,digest,compare,csv};root.AppCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
