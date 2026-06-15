export class SortingAlgorithms {
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