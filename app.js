import * as THREE from 'three';

export class HandTracker {
    constructor(renderer, camera, blockMeshes, isActiveCallback) {
        this.renderer = renderer;
        this.camera = camera;
        this.blockMeshes = blockMeshes;
        this.isActiveCallback = isActiveCallback;
        this.selectedBlock = null;
        this.isPinching = false;
        this.updateBlocksCallback = null;
        
        this.setupEventListeners();
    }
    
    setUpdateBlocksCallback(callback) {
        this.updateBlocksCallback = callback;
    }
    
    setupEventListeners() {
        // Емуляція для звичайного екрану
        this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('mouseup', () => this.onMouseUp());
        
        // Для реального Hand Tracking в WebXR
        if (navigator.xr) {
            this.setupXRHandTracking();
        }
    }
    
    async setupXRHandTracking() {
        // Це буде працювати в гарнітурі з підтримкою hand tracking
        const session = await navigator.xr.requestSession('immersive-ar', {
            optionalFeatures: ['hand-tracking']
        });
        
        session.addEventListener('selectstart', (event) => {
            if (this.isActiveCallback && this.isActiveCallback()) {
                this.onPinchStart(event);
            }
        });
        
        session.addEventListener('selectend', () => {
            this.onPinchEnd();
        });
    }
    
    onPinchStart(event) {
        this.isPinching = true;
        // Знаходимо найближчий блок до руки
        if (this.blockMeshes && this.blockMeshes.length > 0) {
            // В реальному сценарії визначаємо позицію руки
            this.selectedBlock = this.blockMeshes[0];
            if (this.selectedBlock) {
                this.selectedBlock.material.emissiveIntensity = 0.5;
                document.getElementById('status').textContent = '✋ Блок захоплено!';
            }
        }
    }
    
    onPinchEnd() {
        if (this.selectedBlock && this.updateBlocksCallback) {
            // Оновлюємо позицію в масиві
            const newArray = [...this.blockMeshes.map(b => b.userData.value)];
            this.updateBlocksCallback(newArray);
        }
        this.selectedBlock = null;
        this.isPinching = false;
        document.getElementById('status').textContent = '✅ Блок відпущено';
    }
    
    onMouseDown(event) {
        if (!this.isActiveCallback || !this.isActiveCallback()) return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        const intersects = raycaster.intersectObjects(this.blockMeshes);
        
        if (intersects.length > 0) {
            this.selectedBlock = intersects[0].object;
            this.selectedBlock.material.emissiveIntensity = 0.5;
            document.getElementById('status').textContent = '✋ Блок захоплено!';
        }
    }
    
    onMouseMove(event) {
        if (this.selectedBlock && this.isActiveCallback && this.isActiveCallback()) {
            const rect = this.renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, this.camera);
            const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
            const targetPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(planeZ, targetPoint);
            
            this.selectedBlock.position.x = Math.max(-3, Math.min(3, targetPoint.x));
            this.selectedBlock.position.y = Math.max(-0.5, Math.min(2, targetPoint.y));
        }
    }
    
    onMouseUp() {
        if (this.selectedBlock && this.updateBlocksCallback) {
            // Знаходимо найближчу позицію
            let nearestIndex = 0;
            let minDist = Infinity;
            this.blockMeshes.forEach((block, idx) => {
                const dist = Math.abs(block.position.x - this.selectedBlock.position.x);
                if (dist < minDist) {
                    minDist = dist;
                    nearestIndex = idx;
                }
            });
            
            // Оновлюємо масив
            const oldIndex = this.selectedBlock.userData.index;
            if (oldIndex !== nearestIndex && nearestIndex < this.blockMeshes.length) {
                const currentArray = this.blockMeshes.map(b => b.userData.value);
                const temp = currentArray[oldIndex];
                currentArray.splice(oldIndex, 1);
                currentArray.splice(nearestIndex, 0, temp);
                this.updateBlocksCallback(currentArray);
            }
            
            this.selectedBlock.material.emissiveIntensity = 0;
            this.selectedBlock = null;
            document.getElementById('status').textContent = '✅ Блок відпущено';
        }
    }
    
    updateBlockReferences(blockMeshes) {
        this.blockMeshes = blockMeshes;
    }
}