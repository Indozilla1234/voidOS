const Void3CPU = require('./cpu.js');
const TrinaryGPU = require('./gpu.js');
const fs = require('fs');

const memory = new Int8Array(1594323); 
const gpu = new TrinaryGPU();
const cpu = new Void3CPU(memory);

const OPMAP = { "SLP":0, "ADD":1, "SUB":2, "JMP":5, "CLS":6, "WAK":13, "RECT":15 };

function loadProgram(filename) {
    const code = fs.readFileSync(filename, 'utf8').split('\n');
    let addr = 531441; 

    code.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (!parts[0] || parts[0].startsWith('//')) return;

        let opVal = OPMAP[parts[0]] || 0;
        let v1 = parseInt(parts[1]) || 0;
        let v2 = parseInt(parts[2]) || 0;

        // Write Opcode (3 trits)
        for(let i=0; i<3; i++) memory[addr+i] = Math.floor(opVal / Math.pow(3, i)) % 3;
        // Write Arg 1 (6 trits)
        for(let i=0; i<6; i++) memory[addr+3+i] = Math.floor(v1 / Math.pow(3, i)) % 3;
        // Write Arg 2 (6 trits)
        for(let i=0; i<6; i++) memory[addr+9+i] = Math.floor(v2 / Math.pow(3, i)) % 3;

        addr += 15;
    });
    console.log("VOID-3: Program loaded vertically.");
}

loadProgram('os.vasm');
setInterval(() => {
    for(let i=0; i<2000; i++) cpu.step(); 
    gpu.render(memory.slice(0, 531441));
}, 100);