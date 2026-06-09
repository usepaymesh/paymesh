'use client';

import { useLayoutEffect, useRef } from 'react';

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_center;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - u_center.x) * aspect, uv.y - u_center.y);
  float dist = length(p);
  float t = u_time * 0.08;

  float stripeFreq = 120.0;
  float phase = uv.x * stripeFreq + t * 0.6;
  float stripe = abs(fract(phase) - 0.5) * 2.0;

  float stripeIdx = floor(phase + 0.5);
  float thickSeed = fract(sin(stripeIdx * 45.77) * 9823.11);
  float vThickness = 0.22
    + step(0.78, thickSeed) * 0.08
    + step(0.93, thickSeed) * 0.14;
  float stripeCore = 1.0 - smoothstep(0.06, vThickness, stripe);

  float dashSpacingPx = 32.0;
  float dashFract = fract(gl_FragCoord.y / dashSpacingPx);
  float dashMask = smoothstep(0.06, 0.18, dashFract);
  float lineCore = stripeCore * dashMask;

  float gapIdx = floor(phase);
  float beadCycle = 7.0;
  float beadCycleIndex = floor(u_time / beadCycle);
  float beadProgress = fract(u_time / beadCycle);
  float targetGap = floor(
    fract(sin(beadCycleIndex * 45.321 + 1.7) * 54321.98) * stripeFreq
  );
  float onTargetGap = 1.0 - step(0.5, abs(gapIdx - targetGap));
  float travel = beadProgress / 0.8;
  float beadVisible = step(beadProgress, 0.8);
  float beadY = 1.0 - travel;
  float travelFade = sin(clamp(travel, 0.0, 1.0) * 3.14159);
  float gapCore = smoothstep(0.55, 0.95, stripe);
  float bead = exp(-pow((uv.y - beadY) * 22.0, 2.0)) * beadVisible * travelFade;
  float signal = gapCore * bead * onTargetGap;

  float dy = uv.y - u_center.y;
  float sigma = dy > 0.0 ? 0.08 : 0.22;
  float verticalHalo = exp(-pow(dy / sigma, 2.0));

  float centerClear = smoothstep(0.14, 0.28, dist);
  float leftFade = smoothstep(0.25, 0.7, uv.x);
  float envelope = verticalHalo * centerClear * leftFade;

  float ripple = 0.0;
  for (int i = 0; i < 3; i++) {
    float rp = fract(t * 0.3 + float(i) * 0.333);
    float radius = rp * 1.2;
    float bell = (1.0 - rp) * rp * 4.0;
    ripple += exp(-pow((dist - radius) * 10.0, 2.0)) * bell;
  }

  float lines = lineCore * envelope * (0.32 + ripple * 1.1);
  lines += signal * envelope * 0.9;

  vec2 vc = uv - 0.5;
  float vignette = clamp(1.0 - dot(vc, vc) * 0.9, 0.0, 1.0);
  float brightness = clamp(lines * 0.75 * vignette * 0.9, 0.0, 1.0);

  gl_FragColor = vec4(vec3(brightness), 1.0);
}`;

export function LineFieldBackground() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const frameRef = useRef<number>(0);

	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const gl = canvas.getContext('webgl', {
			alpha: false,
			antialias: false,
			preserveDrawingBuffer: false,
		});
		if (!gl) return;

		const createShader = (type: number, source: string) => {
			const shader = gl.createShader(type);
			if (!shader) return null;
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			return shader;
		};

		const vertexShader = createShader(gl.VERTEX_SHADER, VERTEX_SHADER);
		const fragmentShader = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
		if (!vertexShader || !fragmentShader) return;

		const program = gl.createProgram();
		if (!program) return;

		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);
		const activateProgram = gl.useProgram.bind(gl);
		activateProgram(program);

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW,
		);

		const aPosition = gl.getAttribLocation(program, 'a_position');
		gl.enableVertexAttribArray(aPosition);
		gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

		const uTime = gl.getUniformLocation(program, 'u_time');
		const uResolution = gl.getUniformLocation(program, 'u_resolution');
		const uCenter = gl.getUniformLocation(program, 'u_center');

		const startTime = performance.now();

		const resize = () => {
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			const scale = 0.75 * dpr;
			canvas.width = canvas.offsetWidth * scale;
			canvas.height = canvas.offsetHeight * scale;
			gl.viewport(0, 0, canvas.width, canvas.height);
		};

		resize();
		window.addEventListener('resize', resize);

		const draw = () => {
			const elapsed = (performance.now() - startTime) / 1000;
			const cssWidth = canvas.offsetWidth || canvas.width;
			const cssHeight = canvas.offsetHeight || canvas.height;
			const logoOffsetPx = cssWidth * 0.15;
			const centerY = Math.min(0.5 + logoOffsetPx / cssHeight, 0.85);

			gl.uniform1f(uTime, elapsed);
			gl.uniform2f(uResolution, canvas.width, canvas.height);
			gl.uniform2f(uCenter, 0.5, centerY);
			gl.drawArrays(gl.TRIANGLES, 0, 6);

			frameRef.current = requestAnimationFrame(draw);
		};

		frameRef.current = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(frameRef.current);
			window.removeEventListener('resize', resize);
			gl.deleteProgram(program);
			gl.deleteShader(vertexShader);
			gl.deleteShader(fragmentShader);
			if (buffer) gl.deleteBuffer(buffer);
		};
	}, []);

	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 hidden overflow-hidden bg-[var(--landing-panel-bg)] lg:block"
		>
			<canvas
				ref={canvasRef}
				className="h-full w-full opacity-50 invert dark:opacity-70 dark:invert-0"
			/>
		</div>
	);
}
