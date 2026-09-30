import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
    RotateCw,
    RotateCcw,
    Maximize2,
    Eye,
    Layers,
    Gauge,
    Crosshair,
    Radio,
    ShieldAlert,
} from "lucide-react";

interface Drone3DViewerProps {
    rpm?: number;
    throttle?: number;
    vibration?: number;
    cht?: number;
    height?: number | string;
    onSelectPart?: (partName: string) => void;
}

type ViewPreset = "PERSPECTIVE" | "TOP" | "FRONT" | "SIDE" | "REAR";
type DisplayMode = "TACTICAL" | "WIREFRAME" | "THERMAL";

// ─── Geometry helpers ────────────────────────────────────────────────────────

/**
 * Tapered trapezoidal wing panel – span along +X, chord along Z, thickness along Y.
 * DoubleSide material recommended so mirroring is seamless.
 */
function makeTaperedPanel(
    span: number,
    rootFwd: number, rootAft: number,
    tipFwd: number,  tipAft: number,
    thick: number,
    tipY = 0
): THREE.BufferGeometry {
    const h = thick * 0.5;
    const ty = tipY;
    // prettier-ignore
    const pos = new Float32Array([
        // TOP (y = +h)
        0,    h,    rootFwd,   // 0 root-leading
        span, ty+h, tipFwd,    // 1 tip-leading
        span, ty+h, tipAft,    // 2 tip-trailing
        0,    h,    rootAft,   // 3 root-trailing
        // BOTTOM (y = -h)
        0,    -h,    rootFwd,  // 4 root-leading
        span, ty-h,  tipFwd,   // 5 tip-leading
        span, ty-h,  tipAft,   // 6 tip-trailing
        0,    -h,    rootAft,  // 7 root-trailing
    ]);
    // prettier-ignore
    const idx = new Uint16Array([
        0,1,2,  0,2,3,   // top
        4,6,5,  4,7,6,   // bottom
        0,5,1,  0,4,5,   // leading edge
        3,2,6,  3,6,7,   // trailing edge
        0,7,4,  0,3,7,   // root cap
        1,5,6,  1,6,2,   // tip cap
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    return geo;
}

/**
 * Vertical fin panel – span along +Y, chord along Z, thickness along X.
 */
function makeVerticalFin(
    span: number,
    rootFwd: number, rootAft: number,
    tipFwd: number,  tipAft: number,
    thick: number
): THREE.BufferGeometry {
    const h = thick * 0.5;
    // prettier-ignore
    const pos = new Float32Array([
        // RIGHT face (x = +h)
         h, 0,    rootFwd,  // 0
         h, span, tipFwd,   // 1
         h, span, tipAft,   // 2
         h, 0,    rootAft,  // 3
        // LEFT face (x = -h)
        -h, 0,    rootFwd,  // 4
        -h, span, tipFwd,   // 5
        -h, span, tipAft,   // 6
        -h, 0,    rootAft,  // 7
    ]);
    // prettier-ignore
    const idx = new Uint16Array([
        0,3,2,  0,2,1,   // right face
        4,5,6,  4,6,7,   // left face
        0,1,5,  0,5,4,   // leading edge
        3,7,6,  3,6,2,   // trailing edge
        0,4,7,  0,7,3,   // root cap
        1,2,6,  1,6,5,   // tip cap
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    return geo;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Drone3DViewer({
    rpm = 3400,
    throttle = 45,
    vibration = 0.08,
    cht = 175,
    height = "100%",
}: Drone3DViewerProps) {
    const mountRef       = useRef<HTMLDivElement>(null);
    const rendererRef    = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef      = useRef<THREE.PerspectiveCamera | null>(null);
    const strobeLightRef = useRef<THREE.PointLight | null>(null);
    const materialsRef   = useRef<THREE.MeshStandardMaterial[]>([]);

    const [autoRotate,  setAutoRotate]  = useState(true);
    const [displayMode, setDisplayMode] = useState<DisplayMode>("TACTICAL");
    const [viewPreset,  setViewPreset]  = useState<ViewPreset>("PERSPECTIVE");
    const [hudData, setHudData] = useState({ yaw: 42, distance: 9.0 });

    // Orbit state
    const isDraggingRef  = useRef(false);
    const dragModeRef    = useRef<"rotate" | "pan">("rotate");
    const prevPtrRef     = useRef({ x: 0, y: 0 });
    const sphericalRef   = useRef({ radius: 9.0, theta: Math.PI / 4, phi: Math.PI / 3 });
    const targetRef      = useRef(new THREE.Vector3(0, 0, 0));
    const autoRotateRef  = useRef(autoRotate);

    // Keep autoRotate ref in sync
    useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

    // Telemetry ref
    const telemetryRef = useRef({ rpm, throttle, vibration, cht });
    useEffect(() => { telemetryRef.current = { rpm, throttle, vibration, cht }; },
        [rpm, throttle, vibration, cht]);

    // View presets
    const applyViewPreset = useCallback((preset: ViewPreset) => {
        setViewPreset(preset);
        setAutoRotate(false);
        const r = 9.5;
        if (preset === "TOP")         sphericalRef.current = { radius: r, theta: 0, phi: 0.06 };
        else if (preset === "FRONT")  sphericalRef.current = { radius: r, theta: 0, phi: Math.PI / 2 };
        else if (preset === "SIDE")   sphericalRef.current = { radius: r, theta: Math.PI / 2, phi: Math.PI / 2 };
        else if (preset === "REAR")   sphericalRef.current = { radius: r, theta: Math.PI, phi: Math.PI / 2 };
        else                          sphericalRef.current = { radius: 9.0, theta: Math.PI / 4, phi: Math.PI / 3 };
        targetRef.current.set(0, 0, 0);
    }, []);

    const resetView = () => { applyViewPreset("PERSPECTIVE"); setAutoRotate(true); };

    // Display mode toggling
    useEffect(() => {
        materialsRef.current.forEach((mat) => {
            if (displayMode === "WIREFRAME") {
                mat.wireframe = true;
                mat.color.setHex(0x00f0ff);
                mat.emissive.setHex(0x003344);
            } else if (displayMode === "THERMAL") {
                mat.wireframe = false;
                const heat = Math.min(Math.max((telemetryRef.current.cht - 120) / 100, 0), 1);
                const col = new THREE.Color().setHSL(0.66 - heat * 0.66, 1.0, 0.45);
                mat.color.copy(col);
                mat.emissive.copy(col.clone().multiplyScalar(0.4));
            } else {
                mat.wireframe = false;
                if (mat.userData.origColor)    mat.color.copy(mat.userData.origColor);
                if (mat.userData.origEmissive) mat.emissive.copy(mat.userData.origEmissive);
            }
        });
    }, [displayMode]);

    // ── Main Three.js setup ────────────────────────────────────────────────
    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        const W = container.clientWidth  || 600;
        const H = container.clientHeight || 400;

        // Scene
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x06080c, 0.055);

        // Camera
        const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 300);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.4;
        rendererRef.current = renderer;
        container.appendChild(renderer.domElement);

        // ── Lights ──
        scene.add(new THREE.AmbientLight(0x8899bb, 0.8));

        const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
        keyLight.position.set(7, 12, 9);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.bias = -0.001;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x4466aa, 1.1);
        fillLight.position.set(-8, 3, -6);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xc6ff3d, 0.7);
        rimLight.position.set(0, -5, -5);
        scene.add(rimLight);

        const strobeLight = new THREE.PointLight(0xffffff, 0, 20);
        strobeLight.position.set(0, -0.5, -3.6);
        scene.add(strobeLight);
        strobeLightRef.current = strobeLight;

        // ── Material factory ──
        const mats: THREE.MeshStandardMaterial[] = [];
        const mkMat = (params: THREE.MeshStandardMaterialParameters & { side?: THREE.Side }): THREE.MeshStandardMaterial => {
            const m = new THREE.MeshStandardMaterial(params);
            m.userData.origColor    = m.color.clone();
            m.userData.origEmissive = m.emissive.clone();
            mats.push(m);
            return m;
        };
        materialsRef.current = mats;

        // Core materials
        const bodyMat   = mkMat({ color: 0x6a7480, roughness: 0.55, metalness: 0.28, side: THREE.DoubleSide });
        const darkMat   = mkMat({ color: 0x363f4a, roughness: 0.70, metalness: 0.18, side: THREE.DoubleSide });
        const blackMat  = mkMat({ color: 0x141820, roughness: 0.30, metalness: 0.60 });
        const accentMat = mkMat({ color: 0xc6ff3d, roughness: 0.30, metalness: 0.40, emissive: new THREE.Color(0x4a7800), emissiveIntensity: 0.4 });
        const ledGreen  = mkMat({ color: 0x22ff55, emissive: new THREE.Color(0x00ff44), emissiveIntensity: 4.0, roughness: 0.1 });
        const ledRed    = mkMat({ color: 0xff2222, emissive: new THREE.Color(0xff0000), emissiveIntensity: 4.0, roughness: 0.1 });
        const ledWhite  = mkMat({ color: 0xffffff, emissive: new THREE.Color(0xffffff), emissiveIntensity: 2.5, roughness: 0.1 });
        const exhaustMat = mkMat({ color: 0xff5500, emissive: new THREE.Color(0xff2200), emissiveIntensity: 1.8, roughness: 0.2 });
        const glassMat  = new THREE.MeshPhysicalMaterial({
            color: 0x050d1a, roughness: 0.04, metalness: 0.05,
            transmission: 0.88, transparent: true, reflectivity: 0.95,
        });

        // ── Drone Group ──
        const drone = new THREE.Group();
        scene.add(drone);

        // ── 1. FUSELAGE (LatheGeometry, Global-Hawk / RQ-4 style) ──────────
        // Profile from TAIL (y=0, thin) → NOSE (y=7, bulbous).
        // After rotation.x = PI/2: axis maps to Z → nose at z=+3.5, tail at z=-3.5.
        const fusPts = [
            new THREE.Vector2(0.00,  0.00),   // tail tip
            new THREE.Vector2(0.07,  0.28),
            new THREE.Vector2(0.13,  0.65),
            new THREE.Vector2(0.20,  1.20),
            new THREE.Vector2(0.28,  2.00),
            new THREE.Vector2(0.33,  2.80),
            new THREE.Vector2(0.36,  3.50),   // mid-body
            new THREE.Vector2(0.38,  4.20),
            new THREE.Vector2(0.40,  4.80),
            new THREE.Vector2(0.44,  5.30),
            new THREE.Vector2(0.52,  5.80),   // nose starts widening
            new THREE.Vector2(0.60,  6.20),
            new THREE.Vector2(0.63,  6.52),   // maximum nose width (characteristic!)
            new THREE.Vector2(0.54,  6.80),
            new THREE.Vector2(0.32,  6.95),
            new THREE.Vector2(0.00,  7.00),   // nose tip
        ];
        const fusGeo = new THREE.LatheGeometry(fusPts, 28);
        const fuselage = new THREE.Mesh(fusGeo, bodyMat);
        fuselage.rotation.x = Math.PI / 2;
        fuselage.position.z = -3.5;   // centers: tail at z=-3.5, nose at z=+3.5
        fuselage.castShadow = true;
        fuselage.receiveShadow = true;
        drone.add(fuselage);

        // ── 2. SATELLITE / COMMS DOME (top of nose) ────────────────────────
        const domeGeo = new THREE.SphereGeometry(0.23, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const dome = new THREE.Mesh(domeGeo, bodyMat);
        dome.position.set(0, 0.57, 2.0);
        dome.castShadow = true;
        drone.add(dome);

        const domeRingGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.04, 20);
        const domeRing = new THREE.Mesh(domeRingGeo, darkMat);
        domeRing.position.set(0, 0.48, 2.0);
        drone.add(domeRing);

        // ── 3. ENGINE INTAKE FAIRING (on top, mid-fuselage) ────────────────
        const intakeGeo = new THREE.CylinderGeometry(0.20, 0.23, 0.72, 18);
        const intake = new THREE.Mesh(intakeGeo, darkMat);
        intake.position.set(0, 0.54, 0.75);
        intake.rotation.x = Math.PI / 6;
        intake.castShadow = true;
        drone.add(intake);

        // Intake lip ring
        const lipGeo = new THREE.TorusGeometry(0.21, 0.026, 8, 22);
        const lip = new THREE.Mesh(lipGeo, blackMat);
        lip.position.set(0, 0.65, 0.45);
        lip.rotation.x = Math.PI / 6;
        drone.add(lip);

        // Dark intake opening
        const intakeCapGeo = new THREE.CircleGeometry(0.19, 18);
        const intakeCap = new THREE.Mesh(intakeCapGeo, blackMat);
        intakeCap.position.set(0, 0.67, 0.42);
        intakeCap.rotation.x = -(Math.PI / 2 - Math.PI / 6);
        drone.add(intakeCap);

        // ── 4. SENSOR BALL TURRET (under nose) ─────────────────────────────
        const sensorGeo = new THREE.SphereGeometry(0.19, 20, 20);
        const sensor = new THREE.Mesh(sensorGeo, blackMat);
        sensor.position.set(0, -0.56, 2.85);
        drone.add(sensor);

        // Yoke ring around sensor
        const yokeGeo = new THREE.TorusGeometry(0.21, 0.025, 8, 26, Math.PI);
        const yoke = new THREE.Mesh(yokeGeo, darkMat);
        yoke.position.set(0, -0.53, 2.85);
        yoke.rotation.x = Math.PI / 2;
        drone.add(yoke);

        // Camera lens
        const lensGeo = new THREE.CircleGeometry(0.10, 18);
        const lens = new THREE.Mesh(lensGeo, glassMat);
        lens.position.set(0, -0.63, 3.02);
        drone.add(lens);

        // Lens barrel
        const barrelGeo = new THREE.CylinderGeometry(0.10, 0.12, 0.08, 18);
        const barrel = new THREE.Mesh(barrelGeo, blackMat);
        barrel.position.set(0, -0.61, 2.98);
        barrel.rotation.x = Math.PI / 2;
        drone.add(barrel);

        // ── 5. MAIN WINGS ───────────────────────────────────────────────────
        // High-aspect-ratio wings typical of Global Hawk.
        // Root chord: 1.75 (fwd 0.65, aft -1.10) — positioned at z≈-0.2
        // Tip chord:  0.50 (fwd 0.18, aft -0.32)
        // Half-span: 7.5 (total span 15 units vs body 7 → ratio 2.1, close to real GH)
        // Dihedral:   0.30 at tip
        const wingRootFwd = 0.65, wingRootAft = -1.10;
        const wingTipFwd  = 0.18, wingTipAft  = -0.32;
        const wingSpan    = 7.5,  wingDihedral = 0.30;
        const wingThick   = 0.11;

        const wingGeo = makeTaperedPanel(wingSpan, wingRootFwd, wingRootAft, wingTipFwd, wingTipAft, wingThick, wingDihedral);

        const wingR = new THREE.Mesh(wingGeo, bodyMat);
        wingR.position.set(0.36, -0.02, -0.22);
        wingR.castShadow = true; wingR.receiveShadow = true;
        drone.add(wingR);

        const wingL = new THREE.Mesh(wingGeo, bodyMat);
        wingL.position.set(-0.36, -0.02, -0.22);
        wingL.scale.x = -1; // mirror
        wingL.castShadow = true; wingL.receiveShadow = true;
        drone.add(wingL);

        // Wing root fillets (smooth junction)
        for (const sx of [1, -1]) {
            const fltGeo = new THREE.CylinderGeometry(0.07, 0.13, wingRootFwd - wingRootAft, 8);
            fltGeo.applyMatrix4(new THREE.Matrix4().makeScale(0.5, 1, 1));
            const flt = new THREE.Mesh(fltGeo, bodyMat);
            flt.position.set(sx * 0.30, 0, -0.22);
            flt.rotation.x = Math.PI / 2;
            drone.add(flt);
        }

        // ── 6. WING PYLONS + SENSOR/FUEL PODS ──────────────────────────────
        const pylonData = [
            { x: 1.9, len: 0.52, rad: 0.055 },
            { x: 3.8, len: 0.44, rad: 0.048 },
        ];
        for (const pd of pylonData) {
            const dihY = wingDihedral * (pd.x / wingSpan);
            for (const sx of [1, -1]) {
                // Strut
                const strut = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.10), darkMat);
                strut.position.set(sx * (pd.x + 0.36), -0.15 + dihY, -0.22);
                drone.add(strut);
                // Pod
                const podGeo = new THREE.CylinderGeometry(pd.rad, pd.rad, pd.len, 14);
                const pod = new THREE.Mesh(podGeo, darkMat);
                pod.position.set(sx * (pd.x + 0.36), -0.38 + dihY, -0.22);
                pod.rotation.x = Math.PI / 2;
                drone.add(pod);
                // Pod nose cone
                const coneGeo = new THREE.ConeGeometry(pd.rad, pd.rad * 3.5, 14);
                const cone = new THREE.Mesh(coneGeo, darkMat);
                cone.position.set(sx * (pd.x + 0.36), -0.38 + dihY, -(0.22 - pd.len / 2 - pd.rad * 1.75));
                cone.rotation.x = -Math.PI / 2;
                drone.add(cone);
            }
        }

        // ── 7. V-TAIL FINS (standard V, opening upward) ────────────────────
        // Each fin: root at fuselage tail, extending UP and OUT.
        // Angle from vertical: 38° → rotation.z = ±38°
        const finSpan   = 1.35;
        const finGeo = makeVerticalFin(finSpan, 0.08, -0.70, 0.04, -0.38, 0.06);

        const vtailZ = -2.75;
        const vtailAngle = 38 * (Math.PI / 180);

        const finGroupR = new THREE.Group();
        const finMeshR = new THREE.Mesh(finGeo, bodyMat);
        finMeshR.castShadow = true;
        finGroupR.add(finMeshR);
        finGroupR.position.set(0, 0, vtailZ);
        finGroupR.rotation.z = -vtailAngle; // tip goes right+up
        drone.add(finGroupR);

        const finGroupL = new THREE.Group();
        const finMeshL = new THREE.Mesh(finGeo, bodyMat);
        finMeshL.castShadow = true;
        finGroupL.add(finMeshL);
        finGroupL.position.set(0, 0, vtailZ);
        finGroupL.rotation.z = +vtailAngle; // tip goes left+up
        drone.add(finGroupL);

        // ── 8. ENGINE EXHAUST ───────────────────────────────────────────────
        const exhGeo = new THREE.CylinderGeometry(0.13, 0.09, 0.28, 18);
        const exhaust = new THREE.Mesh(exhGeo, blackMat);
        exhaust.position.set(0, 0, -3.52);
        exhaust.rotation.x = Math.PI / 2;
        drone.add(exhaust);

        const exhCapGeo = new THREE.CircleGeometry(0.10, 18);
        const exhCap = new THREE.Mesh(exhCapGeo, exhaustMat);
        exhCap.position.set(0, 0, -3.65);
        drone.add(exhCap);

        // Heat shimmer glow
        const exhGlowGeo = new THREE.CircleGeometry(0.22, 18);
        const exhGlow = new THREE.Mesh(exhGlowGeo, new THREE.MeshBasicMaterial({
            color: 0xff3300, transparent: true, opacity: 0.18,
        }));
        exhGlow.position.set(0, 0, -3.68);
        drone.add(exhGlow);

        // ── 9. NAVIGATION LIGHTS ────────────────────────────────────────────
        // Wingtips (accounting for dihedral)
        const tipDihY = wingDihedral;
        const navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), ledGreen);
        navGreen.position.set(7.86, tipDihY + 0.0, -0.04);
        drone.add(navGreen);

        const navRed = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), ledRed);
        navRed.position.set(-7.86, tipDihY + 0.0, -0.04);
        drone.add(navRed);

        // Tail beacon
        const tailBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), ledWhite);
        tailBeacon.position.set(0, 0.15, -3.58);
        drone.add(tailBeacon);

        // ── 10. STATUS STRIP (dorsal) ───────────────────────────────────────
        const stripGeo = new THREE.BoxGeometry(0.038, 0.018, 1.4);
        const strip = new THREE.Mesh(stripGeo, accentMat);
        strip.position.set(0, 0.44, 0.4);
        drone.add(strip);

        // Small antenna mast at tail
        const antGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.38, 8);
        const ant = new THREE.Mesh(antGeo, darkMat);
        ant.position.set(0, 0.35, -2.2);
        drone.add(ant);

        // ── 11. TACTICAL GRID + RINGS ───────────────────────────────────────
        const grid = new THREE.GridHelper(22, 32, 0x3b82f6, 0x1b2838);
        grid.position.y = -2.2;
        scene.add(grid);

        const mkRing = (r1: number, r2: number, col: number, op: number) => {
            const m = new THREE.Mesh(
                new THREE.RingGeometry(r1, r2, 64).rotateX(-Math.PI / 2),
                new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.DoubleSide })
            );
            m.position.y = -2.19;
            scene.add(m);
        };
        mkRing(4.0,  4.04, 0xc6ff3d, 0.28);
        mkRing(7.5,  7.54, 0x3b82f6, 0.18);
        mkRing(10.5, 10.53, 0x3b82f6, 0.10);

        // ── ANIMATION LOOP ───────────────────────────────────────────────────
        let animId: number;
        const clock = new THREE.Clock();
        let strobeTimer = 0;
        let exhaustFlicker = 0;

        const animate = () => {
            animId = requestAnimationFrame(animate);
            const delta = clock.getDelta();

            if (autoRotateRef.current && !isDraggingRef.current) {
                sphericalRef.current.theta += delta * 0.32;
            }

            const { radius, theta, phi } = sphericalRef.current;
            const cx = targetRef.current.x + radius * Math.sin(phi) * Math.sin(theta);
            const cy = targetRef.current.y + radius * Math.cos(phi);
            const cz = targetRef.current.z + radius * Math.sin(phi) * Math.cos(theta);
            camera.position.set(cx, cy, cz);
            camera.lookAt(targetRef.current);

            // Strobe beacon
            strobeTimer += delta;
            if (strobeLightRef.current) {
                if (strobeTimer > 1.3) {
                    strobeLightRef.current.intensity = 4.0;
                    if (strobeTimer > 1.45) { strobeLightRef.current.intensity = 0; strobeTimer = 0; }
                }
            }

            // Exhaust flicker
            exhaustFlicker += delta * 8;
            if (exhGlow.material instanceof THREE.MeshBasicMaterial) {
                exhGlow.material.opacity = 0.10 + 0.12 * Math.abs(Math.sin(exhaustFlicker));
            }

            const degYaw = THREE.MathUtils.radToDeg(sphericalRef.current.theta) % 360;
            setHudData({ yaw: Math.round((degYaw + 360) % 360), distance: Math.round(radius * 10) / 10 });

            renderer.render(scene, camera);
        };
        animate();

        // Resize observer
        const resizeObs = new ResizeObserver(() => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (!w || !h) return;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        });
        resizeObs.observe(container);

        return () => {
            cancelAnimationFrame(animId);
            resizeObs.disconnect();
            if (renderer.domElement && container.contains(renderer.domElement))
                container.removeChild(renderer.domElement);
            renderer.dispose();
            scene.clear();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run once; autoRotate is controlled via ref

    // ── Pointer handlers ─────────────────────────────────────────────────────
    const handlePointerDown = (e: React.PointerEvent) => {
        isDraggingRef.current = true;
        dragModeRef.current = e.button === 2 ? "pan" : "rotate";
        prevPtrRef.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;
        const dx = e.clientX - prevPtrRef.current.x;
        const dy = e.clientY - prevPtrRef.current.y;
        prevPtrRef.current = { x: e.clientX, y: e.clientY };
        if (dragModeRef.current === "rotate") {
            sphericalRef.current.theta -= dx * 0.008;
            sphericalRef.current.phi = Math.max(0.06, Math.min(Math.PI / 2 + 0.42, sphericalRef.current.phi - dy * 0.008));
        } else {
            const f = 0.004 * sphericalRef.current.radius;
            targetRef.current.x -= dx * f;
            targetRef.current.y += dy * f;
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDraggingRef.current = false;
        try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        sphericalRef.current.radius = Math.max(2.0, Math.min(22, sphericalRef.current.radius + e.deltaY * 0.005));
    };

    // ── JSX ──────────────────────────────────────────────────────────────────
    return (
        <div
            style={{
                width: "100%",
                height: typeof height === "number" ? `${height}px` : height,
                position: "relative",
                background: "radial-gradient(ellipse at center, #111820 0%, #06080c 100%)",
                borderRadius: 8,
                overflow: "hidden",
                userSelect: "none",
                touchAction: "none",
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Three.js canvas */}
            <div
                ref={mountRef}
                style={{ width: "100%", height: "100%", cursor: isDraggingRef.current ? "grabbing" : "grab" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
            />

            {/* Targeting reticle */}
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none", opacity: 0.18 }}>
                <div style={{ width: 46, height: 46, border: "1px dashed #C6FF3D", borderRadius: "50%" }} />
                <div style={{ position: "absolute", top: "50%", left: -8,  width: 62, height: 1, background: "#C6FF3D", transform: "translateY(-50%)" }} />
                <div style={{ position: "absolute", left: "50%", top: -8, width: 1, height: 62, background: "#C6FF3D", transform: "translateX(-50%)" }} />
            </div>

            {/* ── TOP BAR ── */}
            <div style={{ position: "absolute", top: 10, left: 12, zIndex: 10, display: "flex", alignItems: "center", gap: 8, pointerEvents: "none" }}>
                <div style={{ background: "rgba(8,13,20,0.88)", border: "1px solid rgba(198,255,61,0.32)", borderRadius: 4, padding: "4px 10px", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C6FF3D", boxShadow: "0 0 8px #C6FF3D", flexShrink: 0 }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: 1.4 }}>
                        RQ-4 GLOBAL HAWK · DIGITAL TWIN
                    </span>
                    <span style={{ fontSize: 9, color: "#666" }}>|</span>
                    <span style={{ fontSize: 9, color: "#C6FF3D", letterSpacing: 1 }}>LIVE 3D</span>
                </div>
            </div>

            {/* ── TOP-RIGHT CONTROLS ── */}
            <div style={{ position: "absolute", top: 10, right: 12, zIndex: 10, display: "flex", gap: 6 }}>
                {/* Auto-rotate */}
                <button onClick={() => setAutoRotate(a => !a)} title="Toggle Auto Rotation"
                    style={{ background: autoRotate ? "rgba(198,255,61,0.18)" : "rgba(12,18,26,0.85)", border: `1px solid ${autoRotate ? "rgba(198,255,61,0.5)" : "#2c2c2c"}`, color: autoRotate ? "#C6FF3D" : "#777", padding: "4px 8px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, backdropFilter: "blur(6px)", letterSpacing: 1 }}>
                    <RotateCw size={11} style={{ animation: autoRotate ? "drone3d-spin 1.4s linear infinite" : "none" }} />
                    <span>{autoRotate ? "AUTO" : "MANUAL"}</span>
                </button>

                {/* Reset */}
                <button onClick={resetView} title="Reset View"
                    style={{ background: "rgba(12,18,26,0.85)", border: "1px solid #2c2c2c", color: "#bbb", padding: "4px 8px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, backdropFilter: "blur(6px)" }}>
                    <RotateCcw size={11} />
                    <span>RESET</span>
                </button>

                {/* Display mode */}
                <div style={{ background: "rgba(12,18,26,0.88)", border: "1px solid #2c2c2c", borderRadius: 4, display: "flex", overflow: "hidden", backdropFilter: "blur(6px)" }}>
                    {(["TACTICAL", "WIREFRAME", "THERMAL"] as DisplayMode[]).map((mode, i) => (
                        <button key={mode} onClick={() => setDisplayMode(mode)}
                            style={{ background: displayMode === mode ? "rgba(59,130,246,0.25)" : "transparent", color: displayMode === mode ? "#60a5fa" : "#666", border: "none", borderRight: i < 2 ? "1px solid #222" : "none", padding: "4px 7px", fontSize: 9, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", fontWeight: displayMode === mode ? 600 : 400 }}>
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── VIEW PRESETS (right side) ── */}
            <div style={{ position: "absolute", top: 48, right: 12, zIndex: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                    { p: "PERSPECTIVE" as ViewPreset, icon: <Layers size={9} /> },
                    { p: "TOP"         as ViewPreset, icon: <Eye size={9} /> },
                    { p: "FRONT"       as ViewPreset, icon: <Crosshair size={9} /> },
                    { p: "SIDE"        as ViewPreset, icon: <Radio size={9} /> },
                    { p: "REAR"        as ViewPreset, icon: <ShieldAlert size={9} /> },
                ].map(({ p, icon }) => (
                    <button key={p} onClick={() => applyViewPreset(p)}
                        style={{ background: viewPreset === p ? "rgba(59,130,246,0.22)" : "rgba(12,18,26,0.85)", border: `1px solid ${viewPreset === p ? "rgba(59,130,246,0.5)" : "#2c2c2c"}`, color: viewPreset === p ? "#60a5fa" : "#555", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 8, backdropFilter: "blur(6px)", letterSpacing: 1, display: "flex", alignItems: "center", gap: 5 }}>
                        {icon}<span>{p}</span>
                    </button>
                ))}
            </div>

            {/* ── HUD – Bottom Left ── */}
            <div style={{ position: "absolute", bottom: 10, left: 12, zIndex: 10, background: "rgba(6,10,18,0.88)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "6px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#9aa", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
                <HudRow icon={<Gauge size={9} />}     label="YAW"  value={`${hudData.yaw}°`}          color="#C6FF3D" />
                <HudRow icon={<Gauge size={9} />}     label="RPM"  value={rpm.toLocaleString()}        color={rpm > 4500 ? "#e8543f" : "#60a5fa"} />
                <HudRow icon={<ShieldAlert size={9} />} label="CHT"  value={`${cht}°C`}              color={cht > 200  ? "#e8543f" : "#aaa"} />
                <HudRow icon={<Radio size={9} />}     label="DIST" value={`${hudData.distance} u`}     color="#a78bfa" />
                {/* RPM bar */}
                <div style={{ marginTop: 2 }}>
                    <div style={{ fontSize: 7, color: "#444", letterSpacing: 1, marginBottom: 2 }}>THROTTLE</div>
                    <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
                        <div style={{ width: `${Math.min((rpm / 5000) * 100, 100)}%`, height: "100%", borderRadius: 2, background: `linear-gradient(90deg, #3b82f6, ${rpm / 5000 > 0.85 ? "#e8543f" : "#C6FF3D"})`, transition: "width 0.6s ease" }} />
                    </div>
                </div>
            </div>

            {/* ── Controls hint ── */}
            <div style={{ position: "absolute", bottom: 10, right: 50, zIndex: 10, pointerEvents: "none" }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.22)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>
                    DRAG · SCROLL · RIGHT-DRAG PAN
                </div>
            </div>


            <style>{`@keyframes drone3d-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

function HudRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#445", flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: 8, color: "#445", letterSpacing: 1, minWidth: 32 }}>{label}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: color || "#fff", letterSpacing: 0.5, marginLeft: "auto" }}>{value}</span>
        </div>
    );
}