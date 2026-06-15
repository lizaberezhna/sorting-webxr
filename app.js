import * as THREE from 'three';
import * as tf from '@tensorflow/tfjs';

// ========== WEBXR SETUP ==========
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.FogExp2(0x1a1a2e, 0.008);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);
camera.lookAt(0, 0.5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Освітлення (яскравіше)
const ambientLight = new THREE.AmbientLight(0x88aaff);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(2, 3, 2);
scene.add(directionalLight);
const backLight = new THREE.PointLight(0x4466cc, 0.5);
backLight.position.set(0, 1, -2);
scene.add(backLight);
const fillLight = new THREE.PointLight(0x66cc44, 0.3);
fillLight.position.set(1, 0.5, 1);
scene.add(fillLight);

// Допоміжна сітка
const gridHelper = new THREE.GridHelper(8, 20, 0x888888, 0x444444);
gridHelper.position.y = -0.8;
scene.add(gridHelper);

// Підлога для орієнтації
const floorPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 4),
    new THREE.MeshStandardMaterial({ color: 0x1a1a3a, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
);
floorPlane.rotation.x = -Math.PI / 2;
floorPlane.position.y = -0.78;
scene.add(floorPlane);

// ========== ГЛОБАЛЬНІ ЗМІННІ ==========
let blockMeshes = [];
let mode = 'manual';
let isAnimating = false;
let comparisons = 0;
let swaps = 0;
let startTime = 0;
let currentArray = [8, 3, 6, 1, 9, 2, 7, 4, 5];
let mlModel = null;

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
        document.getElementById('status').textContent = '✅ ML модель готова!';
    }

    createModel() {
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 8, activation: 'relu', inputShape: [4] }));
        model.add(tf.layers.dense({ units: 4, activation: 'relu' }));
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
        
        for (let i = 0; i < 50; i++) {
            trainingData.push([5, 0.5, 0.1, 20]);
            trainingLabels.push([1, 0, 0]);
        }
        for (let i = 0; i < 50; i++) {
            trainingData.push([10, 0.85, 0.05, 50]);
            trainingLabels.push([0, 1, 0]);
        }
        for (let i = 0; i < 50; i++) {
            trainingData.push([15, 0.3, 0.2, 100]);
            trainingLabels.push([0, 0, 1]);
        }
        
        const xs = tf.tensor2d(trainingData);
        const ys = tf.tensor2d(trainingLabels);
        
        await this.model.fit(xs, ys, {
            epochs: 30,
            batchSize: 16,
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
        
        let sortedPairs = 0;
        for (let i = 0; i < n - 1; i++) {
            if (array[i] < array[i + 1]) sortedPairs++;
        }
        const sortedness = n === 1 ? 1 : sortedPairs / (n - 1);
        
        const valueRange = (Math.max(...array) - Math.min(...array)) / n;
        
        const prediction = this.model.predict(tf.tensor2d([[
            n, sortedness, inversionRatio, valueRange
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
    const maxHeight = 1.0;
    const minHeight = 0.2;
    const height = minHeight + (value / 12) * maxHeight;
    const width = 0.5;
    const depth = 0.5;
    
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0x4a90e2,
        metalness: 0.2,
        roughness: 0.3,
        emissive: 0x1a4a7a,
        emissiveIntensity: 0.2
    });
    const cube = new THREE.Mesh(geometry, material);
    
    // Текст
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'Bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(value.toString(), 128, 128);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(value.toString(), 128, 128);
    
    const texture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshStandardMaterial({ map: texture });
    const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), textMaterial);
    textPlane.position.set(0, height / 2 + 0.1, depth / 2 + 0.01);
    cube.add(textPlane);
    
    const spacing = 0.7;
    const totalWidth = (currentArray.length - 1) * spacing;
    const startX = -totalWidth / 2;
    const x = startX + index * spacing;
    cube.position.set(x, height / 2 - 0.5, 0);
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
    const n = 6 + Math.floor(Math.random() * 5);
    const array = Array.from({ length: n }, () => 3 + Math.floor(Math.random() * 10));
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

// ========== HAND TRACKING (МИША) ==========
let draggedBlock = null;
let dragStartX = 0;
let draggedBlockStartX = 0;

function setupHandTracking() {
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
        draggedBlock.position.x = Math.max(-2.5, Math.min(2.5, newX));
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
        } else {
            updateBlocks(currentArray);
            document.getElementById('status').textContent = '✅ Блок повернуто';
        }
        
        draggedBlock.material.emissiveIntensity = 0;
        draggedBlock = null;
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
        requestAnimationFrame(animate);
    }
    animate();
    
    document.getElementById('status').textContent = '✅ Система готова! Клікніть на блок мишею';
    console.log('✅ Всі системи запущено!');
}

init();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});import * as THREE from 'three';
import * as tf from '@tensorflow/tfjs';

// ========== СЦЕНА ==========
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.FogExp2(0x1a1a2e, 0.02);

// КАМЕРА - зміщена назад і вгору
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);
camera.lookAt(0, 0.5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// ========== ОСВІТЛЕННЯ ==========
// Яскраве основне світло
const mainLight = new THREE.DirectionalLight(0xffffff, 1);
mainLight.position.set(2, 3, 2);
scene.add(mainLight);

// Заповнююче світло
const fillLight = new THREE.AmbientLight(0x88aaff);
scene.add(fillLight);

// Світло знизу
const bottomLight = new THREE.PointLight(0x66cc44, 0.5);
bottomLight.position.set(0, -1, 0);
scene.add(bottomLight);

// Світло ззаду
const backLight = new THREE.PointLight(0xffaa66, 0.3);
backLight.position.set(0, 1, -3);
scene.add(backLight);

// Допоміжна сітка (для орієнтації)
const gridHelper = new THREE.GridHelper(8, 20, 0x88aaff, 0x335588);
gridHelper.position.y = -0.8;
scene.add(gridHelper);

// Підлога
const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a3a, transparent: true, opacity: 0.3 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.8;
scene.add(floor);

// ========== ГЛОБАЛЬНІ ЗМІННІ ==========
let blocks = [];
let currentArray = [8, 3, 6, 1, 9, 2, 7, 4, 5];
let isAnimating = false;
let comparisons = 0;
let swaps = 0;
let startTime = 0;
let mode = 'manual';
let mlModel = null;

// ========== СТВОРЕННЯ БЛОКІВ ==========
function createBlock(value, index, isHighlighted = false, isSwapping = false) {
    const maxHeight = 1.0;
    const minHeight = 0.2;
    const height = minHeight + (value / 12) * maxHeight;
    const width = 0.5;
    const depth = 0.5;
    
    const geometry = new THREE.BoxGeometry(width, height, depth);
    
    // Колір блоку
    let color;
    if (isSwapping) color = 0xff4444;
    else if (isHighlighted) color = 0xffaa33;
    else color = 0x4a90e2;
    
    const material = new THREE.MeshStandardMaterial({ 
        color: color,
        metalness: 0.2,
        roughness: 0.3,
        emissive: isHighlighted ? 0x442200 : 0x112233,
        emissiveIntensity: isHighlighted ? 0.3 : 0.1
    });
    
    const cube = new THREE.Mesh(geometry, material);
    
    // Текст
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'Bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(value.toString(), 128, 128);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(value.toString(), 128, 128);
    
    const texture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshStandardMaterial({ map: texture });
    const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), textMaterial);
    textPlane.position.set(0, height / 2 + 0.1, depth / 2 + 0.01);
    cube.add(textPlane);
    
    // Позиція
    const spacing = 0.7;
    const totalWidth = (currentArray.length - 1) * spacing;
    const startX = -totalWidth / 2;
    const x = startX + index * spacing;
    cube.position.set(x, height / 2 - 0.5, 0);
    
    cube.userData = { value, index, originalValue: value };
    
    return cube;
}

function updateAllBlocks(array, highlightIndex = -1, swapIndex1 = -1, swapIndex2 = -1) {
    // Видаляємо старі блоки
    blocks.forEach(block => scene.remove(block));
    blocks = [];
    
    // Створюємо нові
    array.forEach((value, i) => {
        const isHighlight = (i === highlightIndex);
        const isSwap = (i === swapIndex1 || i === swapIndex2);
        const cube = createBlock(value, i, isHighlight, isSwap);
        scene.add(cube);
        blocks.push(cube);
    });
}

// ========== АЛГОРИТМИ ==========
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBubbleSort() {
    const arr = [...currentArray];
    const n = arr.length;
    
    for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < n - i - 1; j++) {
            if (!isAnimating) return false;
            
            comparisons++;
            document.getElementById('comparisons').textContent = comparisons;
            
            // Підсвічуємо порівнювані елементи
            updateAllBlocks(arr, j, j + 1);
            await sleep(300);
            
            if (arr[j] > arr[j + 1]) {
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
                swaps++;
                document.getElementById('swaps').textContent = swaps;
                updateAllBlocks(arr, -1, j, j + 1);
                await sleep(250);
            }
        }
        updateAllBlocks(arr);
        await sleep(100);
    }
    
    currentArray = arr;
    updateAllBlocks(currentArray);
    return true;
}

async function runQuickSort(arr, left, right) {
    if (left >= right) return true;
    if (!isAnimating) return false;
    
    const pivot = arr[right];
    let i = left - 1;
    
    for (let j = left; j < right; j++) {
        if (!isAnimating) return false;
        
        comparisons++;
        document.getElementById('comparisons').textContent = comparisons;
        
        updateAllBlocks(arr, j, right);
        await sleep(250);
        
        if (arr[j] <= pivot) {
            i++;
            [arr[i], arr[j]] = [arr[j], arr[i]];
            swaps++;
            document.getElementById('swaps').textContent = swaps;
            updateAllBlocks(arr, -1, i, j);
            await sleep(200);
        }
    }
    
    [arr[i + 1], arr[right]] = [arr[right], arr[i + 1]];
    swaps++;
    document.getElementById('swaps').textContent = swaps;
    updateAllBlocks(arr, -1, i + 1, right);
    await sleep(250);
    
    await runQuickSort(arr, left, i);
    await runQuickSort(arr, i + 2, right);
    
    return true;
}

async function runInsertionSort() {
    const arr = [...currentArray];
    
    for (let i = 1; i < arr.length; i++) {
        let key = arr[i];
        let j = i - 1;
        
        while (j >= 0 && arr[j] > key) {
            if (!isAnimating) return false;
            
            comparisons++;
            document.getElementById('comparisons').textContent = comparisons;
            
            updateAllBlocks(arr, j, j + 1);
            await sleep(250);
            
            arr[j + 1] = arr[j];
            swaps++;
            document.getElementById('swaps').textContent = swaps;
            updateAllBlocks(arr, -1, j, j + 1);
            await sleep(200);
            j--;
        }
        arr[j + 1] = key;
        updateAllBlocks(arr);
        await sleep(150);
    }
    
    currentArray = arr;
    updateAllBlocks(currentArray);
    return true;
}

// ========== ML ВИБІР ==========
class SortingML {
    constructor() {
        this.model = null;
    }
    
    async init() {
        await tf.ready();
        this.createSimpleModel();
        console.log('✅ ML модель готова');
    }
    
    createSimpleModel() {
        // Спрощена модель для швидкої роботи
        this.model = {
            predict: (features) => {
                const n = features[0];
                const inversionRatio = features[1];
                
                if (n < 6) return 'bubble';
                if (inversionRatio > 0.6) return 'quick';
                return 'insertion';
            }
        };
    }
    
    predictBestAlgorithm(array) {
        const n = array.length;
        let inversions = 0;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (array[i] > array[j]) inversions++;
            }
        }
        const inversionRatio = inversions / (n * (n - 1) / 2);
        
        if (this.model) {
            const result = this.model.predict([n, inversionRatio]);
            document.getElementById('ml-choice').textContent = result;
            return result;
        }
        return 'quick';
    }
}

// ========== ОСНОВНІ ФУНКЦІЇ ==========
async function startAlgorithm(algorithmName) {
    if (isAnimating) return;
    isAnimating = true;
    comparisons = 0;
    swaps = 0;
    startTime = performance.now();
    
    document.getElementById('comparisons').textContent = '0';
    document.getElementById('swaps').textContent = '0';
    document.getElementById('status').textContent = `🏃 Виконується ${algorithmName}...`;
    
    let success = false;
    switch(algorithmName) {
        case 'bubble':
            success = await runBubbleSort();
            break;
        case 'insertion':
            success = await runInsertionSort();
            break;
        case 'quick':
            const arrCopy = [...currentArray];
            success = await runQuickSort(arrCopy, 0, arrCopy.length - 1);
            if (success) currentArray = arrCopy;
            break;
        default:
            success = await runQuickSort([...currentArray], 0, currentArray.length - 1);
    }
    
    const elapsed = (performance.now() - startTime) / 1000;
    document.getElementById('time').textContent = elapsed.toFixed(3);
    
    if (success) {
        updateAllBlocks(currentArray);
        document.getElementById('status').textContent = `✅ Відсортовано! Час: ${elapsed.toFixed(2)}с`;
    }
    
    isAnimating = false;
}

function generateRandomArray() {
    if (isAnimating) return;
    const n = 7 + Math.floor(Math.random() * 4);
    const array = [];
    for (let i = 0; i < n; i++) {
        array.push(3 + Math.floor(Math.random() * 10));
    }
    currentArray = array;
    updateAllBlocks(currentArray);
    comparisons = 0;
    swaps = 0;
    document.getElementById('comparisons').textContent = '0';
    document.getElementById('swaps').textContent = '0';
    document.getElementById('time').textContent = '0.00';
    document.getElementById('ml-choice').textContent = '-';
    document.getElementById('status').textContent = '🔄 Новий масив згенеровано';
}

async function startAutoML() {
    if (isAnimating) return;
    const algorithm = mlModel.predictBestAlgorithm(currentArray);
    await startAlgorithm(algorithm);
}

// ========== HAND TRACKING (МИША) ==========
let draggedBlock = null;
let dragStartX = 0;
let draggedBlockStartX = 0;

function onMouseDown(event) {
    if (mode !== 'manual' || isAnimating) return;
    
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(blocks);
    
    if (intersects.length > 0) {
        draggedBlock = intersects[0].object;
        draggedBlockStartX = draggedBlock.position.x;
        dragStartX = event.clientX;
        draggedBlock.material.emissiveIntensity = 0.5;
        document.getElementById('status').textContent = '✋ Блок захоплено!';
    }
}

function onMouseMove(event) {
    if (!draggedBlock) return;
    
    const deltaX = event.clientX - dragStartX;
    const newX = draggedBlockStartX + deltaX * 0.008;
    draggedBlock.position.x = Math.max(-2.5, Math.min(2.5, newX));
}

function onMouseUp(event) {
    if (!draggedBlock) return;
    
    // Знаходимо найближчу позицію
    let nearestIndex = 0;
    let minDist = Infinity;
    blocks.forEach((block, idx) => {
        const dist = Math.abs(block.position.x - draggedBlock.position.x);
        if (dist < minDist) {
            minDist = dist;
            nearestIndex = idx;
        }
    });
    
    const oldIndex = draggedBlock.userData.index;
    if (oldIndex !== nearestIndex) {
        const temp = currentArray[oldIndex];
        currentArray.splice(oldIndex, 1);
        currentArray.splice(nearestIndex, 0, temp);
        swaps++;
        document.getElementById('swaps').textContent = swaps;
        updateAllBlocks(currentArray);
        document.getElementById('status').textContent = `🔄 Блок переставлено`;
    } else {
        updateAllBlocks(currentArray);
        document.getElementById('status').textContent = '✅ Блок повернуто';
    }
    
    draggedBlock = null;
}

// ========== ПІДКЛЮЧЕННЯ ПОДІЙ ==========
renderer.domElement.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);

// ========== UI ==========
document.getElementById('btn-generate').addEventListener('click', generateRandomArray);
document.getElementById('btn-manual').addEventListener('click', () => {
    mode = 'manual';
    isAnimating = false;
    document.getElementById('status').textContent = '✋ Ручний режим: клікайте на блоки';
});
document.getElementById('btn-auto').addEventListener('click', startAutoML);
document.getElementById('btn-demo').addEventListener('click', () => {
    if (isAnimating) return;
    startAlgorithm('bubble');
});
document.getElementById('btn-stop').addEventListener('click', () => {
    isAnimating = false;
    document.getElementById('status').textContent = '⏹️ Зупинено';
});

// ========== ЗАПУСК ==========
async function init() {
    mlModel = new SortingML();
    await mlModel.init();
    generateRandomArray();
    
    function animate() {
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
    animate();
    
    console.log('✅ Система запущена!');
    document.getElementById('status').textContent = '✅ Готово! Клікніть на блок мишею';
}

init();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
