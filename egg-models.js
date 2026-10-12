// 알 훔치기 — 펫 · 수호 동물 · 알 모델 (카툰: 툰 셰이딩 + 검은 외곽선, 부품을 한 덩어리로 합쳐서 가볍게)
export function initModels(THREE){
  const SEG = { sph:new THREE.SphereGeometry(1,14,10), cyl:new THREE.CylinderGeometry(1,1,1,10), cone:new THREE.ConeGeometry(1,1,10), box:new THREE.BoxGeometry(1,1,1),
    tor:new THREE.TorusGeometry(1,.28,6,14), cap:new THREE.CylinderGeometry(1,1,1,10,1,false,0,Math.PI) };
  const C = c=>new THREE.Color(c);
  const D2R = Math.PI/180;
  // ---------- 부품 ----------
  function part(g, geo, c, x, y, z, sx, sy, sz, rx, ry, rz){ const m=new THREE.Mesh(geo,{ color:C(c) }); m.position.set(x||0,y||0,z||0); m.scale.set(sx==null?1:sx, sy==null?(sx==null?1:sx):sy, sz==null?(sx==null?1:sx):sz); m.rotation.set(rx||0,ry||0,rz||0); g.add(m); return m; }
  const ball=(g,c,x,y,z,sx,sy,sz,rx,ry,rz)=>part(g,SEG.sph,c,x,y,z,sx,sy,sz,rx,ry,rz);
  const cyl=(g,c,x,y,z,r,h,rx,ry,rz,r2)=>part(g,SEG.cyl,c,x,y,z,r,h,r2==null?r:r2,rx,ry,rz);
  const cone=(g,c,x,y,z,r,h,rx,ry,rz,r2)=>part(g,SEG.cone,c,x,y,z,r,h,r2==null?r:r2,rx,ry,rz);
  const box=(g,c,x,y,z,sx,sy,sz,rx,ry,rz)=>part(g,SEG.box,c,x,y,z,sx,sy,sz,rx,ry,rz);
  // 반짝이는 큰 눈 (검은 눈동자 + 흰 반짝임)
  function eyes(g,x,y,z,r,gap,o){ o=o||{}; for (const s of [-1,1]){ const ex=x+s*gap; const ang=(o.side?s*o.side:0);
      const ox=Math.sin(ang)*r*.5, oz=Math.cos(ang)*r*.5;
      ball(g,o.white||0xffffff,ex,y,z,r,r*(o.tall||1.1),r*.7);
      ball(g,o.pupil||0x161620,ex+ox*.5,y-r*.05,z+oz*.62,r*.62,r*.72*(o.tall||1),r*.4);
      ball(g,0xffffff,ex+ox*.5+r*.18,y+r*.25,z+oz*.95,r*.2,r*.2,r*.12); } }
  function wing(g,c,x,y,z,side,sz){ for (let k=0;k<3;k++){ const a=(k-1)*.35; ball(g,k===1?c:new THREE.Color(c).multiplyScalar(.85).getHex(),x+side*(.35+k*.12)*sz,y+(.15-k*.12)*sz,z-(.05+k*.15)*sz,.1*sz,.42*sz,.62*sz,a,side*.5,side*(1.1+k*.15)); } }
  const blush=(g,x,y,z,gap,r)=>{ for (const s of [-1,1]) ball(g,0xff8aa8,x+s*gap,y,z,r,r*.6,r*.3); };

  // ---------- 몸 틀 ----------
  // 네발짐승: c 몸 · c2 배/주둥이 · ear: pointy|round|floppy|tiny|long|none · tail: bushy|thin|ring|short|curl|none · snout 길이
  function quad(o){ const g=new THREE.Group(); const c=o.c, c2=o.c2==null?c:o.c2, L=o.leg==null?.42:o.leg, bw=o.bw||1, bl=o.bl||1, hs=o.hs||1;
    const by=L+.42*(o.bh||1);
    ball(g,c,0,by,0,.6*bw,.5*(o.bh||1),.74*bl); ball(g,c2,0,by-.12,.1,.44*bw,.34*(o.bh||1),.55*bl);
    for (const sx of [-1,1]) for (const sz of [-1,1]){ const lx=sx*.34*bw, lz=sz*.44*bl; cyl(g,o.legC||c,lx,L/2+.04,lz,.15,L+.08); ball(g,o.paw||c2,lx,.07,lz+.04,.17,.09,.21); }
    const hy=by+.55*hs+(o.neck||0), hz=.55*bl+(o.neck||0)*.25;
    if (o.neck) { cyl(g,c,0,by+.4+o.neck*.5,hz*.7,.22,o.neck+.4,-.35,0,0); }
    const H=new THREE.Group(); H.position.set(0,hy,hz); g.add(H);
    ball(H,c,0,0,0,.5*hs,.46*hs,.46*hs);
    if (o.mane){ for (let k=0;k<4;k++) ball(H,o.mane,0,(.38-k*.16)*hs,(-.28-k*.06)*hs,.16*hs,.2*hs,.22*hs); }
    if (o.snout!==0){ const sn=o.snout||1; ball(H,c2,0,-.13*hs,.34*hs,.25*hs*Math.min(1.3,sn),.18*hs,.2*hs*sn); ball(H,o.nose||0x2a1a1a,0,-.06*hs,(.34+.2*sn)*hs,.08*hs,.06*hs,.05*hs); }
    eyes(H,0,.06*hs,.36*hs,.11*hs,.19*hs,{ side:.5 }); blush(H,0,-.1*hs,.38*hs,.3*hs,.07*hs);
    const ec=o.earC||c, ein=o.earIn||0xffb8c8;
    if (o.ear==="pointy"){ for (const s of [-1,1]){ cone(H,ec,s*.27*hs,.42*hs,-.02,.15*hs,.34*hs,0,0,-s*.25); cone(H,ein,s*.27*hs,.4*hs,.03,.08*hs,.22*hs,0,0,-s*.25); } }
    else if (o.ear==="round"){ for (const s of [-1,1]){ ball(H,ec,s*.32*hs,.36*hs,-.05,.15*hs,.15*hs,.07*hs); ball(H,ein,s*.32*hs,.36*hs,-.01,.08*hs,.08*hs,.04*hs); } }
    else if (o.ear==="floppy"){ for (const s of [-1,1]) ball(H,ec,s*.44*hs,0,-.02,.1*hs,.3*hs,.17*hs,0,0,s*.25); }
    else if (o.ear==="long"){ for (const s of [-1,1]){ ball(H,ec,s*.16*hs,.62*hs,-.04,.1*hs,.38*hs,.07*hs,0,0,-s*.12); ball(H,ein,s*.16*hs,.62*hs,0,.05*hs,.28*hs,.04*hs,0,0,-s*.12); } }
    else if (o.ear==="big"){ for (const s of [-1,1]){ ball(H,ec,s*.4*hs,.42*hs,-.04,.24*hs,.32*hs,.06*hs,0,0,-s*.5); ball(H,ein,s*.4*hs,.42*hs,0,.15*hs,.22*hs,.04*hs,0,0,-s*.5); } }
    else if (o.ear==="tiny"){ for (const s of [-1,1]) ball(H,ec,s*.3*hs,.36*hs,-.05,.09*hs,.09*hs,.05*hs); }
    if (o.mask) { ball(H,o.mask,0,.07*hs,.3*hs,.44*hs,.13*hs,.2*hs); eyes(H,0,.06*hs,.38*hs,.11*hs,.19*hs,{ side:.5 }); }
    if (o.horn==="bull") for (const s of [-1,1]) cone(H,0xf4ecd8,s*.42*hs,.25*hs,0,.07*hs,.4*hs,0,0,-s*1.1);
    if (o.horn==="unicorn") cone(H,o.hornC||0xffe14d,0,.55*hs,.2*hs,.08*hs,.55*hs,.35,0,0);
    if (o.horn==="antler") for (const s of [-1,1]){ cyl(H,0x8a6a3a,s*.22*hs,.55*hs,0,.035*hs,.5*hs,0,0,-s*.4); cyl(H,0x8a6a3a,s*.38*hs,.7*hs,0,.03*hs,.3*hs,0,0,-s*1.1); cyl(H,0x8a6a3a,s*.3*hs,.82*hs,.05,.03*hs,.25*hs,0,0,s*.3); }
    if (o.horn==="oni") for (const s of [-1,1]) cone(H,0xfff4d0,s*.22*hs,.48*hs,0,.07*hs,.3*hs,0,0,-s*.25);
    if (o.tusk) for (const s of [-1,1]) cone(H,0xfff8e8,s*.14*hs,-.32*hs,.42*hs,.05*hs,.38*hs,Math.PI-.4,0,s*.2);
    if (o.trunk){ cyl(H,c,0,-.3*hs,.5*hs,.1*hs,.5*hs,.5,0,0); cyl(H,c,0,-.55*hs,.6*hs,.08*hs,.25*hs,.1,0,0); }
    if (o.fang) for (const s of [-1,1]) cone(H,0xffffff,s*.08*hs,-.3*hs,.4*hs,.04*hs,.22*hs,Math.PI,0,0);
    // 꼬리
    const tz=-.72*bl, ty=by+.08;
    if (o.tail==="bushy"){ ball(g,c,0,ty+.18,tz-.15,.24,.24,.42,-.7,0,0); ball(g,o.tailTip||c2,0,ty+.42,tz-.38,.17,.17,.2); }
    else if (o.tail==="thin"){ cyl(g,c,0,ty+.1,tz-.25,.05,.6,-1,0,0); }
    else if (o.tail==="ring"){ for (let i=0;i<5;i++) ball(g,i%2?0x2a2a30:c,0,ty+.05+i*.1,tz-.1-i*.12,.15,.12,.12); }
    else if (o.tail==="short"){ ball(g,o.tailTip||c2,0,ty+.08,tz,.14,.14,.14); }
    else if (o.tail==="curl"){ part(g,SEG.tor,c,0,ty+.25,tz-.05,.16,.16,.16,0,Math.PI/2,0); }
    else if (o.tail==="long"){ cone(g,c,0,ty,tz-.45,.13,.9,-Math.PI/2+.25,0,0); }
    else if (o.tail==="nine"){ for (let i=0;i<9;i++){ const a=(i-4)*.3; ball(g,c,Math.sin(a)*.45,ty+.35+Math.cos(a)*.15,tz-.25,.13,.13,.42,-.9,a,0); ball(g,o.tailTip||0xffffff,Math.sin(a)*.62,ty+.62,tz-.5,.1,.1,.12); } }
    // 무늬
    if (o.stripes) for (let i=0;i<4;i++){ box(g,o.stripes,0,by+.38,-.45+i*.26,.08,.28,.05,0,0,0); for (const s of [-1,1]) box(g,o.stripes,s*.56*bw,by,-.45+i*.26,.05,.3,.06); }
    if (o.spots) for (let i=0;i<6;i++){ const a=i*1.1; ball(g,o.spots,Math.cos(a)*.48*bw,by+.18+Math.sin(i)*.12,Math.sin(a)*.5*bl,.1,.08,.1); }
    if (o.hump) for (let i=0;i<o.hump;i++) ball(g,c,0,by+.45,-.15+i*.32*(o.hump>1?1:0),.26,.3,.24);
    if (o.wings) for (const s of [-1,1]) wing(g,o.wings,s*.45,by+.45,-.05,s,1);
    if (o.shell){ ball(g,o.shell,0,by+.05,0,.66*bw,.42,.78*bl); for (let i=0;i<5;i++) ball(g,o.shell2||0x6a5a2a,Math.cos(i*1.25)*.32,by+.33,Math.sin(i*1.25)*.38,.15,.07,.15); }
    if (o.headgear) o.headgear(H,hs);
    if (o.extra) o.extra(g,{ by, L, bw, bl, hy, hz, H });
    return g; }
  // 새
  function bird(o){ const g=new THREE.Group(); const c=o.c, c2=o.c2==null?c:o.c2, s=o.s||1;
    ball(g,c,0,.62*s,0,.52*s,.5*s,.58*s); ball(g,c2,0,.52*s,.2*s,.36*s,.34*s,.32*s);
    for (const k of [-1,1]){ ball(g,o.wing||c,k*.5*s,.66*s,-.05,.14*s,.32*s,.38*s,.2,0,k*.25); }
    if (o.tail!==false) cone(g,o.tailC||c,0,.82*s,-.55*s,.2*s,.4*s,-2.2,0,0);
    for (const k of [-1,1]){ cyl(g,o.leg||0xffa52e,k*.16*s,.13*s,0,.04*s,.28*s); ball(g,o.leg||0xffa52e,k*.16*s,.02,.07*s,.09*s,.03*s,.13*s); }
    const nk=o.neck||0; if (nk){ for (let i=0;i<5;i++){ const t=i/4; ball(g,c,0,(.9+t*nk)*s,(.25+Math.sin(t*2.2)*.25)*s,.14*s,.16*s,.14*s); } }
    const H=new THREE.Group(); H.position.set(0,(.98+nk)*s,(.25+(nk?.2:0))*s); g.add(H); const hs=(o.hs||1)*s;
    ball(H,o.headC||c,0,0,0,.36*hs,.34*hs,.34*hs);
    const bl=o.beakL||1; cone(H,o.beak||0xffa52e,0,-.04*hs,.38*hs+.12*hs*bl,.1*hs*(o.beakW||1),.28*hs*bl,Math.PI/2,0,0);
    eyes(H,0,.06*hs,.26*hs,(o.bigEye?.12:.085)*hs,(o.bigEye?.15:.15)*hs,{ side:.6 });
    if (o.comb){ for (let i=0;i<3;i++) ball(H,0xff2a2a,0,.32*hs,(.1-i*.1)*hs,.07*hs,.1*hs,.07*hs); ball(H,0xff2a2a,0,-.2*hs,.36*hs,.06*hs,.09*hs,.05*hs); }
    if (o.tuft) for (const k of [-1,1]) cone(H,o.c,k*.2*hs,.36*hs,0,.07*hs,.18*hs,0,0,-k*.3);
    if (o.crest) for (let i=0;i<3;i++) cone(H,o.crest,0,.35*hs,(-.05-i*.08)*hs,.05*hs,.25*hs,-.4-i*.2,0,0);
    if (o.crown) o.crown(H,hs);
    return g; }
  // 물고기
  function fish(o){ const g=new THREE.Group(); const c=o.c, c2=o.c2==null?c:o.c2, L=o.len||1, s=o.s||1; const y=.75*s;
    ball(g,c,0,y,0,.42*s*(o.fat||1),.45*s*(o.fat||1),.75*s*L); ball(g,c2,0,y-.15*s,.05,.32*s*(o.fat||1),.28*s,.6*s*L);
    part(g,SEG.cone,o.fin||c,0,y,-.85*s*L,.35*s,.05*s,.45*s,Math.PI/2,0,0); part(g,SEG.cone,o.fin||c,0,y+.35*s,-.1*s,.2*s,.35*s,.05*s,0,0,0);
    for (const k of [-1,1]) part(g,SEG.cone,o.fin||c,k*.4*s,y-.12*s,.15*s,.16*s,.05*s,.25*s,.4,0,k*1.2);
    eyes(g,0,y+.1*s,.52*s*L,.1*s,.24*s,{ side:.9 });
    if (o.whisker) for (const k of [-1,1]) cyl(g,0x2a2a2a,k*.22*s,y-.12*s,.66*s*L,.02,.5*s,0,0,k*1.2);
    if (o.spots) for (let i=0;i<10;i++) ball(g,o.spots,Math.cos(i*2.4)*.4*s,y+Math.sin(i*1.7)*.25*s,(i/10-.5)*1.2*s*L,.06*s,.06*s,.06*s);
    if (o.spikes) for (let i=0;i<14;i++){ const a=i*2.4, b=i*.9; cone(g,0xfff4d0,Math.cos(a)*Math.sin(b)*.45*s,y+Math.cos(b)*.45*s,Math.sin(a)*Math.sin(b)*.6*s,.04*s,.16*s,b,a,0); }
    if (o.hammer) box(g,c,0,y+.05*s,.75*s*L,.95*s,.16*s,.2*s);
    if (o.stripes) for (let i=0;i<3;i++) box(g,o.stripes,0,y,(-.3+i*.3)*s*L,.86*s,.7*s,.06*s);
    if (o.extra) o.extra(g,{ y, s, L });
    return g; }
  // 파충류 · 공룡
  function rept(o){ const g=new THREE.Group(); const c=o.c, c2=o.c2==null?c:o.c2, L=o.leg==null?.25:o.leg, s=o.s||1, bl=o.bl||1;
    const by=(L+.35)*s;
    if (o.biped){ ball(g,c,0,by+.35*s,0,.5*s,.62*s,.62*s*bl,-.4,0,0); ball(g,c2,0,by+.25*s,.18*s,.36*s,.45*s,.32*s,-.4,0,0);
      for (const k of [-1,1]){ ball(g,c,k*.32*s,by-.1*s,-.05*s,.2*s,.36*s,.26*s); cyl(g,c,k*.32*s,L*s*.5,.02,.11*s,L*s+.1); ball(g,c2,k*.32*s,.05,.1*s,.16*s,.07*s,.22*s); cyl(g,c,k*.32*s,by+.4*s,.45*s,.05*s,.22*s,1.2,0,0); } }
    else { ball(g,c,0,by,0,.52*s*(o.bw||1),.4*s,.75*s*bl); ball(g,c2,0,by-.12*s,.05*s,.4*s*(o.bw||1),.25*s,.6*s*bl);
      for (const sx of [-1,1]) for (const sz of [-1,1]){ cyl(g,c,sx*.38*s*(o.bw||1),L*s*.5+.03,sz*.42*s*bl,.12*s,L*s+.08); ball(g,c2,sx*.38*s*(o.bw||1),.05,sz*.42*s*bl+.05,.14*s,.06*s,.18*s); } }
    if (o.tail!==false) cone(g,c,0,by+(o.biped?.1:0)*s,-.95*s*bl,.25*s,1*s*(o.tailL||1),-Math.PI/2+.12,0,0);
    const nk=o.neck||0;
    if (nk) for (let i=0;i<6;i++){ const t=i/5; ball(g,c,0,by+(.3+t*nk)*s,(.55+t*.5)*s*bl,.2*s,.2*s,.2*s); }
    const H=new THREE.Group(); H.position.set(0,by+(o.biped?1.05:.25+nk)*s,(o.biped?.55:.72+(nk?.5:0))*s*bl); g.add(H); const hs=(o.hs||1)*s;
    ball(H,c,0,0,0,.4*hs,.34*hs,.42*hs); const sn=o.snout||1; ball(H,c,0,-.06*hs,.35*hs*sn,.32*hs,.22*hs,.32*hs*sn); ball(H,c2,0,-.16*hs,.35*hs*sn,.28*hs,.1*hs,.3*hs*sn);
    eyes(H,0,.16*hs,.2*hs,.11*hs,.2*hs,{ side:.7 });
    if (o.teeth) for (let i=0;i<5;i++) for (const k of [-1,1]) cone(H,0xffffff,k*.2*hs,-.14*hs,(.15+i*.12)*hs*sn,.03*hs,.08*hs,Math.PI,0,0);
    if (o.spikes) for (let i=0;i<6;i++) cone(g,o.spikes,0,by+.38*s,(.45-i*.22)*s*bl,.09*s,.22*s);
    if (o.plates) for (let i=0;i<5;i++) part(g,SEG.cone,o.plates,0,by+.45*s,(.4-i*.24)*s*bl,.18*s,.32*s,.05*s);
    if (o.frill){ part(g,SEG.cyl,o.frill,0,.15*hs,-.12*hs,.55*hs,.06*hs,.55*hs,Math.PI/2-.3,0,0); for (const k of [-1,1]) cone(H,0xfff4d0,k*.2*hs,.3*hs,.15*hs,.06*hs,.4*hs,.8,0,-k*.3); cone(H,0xfff4d0,0,.02*hs,.62*hs,.05*hs,.22*hs,1.2,0,0); }
    if (o.club) ball(g,o.club,0,by,-1.5*s*bl,.25*s,.2*s,.25*s);
    if (o.shellArmor) ball(g,o.shellArmor,0,by+.1*s,0,.58*s,.38*s,.7*s*bl);
    if (o.gills) for (const k of [-1,1]) for (let i=0;i<3;i++) cone(H,o.gills,k*.38*hs,(.05+i*.12)*hs,-.05,.05*hs,.25*hs,0,0,-k*(1+i*.3));
    if (o.wings) for (const k of [-1,1]) wing(g,o.wings,k*.4*s,by+.55*s,-.05,k,1.25*s);
    if (o.horns) for (const k of [-1,1]) cone(H,o.horns,k*.2*hs,.36*hs,-.1*hs,.06*hs,.35*hs,-.4,0,-k*.3);
    if (o.flame) for (let i=0;i<4;i++) cone(g,i%2?0xffd23a:0xff5a1a,(i-1.5)*.12*s,by+.5*s,-.2*s+i*.1,.1*s,.4*s);
    if (o.headgear) o.headgear(H,hs);
    if (o.extra) o.extra(g,{ by, s, H, hs });
    return g; }
  function snake(o){ const g=new THREE.Group(); const c=o.c, c2=o.c2==null?c:o.c2, s=o.s||1;
    for (let i=0;i<11;i++){ const t=i/10; ball(g,i%2&&o.band?o.band:c,Math.sin(t*6)*.35*s,(.16+(t>.8?(t-.8)*2.5:0))*s,(-.9+t*1.5)*s,.2*s*(1-t*.25),.2*s,.22*s); }
    const H=new THREE.Group(); H.position.set(Math.sin(6)*.35*s,.72*s,.68*s); g.add(H); ball(H,c,0,0,0,.3*s,.24*s,.34*s); ball(H,c2,0,-.08*s,.1*s,.24*s,.12*s,.26*s);
    eyes(H,0,.1*s,.2*s,.08*s,.15*s,{ side:.6 }); cyl(H,0xff2a4a,0,-.08*s,.42*s,.015*s,.2*s,Math.PI/2,0,0);
    if (o.crown) o.crown(H,s); return g; }
  function bug(o){ const g=new THREE.Group(); const c=o.c, s=o.s||1;
    ball(g,c,0,.55*s,-.35*s,.5*s,.42*s,.55*s); ball(g,c,0,.5*s,.3*s,.32*s,.28*s,.32*s); eyes(g,0,.62*s,.55*s,.08*s,.12*s,{ side:.4 }); eyes(g,0,.72*s,.5*s,.05*s,.06*s,{ side:.3 });
    for (let i=0;i<4;i++) for (const k of [-1,1]){ const z=(.35-i*.22)*s; cyl(g,o.leg||c,k*.5*s,.55*s,z,.05*s,.55*s,0,0,k*1.1); cyl(g,o.leg||c,k*.85*s,.28*s,z,.04*s,.5*s,0,0,-k*.35); }
    if (o.mark) ball(g,o.mark,0,.85*s,-.35*s,.2*s,.06*s,.25*s);
    if (o.claws) for (const k of [-1,1]){ cyl(g,c,k*.35*s,.5*s,.65*s,.07*s,.4*s,1.3,0,0); ball(g,c,k*.38*s,.5*s,.92*s,.14*s,.1*s,.18*s); }
    if (o.stinger){ for (let i=0;i<5;i++) ball(g,c,0,(.6+i*.18)*s,(-.85-Math.sin(i*.5)*.2+i*.06)*s,.12*s,.12*s,.12*s); cone(g,0x2a1a0a,0,1.55*s,-.75*s,.06*s,.22*s,1.6,0,0); }
    return g; }

  // ---------- 특별한 펫 ----------
  const SPECIAL={
    "브르 브르 파타핌":()=>{ const g=new THREE.Group(); cyl(g,0x8a5a2a,0,.7,0,.42,1.2,0,0,0,.5); for (const k of [-1,1]){ cyl(g,0x7a4a20,k*.22,.1,.05,.12,.3); ball(g,0x7a4a20,k*.22,.02,.12,.15,.06,.2); cyl(g,0x7a4a20,k*.5,.8,.05,.07,.6,0,0,k*.9); }
      ball(g,0xf0c9a0,0,1.0,.33,.32,.3,.12); eyes(g,0,1.08,.42,.09,.13); ball(g,0xe8b080,0,.82,.52,.11,.11,.3); ball(g,0x3a9a3a,0,1.45,0,.6,.35,.55); ball(g,0x4ab04a,.25,1.6,.1,.3,.25,.3); ball(g,0x2a8a2a,-.25,1.55,-.1,.3,.25,.3); return g; },
    "트룰리메로 트룰리치나":()=>{ const g=fish({ c:0x5ab0d8, c2:0xd8f0ff, fin:0x3a8ab0, s:.85 }); const H=new THREE.Group(); H.position.set(0,.65,.55); g.add(H); ball(H,0xf0d0a0,0,.1,0,.32,.3,.28); for (const k of [-1,1]) cone(H,0xf0d0a0,k*.2,.38,0,.09,.2,0,0,-k*.3); eyes(H,0,.14,.22,.07,.12);
      for (const k of [-1,1]){ cyl(g,0xf0c9a0,k*.18,.25,.1,.07,.45); ball(g,0x2a2a2a,k*.18,.03,.18,.1,.06,.16); } return g; },
    "톱 토비 톱 톱":()=>{ const g=new THREE.Group(); cyl(g,0xc98a4a,0,.65,0,.5,1,0,0,0); cyl(g,0xf4ecd8,0,1.17,0,.52,.05); part(g,SEG.tor,0xff5a3a,0,.4,0,.5,.5,.5,Math.PI/2,0,0); part(g,SEG.tor,0xff5a3a,0,.9,0,.5,.5,.5,Math.PI/2,0,0);
      eyes(g,0,.75,.47,.1,.17); ball(g,0x5a2a10,0,.5,.49,.12,.06,.04); for (const k of [-1,1]){ cyl(g,0xc98a4a,k*.6,.75,0,.05,.5,0,0,k*.8); cyl(g,0x8a5a2a,k*.25,.15,0,.08,.3); cyl(g,0xfff4d0,k*.4,1.5,.1,.03,.6,.4,0,-k*.4); } return g; },
    "오랑구티니 아나나시니":()=>{ const g=new THREE.Group(); ball(g,0xffc83a,0,.75,0,.6,.72,.6); for (let i=0;i<14;i++){ const a=i*.9, y=.3+(i%5)*.22; ball(g,0xd99a1a,Math.cos(a)*.56,y,Math.sin(a)*.56,.08,.08,.04); }
      for (let i=0;i<7;i++){ const a=i/7*Math.PI*2; cone(g,0x3aa04a,Math.cos(a)*.15,1.6,Math.sin(a)*.15,.12,.6,Math.sin(a)*.4,0,-Math.cos(a)*.4); }
      ball(g,0xd9824a,0,.85,.42,.36,.32,.2); ball(g,0xf0c090,0,.78,.55,.24,.18,.1); eyes(g,0,.95,.55,.08,.12); for (const k of [-1,1]) cyl(g,0xd9824a,k*.62,.7,.1,.08,.6,0,0,k*.5); return g; },
    "칠린 칠리":()=>{ const g=new THREE.Group(); ball(g,0xe8241a,0,.75,0,.42,.7,.42); cone(g,0xe8241a,0,.08,.08,.22,.35,Math.PI-.3,0,0); cyl(g,0x3a9a3a,0,1.48,0,.08,.25,0,0,.3); ball(g,0x3a9a3a,0,1.38,0,.25,.08,.25);
      box(g,0x161620,0,.95,.4,.6,.13,.06); for (const k of [-1,1]) box(g,0x161620,k*.16,.93,.42,.22,.16,.04); ball(g,0xffffff,-.2,.98,.45,.04,.03,.02); ball(g,0x2a0a0a,0,.7,.4,.13,.05,.03);
      for (const k of [-1,1]){ cyl(g,0x3a9a3a,k*.18,.15,0,.06,.35); cyl(g,0x3a9a3a,k*.5,.8,0,.05,.45,0,0,k*1); } return g; },
    "트랄랄레돈":()=>{ const g=rept({ c:0x6a8ab0, c2:0xe8f0ff, biped:true, s:.95, snout:1.4, teeth:true });
      part(g,SEG.cone,0x5a7aa0,0,1.6,-.2,.25,.45,.06,0,0,0); return g; },
    "엘 마하":()=>{ const g=new THREE.Group(); ball(g,0x2a3a7a,0,.7,0,1.1,.25,.8); ball(g,0xe8f0ff,0,.6,0,.9,.15,.65); for (const k of [-1,1]) cone(g,0x2a3a7a,k*1.1,.7,-.1,.4,.9,0,0,k*Math.PI/2);
      cone(g,0x2a3a7a,0,.7,-1.2,.06,1.1,-Math.PI/2,0,0); eyes(g,0,.85,.7,.1,.35,{ side:.3 }); part(g,SEG.cyl,0xffd23a,0,1.05,.1,.3,.2,.3); for (let i=0;i<5;i++) cone(g,0xffd23a,Math.cos(i*1.26)*.25,1.25,.1+Math.sin(i*1.26)*.25,.06,.2); ball(g,0xff3b6a,0,1.3,.35,.07); return g; },
  };
  const crownOf=(col)=>(H,hs)=>{ cyl(H,col||0xffd23a,0,.35*hs,0,.22*hs,.14*hs); for (let i=0;i<5;i++) cone(H,col||0xffd23a,Math.cos(i*1.26)*.19*hs,.48*hs,Math.sin(i*1.26)*.19*hs,.05*hs,.14*hs); ball(H,0xff3b6a,0,.4*hs,.22*hs,.05*hs); };
  // 이름 → 모양
  const SPEC={
    // 숲
    "닭":()=>bird({ c:0xffffff, c2:0xfff6e0, comb:true, tailC:0xf0f0f0 }), "강아지":()=>quad({ c:0xd9a066, c2:0xfff0d8, ear:"floppy", earC:0x8a5a33, tail:"short", snout:1.2 }),
    "새":()=>bird({ c:0x3aa0ff, c2:0xdff0ff, wing:0x2a7ad8, s:.85 }), "부엉이":()=>bird({ c:0x8a5a33, c2:0xf0d8b0, tuft:true, bigEye:true, beak:0xffd23a, beakL:.5, hs:1.2, tail:false }),
    "너구리":()=>quad({ c:0x8a8a94, c2:0xe8e8ec, ear:"pointy", earC:0x5a5a64, mask:0x2a2a30, tail:"ring", snout:1 }), "여우":()=>quad({ c:0xff8a2b, c2:0xfff4e8, ear:"pointy", earC:0xff8a2b, tail:"bushy", tailTip:0xffffff, snout:1.3, paw:0x3a2a20 }),
    "곰":()=>quad({ c:0x8a5a33, c2:0xd9b080, ear:"round", earC:0x8a5a33, tail:"short", hs:1.15, bw:1.15, leg:.38 }),
    // 호수
    "개구리":()=>{ const g=quad({ c:0x5ad04a, c2:0xd8f0a0, ear:"none", tail:"none", snout:0, leg:.18, bh:.8, hs:1.05 }); return g; }, "아기 오리":()=>bird({ c:0xffe14d, c2:0xfff4a0, beak:0xff8a2b, beakW:1.6, beakL:.8, s:.85 }),
    "메기":()=>fish({ c:0x6a7a5a, c2:0xc9d0b0, whisker:true, len:1.2 }), "거북이":()=>quad({ c:0x7ad06a, c2:0xd8f0a0, ear:"none", tail:"short", snout:.6, shell:0x5a8a3a, shell2:0x3a6a2a, leg:.25 }),
    "백조":()=>bird({ c:0xffffff, c2:0xf4f4f4, neck:.6, beak:0xff7a1a, s:1 }), "아홀로틀":()=>rept({ c:0xffb0c8, c2:0xffd8e4, gills:0xff5a8a, snout:.7, leg:.2 }),
    "리바이어던":()=>{ const g=snake({ c:0x2a6ab0, c2:0x8ad8ff, band:0x1a4a8a, s:1.25 }); return g; },
    // 사막
    "날쥐":()=>quad({ c:0xe0b878, c2:0xfff0d8, ear:"long", tail:"thin", snout:.8, leg:.5, hs:1.2, bw:.8 }), "사막여우":()=>quad({ c:0xf4d0a0, c2:0xffffff, ear:"big", tail:"bushy", tailTip:0xffffff, snout:1.2 }),
    "낙타":()=>quad({ c:0xd9a85a, c2:0xf0d0a0, ear:"tiny", tail:"thin", snout:1.4, leg:.7, neck:.35, hump:2 }), "뱀":()=>snake({ c:0xc9a83a, c2:0xf0e0a0, band:0x8a6a1a }),
    "모래 거미":()=>bug({ c:0xc99a5a, leg:0xa07a40, mark:0xff8a2b }), "전갈":()=>bug({ c:0x5a2a10, leg:0x4a2008, claws:true, stinger:true }),
    "로얄 스핑크스":()=>quad({ c:0xffd23a, c2:0xfff0b0, ear:"pointy", tail:"thin", snout:.6, headgear:(H,hs)=>{ ball(H,0x2a5aff,0,.15*hs,-.1*hs,.55*hs,.5*hs,.42*hs); for (let i=0;i<4;i++) box(H,0xffd23a,0,(.0+i*.12)*hs,-.12*hs,1.1*hs,.04*hs,.84*hs); ball(H,0xffd23a,0,.06,.04,.5*hs,.46*hs,.46*hs); eyes(H,0,.06*hs,.36*hs,.11*hs,.19*hs,{ side:.5 }); cone(H,0xff3b3b,0,.48*hs,.25*hs,.06*hs,.18*hs); } }),
    // 정글
    "침팬지":()=>quad({ c:0x5a3a2a, c2:0xe0b890, ear:"round", earC:0xe0b890, tail:"none", snout:.7, leg:.5, hs:1.15 }), "투칸":()=>bird({ c:0x1a1a22, c2:0xffffff, beak:0xffa52e, beakL:2.2, beakW:1.4 }),
    "악어":()=>rept({ c:0x4a8a3a, c2:0xb0d080, snout:2, teeth:true, spikes:0x3a6a2a, bl:1.2, leg:.18 }), "고릴라":()=>quad({ c:0x2b2b33, c2:0x6a6a7a, ear:"round", earC:0x2b2b33, tail:"none", snout:.6, leg:.55, hs:1, bw:1.3 }),
    "거미":()=>bug({ c:0x2a2a30, leg:0x1a1a20, mark:0xff2a2a }), "호랑이":()=>quad({ c:0xff8a2b, c2:0xffffff, ear:"round", earC:0xff8a2b, tail:"long", stripes:0x1a1a1a, snout:.9, bw:1.1 }),
    "킹 스네이크":()=>snake({ c:0xff3b3b, c2:0xffe14d, band:0x161616, s:1.1, crown:crownOf() }),
    // 설원
    "펭귄":()=>bird({ c:0x22222a, c2:0xffffff, beak:0xffa52e, tail:false, s:1 }), "바다코끼리":()=>quad({ c:0xa07a5a, c2:0xc9a080, ear:"none", tail:"none", tusk:true, snout:.8, leg:.15, bw:1.3 }),
    "북극곰":()=>quad({ c:0xf6f6f0, c2:0xffffff, ear:"round", tail:"short", hs:1.1, bw:1.2, nose:0x161616 }), "검치호":()=>quad({ c:0xd9a85a, c2:0xfff0d8, ear:"round", tail:"short", fang:true, spots:0x8a5a2a, bw:1.1 }),
    "매머드":()=>quad({ c:0x8a5a33, c2:0xa87a4a, ear:"floppy", earC:0x6a4020, tail:"thin", trunk:true, tusk:true, snout:0, leg:.55, bw:1.35, hs:1.15 }),
    "킹 매머드":()=>quad({ c:0x6a4020, c2:0x8a5a33, ear:"floppy", earC:0x4a2a10, tail:"thin", trunk:true, tusk:true, snout:0, leg:.6, bw:1.45, hs:1.2, headgear:crownOf() }),
    "예티":()=>quad({ c:0xe8f4ff, c2:0x8ab8e8, ear:"tiny", tail:"none", snout:.5, leg:.6, hs:1.1, bw:1.3, fang:true }),
    "얼음 용":()=>rept({ c:0x8ad8ff, c2:0xe8f8ff, wings:0xb0e8ff, horns:0xffffff, spikes:0xffffff, snout:1.3 }),
    // 화산
    "용암 도마뱀":()=>rept({ c:0xff6a1a, c2:0xffd23a, spikes:0x8a2a0a, snout:1.1, leg:.2 }), "용암 개구리":()=>quad({ c:0x3a1a1a, c2:0xff6a1a, ear:"none", tail:"none", snout:0, leg:.18, bh:.8, spots:0xff5a1a }),
    "불꽃 황소":()=>quad({ c:0x5a1a10, c2:0xff8a2b, ear:"tiny", tail:"thin", horn:"bull", snout:1.1, bw:1.2, extra:(g,k)=>{ for (let i=0;i<4;i++) cone(g,i%2?0xffd23a:0xff3b1a,(i-1.5)*.15,k.by+.55,-.1,.12,.45); } }),
    "용암 이구아나":()=>rept({ c:0xc9341a, c2:0xff9b2b, spikes:0xffd23a, snout:1, flame:true, leg:.22 }), "칠린 칠리":SPECIAL["칠린 칠리"],
    "케르베로스":()=>{ const g=quad({ c:0x2a1a1a, c2:0x5a2a2a, ear:"pointy", earC:0x2a1a1a, tail:"thin", snout:1.2, fang:true, bw:1.2 });
      for (const k of [-1,1]){ const H=new THREE.Group(); H.position.set(k*.55,1.25,.45); g.add(H); ball(H,0x2a1a1a,0,0,0,.4,.36,.36); ball(H,0x5a2a2a,0,-.1,.28,.2,.14,.16); eyes(H,0,.05,.3,.09,.15,{ pupil:0xff2a1a }); for (const s of [-1,1]) cone(H,0x2a1a1a,s*.2,.34,0,.11,.26); } return g; },
    "용암 드래곤":()=>rept({ c:0x8a1a0a, c2:0xff9b2b, wings:0xff5a1a, horns:0xffd23a, spikes:0xffd23a, snout:1.3, flame:true }),
    // 심해
    "파랑비늘돔":()=>fish({ c:0x3ad0b0, c2:0xffb0d0, fin:0xff6aa8, fat:1.1 }), "복어":()=>fish({ c:0xe8d07a, c2:0xfff4d0, spikes:true, fat:1.4, len:.8 }),
    "만타가오리":()=>{ const g=new THREE.Group(); ball(g,0x2a3a5a,0,.6,0,1,.18,.7); ball(g,0xe8f0ff,0,.53,0,.8,.1,.55); for (const k of [-1,1]) cone(g,0x2a3a5a,k*.95,.6,0,.3,.8,0,0,k*Math.PI/2); cone(g,0x2a3a5a,0,.6,-1,.05,1,-Math.PI/2,0,0); eyes(g,0,.72,.6,.08,.3,{ side:.3 }); return g; },
    "귀상어":()=>fish({ c:0x7a8aa0, c2:0xe8eef4, hammer:true, len:1.3 }), "고래상어":()=>fish({ c:0x2a4a7a, c2:0xe8f0ff, spots:0xffffff, len:1.5, s:1.1 }),
    "크라켄":()=>{ const g=new THREE.Group(); ball(g,0x8a2a6a,0,1.1,-.1,.65,.8,.6,-.3,0,0); eyes(g,0,1,.48,.13,.22); for (let i=0;i<8;i++){ const a=i/8*Math.PI*2; for (let j=0;j<3;j++) ball(g,j%2?0xb04a8a:0x8a2a6a,Math.cos(a)*(.35+j*.25),.45-j*.13,Math.sin(a)*(.35+j*.25),.15-j*.03,.15-j*.03,.15-j*.03); } return g; },
    "엘 마하":SPECIAL["엘 마하"],
    // 선사시대
    "도도새":()=>bird({ c:0x8a8a9a, c2:0xd0d0d8, beak:0xd0a060, beakL:1.5, beakW:1.3, hs:1.15, s:1.05 }), "랩터":()=>rept({ c:0x8a7a5a, c2:0xe0d0a0, biped:true, s:.85, snout:1.3, teeth:true, extra:(g)=>{ for (let i=0;i<3;i++) cone(g,0x3a2a1a,0,1.45-i*.1,.05-i*.18,.05,.2); } }),
    "안킬로사우루스":()=>rept({ c:0x8a7a4a, c2:0xd0c090, shellArmor:0x6a5a3a, spikes:0xe8dcc0, club:0x6a5a3a, leg:.25, bw:1.2 }),
    "브론토":()=>rept({ c:0x6ab08a, c2:0xc0e0c0, neck:.9, leg:.45, bw:1.15, s:1.05 }), "트리케라톱스":()=>rept({ c:0x8a6a4a, c2:0xf0e0c0, frill:0xc98a5a, leg:.3, bw:1.15 }),
    "티라노":()=>rept({ c:0x3a6a2a, c2:0xb0d080, biped:true, s:1.05, snout:1.3, teeth:true, hs:1.2 }), "트랄랄레돈":SPECIAL["트랄랄레돈"],
    "모사사우루스":()=>{ const g=fish({ c:0x3a5a7a, c2:0xd0e0f0, len:1.6, fin:0x2a4a6a }); const H=new THREE.Group(); H.position.set(0,.8,1.1); g.add(H); for (let i=0;i<6;i++) for (const k of [-1,1]) cone(H,0xffffff,k*.18,-.15,i*.08,.03,.1,Math.PI,0,0); return g; },
    // 우주
    "외계인":()=>{ const g=quad({ c:0x6aff8a, c2:0xb0ffc0, ear:"none", tail:"none", snout:0, leg:.45, hs:1.3, bw:.8 }); for (const k of [-1,1]){ cyl(g,0x6aff8a,k*.2,1.85,.5,.02,.4); ball(g,0xffe14d,k*.2,2.07,.5,.07); } return g; },
    "달토끼":()=>quad({ c:0xf4f4ff, c2:0xffffff, ear:"long", earIn:0xffd0e0, tail:"short", snout:.6, leg:.35, hs:1.2 }),
    "별여우":()=>quad({ c:0x6a5aff, c2:0xffe14d, ear:"pointy", earIn:0xffe14d, tail:"bushy", tailTip:0xffe14d, snout:1.2, spots:0xffe14d }),
    "성운 해파리":()=>{ const g=new THREE.Group(); ball(g,0xb46bff,0,1.2,0,.6,.5,.6); ball(g,0xff8ad6,0,1.15,0,.45,.35,.45); eyes(g,0,1.1,.5,.08,.15); for (let i=0;i<8;i++){ const a=i/8*Math.PI*2; cyl(g,0xd0a0ff,Math.cos(a)*.35,.55,Math.sin(a)*.35,.04,.9); } return g; },
    "혜성 드래곤":()=>rept({ c:0x2a2a8a, c2:0x8ad8ff, wings:0x6a5aff, horns:0x8ad8ff, spikes:0xffe14d, snout:1.2, extra:(g,k)=>{ for (let i=0;i<5;i++) ball(g,0xffe14d,0,k.by+.2,-1.6-i*.3,.15-i*.025); } }),
    "유니콘":()=>quad({ c:0xffffff, c2:0xfff4fa, ear:"pointy", tail:"bushy", tailTip:0xff8ad6, horn:"unicorn", mane:0xff8ad6, leg:.6, neck:.25, snout:1.1, extra:(g,k)=>{ for (let i=0;i<5;i++) ball(g,[0xff3b3b,0xffa52e,0xffe14d,0x3ddc5a,0x3aa0ff][i],0,k.hy+.15-i*.12,k.hz-.35-i*.06,.09); } }),
    // 벚꽃
    "두루미":()=>bird({ c:0xffffff, c2:0xf4f4f4, neck:.55, beak:0x2a2a2a, beakL:1.6, crest:0xff2a2a, s:1 }), "도롱뇽":()=>rept({ c:0x2a2a30, c2:0xffd23a, snout:.8, leg:.18, extra:(g,k)=>{ for (let i=0;i<6;i++) ball(g,0xffd23a,Math.cos(i*2)*.3,k.by+.32,(i/6-.5)*1.2,.08); } }),
    "레서판다":()=>quad({ c:0xd9542a, c2:0xfff0e0, ear:"round", earC:0xd9542a, earIn:0xffffff, tail:"ring", snout:.7, mask:0xfff0e0 }),
    "흰올빼미":()=>bird({ c:0xffffff, c2:0xf4f4f4, bigEye:true, beak:0x2a2a2a, beakL:.5, hs:1.2, tail:false, extra:null }),
    "비단잉어":()=>fish({ c:0xffffff, c2:0xffffff, fin:0xff5a3a, spots:0xff5a3a, len:1.2 }), "수사슴":()=>quad({ c:0xa86a3a, c2:0xf0d8b0, ear:"pointy", tail:"short", horn:"antler", leg:.6, snout:1.2, spots:0xfff0d8 }),
    "오니 호랑이":()=>quad({ c:0xff5a8a, c2:0xffffff, ear:"round", earC:0xff5a8a, tail:"long", stripes:0x1a1a1a, horn:"oni", fang:true, snout:.9, bw:1.15 }),
    "구미호":()=>quad({ c:0xfff4e8, c2:0xffffff, ear:"pointy", earIn:0xff8a8a, tail:"nine", tailTip:0xff8a2b, snout:1.2 }),
    // 수호 동물만
    "흰고래":()=>fish({ c:0xf0f8ff, c2:0xffffff, fin:0xd8e8f8, len:1.4, fat:1.2 }),
  };
  SPEC["브르 브르 파타핌"]=SPECIAL["브르 브르 파타핌"]; SPEC["트룰리메로 트룰리치나"]=SPECIAL["트룰리메로 트룰리치나"]; SPEC["톱 토비 톱 톱"]=SPECIAL["톱 토비 톱 톱"]; SPEC["오랑구티니 아나나시니"]=SPECIAL["오랑구티니 아나나시니"];

  // ---------- 합치기 (부품 수십 개 → 메쉬 하나 + 외곽선 하나) ----------
  function merge(root){ root.updateMatrixWorld(true); const inv=new THREE.Matrix4().copy(root.matrixWorld).invert();
    const pos=[], nor=[], col=[], idx=[]; let off=0; const v=new THREE.Vector3(), m=new THREE.Matrix4(), nm=new THREE.Matrix3();
    root.traverse(o=>{ if (!o.isMesh) return; const gg=o.geometry; m.multiplyMatrices(inv,o.matrixWorld); nm.getNormalMatrix(m); const p=gg.attributes.position, n=gg.attributes.normal, c=o.material.color;
      for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i).applyMatrix4(m); pos.push(v.x,v.y,v.z); v.fromBufferAttribute(n,i).applyMatrix3(nm).normalize(); nor.push(v.x,v.y,v.z); col.push(c.r,c.g,c.b); }
      if (gg.index) for (let i=0;i<gg.index.count;i++) idx.push(gg.index.getX(i)+off); else for (let i=0;i<p.count;i++) idx.push(i+off); off+=p.count; });
    const out=new THREE.BufferGeometry(); out.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); out.setAttribute("normal",new THREE.Float32BufferAttribute(nor,3)); out.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); out.setIndex(idx); out.computeBoundingSphere(); return out; }
  // ---------- 재질 ----------
  const grad=(()=>{ const d=new Uint8Array([90,90,90,255, 170,170,170,255, 255,255,255,255]); const t=new THREE.DataTexture(d,3,1,THREE.RGBAFormat); t.minFilter=t.magFilter=THREE.NearestFilter; t.needsUpdate=true; return t; })();
  const OUTLINE=new THREE.ShaderMaterial({ uniforms:{ th:{ value:.03 } }, side:THREE.BackSide,
    vertexShader:"uniform float th; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vec3 n=normalize(normalMatrix*normal); mv.xyz+=n*th*(-mv.z*.06+.6); gl_Position=projectionMatrix*mv; }",
    fragmentShader:"void main(){ gl_FragColor=vec4(.06,.06,.09,1.0); }" });
  const MUT=[ { n:"", m:1 }, { n:"실버", m:1.2, c:0xdfe8f2 }, { n:"골드", m:2, c:0xffc83a }, { n:"레인보우", m:3.5, c:"rainbow" } ];
  const PET_MATS=[ new THREE.MeshToonMaterial({ vertexColors:true, gradientMap:grad }),
    new THREE.MeshToonMaterial({ vertexColors:true, gradientMap:grad, color:0xc8d4e4, emissive:0x46505e }),
    new THREE.MeshToonMaterial({ vertexColors:true, gradientMap:grad, color:0xffcc33, emissive:0x5a3a00 }),
    new THREE.MeshToonMaterial({ vertexColors:true, gradientMap:grad, color:0xffffff, emissive:0x222222 }) ];
  const GEO_CACHE={};
  function petMesh(name, mut){ let geo=GEO_CACHE[name]; if (!geo){ const f=SPEC[name]||SPEC["닭"]; geo=GEO_CACHE[name]=merge(f()); }
    const g=new THREE.Group(); const body=new THREE.Mesh(geo,PET_MATS[mut||0]); body.castShadow=true; g.add(body); const ol=new THREE.Mesh(geo,OUTLINE); g.add(ol);
    g.userData.body=body; if (mut>=2) g.add(sparkles(mut)); return g; }
  // 반짝이 (골드 · 레인보우)
  const sparkTex=(()=>{ const c=document.createElement("canvas"); c.width=c.height=32; const x=c.getContext("2d"); const gr=x.createRadialGradient(16,16,0,16,16,16); gr.addColorStop(0,"#fff"); gr.addColorStop(.3,"rgba(255,255,255,.8)"); gr.addColorStop(1,"rgba(255,255,255,0)"); x.fillStyle=gr; x.fillRect(0,0,32,32); return new THREE.CanvasTexture(c); })();
  const SPK_MAT={ 2:new THREE.PointsMaterial({ map:sparkTex, color:0xffe14d, size:.35, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }), 3:new THREE.PointsMaterial({ map:sparkTex, color:0xffffff, size:.4, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, vertexColors:true }) };
  function sparkles(mut){ const n=14, p=new Float32Array(n*3), c=new Float32Array(n*3); for (let i=0;i<n;i++){ p[i*3]=(Math.random()-.5)*1.8; p[i*3+1]=Math.random()*2; p[i*3+2]=(Math.random()-.5)*1.8; const col=new THREE.Color().setHSL(i/n,1,.6); c[i*3]=col.r; c[i*3+1]=col.g; c[i*3+2]=col.b; }
    const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(p,3)); g.setAttribute("color",new THREE.BufferAttribute(c,3)); const pts=new THREE.Points(g,SPK_MAT[mut]); pts.userData.spark=true; return pts; }
  // ---------- 알 ----------
  // 진짜 알 모양 (아래가 넓고 위가 뾰족) + 구역 무늬
  const eggPts=[]; for (let i=0;i<=32;i++){ const a=i/32*Math.PI, t=(1-Math.cos(a))/2, y=t*2.1; const r=.8*Math.sin(a)*(1-.2*t); eggPts.push(new THREE.Vector2(Math.max(.001,r),y)); }
  const EGG_GEO=new THREE.LatheGeometry(eggPts,28);
  const EGG_TEX={};
  function eggTex(b, rc){ const k=b+"_"+rc; if (EGG_TEX[k]) return EGG_TEX[k]; const c=document.createElement("canvas"); c.width=256; c.height=256; const x=c.getContext("2d");
    const base=["#7ad06a","#6ad0f0","#f0d27a","#3aa05a","#eaf4ff","#4a2a22","#2a5aa0","#c9a070","#2a1e6a","#ffc8dc"][b]||"#ffffff";
    const gr=x.createLinearGradient(0,256,0,0); gr.addColorStop(0,base); gr.addColorStop(1,"#ffffff"); x.fillStyle=base; x.fillRect(0,0,256,256); x.globalAlpha=.35; x.fillStyle=gr; x.fillRect(0,0,256,256); x.globalAlpha=1;
    x.fillStyle=rc; x.strokeStyle=rc; x.lineWidth=10; x.lineJoin="round";
    const R=(a,b)=>a+Math.random()*(b-a);
    if (b===0) for (let i=0;i<18;i++){ x.beginPath(); x.arc(R(0,256),R(30,230),R(10,22),0,7); x.fill(); }
    else if (b===1) for (let i=0;i<4;i++){ x.beginPath(); for (let j=0;j<=16;j++) x.lineTo(j*16,60+i*45+Math.sin(j*1.2)*10); x.stroke(); }
    else if (b===2) for (let i=0;i<3;i++){ x.beginPath(); for (let j=0;j<=16;j++) x.lineTo(j*16,70+i*55+(j%2?-16:16)); x.stroke(); }
    else if (b===3) for (let i=0;i<10;i++){ x.save(); x.translate(R(0,256),R(40,220)); x.rotate(R(0,6)); x.beginPath(); x.ellipse(0,0,24,10,0,0,7); x.fill(); x.restore(); }
    else if (b===4) for (let i=0;i<12;i++){ const cx=R(0,256), cy=R(30,230); for (let a=0;a<6;a++){ x.beginPath(); x.moveTo(cx,cy); x.lineTo(cx+Math.cos(a)*16,cy+Math.sin(a)*16); x.lineWidth=4; x.stroke(); } }
    else if (b===5){ x.lineWidth=6; for (let i=0;i<7;i++){ x.beginPath(); let px=R(0,256), py=R(20,240); x.moveTo(px,py); for (let j=0;j<5;j++){ px+=R(-30,30); py+=R(-30,30); x.lineTo(px,py); } x.shadowColor=rc; x.shadowBlur=12; x.stroke(); } x.shadowBlur=0; }
    else if (b===6) for (let r=0;r<8;r++) for (let i=0;i<9;i++){ x.beginPath(); x.arc(i*32+(r%2)*16,r*32+20,14,0,Math.PI); x.lineWidth=4; x.stroke(); }
    else if (b===7) for (let i=0;i<60;i++){ x.beginPath(); x.arc(R(0,256),R(10,246),R(2,6),0,7); x.fill(); }
    else if (b===8){ for (let i=0;i<14;i++){ const cx=R(0,256), cy=R(20,236), r=R(6,13); x.beginPath(); for (let a=0;a<10;a++){ const rr=a%2?r*.45:r; x.lineTo(cx+Math.cos(a*Math.PI/5-Math.PI/2)*rr,cy+Math.sin(a*Math.PI/5-Math.PI/2)*rr); } x.fill(); } }
    else for (let i=0;i<12;i++){ const cx=R(0,256), cy=R(20,236); for (let a=0;a<5;a++){ x.beginPath(); x.ellipse(cx+Math.cos(a*1.257)*8,cy+Math.sin(a*1.257)*8,8,5,a*1.257,0,7); x.fill(); } }
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=THREE.RepeatWrapping; return EGG_TEX[k]=t; }
  const EGG_MAT={};
  function eggMat(b, rc, mut){ const k=b+rc+mut; if (EGG_MAT[k]) return EGG_MAT[k]; const o={ map:eggTex(b,rc), gradientMap:grad };
    if (mut===1){ o.color=0xd8e2ee; o.emissive=0x3a424e; } if (mut===2){ o.color=0xffd040; o.emissive=0x5a3a00; } if (mut===3){ o.color=0xffffff; o.emissive=0x222222; }
    return EGG_MAT[k]=new THREE.MeshToonMaterial(o); }
  function eggMesh(b, rc, mut, rarityTier){ const g=new THREE.Group(); const m=new THREE.Mesh(EGG_GEO,eggMat(b,rc,mut||0)); m.castShadow=true; g.add(m); const ol=new THREE.Mesh(EGG_GEO,OUTLINE); g.add(ol);
    // 반짝 하이라이트
    const hl=new THREE.Mesh(SEG.sph,new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:.55 })); hl.position.set(-.32,1.45,.42); hl.scale.set(.1,.2,.06); hl.rotation.z=.4; g.add(hl);
    g.userData.body=m; if (mut>=2) g.add(sparkles(mut)); return g; }
  // 레인보우는 색이 계속 바뀐다
  function tick(t){ const c=new THREE.Color().setHSL((t/2500)%1,.9,.62); PET_MATS[3].color.copy(c); for (const k in EGG_MAT) if (k.endsWith("3")) EGG_MAT[k].color.copy(c); }
  return { petMesh, eggMesh, MUT, tick, OUTLINE, SPEC, merge };
}
