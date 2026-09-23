import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
    RotateCw,
    RotateCcw,
    Maximize2,
    Layers,
    Eye,
    Crosshair,
    Radio,
    ShieldAlert,
    Gauge
} from "lucide-react";

interface Drone3DViewerProps {
    rpm?: number;
    throttle?: number;
    vibration?: number;
    cht?: number;
    height?: number | string;
    onSelectPart?: (partName: string) => void;
}

type ViewPreset = "PERSPECTIVE" | "TOP" | "FRONT" | "SIDE" | "GIMBAL";
type DisplayMode = "TACTICAL" | "WIREFRAME" | "THERMAL";

export default function Drone3DViewer({
    rpm = 3400,
    throttle = 45,
    vibration = 0.08,
    cht = 175,
    height = "100%",
    onSelectPart
}: Drone3DViewerProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const droneGroupRef = useRef<THREE.Group | null>(null);
    const rotorsRef = useRef<THREE.Group[]>([]);
    const strobeLightRef = useRef<THREE.PointLight | null>(null);
    const materialsRef = useRef<THREE.Material[]>([]);

    const [autoRotate, setAutoRotate] = useState(false);
    const [displayMode, setDisplayMode] = useState<DisplayMode>("TACTICAL");
    const [viewPreset, setViewPreset] = useState<ViewPreset>("PERSPECTIVE");
    const [inspectedPart, setInspectedPart] = useState<string | null>(null);
    const [hudData, setHudData] = useState({ pitch: 0, roll: 0, yaw: 42, distance: 4.8 });

    // Camera control state
    const isDraggingRef = useRef(false);
    const dragModeRef = useRef<"rotate" | "pan">("rotate");
    const prevPointerRef = useRef({ x: 0, y: 0 });
    const sphericalRef = useRef({
        radius: 4.6,
        theta: Math.PI / 4,
        phi: Math.PI / 3,
    });
    const targetRef = useRef(new THREE.Vector3(0, 0, 0));

    // Dynamic telemetry refs for animation loop
    const telemetryRef = useRef({ rpm, throttle, vibration, cht });
    useEffect(() => {
        telemetryRef.current = { rpm, throttle, vibration, cht };
    }, [rpm, throttle, vibration, cht]);

    // Handle view preset camera updates
    const applyViewPreset = useCallback((preset: ViewPreset) => {
        setViewPreset(preset);
        setAutoRotate(false);
        const radius = 4.8;
        if (preset === "TOP") {
            sphericalRef.current = { radius, theta: 0, phi: 0.05 };
            targetRef.current.set(0, 0, 0);
        } else if (preset === "FRONT") {
            sphericalRef.current = { radius, theta: 0, phi: Math.PI / 2 };
            targetRef.current.set(0, 0, 0);
        } else if (preset === "SIDE") {
            sphericalRef.current = { radius, theta: Math.PI / 2, phi: Math.PI / 2 };
            targetRef.current.set(0, 0, 0);
        } else if (preset === "GIMBAL") {
            sphericalRef.current = { radius: 2.8, theta: 0.1, phi: Math.PI / 2 + 0.1 };
            targetRef.current.set(0, -0.2, 0.6);
        } else {
            // PERSPECTIVE
            sphericalRef.current = { radius: 4.6, theta: Math.PI / 4, phi: Math.PI / 3 };
            targetRef.current.set(0, 0, 0);
        }
    }, []);

    const resetView = () => {
        applyViewPreset("PERSPECTIVE");
        setAutoRotate(true);
    };

    // Toggle display modes (Tactical, Wireframe, Thermal)
    useEffect(() => {
        materialsRef.current.forEach((mat) => {
            if (displayMode === "WIREFRAME") {
                mat.wireframe = true;
                if ("color" in mat && mat instanceof THREE.MeshStandardMaterial) {
                    mat.color.setHex(0x00f0ff);
                    mat.emissive.setHex(0x003344);
                }
            } else if (displayMode === "THERMAL") {
                mat.wireframe = false;
                if ("color" in mat && mat instanceof THREE.MeshStandardMaterial) {
                    const heat = Math.min(Math.max((telemetryRef.current.cht - 120) / 100, 0), 1);
                    const color = new THREE.Color().setHSL(0.66 - heat * 0.66, 1.0, 0.45);
                    mat.color.copy(color);
                    mat.emissive.copy(color.clone().multiplyScalar(0.4));
                }
            } else {
                // TACTICAL
                mat.wireframe = false;
                if ("color" in mat && mat instanceof THREE.MeshStandardMaterial && mat.userData.originalColor) {
                    mat.color.copy(mat.userData.originalColor);
                    mat.emissive.copy(mat.userData.originalEmissive || new THREE.Color(0x000000));
                }
            }
        });
    }, [displayMode]);

    // Setup Three.js scene
    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        const width = container.clientWidth || 600;
        const heightVal = container.clientHeight || 320;

        // SCENE
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.fog = new THREE.FogExp2(0x07080a, 0.08);

        // CAMERA
        const camera = new THREE.PerspectiveCamera(45, width / heightVal, 0.1, 100);
        cameraRef.current = camera;

        // RENDERER
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
        });
        renderer.setSize(width, heightVal);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        rendererRef.current = renderer;
        container.appendChild(renderer.domElement);

        // LIGHTS
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
        keyLight.position.set(5, 8, 6);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        keyLight.shadow.bias = -0.001;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x3b82f6, 1.2);
        fillLight.position.set(-6, -2, -4);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xc6ff3d, 1.5);
        rimLight.position.set(0, -5, -4);
        scene.add(rimLight);

        const strobeLight = new THREE.PointLight(0xffffff, 0, 10);
        strobeLight.position.set(0, -0.4, 0);
        scene.add(strobeLight);
        strobeLightRef.current = strobeLight;

        // HELPER TO TRACK MATERIALS
        const registerMaterial = <T extends THREE.Material>(mat: T): T => {
            if ("color" in mat && mat instanceof THREE.MeshStandardMaterial) {
                mat.userData.originalColor = mat.color.clone();
                mat.userData.originalEmissive = mat.emissive.clone();
            }
            materialsRef.current.push(mat);
            return mat;
        };

        // --- MATERIALS ---
        const carbonMaterial = registerMaterial(new THREE.MeshStandardMaterial({
            color: 0x181a1c,
            roughness: 0.35,
            metalness: 0.85,
        }));

        const darkMetalMaterial = registerMaterial(new THREE.MeshStandardMaterial({
            color: 0x24282c,
            roughness: 0.25,
            metalness: 0.95,
        }));

        const titaniumMaterial = registerMaterial(new THREE.MeshStandardMaterial({
            color: 0x485159,
            roughness: 0.2,
            metalness: 0.9,
        }));

        const accentLimeMaterial = registerMaterial(new THREE.MeshStandardMaterial({
            color: 0xc6ff3d,
            roughness: 0.3,
            metalness: 0.4,
            emissive: 0x4b7806,
            emissiveIntensity: 0.4,
        }));

        const motorAnodizedMaterial = registerMaterial(new THREE.MeshStandardMaterial({
            color: 0x0f1113,
            roughness: 0.15,
            metalness: 0.98,
        }));

        const rotorBladeMaterial = registerMaterial(new THREE.MeshStandardMaterial({
            color: 0x1f2326,
            roughness: 0.3,
            metalness: 0.7,
            transparent: true,
            opacity: 0.85,
        }));

        const cameraLensGlass = registerMaterial(new THREE.MeshPhysicalMaterial({
            color: 0x050d1a,
            roughness: 0.05,
            metalness: 0.1,
            transmission: 0.9,
            transparent: true,
            opacity: 1,
            reflectivity: 0.9,
        }));

        const ledRedMaterial = registerMaterial(new THREE.MeshStandardMaterial({
            color: 0xff2222,
            emissive: 0xff0000,
            emissiveIntensity: 3.5,
            roughness: 0.1,
        }));

        const ledGreenMaterial = registerMaterial(new THREE.MeshStandardMaterial({
            color: 0x22ff55,
            emissive: 0x00ff44,
            emissiveIntensity: 3.5,
            roughness: 0.1,
        }));

        const ledCyanMaterial = registerMaterial(new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x00e1ff,
            emissiveIntensity: 3.0,
            roughness: 0.1,
        }));

        // --- DRONE MESH ASSEMBLY ---
        const droneGroup = new THREE.Group();
        droneGroupRef.current = droneGroup;
        scene.add(droneGroup);

        // 1. Central Fuselage (Aerodynamic Monocoque Body)
        const fuselageGroup = new THREE.Group();
        droneGroup.add(fuselageGroup);

        // Lower Hull
        const lowerHullGeom = new THREE.CylinderGeometry(0.55, 0.42, 0.28, 8);
        lowerHullGeom.scale(1, 1, 1.45);
        const lowerHull = new THREE.Mesh(lowerHullGeom, carbonMaterial);
        lowerHull.castShadow = true;
        lowerHull.receiveShadow = true;
        fuselageGroup.add(lowerHull);

        // Upper Canopy Cowling
        const canopyGeom = new THREE.CylinderGeometry(0.35, 0.54, 0.22, 8);
        canopyGeom.scale(1, 1, 1.35);
        const canopy = new THREE.Mesh(canopyGeom, darkMetalMaterial);
        canopy.position.y = 0.22;
        canopy.castShadow = true;
        fuselageGroup.add(canopy);

        // Top Avionics Deck & Intake Fin
        const finGeom = new THREE.BoxGeometry(0.18, 0.12, 0.85);
        const fin = new THREE.Mesh(finGeom, titaniumMaterial);
        fin.position.set(0, 0.36, -0.05);
        fuselageGroup.add(fin);

        // Status LED strip on dorsal fin
        const dorsalLedGeom = new THREE.BoxGeometry(0.04, 0.03, 0.6);
        const dorsalLed = new THREE.Mesh(dorsalLedGeom, ledCyanMaterial);
        dorsalLed.position.set(0, 0.42, -0.05);
        fuselageGroup.add(dorsalLed);

        // Dual GNSS / GPS Masts
        [-0.15, 0.15].forEach((xOffset) => {
            const mastGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8);
            const mast = new THREE.Mesh(mastGeom, titaniumMaterial);
            mast.position.set(xOffset, 0.45, -0.42);
            fuselageGroup.add(mast);

            const domeGeom = new THREE.CylinderGeometry(0.06, 0.05, 0.04, 12);
            const dome = new THREE.Mesh(domeGeom, accentLimeMaterial);
            dome.position.set(xOffset, 0.62, -0.42);
            fuselageGroup.add(dome);
        });

        // 2. Front 3-Axis Gimbal Sensor & Optical Pod
        const gimbalGroup = new THREE.Group();
        gimbalGroup.position.set(0, -0.15, 0.72);
        droneGroup.add(gimbalGroup);

        const gimbalYokeGeom = new THREE.TorusGeometry(0.18, 0.03, 8, 24, Math.PI);
        const gimbalYoke = new THREE.Mesh(gimbalYokeGeom, titaniumMaterial);
        gimbalYoke.rotation.x = Math.PI / 2;
        gimbalGroup.add(gimbalYoke);

        const cameraSphereGeom = new THREE.SphereGeometry(0.16, 20, 20);
        const cameraSphere = new THREE.Mesh(cameraSphereGeom, darkMetalMaterial);
        gimbalGroup.add(cameraSphere);

        const lensBarrelGeom = new THREE.CylinderGeometry(0.09, 0.11, 0.08, 18);
        const lensBarrel = new THREE.Mesh(lensBarrelGeom, motorAnodizedMaterial);
        lensBarrel.rotation.x = Math.PI / 2;
        lensBarrel.position.set(0, 0, 0.12);
        gimbalGroup.add(lensBarrel);

        const glassLensGeom = new THREE.CircleGeometry(0.08, 18);
        const glassLens = new THREE.Mesh(glassLensGeom, cameraLensGlass);
        glassLens.position.set(0, 0, 0.165);
        gimbalGroup.add(glassLens);

        // Gimbal LiDAR / Laser emitter
        const laserGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 12);
        const laser = new THREE.Mesh(laserGeom, ledCyanMaterial);
        laser.rotation.x = Math.PI / 2;
        laser.position.set(0.06, 0.06, 0.14);
        gimbalGroup.add(laser);

        // 3. Carbon Fiber Arms (Quadcopter X-Config) & Brushless Motors
        const armAngles = [
            Math.PI * 0.25,   // Front Right
            Math.PI * 0.75,   // Rear Right
            Math.PI * 1.25,   // Rear Left
            Math.PI * 1.75    // Front Left
        ];
        const armLength = 1.65;
        const rotors: THREE.Group[] = [];

        armAngles.forEach((angle, idx) => {
            const armGroup = new THREE.Group();
            armGroup.rotation.y = angle;
            droneGroup.add(armGroup);

            // Carbon Tube
            const tubeGeom = new THREE.CylinderGeometry(0.045, 0.05, armLength, 12);
            tubeGeom.rotateZ(Math.PI / 2);
            const tube = new THREE.Mesh(tubeGeom, carbonMaterial);
            tube.position.x = armLength / 2;
            tube.castShadow = true;
            armGroup.add(tube);

            // Reinforcement Brace / Truss
            const braceGeom = new THREE.CylinderGeometry(0.02, 0.02, armLength * 0.75, 8);
            braceGeom.rotateZ(Math.PI / 2);
            const brace = new THREE.Mesh(braceGeom, titaniumMaterial);
            brace.position.set(armLength * 0.45, -0.06, 0);
            armGroup.add(brace);

            // Motor Mount Pod
            const podGeom = new THREE.CylinderGeometry(0.14, 0.12, 0.16, 16);
            const pod = new THREE.Mesh(podGeom, darkMetalMaterial);
            pod.position.set(armLength, 0.04, 0);
            pod.castShadow = true;
            armGroup.add(pod);

            // Brushless Outrunner Motor Bell
            const motorGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.15, 16);
            const motor = new THREE.Mesh(motorGeom, motorAnodizedMaterial);
            motor.position.set(armLength, 0.16, 0);
            motor.castShadow = true;
            armGroup.add(motor);

            // Anodized Cooling Flutes / Accents
            const fluteGeom = new THREE.TorusGeometry(0.122, 0.012, 8, 20);
            fluteGeom.rotateX(Math.PI / 2);
            const flute = new THREE.Mesh(fluteGeom, accentLimeMaterial);
            flute.position.set(armLength, 0.16, 0);
            armGroup.add(flute);

            // Propeller Shaft Nut
            const nutGeom = new THREE.ConeGeometry(0.04, 0.07, 12);
            const nut = new THREE.Mesh(nutGeom, titaniumMaterial);
            nut.position.set(armLength, 0.28, 0);
            armGroup.add(nut);

            // Nav Lights on Arm Tips
            const isFront = (idx === 0 || idx === 3);
            const isRight = (idx === 0 || idx === 1);
            let navLightMaterial = ledCyanMaterial;
            if (isFront && isRight) navLightMaterial = ledGreenMaterial;
            else if (isFront && !isRight) navLightMaterial = ledRedMaterial;

            const navLightGeom = new THREE.SphereGeometry(0.04, 10, 10);
            const navLight = new THREE.Mesh(navLightGeom, navLightMaterial);
            navLight.position.set(armLength + 0.12, 0.04, 0);
            armGroup.add(navLight);

            // Rotor Propeller Blade Group
            const rotorGroup = new THREE.Group();
            rotorGroup.position.set(armLength, 0.25, 0);
            armGroup.add(rotorGroup);
            rotors.push(rotorGroup);

            // Dual Aerodynamic Propeller Blades
            [-1, 1].forEach((dir) => {
                const bladeGeom = new THREE.BoxGeometry(0.72, 0.018, 0.11);
                bladeGeom.translate(dir * 0.38, 0, 0);
                const blade = new THREE.Mesh(bladeGeom, rotorBladeMaterial);
                blade.rotation.x = dir * 0.14; // aerodynamic pitch angle
                blade.castShadow = true;
                rotorGroup.add(blade);

                // Colored Winglet / Tip
                const tipGeom = new THREE.BoxGeometry(0.06, 0.02, 0.08);
                tipGeom.translate(dir * 0.74, 0.01, 0);
                const tip = new THREE.Mesh(tipGeom, accentLimeMaterial);
                rotorGroup.add(tip);
            });
        });
        rotorsRef.current = rotors;

        // 4. Landing Gear & Skids
        [-0.45, 0.45].forEach((zSide) => {
            const skidGroup = new THREE.Group();
            skidGroup.position.set(0, -0.25, zSide);
            droneGroup.add(skidGroup);

            // Vertical Shock Struts
            [-0.35, 0.35].forEach((xPos) => {
                const strutGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8);
                strutGeom.rotateZ(0.25 * (xPos > 0 ? -1 : 1));
                const strut = new THREE.Mesh(strutGeom, titaniumMaterial);
                strut.position.set(xPos, -0.15, 0);
                skidGroup.add(strut);
            });

            // Longitudinal Carbon Skid Runner
            const runnerGeom = new THREE.CylinderGeometry(0.03, 0.03, 1.3, 10);
            runnerGeom.rotateZ(Math.PI / 2);
            const runner = new THREE.Mesh(runnerGeom, carbonMaterial);
            runner.position.set(0, -0.36, 0);
            skidGroup.add(runner);

            // Curved Upturned Skid Tips
            [-0.65, 0.65].forEach((endX) => {
                const tipGeom = new THREE.SphereGeometry(0.038, 8, 8);
                const tip = new THREE.Mesh(tipGeom, accentLimeMaterial);
                tip.position.set(endX, -0.34, 0);
                skidGroup.add(tip);
            });
        });

        // 5. Holographic Floor Tactical Grid & Distance Rings
        const gridHelper = new THREE.GridHelper(8, 24, 0x3b82f6, 0x1b2838);
        gridHelper.position.y = -1.2;
        scene.add(gridHelper);

        const ringGeom1 = new THREE.RingGeometry(1.6, 1.63, 64);
        ringGeom1.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xc6ff3d, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
        const ring1 = new THREE.Mesh(ringGeom1, ringMat);
        ring1.position.y = -1.19;
        scene.add(ring1);

        const ringGeom2 = new THREE.RingGeometry(2.8, 2.82, 64);
        ringGeom2.rotateX(-Math.PI / 2);
        const ring2 = new THREE.Mesh(ringGeom2, new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
        ring2.position.y = -1.19;
        scene.add(ring2);

        // --- ANIMATION / RENDER LOOP ---
        let animationFrameId: number;
        let clock = new THREE.Clock();
        let strobeTimer = 0;

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            const delta = clock.getDelta();
            const elapsed = clock.getElapsedTime();

            // Auto-rotation around target
            if (autoRotate && !isDraggingRef.current) {
                sphericalRef.current.theta += delta * 0.45;
            }

            // Convert spherical coords to camera position
            const { radius, theta, phi } = sphericalRef.current;
            const x = targetRef.current.x + radius * Math.sin(phi) * Math.sin(theta);
            const y = targetRef.current.y + radius * Math.cos(phi);
            const z = targetRef.current.z + radius * Math.sin(phi) * Math.cos(theta);

            camera.position.set(x, y, z);
            camera.lookAt(targetRef.current);

            // Spin Rotors based on telemetry RPM & throttle with increased fan speed
            const currentRpm = telemetryRef.current.rpm;
            const spinVelocity = 32 + Math.max(10, (currentRpm / 60) * 1.8);

            rotors.forEach((rotor, idx) => {
                const direction = (idx % 2 === 0) ? 1 : -1;
                rotor.rotation.y += spinVelocity * direction * delta;
            });

            // Drone is completely static (no shaking, no random jitter, no bobbing)
            droneGroup.position.set(0, 0, 0);
            droneGroup.rotation.set(0, 0, 0);

            // Strobe beacon flash
            strobeTimer += delta;
            if (strobeLightRef.current) {
                if (strobeTimer > 1.2) {
                    strobeLightRef.current.intensity = 4.0;
                    if (strobeTimer > 1.32) {
                        strobeTimer = 0;
                        strobeLightRef.current.intensity = 0;
                    }
                }
            }

            // Update live HUD overlay orientation angles
            const degYaw = THREE.MathUtils.radToDeg(sphericalRef.current.theta) % 360;
            setHudData({
                pitch: 0,
                roll: 0,
                yaw: Math.round((degYaw + 360) % 360),
                distance: Math.round(radius * 10) / 10,
            });

            renderer.render(scene, camera);
        };

        animate();

        // RESIZE OBSERVER
        const handleResize = () => {
            if (!container || !renderer || !camera) return;
            const newW = container.clientWidth;
            const newH = container.clientHeight;
            camera.aspect = newW / newH;
            camera.updateProjectionMatrix();
            renderer.setSize(newW, newH);
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);

        // CLEANUP
        return () => {
            cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
            if (renderer.domElement && container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
            renderer.dispose();
            scene.clear();
        };
    }, [autoRotate]);

    // Pointer Interaction Handlers (Orbit / Pan / Zoom)
    const handlePointerDown = (e: React.PointerEvent) => {
        isDraggingRef.current = true;
        dragModeRef.current = e.button === 2 ? "pan" : "rotate";
        prevPointerRef.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;
        const dx = e.clientX - prevPointerRef.current.x;
        const dy = e.clientY - prevPointerRef.current.y;
        prevPointerRef.current = { x: e.clientX, y: e.clientY };

        if (dragModeRef.current === "rotate") {
            sphericalRef.current.theta -= dx * 0.008;
            sphericalRef.current.phi = Math.max(
                0.08,
                Math.min(Math.PI / 2 + 0.35, sphericalRef.current.phi - dy * 0.008)
            );
        } else {
            // Pan
            const panFactor = 0.004 * sphericalRef.current.radius;
            targetRef.current.x -= dx * panFactor;
            targetRef.current.y += dy * panFactor;
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDraggingRef.current = false;
        try {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
            // Ignore capture release errors
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const zoomDelta = e.deltaY * 0.003;
        sphericalRef.current.radius = Math.max(1.8, Math.min(8.5, sphericalRef.current.radius + zoomDelta));
    };

    return (
        <div
            style={{
                width: "100%",
                height: typeof height === "number" ? `${height}px` : height,
                position: "relative",
                background: "radial-gradient(ellipse at center, #121820 0%, #07090c 100%)",
                borderRadius: 8,
                overflow: "hidden",
                userSelect: "none",
                touchAction: "none",
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Three.js Canvas Container */}
            <div
                ref={mountRef}
                style={{ width: "100%", height: "100%", cursor: isDraggingRef.current ? "grabbing" : "grab" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
            />

            {/* Tactical Target Crosshair Reticle in Center */}
            <div
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    pointerEvents: "none",
                    opacity: 0.25,
                }}
            >
                <div style={{ width: 48, height: 48, border: "1px dashed #C6FF3D", borderRadius: "50%" }} />
                <div style={{ position: "absolute", top: "50%", left: -8, width: 64, height: 1, background: "#C6FF3D", transform: "translateY(-50%)" }} />
                <div style={{ position: "absolute", left: "50%", top: -8, width: 1, height: 64, background: "#C6FF3D", transform: "translateX(-50%)" }} />
            </div>

            {/* Top Bar: Title & Telemetry Status */}
            <div
                style={{
                    position: "absolute",
                    top: 10,
                    left: 12,
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    pointerEvents: "none",
                }}
            >
                <div
                    style={{
                        background: "rgba(10, 15, 20, 0.85)",
                        border: "1px solid rgba(198, 255, 61, 0.3)",
                        borderRadius: 4,
                        padding: "4px 8px",
                        backdropFilter: "blur(6px)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C6FF3D", boxShadow: "0 0 8px #C6FF3D" }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>
                        UAV-X4 QUAD DIGITAL TWIN
                    </span>
                    <span style={{ fontSize: 9, color: "#888", fontFamily: "'JetBrains Mono', monospace" }}>|</span>
                    <span style={{ fontSize: 9, color: "#C6FF3D", fontFamily: "'JetBrains Mono', monospace" }}>ACTIVE 3D</span>
                </div>
            </div>

            {/* Top-Right Control Actions */}
            <div
                style={{
                    position: "absolute",
                    top: 10,
                    right: 12,
                    zIndex: 10,
                    display: "flex",
                    gap: 6,
                }}
            >
                {/* Auto Rotate Button */}
                <button
                    onClick={() => setAutoRotate(!autoRotate)}
                    title="Toggle Auto Rotation"
                    style={{
                        background: autoRotate ? "rgba(198,255,61,0.18)" : "rgba(20,25,32,0.8)",
                        border: `1px solid ${autoRotate ? "rgba(198,255,61,0.5)" : "#333"}`,
                        color: autoRotate ? "#C6FF3D" : "#888",
                        padding: "4px 8px",
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        backdropFilter: "blur(6px)",
                    }}
                >
                    <RotateCw size={11} className={autoRotate ? "animate-spin" : ""} />
                    <span>{autoRotate ? "AUTO" : "MANUAL"}</span>
                </button>

                {/* Reset View Button */}
                <button
                    onClick={resetView}
                    title="Reset to Default Perspective"
                    style={{
                        background: "rgba(20,25,32,0.8)",
                        border: "1px solid #333",
                        color: "#bbb",
                        padding: "4px 8px",
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        backdropFilter: "blur(6px)",
                    }}
                >
                    <RotateCcw size={11} />
                    <span>RESET</span>
                </button>

                {/* Mode Selector (Tactical / Wireframe / Thermal) */}
                <div
                    style={{
                        background: "rgba(20,25,32,0.85)",
                        border: "1px solid #333",
                        borderRadius: 4,
                        display: "flex",
                        overflow: "hidden",
                        backdropFilter: "blur(6px)",
                    }}
                >
                    {(["TACTICAL", "WIREFRAME", "THERMAL"] as DisplayMode[]).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setDisplayMode(mode)}
                            style={{
                                background: displayMode === mode ? "rgba(59,130,246,0.25)" : "transparent",
                                color: displayMode === mode ? "#60a5fa" : "#777",
                                border: "none",
                                borderRight: mode !== "THERMAL" ? "1px solid #222" : "none",
                                padding: "4px 7px",
                                fontSize: 9,
                                fontFamily: "'JetBrains Mono', monospace",
                                cursor: "pointer",
                                fontWeight: displayMode === mode ? 600 : 400,
                            }}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bottom-Left: Live Orientation HUD Overlay */}
            <div
                style={{
                    position: "absolute",
                    bottom: 10,
                    left: 12,
                    zIndex: 10,
                    background: "rgba(10, 15, 22, 0.85)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 4,
                    padding: "4px 10px",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: "#bbb",
                    backdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <Crosshair size={12} color="#C6FF3D" />
                <span>PITCH:<strong style={{ color: "#fff" }}>{hudData.pitch}°</strong></span>
                <span>ROLL:<strong style={{ color: "#fff" }}>{hudData.roll}°</strong></span>
                <span>YAW:<strong style={{ color: "#C6FF3D" }}>{hudData.yaw}°</strong></span>
                <span style={{ color: "#555" }}>|</span>
                <span>DIST:<strong style={{ color: "#3b82f6" }}>{hudData.distance}m</strong></span>
                <span style={{ color: "#555" }}>|</span>
                <span>RPM:<strong style={{ color: "#eab308" }}>{rpm}</strong></span>
            </div>

            {/* Bottom-Right: Camera View Presets */}
            <div
                style={{
                    position: "absolute",
                    bottom: 10,
                    right: 12,
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                }}
            >
                {(["PERSPECTIVE", "TOP", "FRONT", "SIDE", "GIMBAL"] as ViewPreset[]).map((preset) => (
                    <button
                        key={preset}
                        onClick={() => applyViewPreset(preset)}
                        style={{
                            background: viewPreset === preset ? "rgba(198, 255, 61, 0.2)" : "rgba(15, 20, 25, 0.8)",
                            border: `1px solid ${viewPreset === preset ? "#C6FF3D" : "#333"}`,
                            color: viewPreset === preset ? "#C6FF3D" : "#777",
                            padding: "3px 6px",
                            borderRadius: 3,
                            fontSize: 8,
                            fontFamily: "'JetBrains Mono', monospace",
                            cursor: "pointer",
                            backdropFilter: "blur(6px)",
                        }}
                    >
                        {preset}
                    </button>
                ))}
            </div>

            {/* Center Bottom Instruction Hint */}
            <div
                style={{
                    position: "absolute",
                    bottom: 12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    pointerEvents: "none",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                    color: "rgba(255,255,255,0.3)",
                    letterSpacing: 1,
                }}
            >
                LEFT CLICK DRAG: ROTATE • RIGHT CLICK: PAN • SCROLL: ZOOM
            </div>
        </div>
    );
}
