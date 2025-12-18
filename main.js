const Void3CPU = require('./cpu.js');
const TrinaryGPU = require('./gpu.js');
const fs = require('fs');

// Initialize 1.5M Trit Memory (approx 3^13)
const memory = new Int8Array(1594323); 
const gpu = new TrinaryGPU();
const cpu = new Void3CPU(memory);

// Balanced Ternary Opcode Map (Synced with CPU.js)
const OPMAP = { 
    "SLP": 0,  "HALT": 0,
    "ADD": 1,  "SUB": 2,  "MUL": 3,  "DIV": 4, 
    "MIN": 5,  "MAX": 6,  "TRI": 7,  
    "JMP": 8,  "BRZ": 9,  "BRP": 10, "BRN": 11, 
    "TSL": 12, "TSR": 13, "WAK": 14, 
    "LOD": 15, "STR": 16, "CPY": 17,
    "RECT": 20 
};

/**
 * Packs VASM instructions into Vertical Trinary format
 * Format: 15 Trits per instruction [3: OP][6: ARG1][6: ARG2]
 */
function assemble(filename) {
    if (!fs.existsSync(filename)) {
        console.log(`Waiting for ${filename}...`);
        return;
    }

    const lines = fs.readFileSync(filename, 'utf8').split('\n');
    let ptr = 531441; // Start of execution memory

    lines.forEach(line => {
        const cleanLine = line.split('//')[0].trim(); // Remove comments
        if (!cleanLine) return;

        const parts = cleanLine.split(/\s+/);
        let opName = parts[0].toUpperCase();
        let op = OPMAP[opName] !== undefined ? OPMAP[opName] : 0;
        let v1 = parseInt(parts[1]) || 0;
        let v2 = parseInt(parts[2]) || 0;

        // Write Opcode (3 trits)
        for(let i=0; i<3; i++) memory[ptr++] = Math.floor(op / Math.pow(3, i)) % 3;
        // Write Arg1 (6 trits)
        for(let i=0; i<6; i++) memory[ptr++] = Math.floor(v1 / Math.pow(3, i)) % 3;
        // Write Arg2 (6 trits)
        for(let i=0; i<6; i++) memory[ptr++] = Math.floor(v2 / Math.pow(3, i)) % 3;
    });

    console.log(`Assembly complete. Loaded into memory at ${531441}`);
}

// Initial Boot
assemble('main.vasm');

// Main Execution Loop
setInterval(() => {
    // Execute 10,000 instructions per frame for high performance
    for(let i=0; i<10000; i++) {
        cpu.step(); 
        if (cpu.halted) break;
    }
    
    // Render VRAM (First 531,441 trits)
    gpu.render(memory.slice(0, 531441));
}, 100);