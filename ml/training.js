import * as tf from '@tensorflow/tfjs';

export class SortingML {
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
        
        // Майже відсортовані -> Insertion Sort (індекс 1)
        for (let i = 0; i < 100; i++) {
            trainingData.push([15, 0.9, 0, 100, 0.01]);
            trainingLabels.push([0, 1, 0]);
        }
        
        // Випадкові великі масиви -> Quick Sort (індекс 2)
        for (let i = 0; i < 100; i++) {
            trainingData.push([50, 0.3, 0, 1000, 0.05]);
            trainingLabels.push([0, 0, 1]);
        }
        
        // Малі масиви -> Bubble (індекс 0)
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

// Експортуємо також функцію для генерації model.json
export async function saveModel(model, path = './ml/model.json') {
    await model.save(`file://${path}`);
    console.log(`Модель збережено в ${path}`);
}