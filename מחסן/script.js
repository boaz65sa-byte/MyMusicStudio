/* --- נתונים וקבועים --- */
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const TUNING = [0, 5, 9, 2]; // C F A D
const NUM_FRETS = 19;
const STRING_FREQS = [130.81, 174.61, 220.00, 293.66];

// מאגר מקאמים ומודוסים מלא ומסודר
const SCALES_DATA = {
    "Greek Dromoi (מודוסים יווניים)": {
        "hitzaz": [0,1,4,5,7,8,10],
        "hitzazkiar": [0,1,4,5,7,8,11],
        "piraiotikos": [0,1,4,6,7,8,11],
        "niavent": [0,2,3,5,7,8,10],
        "oussak": [0,1,3,5,7,8,10],
        "kourdi": [0,1,3,5,7,8,10],
        "sabah": [0,1,3,4,7,8,10],
        "rast": [0,2,4,5,7,9,11],
        "houzam": [0,3,4,7,8,11],
        "segah": [0,3,4,7,8,10],
        "tabani": [0,2,4,5,7,9,11],
        "kartsigar": [0,2,3,5,7,8,10]
    },
    "Arabic Maqams (מקאמים ערביים)": {
        "bayati": [0,1,3,5,7,8,10],
        "saba": [0,1,3,4,6,8,10],
        "nahawand": [0,2,3,5,7,8,11],
        "ajam": [0,2,4,5,7,9,11],
        "siga": [0,3,4,7,8,10],
        "kard": [0,1,3,5,7,8,10],
        "mahur": [0,2,4,5,7,9,11],
        "nikriz": [0,2,3,6,7,8,10],
        "hijaz_kar": [0,1,4,5,7,8,11]
    },
    "Western Modes (מודוסים מערביים)": {
        "major": [0,2,4,5,7,9,11],
        "minor": [0,2,3,5,7,8,10],
        "harmonic_minor": [0,2,3,5,7,8,11],
        "dorian": [0,2,3,5,7,9,10],
        "phrygian": [0,1,3,5,7,8,10],
        "lydian": [0,2,4,6,7,9,11],
        "mixolydian": [0,2,4,5,7,9,10]
    }
};

let audioCtx = null;
let activeOscs = [];
let melodySeq = [];
let chordSeq = [];
let isPlaying = false;
let currentInsChord = null;

// --- אתחול ---
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    buildInstrument();
    updateSystem(); 
    loadSavedList();
});

function initUI() {
    // מילוי סולמות עם כותרות
    const sSel = document.getElementById('scaleSelect');
    for (const [groupName, scales] of Object.entries(SCALES_DATA)) {
        let group = document.createElement('optgroup');
        group.label = groupName;
        for (const [key, val] of Object.entries(scales)) {
            let opt = document.createElement('option');
            opt.value = groupName + "|" + key; // שומרים גם את שם הקבוצה לזיהוי
            opt.innerText = key.charAt(0).toUpperCase() + key.slice(1);
            group.appendChild(opt);
        }
        sSel.appendChild(group);
    }

    // מילוי שורש
    const rSel = document.getElementById('rootSelect');
    NOTES.forEach((n, i) => {
        let o = document.createElement('option');
        o.value = i; o.innerText = n;
        if(n==='D') o.selected=true;
        rSel.appendChild(o);
    });

    // אירועים
    document.getElementById('btnUpdate').onclick = updateSystem;
    document.getElementById('btnFlip').onclick = () => document.getElementById('instrument').classList.toggle('flip');
    document.getElementById('btnInv').onclick = () => modChord('inv');
    document.getElementById('btn7th').onclick = () => modChord('7th');
    document.getElementById('btnAddChord').onclick = addInsChord;
    
    document.getElementById('btnPlay').onclick = playAll;
    document.getElementById('btnStop').onclick = stopAll;
    document.getElementById('btnClear').onclick = () => { melodySeq=[]; chordSeq=[]; renderTimeline(); };
    
    document.getElementById('btnSave').onclick = saveSong;
    document.getElementById('btnLoad').onclick = loadSong;
    document.getElementById('btnDelete').onclick = deleteSong;
}

// --- בניית הבוזוקי ---
function buildInstrument() {
    const head = document.getElementById('headstock');
    const neck = document.getElementById('fretboard');
    const scaleLen = 1 - Math.pow(0.9438, NUM_FRETS + 1);
    function gp(i) { return ((1 - Math.pow(0.9438, i)) / scaleLen) * 100; }

    for(let i=1; i<=NUM_FRETS; i++) {
        let p = gp(i);
        let c = (gp(i) + gp(i-1))/2;
        let l = document.createElement('div'); l.className='fret-line'; l.style.left=p+'%'; neck.appendChild(l);
        let n = document.createElement('div'); n.className='fret-num txt-fix'; n.innerText=i; n.style.left=c+'%'; neck.appendChild(n);
        if([3,5,7,9,15,17,19].includes(i)) { let d=document.createElement('div'); d.className='inlay'; d.style.left=c+'%'; neck.appendChild(d); }
        if(i===12) {
            let d1=document.createElement('div'); d1.className='inlay top'; d1.style.left=c+'%'; neck.appendChild(d1);
            let d2=document.createElement('div'); d2.className='inlay bottom'; d2.style.left=c+'%'; neck.appendChild(d2);
        }
    }

    for(let i=3; i>=0; i--) {
        makeRow(i, head, true); makeRow(i, neck, false);
    }
}

function makeRow(i, p, h) {
    let d=document.createElement('div'); d.className='course'; d.dataset.idx=i;
    let s=i<2?'str-gold':'str-silver', ht=i===0?'h3':(i===1?'h2':'h1');
    d.innerHTML=`<div class="string ${s} ${ht}"></div><div class="string str-silver h1"></div>`;
    if(h) d.innerHTML+=`<div class="tune-char txt-fix">${NOTES[TUNING[i]]}</div>`;
    p.appendChild(d);
}

// --- לוגיקה ראשית ---
function updateSystem() {
    document.querySelectorAll('.marker, .chord-dot').forEach(e=>e.remove());
    
    let root = parseInt(document.getElementById('rootSelect').value);
    let val = document.getElementById('scaleSelect').value.split('|'); // Group|Key
    let group = val[0], key = val[1];
    
    // שליפה מהאובייקט המקונן
    let ints = SCALES_DATA[group][key];
    let notes = ints.map(x=>(root+x)%12);

    for(let s=0; s<4; s++) {
        let b = TUNING[s];
        for(let f=0; f<=NUM_FRETS; f++) {
            let n = (b+f)%12;
            if(notes.includes(n)) makeMarker(s,f,n,n===root);
        }
    }
    genChords(root, ints);
}

function makeMarker(s, f, n, isR) {
    let c = f===0 ? document.getElementById('headstock') : document.getElementById('fretboard');
    let r = Array.from(c.querySelectorAll('.course')).find(x=>x.dataset.idx==s);
    if(r) {
        let m=document.createElement('div'); m.className=isR?'marker root txt-fix':'marker txt-fix';
        m.innerHTML=`<span>${NOTES[n]}</span>`; m.dataset.s=s; m.dataset.f=f;
        
        if(f===0) m.style.left='45px';
        else {
            const K = 1 - Math.pow(0.9438, NUM_FRETS + 1);
            let p = ((1-Math.pow(0.9438, f))/K)*100, pr = ((1-Math.pow(0.9438, f-1))/K)*100;
            m.style.left = ((p+pr)/2)+'%';
        }
        
        m.onclick=()=>{
            let fr=STRING_FREQS[s]*Math.pow(2, f/12);
            play(fr); flash(m);
            melodySeq.push({n:NOTES[n], s, f, fr}); renderTimeline();
        };
        r.appendChild(m);
    }
}

// --- אקורדים ---
function genChords(root, ints) {
    const grid = document.getElementById('chordGrid'); grid.innerHTML='';
    for(let i=0; i<ints.length; i++) {
        let n1=(root+ints[i])%12, n3=(root+ints[(i+2)%ints.length])%12, n5=(root+ints[(i+4)%ints.length])%12;
        let d3=(n3-n1+12)%12, d5=(n5-n1+12)%12;
        let t=(d3==4&&d5==7)?'':(d3==3&&d5==7)?'m':(d3==3&&d5==6)?'dim':'?';
        
        if(t!=='?') {
            let name=NOTES[n1]+t, arr=[n1,n3,n5], fr=arr.map(x=>220*Math.pow(2,(x-9)/12));
            let btn=document.createElement('button'); btn.className='chord-select-btn'; btn.innerText=name;
            let obj={name, arr, fr};
            btn.onclick=()=>{ loadIns(obj); strum(fr); viz(arr); };
            grid.appendChild(btn);
        }
    }
}

function loadIns(obj) {
    currentInsChord = JSON.parse(JSON.stringify(obj));
    updIns();
}
function updIns() {
    document.getElementById('insName').innerText=currentInsChord.name;
    document.getElementById('insNotes').innerText=currentInsChord.arr.map(x=>NOTES[x]).join(' - ');
}
function modChord(type) {
    if(!currentInsChord)return;
    if(type==='inv') {
        currentInsChord.arr.push(currentInsChord.arr.shift());
        currentInsChord.fr.push(currentInsChord.fr.shift()*2);
        currentInsChord.name+='/Inv';
    }
    if(type==='7th') {
        let last=currentInsChord.arr[currentInsChord.arr.length-1];
        let next=(last+3)%12; currentInsChord.arr.push(next);
        currentInsChord.fr.push(currentInsChord.fr[currentInsChord.fr.length-1]*1.2);
        currentInsChord.name+='7';
    }
    updIns(); strum(currentInsChord.fr); viz(currentInsChord.arr);
}
function viz(arr) {
    document.querySelectorAll('.chord-dot').forEach(e=>e.remove());
    for(let s=0; s<4; s++) {
        let b=TUNING[s];
        for(let f=0; f<=12; f++) {
            let n=(b+f)%12;
            if(arr.includes(n)) {
                let c=f===0?document.getElementById('headstock'):document.getElementById('fretboard');
                let r=Array.from(c.querySelectorAll('.course')).find(x=>x.dataset.idx==s);
                if(r) {
                    let d=document.createElement('div'); d.className='chord-dot txt-fix'; d.innerText=NOTES[n];
                    if(f===0) d.style.left='45px'; else {
                        const K=1-Math.pow(0.9438, NUM_FRETS+1);
                        let p=((1-Math.pow(0.9438,f))/K)*100, pr=((1-Math.pow(0.9438,f-1))/K)*100;
                        d.style.left=((p+pr)/2)+'%';
                    }
                    r.appendChild(d);
                }
            }
        }
    }
    setTimeout(()=>document.querySelectorAll('.chord-dot').forEach(e=>e.remove()), 3000);
}

// --- נגן ועורך ---
function addInsChord() { if(currentInsChord){ chordSeq.push(currentInsChord); renderTimeline(); } }
function renderTimeline() {
    let mt=document.getElementById('melodyTrack'), ct=document.getElementById('chordTrack');
    mt.innerHTML=''; ct.innerHTML='';
    melodySeq.forEach((x,i)=>{
        let d=document.createElement('div'); d.className='seq-item'; d.id='m'+i;
        d.innerHTML=`${x.n}<br>S${parseInt(x.s)+1}`; d.onclick=()=>play(x.fr); mt.appendChild(d);
    });
    chordSeq.forEach((x,i)=>{
        let d=document.createElement('div'); d.className='seq-item chord-item'; d.id='c'+i;
        d.innerText=x.name; d.onclick=()=>{strum(x.fr); viz(x.arr);}; ct.appendChild(d);
    });
}

function playAll() {
    if(isPlaying)return; isPlaying=true; initAud();
    let idx=0;
    function loop() {
        if(!isPlaying)return;
        document.querySelectorAll('.active').forEach(e=>e.classList.remove('active'));
        
        if(idx < melodySeq.length) {
            let m=melodySeq[idx]; play(m.fr);
            let melEl=document.getElementById('m'+idx); if(melEl){melEl.classList.add('active'); melEl.scrollIntoView({inline:'center'});}
            
            let mrk=document.querySelector(`.marker[data-s="${m.s}"][data-f="${m.f}"]`);
            if(mrk) flash(mrk);

            let cIdx=Math.floor(idx/4);
            if(idx%4===0 && cIdx < chordSeq.length) {
                let c=chordSeq[cIdx]; strum(c.fr); viz(c.arr);
                let cel=document.getElementById('c'+cIdx); if(cel) cel.classList.add('active');
            }
            idx++; setTimeout(loop, 400);
        } else stopAll();
    }
    loop();
}
function stopAll() { isPlaying=false; activeOscs.forEach(o=>{try{o.stop()}catch(e){}}); activeOscs=[]; }

// --- אודיו ---
function initAud(){ if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended') audioCtx.resume(); }
function play(f) {
    initAud(); if(!audioCtx)return;
    let o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type='triangle'; o.frequency.value=f;
    g.gain.setValueAtTime(0, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime+0.05);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.4);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime+0.4); activeOscs.push(o);
}
function strum(fr) { fr.forEach((f,i)=>setTimeout(()=>play(f), i*30)); }
function flash(e) { e.classList.add('flash'); setTimeout(()=>e.classList.remove('flash'),200); }

// --- שמירה ---
function saveSong() {
    let n=document.getElementById('saveName').value; if(!n)return alert('שם חובה');
    try{ localStorage.setItem('bz_v11_'+n, JSON.stringify({m:melodySeq, c:chordSeq})); loadSavedList(); alert('נשמר'); } catch(e){}
}
function loadSong() {
    let n=document.getElementById('saveList').value; if(!n)return;
    let d=JSON.parse(localStorage.getItem(n)); if(d){ melodySeq=d.m; chordSeq=d.c; renderTimeline(); }
}
function deleteSong() {
    let n=document.getElementById('saveList').value; if(confirm('למחוק?')){ localStorage.removeItem(n); loadSavedList(); }
}
function loadSavedList() {
    let s=document.getElementById('saveList'); s.innerHTML='';
    for(let i=0; i<localStorage.length; i++) {
        let k=localStorage.key(i); if(k.startsWith('bz_v11_')) {
            let o=document.createElement('option'); o.value=k; o.innerText=k.replace('bz_v11_',''); s.appendChild(o);
        }
    }
}