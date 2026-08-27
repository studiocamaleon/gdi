  const nav=document.getElementById('nav');
  const onScroll=()=>nav.classList.toggle('scrolled',window.scrollY>8);
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();

  const io=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12,rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

  const countEls=document.querySelectorAll('[data-count]');
  const cio=new IntersectionObserver((es)=>{es.forEach(e=>{if(!e.isIntersecting)return;const el=e.target;cio.unobserve(el);const target=parseFloat(el.dataset.count),suffix=el.dataset.suffix||'',dur=1300,start=performance.now();const tick=(now)=>{const p=Math.min((now-start)/dur,1),eased=1-Math.pow(1-p,3),val=target<=5?(target*eased).toFixed(0):Math.round(target*eased);el.textContent=val+suffix;if(p<1)requestAnimationFrame(tick);else el.textContent=target+suffix};requestAnimationFrame(tick)})},{threshold:.5});
  countEls.forEach(el=>cio.observe(el));

  /* ── constelación 3D (misma malla del sistema) ── */
  (function(){
    var ACC="255,106,43";
    document.querySelectorAll("canvas[data-net]").forEach(function(cv){
      var mode=cv.dataset.net,dark=mode==="cta",ink=dark?"242,241,238":"20,20,26";
      var ctx=cv.getContext("2d"),W=0,H=0,dpr=Math.min(devicePixelRatio||1,2);
      var N=mode==="cta"?54:64,nodes=[],edges=[],pulses=[];
      for(var i=0;i<N;i++){var y=1-(i/(N-1))*2,r=Math.sqrt(Math.max(0,1-y*y)),th=i*2.39996;nodes.push({x:Math.cos(th)*r,y:y,z:Math.sin(th)*r,s:.6+Math.random()*.7})}
      nodes.forEach(function(a,i){nodes.map(function(b,j){return {j:j,d:(a.x-b.x)*(a.x-b.x)+(a.y-b.y)*(a.y-b.y)+(a.z-b.z)*(a.z-b.z)}}).filter(function(o){return o.j!==i}).sort(function(p,q){return p.d-q.d}).slice(0,3).forEach(function(o){if(i<o.j)edges.push([i,o.j])})});
      for(var k=0;k<5;k++)pulses.push({e:(Math.random()*edges.length)|0,t:Math.random(),v:.005+Math.random()*.007});
      function size(){var b=cv.getBoundingClientRect();if(!b.width)return;W=b.width;H=b.height;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
      var ry=0;
      function frame(){
        if(!W){size();if(!W){requestAnimationFrame(frame);return}}
        ry+=.0022;ctx.clearRect(0,0,W,H);
        var cx=W/2,cy=H/2,rad=Math.min(W*.5,H)*.9;
        var cos=Math.cos(ry),sin=Math.sin(ry),p=nodes.map(function(n){var x=n.x*cos-n.z*sin,z=n.x*sin+n.z*cos,pr=1/(2.6-z*.85);return {X:cx+x*rad*pr*1.7,Y:cy+n.y*rad*pr*1.7,z:z,s:n.s,pr:pr}});
        edges.forEach(function(e){var a=p[e[0]],b=p[e[1]],dp=(a.z+b.z)/2;ctx.strokeStyle="rgba("+ink+","+((dark?.06:.05)+Math.max(0,dp+1)*(dark?.09:.075)).toFixed(3)+")";ctx.lineWidth=dp>0?1:.7;ctx.beginPath();ctx.moveTo(a.X,a.Y);ctx.lineTo(b.X,b.Y);ctx.stroke()});
        p.forEach(function(n){ctx.fillStyle="rgba("+ink+","+((dark?.24:.16)+Math.max(0,n.z+1)*.2).toFixed(3)+")";ctx.beginPath();ctx.arc(n.X,n.Y,1.9*n.s*n.pr*1.5,0,6.2832);ctx.fill()});
        pulses.forEach(function(u){u.t+=u.v;if(u.t>1){u.t=0;u.e=(Math.random()*edges.length)|0}var e=edges[u.e];if(!e)return;var a=p[e[0]],b=p[e[1]],X=a.X+(b.X-a.X)*u.t,Y=a.Y+(b.Y-a.Y)*u.t;var g=ctx.createRadialGradient(X,Y,0,X,Y,11);g.addColorStop(0,"rgba("+ACC+",.5)");g.addColorStop(1,"rgba("+ACC+",0)");ctx.fillStyle=g;ctx.beginPath();ctx.arc(X,Y,11,0,6.2832);ctx.fill();ctx.fillStyle="rgba("+ACC+",.9)";ctx.beginPath();ctx.arc(X,Y,1.7,0,6.2832);ctx.fill()});
        requestAnimationFrame(frame);
      }
      addEventListener("resize",size);size();frame();
    });
  })();

