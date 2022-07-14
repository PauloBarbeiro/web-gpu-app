import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// import reportWebVitals from './reportWebVitals';

if ("gpu" in navigator) {
    console.log('WebGPU is supported! 🎉')
} else {
    console.log('WebGPU NOT supported!')
}

(async () => {
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
    console.log(device)
    // Buffer Operations
    // https://github.com/gpuweb/gpuweb/blob/main/design/BufferOperations.md
    const BufferOperations = {
        MAP_READ: 1,
        MAP_WRITE: 2
    }

    // Get a GPU buffer in a mapped state and an arrayBuffer for writing.
    const gpuWriteBuffer = device.createBuffer({
        mappedAtCreation: true,
        size: 4,
        // usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC
        usage: BufferOperations.MAP_WRITE
    });
    const arrayBuffer = gpuWriteBuffer.getMappedRange();
    console.log(arrayBuffer)

    // Write bytes to buffer.
    new Uint8Array(arrayBuffer).set([0, 1, 2, 3]);

    // Unmap buffer so that it can be used later for copy.
    gpuWriteBuffer.unmap();

    // Get a GPU buffer for reading in an unmapped state.
    const gpuReadBuffer = device.createBuffer({
        mappedAtCreation: false,
        size: 4,
        // usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        usage: BufferOperations.MAP_READ
    });
    console.log(gpuReadBuffer)

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
    // */
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
