/* Gerador de Propostas Facilities – interface. Dados vêm de data/*.json (versionados no GitHub);
   modelos em assets/; histórico fica no navegador de quem emite. Cálculo em js/calc.js. */
(function(){
var $=function(id){return document.getElementById(id)};
var S={cfg:null,ccts:{},muns:{},postos:[],seq:0,ack:{}};
var SITE={},loaded=false;
var HKEY="ng-propostas-v1";
var MIME={pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"};
function h(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function brl(v){return "R$ "+Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}
function pct(v){return (v*100).toLocaleString("pt-BR",{maximumFractionDigits:2})+"%"}
function slug(s){return String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().replace(/[^A-Z0-9 ]/g," ").replace(/\s+/g," ").trim()}
function isoBr(iso){return String(iso||"").split("-").reverse().join("/")}
function own(o,k){return Object.prototype.hasOwnProperty.call(o,k)}
function mun(){var v=$("f-mun").value;return own(S.muns,v)?S.muns[v]:null}
function cct(){var m=mun();return m&&own(S.ccts,m.cct)?S.ccts[m.cct]:null}
var today=new Date(),todayIso=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
$("f-data").value=todayIso;

/* ---------- arquivos estáticos ---------- */
function getJSON(p){return fetch(p,{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error(p+" ("+r.status+")");return r.json()})}
var bin={};
function getBin(p){if(!bin[p])bin[p]=fetch(p,{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error("modelo");return r.arrayBuffer()}).catch(function(e){delete bin[p];throw e});return bin[p]}
function saveFile(name,blob){var a=document.createElement("a"),u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},4000);return Promise.resolve()}

/* ---------- município / CCT ---------- */
/* Alertas a conferir: os cadastrados no município + CCT vencida (vigencia_fim no passado). */
function alertsOf(m,c){var a=(m&&m.alertas||[]).slice();if(c&&c.vigencia_fim&&c.vigencia_fim<todayIso)a.push("A convenção cadastrada ("+c.registro+") venceu em "+isoBr(c.vigencia_fim)+". Confirme se já existe CCT nova com valores diferentes.");return a}
function fillMun(){
  var sel=$("f-mun"),cur=sel.value,ids=Object.keys(S.muns).sort(function(a,b){return S.muns[a].nome.localeCompare(S.muns[b].nome)});
  sel.innerHTML='<option value="">Selecione…</option>'+ids.map(function(id){var m=S.muns[id];return '<option value="'+h(id)+'">'+h(m.nome)+" / "+h(m.uf)+"</option>"}).join("")+'<option value="__outro">Outro município (não está na lista)</option>';
  if(cur&&(own(S.muns,cur)||cur==="__outro"))sel.value=cur;
}
function renderMun(){
  var v=$("f-mun").value,m=mun(),c=cct(),box=$("mun-info");
  $("pend-form").hidden=v!=="__outro";
  if(!m){box.innerHTML="";return}
  if(!c){box.innerHTML='<div class="box bad">O município está cadastrado, mas a convenção coletiva "'+h(m.cct)+'" não foi encontrada no cadastro. Peça o cadastro pelo formulário de município não cadastrado.</div>';return}
  var al=alertsOf(m,c).map(function(a,i){var k=v+"#"+i;return '<label class="chk"><input type="checkbox" data-ack="'+h(k)+'"'+(S.ack[k]?" checked":"")+"> "+h(a)+" Conferi este dado na fonte e confirmo o valor.</label>"}).join("");
  box.innerHTML='<div class="kv"><div><b>Convenção coletiva</b>'+h(c.nome)+'</div><div><b>Registro MTE</b>'+h(c.registro)+'</div><div><b>Vigência</b>'+h(c.vigencia)+'</div><div><b>ISS limpeza (7.10)</b>'+pct(m.iss_limp)+'</div><div><b>ISS mão de obra (17.05)</b>'+pct(m.iss_mo)+'</div><div><b>VT por dia</b>'+brl(m.vt_dia)+" <span class=\"note\">"+h(m.vt_obs||"")+"</span></div></div>"+(al?'<div class="box warn" style="margin-top:10px;display:flex;flex-direction:column;gap:6px"><strong>Dados a conferir antes de emitir</strong>'+al+"</div>":"");
}

/* ---------- postos ---------- */
function newPosto(){return{id:++S.seq,grupo:"",func:"",nome:"",tipo:"",sal:"",kit:"",escala:"5x2",dias:"",horario:"",postos:1,insal:0,acum:false,intervalo:false,premio:true,autor:""}}
function pisoOf(p){var c=cct();if(!c)return null;return c.pisos.filter(function(x){return x.id===p.func})[0]||null}
function renderPostos(){
  var c=cct(),el=$("postos");
  if(!c){el.innerHTML='<p class="note">Escolha primeiro o município: as funções e pisos vêm da convenção coletiva dele.</p>';$("add-posto").disabled=true;return}
  $("add-posto").disabled=false;
  if(!S.postos.length){el.innerHTML='<p class="note">Nenhum posto ainda. Adicione um bloco para cada função e escala pedida pelo cliente.</p>';return}
  el.innerHTML=S.postos.map(function(p,i){
    var id="po"+p.id,custom=p.func==="__outra",pi=pisoOf(p);
    var opts='<option value="">Selecione…</option>'+c.pisos.map(function(x){return '<option value="'+h(x.id)+'"'+(p.func===x.id?" selected":"")+">"+h(x.nome)+" – piso "+brl(x.piso)+"</option>"}).join("")+'<option value="__outra"'+(custom?" selected":"")+">Outra função (fora da tabela da CCT)</option>";
    var esc=Object.keys(NG.ESC).map(function(k){return '<option value="'+k+'"'+(p.escala===k?" selected":"")+">"+NG.ESC[k].label+"</option>"}).join("");
    var is12=p.escala.indexOf("12x36")===0;
    return '<div class="posto" data-id="'+p.id+'"><div class="hd"><strong>Posto '+(i+1)+'</strong><span class="row"><span class="price" id="'+id+'-price"></span><button class="link" data-del="'+p.id+'">Remover</button></span></div>'+
    '<div class="grid">'+
    '<label>Grupo na tabela de preços<input id="'+id+'-grupo" data-f="grupo" list="grupos" value="'+h(p.grupo)+'" placeholder="Ex.: Limpeza e Conservação"></label>'+
    '<label>Função (tabela da CCT)<select id="'+id+'-func" data-f="func">'+opts+"</select></label>"+
    '<label>Nome da função na proposta<input id="'+id+'-nome" data-f="nome" value="'+h(p.nome)+'"></label>'+
    '<label>Salário base (R$)<input id="'+id+'-sal" data-f="sal" type="number" step="0.01" min="0" value="'+h(p.sal)+'"></label>'+
    '<label>Kit de uniforme (R$/mês)<input id="'+id+'-kit" data-f="kit" type="number" step="0.01" min="0" value="'+h(p.kit)+'" placeholder="Informar valor da planilha de uniformes"></label>'+
    '<label>Enquadramento do ISS<select id="'+id+'-tipo" data-f="tipo"><option value="">Selecione…</option><option value="limp"'+(p.tipo==="limp"?" selected":"")+'>Limpeza/conservação (7.10)</option><option value="mo"'+(p.tipo==="mo"?" selected":"")+">Portaria/mão de obra (17.05)</option></select></label>"+
    '<label>Escala<select id="'+id+'-escala" data-f="escala">'+esc+"</select></label>"+
    (p.escala==="custom"?'<label>Dias trabalhados por mês (VT/VR)<input id="'+id+'-dias" data-f="dias" type="number" step="0.5" min="1" max="31" value="'+h(p.dias)+'"></label>':"")+
    '<label>Dias e horário (texto da proposta)<input id="'+id+'-horario" data-f="horario" value="'+h(p.horario)+'" placeholder="Ex.: seg a sex 8h–17h / sáb 8h–12h"></label>'+
    '<label>Quantidade de postos<input id="'+id+'-postos" data-f="postos" type="number" min="1" step="1" value="'+h(p.postos)+'"></label>'+
    '<label>Insalubridade (só se o cliente pedir ou houver laudo)<select id="'+id+'-insal" data-f="insal"><option value="0"'+(!p.insal?" selected":"")+'>Sem insalubridade</option><option value="0.2"'+(p.insal==0.2?" selected":"")+'>20% do salário mínimo</option><option value="0.4"'+(p.insal==0.4?" selected":"")+">40% do salário mínimo</option></select></label>"+
    ((custom||(pi&&Number(p.sal)>pi.piso))?'<label>Motivo do salário diferente do piso<input id="'+id+'-autor" data-f="autor" value="'+h(p.autor)+'" placeholder="Ex.: salário pedido pelo cliente no escopo"></label>':"")+
    "</div><div class=\"row\">"+
    '<label class="chk"><input type="checkbox" id="'+id+'-acum" data-f="acum"'+(p.acum?" checked":"")+"> Acúmulo de função (+"+pct(c.acumulo)+")</label>"+
    (is12?'<label class="chk"><input type="checkbox" id="'+id+'-intervalo" data-f="intervalo"'+(p.intervalo?" checked":"")+"> Intervalo de almoço indenizado (posto não fica descoberto)</label>":"")+
    '<label class="chk"><input type="checkbox" id="'+id+'-premio" data-f="premio"'+(p.premio?" checked":"")+"> Prêmio de assiduidade "+brl(c.premio)+"</label>"+
    "</div>"+(pi&&pi.obs?'<p class="note">'+h(pi.obs)+"</p>":"")+"</div>";
  }).join("")+'<datalist id="grupos"><option value="Limpeza e Conservação"><option value="Portaria"><option value="Controle de Acesso"><option value="Zeladoria"><option value="Facilities"></datalist>';
}
function validate(){
  var out=[],m=mun(),c=cct(),v=$("f-mun").value;
  if(!S.cfg)out.push("Parâmetros Neoguard (data/config.json) ainda não cadastrados.");
  if(!$("f-cliente").value.trim())out.push("Informe o nome do cliente.");
  if(!v)out.push("Escolha o município da prestação do serviço.");
  else if(v==="__outro")out.push("Município sem CCT cadastrada: peça o cadastro e aguarde a liberação.");
  if(!$("f-data").value)out.push("Informe a data da proposta.");
  if(!$("f-por").value.trim())out.push("Informe quem está emitindo a proposta.");
  if(m)alertsOf(m,c).forEach(function(a,i){if(!S.ack[v+"#"+i])out.push("Confira na fonte e confirme: "+a)});
  if(c&&!S.postos.length)out.push("Adicione pelo menos um posto.");
  S.postos.forEach(function(p,i){
    var n="Posto "+(i+1)+": ",pi=pisoOf(p);
    if(!p.grupo.trim())out.push(n+"informe o grupo da tabela de preços.");
    if(!p.func)out.push(n+"escolha a função.");
    if(!p.nome.trim())out.push(n+"informe o nome da função na proposta.");
    if(!(Number(p.sal)>0))out.push(n+"informe o salário base.");
    if(pi&&Number(p.sal)>0&&Number(p.sal)<pi.piso)out.push(n+"salário abaixo do piso da CCT ("+brl(pi.piso)+").");
    if((p.func==="__outra"||(pi&&Number(p.sal)>pi.piso))&&!p.autor.trim())out.push(n+"salário diferente da tabela da CCT. Informe o motivo.");
    if(p.kit===""||!(Number(p.kit)>=0))out.push(n+"kit de uniforme sem valor cadastrado para esta função. Informe o valor da planilha de uniformes.");
    if(!p.tipo)out.push(n+"escolha o enquadramento do ISS.");
    if(p.escala==="custom"&&!(Number(p.dias)>0))out.push(n+"informe os dias trabalhados por mês.");
    if(!p.horario.trim())out.push(n+"informe dias e horário.");
    if(!(Number(p.postos)>=1))out.push(n+"quantidade de postos inválida.");
  });
  if($("f-mat-on").checked){
    if(!(Number($("f-mat").value)>0)&&!(Number($("f-eq").value)>0))out.push("Materiais/equipamentos marcados, mas sem valor cotado.");
    if(!$("f-mat-desc").value.trim())out.push("Descreva a linha de materiais/equipamentos.");
  }
  return out;
}
function compute(){
  var m=mun(),c=cct();if(!m||!c||!S.cfg)return null;
  var rows=[];
  for(var i=0;i<S.postos.length;i++){var p=S.postos[i];
    if(!(Number(p.sal)>0)||p.kit===""||!p.tipo||(p.escala==="custom"&&!(Number(p.dias)>0))||!(Number(p.postos)>=1))return null;
    rows.push({p:p,r:NG.priceRow(S.cfg,c,m,{sal:p.sal,kit:p.kit,tipo:p.tipo,escala:p.escala,dias:p.dias,postos:Number(p.postos),insal:Number(p.insal),acum:p.acum,intervalo:p.escala.indexOf("12x36")===0&&p.intervalo,premio:p.premio})});
  }
  var ex=$("f-mat-on").checked?NG.priceExtras(S.cfg,m,$("f-mat").value,$("f-eq").value):null;
  var groups=[],gi={};
  rows.forEach(function(x){var g=x.p.grupo.trim().toUpperCase()||"(SEM GRUPO)";if(!(g in gi)){gi[g]=groups.length;groups.push({nome:g,rows:[],sub:0,colab:0})}var G=groups[gi[g]];G.rows.push(x);G.sub=NG.r2(G.sub+x.r.total);G.colab+=x.r.colab});
  var total=groups.reduce(function(a,g){return a+g.sub},0)+(ex?ex.total:0),colab=groups.reduce(function(a,g){return a+g.colab},0);
  return{rows:rows,groups:groups,ex:ex,total:NG.r2(total),colab:colab,m:m,c:c};
}
function funcLabel(p){var s=p.nome.trim();if(p.acum)s+=" (com acúmulo de função)";if(Number(p.insal)>0)s+=" – com adicional de insalubridade de "+Math.round(p.insal*100)+"%";return s}
function escLabel(p){var e=p.escala.indexOf("12x36")===0?NG.ESC[p.escala].label:"";return (e?e+" – ":"")+p.horario.trim()}
function colabTxt(n){return n+" colaborador"+(n>1?"es":"")}
function libsOk(){return typeof PDFLib!=="undefined"&&typeof JSZip!=="undefined"&&typeof XLSX!=="undefined"}
function refresh(){
  var iss=validate(),R=compute();
  S.postos.forEach(function(p){var el=$("po"+p.id+"-price");if(el){var x=R&&R.rows.filter(function(y){return y.p===p})[0];el.textContent=x?brl(x.r.total)+"/mês":""}});
  $("issues").innerHTML=iss.length?'<div class="box bad"><strong>Falta resolver antes de emitir ('+iss.length+")</strong><ul>"+iss.map(function(a){return"<li>"+h(a)+"</li>"}).join("")+"</ul></div>":'<div class="box ok">Tudo conferido. Pode emitir.</div>';
  var ok=!iss.length&&!!R&&libsOk();
  if(loaded&&!libsOk())$("emit-msg").textContent="As bibliotecas de geração de arquivos não carregaram. Verifique a internet e recarregue a página. [código: sem-libs]";
  $("btn-pdf").disabled=!ok;$("btn-docx").disabled=!ok;$("btn-xlsx").disabled=!ok;
  if(!R||!R.rows.length){$("result").innerHTML='<p class="note">A tabela de preços aparece aqui assim que município e postos estiverem completos.</p>';return}
  var t='<table><thead><tr><th>Postos</th><th>Função</th><th>Escala / turno</th><th>Total colab.</th><th>Valor por colaborador</th><th>Valor por posto</th><th>Valor total mensal</th></tr></thead><tbody>';
  R.groups.forEach(function(g){t+='<tr class="grp"><td colspan="7">'+h(g.nome)+"</td></tr>";
    g.rows.forEach(function(x){t+='<tr><td class="c">'+x.p.postos+"</td><td>"+h(funcLabel(x.p))+'</td><td class="c">'+h(escLabel(x.p))+'</td><td class="c">'+x.r.colab+'</td><td class="n">'+brl(x.r.preco)+'</td><td class="n">'+brl(x.r.posto)+'</td><td class="n">'+brl(x.r.total)+"</td></tr>"});
    t+='<tr class="sub"><td colspan="6">Subtotal '+h(g.nome)+" – "+colabTxt(g.colab)+'</td><td class="n">'+brl(g.sub)+"</td></tr>"});
  if(R.ex)t+='<tr class="grp"><td colspan="7">MATERIAIS E EQUIPAMENTOS</td></tr><tr><td class="c">1</td><td colspan="5">'+h($("f-mat-desc").value)+'</td><td class="n">'+brl(R.ex.total)+"</td></tr>";
  t+='<tr class="tot"><td colspan="6">TOTAL MENSAL DOS SERVIÇOS – '+colabTxt(R.colab)+'</td><td class="n" id="total-mensal">'+brl(R.total)+"</td></tr></tbody></table>";
  t+='<details style="margin-top:12px"><summary>Composição de custo por colaborador (interno)</summary><div class="scroll"><table style="margin-top:8px"><thead><tr><th>Função</th><th>Remuneração</th><th>Encargos</th><th>VT</th><th>VR</th><th>Benefícios</th><th>Insumos</th><th>Custo</th><th>BDI</th><th>ISS</th><th>Preço</th></tr></thead><tbody>'+R.rows.map(function(x){var r=x.r;return"<tr><td>"+h(x.p.nome)+'</td><td class="n">'+brl(r.rem)+'</td><td class="n">'+brl(r.enc)+'</td><td class="n">'+brl(r.vt)+'</td><td class="n">'+brl(r.vr)+'</td><td class="n">'+brl(r.benef)+'</td><td class="n">'+brl(r.insumos)+'</td><td class="n">'+brl(r.custo)+'</td><td class="n">'+brl(r.bdi)+'</td><td class="c">'+pct(r.iss)+'</td><td class="n">'+brl(r.preco)+"</td></tr>"}).join("")+"</tbody></table></div></details>";
  $("result").innerHTML=t;
}

/* ---------- eventos ---------- */
document.addEventListener("input",function(e){var t=e.target,card=t.closest&&t.closest(".posto");
  if(t.dataset&&t.dataset.ack){S.ack[t.dataset.ack]=t.checked;refresh();return}
  if(card&&t.dataset.f){var p=S.postos.filter(function(x){return x.id==card.dataset.id})[0],f=t.dataset.f;if(!p)return;
    p[f]=t.type==="checkbox"?t.checked:t.value;
    if(f==="func"){var pi=pisoOf(p);if(pi){p.nome=pi.nome.replace(/ \(.*\)$/,"");p.sal=pi.piso;p.kit=pi.kit==null?"":pi.kit;p.tipo=pi.tipo}else{p.sal="";p.kit="";p.tipo=""}renderPostos()}
    else if(f==="escala"){renderPostos()}
    else if(f==="sal"&&t.dataset.struct!=="1"){var need=p.func==="__outra"||(pisoOf(p)&&Number(p.sal)>pisoOf(p).piso),has=!!$("po"+p.id+"-autor");if(need!==has){renderPostos();var s=$("po"+p.id+"-sal");if(s){s.focus()}}}
  }
  refresh();
});
document.addEventListener("click",function(e){var t=e.target;
  if(t.dataset&&t.dataset.del){S.postos=S.postos.filter(function(x){return x.id!=t.dataset.del});renderPostos();refresh()}
});
$("add-posto").addEventListener("click",function(){S.postos.push(newPosto());renderPostos();refresh()});
$("f-mun").addEventListener("change",function(){S.postos=[];renderMun();renderPostos();refresh()});
$("f-mat-on").addEventListener("change",function(){$("mat-fields").hidden=!this.checked;refresh()});

/* ---------- DOCX (modelo Neoguard: assets/modelo-proposta.docx) ---------- */
/* Marcadores do modelo: "Cliente: {{CLIENTE}}" (capa), "{{DATA_EXTENSO}}" (assinatura) e a 1ª tabela (preços). */
var MK_CLI="Cliente: {{CLIENTE}}",MK_DATA="{{DATA_EXTENSO}}";
function X(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function wbrl(v){return "R$ "+Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}
function run(t,b,sz,color){return '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'+(b?"<w:b/><w:bCs/>":"")+'<w:sz w:val="'+(sz||16)+'"/><w:szCs w:val="'+(sz||16)+'"/>'+(color?'<w:color w:val="'+color+'"/>':"")+'</w:rPr><w:t xml:space="preserve">'+X(t)+"</w:t></w:r>"}
function para(runs,jc){return '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="'+(jc||"left")+'"/></w:pPr>'+runs.join("")+"</w:p>"}
var W=[380,1320,780,420,700,700,700];
function cell(i,runs,jc,fill,span){span=span||1;var w=0;for(var k=i;k<i+span;k++)w+=W[k];return '<w:tc><w:tcPr><w:tcW w:w="'+w+'" w:type="pct"/>'+(span>1?'<w:gridSpan w:val="'+span+'"/>':"")+'<w:shd w:val="clear" w:color="auto" w:fill="'+(fill||"FFFFFF")+'"/><w:vAlign w:val="center"/></w:tcPr>'+para(runs,jc)+"</w:tc>"}
function tr(cells,header){return "<w:tr><w:trPr><w:cantSplit/>"+(header?"<w:tblHeader/>":"")+'<w:jc w:val="center"/></w:trPr>'+cells.join("")+"</w:tr>"}
function tableXml(R){
  var DARK="1F1F1F",H=["Postos","Função","Escala / turno","Total colab.","Valor por colaborador","Valor por posto","Valor total mensal"];
  var out=[tr(H.map(function(t,i){return cell(i,[run(t,true,15,"FFFFFF")],"center",DARK)}),true)];
  R.groups.forEach(function(g){
    out.push(tr([cell(0,[run(g.nome,true,16)],"left","E7E6E6",7)]));
    g.rows.forEach(function(x){out.push(tr([cell(0,[run(String(x.p.postos))],"center"),cell(1,[run(funcLabel(x.p))]),cell(2,[run(escLabel(x.p))],"center"),cell(3,[run(String(x.r.colab))],"center"),cell(4,[run(wbrl(x.r.preco))],"right"),cell(5,[run(wbrl(x.r.posto))],"right"),cell(6,[run(wbrl(x.r.total))],"right")]))});
    out.push(tr([cell(0,[run("Subtotal "+titleCase(g.nome)+" – "+colabTxt(g.colab),true,16)],"right",null,6),cell(6,[run(wbrl(g.sub),true,16)],"right")]));
  });
  if(R.ex){out.push(tr([cell(0,[run("MATERIAIS E EQUIPAMENTOS",true,16)],"left","E7E6E6",7)]));
    out.push(tr([cell(0,[run("1")],"center"),cell(1,[run($("f-mat-desc").value.trim())],"left",null,5),cell(6,[run(wbrl(R.ex.total),true)],"right")]))}
  out.push(tr([cell(0,[run("TOTAL MENSAL DOS SERVIÇOS – "+colabTxt(R.colab),true,18,"FFFFFF")],"right",DARK,6),cell(6,[run(wbrl(R.total),true,16,"FFFFFF")],"right",DARK)]));
  var grid=W.map(function(w){return '<w:gridCol w:w="'+Math.round(9067*w/5000)+'"/>'}).join("");
  var bd=["top","left","bottom","right","insideH","insideV"].map(function(s){return "<w:"+s+' w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/>'}).join("");
  return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/><w:tblBorders>'+bd+'</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid>'+grid+"</w:tblGrid>"+out.join("")+"</w:tbl>";
}
function titleCase(s){return s.toLowerCase().replace(/(^|\s)(\S)/g,function(m,a,b){return a+b.toUpperCase()}).replace(/ (E|De|Da|Do) /g,function(m){return m.toLowerCase()})}
function noteText(R){
  var t=["Valores mensais."];
  if(R.rows.some(function(x){return x.r.cpp===2}))t.push("Postos 12x36 operam com 2 colaboradores por posto em revezamento; o valor do posto corresponde à soma dos seus colaboradores.");
  if(R.rows.some(function(x){return x.r.interv>0}))t.push("Nos postos 12x36 indicados o intervalo intrajornada é indenizado (já incluso no valor), sem descobrir o posto.");
  if(R.rows.some(function(x){return x.r.insal>0}))t.push("Adicional de insalubridade incluído nos postos indicados.");
  t.push("Estão inclusos encargos sociais, benefícios da Convenção Coletiva, uniformes e EPIs.");
  return t.join(" ");
}
function dataExtenso(iso){var p=iso.split("-"),M=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];return Number(p[2])+" de "+M[Number(p[1])-1]+" de "+p[0]+"."}
function reEsc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}
function buildDocx(R){
  return getBin("assets/modelo-proposta.docx").then(function(buf){return JSZip.loadAsync(buf)}).then(function(zip){
    return zip.file("word/document.xml").async("string").then(function(x){
      var t0=x.indexOf("<w:tbl>"),t1=x.indexOf("</w:tbl>")+8;
      if(t0<0||x.indexOf(MK_CLI)<0||x.indexOf(MK_DATA)<0)throw new Error("modelo");
      var note='<w:p><w:pPr><w:spacing w:before="60" w:after="60" w:line="260" w:lineRule="auto"/></w:pPr>'+run(noteText(R),false,15,"595959")+"</w:p>";
      x=x.slice(0,t0)+tableXml(R)+note+x.slice(t1);
      var cli="Cliente: "+X($("f-cliente").value.trim());
      x=x.split(MK_CLI).join(cli).split(MK_DATA).join(dataExtenso($("f-data").value));
      var ac=$("f-ac").value.trim();
      if(ac){var rx=new RegExp("("+reEsc(cli)+"</w:t></w:r></w:p><w:p [^>]*><w:pPr>(?:(?!</w:pPr>)[\\s\\S])*</w:pPr>)(</w:p>)","g");
        x=x.replace(rx,function(m,a,b){return a+'<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr><w:t xml:space="preserve">A/C: '+X(ac)+"</w:t></w:r>"+b})}
      var i=x.indexOf("A presente proposta contempla exclusivamente");
      if(i>=0){var j=x.indexOf("</w:t>",i);
        var obs=R.ex?"A presente proposta contempla a mão de obra e os materiais e equipamentos descritos na tabela de preços. Materiais de reposição sanitária (papel higiênico, papel toalha e sabonete) não estão incluídos. Os equipamentos permanecem de propriedade da Neoguard. ":"A presente proposta contempla exclusivamente a mão de obra, com uniformes, EPIs e benefícios da Convenção Coletiva aplicável. Materiais de limpeza, insumos e equipamentos não estão incluídos e poderão ser cotados à parte, se solicitado. ";
        x=x.slice(0,i)+X(obs)+x.slice(j)}
      if(!R.ex){x=x.split("Equipamentos profissionais").join("Procedimentos padronizados").split("Enceradeiras, lavadora de alta pressão e aspiradores industriais inclusos.").join("Rotinas de limpeza padronizadas, com checklists diários.")}
      if(!R.rows.some(function(y){return /encarregad/i.test(y.p.nome)}))x=x.split("Encarregada dedicada, checklists e acompanhamento da gestão Neoguard.").join("Supervisão periódica e acompanhamento da gestão Neoguard.");
      zip.file("word/document.xml",x);
      return zip.generateAsync({type:"blob",compression:"DEFLATE",mimeType:MIME.docx});
    });
  });
}
/* ---------- PDF (páginas do modelo assets/modelo-proposta.pdf + capa, tabela e data redesenhadas) ---------- */
function buildPdf(R){
  var P=PDFLib,rgb=P.rgb,hex=function(h){return rgb(parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255)};
  return getBin("assets/modelo-proposta.pdf").then(function(buf){return Promise.all([P.PDFDocument.load(buf),P.PDFDocument.create()])}).then(function(a){var tpl=a[0],doc=a[1];
    var mat=R.ex?1:0,enc=R.rows.some(function(y){return /encarregad/i.test(y.p.nome)})?1:0;
    return Promise.all([doc.embedFont(P.StandardFonts.Helvetica),doc.embedFont(P.StandardFonts.HelveticaBold)]).then(function(f){var F=f[0],FB=f[1];
      var clean=function(t){return String(t).replace(/[‐-‒]/g,"-").replace(/[^ -~ -ÿ–—‘’“”•…]/g,"")};
      var H=793.7,X0=85.3,TW=453.35,WP=[380,1320,780,420,700,700,700],cw=WP.map(function(w){return TW*w/5000}),PADX=3,PADY=2.6,LH=9.4,YMIN=70;
      var GREY=hex("A6A6A6"),DARK=hex("1F1F1F"),WHITE=rgb(1,1,1),INK=rgb(0,0,0),GFILL=hex("E7E6E6");
      function wrap(t,font,sz,w){var out=[],line="";clean(t).split(/ +/).forEach(function(word){var tr=line?line+" "+word:word;if(font.widthOfTextAtSize(tr,sz)<=w||!line)line=tr;else{out.push(line);line=word}});if(line)out.push(line);return out}
      function blankPage(){return doc.copyPages(tpl,[3]).then(function(p){doc.addPage(p[0]);return p[0]})}
      return doc.copyPages(tpl,[0,1,2]).then(function(ps){
        ps.forEach(function(p){doc.addPage(p)});
        ps[0].drawText(clean("Cliente: "+$("f-cliente").value.trim()),{x:39.7,y:H-396.75,size:12,font:F,color:INK});
        var ac=$("f-ac").value.trim();if(ac)ps[0].drawText(clean("A/C: "+ac),{x:39.7,y:H-417.45,size:12,font:F,color:INK});
        /* linhas da tabela: cada célula = {i,span,text,bold,sz,color,fill,al} */
        var rows=[],c=function(i,text,o){o=o||{};return{i:i,span:o.span||1,text:text,font:o.b?FB:F,sz:o.sz||8,color:o.color||INK,fill:o.fill||null,al:o.al||"left"}};
        rows.push(["Postos","Função","Escala / turno","Total colab.","Valor por colaborador","Valor por posto","Valor total mensal"].map(function(t,i){return c(i,t,{b:1,sz:7.5,color:WHITE,fill:DARK,al:"center"})}));
        R.groups.forEach(function(g){
          rows.push([c(0,g.nome,{b:1,span:7,fill:GFILL})]);
          g.rows.forEach(function(x){rows.push([c(0,String(x.p.postos),{al:"center"}),c(1,funcLabel(x.p)),c(2,escLabel(x.p),{al:"center"}),c(3,String(x.r.colab),{al:"center"}),c(4,wbrl(x.r.preco),{al:"right"}),c(5,wbrl(x.r.posto),{al:"right"}),c(6,wbrl(x.r.total),{al:"right"})])});
          rows.push([c(0,"Subtotal "+titleCase(g.nome)+" – "+colabTxt(g.colab),{b:1,span:6,al:"right"}),c(6,wbrl(g.sub),{b:1,al:"right"})]);
        });
        if(R.ex){rows.push([c(0,"MATERIAIS E EQUIPAMENTOS",{b:1,span:7,fill:GFILL})]);rows.push([c(0,"1",{al:"center"}),c(1,$("f-mat-desc").value.trim(),{span:5}),c(6,wbrl(R.ex.total),{b:1,al:"right"})])}
        rows.push([c(0,"TOTAL MENSAL DOS SERVIÇOS – "+colabTxt(R.colab),{b:1,sz:9,span:6,al:"right",color:WHITE,fill:DARK}),c(6,wbrl(R.total),{b:1,color:WHITE,fill:DARK,al:"right"})]);
        var page=ps[2],y=H-150,chain=Promise.resolve();
        function drawRow(cells){
          var hgt=0;cells.forEach(function(k){k.w=0;for(var j=k.i;j<k.i+k.span;j++)k.w+=cw[j];k.x=X0;for(var j2=0;j2<k.i;j2++)k.x+=cw[j2];k.lines=wrap(k.text,k.font,k.sz,k.w-2*PADX);hgt=Math.max(hgt,k.lines.length*(k.sz+1.4)+2*PADY)});
          var go=function(){
            cells.forEach(function(k){
              page.drawRectangle({x:k.x,y:y-hgt,width:k.w,height:hgt,color:k.fill||WHITE,borderColor:GREY,borderWidth:.5});
              var lh=k.sz+1.4,ty=y-(hgt-k.lines.length*lh)/2-k.sz*0.82;
              k.lines.forEach(function(l,n){var tw=k.font.widthOfTextAtSize(l,k.sz),tx=k.al==="right"?k.x+k.w-PADX-tw:k.al==="center"?k.x+(k.w-tw)/2:k.x+PADX;page.drawText(l,{x:tx,y:ty-n*lh,size:k.sz,font:k.font,color:k.color})});
            });y-=hgt};
          if(y-hgt<YMIN)return blankPage().then(function(np){page=np;y=H-125;go()});
          go();return null;
        }
        rows.forEach(function(r){chain=chain.then(function(){return drawRow(r)})});
        return chain.then(function(){
          var nl=wrap(noteText(R),F,7.5,TW),need=nl.length*LH+8;
          var put=function(){y-=6;nl.forEach(function(l){y-=LH;page.drawText(l,{x:X0,y:y,size:7.5,font:F,color:hex("595959")})})};
          if(y-need<YMIN)return blankPage().then(function(np){page=np;y=H-125;put()});put();
        }).then(function(){return doc.copyPages(tpl,[4+mat*2+enc,mat?10:8,mat?11:9])}).then(function(q){
          q.forEach(function(p){doc.addPage(p)});
          q[2].drawText(clean(dataExtenso($("f-data").value)),{x:445.3,y:H-354.65,size:11,font:F,color:INK});
          return doc.save();
        });
      });
    });
  }).then(function(bytes){return new Blob([bytes],{type:MIME.pdf})});
}
function baseName(){return slug($("f-cliente").value)+" - "+$("f-data").value+"_v"+(parseInt($("f-versao").value,10)||1)}

/* ---------- histórico (só neste navegador) ---------- */
function histLoad(){try{var a=JSON.parse(localStorage.getItem(HKEY)||"[]");return Array.isArray(a)?a:[]}catch(e){return[]}}
function renderHist(){
  var a=histLoad();
  if(!a.length){$("hist").innerHTML='<p class="note">As propostas emitidas neste navegador aparecem aqui, com data, cliente, município e valor.</p>';return}
  $("hist").innerHTML='<table><thead><tr><th>Data</th><th>Cliente</th><th>Município</th><th>Versão</th><th>Colab.</th><th>Valor mensal</th><th>Emitida por</th></tr></thead><tbody>'+a.map(function(x){return'<tr><td class="c">'+h(isoBr(x.data))+"</td><td>"+h(x.cliente)+"</td><td>"+h(x.municipio)+'</td><td class="c">v'+h(x.versao)+'</td><td class="c">'+h(x.colab)+'</td><td class="n">'+brl(x.total||0)+"</td><td>"+h(x.emitida_por)+"</td></tr>"}).join("")+"</tbody></table>";
}
function record(R){
  var id=(slug($("f-cliente").value)+"-"+$("f-data").value+"-v"+(parseInt($("f-versao").value,10)||1)).toLowerCase().replace(/[^a-z0-9]+/g,"-");
  var doc={id:id,cliente:$("f-cliente").value.trim(),ac:$("f-ac").value.trim(),municipio:R.m.nome+"/"+R.m.uf,cct:R.c.registro,data:$("f-data").value,versao:parseInt($("f-versao").value,10)||1,
    emitida_por:$("f-por").value.trim(),em:new Date().toISOString(),total:R.total,colab:R.colab,versao_site:SITE.versao||"",
    postos:R.rows.map(function(x){return{grupo:x.p.grupo,funcao:funcLabel(x.p),escala:escLabel(x.p),postos:Number(x.p.postos),colab:x.r.colab,salario:Number(x.p.sal),kit:Number(x.p.kit),premio:!!x.p.premio,autorizado_por:x.p.autor||"",preco_colab:x.r.preco,total:x.r.total}}),
    materiais:R.ex?{descricao:$("f-mat-desc").value.trim(),custo_materiais:Number($("f-mat").value)||0,investimento_equip:Number($("f-eq").value)||0,preco:R.ex.total}:null,
    confirmacoes:alertsOf(R.m,R.c)};
  var a=[doc].concat(histLoad().filter(function(x){return x.id!==id})).slice(0,40);
  try{localStorage.setItem(HKEY,JSON.stringify(a))}catch(e){}
  renderHist();
}
function fail(e){$("emit-msg").textContent=(e&&e.message==="modelo")?"O modelo da proposta não foi encontrado ou não foi reconhecido. Recarregue a página e tente de novo. [código: modelo]":"Não foi possível gerar o arquivo. [código: "+((e&&e.name)||"erro")+(e&&e.message?" – "+String(e.message).slice(0,120):"")+"]"}
function emit(kind,build,ext,okMsg){return function(){var R=compute();if(!R||validate().length)return;$("emit-msg").textContent=kind;
  build(R).then(function(blob){return saveFile("PROPOSTA COMERCIAL FACILITIES - "+baseName()+"."+ext,blob)}).then(function(){$("emit-msg").textContent=okMsg;record(R)}).catch(fail)}}
$("btn-docx").addEventListener("click",emit("Gerando a proposta…",buildDocx,"docx","Proposta baixada e registrada no histórico deste navegador."));
$("btn-pdf").addEventListener("click",emit("Gerando o PDF…",buildPdf,"pdf","PDF baixado e registrado no histórico deste navegador."));
$("btn-xlsx").addEventListener("click",function(){var R=compute();if(!R||validate().length)return;
  try{var wb=XLSX.utils.book_new(),c=R.c,m=R.m,g=S.cfg;
    var res=[["RESUMO – "+$("f-cliente").value.trim()+" – "+$("f-data").value+" – v"+$("f-versao").value],[],["Postos","Colab.","Função","Escala","Valor por colaborador","Valor por posto","Valor total mensal"]];
    R.rows.forEach(function(x){res.push([Number(x.p.postos),x.r.colab,funcLabel(x.p),escLabel(x.p),x.r.preco,x.r.posto,x.r.total])});
    if(R.ex)res.push([1,"",$("f-mat-desc").value.trim(),"","","",R.ex.total]);res.push(["",R.colab,"TOTAL MENSAL","","","",R.total]);
    var po=[["Grupo","Função","Salário base","Insalubridade","Adic. noturno","Remuneração","Encargos","VT líquido","VR","Prêmio assiduidade","Intervalo indenizado","Benefícios fixos (total)","Insumos (kit+ASO+treino+mat.)","Custo","BDI","Crédito PIS/COFINS","ISS","Preço por colaborador","Colab.","Total mensal","Dias VT/VR","Motivo salário fora do piso"]];
    R.rows.forEach(function(x){var r=x.r;po.push([x.p.grupo,funcLabel(x.p),r.sal,r.insal,r.noturno,r.rem,r.enc,r.vt,r.vr,r.premio,r.interv,r.benef,r.insumos,r.custo,r.bdi,r.cred,r.iss,r.preco,r.colab,r.total,r.dias,x.p.autor||""])});
    var pa=[["Parâmetro","Valor"],["Município",m.nome+"/"+m.uf],["CCT",c.nome],["Registro MTE",c.registro],["Vigência",c.vigencia],["Encargos sociais",c.enc],["Adicional noturno",c.adn],["VR/dia",c.vr],["Desconto VR/dia",c.vr_desc],["Cesta básica",c.cesta],["Prêmio de assiduidade",c.premio],["PPR anual",c.ppr],["Benefício social",c.social],["Assistência saúde",c.saude],["Salário mínimo (base insalubridade)",c.sm],["Acúmulo de função",c.acumulo],["ISS limpeza",m.iss_limp],["ISS mão de obra",m.iss_mo],["VT/dia",m.vt_dia],["BDI administração",g.bdi_adm],["BDI lucro",g.bdi_luc],["PIS",g.pis],["COFINS",g.cofins],["Desconto VT empregado",g.vtd],["Seguro de vida",g.seg],["Treinamento",g.trein],["ASO",g.aso],["Materiais individuais",g.matind],["Plantões/mês 12x36",g.plant],["Emitida por",$("f-por").value.trim()],["Versão do gerador",SITE.versao||"dev"]];
    if(R.ex)pa.push(["Custo mensal materiais (cotado)",Number($("f-mat").value)||0],["Investimento equipamentos (cotado)",Number($("f-eq").value)||0],["Reserva técnica materiais",g.res],["Amortização (meses)",g.amort],["Manutenção equipamentos",g.manut]);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(res),"RESUMO");XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(po),"POSTOS");XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(pa),"PARAMETROS");
    var buf=XLSX.write(wb,{type:"array",bookType:"xlsx"});
    saveFile("MEMORIA - "+baseName()+".xlsx",new Blob([buf],{type:MIME.xlsx})).then(function(){$("emit-msg").textContent="Memória de cálculo baixada."}).catch(fail);
  }catch(e){fail(e)}});

/* ---------- pedido de cadastro de CCT (e-mail; o PDF vai anexado pelo vendedor) ---------- */
$("p-send").addEventListener("click",function(){
  var cid=$("p-cidade").value.trim(),uf=$("p-uf").value.trim().toUpperCase(),msg=$("p-msg");
  if(!cid||uf.length!==2){msg.textContent="Informe município e UF.";return}
  var subj="Cadastro de CCT – "+cid+"/"+uf;
  var body=["Pedido de cadastro de convenção coletiva no Gerador de Propostas Facilities.","",
    "Município: "+cid+"/"+uf,"Sindicato / nº de registro da CCT: "+($("p-reg").value.trim()||"não informado"),
    "Cliente que motivou o pedido: "+($("p-cli").value.trim()||"não informado"),"Pedido por: "+($("f-por").value.trim()||"não informado"),"",
    "Observações (ISS, tarifa de ônibus, fonte):",$("p-obs").value.trim()||"—","","PDF da convenção coletiva: ANEXAR A ESTE E-MAIL."].join("\n");
  var copied=navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(subj+"\n\n"+body).then(function(){return true},function(){return false}):Promise.resolve(false);
  copied.then(function(ok){
    if(SITE.contato_cadastro_cct){location.href="mailto:"+SITE.contato_cadastro_cct+"?subject="+encodeURIComponent(subj)+"&body="+encodeURIComponent(body);
      msg.textContent="Pedido aberto no seu e-mail. Anexe o PDF da convenção antes de enviar."+(ok?" (O texto também foi copiado.)":"")}
    else msg.textContent=ok?"Pedido copiado. Envie com o PDF da convenção para o responsável pelo cadastro.":"Copie os dados acima e envie com o PDF da convenção para o responsável pelo cadastro.";
  });
});

/* ---------- carga ---------- */
function start(){
  refresh();renderPostos();renderHist();
  if(location.protocol==="file:"){$("conn").textContent="Aberto como arquivo";$("fatal").hidden=false;$("fatal").textContent="Abra pelo endereço publicado (ou rode \"npm start\" e acesse http://localhost:8080). Aberta direto do disco, a página não consegue ler o cadastro.";return}
  Promise.all([getJSON("data/config.json"),getJSON("data/ccts.json"),getJSON("data/municipios.json"),getJSON("data/site.json").catch(function(){return{}}),getJSON("version.json").catch(function(){return null})]).then(function(a){
    S.cfg=a[0]||null;S.ccts=a[1]||{};S.muns=a[2]||{};SITE=a[3]||{};loaded=true;
    if(a[4]&&a[4].version){SITE.versao=a[4].version;$("ver").textContent=a[4].version}
    if(SITE.contato_cadastro_cct)$("p-send").textContent="Abrir e-mail de pedido de cadastro";
    $("conn").textContent="Dados carregados";
    if(!S.cfg){$("fatal").hidden=false;$("fatal").textContent="Parâmetros Neoguard ainda não cadastrados (data/config.json). Nenhum cálculo é possível até o cadastro."}
    else{$("fatal").hidden=true;$("mat-note").textContent="Use valores cotados com fornecedor. A página aplica "+pct(S.cfg.res)+" de reserva técnica nos materiais, amortização de "+S.cfg.amort+" meses + "+pct(S.cfg.manut)+" de manutenção nos equipamentos, BDI e tributos."}
    fillMun();renderMun();renderPostos();refresh();
  }).catch(function(e){$("conn").textContent="Erro ao ler os dados";$("fatal").hidden=false;$("fatal").textContent="Não foi possível ler o cadastro de convenções. Recarregue a página. ["+String(e&&e.message||e).slice(0,120)+"]"});
}
start();
})();
