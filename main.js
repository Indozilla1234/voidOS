const Void3CPU = require('./cpu.js');
const TrinaryGPU = require('./gpu.js');
const fs = require('fs');
const path = require('path');
const x11 = require('x11');
const { PNG } = require('pngjs');

// --- 1. HARDWARE ---
const memory = new Int8Array(1594323);
const gpu = new TrinaryGPU();
const cpu = new Void3CPU(memory);

const OPMAP = { 
    "HALT": 0, "ADD": 1, "SUB": 2, "MUL": 3, "SET": 11, "CPY": 12,
    "JMP": 20, "BRN": 21, "BRP": 22, "TRI": 23, "RECT": 30, 
    "WAK": 31, "KEY": 32, "SLP": 45
};

// --- 2. THE SEARCHER (Finds app.png anywhere) ---
function findIconPath(dir, targetFile) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            const found = findIconPath(fullPath, targetFile);
            if (found) return found;
        } else if (file.toLowerCase() === targetFile.toLowerCase()) {
            return fullPath;
        }
    }
    return null;
}

// --- 3. THE VASM COMPILER ---
function compileIconToVasm() {
    const vasmPath = path.join(__dirname, 'main.vasm');
    let iconPath = findIconPath(__dirname, 'app.png');
    
    let vasmContent = `// Compiled from Trit-C\n`;
    vasmContent += `SET 0 -1\nSET 1 -1\nSET 2 0\nSET 3 0\nSET 4 0\nSET 5 243\nSET 6 243\nRECT\n`;

    if (iconPath) {
        console.log(`VOID-3: SUCCESS! Found icon at: ${iconPath}`);
        const data = fs.readFileSync(iconPath);
        const png = PNG.sync.read(data);
        
        for (let y = 0; y < png.height; y++) {
            for (let x = 0; x < png.width; x++) {
                const idx = (png.width * y + x) << 2;
                if (png.data[idx+3] < 128) continue;

                const r = png.data[idx] > 160 ? 13 : (png.data[idx] < 90 ? -13 : 0);
                const g = png.data[idx+1] > 160 ? 13 : (png.data[idx+1] < 90 ? -13 : 0);
                const b = png.data[idx+2] > 160 ? 13 : (png.data[idx+2] < 90 ? -13 : 0);

                vasmContent += `SET 0 ${r}\nSET 1 ${g}\nSET 2 ${b}\nSET 3 ${30 + x}\nSET 4 ${40 + y}\nSET 5 1\nSET 6 1\nRECT\n`;
            }
        }
    } else {
        console.error("VOID-3: CRITICAL - app.png is missing from the entire workspace!");
        vasmContent += `SET 0 13\nSET 1 -13\nSET 2 -13\nSET 3 100\nSET 4 100\nSET 5 20\nSET 6 20\nRECT\n`;
    }

    vasmContent += `HALT\n`;
    fs.writeFileSync(vasmPath, vasmContent);
}

// --- 4. ASSEMBLER ---
function encodeBalanced(ptr, length, value) {
    let temp = BigInt(value);
    for (let i = 0; i < length; i++) {
        let trit = Number(((temp + 1n) % 3n) - 1n);
        memory[ptr + i] = trit;
        temp = (temp - BigInt(trit)) / 3n;
    }
    return ptr + length;
}

function assemble(filename, startAddr) {
    const fullPath = path.join(__dirname, filename);
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
    let ptr = startAddr; 
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
}

// --- 5. RUNTIME ---
compileIconToVasm();
assemble('main.vasm', 531441); 

setInterval(() => {
    if (cpu.halted) {
        cpu.pc = 531441;
        cpu.halted = false;
    }
    // Boosted speed for massive VASM files
    for(let i=0; i<150000 && !cpu.halted; i++) {
        cpu.step(); 
    }
    gpu.render(cpu.memory);
}, 100);

// --- 6. X11 (Non-Blocking) ---
x11.createClient({ display: ':1' }, (err, display) => {
    if (err) return;
    const X = display.client;
    X.on('error', () => {}); // Catch all X11 errors silently
    const root = display.screen[0].root;
    X.ChangeWindowAttributes(root, { eventMask: x11.eventMask.PointerMotion | x11.eventMask.ButtonPress });
    X.on('event', (ev) => {
        if (ev.type === 4) cpu.updateMouse(cpu.mouseX, cpu.mouseY, 1);
        if (ev.type === 5) cpu.updateMouse(cpu.mouseX, cpu.mouseY, 0);
        if (ev.type === 6) cpu.updateMouse(Math.floor((ev.x / 800) * 243), Math.floor((ev.y / 600) * 243), cpu.mouseClicked);
    });
});