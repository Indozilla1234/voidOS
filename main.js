const Void3CPU = require('./cpu.js');
const TrinaryGPU = require('./gpu.js');
const fs = require('fs');

const memory = new Int8Array(1594323); 
const gpu = new TrinaryGPU();
const cpu = new Void3CPU(memory);

// SYNCED OPMAP for 50-Trit CPU
const OPMAP = { 
    "HALT": 0, "SET": 11, "LOD": 17, "JMP": 20, "RECT": 30
};

function assemble(filename) {
    if (!fs.existsSync(filename)) return;
    const lines = fs.readFileSync(filename, 'utf8').split('\n');
    let ptr = 531441; // Start of execution memory

    lines.forEach(line => {
        const cleanLine = line.split('//')[0].trim();
        if (!cleanLine) return; // Skip empty lines

        const parts = cleanLine.split(/\s+/);
        let opName = parts[0].toUpperCase();
        if (OPMAP[opName] === undefined) return; // Skip unknown lines/labels

        let op = OPMAP[opName];
        let v1 = parseInt(parts[1]) || 0;
        let v2 = parseInt(parts[2]) || 0;

        // Encode [4: OP][5: ARG1][6: ARG2] = 15 Trits
        let tempOp = op;
        for(let i=0; i<4; i++) { memory[ptr++] = tempOp % 3; tempOp = Math.floor(tempOp / 3); }
        let tempV1 = v1;
        for(let i=0; i<5; i++) { memory[ptr++] = tempV1 % 3; tempV1 = Math.floor(tempV1 / 3); }
        let tempV2 = v2;
        for(let i=0; i<6; i++) { memory[ptr++] = tempV2 % 3; tempV2 = Math.floor(tempV2 / 3); }
    });
    console.log("Assembly Complete. CPU Ready.");
}

// Mouse Input Bridge
let mouseX = 120, mouseY = 120, angle = 0;
setInterval(() => {
    angle += 0.2;
    mouseX = Math.floor(121 + Math.cos(angle) * 60);
    mouseY = Math.floor(121 + Math.sin(angle) * 60);
    cpu.encode(1000000, 15, BigInt(mouseX)); 
    cpu.encode(1000015, 15, BigInt(mouseY));
}, 50);

assemble('os.vasm');

// Main Execution Loop
setInterval(() => {
    for(let i=0; i<5000; i++) cpu.step(); 
    gpu.render(memory.slice(0, 531441));
}, 100);