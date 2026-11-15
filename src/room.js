import * as THREE from 'three';

const INK = '#110e0b';
const OCHRE = '#a67b37';
const PAPER = '#e8c170';
const CYAN = '#00f0ff';

function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function line(ctx, points, color = INK, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.stroke();
}

function polygon(ctx, points, fill) {
  ctx.beginPath();
  points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function label(ctx, word, x, y, size, color = INK, font = 'monospace', weight = 'normal') {
  ctx.fillStyle = color;
  ctx.font = weight + ' ' + size + 'px ' + font;
  ctx.fillText(word, x, y);
}

function paper(ctx, w, h, rnd, base = PAPER, count = 3600) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const x = rnd()*w, y = rnd()*h;
    ctx.fillStyle = rnd() > .45 ? 'rgba(17,14,11,.12)' : 'rgba(232,193,112,.26)';
    ctx.fillRect(x, y, rnd()*4+1, rnd()*2+.5);
  }
}

function border(ctx, x, y, w, h, rnd, color = INK, size = 2) {
  line(ctx, [[x,y],[x+w*.56,y+rnd()*2],[x+w,y],[x+w+1,y+h*.53],[x+w,y+h],[x+w*.57,y+h-1],[x,y+h+1],[x+1,y+h*.44],[x,y]], color,size);
}

function bar(ctx,x,y,w,h,color) {
  ctx.fillStyle = color;
  ctx.fillRect(x,y,w,h);
}

function stamp(ctx,x,y,r,text) {
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(-.21);
  ctx.strokeStyle = '#765426';
  for (const rr of [r,r-3,r-9]) {
    ctx.beginPath();ctx.arc(0,0,rr,0,2*Math.PI);ctx.lineWidth=rr===r?3:1;ctx.stroke();
  }
  line(ctx,[[-r*.70,-8],[r*.70,-8]],'#765426',2);
  line(ctx,[[-r*.70,9],[r*.70,9]],'#765426',2);
  ctx.textAlign = 'center';
  label(ctx,text,0,5,Math.max(7,r*.43),'#765426','monospace','bold');
  label(ctx,'✦',0,-12,r*.42,'#765426');
  ctx.restore();
}

function portrait(ctx,x,y,w,h) {
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(w/100,h/120);
  bar(ctx,0,0,100,120,'#9b763f');
  ctx.save();
  ctx.beginPath();ctx.rect(0,0,100,120);ctx.clip();
  for(let i=-120;i<110;i+=5) line(ctx,[[i,0],[i+105,125]],'#b5955a',1.4);
  ellipse(ctx,50,125,41,45,'#3b2d1b');
  polygon(ctx,[[29,72],[30,40],[40,20],[57,16],[69,28],[74,51],[73,74],[59,75]],'#382818');
  ellipse(ctx,51,55,17,24,'#5b4226');
  polygon(ctx,[[39,45],[41,32],[56,28],[65,42],[62,54],[57,61],[43,59]],'#87663a');
  polygon(ctx,[[32,54],[34,30],[48,21],[58,23],[68,36],[57,33],[48,40],[41,45]],'#382818');
  polygon(ctx,[[41,75],[48,85],[59,73],[67,81],[51,105],[34,81]],'#ad8b51');
  ctx.restore();ctx.restore();
}

function facade(ctx,x,y,w,h,rnd) {
  ctx.save(); ctx.translate(x,y);ctx.scale(w/200,h/125);
  bar(ctx,0,0,200,125,'#a88950');
  ctx.save();ctx.beginPath();ctx.rect(0,0,200,125);ctx.clip();
  for(let i=0;i<40;i++) {
    const xx=rnd()*200, yy=rnd()*76;
    line(ctx,[[xx,yy],[xx+10+rnd()*25,yy-.5]],'#997b49',1);
  }
  polygon(ctx,[[-8,90],[10,65],[29,67],[45,45],[72,67],[95,55],[125,80],[160,55],[200,65],[212,119],[0,130]],'#6d522e');
  polygon(ctx,[[25,115],[25,57],[124,33],[124,111]],'#c6a56a');
  polygon(ctx,[[124,34],[170,50],[170,107],[124,112]],'#806239');
  polygon(ctx,[[18,57],[122,28],[176,48],[173,54],[123,37],[22,64]],'#382d20');
  for(let row=0;row<3;row++) for(let c=0;c<6;c++) {
    const xx=32+c*15, yy=64-c*3.5+row*16;
    polygon(ctx,[[xx,yy],[xx+8,yy-2],[xx+8,yy+8],[xx,yy+10]],'#483824');
    line(ctx,[[xx+4,yy],[xx+4,yy+8]],'#a78959',.8);
  }
  for(let c=0;c<3;c++) for(let row=0;row<3;row++) {
    const xx=130+c*12, yy=48+c*3+row*17;
    bar(ctx,xx,yy,5,8,'#463323');
  }
  polygon(ctx,[[0,113],[198,99],[200,125],[0,125]],'#443520');
  line(ctx,[[-3,119],[203,101]],'#a58b5c',1.5);
  for(let i=0;i<240;i++) {
    const xx=rnd()*200, yy=rnd()*125;
    line(ctx,[[xx,yy],[xx+1+rnd()*5,yy-1]],'rgba(25,17,9,.25)',.8);
  }
  ctx.restore();ctx.restore();
}

// Soft blotches: damp, wear and uneven tone.
function mottle(c,w,h,r,n,rgb,alpha,size){for(let i=0;i<n;i++){const x=r()*w,y=r()*h,s=size*(.4+r());const g=c.createRadialGradient(x,y,0,x,y,s);g.addColorStop(0,`rgba(${rgb},${alpha})`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;c.fillRect(x-s,y-s,s*2,s*2);}}
// Floorboards: narrow planks with staggered joints, nail heads, their own tone and grain, and years of wear.
function floorboards(c,w,h,r){
  const rows=46,bh=h/rows;
  for(let j=0;j<rows;j++){
    let x=-r()*260;
    while(x<w){
      const len=150+r()*330,tone=(r()-.5)*.24,y0=j*bh;
      c.fillStyle=tone>0?`rgba(236,200,128,${tone})`:`rgba(14,10,7,${-tone*1.5})`;c.fillRect(x,y0,len,bh);
      for(let g=0;g<6;g++){const gy=y0+2+r()*(bh-4);line(c,[[x+3,gy],[x+len*.5,gy+(r()-.5)*2.6],[x+len-3,gy+(r()-.5)*2]],g%3?'rgba(17,14,11,.24)':'rgba(236,200,128,.17)',.4+r()*.8);}
      if(r()<.2){const kx=x+20+r()*Math.max(1,len-40),ky=y0+bh*(.3+r()*.4);for(let i=0;i<4;i++){c.strokeStyle=i%2?'rgba(110,78,40,.8)':'rgba(34,24,15,.85)';c.lineWidth=.8;c.beginPath();c.ellipse(kx,ky,1.5+i*2.2,1+i*1.05,0,0,Math.PI*2);c.stroke();}}
      bar(c,x+len-1,y0,2,bh,'rgba(10,7,5,.8)');
      for(const nx of [x+6,x+len-8])for(const ny of [y0+bh*.28,y0+bh*.72]){c.fillStyle='rgba(8,6,4,.75)';c.beginPath();c.arc(nx,ny,1.2,0,7);c.fill();}
      x+=len;
    }
    bar(c,0,j*bh-.9,w,1.8,'rgba(8,6,4,.88)');bar(c,0,j*bh+.9,w,.7,'rgba(236,200,128,.17)');
  }
  mottle(c,w,h,r,30,'236,200,128',.06,95);mottle(c,w,h,r,22,'14,10,7',.11,75);
  for(let i=0;i<220;i++){const x=r()*w,y=r()*h,l=8+r()*46,a=r()*Math.PI;line(c,[[x,y],[x+Math.cos(a)*l,y+Math.sin(a)*l]],'rgba(240,214,160,.12)',.4+r()*.7);}
}
export class InkTextureFactory {
  constructor() {
    this.textures = new Set();
    this.cache = new Map();
  }
  // `k` paints the same drawing at k× the pixel density, so big surfaces stay sharp up close.
  make(id,w,h,paint,k=1) {
    if (this.cache.has(id)) return this.cache.get(id);
    const canvas = document.createElement('canvas');
    canvas.width=w*k; canvas.height=h*k;
    const ctx=canvas.getContext('2d');ctx.scale(k,k);
    const seed=Array.from(id).reduce((a,c)=>Math.imul(a,31)+c.charCodeAt(0)|0,17);
    paint(ctx,w,h,randomSource(seed));
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = id;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8; // floors and walls seen at a shallow angle stay crisp
    texture.needsUpdate = true;
    this.textures.add(texture);
    this.cache.set(id,texture);
    return texture;
  }
  // A normal map worked out from a painted texture: darker paint is taken as lower (the gaps between boards, the
  // shadow line of a moulding, the grain), and the slope of that height is the normal. Half the texture's size is plenty.
  relief(texture, depth=2.4) {
    const src=texture.image, s=Math.min(1,1024/Math.max(src.width,src.height)), w=Math.round(src.width*s), h=Math.round(src.height*s);
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;
    const c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(src,0,0,w,h);
    const img=c.getImageData(0,0,w,h), d=img.data, H=new Float32Array(w*h);
    for(let i=0;i<w*h;i++)H[i]=(d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11)/255;
    const at=(x,y)=>H[((y+h)%h)*w+(x+w)%w];   // wraps, as the textures tile
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      // Canvas rows run downward and the texture is flipped on upload, so a rise toward the next row is a rise toward -v.
      const nx=-(at(x+1,y)-at(x-1,y))*depth, ny=(at(x,y+1)-at(x,y-1))*depth, k=1/Math.hypot(nx,ny,1), i=(y*w+x)*4;
      d[i]=(nx*k*.5+.5)*255;d[i+1]=(ny*k*.5+.5)*255;d[i+2]=(k*.5+.5)*255;d[i+3]=255;
    }
    c.putImageData(img,0,0);
    const map=new THREE.CanvasTexture(cv);
    map.name=texture.name+'-normal';map.wrapS=texture.wrapS;map.wrapT=texture.wrapT;map.repeat.copy(texture.repeat);map.anisotropy=4;map.needsUpdate=true;
    this.textures.add(map);
    return map;
  }
  wood(id='wood', lampPool=false) {
    const floor=id==='floor';
    return this.make(id,1024,floor?1024:512,(c,w,h,r)=>{
      const base=c.createLinearGradient(0,0,w,h);
      base.addColorStop(0,floor?'#443421':'#5d4223');base.addColorStop(.34,floor?'#5b4328':'#74532a');
      base.addColorStop(.71,floor?'#3d3021':'#523a20');base.addColorStop(1,floor?'#30251b':'#45311e');
      c.fillStyle=base;c.fillRect(0,0,w,h);
      if(floor){floorboards(c,w,h,r);return;}
      const knots=[[192,190,58],[732,370,80],[824,60,48],[428,472,54]];
      for(let i=0;i<640;i++) {
        const y=r()*h, start=r()*w-120, len=12+Math.pow(r(),2)*355;
        const wave=r()*6, phase=r()*6, points=[];
        for(let j=0;j<=19;j++) {
          const x=start+len*j/19;
          let yy=y+Math.sin(x/109+phase)*wave+Math.sin(x/34+phase)*1.2;
          for(const [kx,ky,kr] of knots) {
            const dy=(y-ky);
            yy+=Math.sign(dy)*10*Math.exp(-((x-kx)**2)/(kr*kr)-Math.abs(dy)/18);
          }
          points.push([x,yy]);
        }
        line(c,points,i%4===0?'rgba(232,193,112,.27)':'rgba(17,14,11,.37)',.6+r()*1.9);
      }
      knots.forEach(([x,y,radius])=>{
        for(let i=0;i<5;i++){
          c.strokeStyle=i%2?'#604423':'#352719';c.lineWidth=1.2;c.beginPath();
          c.ellipse(x,y,6+i*radius/8,1+i*1.6,0,0,Math.PI*2);c.stroke();
        }
      });
      for(const yy of [127,255,385]) {
        line(c,[[0,yy],[286,yy+.6],[710,yy-.8],[w,yy]],'#352719',2);
        line(c,[[0,yy+2],[w,yy+2]],'rgba(232,193,112,.25)',1);
      }
      // Short crossing nib strokes follow the grain in shaded patches.
      for(let n=0;n<62;n++){
        const x=r()*w,y=r()*h,l=5+r()*13;
        for(let j=0;j<8;j++){
          line(c,[[x+j*3,y],[x+j*3+l,y-l*.43]],'rgba(17,14,11,.29)',.9);
          if(n%3===0)line(c,[[x+j*3,y-l*.42],[x+j*3+l*.55,y]],'rgba(17,14,11,.22)',.7);
        }
      }
      // Open pores along the grain, a varnish sheen, and the ring a cup left behind.
      for(let i=0;i<5200;i++)bar(c,r()*w,r()*h,2+r()*5,.6,'rgba(17,14,11,.16)');
      mottle(c,w,h,r,14,'14,10,7',.08,80);
      const sheen=c.createLinearGradient(0,0,w,h);sheen.addColorStop(.3,'rgba(255,236,190,0)');sheen.addColorStop(.46,'rgba(255,236,190,.11)');sheen.addColorStop(.6,'rgba(255,236,190,0)');c.fillStyle=sheen;c.fillRect(0,0,w,h);
      c.strokeStyle='rgba(30,20,12,.24)';c.lineWidth=2.5;c.beginPath();c.ellipse(w*.79,h*.27,25,21,.3,.4,Math.PI*1.9);c.stroke();
      if(lampPool) {
        c.save(); c.globalCompositeOperation='screen';
        c.translate(w*.46,h*.54); c.scale(1,.62);
        const glow=c.createRadialGradient(0,0,5,0,0,w*.5);
        glow.addColorStop(0,'rgba(190,136,55,.72)');
        glow.addColorStop(.53,'rgba(167,111,32,.46)');
        glow.addColorStop(.85,'rgba(137,91,35,.19)');glow.addColorStop(1,'rgba(70,50,21,0)');
        c.fillStyle=glow;c.fillRect(-w,-h*2,w*2,h*4);c.restore();
      }
    },2);
  }
  wall(id='back-wall') {
    return this.make(id,1536,784,(c,w,h,r)=>{
      const back=id==='back-wall', gradient=c.createLinearGradient(0,0,w,h*.8);
      gradient.addColorStop(0,back?'#604a2e':'#453622');gradient.addColorStop(.36,back?'#998057':'#675238');
      gradient.addColorStop(.71,back?'#79603e':'#58402a');gradient.addColorStop(1,'#3c2d1e');
      c.fillStyle=gradient;c.fillRect(0,0,w,h);
      // Faded striped wallpaper above the dado rail, a small diamond in every other stripe.
      const dado=h*.75;
      for(let i=0;i<64;i++){
        const x=i*w/64;
        bar(c,x,0,w/128,dado,i%2?'rgba(232,193,112,.075)':'rgba(17,14,11,.06)');bar(c,x,0,.8,dado,'rgba(17,14,11,.11)');
        if(i%2===0)for(let y=40;y<dado-14;y+=46)polygon(c,[[x+w/128+6,y],[x+w/128+10,y+7],[x+w/128+6,y+14],[x+w/128+2,y+7]],'rgba(232,193,112,.11)');
      }
      mottle(c,w,dado,r,44,'17,14,11',.07,120);mottle(c,w,dado,r,30,'240,214,160',.05,110);
      // Damp has run down from the picture rail.
      for(let i=0;i<24;i++){const x=r()*w,len=60+r()*230,wd=4+r()*14,g=c.createLinearGradient(0,30,0,30+len);g.addColorStop(0,'rgba(17,14,11,.17)');g.addColorStop(1,'rgba(17,14,11,0)');c.fillStyle=g;c.fillRect(x,30,wd,len);}
      for(let i=0;i<20500;i++) {
        const x=r()*w,y=r()*h,light=r()>.65;
        line(c,[[x,y],[x+1+r()*7,y-1-r()*3]],light?'rgba(232,193,112,.15)':'rgba(17,14,11,.13)',r()*1.1+.4);
      }
      for(let i=0;i<96;i++){
        const x=r()*w, y=r()*h, n=6+Math.floor(r()*13), len=3+r()*32;
        for(let j=0;j<n;j++) line(c,[[x+j*3,y-j*.3],[x+j*3+len,y-len*.65+j*.15]],'rgba(37,26,16,.17)',.8);
      }
      for(let i=0;i<12;i++) {
        const x=r()*w,y=r()*h*.9,points=[[x,y]];
        for(let j=1;j<7;j++)points.push([points[j-1][0]+(r()-.52)*15,points[j-1][1]+2+r()*12]);
        line(c,points,'rgba(35,26,17,.45)',1.2);
      }
      if(back) {
        // Slat silhouettes laid into the plaster occupy the same geometry in both viewpoints.
        for(let n=0;n<11;n++) {
          const yy=64+n*43;
          polygon(c,[[-40,yy],[300,yy-65],[757,yy-195],[768,yy-184],[300,yy-47],[-40,yy+25]],'rgba(227,182,101,.36)');
        }
      }
      // Large local occlusion softens only the periphery of the engraved plaster.
      const wash=c.createRadialGradient(w*.35,h*.40,w*.14,w*.35,h*.40,w*.89);
      wash.addColorStop(0,'rgba(17,14,11,0)');wash.addColorStop(.6,'rgba(17,14,11,.16)');wash.addColorStop(1,'rgba(17,14,11,.48)');
      c.fillStyle=wash;c.fillRect(0,0,w,h);
      const trim=h*.75;
      bar(c,0,trim,w,h-trim,'#53402b');
      for(let i=0;i<13;i++) {
        const x=i*w/12;
        border(c,x+10,trim+16,w/12-17,h-trim-26,r,'#31271c',4);
        border(c,x+13,trim+19,w/12-23,h-trim-32,r,'#796042',2);
      }
      // Grain in each panel, a lit bevel, a picture rail above and a skirting board below.
      for(let i=0;i<13;i++){const x=i*w/12+16,pw=w/12-29;
        for(let g=0;g<16;g++){const gx=x+r()*pw;line(c,[[gx,trim+22],[gx+(r()-.5)*5,trim+(h-trim)*.5],[gx+(r()-.5)*4,h-30]],g%4?'rgba(17,14,11,.2)':'rgba(232,193,112,.14)',.5+r()*.8);}
        line(c,[[x-2,h-26],[x-2,trim+19],[x+pw+2,trim+19]],'rgba(232,193,112,.22)',1);}
      bar(c,0,24,w,8,'#3b2c1d');bar(c,0,23,w,1.5,'#b29055');bar(c,0,32,w,5,'rgba(17,14,11,.22)');
      bar(c,0,h-20,w,20,'#2f2318');bar(c,0,h-21,w,1.5,'rgba(232,193,112,.32)');
      bar(c,0,trim-5,w,7,'#3b2c1d');bar(c,0,trim-6,w,2,'#b29055');
      const shade=c.createLinearGradient(0,h*.72,0,h);
      shade.addColorStop(0,'rgba(17,14,11,0)');shade.addColorStop(1,'rgba(17,14,11,.33)');
      c.fillStyle=shade;c.fillRect(0,0,w,h);
    },2);
  }
  window() {
    return this.make('venetian-glass',768,580,(c,w,h,r)=>{
      paper(c,w,h,r,'#c2a265');
      const sky=c.createLinearGradient(0,0,w,h);
      sky.addColorStop(0,'#ecd39a');sky.addColorStop(.58,'#d4b578');sky.addColorStop(1,'#9b7b48');
      c.fillStyle=sky;c.fillRect(0,0,w,h);
      // Distance is drawn in two halftone layers, like a lithographic plate.
      for(let b=0;b<31;b++) {
        const x=b*26+r()*12, ht=110+r()*150;
        bar(c,x,h-ht,22+r()*29,ht,'#9e834e');
        for(let j=0;j<8;j++)bar(c,x+4,h-ht+10+j*20,8,2,'#c7aa71');
      }
      for(let k=0;k<380;k++) {
        const x=r()*w,y=r()*h;line(c,[[x,y],[x+r()*22,y-2-r()*6]],'rgba(62,46,27,.20)',1.1);
      }
      for(let i=0;i<10;i++) {
        const y=i*59-26;
        polygon(c,[[0,y+6],[w,y-11],[w,y+11],[0,y+30]],'#443523');
        line(c,[[0,y+28],[w,y+9]],'#e8c170',2);
        line(c,[[0,y+9],[w,y-8]],'#1b1711',4);
        for(let j=0;j<31;j++) {
          const x=r()*w;line(c,[[x,y+13-x*.022],[x+r()*25,y+12-x*.022]],'#78623c',1);
        }
      }
      for(const x of [83,648])line(c,[[x,0],[x+2,h]],'#463421',3);
      bar(c,w*.58-4,0,10,h,'#523a23');
    });
  }
  form(kind='visa') {
    const receipt=kind==='receipt'||kind==='memory';
    return this.make('form-'+kind,receipt?430:720,receipt?520:510,(c,w,h,r)=>{
      const bg=kind==='manifest'?'#b7965a':receipt?'#c3a064':'#dec18a';
      paper(c,w,h,r,bg);
      for(let xx=9;xx<w-3;xx+=8) {
        line(c,[[xx,6],[xx-4,13]],'#866d46',.7);
        line(c,[[xx,h-7],[xx-4,h-15]],'#866d46',.7);
      }
      border(c,13,14,w-26,h-28,r,'#765a36',2);
      border(c,18,19,w-36,h-38,r,'#9a7c4c',1);
      if(kind==='visa') {
        label(c,'REGISTRY OF MEDICAL TRAVEL',34,53,17,'#55412a','monospace','bold');
        label(c,'FORM   08 / 31',515,51,15,'#55412a');
        line(c,[[33,65],[w-32,65]],INK,3);
        label(c,'MEDICAL VISA',34,130,67,INK,'Georgia','bold');
        label(c,'TEMPORARY PATIENT TRAVEL DOCUMENT',36,158,15,'#654b2f');
        line(c,[[33,177],[w-32,177]],INK,2);
        portrait(c,35,197,146,184);border(c,35,197,146,184,r,INK,2);
        label(c,'01   HOLDER',205,211,13,'#654b2f');
        label(c,'M. VALE',205,247,32,INK,'monospace','bold');
        line(c,[[204,261],[w-40,261]],'#947849',1.1);
        label(c,'02   ISSUING OFFICE',205,285,13,'#654b2f');
        bar(c,205,297,190,13,'#2f241b');bar(c,402,297,78,13,'#34281d');
        label(c,'03   PURPOSE OF ENTRY',205,344,13,'#654b2f');
        label(c,'CLINICAL REFERRAL',205,370,21,INK,'monospace','bold');
        line(c,[[33,397],[w-32,397]],INK,2);
        label(c,'AUTHORISED SIGNATURE',37,423,13,'#654b2f');
        line(c,[[40,457],[57,449],[69,429],[53,452],[75,443],[80,455],[99,443],[103,450],[127,437],[119,451],[142,446],[162,449],[187,444]],'#5f4729',2);
        stamp(c,w-117,h-102,49,'FILED');
        label(c,'V  184  029  <<  MV',243,462,15,'#654b2f');
      } else if(receipt) {
        label(c,'CARBON COPY',32,68,42,INK,'Georgia','bold');
        label(c,'CLINIC REGISTRY  /  RECEIPT',33,96,16,'#57422a');
        line(c,[[30,111],[w-29,111]],INK,2.6);
        label(c,'M. VALE',33,167,34,INK,'monospace','bold');
        label(c,'RETAINED BY HOLDER',34,197,17,'#57422a');
        label(c,'A17',36,294,88,kind==='memory'?'#194c43':INK,'monospace','bold');
        for(let j=0;j<4;j++)line(c,[[35,326+22*j],[w-35,326+22*j]],'#876b43',1.3);
        stamp(c,320,407,50,'COPY');
      } else {
        label(c,'CLINIC MANIFEST',33,82,54,INK,'Georgia','bold');
        label(c,'INTERNAL     /     PATIENT TRANSFER RECORD',34,116,16);
        line(c,[[33,132],[w-33,132]],INK,2.8);
        for(let i=0;i<7;i++) {
          const yy=163+i*44;
          label(c,'0'+(i+1),34,yy+12,16);
          bar(c,86,yy,100+r()*104,11,'#35281b');
          bar(c,321,yy,78+r()*140,11,'#35281b');
          label(c,String(106+i*9),586,yy+13,16);
          line(c,[[33,yy+25],[w-33,yy+25]],'#886a40',1);
        }
      }
    });
  }
  visa() { return this.form('visa'); }
  manifest() { return this.form('manifest'); }
  phone() {
    return this.make('burner-phone',288,512,(c,w,h,r)=>{
      paper(c,w,h,r,'#332d20',2200);
      border(c,7,7,w-14,h-14,r,'#a88c54',4);
      bar(c,112,25,68,6,INK);
      bar(c,30,58,228,218,'#b19c63');
      border(c,30,58,228,218,r,'#15160f',5);
      label(c,'01   SIGNAL',40,89,16,'#464736','monospace','bold');
      label(c,'CALL LOG',40,149,32,'#34372a','monospace','bold');
      label(c,'EXT. ////',40,199,33,'#34372a','monospace','bold');
      label(c,'INCOMING',41,244,17,'#464736');
      for(let i=0;i<12;i++){
        const x=33+(i%3)*78,y=310+Math.floor(i/3)*43;
        bar(c,x,y,61,27,'#5d5036');border(c,x,y,61,27,r,'#15150f',2);
        label(c,'123456789*0#'[i],x+24,y+21,18,'#cbb783');
      }
    });
  }
  board(key='visa',artifact='MEDICAL VISA',bleed='CARBON RECEIPT') {
    return this.make('evidence-board-'+key,1260,750,(c,w,h,r)=>{
      paper(c,w,h,r,'#856438',40000);
      for(let i=0;i<14000;i++){
        const x=r()*w,y=r()*h;line(c,[[x,y],[x+2+r()*5,y+r()*4-2]],i%4?'rgba(24,18,11,.19)':'rgba(220,180,105,.40)',r()*1.8+.8);
      }
      const notes=[
        {x:170,y:200,w:221,h:256,a:-.10,kind:'photo'},
        {x:462,y:197,w:233,h:236,a:.07,kind:'list'},
        {x:803,y:166,w:215,h:158,a:-.11,kind:'map'},
        {x:1036,y:259,w:224,h:215,a:.065,kind:'photo'},
        {x:347,y:486,w:252,h:207,a:.09,kind:'map'},
        {x:667,y:496,w:218,h:257,a:-.066,kind:'list'},
        {x:997,y:543,w:233,h:134,a:.08,kind:'card'}
      ];
      for(const note of notes) {
        c.save();c.translate(note.x,note.y);c.rotate(note.a);
        const x=-note.w/2,y=-note.h/2, nw=note.w,nh=note.h;
        bar(c,x+6,y+8,nw,nh,'rgba(31,23,15,.45)');
        bar(c,x,y,nw,nh,note.kind==='map'?'#b3955c':'#cdb384');
        if(note.kind==='photo') {
          facade(c,x+10,y+12,nw-20,nh-50,r);
          label(c,note.x<400?'EAST ENTRANCE':'ARCHIVE  04',x+13,y+nh-11,15,'#5a472e','monospace');
        } else if(note.kind==='map') {
          c.save();c.beginPath();c.rect(x+7,y+7,nw-14,nh-14);c.clip();
          for(let i=0;i<34;i++){
            const xx=x+r()*nw,yy=y+r()*nh;
            line(c,[[xx-30,yy+10],[xx+16,yy-11],[xx+45,yy-9],[xx+124,yy-50]],'#806c4a',1.5+r()*2.5);
          }
          for(let i=-100;i<nw;i+=33)line(c,[[x+i,y],[x+i+120,y+nh]],'#9d855c',2);
          ellipse(c,x+nw*.47,y+nh*.56,7,7,'#5e4a30');c.restore();
        } else {
          label(c,note.kind==='card'?'A / 17':note.x<600?artifact.toUpperCase():bleed.toUpperCase(),x+13,y+32,note.kind==='card'?30:20,'#423321','Georgia','bold');
          line(c,[[x+12,y+43],[x+nw-13,y+43]],'#6d5739',1.6);
          for(let yy=y+58;yy<y+nh-10;yy+=15){
            const end=x+nw*(.55+r()*.37);
            line(c,[[x+14,yy],[end,yy]],'#85704f',1.3);
            if(r()>.67)bar(c,x+21+r()*37,yy-5,29+r()*62,6,'#51422f');
          }
        }
        c.restore();
      }
      const pins=notes.map(n=>[n.x+2,n.y-n.h*.38]);
      for(const [a,b] of [[0,1],[1,3],[1,4],[3,5],[4,5],[5,6],[2,3]]){
        const p=pins[a],q=pins[b],mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2+6;
        line(c,[[p[0]+2,p[1]+3],[mx+2,my+3],[q[0]+2,q[1]+3]],'rgba(30,20,10,.4)',3);
        line(c,[p,[mx,my],q],'#654320',2.2);
      }
      for(const [x,y] of pins){
        ellipse(c,x+3,y+5,8,7,'#47351e');ellipse(c,x,y,6,6,'#34291c');
        ellipse(c,x-1,y-2,2.5,2,'#cfad6d');
      }
    });
  }
  stamp(code) {
    return this.make('hidden-ink-'+code,250,100,(c,w,h,r)=>{
      c.clearRect(0,0,w,h);border(c,6,6,w-12,h-12,r,CYAN,4);
      c.textAlign='center';
      label(c,code,w/2,69,Math.min(62,320/code.length),CYAN,'monospace','bold');
    });
  }
  cutout() {
    return this.make('ink-shadow-cutout',448,360,(c,w,h,r)=>{
      c.clearRect(0,0,w,h);
      const shape=[[0,337],[51,321],[95,300],[134,278],[151,242],[178,216],[190,189],[202,181],[208,153],[226,130],[237,135],[228,155],[223,174],[234,164],[259,133],[268,137],[259,152],[244,179],[280,149],[290,149],[291,155],[262,185],[289,169],[297,170],[297,177],[264,204],[248,229],[226,254],[203,268],[178,309],[153,360],[0,360]];
      polygon(c,shape,INK);
      c.globalCompositeOperation='source-atop';
      for(let i=0;i<220;i++){
        const x=r()*w,y=r()*h;line(c,[[x,y],[x+18+r()*40,y-15]],'#33271a',1);
      }
    });
  }
  dispose() {
    this.textures.forEach(texture=>texture.dispose());
    this.textures.clear();this.cache.clear();
  }
}

const V = (x,y,z)=>new THREE.Vector3(x,y,z);

// Static furniture is baked into one colored mesh and one mesh per printed surface.
export function buildRoom(scene, factory) {
  const room=new THREE.Group();
  room.name='Clinic office';
  scene.add(room);
  const geometry=new Set(), materials=new Set();
  const batches=new Map(), paintCache=new Map();
  const unitBox=new THREE.BoxGeometry(1,1,1), unitPlane=new THREE.PlaneGeometry(1,1);
  const primitives=new Map();
  geometry.add(unitBox);geometry.add(unitPlane);
  const amber=new THREE.Color(), point=new THREE.Vector3(), matrix=new THREE.Matrix4();
  const makeMat=opts=>{
    const material=new THREE.MeshBasicMaterial(opts);
    materials.add(material);
    return material;
  };
  const flat=makeMat({vertexColors:true});
  // Painted surfaces are unlit, so their look never depends on a light. A texture with a normal map (walls, floor)
  // gets relief on top: each pixel is brightened or darkened by how far its normal leans toward the window light.
  // A flat pixel is multiplied by exactly 1, so only grooves, mouldings and grain change.
  const reliefLight=new THREE.Vector3(-.55,.7,.25).normalize();
  const sheetMaterial=texture=>{
    if(!paintCache.has(texture.uuid)){
      const material=makeMat({map:texture}), normal=texture.userData.normalMap;
      if(normal){
        material.onBeforeCompile=shader=>{
          shader.uniforms.reliefMap={value:normal};shader.uniforms.reliefLight={value:reliefLight};
          shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vReliefPos;').replace('#include <project_vertex>','#include <project_vertex>\nvReliefPos=(modelMatrix*vec4(transformed,1.0)).xyz;');
          shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vReliefPos;uniform sampler2D reliefMap;uniform vec3 reliefLight;').replace('#include <map_fragment>',`#include <map_fragment>
            { vec3 q1=dFdx(vReliefPos), q2=dFdy(vReliefPos); vec2 s1=dFdx(vMapUv), s2=dFdy(vMapUv);
              vec3 N=normalize(cross(q1,q2)), q1p=cross(q2,N), q2p=cross(N,q1);
              vec3 T=q1p*s1.x+q2p*s2.x, B=q1p*s1.y+q2p*s2.y; float inv=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-12));
              vec3 m=texture2D(reliefMap,vMapUv).xyz*2.0-1.0;
              diffuseColor.rgb*=clamp(1.0+1.15*dot((T*m.x+B*m.y)*inv,reliefLight),0.5,1.5); }`);
        };
        material.customProgramCacheKey=()=>'relief';
      }
      paintCache.set(texture.uuid,material);
    }
    return paintCache.get(texture.uuid);
  };
  function primitive(key,build) {
    if(!primitives.has(key)) {
      const shape=build();primitives.set(key,shape);geometry.add(shape);
    }
    return primitives.get(key);
  }
  function bake(shape, pos, quaternion, scale, color=INK, mat=flat) {
    matrix.compose(pos,quaternion,scale);
    let data=batches.get(mat);
    if(!data){data={positions:[],uv:[],colors:[]};batches.set(mat,data);}
    const attr=shape.attributes.position, indices=shape.index, count=indices?indices.count:attr.count;
    const uv=shape.attributes.uv;
    for(let i=0;i<count;i++) {
      const idx=indices?indices.getX(i):i;
      point.fromBufferAttribute(attr,idx).applyMatrix4(matrix);
      data.positions.push(point.x,point.y,point.z);
      if(mat===flat) {
        const face=Array.isArray(color)?color[Math.floor(i/6)]:color;
        amber.set(face);data.colors.push(amber.r,amber.g,amber.b);
      } else { data.uv.push(uv.getX(idx),uv.getY(idx)); }
    }
  }
  const rot=(x=0,y=0,z=0)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));
  const identity=rot();
  const box=(x,y,z,w,h,d,col,rx=0,ry=0,rz=0)=>bake(unitBox,V(x,y,z),rot(rx,ry,rz),V(w,h,d),col);
  const plane=(tex,x,y,z,w,h,rx=0,ry=0,rz=0)=>bake(unitPlane,V(x,y,z),rot(rx,ry,rz),V(w,h,1),INK,sheetMaterial(tex));
  const printTop=(tex,x,y,z,w,d,angle=0)=>plane(tex,x,y,z,w,d,-Math.PI/2,0,angle);
  const shades=(front,top,dark)=>[dark,dark,top,dark,front,dark];
  function barBetween(a,b,radius,col,segments=8) {
    const start=V(...a), end=V(...b), dir=end.clone().sub(start);
    const shape=primitive('rod'+segments,()=>new THREE.CylinderGeometry(1,1,1,segments));
    bake(shape,start.addScaledVector(dir,.5),new THREE.Quaternion().setFromUnitVectors(V(0,1,0),dir.clone().normalize()),V(radius,dir.length(),radius),col);
  }
  function tapered(a,b,r0,r1,col,segments=28,open=false) {
    const key=[r0,r1,segments,open].join('/');
    const shape=primitive(key,()=>new THREE.CylinderGeometry(r1,r0,1,segments,1,open));
    const start=V(...a),delta=V(...b).sub(start);
    bake(shape,start.addScaledVector(delta,.5),new THREE.Quaternion().setFromUnitVectors(V(0,1,0),delta.clone().normalize()),V(1,delta.length(),1),col);
  }
  function cylinder(x,y,z,r,h,col,segments=28){
    tapered([x,y-h/2,z],[x,y+h/2,z],r,r,col,segments);
  }
  function woodBox(x,y,z,w,h,d) {
    box(x,y,z,w,h,d,shades('#503b26','#7a5a34','#31271b'));
    plane(factory.wood(),x,y,z+d/2+.002,w,h);
    printTop(factory.wood(),x,y+h/2+.001,z,w,d);
  }
  const wood=factory.wood(), backWall=factory.wall(), sideWall=factory.wall('side-wall');
  const floorTex=factory.wood('floor');
  for(const t of [backWall,sideWall,floorTex])t.userData.normalMap=factory.relief(t);
  // Permanent shell. A front wall also covers the detective's reverse view.
  scene.background=new THREE.Color('#2c2318');
  plane(backWall,0,2.24,-2.95,8.96,4.48);
  plane(sideWall,-4.47,2.24,1.75,9.4,4.48,0,Math.PI/2);
  plane(sideWall,4.47,2.24,1.75,9.4,4.48,0,-Math.PI/2);
  // A plaster partition replaces the old south wall. Its wide west doorway opens into the records annex.
  const P=6.45, S=10.25, annexMid=(P+S)/2, annexLen=S-P;
  for(const [cx,w,cy,h] of [[-3.55,1.84,2.24,4.48],[1.46,6.02,2.24,4.48],[-2.10,1.06,3.475,2.01]]){
    box(cx,cy,P,w,h,.12,shades('#4a3a27','#5a4730','#2f2519'));
    plane(sideWall,cx,cy,P-.062,w,h,0,Math.PI);plane(sideWall,cx,cy,P+.062,w,h);
    box(cx,.09,P,w,.18,.16,'#433221');
  }
  // Doorway trim: jambs and a moulded lintel.
  for(const x of [-2.66,-1.54])box(x,1.24,P,.08,2.48,.2,shades('#6d5335','#9c7b4c','#3b2d1e'));
  box(-2.10,2.52,P,1.24,.12,.22,shades('#6d5335','#9c7b4c','#3b2d1e'));
  plane(sideWall,-4.47,2.24,annexMid,annexLen,4.48,0,Math.PI/2);
  plane(sideWall,4.47,2.24,annexMid,annexLen,4.48,0,-Math.PI/2);
  const S3=14.6, r3Mid=(S+S3)/2, r3Len=S3-S;
  for(const [cx,w,cy,h] of [[-4.135,.67,2.24,4.48],[.785,7.37,2.24,4.48],[-3.35,.9,3.39,2.18]]){
    box(cx,cy,S,w,h,.12,shades('#4a3a27','#5a4730','#2f2519'));
    plane(sideWall,cx,cy,S-.062,w,h,0,Math.PI);plane(sideWall,cx,cy,S+.062,w,h);
  }
  for(const x of [-3.83,-2.87])box(x,1.15,S,.07,2.3,.2,shades('#6d5335','#9c7b4c','#3b2d1e'));
  box(-3.35,2.34,S,1.04,.1,.22,shades('#6d5335','#9c7b4c','#3b2d1e'));
  // Room 3: the dispatch office.
  plane(sideWall,-4.47,2.24,r3Mid,r3Len,4.48,0,Math.PI/2);
  plane(sideWall,4.47,2.24,r3Mid,r3Len,4.48,0,-Math.PI/2);
  plane(backWall,0,2.24,S3,8.96,4.48,0,Math.PI);
  printTop(floorTex,0,-.001,r3Mid,8.95,r3Len);
  box(0,4.57,r3Mid,8.98,.16,r3Len+.04,'#443726');
  for(const x of [-4.41,4.41])box(x,.09,r3Mid,.1,.18,r3Len,'#433221');
  box(0,.09,S3-.05,8.95,.18,.09,shades('#463622','#85663c','#33271b'));
  printTop(floorTex,0,-.001,annexMid,8.95,annexLen);
  box(0,4.57,annexMid,8.98,.16,annexLen+.04,'#443726');
  for(const x of [-4.41,4.41])box(x,.09,annexMid,.1,.18,annexLen,'#433221');
  box(0,.09,S-.05,8.95,.18,.09,shades('#463622','#85663c','#33271b'));
  box(0,4.36,S-.06,8.95,.14,.12,shades('#705438','#9c7b4c','#30291e'));
  printTop(floorTex,0,-.001,1.75,8.95,9.4);
  box(0,4.57,1.74,8.98,.16,9.42,'#443726');
  box(0,.09,-2.90,8.95,.18,.09,shades('#463622','#85663c','#33271b'));
  box(0,4.36,-2.90,8.95,.14,.12,shades('#705438','#9c7b4c','#30291e'));
  box(-4.41,.09,1.75,.1,.18,9.4,'#433221');
  box(4.41,.09,1.75,.1,.18,9.4,'#433221');
  // A high window on the back wall is the broad source of hard, slatted daylight.
  const wx=-2.31,wy=2.72,wz=-2.835,ww=2.85,wh=1.94;
  box(wx,wy,wz,ww+.23,wh+.19,.13,'#34291d');
  plane(factory.window(),wx,wy,wz+.074,ww,wh);
  box(wx,wy,wz+.093,.075,wh,.045,shades('#4a3723','#b19460','#31271a'));
  box(wx,wy-wh/2-.035,wz+.095,ww+.40,.13,.29,shades('#6d5335','#bc9a60','#413121'));
  box(wx,wy+wh/2+.04,wz+.06,ww+.31,.105,.18,shades('#54412c','#9e8051','#34271b'));
  const cx=wx+ww*.5+.06;
  barBetween([cx,wy+.72,wz+.13],[cx,wy-.94,wz+.145],.009,'#3e3020',5);
  tapered([cx,wy-1.01,wz+.145],[cx,wy-.93,wz+.145],.030,.012,'#7e603a',8);

  // Archive cabinet, drawers, label holders, slot handles and desk-side files.
  function cabinet(x,z,w,h,d,rows) {
    box(x,h/2+.055,z,w,h,d,shades('#514632','#796744','#3a3225'));
    box(x,h+.085,z,w+.055,.07,d+.05,shades('#897249','#9d8253','#3b3123'));
    const front=z+d/2+.012,dh=(h-.17)/rows;
    for(let row=0;row<rows;row++) {
      const y=h-.11-dh*(row+.5);
      box(x,y,front,w-.065,dh-.035,.03,'#2c261d');
      box(x,y+.006,front+.018,w-.092,dh-.060,.025,shades('#695a3f','#92794e','#3a3123'));
      box(x,y+.053,front+.034,w*.30,.084,.012,'#30291f');
      box(x,y+.053,front+.042,w*.25,.055,.008,'#a99368');
      box(x,y+.053,front+.048,w*.12,.006,.004,'#67563b');
      for(const off of [-.09,.09])box(x+off,y-.065,front+.051,.026,.048,.055,'#29251c');
      box(x,y-.052,front+.089,.206,.028,.02,shades('#3b3428','#a68b5a','#241f19'));
    }
  }
  // The archive cabinets are lit models placed by props.js.
  woodBox(-3.48,2.035,-1.88,.59,.077,.48);
  woodBox(-3.47,2.112,-1.86,.54,.068,.44);

  // Narrow archive shelf at the right hand edge frames the corkboard.
  const sx=3.48,sz=-2.49;
  box(sx,1.40,-2.82,1.60,2.80,.10,'#372c20');
  for(const off of [-.79,.79])woodBox(sx+off,1.40,sz,.09,2.80,.67);
  for(const shelf of [.11,.97,1.80,2.76])woodBox(sx,shelf,sz,1.64,.105,.72);
  const archiveColors=['#5b4b31','#796040','#946f40','#3e392b','#74654a','#8e794e'];
  for(let row=0;row<3;row++) {
    let xx=sx-.66;
    const y=[.18,1.04,1.87][row];
    for(let j=0;j<(row===1?5:7);j++) {
      const bw=[.15,.17,.14,.20,.13,.19,.15][j],bh=(.44+((row+j*3)%5)*.065);
      const fz=sz+.22+Math.sin(j*3+row)*.035;
      box(xx+bw/2,y+bh/2,fz-.19,bw,bh,.38,shades(archiveColors[(row*2+j)%6],'#a78d62','#403321'));
      box(xx+bw/2,y+bh*.71,fz+.003,bw*.67,.075,.008,'#b39b6c');
      box(xx+bw/2,y+bh*.70,fz+.009,bw*.45,.009,.006,'#695539');
      box(xx+bw/2,y+.08,fz+.008,.032,.034,.013,'#382e21');
      xx+=bw+.016;
    }
  }
  // Upholstered wooden visitor's chair at the back of the room.
  const chair=[.02,-1.62];
  for(const dx of [-.29,.29])for(const dz of [-.24,.24]){
    barBetween([chair[0]+dx*1.13,0,chair[1]+dz*1.22],[chair[0]+dx,.58,chair[1]+dz],.047,'#453420');
  }
  woodBox(chair[0],.58,chair[1],.76,.12,.62);
  for(const dx of [-.29,.29]){
    barBetween([chair[0]+dx,.58,chair[1]-.23],[chair[0]+dx,1.39,chair[1]-.33],.043,'#483722');
  }
  box(chair[0],1.22,chair[1]-.32,.69,.32,.065,shades('#765e38','#a7824c','#3f3020'),-.10);

  const board=new THREE.Group(); board.name='Evidence board';
  board.position.set(1.02,2.45,-2.79);room.add(board);
  const bw=2.88,bh=1.72;
  const liveMesh=(parent,shape,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{
    const mesh=new THREE.Mesh(shape,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;
  };
  const solid=col=>makeMat({color:col});
  liveMesh(board,unitBox,solid('#32271c'),.025,-.036,-.023,bw+.14,bh+.16,.08);
  const frame=solid('#725331'),frameEdge=solid('#a88a55');
  liveMesh(board,unitBox,frame,0,0,0,bw+.11,bh+.11,.082);
  for(const sign of [-1,1]){
    liveMesh(board,unitBox,frameEdge,0,sign*(bh/2+.015),.045,bw+.08,.018,.015);
    liveMesh(board,unitBox,frameEdge,sign*(bw/2+.016),0,.046,.014,bh+.035,.014);
  }
  const boardPrint=liveMesh(board,unitPlane,sheetMaterial(factory.board()),0,0,.051,bw,bh,1);
  function setBoardLabels(key,artifact,bleed) {
    boardPrint.material=sheetMaterial(factory.board(key,artifact,bleed));
  }
  const pinAt=(u,v)=>{
    const pin=new THREE.Object3D();pin.position.set((u-.5)*bw,(.5-v)*bh,.071);board.add(pin);return pin;
  };
  const boardPins=[pinAt(464/1260,107/750),pinAt(669/1260,398/750)];
  const boardDir=boardPins[1].position.clone().sub(boardPins[0].position);
  const stringShape=primitive('board-string',()=>new THREE.CylinderGeometry(.009,.009,1,8));
  const boardThread=liveMesh(board,stringShape,solid(CYAN));
  boardThread.position.copy(boardPins[0].position).addScaledVector(boardDir,.5);
  boardThread.quaternion.setFromUnitVectors(V(0,1,0),boardDir.clone().normalize());boardThread.scale.y=boardDir.length();boardThread.visible=false;

  // An institutional clock is a clear round silhouette amid the rectangular files.
  const clockTex=factory.make('office-clock',320,320,(c,w,h)=>{
    c.clearRect(0,0,w,h);ellipse(c,160,160,156,156,'#30281e');
    ellipse(c,158,156,146,146,'#ad9264');ellipse(c,159,158,138,138,'#53402a');ellipse(c,160,158,129,129,'#c4aa76');
    c.save();c.translate(160,158);
    for(let i=0;i<60;i++){
      c.save();c.rotate(i*Math.PI/30);bar(c,-(i%5?1:2),-117,i%5?2:5,i%5?5:13,'#443723');c.restore();
    }
    c.textAlign='center';
    for(const [s,x,y] of [['12',0,-82],['3',93,10],['6',0,103],['9',-93,10]])label(c,s,x,y,22,'#453824','serif','bold');
    line(c,[[0,0],[-44,-28]],'#30271b',9);line(c,[[0,0],[12,-75]],'#30271b',5);
    ellipse(c,0,0,8,8,'#44331e');c.restore();
  });
  const clock=liveMesh(room,unitPlane,makeMat({map:clockTex,transparent:true,alphaTest:.28}),-.41,3.54,-2.829,.61,.61,1);
  clock.name='Wall clock';

  // The desk is deliberately open under the lamp so the camera can orbit the evidence.
  const dx=-.03,dz=.53,dw=4.47,dd=2.08,deskTop=1.075;
  for(const x of [-1.98,1.91])for(const z of [-.30,1.34]) {
    box(x,.48,z,.15,.98,.15,shades('#513d26','#7e5a36','#34291c'));
    box(x,.12,z,.18,.11,.18,'#30291d');
  }
  woodBox(dx,.87,dz,dw-.17,.30,dd-.14);
  woodBox(-1.61,.52,dz,1.00,.80,dd-.29);
  for(let j=0;j<3;j++){
    const yy=.28+j*.243, fx=-1.61, fz=dz+(dd-.29)*.5;
    box(fx,yy,fz+.008,.93,.208,.025,shades('#674b2d','#8b6a3c','#36291c'));
    box(fx,yy+.011,fz+.051,.24,.045,.075,shades('#332a20','#ac8c58','#2b241b'));
  }
  for(const x of [-.04,1.43])box(x,.878,dz+dd/2-.048,.26,.032,.067,shades('#372b1d','#b5965d','#2a2118'));
  box(dx,deskTop-.074,dz,dw,.148,dd,shades('#4c3824','#795433','#36291c'));
  printTop(factory.wood('desk-lamplight',true),dx,deskTop+.001,dz,dw,dd);
  box(dx,deskTop-.027,dz+dd/2+.002,dw,.017,.013,shades('#98723f','#ae8447','#49351e'));
  plane(wood,dx,deskTop-.088,dz+dd/2+.002,dw,.072);

  // Printed and translucent desk shapes are batched separately from interactive objects.
  const shadow=factory.make('contact-shadow',128,96,(c,w,h)=>{
    const g=c.createRadialGradient(w/2,h/2,1,w/2,h/2,w/2);
    g.addColorStop(0,'rgba(17,14,11,.74)');g.addColorStop(.62,'rgba(17,14,11,.45)');g.addColorStop(1,'rgba(17,14,11,0)');
    c.fillStyle=g;c.fillRect(0,0,w,h);
  });
  const shadowMat=makeMat({map:shadow,transparent:true,depthWrite:false});
  function deskShadow(x,z,w,d) {
    const m=liveMesh(room,unitPlane,shadowMat,x,deskTop+.003,z,w,d);
    m.rotation.x=-Math.PI/2;return m;
  }
  deskShadow(-1.33,-.02,.99,.74);
  deskShadow(.30,.93,1.37,.96);
  deskShadow(1.40,.11,1.15,1.30);
  deskShadow(-.25,-.22,1.01,.49);
  // A tapering cutout shadow gives the desk a hard photographic silhouette under the lamp.
  const lampShadow=factory.make('drafting-lamp-shadow',580,410,(c,w,h)=>{
    c.clearRect(0,0,w,h);
    ellipse(c,138,146,94,33,'rgba(17,14,11,.59)');
    polygon(c,[[130,149],[138,152],[68,229],[62,228]],'rgba(17,14,11,.62)');
    polygon(c,[[62,225],[68,229],[8,263],[0,262],[0,256]],'rgba(17,14,11,.63)');
    polygon(c,[[118,147],[124,150],[57,221],[52,220]],'rgba(17,14,11,.44)');
  });
  const castShadow=liveMesh(room,unitPlane,makeMat({map:lampShadow,transparent:true,depthWrite:false}),-.84,deskTop+.005,.53,2.18,1.54);
  castShadow.rotation.x=-Math.PI/2;
  // Tall double-jointed drafting lamp, exposed springs, spun metal shade and incandescent bulb.
  const lampX=-1.36,lampZ=.02;
  tapered([lampX,deskTop+.002,lampZ],[lampX,deskTop+.075,lampZ],.34,.345,'#29251c',48);
  tapered([lampX,deskTop+.076,lampZ],[lampX,deskTop+.13,lampZ],.34,.25,'#4b402a',48);
  tapered([lampX,deskTop+.131,lampZ],[lampX,deskTop+.143,lampZ],.25,.23,'#716044',48);
  cylinder(lampX,deskTop+.21,lampZ,.095,.15,'#312b20');
  const arm=[[lampX,deskTop+.28,lampZ],[-1.72,2.03,-.06],[-1.24,2.66,-.04]];
  function lampArm(a,b,spacing) {
    for(const side of [-1,1]) {
      barBetween([a[0]+spacing*side,a[1],a[2]],[b[0]+spacing*side,b[1],b[2]],.031,'#322b1e',10);
      barBetween([a[0]+spacing*side+.016,a[1]+.005,a[2]+.010],[b[0]+spacing*side+.016,b[1]+.005,b[2]+.010],.008,'#a48a55',6);
    }
  }
  lampArm(arm[0],arm[1],.034);lampArm(arm[1],arm[2],.046);
  for(const a of arm) {
    tapered([a[0],a[1],a[2]-.07],[a[0],a[1],a[2]+.07],.082,.082,'#28241b',20);
    tapered([a[0],a[1],a[2]+.071],[a[0],a[1],a[2]+.080],.044,.044,'#998353',16);
  }
  for(let j=0;j<12;j++){
    const p0=.28+j*.042,p1=p0+.037;
    barBetween([arm[0][0]-.055+(arm[1][0]-arm[0][0])*p0,arm[0][1]+(arm[1][1]-arm[0][1])*p0,arm[0][2]+.035],
      [arm[0][0]+.027+(arm[1][0]-arm[0][0])*p1,arm[0][1]+(arm[1][1]-arm[0][1])*p1,arm[0][2]+.035],.009,'#81704b',5);
  }
  const neck=V(-1.23,2.70,-.05),mouth=V(-.93,2.32,.015),axis=mouth.clone().sub(neck).normalize();
  const shaftPoint=t=>neck.clone().lerp(mouth,t).toArray();
  tapered(shaftPoint(-.14),shaftPoint(.25),.100,.145,'#342b1e',32);
  tapered(shaftPoint(.19),shaftPoint(.48),.134,.218,'#51432d',40);
  tapered(shaftPoint(.48),shaftPoint(.88),.218,.404,'#403524',48);
  tapered(shaftPoint(.88),shaftPoint(.956),.404,.428,'#2b261c',48);
  tapered(shaftPoint(.956),shaftPoint(1.0),.428,.429,'#a08651',48);
  const interior=factory.make('lamp-inner-reflector',320,320,(c,w,h,r)=>{
    c.clearRect(0,0,w,h);
    const light=c.createRadialGradient(141,148,11,160,160,155);
    light.addColorStop(0,'#e8c170');light.addColorStop(.60,'#cfaa65');light.addColorStop(.89,'#ae8a50');light.addColorStop(1,'#8e6c41');
    c.fillStyle=light;c.fillRect(0,0,w,h);
    for(let i=0;i<142;i++){
      const angle=r()*Math.PI*2,rad=112+r()*42,l=2+r()*21;
      const co=Math.cos(angle),si=Math.sin(angle);
      line(c,[[160+co*(rad-l),160+si*(rad-l)],[160+co*rad,160+si*rad]],'rgba(76,52,28,.30)',1);
    }
    for(const rad of [149,153]){c.strokeStyle='#8c6940';c.lineWidth=1;c.beginPath();c.arc(160,160,rad,0,2*Math.PI);c.stroke();}
  });
  const faceEnd=mouth.clone().addScaledVector(axis,.002);
  const disk=primitive('reflector',()=>new THREE.CircleGeometry(1,56));
  bake(disk,faceEnd,new THREE.Quaternion().setFromUnitVectors(V(0,0,1),axis),V(.404,.404,1),INK,sheetMaterial(interior));
  const center=mouth.clone().addScaledVector(axis,.015);
  const sphere=primitive('bulb',()=>new THREE.SphereGeometry(1,20,12));
  bake(sphere,center,identity,V(.092,.092,.092),'#e8c170');
  const lampTarget=center.clone();
  const lampLight=new THREE.SpotLight(PAPER,12,6,.84,.65,2);
  lampLight.name='Inspection spotlight';lampLight.position.copy(lampTarget);
  lampLight.target.position.set(.26,deskTop,.89);
  room.add(lampLight,lampLight.target);

  // Folder, stacked case files, pen tray, stamps, pencils and coffee mug on the desktop.
  const folderTex=factory.make('labeled-folder',580,400,(c,w,h,r)=>{
    paper(c,w,h,r,'#94763e',3400);
    border(c,9,8,w-18,h-16,r,'#624b2f',2);
    bar(c,34,40,197,56,'#b49861');label(c,'A R C H I V E',48,75,21,'#594229','monospace','bold');
    for(let j=0;j<3;j++)line(c,[[36,127+j*12],[215-j*31,127+j*12]],'#715735',1.6);
    for(let i=0;i<30;i++)line(c,[[r()*w,0],[r()*w,h]],'rgba(230,194,122,.09)',.7);
  });
  box(1.42,deskTop+.045,-.005,.94,.08,.71,shades('#9a8252','#ac915a','#6e5430'),0,-.084);
  box(1.39,deskTop+.108,-.01,.96,.046,.69,shades('#b29b6a','#ad9058','#725733'),0,-.12);
  printTop(folderTex,1.39,deskTop+.133,-.01,.96,.69,.12);
  box(-.31,deskTop+.03,-.25,.88,.055,.29,'#413324');
  box(-.31,deskTop+.063,-.25,.78,.012,.19,'#6f5732');
  for(let j=0;j<3;j++) {
    const px=-.62+j*.15,z=-.27+j*.035;
    barBetween([px,deskTop+.084,z],[px+.35,deskTop+.084,z+.012],.014,j===1?'#b59855':'#362d20',8);
  }
  cylinder(.49,deskTop+.018,-.153,.14,.036,'#423723');
  tapered([.49,deskTop+.033,-.153],[.49,deskTop+.27,-.153],.108,.137,'#8b7651',32);
  cylinder(.49,deskTop+.272,-.153,.136,.01,'#c0a578');
  cylinder(.49,deskTop+.28,-.153,.108,.007,'#463a28');
  const torus=primitive('mug-handle',()=>new THREE.TorusGeometry(1,.22,6,16));
  bake(torus,V(.631,deskTop+.17,-.153),identity,V(.070,.075,.063),'#9d8253');
  const inkPadX=-.71,inkPadZ=.55;
  box(inkPadX,deskTop+.025,inkPadZ,.26,.044,.17,'#362b1d',0,.17);
  box(inkPadX,deskTop+.049,inkPadZ,.224,.01,.132,'#4f3c29',0,.17);
  box(-.84,deskTop+.018,.66,.18,.032,.101,'#342a1d',0,-.24);
  tapered([-.84,deskTop+.037,.66],[-.84,deskTop+.142,.66],.029,.048,'#7a5930',16);
  tapered([-.84,deskTop+.142,.66],[-.84,deskTop+.153,.66],.048,.04,'#9a7844',16);
  const pencilA=[-.35,deskTop+.02,.52],pencilB=[.20,deskTop+.02,.39];
  barBetween(pencilA,pencilB,.012,'#b49046',6);
  barBetween([-.40,deskTop+.019,.531],pencilA,.007,'#2c261c',6);

  // A small oscillator fan gives the window a recognizable period silhouette.
  const fx=-2.80,fz=-1.81,fanCY=2.07,fanR=.35;
  box(fx,1.55,fz,.39,.057,.31,shades('#494334','#857956','#3e372b'));
  tapered([fx,1.57,fz],[fx,1.99,fz],.09,.04,'#4b4430',16);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3+.28;
    bake(sphere,V(fx+Math.cos(a)*.13,fanCY+Math.sin(a)*.13,fz),rot(0,0,a-.36),V(.18,.080,.034),'#5a4b32');
  }
  function ring(x,y,z,r,t,color,parts=36) {
    const key='ring/'+r+'/'+t+'/'+parts;
    const g=primitive(key,()=>new THREE.TorusGeometry(r,t,5,parts));
    bake(g,V(x,y,z),identity,V(1,1,1),color);
  }
  for(const r of [.13,.235,fanR])ring(fx,fanCY,fz+.047,r,.009,'#463e2c',36);
  for(let n=0;n<16;n++) {
    const a=n*Math.PI/8;
    barBetween([fx,fanCY,fz+.078],[fx+fanR*Math.cos(a),fanCY+fanR*Math.sin(a),fz+.036],.006,'#4c4330',5);
  }
  bake(sphere,V(fx,fanCY,fz+.076),identity,V(.063,.063,.034),'#88764c');

  for(const [mat,data] of batches) {
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
    if(data.colors.length)g.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));
    if(data.uv.length)g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));
    g.computeBoundingSphere();geometry.add(g);room.add(new THREE.Mesh(g,mat));
  }
  batches.clear();

  function makeDocument(name,texture,w,h,edge='#715837',thickness=.012) {
    const group=new THREE.Group();group.name=name;room.add(group);
    liveMesh(group,unitBox,solid(edge),0,0,0,w,h,thickness);
    liveMesh(group,unitPlane,sheetMaterial(texture),0,0,thickness/2+.0007,w,h);
    const reverse=factory.make('paper-reverse',400,260,(c,ww,hh,r)=>{
      paper(c,ww,hh,r,'#c2a574',2300);border(c,8,8,ww-16,hh-16,r,'#987e4f',1.3);
      label(c,'RECORDS   /   DUPLICATE',15,24,9,'#947849');
    });
    const back=liveMesh(group,unitPlane,sheetMaterial(reverse),0,0,-thickness/2-.0007,w,h); back.rotation.y=Math.PI;
    return group;
  }
  const rest=(obj,x,y,z,angle)=>{obj.position.set(x,y,z);obj.rotation.set(-Math.PI/2,0,angle);};
  const visa=makeDocument('Forged medical visa',factory.visa(),.97,.686);
  rest(visa,.24,deskTop+.026,.88,-.11);
  const phone=makeDocument('Burner phone',factory.phone(),.22,.385,'#29271d',.037);
  rest(phone,-1.32,deskTop+.032,1.17,-.23);
  const manifest=makeDocument('Redacted clinic manifest',factory.manifest(),.75,.533);
  rest(manifest,1.43,deskTop+.154,.0,.095);
  const revealStamp=(group,code,x,y,z,w,h)=>{
    const material=makeMat({map:factory.stamp(code),transparent:true,depthWrite:false});
    const stamp=liveMesh(group,unitPlane,material,x,y,z,w,h);
    stamp.rotation.z=.10;stamp.visible=false;group.userData.detail=stamp;
  };
  revealStamp(visa,'A17',.30,.046,.009,.219,.088);
  revealStamp(phone,'0147',0,.030,.020,.164,.066);
  revealStamp(manifest,'UNSIGNED',.15,-.081,.009,.269,.108);

  const papers={visa:factory.form('receipt'),phone:factory.make('callback-copy',360,295,(c,w,h,r)=>{
    paper(c,w,h,r,'#c9af74');border(c,9,9,w-18,h-18,r,'#8b7049',2);
    label(c,'CALLBACK NOTE',23,69,33,INK,'Georgia','bold');label(c,'0147',23,157,74);label(c,'M. VALE',24,240,21);
  }),manifest:factory.make('consent-carbon',400,300,(c,w,h,r)=>{
    paper(c,w,h,r,'#bfa16b');border(c,10,10,w-20,h-20,r,'#816441',2);
    label(c,'CONSENT ENTRY',24,61,33,INK,'Georgia','bold');label(c,'M. VALE   /   A17',24,116,23);
    line(c,[[25,201],[w-30,201]],INK,2);label(c,'UNSIGNED COPY',25,258,17,'#665033');
  })};
  const rects={visa:[.46,.49,.91,.61,-.20],phone:[.42,.34,-1.38,.94,.17],manifest:[.56,.40,1.28,.68,.14]};
  const names={visa:'Carbon receipt',phone:'Callback note',manifest:'Unsigned carbon copy'};
  const bleeds={},memoryTargets={};
  for(const key of Object.keys(rects)){
    const [w,h,x,z,a]=rects[key];
    const record=makeDocument(names[key],papers[key],w,h);
    rest(record,x,deskTop+.029,z,a);record.visible=false;bleeds[key]=record;
    const memory=makeDocument(names[key]+' in memory',papers[key],w,h);
    rest(memory,x,deskTop+.033,z,a);memory.visible=false;memoryTargets[key]=memory;
  }
  // Light streaks are transparent, split by the blind, and remain fixed in room space.
  const beamTexture=factory.make('light-shaft',256,128,(c,w,h,r)=>{
    const values=c.createImageData(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const t=x/(w-1),side=Math.abs(y/(h-1)*2-1),j=(y*w+x)*4;
      const soft=Math.max(0,1-side**(1.1+t*2));
      values.data[j]=232;values.data[j+1]=193;values.data[j+2]=112;
      values.data[j+3]=Math.round(33*soft*(1-t)**.72*(.70+r()*.30));
    }
    c.putImageData(values,0,0);
  });
  const beamMat=makeMat({map:beamTexture,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  const shaftPositions=[],shaftUV=[];
  for(let n=0;n<7;n++){
    const t=n/6, x=-3.65+t*2.34,y=3.43+t*.035,z=-2.755;
    const p0=[x,y,z],p1=[x+.15,y,z],p2=[x+2.60,.09,.98],p3=[x+2.18,.09,.98];
    shaftPositions.push(...p0,...p1,...p2,...p0,...p2,...p3);
    shaftUV.push(0,0,0,1,1,1,0,0,1,1,1,0);
  }
  const stripes=new THREE.BufferGeometry();
  stripes.setAttribute('position',new THREE.Float32BufferAttribute(shaftPositions,3));
  stripes.setAttribute('uv',new THREE.Float32BufferAttribute(shaftUV,2));geometry.add(stripes);
  const lightShafts=new THREE.Mesh(stripes,beamMat);room.add(lightShafts);
  const shadowCutout=liveMesh(room,unitPlane,makeMat({map:factory.cutout(),transparent:true,depthWrite:false}),-.21,deskTop+.044,.61,1.63,1.20);
  shadowCutout.rotation.x=-Math.PI/2;shadowCutout.visible=false;

  const home={position:V(2.65,3.05,5.65),target:V(0,1.58,-.30)};
  const memoryView={position:V(-1.31,2.12,2.72),target:V(.23,1.28,.15)};
  const boardView={position:V(1.04,2.46,.46),target:V(1.02,2.45,-2.79)};
  const updateMemory=(blend,key='visa')=>{
    const active=Math.min(1,Math.max(0,blend));
    shadowCutout.visible=active>.01;shadowCutout.material.opacity=active*.85;
    for(const [id,obj] of Object.entries(memoryTargets))obj.visible=id===key && active>.18;
    lampLight.intensity=12-8*active;beamMat.opacity=1-active*.9;
  };
  let disposed=false;
  function dispose() {
    if(disposed)return;disposed=true;
    scene.remove(room);
    materials.forEach(m=>m.dispose());geometry.forEach(g=>g.dispose());
    materials.clear();geometry.clear();factory.dispose();
    if(lampLight.dispose)lampLight.dispose();
  }
  return {artifacts:{visa,phone,manifest},board,boardPins,boardThread,setBoardLabels,bleed:bleeds.visa,bleeds,
    memoryTarget:memoryTargets.visa,memoryTargets,lampTarget,home,memoryView,boardView,updateMemory,setSunlight(value){beamMat.opacity=value*.84;},dispose};
}
