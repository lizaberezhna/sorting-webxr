import * as THREE from 'three';
import * as tf from '@tensorflow/tfjs';

// ========== WEBXR SETUP ==========
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.FogExp2(0x1a1a2e, 0.008);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 3);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// Освітлення
const ambientLight = new THREE.AmbientLight(0x404060);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 2, 1);
scene.add(directionalLight);
const backLight = new THREE.PointLight(0x4466cc, 0.5);
backLight.position.set(0, 1, -2);
scene.add(backLight);

// Допоміжна сітка
const gridHelper = new THREE.GridHelper(10, 20, 0x888888, 0x444444);
gridHelper.position.y = -0.5;
scene.add(gridHelper);

// ========== ГЛОБАЛЬНІ ЗМІННІ ==========
let blockMeshes = [];
let mode = 'manual';
let isAnimating = false;
let comparisons = 0;
let swaps = 0;
let startTime = 0;
let currentArray = [5, 3, 8, 1, 9, 2, 7, 4, 6, 10];
let mlModel = null;
let selectedBlock = null;

// ========== ML МОДЕЛЬ ==========
class SortingML {
    constructor() {
        this.model = null;
    }

    async init() {
        await tf.ready();
        this.createModel();
        await this.trainMockModel();
        console.log('✅ ML модель готова');
    }

    createModel() {
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [5] }));
        model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 3, activation: 'softmax' }));
        
        model.compile({
            optimizer: tf.train.adam(0.01),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });
        
        this.model = model;
    }

    async trainMockModel() {
        const trainingData = [];
        const trainingLabels = [];
        
        for (let i = 0; i < 100; i++) {
            trainingData.push([15, 0.9, 0, 100, 0.01]);
            trainingLabels.push([0, 1, 0]);
        }
        
        for (let i = 0; i < 100; i++) {
            trainingData.push([50, 0.3, 0, 1000, 0.05]);
            trainingLabels.push([0, 0, 1]);
        }
        
        for (let i = 0; i < 100; i++) {
            trainingData.push([5, 0.5, 0.2, 20, 0.001]);
            trainingLabels.push([1, 0, 0]);
        }
        
        const xs = tf.tensor2d(trainingData);
        const ys = tf.tensor2d(trainingLabels);
        
        await this.model.fit(xs, ys, {
            epochs: 50,
            batchSize: 32,
            verbose: false
        });
        
        xs.dispose();
        ys.dispose();
    }

    predictBestAlgorithm(array) {
        if (!this.model) return 'quick';
        
        const n = array.length;
        let inversions = 0;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (array[i] > array[j]) inversions++;
            }
        }
        const inversionRatio = inversions / (n * (n - 1) / 2);
        
        const hasDuplicates = new Set(array).size !== array.length ? 0.5 : 0;
        const valueRange = (Math.max(...array) - Math.min(...array)) / n;
        
        const prediction = this.model.predict(tf.tensor2d([[
            n,
            inversionRatio,
            hasDuplicates,
            valueRange,
            0.01
        ]]));
        
        const probabilities = prediction.arraySync()[0];
        prediction.dispose();
        
        const algorithms = ['bubble', 'insertion', 'quick'];
        const bestIndex = probabilities.indexOf(Math.max(...probabilities));
        
        return algorithms[bestIndex];
    }
}

// ========== АЛГОРИТМИ СОРТУВАННЯ ==========
class SortingAlgorithms {
    static async* bubbleSort(arr, onCompare, onSwap) {
        const n = arr.length;
        const array = [...arr];
        for (let i = 0; i < n - 1; i++) {
            for (let j = 0; j < n - i - 1; j++) {
                await onCompare(j, j + 1);
                if (array[j] > array[j + 1]) {
                    [array[j], array[j + 1]] = [array[j + 1], array[j]];
                    await onSwap(j, j + 1);
                    yield array;
                }
            }
        }
        return array;
    }

    static async* insertionSort(arr, onCompare, onSwap) {
        const array = [...arr];
        for (let i = 1; i < array.length; i++) {
            let key = array[i];
            let j = i - 1;
            while (j >= 0) {
                await onCompare(j, j + 1);
                if (array[j] > key) {
                    array[j + 1] = array[j];
                    await onSwap(j, j + 1);
                    j--;
                } else {
                    break;
                }
            }
            array[j + 1] = key;
            yield array;
        }
        return array;
    }

    static async* quickSort(arr, left, right, onCompare, onSwap) {
        const array = [...arr];
        
        async function* partition(l, r) {
            const pivot = array[r];
            let i = l - 1;
            for (let j = l; j < r; j++) {
                await onCompare(j, r);
                if (array[j] <= pivot) {
                    i++;
                    [array[i], array[j]] = [array[j], array[i]];
                    await onSwap(i, j);
                    yield;
                }
            }
            [array[i + 1], array[r]] = [array[r], array[i + 1]];
            await onSwap(i + 1, r);
            return i + 1;
        }
        
        async function* quickSortRecursive(l, r) {
            if (l < r) {
                const pi = yield* partition(l, r);
                yield* quickSortRecursive(l, pi - 1);
                yield* quickSortRecursive(pi + 1, r);
            }
        }
        
        yield* quickSortRecursive(left, right);
        return array;
    }
}

// ========== ФУНКЦІЇ ВІЗУАЛІЗАЦІЇ ==========
function createBlock(value, index) {
    const width = 0.4;
    const height = value / 15;
    const depth = 0.4;
    const geometry = new THREE.BoxGeometry(width, Math.max(0.2, height), depth);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0x4a90e2,
        emissive: 0x1a4a7a,
        roughness: 0.3,
        metalness: 0.1
    });
    const cube = new THREE.Mesh(geometry, material);
    
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'Bold 80px Arial';
    ctx.fillText(value.toString(), 30, 80);
    const texture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({ map: texture });
    const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), textMaterial);
    textPlane.position.set(0, height / 2 + 0.05, 0.21);
    cube.add(textPlane);
    
    const x = (index - (currentArray.length - 1) / 2) * 0.6;
    cube.position.set(x, height / 2 - 0.3, 0);
    cube.userData = { value, index, originalValue: value };
    
    return cube;
}

function updateBlocks(array, highlightIndices = [], swapIndices = []) {
    blockMeshes.forEach(mesh => scene.remove(mesh));
    blockMeshes = [];
    
    array.forEach((value, i) => {
        const cube = createBlock(value, i);
        cube.userData.value = value;
        cube.userData.index = i;
        
        if (highlightIndices.includes(i)) {
            cube.material.color.setHex(0xffaa00);
            cube.material.emissive.setHex(0x442200);
        } else if (swapIndices.includes(i)) {
            cube.material.color.setHex(0xff4444);
            cube.material.emissive.setHex(0x442222);
        } else if (isSorted(array)) {
            cube.material.color.setHex(0x44ff44);
            cube.material.emissive.setHex(0x224422);
        } else {
            cube.material.color.setHex(0x4a90e2);
            cube.material.emissive.setHex(0x1a4a7a);
        }
        
        scene.add(cube);
        blockMeshes.push(cube);
    });
}

function isSorted(array) {
    for (let i = 0; i < array.length - 1; i++) {
        if (array[i] > array[i + 1]) return false;
    }
    return true;
}

// ========== ЗАПУСК АЛГОРИТМУ ==========
async function runAlgorithm(algorithmName) {
    if (isAnimating) return;
    isAnimating = true;
    comparisons = 0;
    swaps = 0;
    startTime = performance.now();
    document.getElementById('status').textContent = `🏃 Виконується ${algorithmName}...`;
    
    const onCompare = async (i, j) => {
        comparisons++;
        document.getElementById('comparisons').textContent = comparisons;
        updateBlocks(currentArray, [i, j]);
        await new Promise(resolve => setTimeout(resolve, 200));
    };
    
    const onSwap = async (i, j) => {
        swaps++;
        document.getElementById('swaps').textContent = swaps;
        updateBlocks(currentArray, [], [i, j]);
        await new Promise(resolve => setTimeout(resolve, 200));
    };
    
    let generator;
    switch(algorithmName) {
        case 'bubble':
            generator = SortingAlgorithms.bubbleSort(currentArray, onCompare, onSwap);
            break;
        case 'insertion':
            generator = SortingAlgorithms.insertionSort(currentArray, onCompare, onSwap);
            break;
        case 'quick':
            generator = SortingAlgorithms.quickSort(currentArray, 0, currentArray.length - 1, onCompare, onSwap);
            break;
        default:
            generator = SortingAlgorithms.quickSort(currentArray, 0, currentArray.length - 1, onCompare, onSwap);
    }
    
    for await (const newArray of generator) {
        currentArray = [...newArray];
        updateBlocks(currentArray);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const elapsed = (performance.now() - startTime) / 1000;
    document.getElementById('time').textContent = elapsed.toFixed(3);
    document.getElementById('status').textContent = `✅ Відсортовано! Час: ${elapsed.toFixed(2)}с`;
    isAnimating = false;
    updateBlocks(currentArray);
}

function generateRandomArray() {
    const n = 8 + Math.floor(Math.random() * 5);
    const array = Array.from({ length: n }, () => 3 + Math.floor(Math.random() * 12));
    currentArray = array;
    updateBlocks(currentArray);
    comparisons = 0;
    swaps = 0;
    document.getElementById('comparisons').textContent = '0';
    document.getElementById('swaps').textContent = '0';
    document.getElementById('time').textContent = '0.00';
    document.getElementById('status').textContent = '🔄 Новий масив згенеровано';
}

async function startAutoML() {
    if (isAnimating) return;
    
    document.getElementById('status').textContent = '🧠 ML аналізує масив...';
    const bestAlgorithm = await mlModel.predictBestAlgorithm(currentArray);
    document.getElementById('ml-choice').textContent = bestAlgorithm;
    document.getElementById('status').textContent = `🤖 ML обрав: ${bestAlgorithm}`;
    
    setTimeout(() => {
        runAlgorithm(bestAlgorithm);
    }, 1000);
}

// ========== HAND TRACKING ЕМУЛЯЦІЯ (МИША) ==========
function setupHandTracking() {
    let draggedBlock = null;
    let dragStartX = 0;
    let draggedBlockStartX = 0;
    
    renderer.domElement.addEventListener('mousedown', (event) => {
        if (mode !== 'manual' || isAnimating) return;
        
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(blockMeshes);
        
        if (intersects.length > 0) {
            draggedBlock = intersects[0].object;
            draggedBlockStartX = draggedBlock.position.x;
            dragStartX = event.clientX;
            draggedBlock.material.emissiveIntensity = 0.5;
            document.getElementById('status').textContent = '✋ Блок захоплено!';
        }
    });
    
    window.addEventListener('mousemove', (event) => {
        if (!draggedBlock) return;
        
        const deltaX = event.clientX - dragStartX;
        const newX = draggedBlockStartX + deltaX * 0.008;
        draggedBlock.position.x = Math.max(-3, Math.min(3, newX));
    });
    
    window.addEventListener('mouseup', () => {
        if (!draggedBlock) return;
        
        let nearestIndex = 0;
        let minDist = Infinity;
        blockMeshes.forEach((block, idx) => {
            const dist = Math.abs(block.position.x - draggedBlock.position.x);
            if (dist < minDist) {
                minDist = dist;
                nearestIndex = idx;
            }
        });
        
        const oldIndex = draggedBlock.userData.index;
        if (oldIndex !== nearestIndex && nearestIndex < currentArray.length) {
            const temp = currentArray[oldIndex];
            currentArray.splice(oldIndex, 1);
            currentArray.splice(nearestIndex, 0, temp);
            swaps++;
            document.getElementById('swaps').textContent = swaps;
            updateBlocks(currentArray);
            document.getElementById('status').textContent = '🔄 Блок переставлено!';
        }
        
        draggedBlock.material.emissiveIntensity = 0;
        draggedBlock = null;
        updateBlocks(currentArray);
    });
}

// ========== UI КНОПКИ ==========
document.getElementById('btn-generate').addEventListener('click', () => {
    if (isAnimating) return;
    generateRandomArray();
    mode = 'manual';
    document.getElementById('ml-choice').textContent = '-';
    document.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btn-manual').classList.add('active');
});

document.getElementById('btn-manual').addEventListener('click', () => {
    mode = 'manual';
    isAnimating = false;
    document.getElementById('status').textContent = '✋ Ручний режим: беріть блоки мишею';
    document.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btn-manual').classList.add('active');
});

document.getElementById('btn-auto').addEventListener('click', () => {
    startAutoML();
    document.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btn-auto').classList.add('active');
});

document.getElementById('btn-demo').addEventListener('click', async () => {
    if (isAnimating) return;
    mode = 'demo';
    document.getElementById('status').textContent = '🎬 Демонстрація: Bubble Sort';
    await runAlgorithm('bubble');
    document.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
});

document.getElementById('btn-stop').addEventListener('click', () => {
    isAnimating = false;
    document.getElementById('status').textContent = '⏹️ Зупинено';
});

// ========== ІНІЦІАЛІЗАЦІЯ ==========
async function init() {
    mlModel = new SortingML();
    await mlModel.init();
    setupHandTracking();
    generateRandomArray();
    
    function animate() {
        renderer.render(scene, camera);
    }
    renderer.setAnimationLoop(animate);
    
    document.getElementById('status').textContent = '✅ Система готова! Клікніть на блок мишею';
    console.log('✅ Всі системи запущено!');
}

init();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
