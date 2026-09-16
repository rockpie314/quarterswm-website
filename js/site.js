const nav=document.querySelector('.nav-links');
const toggle=document.querySelector('.nav-toggle');
if(nav&&toggle){
  toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open))});
}
const organizerFrame=document.querySelector('.tool-frame');
if(organizerFrame){
  const setOrganizerHeight=height=>{if(Number.isFinite(height)&&height>0)organizerFrame.style.height=Math.ceil(height)+'px'};
  function measureOrganizer(){try{const doc=organizerFrame.contentDocument;if(!doc)return;const welcome=doc.getElementById('welcomeScreen');const layout=doc.querySelector('.layout');const welcomeActive=!!(welcome&&getComputedStyle(welcome).display!=='none');const target=welcomeActive?welcome:layout;if(target)setOrganizerHeight(welcomeActive?Math.max(target.scrollHeight,target.offsetHeight,target.getBoundingClientRect().height):Math.max(doc.documentElement.scrollHeight,doc.body.scrollHeight))}catch(error){/* postMessage remains the cross-context fallback */}}
  organizerFrame.setAttribute('scrolling','no');
  organizerFrame.addEventListener('load',()=>{measureOrganizer();setTimeout(measureOrganizer,120)});
  addEventListener('message',event=>{if(event.source!==organizerFrame.contentWindow||!event.data||event.data.type!=='qwm-organizer-size')return;setOrganizerHeight(Number(event.data.height))});
  addEventListener('resize',measureOrganizer,{passive:true});
}
function triggerDownload(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},3000)}
document.querySelectorAll('[data-download]').forEach(link=>link.addEventListener('click',async e=>{e.preventDefault();const original=link.textContent;link.textContent='Preparing download…';link.setAttribute('aria-disabled','true');try{const response=await fetch(link.href);if(!response.ok)throw new Error('File unavailable');triggerDownload(await response.blob(),link.dataset.download)}catch(error){location.href=link.href}finally{setTimeout(()=>{link.textContent=original;link.removeAttribute('aria-disabled')},800)}}));
const formEl=document.getElementById('factFinderForm');
if(formEl){
  const progressBar=document.getElementById('progressBar');
  const progressLabel=document.getElementById('progressLabel');
  const scoreA=document.getElementById('scoreA');
  const scoreB=document.getElementById('scoreB');
  const scoreC=document.getElementById('scoreC');
  const scoreTotal=document.getElementById('scoreTotal');
  const resultCard=document.getElementById('resultCard');
  const resultName=document.getElementById('resultName');
  const resultAlloc=document.getElementById('resultAlloc');
  const resultDesc=document.getElementById('resultDesc');
  const downloadBtn=document.getElementById('downloadBtn');
  function updateProgress(){const inputs=formEl.querySelectorAll('input:not([type=radio]):not([type=checkbox]),select,textarea');let filled=0,total=0;inputs.forEach(el=>{if(el.type==='date'||el.readOnly)return;total++;if(el.value.trim())filled++});const groups={};formEl.querySelectorAll('input[type=radio]').forEach(r=>{groups[r.name]=groups[r.name]||false;if(r.checked)groups[r.name]=true});total+=Object.keys(groups).length;filled+=Object.values(groups).filter(Boolean).length;const pct=total?Math.round(filled/total*100):0;progressBar.style.width=pct+'%';progressLabel.textContent=pct+'% complete'}
  const PROFILES=[{min:0,max:14,name:'Conservative',alloc:'30% / 70%',desc:'Income matters more to you than growth. Your portfolio carries limited equity exposure.'},{min:15,max:21,name:'Moderate',alloc:'50% / 50%',desc:'You seek an even balance between growth and income.'},{min:22,max:27,name:'Moderate Growth',alloc:'60% / 40%',desc:'Growth is your primary objective, with a meaningful fixed income allocation alongside it.'},{min:28,max:33,name:'Growth',alloc:'70% / 30%',desc:'You are comfortable accepting significant market volatility in pursuit of long-term returns.'},{min:34,max:99,name:'Aggressive',alloc:'85% / 15%',desc:'You have a high risk tolerance and long time horizon, accepting substantial short-term fluctuations.'}];
  function updateRiskScore(){const val=n=>{const c=formEl.querySelector(`input[name="${n}"]:checked`);return c?parseInt(c.value):null};const A=['rq1','rq2','rq3','rq4','rq5','rq6'],B=['rq7','rq8','rq9'],C=['rq10','rq11','rq12'];let sa=0,sb=0,sc=0,aa=0,ab=0,ac=0;A.forEach(n=>{let v=val(n);if(v!==null){sa+=v;aa++}});B.forEach(n=>{let v=val(n);if(v!==null){sb+=v;ab++}});C.forEach(n=>{let v=val(n);if(v!==null){sc+=v;ac++}});scoreA.textContent=aa?sa:'Not scored';scoreB.textContent=ab?(sb>=0?'+':'')+sb:'Not scored';scoreC.textContent=ac?(sc>=0?'+':'')+sc:'Not scored';if(aa===6&&ab===3&&ac===3){let total=sa+sb+sc;scoreTotal.textContent=total;let p=PROFILES.find(p=>total>=p.min&&total<=p.max);resultName.textContent=p.name;resultAlloc.textContent=p.alloc;resultDesc.textContent=p.desc;resultCard.classList.add('show')}else{scoreTotal.textContent=aa+ab+ac?'...':'Not scored';resultCard.classList.remove('show')}}
  function calcYears(){const current=parseInt(formEl.elements.current_age.value),retire=parseInt(formEl.elements.retire_age.value);formEl.elements.years_to_retire.value=!isNaN(current)&&!isNaN(retire)&&retire>current?retire-current:''}
  formEl.addEventListener('input',e=>{updateProgress();if(e.target.name==='current_age'||e.target.name==='retire_age')calcYears()});
  formEl.addEventListener('change',()=>{updateProgress();updateRiskScore()});
  document.querySelectorAll('.data-table,.profile-map').forEach(table=>{const headings=[...table.querySelectorAll('th')].map(x=>x.textContent.trim());table.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((cell,index)=>cell.dataset.label=headings[index]||''))});
  updateProgress();
  downloadBtn.addEventListener('click',async()=>{const sheet=document.querySelector('.fact-sheet');const status=document.getElementById('downloadStatus');downloadBtn.disabled=true;downloadBtn.textContent='Creating PDF…';status.textContent='Preparing your completed fact finder. This may take a moment.';sheet.classList.add('pdf-export');try{if(document.fonts&&document.fonts.ready)await document.fonts.ready;const worker=html2pdf().set({margin:[0.3,0.3,0.35,0.3],filename:'QWM-Completed-Fact-Finder.pdf',image:{type:'jpeg',quality:0.96},html2canvas:{scale:1.35,useCORS:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0},jsPDF:{unit:'in',format:'letter',orientation:'portrait'},pagebreak:{mode:['css','legacy'],avoid:['.field-row','.risk-q-block','.scoring-box','.result-card','tr']}}).from(sheet).toPdf();const blob=await worker.outputPdf('blob');triggerDownload(blob,'QWM-Completed-Fact-Finder.pdf');status.textContent='Your completed PDF has been downloaded.'}catch(error){console.error(error);status.textContent='The PDF could not be created. Please use the blank PDF from Resources instead.'}finally{sheet.classList.remove('pdf-export');downloadBtn.disabled=false;downloadBtn.textContent='Download Completed PDF'}});
}
