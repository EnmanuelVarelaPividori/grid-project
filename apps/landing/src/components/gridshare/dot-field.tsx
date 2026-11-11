import {useEffect, useRef} from "react";
import {Brand} from "./icons";

// A dot-matrix shader drawn as a grid of round "LED" dots. It first plays as a dark loading screen: a lightning
// bolt charges up from bottom to top. Then the page fades to white and the bolt grows, turns light green and keeps
// spinning slowly behind the hero.
//
// The phase lives on <html data-intro="play|reveal|done|skip">. An inline script in the document head
// (introScript, below) picks "play" or "skip" before first paint, so returning visitors never see a flash.
// Adding ?intro to the URL always replays it.

export const introStorageKey = "gs-intro-seen";
export const introScript = `(function(){var d=document.documentElement,s="play";try{if(sessionStorage.getItem("${introStorageKey}"))s="skip"}catch(e){}if(location.hash||matchMedia("(prefers-reduced-motion: reduce)").matches)s="skip";if(/[?&]intro(=|&|$)/.test(location.search))s="play";d.dataset.intro=s})()`;

const vertexShader = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const fragmentShader = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uDark;   // 1 = loading screen on dark ground, 0 = light hero background
uniform float uCell;   // dot pitch in device pixels
uniform float uBolt;   // bolt height as a share of the screen height
uniform float uCharge; // how far the bolt has charged, from bottom (0) to top (1)
uniform float uSpin;   // rotation of the bolt around its vertical axis, in radians

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
	float value = 0.0;
	float amplitude = 0.5;
	for (int i = 0; i < 5; i++) {
		value += amplitude * noise(p);
		p *= 2.03;
		amplitude *= 0.5;
	}
	return value;
}
// One edge of the polygon distance below (Inigo Quilez's sdPolygon, unrolled for WebGL 1).
void polygonEdge(vec2 p, vec2 a, vec2 b, inout float d, inout float s) {
	vec2 e = b - a;
	vec2 w = p - a;
	vec2 q = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
	d = min(d, dot(q, q));
	bvec3 c = bvec3(p.y >= a.y, p.y < b.y, e.x * w.y > e.y * w.x);
	if (all(c) || all(not(c))) s = -s;
}
// Signed distance to a lightning bolt one unit tall, centred on the origin; negative inside.
float sdBolt(vec2 p) {
	vec2 v0 = vec2(0.03, 0.5);
	vec2 v1 = vec2(-0.21, -0.02);
	vec2 v2 = vec2(-0.03, -0.02);
	vec2 v3 = vec2(-0.13, -0.5);
	vec2 v4 = vec2(0.23, 0.06);
	vec2 v5 = vec2(0.05, 0.06);
	vec2 v6 = vec2(0.21, 0.5);
	float d = dot(p - v0, p - v0);
	float s = 1.0;
	polygonEdge(p, v0, v6, d, s);
	polygonEdge(p, v1, v0, d, s);
	polygonEdge(p, v2, v1, d, s);
	polygonEdge(p, v3, v2, d, s);
	polygonEdge(p, v4, v3, d, s);
	polygonEdge(p, v5, v4, d, s);
	polygonEdge(p, v6, v5, d, s);
	return s * sqrt(d);
}
// The bolt: dim dots where it is still empty, bright crackling dots where it has charged, and a soft glow.
// Spinning around the vertical axis squeezes it like a turning coin; the back face shows mirrored.
float bolt(vec2 uv) {
	float turn = cos(uSpin);
	vec2 p = uv / uBolt;
	p.x /= sign(turn) * max(abs(turn), 0.06);
	float n = fbm(p * 3.0 + vec2(uTime * 0.7, -uTime * 0.5));
	float d = sdBolt(p) + (n - 0.5) * 0.05;
	float inside = 1.0 - smoothstep(-0.01, 0.015, d);
	float fillLine = mix(-0.56, 0.56, uCharge);
	float charged = 1.0 - smoothstep(fillLine - 0.03, fillLine + 0.03, p.y);
	float core = inside * mix(0.36, 0.8 + 0.4 * n, charged) * (0.65 + 0.35 * abs(turn));
	float halo = exp(-max(d, 0.0) * 16.0) * (0.12 + 0.25 * uCharge);
	return clamp(core + halo * (1.0 - inside), 0.0, 1.0);
}

void main() {
	vec2 px = gl_FragCoord.xy;
	vec2 cellId = floor(px / uCell);
	vec2 centre = (cellId + 0.5) * uCell;

	// Scanline glitch: now and then a row slips sideways.
	float glitch = step(0.985, hash(vec2(cellId.y, floor(uTime * 7.0)))) * (hash(vec2(cellId.y, 3.0)) - 0.5) * 0.04;
	vec2 uv = (centre - 0.5 * uResolution) / uResolution.y + vec2(glitch, -0.05 * uDark);

	// Slightly offset samples per channel give the RGB fringe of an LED panel.
	float fringe = 0.004 + 0.002 * uDark;
	float g = bolt(uv);
	float r = bolt(uv + vec2(fringe, 0.0));
	float b = bolt(uv - vec2(fringe, 0.0));
	float flicker = 0.9 + 0.1 * sin(cellId.y * 0.8 + uTime * 5.0);
	float level = max(g, max(r, b)) * flicker;

	// Each cell is a round dot: a faint base dot, grown and lit by the field.
	float d = length(px - centre) / uCell;
	float radius = mix(0.11, 0.46, level);
	float edge = 1.2 / uCell;
	float dotMask = 1.0 - smoothstep(radius - edge, radius + edge, d);

	vec3 darkTint = vec3(r, g, b) * vec3(0.85, 1.0, 0.95);
	vec3 darkColour = mix(vec3(0.42, 0.75, 0.29), vec3(0.95, 0.99, 0.92), smoothstep(0.2, 0.75, darkTint));
	vec3 lightColour = mix(vec3(0.29, 0.48, 0.21), vec3(0.42, 0.75, 0.29), level);
	vec3 colour = mix(lightColour, darkColour, uDark);

	// On the light page: soft enough to read the headline over, fading out at the bottom of the hero.
	float bottomFade = smoothstep(0.0, 0.22, px.y / uResolution.y);
	float lightAlpha = (0.05 + 0.4 * level) * bottomFade;
	float darkAlpha = 0.08 + 0.92 * level;
	float alpha = dotMask * mix(lightAlpha, darkAlpha, uDark);

	vec3 ground = vec3(0.078, 0.102, 0.075) * uDark;
	gl_FragColor = vec4(colour * alpha + ground * (1.0 - alpha), alpha + uDark * (1.0 - alpha));
}
`;

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

// Timeline, in seconds: the bolt pops in and charges while "loading", holds for a beat, then the page is revealed
// while the bolt grows and starts to spin.
const popEnd = 0.35;
const chargeEnd = 2.0;
const revealStart = 2.25;
const revealEnd = 3.35;
const boltHeight = 0.32;
const settledHeight = 0.6;
const spinSpeed = 0.9; // radians a second: one turn about every 7 s

function compile(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function setup(canvas: HTMLCanvasElement) {
	const gl = canvas.getContext("webgl", {alpha: true, antialias: false, premultipliedAlpha: true});
	if (!gl) return null;
	const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
	const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
	const program = gl.createProgram();
	if (!vertex || !fragment || !program) return null;
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
	gl.useProgram(program);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const position = gl.getAttribLocation(program, "aPosition");
	gl.enableVertexAttribArray(position);
	gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
	const uniform = (name: string) => gl.getUniformLocation(program, name);
	return {
		gl,
		resolution: uniform("uResolution"),
		time: uniform("uTime"),
		dark: uniform("uDark"),
		cell: uniform("uCell"),
		bolt: uniform("uBolt"),
		charge: uniform("uCharge"),
		spin: uniform("uSpin"),
	};
}

export function DotField() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const progressRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const root = document.documentElement;
		const canvas = canvasRef.current;
		const finish = () => {
			root.dataset.intro = "done";
		};
		const context = canvas ? setup(canvas) : null;
		if (!canvas || !context) {
			finish();
			return;
		}
		const playing = root.dataset.intro === "play";
		if (playing) {
			window.scrollTo(0, 0);
			try {
				sessionStorage.setItem(introStorageKey, "1");
			} catch {
				// Storage can be unavailable (private mode); the intro then simply plays again next time.
			}
		} else finish();
		const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
		const {gl} = context;
		let frame = 0;
		let visible = true;
		let width = 0;
		let height = 0;
		// The timeline starts at the first frame actually drawn, so a page opened in a background tab still plays it.
		let start = 0;

		const resize = () => {
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			width = Math.round(canvas.clientWidth * dpr);
			height = Math.round(canvas.clientHeight * dpr);
			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width;
				canvas.height = height;
			}
			gl.viewport(0, 0, width, height);
			gl.uniform2f(context.resolution, width, height);
			gl.uniform1f(context.cell, (width < 700 * dpr ? 8 : 10) * dpr);
		};

		const draw = (now: number) => {
			if (!start) start = now;
			const elapsed = (now - start) / 1000;
			let dark = 0;
			let bolt = settledHeight;
			let charge = 1;
			let spin = reducedMotion ? 0 : elapsed * spinSpeed;
			if (playing) spin = Math.max(0, elapsed - revealStart) * spinSpeed;
			if (playing && elapsed < revealEnd) {
				charge = easeInOut(clamp01(elapsed / chargeEnd));
				const reveal = easeInOut(clamp01((elapsed - revealStart) / (revealEnd - revealStart)));
				dark = 1 - reveal;
				bolt = (boltHeight + (settledHeight - boltHeight) * reveal) * easeOut(clamp01(elapsed / popEnd));
				if (progressRef.current) progressRef.current.textContent = `${Math.round(charge * 100)}%`;
				if (elapsed >= revealStart && root.dataset.intro === "play") root.dataset.intro = "reveal";
			} else if (root.dataset.intro === "reveal") finish();
			gl.uniform1f(context.time, reducedMotion ? 4 : elapsed + 4);
			gl.uniform1f(context.dark, dark);
			gl.uniform1f(context.bolt, bolt);
			gl.uniform1f(context.charge, charge);
			gl.uniform1f(context.spin, spin);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		};

		const loop = (now: number) => {
			draw(now);
			frame = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
		};
		const wake = () => {
			if (!frame && visible && !document.hidden && !reducedMotion) frame = requestAnimationFrame(loop);
		};

		resize();
		const resizeObserver = new ResizeObserver(() => {
			resize();
			if (!frame) draw(performance.now());
		});
		resizeObserver.observe(canvas);
		// Stop drawing once the hero has scrolled out of view.
		const intersection = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			wake();
		});
		intersection.observe(canvas);
		document.addEventListener("visibilitychange", wake);
		if (reducedMotion) draw(performance.now());
		else frame = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			intersection.disconnect();
			document.removeEventListener("visibilitychange", wake);
			// The phase is left as it is: React's development double mount runs this cleanup and then the effect
			// again, which picks the intro up from the same phase.
		};
	}, []);

	return (
		<>
			<div aria-hidden="true" className="gs-hero-bg">
				<canvas ref={canvasRef} />
			</div>
			<div aria-hidden="true" className="gs-intro">
				<Brand />
				<p>
					Planning your street…{" "}
					<span ref={progressRef} className="gs-num">
						0%
					</span>
				</p>
			</div>
		</>
	);
}
