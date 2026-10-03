import * as THREE from 'three';
import './style.css';
import { openModelViewer } from './viewer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gallery = document.getElementById('gallery');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const modelCountEl = document.getElementById('modelCount');
const favToggle = document.getElementById('favToggle');

let allModels = [];

let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
let notes = JSON.parse(localStorage.getItem('notes') || '{}');
let showOnlyFavorites = false;

favToggle.onclick = () => {
    showOnlyFavorites = !showOnlyFavorites;
    favToggle.classList.toggle('active');
    renderFilteredModels();
};

createAddTile();
createNotesModal();
loadModels();

async function loadModels() {
    const res = await fetch('/api/models');
    allModels = await res.json();
    renderFilteredModels();
}

function renderFilteredModels() {
    clearGallery();

    const query = searchInput.value.toLowerCase();
    const sort = sortSelect.value;

    let list = allModels.filter(m => {
        if (!m.filename.toLowerCase().includes(query)) return false;
        if (showOnlyFavorites && !favorites.includes(m.filename)) return false;
        return true;
    });

    switch (sort) {
        case 'name-asc':
            list.sort((a, b) => a.filename.localeCompare(b.filename));
            break;
        case 'name-desc':
            list.sort((a, b) => b.filename.localeCompare(a.filename));
            break;
        case 'size-asc':
            list.sort((a, b) => a.size - b.size);
            break;
        case 'size-desc':
            list.sort((a, b) => b.size - a.size);
            break;
        case 'date-asc':
            list.sort((a, b) =>
                new Date(a.uploaded_at) - new Date(b.uploaded_at)
            );
            break;
        case 'date-desc':
        default:
            list.sort((a, b) =>
                new Date(b.uploaded_at) - new Date(a.uploaded_at)
            );
    }

    list.forEach(m => createPreview(`/models/${m.filename}`));
    modelCountEl.textContent = list.length;
}

function clearGallery() {
    [...gallery.children].forEach((el, i) => {
        if (i !== 0) el.remove();
    });
}

function createAddTile() {
    const addTile = document.createElement('div');
    addTile.className = 'gallery-item add-tile';
    addTile.textContent = '+';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb';
    input.style.display = 'none';

    addTile.onclick = () => input.click();

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('model', file);

        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (res.ok) await loadModels();
    };

    gallery.appendChild(addTile);
    document.body.appendChild(input);
}

function createPreview(modelUrl) {
    const container = document.createElement('div');
    container.className = 'gallery-item';

    const fileName = modelUrl.split('/').pop();
    container.style.background =
        localStorage.getItem(`bg-${fileName}`) || '#eeeeee';

    if (favorites.includes(fileName)) {
        container.classList.add('fav');
    }

    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 200;
    container.appendChild(canvas);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '🗑';

    deleteBtn.onclick = async (e) => {
        e.stopPropagation();

        const res = await fetch(`/api/models/${fileName}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            allModels = allModels.filter(m => m.filename !== fileName);
            renderFilteredModels();
        }
    };

    container.appendChild(deleteBtn);

    const star = document.createElement('div');
    star.className = 'star';
    star.textContent = '⭐';
    star.onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(fileName, container);
    };
    container.appendChild(star);

    const label = document.createElement('div');
    label.className = 'model-label';
    label.textContent = fileName;
    container.appendChild(label);

    const notePreview = document.createElement('div');
    notePreview.className = 'note-preview';
    notePreview.textContent = notes[fileName] || 'Click to add note...';
    notePreview.onclick = (e) => {
        e.stopPropagation();
        openNotesModal(fileName);
    };
    container.appendChild(notePreview);
    gallery.insertBefore(container, gallery.children[1]);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true
    });

    renderer.setSize(280, 200);
    renderer.setPixelRatio(window.devicePixelRatio);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(5, 6, 4);
    scene.add(light);

    const loader = new GLTFLoader();
    loader.load(modelUrl, (gltf) => {
        const model = gltf.scene;
        scene.add(model);

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        model.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.z = maxDim * 1.2;
        camera.lookAt(0, 0, 0);

        model.rotation.y = Math.PI / 6;
    });

    (function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    })();

    container.onclick = () => openModelViewer(modelUrl);
}

function toggleFavorite(name, el) {
    if (favorites.includes(name)) {
        favorites = favorites.filter(f => f !== name);
        el.classList.remove('fav');
    } else {
        favorites.push(name);
        el.classList.add('fav');
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

/* ===== NOTES MODAL ===== */

let currentNoteModel = null;

function createNotesModal() {
    const overlay = document.createElement('div');
    overlay.id = 'notesOverlay';
    overlay.innerHTML = `
        <div id="notesModal">
            <button id="closeNotes">×</button>
            <textarea id="notesInput"></textarea>
            <button id="saveNotes">Save</button>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('closeNotes').onclick = closeNotesModal;
    document.getElementById('saveNotes').onclick = saveNotes;
}

function openNotesModal(fileName) {
    currentNoteModel = fileName;
    document.getElementById('notesInput').value = notes[fileName] || '';
    document.getElementById('notesOverlay').style.display = 'flex';
}

function closeNotesModal() {
    document.getElementById('notesOverlay').style.display = 'none';
}

function saveNotes() {
    const text = document.getElementById('notesInput').value;
    notes[currentNoteModel] = text;
    localStorage.setItem('notes', JSON.stringify(notes));
    closeNotesModal();
    renderFilteredModels();
}

searchInput.addEventListener('input', renderFilteredModels);
sortSelect.addEventListener('change', renderFilteredModels);










