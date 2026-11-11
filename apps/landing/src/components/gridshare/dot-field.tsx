import {useEffect, useRef} from "react";
import {Brand} from "./icons";

// A dot-matrix shader: an organic, slowly morphing energy shape drawn as a grid of round "LED" dots.
// It first plays as a dark loading screen, then fades to white and settles in as the hero background.
//
// The phase lives on <html data-intro="play|reveal|done|skip">. An inline script in the document head
// (introScript, below) picks "play" or "skip" before first paint, so returning visitors never see a flash.

export const introStorageKey = "gs-intro-seen";
export const introScript = `(function(){var d=document.documentElement,s="play";try{if(sessionStorage.getItem("${introStorageKey}"))s="skip"}catch(e){}if(location.hash||matchMedia("(prefers-reduced-motion: reduce)").matches)s="skip";d.dataset.intro=s})()`;

const vertexShader = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const fragmentShader = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uDark;   // 1 = loading screen on dark ground, 0 = light hero background
uniform float uSize;   // radius of the energy shape
uniform float uCell;   // dot pitch in device pixels

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
// Brightness of the energy shape at a point: a domain-warped noise blob that drifts and breathes.
float field(vec2 uv) {
	float t = uTime;
	vec2 warp = vec2(fbm(uv * 1.5 + vec2(0.0, t * 0.11)), fbm(uv * 1.5 + vec2(5.2, -t * 0.09)));
	float n = fbm(uv * 1.3 + 1.9 * warp + vec2(t * 0.04, -t * 0.03));
	float r = length(uv * vec2(0.9, 1.2));
	float shape = smoothstep(uSize, uSize * 0.15, r + (n - 0.5) * 1.3);
	return clamp(shape * (0.55 + 1.35 * n), 0.0, 1.0);
}

void main() {
	vec2 px = gl_FragCoord.xy;
	vec2 cellId = floor(px / uCell);
	vec2 centre = (cellId + 0.5) * uCell;

	// Scanline glitch: now and then a row slips sideways.
	float glitch = step(0.985, hash(vec2(cellId.y, floor(uTime * 7.0)))) * (hash(vec2(cellId.y, 3.0)) - 0.5) * 0.08;
	vec2 uv = (centre - 0.5 * uResolution) / uResolution.y + vec2(glitch, -0.07 * uDark);

	// Slightly offset samples per channel give the RGB fringe of an LED panel.
	float fringe = 0.012 + 0.01 * uDark;
	float g = field(uv);
	float r = field(uv + vec2(fringe, 0.0));
	float b = field(uv - vec2(fringe, 0.0));
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

	// On the light page: keep the centre (headline) quieter and fade out towards the bottom of the hero.
	vec2 screen = px / uResolution;
	float centreQuiet = mix(0.35, 1.0, smoothstep(0.12, 0.62, length((screen - vec2(0.5, 0.55)) * vec2(1.6, 1.0))));
	float bottomFade = smoothstep(0.0, 0.45, screen.y);
	float lightAlpha = (0.05 + 0.42 * level) * centreQuiet * bottomFade;
	float darkAlpha = 0.08 + 0.92 * level;
	float alpha = dotMask * mix(lightAlpha, darkAlpha, uDark);

	vec3 ground = vec3(0.078, 0.102, 0.075) * uDark;
	gl_FragColor = vec4(colour * alpha + ground * (1.0 - alpha), alpha + uDark * (1.0 - alpha));
}
`;

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

// Timeline, in seconds: the shape grows while "loading", then the page is revealed.
const loadEnd = 2.0;
const revealEnd = 3.1;
const settledSize = 1.05;

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
		size: uniform("uSize"),
		cell: uniform("uCell"),
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
		const playing = root.dataset.intro === "play" && window.scrollY === 0;
		if (playing) {
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
		const start = performance.now();

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
			const elapsed = (now - start) / 1000;
			let dark = 0;
			let size = settledSize;
			if (playing && elapsed < revealEnd) {
				const load = easeOut(clamp01(elapsed / loadEnd));
				const reveal = easeInOut(clamp01((elapsed - loadEnd) / (revealEnd - loadEnd)));
				dark = 1 - reveal;
				size = 0.04 + 0.21 * load + (settledSize - 0.25) * reveal;
				if (progressRef.current) progressRef.current.textContent = `${Math.round(load * 100)}%`;
				if (elapsed >= loadEnd && root.dataset.intro === "play") root.dataset.intro = "reveal";
			} else if (root.dataset.intro === "reveal") finish();
			gl.uniform1f(context.time, reducedMotion ? 4 : elapsed + 4);
			gl.uniform1f(context.dark, dark);
			gl.uniform1f(context.size, size);
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
