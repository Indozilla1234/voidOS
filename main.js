const Void3CPU = require('./cpu.js');
const TrinaryGPU = require('./gpu.js');
const fs = require('fs');
const readline = require('readline');

// --- 1. INITIALIZATION ---
const memory = new Int8Array(1594323); 
const gpu = new TrinaryGPU();
const cpu = new Void3CPU(memory);

const OPMAP = { 
    "HALT": 0, "ADD": 1, "SUB": 2, "MUL": 3, "SET": 11, "CPY": 12,
    "JMP": 20, "BRN": 21, "BRP": 22, "TRI": 23, "RECT": 30, 
    "WAK": 31, "KEY": 32, "SLP": 45
};

// --- 2. THE BALANCED TERNARY ENCODER ---
function encodeBalanced(ptr, length, value) {
    let temp = BigInt(value);
    for (let i = 0; i < length; i++) {
        let trit = Number(((temp + 1n) % 3n) - 1n);
        memory[ptr + i] = trit;
        temp = (temp - BigInt(trit)) / 3n;
    }
    return ptr + length;
}

// --- 3. THE ASSEMBLER ---
function assemble(filename) {
    if (!fs.existsSync(filename)) {
        console.error(`File ${filename} not found.`);
        return;
    }
    const lines = fs.readFileSync(filename, 'utf8').split('\n');
    let ptr = 531441; // Start of execution memory (3^12)

    lines.forEach(line => {
        // Strip comments and trim whitespace
        const cleanLine = line.split('//')[0].trim();
        if (!cleanLine) return;

        const parts = cleanLine.split(/\s+/);
        let opName = parts[0].toUpperCase();
        
        if (OPMAP[opName] !== undefined) {
            let op = OPMAP[opName];
            let v1 = parseInt(parts[1]) || 0;
            let v2 = parseInt(parts[2]) || 0;

            // Encode: 4 trits for OP, 5 trits for ARG1, 6 trits for ARG2 (15 total per line)
            ptr = encodeBalanced(ptr, 4, op);   
            ptr = encodeBalanced(ptr, 5, v1);   
            ptr = encodeBalanced(ptr, 6, v2);   
        }
    });
    console.log("VOID-3: Assembly Complete. System Online.");
}

// --- 4. HARDWARE INPUT BRIDGE ---
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on('keypress', (str, key) => {
    // Exit on Ctrl+C
    if (key && key.ctrl && key.name === 'c') process.exit();
    
    // Keycode detection (Space = 32, otherwise ASCII char code)
    let code = (key && key.name === 'space') ? 32 : (str ? str.charCodeAt(0) : 0);
    
    // Pulse the key state in the CPU
    cpu.updateKey(code, true);
    setTimeout(() => cpu.updateKey(code, false), 150);
});

// Ghost Mouse Simulation (Circular Path)
let angle = 0;
setInterval(() => {
    angle += 0.1;
    const mX = Math.floor(121 + Math.cos(angle) * 60);
    const mY = Math.floor(121 + Math.sin(angle) * 60);
    cpu.updateMouse(mX, mY, 0); 
}, 50);

// --- 5. EXECUTION BOOT ---
assemble('main.vasm');

// Main Render & Logic Loop
setInterval(() => {
    // Refresh temporary drawing registers (T0-T6: R,G,B,X,Y,W,H)
    // This prevents the screen from turning into a smeared mess
    for(let r=0; r<=6; r++) cpu.regs[r] = 0n;
    
    // Reset Program Counter to start of VASM code
    cpu.pc = 531441;
    cpu.halted = false;

    // Run instruction burst
    for(let i=0; i<15000 && !cpu.halted; i++) {
        cpu.step(); 
    }
    
    // Render Framebuffer (First 531,441 trits)
    gpu.render(memory.slice(0, 531441));
}, 100);