import {
  DepthTexture,
  HalfFloatType,
  Matrix4,
  UnsignedIntType,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const vertexShader = `
  precision highp float;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

const fragmentShader = `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;
  uniform float uTime;
  uniform float uMemoryBlend;
  uniform float uSunlight;
  uniform float uAltitude;
  uniform float uSolarAngle;
  uniform mat4 uInvVP;
  uniform float uDawn;
  uniform float uCine;
  uniform float uNeg;
  uniform float uInk;
  uniform float uWarp;
  uniform float uLift;
  uniform float uClock;
  uniform float uDust;
  uniform float uDetective;
  uniform float uFlicker;
  uniform vec3 uCam;
  uniform vec2 uResolution;
  varying vec2 vUv;
  // Split-toned noir grade: cool slate shadows, muted brass mids, warm paper highlights.
  const vec3 ink = vec3(17., 22., 27.) / 255.;
  const vec3 ochre = vec3(170., 138., 98.) / 255.;
  const vec3 paper = vec3(243., 229., 200.) / 255.;
  const vec3 slate = vec3(58., 78., 88.) / 255.;
  const vec3 weights = vec3(.2126, .7152, .0722);

  float sampleValue(vec2 uv) {
    return dot(texture2D(tDiffuse, uv).rgb, weights);
  }
  // Value noise and fbm drive the negative-energy tendrils and the warp.
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0., a = .5; for (int k = 0; k < 5; k++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
  vec2 warpUv(vec2 uv) {
    if (uWarp <= .001) return uv;
    vec2 c = uv - .5; float r = length(c);
    float ripple = sin(r * 38. - uTime * 9.) * .006 * uWarp * smoothstep(0., .35, r);
    float swirl = (fbm(uv * 3. + uTime * .4) - .5) * .035 * uWarp;
    return uv + normalize(c + 1e-5) * ripple + vec2(swirl, -swirl);
  }
  vec3 pigment(float value) {
    vec3 low = mix(ink, slate, clamp(value / .32, 0., 1.));
    vec3 mid = mix(low, ochre, smoothstep(.22, .66, value));
    return mix(mid, paper, smoothstep(.62, 1., value));
  }
  // ── Light in the air ──
  // Sunlight through the west window: it enters at x = -4.47 and falls east and down to the floor.
  float beamAt(vec3 p) {
    float wallY = p.y + (p.x + 4.47) * 1.25;
    vec2 f = vec2(p.x + p.y * .8, p.z);
    float inWindow = smoothstep(.95, 1.2, wallY) * (1. - smoothstep(2.3, 2.6, wallY)) * smoothstep(2.2, 2.5, p.z) * (1. - smoothstep(4.1, 4.4, p.z)) * step(-4.47, p.x);
    float blinds = .5 + .5 * cos((f.y + .50 * f.x + 1.35 * cos(uSolarAngle)) * 10.);
    return inWindow * smoothstep(.05, .55, blinds) * exp(-.12 * (p.x + 4.47));
  }
  // The detective's overhead spotlight, aimed at the evidence board on the north wall.
  const vec3 SPOT = vec3(1.02, 3.25, -1.35);
  const vec3 BOARD = vec3(1.02, 2.3, -2.78);
  float spotAt(vec3 p) {
    vec3 axis = normalize(BOARD - SPOT), d = p - SPOT; float along = dot(d, axis);
    if (along <= 0.) return 0.;
    float r = length(d - axis * along) / along;
    return (1. - smoothstep(.75, 1.25, r)) / (1. + along * along * .2);
  }
  // Glow round the desk lamp, the corridor door and the two annex lamps.
  float lampAt(vec3 p) {
    vec3 a = p - vec3(-.94, 2.02, .06), b = p - vec3(4.31, 1.77, .05), c = p - vec3(0., 1.4, 8.4), d = p - vec3(1.2, 1.2, 13.6);
    return exp(-5. * dot(a, a)) + .6 * exp(-5. * dot(b, b)) + exp(-4. * dot(c, c)) + exp(-4. * dot(d, d));
  }
  void main() {
    vec2 uv = warpUv(vUv);
    vec2 px = 1. / uResolution;
    vec2 dx = vec2(px.x, 0.);
    vec2 dy = vec2(0., px.y);
    float a = sampleValue(uv-dx-dy), b = sampleValue(uv-dy), c = sampleValue(uv+dx-dy);
    float d = sampleValue(uv-dx), f = sampleValue(uv+dx);
    float g = sampleValue(uv-dx+dy), h = sampleValue(uv+dy), i = sampleValue(uv+dx+dy);
    float sobel = length(vec2(c+2.*f+i-a-2.*d-g, g+2.*h+i-a-2.*b-c));
    float leftZ = texture2D(tDepth, uv-dx).r, rightZ = texture2D(tDepth, uv+dx).r;
    float topZ = texture2D(tDepth, uv-dy).r, bottomZ = texture2D(tDepth, uv+dy).r;
    float depthJump = max(abs(leftZ-rightZ)/max(.0005, 1.-min(leftZ,rightZ)), abs(topZ-bottomZ)/max(.0005, 1.-min(topZ,bottomZ)));
    float edge = max(.26*smoothstep(.18, 1.3, sobel), .52*smoothstep(.05, .5, depthJump));
    vec3 source = texture2D(tDiffuse, uv).rgb;
    float luma = max(0., dot(source, weights));
    float displayY = luma <= .0031308 ? luma*12.92 : 1.055*pow(luma, 1./2.4)-.055;
    float tone = clamp((displayY-.055)/.725, 0., 1.);
    float grain = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(.06711056,.00583715)) + floor(uTime*8.)*.015625))-.5;
    float bands = mix(tone, floor(tone*16.+.5)/16., .10);
    vec2 pixel = gl_FragCoord.xy;
    float hatch = smoothstep(.78,.99,sin((pixel.x+pixel.y*.78)*.82))*(1.-smoothstep(.09,.48,tone));
    hatch += .57*smoothstep(.85,.99,sin((pixel.x-pixel.y*.62)*.68))*(1.-smoothstep(.05,.30,tone));
    // Keep some of the scene's own colour so materials read as wood, paper and paint rather than one ink.
    vec3 sourceDisplay = pow(clamp(source, 0., 1.), vec3(1./2.2));
    vec3 graded = mix(pigment(clamp(bands+grain*.018,0.,1.)), sourceDisplay*vec3(.92,.98,1.04), .30);
    vec3 printColor = mix(graded, ink, clamp(edge+.06*hatch,0.,.8));
    vec3 memory = printColor * vec3(1.03,.98,.93);
    // The room is printed with unlit inks. Reconstruct each surface position to cast window light
    // and retain local pools around the desk lamp and corridor glass after sunset.
    float z = texture2D(tDepth,uv).r;
    vec4 pos = uInvVP * vec4(uv*2.-1.,z*2.-1.,1.);
    vec3 world = pos.xyz / pos.w;
    float desk = exp(-.48*dot(world-vec3(-.94,2.02,.06),world-vec3(-.94,2.02,.06)));
    float door = exp(-.86*dot(world-vec3(4.31,1.77,.05),world-vec3(4.31,1.77,.05)));
    float west = exp(-.25*dot(world.xz-vec2(-4.25,3.30),world.xz-vec2(-4.25,3.30)));
    float lower = 1.-smoothstep(.08,.56,world.y);
    float blinds=.5+.5*cos((world.z+.50*world.x+1.35*cos(uSolarAngle))*10.);
    float shaft=lower*west*smoothstep(.05,.55,blinds)*max(0.,uAltitude);
    float twilight=1.-smoothstep(.02,.46,abs(uAltitude));
    vec3 day=mix(printColor,memory,uMemoryBlend)*(1.-.078*(1.-shaft))+vec3(.17,.12,.045)*shaft;
    day=mix(day,day*vec3(1.10,.84,.70),twilight*.66);
    vec3 blue=mix(vec3(.045,.065,.09),vec3(.54,.65,.72),pow(tone,.87))*(1.-edge*.55);
    float annexLamp = exp(-.34*dot(world-vec3(0.,1.4,8.4),world-vec3(0.,1.4,8.4))) + .9*exp(-.4*dot(world-vec3(1.2,1.2,13.6),world-vec3(1.2,1.2,13.6)));
    // Failing fluorescent tubes: in Mateo's scenes the lamp pools stutter in short bursts.
    float burst = step(.55, hash(vec2(floor(uClock * .6), 9.)));
    float flick = 1. - .55 * uFlicker * uMemoryBlend * burst * step(.72, hash(vec2(floor(uClock * 14.), 3.)));
    vec3 night=mix(blue,printColor*vec3(1.01,.88,.68),clamp(desk*.94+(door*.71+annexLamp*.82)*flick,0.,.95));
    float amber=smoothstep(.22,.81,source.r-source.b)*smoothstep(.56,1.,source.r);
    night=mix(night,vec3(.96,.72,.39),amber*.72);
    float clue=smoothstep(.15,.56,min(source.g,source.b)-source.r);
    night=mix(night,vec3(.85,.92,.89),clue*.92);
    // Veteran mode lifts night-time visibility by about a fifth.
    night=mix(night,night*1.2+vec3(.035,.04,.05),uLift);
    vec3 finalColor=mix(night,day,uSunlight)+uDawn*vec3(.15,.11,.05)*(.3+.7*tone);
    // The detective's room: near-black navy, except under the spotlight on the evidence board and a dim desk lamp.
    float spot = spotAt(world);
    float lobby = 1. - smoothstep(6.2, 6.6, world.z);
    float keep = clamp(spot * 1.3 + desk * .4 + (1. - lobby) * (.4 + annexLamp * .6) + uLift * .25, 0., 1.);
    vec3 unlit = mix(vec3(.018, .026, .05), finalColor * vec3(.4, .5, .74), .5);
    vec3 underSpot = mix(finalColor, printColor * vec3(1.08, 1., .86), clamp(spot * 1.4, 0., 1.)) * (1. + .35 * spot);   // warm paper under the lamp, against the navy
    finalColor = mix(finalColor, mix(unlit, underSpot, keep), uDetective);
    // Mateo's clinic sits darker and heavier than the same rooms in daylight.
    float vig0 = 1. - smoothstep(.3, .98, length((uv - .5) * vec2(1.2, 1.)));
    finalColor *= mix(1., .84, uMemoryBlend) * (1. - (.2 + .22 * uMemoryBlend) * (1. - vig0));
    // Air: beams from the window and the spotlight, lamp glow, and dust motes that only show where light catches them.
    vec3 rd = world - uCam; float dist = length(rd); rd /= max(dist, 1e-4);
    float reach = min(dist, 7.), jit = hash(gl_FragCoord.xy + fract(uClock) * 61.);
    float sunAmt = max(0., uAltitude) * uSunlight * (1. - uDetective), lampAmt = 1. - .7 * uSunlight;
    float sunBeam = 0., spotBeam = 0., halo = 0.;
    for (int k = 0; k < 6; k++) {
      vec3 p = uCam + rd * reach * (float(k) + jit) / 6.;
      sunBeam += beamAt(p); spotBeam += spotAt(p); halo += lampAt(p);
    }
    float thick = reach / 6. * (.45 + .75 * uDust);
    finalColor += (vec3(1., .82, .5) * sunBeam * sunAmt * .16 + vec3(1., .93, .78) * spotBeam * uDetective * .1 + vec3(1., .74, .4) * halo * lampAmt * .12) * thick;
    float motes = 0.;
    for (int k = 0; k < 4; k++) {
      float t = .45 + float(k) * .62;
      if (t > dist - .08) break;
      vec3 q = uCam + rd * t; q.y += uClock * .011; q.x += uClock * .004;      // slow fall and drift
      vec3 cell = floor(q * 4.5);
      vec3 rnd = vec3(hash(cell.xy + cell.z * 17.3), hash(cell.yz + cell.x * 31.7), hash(cell.zx + cell.y * 11.1));
      if (rnd.x > .25 + .5 * uDust) continue;
      vec3 c = (cell + .25 + .5 * rnd) / 4.5; c.y -= uClock * .011; c.x -= uClock * .004;
      vec3 dc = c - uCam; float along = dot(dc, rd); vec3 perp = dc - rd * along;
      float size = .0028 + .0035 * rnd.z;
      float m = (1. - smoothstep(0., size * size, dot(perp, perp))) * step(0., along) * step(along, dist - .05);
      float lit = beamAt(c) * sunAmt * 1.6 + spotAt(c) * uDetective * 1.5 + lampAt(c) * lampAmt * 1.2 + .05;
      motes += m * lit * (.55 + .45 * sin(uClock * (1. + rnd.y * 2.) + rnd.x * 40.));
    }
    finalColor += vec3(1., .93, .78) * motes * .55 * (1. - .6 * uLift);
    // Distance greys out a little, and the brightest things bleed a soft halo into the print.
    finalColor = mix(finalColor, mix(vec3(.16, .2, .27), vec3(.6, .57, .5), uSunlight * (1. - uDetective)), smoothstep(2.5, 11., dist) * .14 * uDust);
    vec3 bleed = vec3(0.);
    for (int k = 0; k < 8; k++) {
      float an = float(k) * .7854 + jit * 6.2832; vec2 o = vec2(cos(an), sin(an)) * px;
      bleed += max(texture2D(tDiffuse, uv + o * 7.).rgb - .8, 0.) + .6 * max(texture2D(tDiffuse, uv + o * 18.).rgb - .8, 0.);
    }
    finalColor += bleed * vec3(1., .86, .62) * .05;
    // Cutscene grade: deeper vignette, gently lifted contrast and a warm, slightly desaturated print.
    float vig=1.-smoothstep(.32,.95,length((uv-.5)*vec2(1.25,1.)));
    vec3 cineCol=mix(vec3(dot(finalColor,weights)),finalColor,.78)*vec3(1.05,.98,.9);
    cineCol=(cineCol-.5)*1.12+.5;
    finalColor=mix(finalColor,cineCol*(.55+.45*vig),uCine);
    // Negative energy: the world inverts to a photographic negative with burning white outlines,
    // the colour channels tear apart, and ink tendrils crawl in from the edges of the frame.
    if (uNeg > .001) {
      float l = dot(finalColor, weights);
      vec3 neg = vec3(pow(1. - l, 1.8));
      neg = mix(neg, vec3(1.), clamp(edge * 2.2, 0., 1.));
      vec2 split = (uv - .5) * .018 * uNeg;
      float lr = dot(texture2D(tDiffuse, uv + split).rgb, weights), lb = dot(texture2D(tDiffuse, uv - split).rgb, weights);
      neg.r = mix(neg.r, pow(1. - lr, 1.6), .5); neg.b = mix(neg.b, pow(1. - lb, 1.6), .5);
      finalColor = mix(finalColor, neg, uNeg);
    }
    if (uInk > .001) {
      float e = min(min(uv.x, 1. - uv.x), min(uv.y, 1. - uv.y));
      vec2 q = uv * vec2(uResolution.x / uResolution.y, 1.);
      float n = fbm(q * 3.2 + vec2(uTime * .35, -uTime * .22)) + .5 * fbm(q * 7. + uTime * .6);
      float front = uInk * .75 - e * 1.6 + (n - .75) * .55;
      float body = smoothstep(0., .04, front);
      float rim = smoothstep(-.035, 0., front) * (1. - smoothstep(0., .05, front));
      finalColor = mix(finalColor, vec3(.012, .01, .014), body);
      finalColor += vec3(1., .97, .93) * rim * 1.3;
    }
    // Printing imperfections: uneven ink and paper tooth over the whole frame.
    float tooth = vnoise(gl_FragCoord.xy * .35) - .5;
    float speck = hash(gl_FragCoord.xy + fract(uClock * 7.) * 91.) - .5;
    finalColor += (speck * .04 + tooth * .028) * (1. - .6 * uLift);
    gl_FragColor = vec4(finalColor,1.);
  }`;

export function createInkRenderer(canvas, scene, camera) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  const depth = new DepthTexture(1, 1, UnsignedIntType);
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthTexture: depth });
  const composer = new EffectComposer(renderer, target);
  const scenePass = new RenderPass(scene, camera);
  const ink = new ShaderPass({
    name: 'Etched ink',
    vertexShader,
    fragmentShader,
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      uTime: { value: 0 },
      uSunlight: {value:1}, uAltitude:{value:1}, uSolarAngle:{value:0}, uInvVP:{value:new Matrix4()},
      uMemoryBlend: { value: 0 },
      uDawn: { value: 0 },
      uCine: { value: 0 },
      uNeg: { value: 0 },
      uInk: { value: 0 },
      uWarp: { value: 0 },
      uLift: { value: 0 },
      uClock: { value: 0 }, uDust: { value: .7 }, uDetective: { value: 0 }, uCam: { value: new Vector3() },
      uFlicker: { value: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1 },
      uResolution: { value: new Vector2(1, 1) },
    },
  });
  ink.needsSwap = false;
  composer.addPass(scenePass);
  composer.addPass(ink);
  return {
    resize(width, height) {
      const ratio = Math.min(
        devicePixelRatio || 1,
        1.55,
        1600 / Math.max(1, width),
        1000 / Math.max(1, height),
      );
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      composer.setPixelRatio(ratio);
      composer.setSize(width, height);
      renderer.getDrawingBufferSize(ink.uniforms.uResolution.value);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    render(time, memory, sun, altitude, angle, dawn = 0, cine = 0) {
      ink.uniforms.uDawn.value = dawn;
      ink.uniforms.uCine.value = cine;
      ink.uniforms.uTime.value = time;
      ink.uniforms.uMemoryBlend.value = memory;
      ink.uniforms.uSunlight.value=sun;
      ink.uniforms.uAltitude.value=altitude;
      ink.uniforms.uSolarAngle.value=angle;
      camera.updateMatrixWorld();
      const cam = camera.getWorldPosition(ink.uniforms.uCam.value);
      ink.uniforms.uClock.value = performance.now() / 1000 % 3600;
      // How dusty the air is: the lobby by the window, the scrubbed lab, the stale dispatch office.
      ink.uniforms.uDust.value += ((cam.z < 6.45 ? .7 : cam.z < 10.25 ? .35 : 1) - ink.uniforms.uDust.value) * .05;
      ink.uniforms.uInvVP.value.multiplyMatrices(camera.matrixWorld,camera.projectionMatrixInverse);
      ink.uniforms.tDepth.value = composer.readBuffer.depthTexture;
      composer.render(0);
    },
    setLift(v) { ink.uniforms.uLift.value = v; ink.uniforms.uFlicker.value = v || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1; },
    setDetective(v) { ink.uniforms.uDetective.value = v; },
    setFx(neg, inkAmount, warp) {
      ink.uniforms.uNeg.value = neg;
      ink.uniforms.uInk.value = inkAmount;
      ink.uniforms.uWarp.value = warp;
    },
    dispose() {
      ink.dispose();
      scenePass.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}
