import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// import reportWebVitals from './reportWebVitals';

/**
 * REFERENCES
 *
 * https://developer.chrome.com/docs/web-platform/webgpu/
 * https://web.dev/gpu-compute/
 * https://surma.dev/things/webgpu/
 *
 * */

if ("gpu" in navigator) {
    console.log('WebGPU is supported! 🎉')
} else {
    console.log('WebGPU NOT supported!')
}

(async () => {
    console.log('LOGIC 1')
    if (!("gpu" in navigator)) {
        console.log(
            "WebGPU is not supported. Enable chrome://flags/#enable-unsafe-webgpu flag."
        );
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.log("Failed to get GPU adapter.");
        return;
    }

    const device = await adapter.requestDevice();
    // console.log(device)
    // Buffer Operations
    // https://github.com/gpuweb/gpuweb/blob/main/design/BufferOperations.md

    // Get a GPU buffer in a mapped state and an arrayBuffer for writing.
    const gpuWriteBuffer = device.createBuffer({
        mappedAtCreation: true,
        size: 4,
        usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC
    });
    const arrayBuffer = gpuWriteBuffer.getMappedRange();
    // console.log(arrayBuffer)

    // Write bytes to buffer.
    new Uint8Array(arrayBuffer).set([0, 1, 2, 3]);

    // Unmap buffer so that it can be used later for copy.
    gpuWriteBuffer.unmap();

    // Get a GPU buffer for reading in an unmapped state.
    const gpuReadBuffer = device.createBuffer({
        mappedAtCreation: false,
        size: 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    // console.log(gpuReadBuffer)

    // Encode commands for copying buffer to buffer.
    const copyEncoder = device.createCommandEncoder();
    copyEncoder.copyBufferToBuffer(
        gpuWriteBuffer, // source buffer
        0, // source offset
        gpuReadBuffer, // destination buffer
        0, // destination offset
        4 // size
    );

    // Submit copy commands.
    const copyCommands = copyEncoder.finish();
    device.queue.submit([copyCommands]);

    // Read buffer.
    await gpuReadBuffer.mapAsync(GPUMapMode.READ);
    const copyArrayBuffer = gpuReadBuffer.getMappedRange();

    console.log(new Uint8Array(copyArrayBuffer));
    console.log('END of LOGIC 1 --------')
})(); // */

(async () => {
    console.log('LOGIC 2')
    if (!("gpu" in navigator)) {
        console.log(
            "WebGPU is not supported. Enable chrome://flags/#enable-unsafe-webgpu flag."
        );
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.log("Failed to get GPU adapter.");
        return;
    }
    const device = await adapter.requestDevice();

    // First Matrix

    const firstMatrix = new Float32Array([
        2 /* rows */,
        4 /* columns */,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8
    ]);

    const gpuBufferFirstMatrix = device.createBuffer({
        mappedAtCreation: true,
        size: firstMatrix.byteLength,
        usage: GPUBufferUsage.STORAGE
    });
    const arrayBufferFirstMatrix = gpuBufferFirstMatrix.getMappedRange();
    new Float32Array(arrayBufferFirstMatrix).set(firstMatrix);
    gpuBufferFirstMatrix.unmap();

    // Second Matrix

    const secondMatrix = new Float32Array([
        4 /* rows */,
        2 /* columns */,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8
    ]);

    const gpuBufferSecondMatrix = device.createBuffer({
        mappedAtCreation: true,
        size: secondMatrix.byteLength,
        usage: GPUBufferUsage.STORAGE
    });
    const arrayBufferSecondMatrix = gpuBufferSecondMatrix.getMappedRange();
    new Float32Array(arrayBufferSecondMatrix).set(secondMatrix);
    gpuBufferSecondMatrix.unmap();

    // Result Matrix

    const resultMatrixBufferSize =
        Float32Array.BYTES_PER_ELEMENT * (2 + firstMatrix[0] * secondMatrix[1]);
    const resultMatrixBuffer = device.createBuffer({
        size: resultMatrixBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    // Bind group layout and bind group

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "read-only-storage"
                }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "read-only-storage"
                }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage"
                }
            }
        ]
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: gpuBufferFirstMatrix
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: gpuBufferSecondMatrix
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: resultMatrixBuffer
                }
            }
        ]
    });

    // Compute shader code

    const shaderModule = device.createShaderModule({
        code: `
      struct Matrix {
        size : vec2<f32>,
        numbers: array<f32>,
      }

      @group(0) @binding(0) var<storage, read> firstMatrix : Matrix;
      @group(0) @binding(1) var<storage, read> secondMatrix : Matrix;
      @group(0) @binding(2) var<storage, read_write> resultMatrix : Matrix;

      // @stage(compute) @workgroup_size(8, 8)
      @compute @workgroup_size(8, 8)
      fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
        // Guard against out-of-bounds work group sizes
        if (global_id.x >= u32(firstMatrix.size.x) || global_id.y >= u32(secondMatrix.size.y)) {
          return;
        }

        resultMatrix.size = vec2(firstMatrix.size.x, secondMatrix.size.y);

        let resultCell = vec2(global_id.x, global_id.y);
        var result = 0.0;
        for (var i = 0u; i < u32(firstMatrix.size.y); i = i + 1u) {
          let a = i + resultCell.x * u32(firstMatrix.size.y);
          let b = resultCell.y + i * u32(secondMatrix.size.y);
          result = result + firstMatrix.numbers[a] * secondMatrix.numbers[b];
        }

        let index = resultCell.y + resultCell.x * u32(secondMatrix.size.y);
        resultMatrix.numbers[index] = result;
      }
    `
    });

    // Pipeline setup

    const computePipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        }),
        compute: {
            module: shaderModule,
            entryPoint: "main"
        }
    });

    // Commands submission

    const commandEncoder = device.createCommandEncoder();

    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    const workgroupCountX = Math.ceil(firstMatrix[0] / 8);
    const workgroupCountY = Math.ceil(secondMatrix[1] / 8);
    passEncoder.dispatchWorkgroups(workgroupCountX, workgroupCountY);
    passEncoder.end();

    // Get a GPU buffer for reading in an unmapped state.
    const gpuReadBuffer = device.createBuffer({
        size: resultMatrixBufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // Encode commands for copying buffer to buffer.
    commandEncoder.copyBufferToBuffer(
        resultMatrixBuffer /* source buffer */,
        0 /* source offset */,
        gpuReadBuffer /* destination buffer */,
        0 /* destination offset */,
        resultMatrixBufferSize /* size */
    );

    // Submit GPU commands.
    const gpuCommands = commandEncoder.finish();
    device.queue.submit([gpuCommands]);

    // Read buffer.
    await gpuReadBuffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = gpuReadBuffer.getMappedRange();
    console.log(new Float32Array(arrayBuffer));
    console.log('END of LOGIC 2 --------')
})();


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
