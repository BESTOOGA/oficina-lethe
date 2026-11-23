(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const catalog = globalThis.LETHE_CATALOG;
  const key = "oficina-lethe.rascunho.v1";
  const maxFights = globalThis.LetheExport?.MAX_FIGHTS ?? 98;
  const shapes = {
    layers:'<path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5"/>',
    swords:'<path d="m4 3 4 1 10 11-3 3L4 7 4 3Zm16 0-4 1-4 5m-3 4-4 4m10-2 5 5m-3-7 4 4M4 20l4-4m-5 0 4 4"/>',
    trash:'<path d="M4 6h16M9 6V3h6v3M7 6l1 14h8l1-14M10 10v6m4-6v6"/>',
    package:'<path d="m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5m-9 5v10M7 5l9 5"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
    up:'<path d="m6 14 6-6 6 6"/>',down:'<path d="m6 10 6 6 6-6"/>',
    right:'<path d="m9 6 6 6-6 6"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    start:'<path d="M6 21V4h11l-2 4 2 4H6"/>',
    shop:'<path d="M4 9h16l-1 11H5L4 9Zm4 0V7a4 4 0 0 1 8 0v2"/>',
    crown:'<path d="m3 8 4 4 5-7 5 7 4-4-2 11H5L3 8Z"/>',
    gift:'<path d="M4 10h16v10H4V10Zm-1-4h18v4H3V6Zm9 0v14M12 6S10 2 7.5 3 8 6 12 6Zm0 0s2-4 4.5-3S16 6 12 6Z"/>',
    stairs:'<path d="M3 20h5v-5h5v-5h5V5h3M3 20v-2"/>',
    dice:'<path d="M4 4h16v16H4V4Z"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/><circle cx="12" cy="12" r="1"/>'
  };
  function icon(name){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+shapes[name]+'</svg>';}
  document.querySelectorAll("[data-icon]").forEach(el => {el.innerHTML=icon(el.dataset.icon);});
  $("move-up").innerHTML=icon("up");
  $("move-down").innerHTML=icon("down");
  function el(tag, cls, text) {
    const node=document.createElement(tag);
    if(cls) node.className=cls;
    if(text!==undefined) node.textContent=text;
    return node;
  }
  function btn(cls,label,action) {
    const node=el("button",cls,label);
    node.type="button"; node.addEventListener("click",action);
    return node;
  }
  function alertError(message) {
    $("error").textContent=message;
    $("error").hidden=!message;
  }
  if(!catalog?.fights?.length || !catalog.enemies?.length || !globalThis.LetheExport) {
    alertError("O editor não conseguiu carregar o catálogo. Reabra a página para tentar novamente.");
    $("download").disabled=true;
    return;
  }
  const byId=new Map(),enemyById=new Map();
  let pickersReady=false;
  const Bosses=globalThis.LetheBosses;
  // Registers uploaded bosses in the catalog and rebuilds the lookups.
  function useBosses(list){
    const problems=Bosses?Bosses.register(catalog,list||[]):[];
    byId.clear();for(const f of catalog.fights)byId.set(Number(f.id),f);
    enemyById.clear();for(const e of catalog.enemies)enemyById.set(e.id,e);
    if(pickersReady)rebuildPickerItems();
    return problems;
  }
  const labelType=t=>t==="Abnormality"?"Confronto focado":"Combate regular";
  const num=i=>String(i+1).padStart(2,"0");
  const plural=(n,s,p)=>n+" "+(n===1?s:p);
  const fightTitle=f=>(typeof f.title==="string"&&f.title.trim())||byId.get(f.templateId).name;
  const countFight=f=>f.waves.flat().reduce((sum,u)=>sum+u.count,0);
  function fromTemplate(template) {
    return {templateId:Number(template.id),waves:template.battle.waveList.map(wave=>
      wave.unitList.map(u=>({id:u.unitID,count:u.unitCount??1,level:u.unitLevel??template.battle.stageLevel})))};
  }
  function fresh() {
    const first=catalog.fights.find(f=>f.type==="Normal")||catalog.fights[0];
    const second=catalog.fights.find(f=>f.type===first.type && f.id!==first.id);
    const last=catalog.fights.find(f=>f.type==="Abnormality"&&f.id!==first.id);
    const pool=[first,second,last].filter(Boolean);
    return {name:"Travessia do Espelho",packId:100000+Math.floor(Math.random()*900000),fights:pool.map(fromTemplate),
      map:{shape:"tree",steps:4,events:2,seed:Math.floor(Math.random()*2**32)}};
  }
  function validDraft(p){
    if(!p || typeof p.name!=="string" || !Number.isInteger(p.packId) || !Array.isArray(p.fights) || !p.fights.length || p.fights.length>maxFights) return false;
    if(p.customBosses!==undefined && !(Array.isArray(p.customBosses) && p.customBosses.every(b=>Bosses?.validBoss(b))))return false;
    if(p.customBosses?.length===0)return false;
    return p.fights.every(validFight);
  }
  function validFight(f){
    if(!f||typeof f!=="object")return false;
    {
      const base=byId.get(f?.templateId);
      const maxWaves=globalThis.LetheExport.MAX_WAVES;
      if(f.maps!==undefined && !(Array.isArray(f.maps) && f.maps.every(m=>m===null || catalog.maps?.includes(m))))return false;
      if(f.chain!==undefined && typeof f.chain!=="boolean")return false;
      if(f.title!==undefined && typeof f.title!=="string")return false;
      return !!base && Array.isArray(f.waves) && f.waves.length>=1 && f.waves.length<=maxWaves && f.waves.every(w=>Array.isArray(w) && w.length && w.every(u=>u && Number.isInteger(u.count) && u.count>0 && Number.isInteger(u.level) && enemyById.get(u.id)?.types.includes(base.type)));
    }
  }
  let project=fresh(),selected=0,ready=false;
  useBosses([]);
  let savedDraft=null;
  try{savedDraft=JSON.parse(localStorage.getItem(key));}catch{}
  // The draft keeps only the bosses' names; their files live in IndexedDB.
  function save(){
    if(!ready)return;
    try{
      const snapshot={...project};
      if(project.customBosses)snapshot.customBosses=project.customBosses.map(Bosses.stub);
      localStorage.setItem(key,JSON.stringify(snapshot));$("save-status").textContent="Salvo neste navegador";
    }catch{$("save-status").textContent="Rascunho nesta aba";}
  }
  async function loadDraft(saved){
    const notes=[];
    if(saved&&Array.isArray(saved.customBosses)){
      const bosses=[];
      for(const b of saved.customBosses){
        if(Bosses?.validBoss(b)){bosses.push(b);continue;}
        if(!Bosses?.validStub(b))continue;
        let full=null;
        try{full=await Bosses.store.get(b.key);}catch{}
        if(full&&Bosses.validBoss(full))bosses.push(full);
        else notes.push("O boss “"+b.name+"” não está mais salvo neste navegador. Envie o ZIP dele de novo; as lutas que o usavam voltaram para uma luta comum.");
      }
      saved.customBosses=bosses;
      if(!bosses.length)delete saved.customBosses;
    }
    useBosses(saved?.customBosses||[]);
    if(saved&&Array.isArray(saved.fights)){
      const rebuilt=[];
      saved.fights=saved.fights.map((f,i)=>{
        if(validFight(f))return f;
        const next=fromTemplate(byId.get(f?.templateId)||catalog.fights[0]);
        if(typeof f?.title==="string")next.title=f.title;
        rebuilt.push(num(i));return next;
      });
      if(rebuilt.length)notes.push((rebuilt.length===1?"A luta "+rebuilt[0]+" foi refeita":"As lutas "+rebuilt.join(", ")+" foram refeitas")+" porque não combinava mais com os dados do catálogo ou do boss. Confira na aba Lutas.");
    }
    if(validDraft(saved))project=saved;
    else{useBosses([]);project=fresh();}
    // Older drafts kept the files inline: move them to IndexedDB.
    for(const b of project.customBosses||[])try{await Bosses.store.put(b);}catch{}
    return notes;
  }
  function summary(){
    $("summary-name").textContent=project.name.trim()||"Pacote sem nome";
    const units=project.fights.reduce((sum,f)=>sum+countFight(f),0);
    $("summary-count").textContent=plural(project.fights.length,"luta","lutas")+" · "+plural(units,"inimigo","inimigos");
    $("download").disabled=!project.name.trim();
  }
  function renderList(){
    const list=$("fight-list");list.replaceChildren();
    project.fights.forEach((f,i)=>{
      const template=byId.get(f.templateId);
      const b=btn("fight"+(i===selected?" active":""),undefined,()=>{
        selected=i;render();const active=$("fight-list").children[i];active?.focus({preventScroll:true});
      });
      b.setAttribute("aria-pressed",String(i===selected));
      b.append(el("span","fight-index",num(i)));
      const lines=el("span","fight-text");
      lines.append(el("b",null,fightTitle(f)),el("small",null,plural(countFight(f),"inimigo","inimigos")+(f.waves.length>1?" · "+f.waves.length+" ondas":"")+(f.chain?" · chain":"")+" · "+(i===project.fights.length-1?"Luta final":labelType(template.type))+(layout?.unused.includes(i)?" · fora do mapa":"")));
      const arrow=el("span","fight-icon");arrow.innerHTML=icon("right");b.append(lines,arrow);list.append(b);
    });
    $("fight-count").value=project.fights.length;
    $("add-fight").disabled=project.fights.length>=maxFights;
  }
  // Searchable picker: a button that opens one shared popover with a search box.
  // items: [{value, label, meta, group, search}]
  const pop=el("div","picker-pop");pop.hidden=true;
  const popSearch=el("input");popSearch.type="search";popSearch.placeholder="Digite para buscar…";popSearch.autocomplete="off";
  popSearch.setAttribute("role","combobox");popSearch.setAttribute("aria-expanded","true");popSearch.setAttribute("aria-controls","picker-list");popSearch.setAttribute("aria-autocomplete","list");
  const popCount=el("div","picker-count");popCount.setAttribute("aria-live","polite");
  const popList=el("ul","picker-list");popList.id="picker-list";popList.setAttribute("role","listbox");
  pop.append(popSearch,popCount,popList);document.body.append(pop);
  const PICKER_LIMIT=150;
  let pickerState=null;
  const norm=t=>String(t).normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase();
  function picker({id,items,value,label,onPick}){
    const b=btn("picker",undefined,()=>openPicker(b));
    b.id=id;b.setAttribute("aria-haspopup","listbox");b.setAttribute("aria-expanded","false");
    const item=items.find(i=>i.value===value);
    const text=el("span","picker-text");
    text.append(el("span","picker-value",item?item.label:"—"));
    if(item?.meta)text.append(el("span","picker-meta",item.meta));
    const caret=el("span","picker-caret");caret.setAttribute("aria-hidden","true");
    b.append(text,caret);
    b.setAttribute("aria-label",label+": "+(item?item.label:"nenhum"));
    b._picker={items,value,onPick,label};
    return b;
  }
  function openPicker(b){
    if(pickerState?.button===b){closePicker(true);return;}
    pickerState={button:b,...b._picker,matches:[],index:0};
    b.setAttribute("aria-expanded","true");
    popSearch.setAttribute("aria-label","Buscar "+b._picker.label.toLowerCase());
    pop.hidden=false;popSearch.value="";filterPicker(false);placePicker();hilitePicker(true);popSearch.focus({preventScroll:true});
  }
  function placePicker(){
    const r=pickerState.button.getBoundingClientRect();
    const width=Math.min(Math.max(r.width,340),window.innerWidth-16);
    const left=Math.min(Math.max(8,r.left),window.innerWidth-width-8);
    const below=window.innerHeight-r.bottom-12,above=r.top-12;
    const down=below>=280||below>=above;
    pop.style.width=width+"px";pop.style.left=(left+scrollX)+"px";
    pop.style.maxHeight=Math.max(200,Math.min(420,down?below:above))+"px";
    pop.style.top=(down?r.bottom+4+scrollY:r.top-4+scrollY-pop.offsetHeight)+"px";
  }
  function closePicker(focus){
    if(!pickerState)return;
    const b=pickerState.button;b.setAttribute("aria-expanded","false");
    pickerState=null;pop.hidden=true;if(focus)b.focus({preventScroll:true});
  }
  function filterPicker(scroll){
    const tokens=norm(popSearch.value).split(/\s+/).filter(Boolean);
    const st=pickerState;
    st.matches=st.items.filter(i=>{const hay=i._hay||(i._hay=norm(i.label+" "+(i.meta||"")+" "+(i.group||"")+" "+(i.search||"")));return tokens.every(t=>hay.includes(t));});
    const shown=st.matches.slice(0,PICKER_LIMIT);
    st.index=Math.max(0,tokens.length?0:shown.findIndex(i=>i.value===st.value));
    popCount.textContent=!st.matches.length?"Nada encontrado":st.matches.length>PICKER_LIMIT?"Mostrando "+PICKER_LIMIT+" de "+st.matches.length+" · digite para filtrar":plural(st.matches.length,"resultado","resultados");
    popList.replaceChildren();
    let group=null;
    shown.forEach((item,i)=>{
      if(item.group&&item.group!==group){group=item.group;const h=el("li","picker-group",group);h.setAttribute("role","presentation");popList.append(h);}
      const li=el("li","picker-item"+(item.value===st.value?" current":""));
      li.id="pick-"+i;li.setAttribute("role","option");li.dataset.index=i;
      li.append(el("span","picker-value",item.label));
      if(item.meta)li.append(el("span","picker-meta",item.meta));
      li.addEventListener("pointerdown",e=>e.preventDefault());
      li.addEventListener("click",()=>choosePicker(i));
      popList.append(li);
    });
    hilitePicker(scroll);
  }
  function hilitePicker(scroll){
    const st=pickerState;
    popList.querySelectorAll(".picker-item").forEach(li=>{const on=Number(li.dataset.index)===st.index;li.classList.toggle("active",on);li.setAttribute("aria-selected",String(on));});
    const cur=$("pick-"+st.index);
    if(cur){popSearch.setAttribute("aria-activedescendant",cur.id);if(scroll)cur.scrollIntoView({block:"nearest"});}else popSearch.removeAttribute("aria-activedescendant");
  }
  function choosePicker(i){
    const st=pickerState,item=st?.matches[i];if(!item)return;
    closePicker(true);if(item.value!==st.value)st.onPick(item.value);
  }
  popSearch.addEventListener("input",()=>filterPicker(true));
  popSearch.addEventListener("keydown",e=>{
    const st=pickerState;if(!st)return;
    const max=Math.min(st.matches.length,PICKER_LIMIT)-1;
    if(e.key==="ArrowDown"){e.preventDefault();st.index=Math.min(max,st.index+1);hilitePicker(true);}
    else if(e.key==="ArrowUp"){e.preventDefault();st.index=Math.max(0,st.index-1);hilitePicker(true);}
    else if(e.key==="PageDown"){e.preventDefault();st.index=Math.min(max,st.index+10);hilitePicker(true);}
    else if(e.key==="PageUp"){e.preventDefault();st.index=Math.max(0,st.index-10);hilitePicker(true);}
    else if(e.key==="Enter"){e.preventDefault();choosePicker(st.index);}
    else if(e.key==="Escape"){e.preventDefault();closePicker(true);}
    else if(e.key==="Tab")closePicker(false);
  });
  document.addEventListener("pointerdown",e=>{if(pickerState&&!pop.contains(e.target)&&!pickerState.button.contains(e.target))closePicker(false);});
  window.addEventListener("resize",()=>closePicker(false));
  // Items for the three pickers.
  const enemyItemCache=new Map();
  function enemyItemsFor(type){
    if(!enemyItemCache.has(type))enemyItemCache.set(type,catalog.enemies.filter(e=>e.types.includes(type)).map(e=>({
      value:e.id,label:e.name,
      meta:[e.level?"nv "+e.level:"",e.boss?"chefe":""].filter(Boolean).join(" · "),
      group:e.boss?"Chefes":type==="Abnormality"?"Anormalidades":"Inimigos",search:String(e.id)
    })).sort((a,b)=>(a.group==="Chefes"?0:1)-(b.group==="Chefes"?0:1)||a.label.localeCompare(b.label)));
    return enemyItemCache.get(type);
  }
  let fightItems=[];
  function rebuildPickerItems(){
    enemyItemCache.clear();
    fightItems=catalog.fights.map(f=>({
    value:f.id,label:f.name,
    meta:[f.kind||"",labelType(f.type),f.battle.waveList.length>1?f.battle.waveList.length+" ondas":"",f.scripted?"mecânica especial":""].filter(Boolean).join(" · "),
    group:f.group||labelType(f.type),
    search:f.battle.waveList.flatMap(w=>w.unitList.map(u=>enemyById.get(u.unitID)?.name||"")).join(" ")+" "+f.id
    }));
  }
  rebuildPickerItems();pickersReady=true;
  function restoreFocus(id){if(id)document.getElementById(id)?.focus({preventScroll:true});}
  function changed(focusId){save();render();restoreFocus(focusId);}
  // Scene picker, built once and cloned for every wave.
  const sceneGroups=[["Anormalidades",n=>n.startsWith("Ab_")],["Cantos da história",n=>/^(Cp|B\d)/.test(n)],["Walpurgisnacht",n=>n.startsWith("Walpu")],["Outros lugares",()=>true]];
  const sceneItems=(catalog.maps||[]).map(name=>({value:name,label:name,group:sceneGroups.find(([,test])=>test(name))[0]}))
    .sort((a,b)=>sceneGroups.findIndex(g=>g[0]===a.group)-sceneGroups.findIndex(g=>g[0]===b.group));
  const baseScene=(base,wi)=>base.battle.waveList[Math.min(wi,base.battle.waveList.length-1)]?.battleMapInfo?.mapName||"";
  const sceneOf=(fight,base,wi)=>fight.maps?.[wi]||baseScene(base,wi);
  function renderKind(fight){
    const chain=!!fight.chain;
    $("kind-normal").setAttribute("aria-pressed",String(!chain));
    $("kind-chain").setAttribute("aria-pressed",String(chain));
    $("kind-hint").textContent=chain
      ?(fight.waves.length>1?"Antes de cada onda, o jogador escolhe uma nova equipe, como nas lutas longas da Line 5.":"Uma chain battle precisa de pelo menos duas ondas. Adicione outra onda abaixo.")
      :"As ondas seguem em sequência com a mesma equipe.";
  }
  function renderWaves(fight,base){
    const box=$("enemy-section");box.replaceChildren();
    const compatible=catalog.enemies.filter(enemy=>enemy.types.includes(base.type));
    const maxWaves=globalThis.LetheExport.MAX_WAVES;
    renderKind(fight);
    $("add-wave").disabled=fight.waves.length>=maxWaves;
    $("add-wave").lastChild.textContent=" Adicionar onda ("+fight.waves.length+" de "+maxWaves+")";
    fight.waves.forEach((wave,wi)=>{
      const section=el("div","wave"), head=el("div","wave-head");
      const total=wave.reduce((n,u)=>n+u.count,0),maxUnits=globalThis.LetheExport.MAX_UNITS;
      const title=el("h4",null,"Onda "+(wi+1));
      if(fight.chain&&fight.waves.length>1)title.append(el("span","chip chain-chip","NOVA EQUIPE"));
      const tools=el("span","wave-tools");
      tools.append(el("span","muted",total+" de "+maxUnits+" vagas"));
      if(fight.waves.length>1){
        const drop=btn("row-x",undefined,()=>{
          fight.waves.splice(wi,1);if(Array.isArray(fight.maps))fight.maps.splice(wi,1);
          changed(fight.waves.length>wi?"scene-"+wi:"add-wave");
        });
        drop.innerHTML=icon("trash");drop.id="drop-wave-"+wi;drop.setAttribute("aria-label","Remover onda "+(wi+1));drop.title="Remover onda";
        tools.append(drop);
      }
      head.append(title,tools);
      section.append(head);
      const sceneRow=el("div","scene-row");
      const sceneLabel=el("span","label","Cenário");
      const scene=picker({id:"scene-"+wi,label:"Cenário da onda "+(wi+1),value:fight.maps?.[wi]||"",
        items:[{value:"",label:"Padrão da luta base",meta:baseScene(base,wi),group:"Padrão"},...sceneItems],
        onPick:v=>{
          fight.maps=Array.from({length:fight.waves.length},(_,i)=>fight.maps?.[i]??null);
          fight.maps[wi]=v||null;changed("scene-"+wi);
        }});
      sceneRow.append(sceneLabel,scene);section.append(sceneRow);
      section.append(el("span","label enemies-label","Inimigos"));
      wave.forEach((unit,ui)=>{
        const stem="u-"+wi+"-"+ui;
        const row=el("div","enemy-row");
        const select=picker({id:stem,label:"Inimigo "+(ui+1)+" da onda "+(wi+1),value:unit.id,items:enemyItemsFor(base.type),onPick:v=>{unit.id=v;changed(stem);}});
        const unitName=enemyById.get(unit.id)?.name||"inimigo";
        const qty=el("span","quantity");
        const quantityButton=(delta,mark,suffix)=>{
          const b=btn(null,mark,()=>{unit.count+=delta;changed(stem+suffix);});
          b.id=stem+suffix;
          b.setAttribute("aria-label",(delta<0?"Diminuir":"Aumentar")+" quantidade de "+unitName);
          b.disabled=delta<0?unit.count<=1:total>=maxUnits;
          return b;
        };
        qty.append(quantityButton(-1,"−","-less"),el("output",null,unit.count),quantityButton(1,"+","-more"));
        const remove=btn("row-x",undefined,()=>{wave.splice(ui,1);changed("u-"+wi+"-"+Math.min(ui,wave.length-1));});
        remove.innerHTML=icon("trash");remove.setAttribute("aria-label","Remover grupo "+(ui+1));remove.disabled=wave.length===1;
        row.append(select,qty,remove);section.append(row);
      });
      const add=btn("add enemy-add","＋ Adicionar inimigo",()=>{
        const enemy=compatible.find(e=>!wave.some(u=>u.id===e.id))||compatible[0];
        wave.push({id:enemy.id,count:1,level:wave[0].level});changed("u-"+wi+"-"+(wave.length-1));
      });
      add.disabled=total>=maxUnits;
      section.append(add);box.append(section);
    });
  }
  const skins=globalThis.LETHE_SKINS.presets;
  for(const skin of skins)$("skin").add(new Option(skin.name,skin.id));
  $("skin").onchange=()=>{project.skinId=$("skin").value;delete project.coverDataUrl;changed("skin");};
  $("rate").onchange=()=>{project.rateUp=Number($("rate").value);save();renderPreview();};
  $("reset-cover").onclick=()=>{delete project.coverDataUrl;changed("skin");};
  // Cover upload: the player frames the image in the pack's 300 × 553 shape,
  // then it is cropped and saved as PNG.
  const COVER={w:416,h:767};
  let readingCover=false;
  const crop={img:$("crop-img"),url:null,iw:0,ih:0,fw:0,fh:0,sw:0,sh:0,zoom:1,ox:0,oy:0,draft:null};
  function cropScale(){return Math.max(crop.fw/crop.iw,crop.fh/crop.ih)*crop.zoom;}
  function cropLayout(){
    const s=cropScale(),w=crop.iw*s,h=crop.ih*s;
    crop.ox=Math.max(-(w-crop.fw)/2,Math.min((w-crop.fw)/2,crop.ox));
    crop.oy=Math.max(-(h-crop.fh)/2,Math.min((h-crop.fh)/2,crop.oy));
    Object.assign(crop.img.style,{width:w+"px",height:h+"px",left:(crop.sw/2+crop.ox-w/2)+"px",top:(crop.sh/2+crop.oy-h/2)+"px"});
  }
  function closeCrop(){
    $("crop").close();
    if(crop.url)URL.revokeObjectURL(crop.url);crop.url=null;
    readingCover=false;$("cover").value="";summary();
  }
  $("cover").onchange=async()=>{
    const file=$("cover").files[0];
    if(!file)return;
    try{
      if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("Escolha uma imagem PNG, JPEG ou WebP.");
      readingCover=true;$("download").disabled=true;
      crop.url=URL.createObjectURL(file);crop.img.src=crop.url;await crop.img.decode();
      crop.iw=crop.img.naturalWidth;crop.ih=crop.img.naturalHeight;crop.draft=project;
      $("crop").showModal();
      const stage=$("crop-stage"),frame=$("crop-frame");
      crop.sw=stage.clientWidth;crop.sh=stage.clientHeight;crop.fw=frame.offsetWidth;crop.fh=frame.offsetHeight;
      crop.zoom=1;crop.ox=0;crop.oy=0;$("crop-zoom").value="1";cropLayout();alertError("");
    }catch(e){alertError("Não foi possível carregar a capa. "+e.message);closeCrop();}
  };
  $("crop-zoom").addEventListener("input",()=>{crop.zoom=Number($("crop-zoom").value);cropLayout();});
  $("crop-stage").addEventListener("wheel",e=>{
    e.preventDefault();
    crop.zoom=Math.min(4,Math.max(1,crop.zoom*(e.deltaY<0?1.08:1/1.08)));$("crop-zoom").value=String(crop.zoom);cropLayout();
  },{passive:false});
  $("crop-stage").addEventListener("pointerdown",e=>{
    const stage=$("crop-stage"),start={x:e.clientX,y:e.clientY,ox:crop.ox,oy:crop.oy};
    stage.setPointerCapture(e.pointerId);stage.classList.add("dragging");
    const move=ev=>{crop.ox=start.ox+ev.clientX-start.x;crop.oy=start.oy+ev.clientY-start.y;cropLayout();};
    const up=()=>{stage.removeEventListener("pointermove",move);stage.removeEventListener("pointerup",up);stage.removeEventListener("pointercancel",up);stage.classList.remove("dragging");};
    stage.addEventListener("pointermove",move);stage.addEventListener("pointerup",up);stage.addEventListener("pointercancel",up);
  });
  $("crop-stage").addEventListener("keydown",e=>{
    const d={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[e.key];
    if(d){e.preventDefault();crop.ox+=d[0];crop.oy+=d[1];cropLayout();}
  });
  $("crop-ok").onclick=()=>{
    const s=cropScale(),canvas=document.createElement("canvas");
    canvas.width=COVER.w;canvas.height=COVER.h;
    const sx=(crop.iw*s/2-crop.ox-crop.fw/2)/s,sy=(crop.ih*s/2-crop.oy-crop.fh/2)/s;
    const g=canvas.getContext("2d");g.imageSmoothingQuality="high";
    g.drawImage(crop.img,sx,sy,crop.fw/s,crop.fh/s,0,0,COVER.w,COVER.h);
    if(project===crop.draft){project.coverDataUrl=canvas.toDataURL("image/png");save();}
    closeCrop();render();
  };
  $("crop-cancel").onclick=closeCrop;$("crop-close").onclick=closeCrop;
  $("crop").addEventListener("cancel",e=>{e.preventDefault();closeCrop();});
  // Looks names up live, so uploaded bosses are included.
  const enemyName={get:id=>enemyById.get(id)?.name};
  const nodeKinds={start:["start","Início","Entrada do andar"],battle:["swords","Combate","Combate regular"],abno:["eye","Anormalidade","Confronto focado"],event:[null,"?","Evento aleatório do Mirror Dungeon"],shop:["shop","Loja","Loja antes da luta final"],boss:["crown","Chefe","Luta final"]};
  const svgNS="http://www.w3.org/2000/svg";
  function previewFiles(){
    // Use the exporter itself so the preview always matches the ZIP.
    const draft={...project,name:project.name.trim()||"Pacote sem nome"};
    return globalThis.LetheExport.buildFiles(draft);
  }
  // Crimped top and bottom edges of the foil pack, as a clip-path.
  const crimp=(()=>{
    const teeth=22,depth=1.4,top=[],bottom=[];
    for(let i=0;i<=teeth;i++){
      const x=i/teeth*100,mid=(i+.5)/teeth*100;
      top.push(x+"% "+depth+"%");if(i<teeth)top.push(mid+"% 0%");
      bottom.unshift(x+"% "+(100-depth)+"%");if(i<teeth)bottom.unshift(mid+"% 100%");
    }
    return "polygon("+top.concat(bottom).join(",")+")";
  })();
  function spriteTitle(id){return String(id||"").replace(/_/g," ").replace(/([a-z])([A-Z0-9])/g,"$1 $2").toUpperCase();}
  function pouch(theme,cover){
    const ui=theme.uiConfigs,basic=(ui.mapOptions.find(o=>o.key==="SetColor_Basic")?.value)||ui.textColor||"af241c";
    const p=el("div","pouch");
    p.style.setProperty("--pack","#"+basic);
    p.style.setProperty("--pack-text","#"+(ui.textColor||basic));
    p.style.clipPath=crimp;
    const art=el("div","pouch-art");
    if(cover){const img=el("img");img.src=cover;img.alt="";art.append(img);}
    else art.append(el("span","pouch-watermark",spriteTitle(ui.packSpriteId)));
    const title=el("div","pouch-title");
    if(!ui.isHideLogo)title.append(el("span","pouch-logo","LIMBUS COMPANY"));
    title.append(el("strong",null,theme.desc));
    p.append(art,el("span","pouch-seal top"),el("span","pouch-seal bottom"),el("span","pouch-gloss"),title);
    return p;
  }
  let layout=null;
  function renderPreview(){
    let files;
    try{files=previewFiles();layout=globalThis.LetheExport.buildLayout(project);}
    catch(e){$("pouch-wrap").replaceChildren(el("p","muted","Prévia indisponível: "+e.message));$("floor-map").replaceChildren();$("node-detail").replaceChildren();return;}
    const floorPath=Object.keys(files).find(p=>p.includes("mirrordungeon-theme-floor/"));
    const themes=JSON.parse(files[floorPath]).list,theme=themes[0];
    const basic="#"+(theme.uiConfigs.mapOptions.find(o=>o.key==="SetColor_Basic")?.value||"af241c");
    // The pack as offered in the theme selection.
    const wrap=$("pouch-wrap");wrap.replaceChildren(pouch(theme,project.coverDataUrl));
    if(themes.length>1)wrap.append(el("span","rate-badge","×"+themes.length));
    const boss=enemyName.get(theme.uiConfigs.showBossIds[0])||"—";
    const cap=$("pick-caption");cap.replaceChildren();
    const capBoss=el("span");capBoss.append("Chefe exibido: ",el("b",null,boss));
    cap.append(capBoss,el("span",null,floorsText(LE.normalizeFloors(project))),el("span",null,themes.length===1?"1 entrada no sorteio":themes.length+" entradas no sorteio · pode aparecer repetido"),el("span",null,project.coverDataUrl?"Capa personalizada":"Arte do jogo: "+theme.uiConfigs.packSpriteId));
    // Map settings.
    const m=layout.map,limit=globalThis.LetheExport.MAP_LIMITS[m.shape];
    document.querySelectorAll("[data-shape]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.shape===m.shape)));
    $("map-steps").max=limit;$("map-steps").value=m.steps;
    $("map-events").max=layout.cells;$("map-events").value=layout.events;
    $("map-events").disabled=project.fights.length===1;
    $("map-reroll").hidden=m.shape!=="tree";
    // Floor map from the exported node list.
    const map=$("floor-map");map.replaceChildren();
    map.style.setProperty("--basic",basic);
    const rows=m.shape==="tree"?3:1,gapX=76,gapY=66,pad=40;
    const pos=n=>({x:pad+n.sector*gapX,y:pad+((n.kind==="battle"||n.kind==="event")?n.idx:(rows===3?1:0))*gapY});
    const width=pad*2+(m.steps+2)*gapX,height=pad*2+(rows-1)*gapY+14;
    const board=el("div","map-board");board.style.width=width+"px";board.style.height=height+"px";
    const svg=document.createElementNS(svgNS,"svg");svg.setAttribute("viewBox","0 0 "+width+" "+height);svg.setAttribute("class","map-lines");
    const find=(sector,idx)=>layout.nodes.find(n=>n.sector===sector&&n.idx===idx);
    for(const n of layout.nodes)for(const idx of n.next){
      const to=find(n.sector+1,idx);if(!to)continue;
      const a=pos(n),b=pos(to),line=document.createElementNS(svgNS,"line");
      line.setAttribute("x1",a.x);line.setAttribute("y1",a.y);line.setAttribute("x2",b.x);line.setAttribute("y2",b.y);
      if(n.fight===selected||to.fight===selected)line.setAttribute("class","hot");
      svg.append(line);
    }
    board.append(svg);
    for(const n of layout.nodes){
      const fight=n.fight!==null?project.fights[n.fight]:null,base=fight&&byId.get(fight.templateId);
      const kind=n.kind==="battle"&&base.type==="Abnormality"?"abno":n.kind;
      const [ico,short,long]=nodeKinds[kind];
      const label=fight?(n.kind==="boss"?"Chefe":num(n.fight)):short;
      const title=fight?label+" · "+fightTitle(fight)+" · "+long:long;
      const dot=fight?btn("node-dot",undefined,()=>{selected=n.fight;render();$("floor-map").querySelector(".node.current .node-dot")?.focus({preventScroll:true});}):el("span","node-dot");
      if(ico)dot.innerHTML=icon(ico);else dot.textContent="?";
      dot.title=title;dot.setAttribute("aria-label",title);
      const wrapNode=el("div","node kind-"+kind+(fight&&n.fight===selected?" current":""));
      const p=pos(n);wrapNode.style.left=p.x+"px";wrapNode.style.top=p.y+"px";
      wrapNode.append(dot,el("span","node-label",n.kind==="boss"?"Chefe":fight?num(n.fight):short));
      board.append(wrapNode);
    }
    map.append(board);
    const counts={battle:0,event:0};layout.nodes.forEach(n=>{if(n.kind in counts)counts[n.kind]++;});
    $("floor-count").textContent=plural(m.steps,"passo","passos")+" · "+plural(counts.battle,"combate","combates")+" · "+plural(counts.event,"evento","eventos");
    const warn=$("map-warn");
    if(project.fights.length===1){warn.hidden=false;warn.textContent="Com uma luta só, ela é o chefe e todos os nós antes da loja viram eventos “?”.";}
    else if(layout.unused.length){warn.hidden=false;warn.textContent="Ficam fora do mapa: "+layout.unused.map(i=>num(i)+" "+byId.get(project.fights[i].templateId).name).join(", ")+". Aumente os passos ou diminua os eventos.";}
    else warn.hidden=true;
    const cur=map.querySelector(".node.current");
    if(cur)map.scrollLeft=cur.offsetLeft-map.clientWidth/2;
    // Detail of the selected fight.
    const fight=project.fights[selected],base=byId.get(fight.templateId);
    const detail=$("node-detail");detail.replaceChildren();
    const head=el("div","detail-head");
    head.append(el("span","selection-badge",selected===project.fights.length-1?"CHEFE":"LUTA "+num(selected)),el("strong",null,fightTitle(fight)),el("span","muted",selected===project.fights.length-1?"Nó final, depois da loja":labelType(base.type)));
    if(fight.chain)head.append(el("span","chip chain-chip","CHAIN BATTLE"));
    detail.append(head);
    fight.waves.forEach((wave,wi)=>{
      const row=el("div","detail-wave");
      const scene=sceneOf(fight,base,wi);
      row.append(el("span","wave-tag",fight.waves.length===1?"Onda única":"Onda "+(wi+1)));
      const units=el("ul","unit-chips");
      wave.forEach(u=>{const chip=el("li");chip.append(el("b",null,u.count+"×")," "+(enemyName.get(u.id)||u.id)+" ",el("small",null,"nv "+u.level));units.append(chip);});
      row.append(units);
      if(scene)row.append(el("span","muted scene","Cenário: "+scene));
      detail.append(row);
    });
    // ZIP contents.
    const paths=Object.keys(files);
    $("zip-count").textContent="("+paths.length+")";
    $("zip-list").replaceChildren(...paths.map(p=>{
      const v=files[p],size=typeof v==="string"?new Blob([v]).size:v.length;
      const li=el("li");li.append(el("code",null,"oficina-"+project.packId+"/"+p),el("span","muted",size<1024?size+" B":(size/1024).toFixed(1)+" KB"));return li;
    }));
  }
  // Andares: which floors offer the pack, per Mirror Dungeon mode.
  const LE=globalThis.LetheExport;
  function runs(list){
    const out=[];
    for(const f of list){const last=out[out.length-1];if(last&&f===last[1]+1)last[1]=f;else out.push([f,f]);}
    return out.map(([a,b])=>a===b?String(a+1):(a+1)+"–"+(b+1)).join(", ");
  }
  function floorsText(floors){
    const parts=[];
    if(floors.normal.length)parts.push("Normal: "+runs(floors.normal));
    if(floors.hard.length)parts.push("Difícil: "+runs(floors.hard));
    return parts.join(" · ")||"nenhum andar";
  }
  const floorBoxes={normal:[],hard:[]};
  function floorChip(mode,f){
    const id="floor-"+mode+"-"+f,wrap=el("label","floor-chip"),box=el("input");
    box.type="checkbox";box.id=id;wrap.htmlFor=id;
    box.addEventListener("change",()=>{
      const floors=LE.normalizeFloors(project);
      floors[mode]=box.checked?[...floors[mode],f]:floors[mode].filter(x=>x!==f);
      project.floors=LE.normalizeFloors({floors});changed(id);
    });
    wrap.append(box,el("span",null,String(f+1)));floorBoxes[mode][f]=box;return wrap;
  }
  (()=>{
    const normal=el("div","floor-row");normal.append(el("span","floor-act","Andares 1–5"));
    for(let f=0;f<LE.FLOOR_LIMITS.normal;f++)normal.append(floorChip("normal",f));
    $("floors-normal").append(normal);
    [["Andares 1–5",0],["Andares 6–10",5],["Andares 11–15 · extremo",10]].forEach(([label,start])=>{
      const row=el("div","floor-row");row.append(el("span","floor-act",label));
      for(let f=start;f<start+5;f++)row.append(floorChip("hard",f));
      $("floors-hard").append(row);
    });
    const range=(a,b)=>Array.from({length:b-a},(_,i)=>a+i);
    for(const [label,floors] of [["Só o andar 1",{normal:[0],hard:[0]}],["Normal inteiro",{normal:range(0,5),hard:[]}],["Difícil 6–10",{normal:[],hard:range(5,10)}],["Todos os andares",{normal:range(0,5),hard:range(0,15)}]]){
      $("floor-presets").append(btn("add preset",label,()=>{project.floors=LE.normalizeFloors({floors});changed(null);}));
    }
  })();
  function renderFloors(){
    const floors=LE.normalizeFloors(project);
    for(const mode of ["normal","hard"])floorBoxes[mode].forEach((box,f)=>{box.checked=floors[mode].includes(f);});
    const total=floors.normal.length+floors.hard.length;
    $("floor-badge").textContent=total?plural(total,"ANDAR","ANDARES"):"NENHUM ANDAR";
    $("floor-badge").classList.toggle("warn",!total);
  }
  // Encontros de abno: which events the "?" nodes draw, and which have rate up.
  const events=catalog.events||[];
  const eventRows=new Map();
  function setEvents(change){
    project.events={...LE.normalizeEvents(project),...change};
    project.events={...LE.normalizeEvents(project)};
    changed(null);
  }
  (()=>{
    const list=$("event-list");
    for(const ev of events){
      const li=el("li","event-row"),label=el("label","ev-allow"),box=el("input");
      box.type="checkbox";box.id="ev-"+ev.id;label.htmlFor=box.id;
      const text=el("span","ev-text");
      text.append(el("b",null,ev.name||(/^["“'‘]/.test(ev.desc)?ev.desc:"“"+ev.desc+"”")));
      const sub=[ev.gift?"Dá "+ev.gift:"",ev.name?ev.desc:"",ev.common?"":"exclusivo de poucos pacotes"].filter(Boolean).join(" · ");
      text.append(el("small",null,sub));
      label.append(box,text);
      const star=btn("ev-star","★",()=>{
        const cur=LE.normalizeEvents(project);
        setEvents({up:cur.up.includes(ev.id)?cur.up.filter(x=>x!==ev.id):[...cur.up,ev.id]});
      });
      star.setAttribute("aria-label","Rate up para "+(ev.name||ev.desc));
      box.addEventListener("change",()=>{
        const cur=LE.normalizeEvents(project);
        setEvents({allowed:box.checked?[...cur.allowed,ev.id]:cur.allowed.filter(x=>x!==ev.id)});
      });
      li.dataset.search=((ev.name||"")+" "+ev.desc+" "+(ev.gift||"")+" "+ev.id).toLowerCase();
      li.append(label,star);list.append(li);eventRows.set(ev.id,{li,box,star});
    }
    const ids=f=>events.filter(f).map(e=>e.id);
    for(const [label,pick] of [["Os 20 padrão",()=>LE.EVENT_POOL.slice()],["Todos os comuns",()=>ids(e=>e.common)],["Todos",()=>ids(()=>true)],["Nenhum",()=>[]]]){
      $("events-presets").append(btn("add preset",label,()=>setEvents({allowed:pick()})));
    }
    $("events-search").addEventListener("input",()=>{
      const q=$("events-search").value.trim().toLowerCase();
      for(const {li} of eventRows.values())li.hidden=!!q&&!li.dataset.search.includes(q);
    });
    $("events-chance").addEventListener("input",()=>{$("events-chance-out").textContent=$("events-chance").value+"%";});
    $("events-chance").addEventListener("change",()=>setEvents({chance:Number($("events-chance").value)}));
  })();
  function renderEvents(){
    const cur=LE.normalizeEvents(project);
    for(const [id,{li,box,star}] of eventRows){
      const on=cur.allowed.includes(id),up=cur.up.includes(id);
      box.checked=on;star.disabled=!on;star.setAttribute("aria-pressed",String(up));li.classList.toggle("off",!on);li.classList.toggle("up",up);
    }
    $("events-badge").textContent=cur.allowed.length+" LIBERADOS"+(cur.up.length?" · "+cur.up.length+" RATE UP":"");
    $("events-chance").value=String(cur.chance);$("events-chance-out").textContent=cur.chance+"%";
    $("events-chance").disabled=!cur.up.length;
    const nodes=layout?layout.nodes.filter(n=>n.kind==="event").length:0,warn=$("events-warn");
    if(nodes&&!cur.allowed.length){warn.hidden=false;warn.textContent="O mapa tem "+plural(nodes,"evento","eventos")+" “?”. Libere pelo menos um encontro para poder exportar.";}
    else if(nodes>cur.allowed.length){warn.hidden=false;warn.textContent="O mapa tem "+nodes+" eventos “?” e só "+cur.allowed.length+" encontros liberados. O jogo não repete um encontro no mesmo andar e completa com outros eventos do Mirror Dungeon.";}
    else if(!nodes){warn.hidden=false;warn.textContent="O mapa atual não tem eventos “?”. Aumente os eventos na prévia para estes encontros aparecerem.";}
    else warn.hidden=true;
  }
  // Bosses customizados: a Lethe boss mod ZIP joins the catalog and the pack.
  function bossUsage(boss){
    const fights=new Set(catalog.fights.filter(f=>f.custom===boss.key).map(f=>f.id));
    const enemies=new Set(catalog.enemies.filter(e=>e.custom===boss.key).map(e=>e.id));
    return project.fights.map((f,i)=>fights.has(f.templateId)||f.waves.flat().some(u=>enemies.has(u.id))?i:-1).filter(i=>i>=0);
  }
  function renderBosses(){
    const list=$("boss-list");list.replaceChildren();
    for(const boss of project.customBosses||[]){
      const fights=catalog.fights.filter(f=>f.custom===boss.key),enemies=catalog.enemies.filter(e=>e.custom===boss.key&&e.boss!==undefined);
      const used=bossUsage(boss);
      const li=el("li","boss-item"),text=el("div","boss-text");
      const mb=Bosses.size(boss)/1048576;
      text.append(el("b",null,boss.name),el("small",null,plural(enemies.length,"inimigo novo","inimigos novos")+" · "+plural(fights.length,"luta","lutas")+" · "+(mb>=1?mb.toFixed(1).replace(".",",")+" MB":Math.max(1,Math.round(mb*1024))+" KB")+(used.length?" · usado em "+used.map(num).join(", "):"")));
      const actions=el("div","boss-actions");
      const add=btn("add","Adicionar como luta final",()=>{
        const template=fights[0];if(!template)return;
        if(project.fights.length>=maxFights){alertError("O pacote já tem o máximo de "+maxFights+" lutas.");return;}
        project.fights.push(fromTemplate(template));selected=project.fights.length-1;changed("template");
        $("fight-list").lastElementChild?.scrollIntoView({block:"nearest"});
      });
      add.disabled=!fights.length;
      const remove=btn("quiet-link","Remover",()=>{
        project.customBosses=project.customBosses.filter(b=>b.key!==boss.key);
        Bosses.store.remove(boss.key).catch(()=>{});
        if(!project.customBosses.length)delete project.customBosses;
        useBosses(project.customBosses);changed(null);
      });
      remove.disabled=used.length>0;
      if(used.length)remove.title="Troque as lutas "+used.map(num).join(", ")+" antes de remover este boss.";
      actions.append(add,remove);li.append(text,actions);list.append(li);
    }
    $("boss-empty").hidden=!!project.customBosses?.length;
  }
  $("boss-upload").onclick=()=>$("boss-zip").click();
  $("boss-zip").onchange=async()=>{
    const file=$("boss-zip").files[0];$("boss-zip").value="";
    if(!file)return;
    $("boss-upload").disabled=true;
    const before=project.customBosses;
    try{
      if(!Bosses)throw Error("O módulo de bosses não carregou.");
      const boss=await Bosses.fromZip(await file.arrayBuffer(),file.name);
      const others=(project.customBosses||[]).filter(b=>b.key!==boss.key);
      const replaced=others.length!==(project.customBosses||[]).length;
      project.customBosses=[...others,boss];
      const problems=useBosses(project.customBosses);
      // A new version of the boss can change its fights (unit type, roster):
      // fights that no longer fit are rebuilt from the boss's current fight.
      const bossFight=catalog.fights.find(f=>f.custom===boss.key);
      const rebuilt=[];
      project.fights=project.fights.map((f,i)=>{
        if(validFight(f))return f;
        const base=byId.get(f.templateId)||bossFight||catalog.fights[0];
        const next=fromTemplate(base);if(f.title)next.title=f.title;
        rebuilt.push(num(i));return next;
      });
      alertError("");changed(null);
      const info=Bosses.describe(boss);
      const body=[el("p",null,(replaced?"Atualizei ":"Adicionei ")+boss.name+" ao editor: "+plural(info.enemies.length,"inimigo","inimigos")+" e "+plural(info.fights.length,"luta","lutas")+". Eles aparecem na busca de luta base e de inimigos, no grupo “Boss enviado”."),
        el("p",null,"Na exportação, os dados do inimigo, as skills, os buffs, os textos e os sprites do boss vão juntos dentro do pacote. Não instale o mod original do boss ao mesmo tempo, para não repetir os mesmos IDs.")];
      if(problems.length)body.push(el("p",null,problems.join(" ")));
      if(rebuilt.length)body.push(el("p",null,"A versão nova mudou as lutas do boss, então refiz "+(rebuilt.length===1?"a luta "+rebuilt[0]:"as lutas "+rebuilt.join(", "))+" a partir dela. Confira os inimigos na aba Lutas."));
      dialog(replaced?"Boss atualizado":"Boss adicionado",body);
      try{await Bosses.store.put(boss);}
      catch{alertError("O navegador não deixou guardar o boss (modo anônimo ou armazenamento cheio). Ele funciona nesta aba, mas precisa ser enviado de novo se a página for recarregada.");}
    }catch(e){
      if(before)project.customBosses=before;else delete project.customBosses;
      useBosses(project.customBosses);render();
      alertError("Não foi possível usar esse boss. "+e.message);
    }finally{$("boss-upload").disabled=false;}
  };
  function currentFight(){return project.fights[selected];}
  $("kind-normal").onclick=()=>{currentFight().chain=false;changed("kind-normal");};
  $("kind-chain").onclick=()=>{currentFight().chain=true;changed("kind-chain");};
  $("add-wave").onclick=()=>{
    const fight=currentFight(),last=fight.waves[fight.waves.length-1];
    fight.waves.push(last.map(u=>({...u})));
    if(Array.isArray(fight.maps))fight.maps.push(null);
    changed("scene-"+(fight.waves.length-1));
  };
  // Tabs: Lutas, E.G.O Gifts, Probabilidades.
  const tabs=[...document.querySelectorAll('[role="tab"]')];
  function showTab(tab,focus){
    for(const t of tabs){
      const on=t===tab;t.setAttribute("aria-selected",String(on));t.tabIndex=on?0:-1;
      $(t.getAttribute("aria-controls")).hidden=!on;
    }
    if(focus)tab.focus();
  }
  tabs.forEach((t,i)=>{
    t.addEventListener("click",()=>showTab(t));
    t.addEventListener("keydown",e=>{
      const step={ArrowRight:1,ArrowLeft:-1}[e.key];
      if(step){e.preventDefault();showTab(tabs[(i+step+tabs.length)%tabs.length],true);}
    });
  });
  function setMap(change,focusId){
    project.map={...globalThis.LetheExport.normalizeMap(project),...change};
    const limit=globalThis.LetheExport.MAP_LIMITS[project.map.shape];
    project.map.steps=Math.min(limit,Math.max(1,project.map.steps));
    project.map.events=Math.max(0,project.map.events);
    changed(focusId);
  }
  document.querySelectorAll("[data-shape]").forEach(b=>b.addEventListener("click",()=>setMap({shape:b.dataset.shape},null)));
  for(const [id,field] of [["map-steps","steps"],["map-events","events"]]){
    $(id).addEventListener("change",()=>{
      const v=$(id).valueAsNumber;
      if(!Number.isInteger(v)){renderPreview();return;}
      setMap({[field]:v},id);
    });
  }
  $("map-reroll").onclick=()=>setMap({seed:Math.floor(Math.random()*2**32)},"map-reroll");
  function render(){
    const currentSkin=globalThis.LETHE_SKINS.resolve(project);
    $("skin").value=currentSkin.id;
    $("swatch").style.backgroundColor=currentSkin.color;
    $("rate").value=String(project.rateUp??1);
    $("cover-state").hidden=!project.coverDataUrl;
    if(project.coverDataUrl)$("cover-preview").src=project.coverDataUrl;else $("cover-preview").removeAttribute("src");
    const fight=project.fights[selected],base=byId.get(fight.templateId);
    $("pack-name").value=project.name;
    $("template-slot").replaceChildren(picker({id:"template",label:"Luta base",value:base.id,items:fightItems,onPick:pickTemplate}));
    $("template-hint").hidden=!base.scripted;
    $("fight-title").placeholder=base.name;if(document.activeElement!==$("fight-title"))$("fight-title").value=fight.title||"";
    $("which-fight").textContent="LUTA "+num(selected);
    $("remove-fight").disabled=project.fights.length===1;
    $("move-up").disabled=selected===0;$("move-down").disabled=selected===project.fights.length-1;
    renderFloors();renderPreview();renderEvents();renderBosses();renderList();renderWaves(fight,base);summary();
  }
  let nameTimer=0;
  $("pack-name").addEventListener("input",e=>{project.name=e.target.value;save();summary();clearTimeout(nameTimer);nameTimer=setTimeout(renderPreview,150);});
  function pickTemplate(id){const title=project.fights[selected].title;project.fights[selected]=fromTemplate(byId.get(Number(id)));if(title)project.fights[selected].title=title;changed("template");}
  $("fight-title").addEventListener("input",()=>{
    const fight=project.fights[selected],v=$("fight-title").value;
    if(v.trim())fight.title=v;else delete fight.title;
    save();renderList();renderPreview();
  });
  $("fight-count").onchange=()=>{
    const current=project.fights.length;
    const target=$("fight-count").valueAsNumber;
    if(!Number.isInteger(target)||target<1||target>maxFights){$("fight-count").value=current;alertError("Escolha entre 1 e "+maxFights+" lutas.");return;}
    alertError("");
    if(target===current)return;
    if(target<current){
      $("fight-count").value=current;
      dialog("Encurtar o pacote?",[el("p",null,"O pacote ficará com as primeiras "+plural(target,"luta","lutas")+".")],"Aplicar quantidade",()=>{
        project.fights.length=target;selected=Math.min(selected,target-1);changed("fight-count");
      });
    } else {
      while(project.fights.length<target)project.fights.push(fromTemplate(catalog.fights[project.fights.length%catalog.fights.length]));
      selected=current;changed("fight-count");
    }
  };
  $("add-fight").onclick=()=>{
    const next=catalog.fights[(project.fights.length)%catalog.fights.length];
    project.fights.push(fromTemplate(next));selected=project.fights.length-1;changed("template");
    $("fight-list").lastElementChild?.scrollIntoView({block:"nearest"});
  };
  $("remove-fight").onclick=()=>{project.fights.splice(selected,1);selected=Math.min(selected,project.fights.length-1);changed("template");};
  function move(delta) {
    const target=selected+delta;const list=project.fights;
    [list[selected],list[target]]=[list[target],list[selected]];selected=target;changed("template");
  }
  $("move-up").onclick=()=>move(-1);$("move-down").onclick=()=>move(1);
  const installPath="BepInEx/plugins/Lethe/mods/";
  function dialog(title,nodes,confirmLabel="Entendi",onConfirm=null){
    $("dialog-title").textContent=title;$("dialog-body").replaceChildren(...nodes);
    $("ok").textContent=confirmLabel;
    $("ok").onclick=()=>{$("info").close();if(onConfirm)onConfirm();};
    $("info").showModal();
  }
  $("new-pack").onclick=()=>dialog("Criar outro pacote?",[el("p",null,"O novo pacote terá um identificador próprio. Exporte o pacote atual antes de substituir este rascunho.")],"Criar novo pacote",()=>{
    project=fresh();project.name="Meu theme pack";project.fights=project.fights.slice(0,1);selected=0;changed("pack-name");$("pack-name").select();
  });
  function installParagraph(){
    const p=el("p");p.append("Extraia o ZIP dentro de ",el("code",null,installPath)," na pasta do Lethe. Se estiver atualizando este pacote, mova a pasta da versão anterior para fora de mods antes de extrair. Assim, capas antigas também são substituídas.");return p;
  }
  $("help").onclick=()=>{
    const steps=el("ol");
    for(const s of ["Dê um nome ao pacote. Use “Adicionar luta” para aumentar a lista ou “Remover luta” para encurtá-la.","Selecione uma luta e escolha a luta base. Ela define o cenário e o grupo inicial. Troque os inimigos e ajuste as quantidades.","Use os botões de mover para ordenar as lutas. Quando terminar, clique em “Exportar pacote”."])steps.append(el("li",null,s));
    dialog("Como montar seu pacote",[steps,el("p",null,"Na aba Andares, escolha em quais andares o pacote aparece. O mapa termina sempre com uma loja e a última luta."),installParagraph()]);
  };
  $("close").onclick=()=>$("info").close();
  $("download").onclick=()=>{
    if(readingCover)return;
    try{
      alertError("");
      const paths=globalThis.LetheExport.buildFiles(project);
      const slug=project.name.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"pacote";
      const folder="lethe-"+slug+"-"+project.packId;
      const entries=Object.fromEntries(Object.entries(paths).map(([k,v])=>["oficina-"+project.packId+"/"+k,v]));
      const url=URL.createObjectURL(globalThis.packZip(entries));
      const a=el("a");a.download=folder+".zip";a.href=url;document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      dialog("Pacote exportado",[el("p",null,a.download),installParagraph(),el("p",null,"No Lethe, pressione 8 para recarregar os mods e procure o pacote na seleção de temas do Mirror Dungeon. Andares: "+floorsText(LE.normalizeFloors(project))+".")]);
    }catch(e){alertError("Falha ao exportar. "+e.message);}
  };
  loadDraft(savedDraft).then(notes=>{
    ready=true;render();save();
    if(notes.length)alertError(notes.join(" "));
  });
})();
