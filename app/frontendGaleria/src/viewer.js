import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let animationId = null;

let meshes = [];
let originalMaterials = new Map();
let wireframeOverlays = [];

let mainLight = null;
let isRotatingLight = false;
let lastMouseX = 0;
let lightAngle = Math.PI / 4;
const lightRadius = 6;

let uvCheckerTexture = null;
let modelInfoBox = null;
let currentModelName = null;

const modelViewer = document.getElementById('modelViewer');
const canvas = document.getElementById('viewerCanvas');
const closeBtn = document.getElementById('closeViewer');

export function openModelViewer(modelUrl) {
    closeViewer();

    currentModelName = modelUrl.split('/').pop();
    modelViewer.classList.remove('hidden');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(
        localStorage.getItem(`bg-${currentModelName}`) || '#222222'
    );

    camera = new THREE.PerspectiveCamera(
        60,
        canvas.clientWidth / canvas.clientHeight,
        0.01,
        1000
    );

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true
    });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
    scene.add(mainLight);

    createSidePanel();

    const loader = new GLTFLoader();
    loader.load(modelUrl, (gltf) => {
        const model = gltf.scene;
        scene.add(model);

        meshes = [];
        originalMaterials.clear();

        model.traverse(obj => {
            if (obj.isMesh) {
                meshes.push(obj);
                originalMaterials.set(obj.uuid, obj.material.clone());
                obj.frustumCulled = false;
            }
        });

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        model.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 1.2;

        camera.position.set(0, 0, distance);
        camera.near = distance / 100;
        camera.far = distance * 10;
        camera.updateProjectionMatrix();

        controls.minDistance = camera.near * 2;
        controls.maxDistance = camera.far * 0.9;

        camera.lookAt(0, 0, 0);

        updateLightPosition();
        createModelInfo();
        updateModelInfo(model, currentModelName);
    });

    animate();
}

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2 && e.ctrlKey) {
        isRotatingLight = true;
        lastMouseX = e.clientX;
        controls.enabled = false;
    }
});

window.addEventListener('mouseup', () => {
    isRotatingLight = false;
    controls.enabled = true;
});

window.addEventListener('mousemove', (e) => {
    if (!isRotatingLight || !mainLight) return;

    const dx = e.clientX - lastMouseX;
    lastMouseX = e.clientX;

    lightAngle += dx * 0.01;
    updateLightPosition();
});

function updateLightPosition() {
    mainLight.position.set(
        Math.cos(lightAngle) * lightRadius,
        4,
        Math.sin(lightAngle) * lightRadius
    );
    mainLight.lookAt(0, 0, 0);
}

function createSidePanel() {
    removeSidePanel();

    const panel = document.createElement('div');
    panel.id = 'viewerPanel';

    const bgPicker = document.createElement('input');
    bgPicker.type = 'color';
    bgPicker.id = 'bgColorPicker';
    bgPicker.value = localStorage.getItem(`bg-${currentModelName}`) || '#222222';

    bgPicker.oninput = () => {
        scene.background = new THREE.Color(bgPicker.value);
        localStorage.setItem(`bg-${currentModelName}`, bgPicker.value);
    };

    panel.appendChild(bgPicker);

    addButton(panel, 'Final render', resetAllMaterials);
    addButton(panel, 'Geometry', showGeometryOnly);
    addButton(panel, 'UV Check', applyUVChecker);
    addButton(panel, 'Base Color', showBaseColor);
    addButton(panel, 'AO', showAO);
    addButton(panel, 'Metalness', showMetalness);
    addButton(panel, 'Roughness', showRoughness);
    addButton(panel, 'Normal', showNormals);

    modelViewer.appendChild(panel);
}

function addButton(panel, text, fn) {
    const btn = document.createElement('div');
    btn.className = 'viewer-btn';
    btn.textContent = text;
    btn.onclick = fn;
    panel.appendChild(btn);
}

function resetAllMaterials() {
    clearWireframes();
    meshes.forEach(mesh => {
        const mat = originalMaterials.get(mesh.uuid);
        if (mat) {
            mesh.material = mat.clone();
            mesh.material.needsUpdate = true;
        }
    });
}

function showGeometryOnly() {
    clearWireframes();

    meshes.forEach(mesh => {
        mesh.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0,
            roughness: 1,
            side: THREE.FrontSide
        });

        const wire = new THREE.Mesh(
            mesh.geometry,
            new THREE.MeshBasicMaterial({
                color: 0x000000,
                wireframe: true,
                polygonOffset: true,
                polygonOffsetFactor: -0.5,
                polygonOffsetUnits: -0.5
            })
        );

        mesh.add(wire);
        wireframeOverlays.push(wire);
    });
}

function showBaseColor() {
    clearWireframes();
    meshes.forEach(mesh => {
        const original = originalMaterials.get(mesh.uuid);
        if (original?.map) {
            mesh.material = new THREE.MeshBasicMaterial({
                map: original.map
            });
        }
    });
}

function showAO() {
    clearWireframes();
    meshes.forEach(mesh => {
        const original = originalMaterials.get(mesh.uuid);
        if (!original?.aoMap) return;

        mesh.material = new THREE.MeshBasicMaterial({
            map: original.aoMap
        });
        mesh.material.needsUpdate = true;
    });
}

function showMetalness() {
    clearWireframes();
    meshes.forEach(mesh => {
        const original = originalMaterials.get(mesh.uuid);
        if (!original?.metalnessMap) return;

        mesh.material = new THREE.MeshBasicMaterial({
            map: original.metalnessMap
        });
        mesh.material.needsUpdate = true;
    });
}

function showRoughness() {
    clearWireframes();
    meshes.forEach(mesh => {
        const original = originalMaterials.get(mesh.uuid);
        if (!original?.roughnessMap) return;

        mesh.material = new THREE.MeshBasicMaterial({
            map: original.roughnessMap
        });
        mesh.material.needsUpdate = true;
    });
}

function showNormals() {
    clearWireframes();
    meshes.forEach(mesh => {
        const original = originalMaterials.get(mesh.uuid);
        if (!original?.normalMap) return;

        mesh.material = new THREE.MeshBasicMaterial({
            map: original.normalMap
        });
        mesh.material.needsUpdate = true;
    });
}

function applyUVChecker() {
    clearWireframes();
    const tex = getUVCheckerTexture();

    meshes.forEach(mesh => {
        mesh.material = new THREE.MeshBasicMaterial({
            map: tex
        });
    });
}

function clearWireframes() {
    wireframeOverlays.forEach(w => w.parent?.remove(w));
    wireframeOverlays = [];
}

function getUVCheckerTexture() {
    if (uvCheckerTexture) return uvCheckerTexture;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    const s = size / 8;
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            ctx.fillStyle = (x + y) % 2 ? '#fff' : '#000';
            ctx.fillRect(x * s, y * s, s, s);
        }
    }

    uvCheckerTexture = new THREE.CanvasTexture(canvas);
    uvCheckerTexture.colorSpace = THREE.SRGBColorSpace;
    return uvCheckerTexture;
}

function createModelInfo() {
    removeModelInfo();
    modelInfoBox = document.createElement('div');
    modelInfoBox.id = 'modelInfo';
    modelViewer.appendChild(modelInfoBox);
}

function updateModelInfo(model, name) {
    let meshesCount = 0;
    let vertices = 0;
    let triangles = 0;
    const materials = new Set();

    model.traverse(obj => {
        if (obj.isMesh) {
            meshesCount++;
            const geo = obj.geometry;
            vertices += geo.attributes.position.count;
            triangles += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
            materials.add(obj.material.uuid);
        }
    });

    modelInfoBox.innerHTML = `
        <div><b>Meshes:</b> ${meshesCount}</div>
        <div><b>Materials:</b> ${materials.size}</div>
        <div><b>Vertices:</b> ${vertices.toLocaleString()}</div>
        <div><b>Triangles:</b> ${Math.round(triangles).toLocaleString()}</div>
    `;
}

function removeModelInfo() {
    modelInfoBox?.remove();
    modelInfoBox = null;
}

function animate() {
    animationId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function closeViewer() {
    if (animationId) cancelAnimationFrame(animationId);
    removeModelInfo();
    removeSidePanel();

    renderer?.dispose();
    renderer = scene = camera = controls = null;
    meshes = [];
    originalMaterials.clear();

    modelViewer.classList.add('hidden');
}

function removeSidePanel() {
    document.getElementById('viewerPanel')?.remove();
}

closeBtn.addEventListener('click', closeViewer);








