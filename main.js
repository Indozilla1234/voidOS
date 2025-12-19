const Void3CPU = require('./cpu.js');
const TrinaryGPU = require('./gpu.js');
const fs = require('fs');
const x11 = require('x11');

// --- 1. INITIALIZATION ---
const memory = new Int8Array(1594323); 
const gpu = new TrinaryGPU();
const cpu = new Void3CPU(memory);

const OPMAP = { 
    "HALT": 0, "ADD": 1, "SUB": 2, "MUL": 3, "SET": 11, "CPY": 12,
    "JMP": 20, "BRN": 21, "BRP": 22, "TRI": 23, "RECT": 30, 
    "WAK": 31, "KEY": 32, "SLP": 45
};

// --- 2. X11 HARDWARE BRIDGE ---
// This connects to the DISPLAY=:1 created by your bash script
x11.createClient({ display: ':1' }, (err, display) => {
    if (err) {
        console.error("X11 ERROR: Ensure your bash script is running and DISPLAY is :1");
        return;
    }
    const X = display.client;
    const root = display.screen[0].root;

    // Capture KeyPress (2) and PointerMotion (6) from the X Server
    X.ChangeWindowAttributes(root, { 
        eventMask: x11.eventMask.KeyPress | x11.eventMask.PointerMotion 
    });

    X.on('event', (ev) => {
        if (ev.type === 2) { // KEYBOARD
            // X11 Keycodes are raw hardware codes. 
            // Space is typically 65, Arrows are usually 111 (Up), 116 (Down), 113 (Left), 114 (Right)
            cpu.updateKey(ev.keycode, true);
            setTimeout(() => cpu.updateKey(ev.keycode, false), 70);
        }
        if (ev.type === 6) { // MOUSE
            // ev.x and ev.y are the absolute coordinates on the 800x600 Xvfb screen
            // We scale them down to your 243x243 ternary resolution
            const scaledX = Math.floor((ev.x / 800) * 243);
            const scaledY = Math.floor((ev.y / 600) * 243);
            cpu.updateMouse(scaledX, scaledY, 0);
        }
    });
    console.log("VOID-3: X11 Input Link Established on :1");
});

// --- 3. THE ASSEMBLER & ENCODER ---
function encodeBalanced(ptr, length, value) {
    let temp = BigInt(value);
    for (let i = 0; i < length; i++) {
        let trit = Number(((temp + 1n) % 3n) - 1n);
        memory[ptr + i] = trit;
        temp = (temp - BigInt(trit)) / 3n;
    }
    return ptr + length;
}

function assemble(filename) {
    if (!fs.existsSync(filename)) return;
    const lines = fs.readFileSync(filename, 'utf8').split('\n');
    let ptr = 531441; 
    lines.forEach(line => {
        const clean = line.split('//')[0].trim();
        if (!clean) return;
        const parts = clean.split(/\s+/);
        let op = OPMAP[parts[0].toUpperCase()];
        if (op === undefined) return;
        ptr = encodeBalanced(ptr, 4, op);   
        ptr = encodeBalanced(ptr, 5, parseInt(parts[1]) || 0);   
        ptr = encodeBalanced(ptr, 6, parseInt(parts[2]) || 0);   
    });
    console.log(`VOID-3: VASM Loaded from ${filename}`);
}

// --- 4. EXECUTION LOOP ---
assemble('main.vasm');

setInterval(() => {
    // Reset standard drawing registers
    for(let r=0; r<=6; r++) cpu.regs[r] = 0n;
    cpu.pc = 531441;
    cpu.halted = false;

    // Run the CPU for this frame
    for(let i=0; i<30000 && !cpu.halted; i++) {
        cpu.step(); 
    }
    
    // Push buffer to GPU
    gpu.render(memory.slice(0, 531441));
}, 100);