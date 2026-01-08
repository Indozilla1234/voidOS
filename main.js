const Void3CPU = require('./cpu.js');
const TrinaryGPU = require('./gpu.js');
const fs = require('fs');
const x11 = require('x11');
const { PNG } = require('pngjs');

// --- 1. HARDWARE ---
const memory = new Int8Array(3486784401);
const gpu = new TrinaryGPU();
const cpu = new Void3CPU(memory);

const OPMAP = { 
    "HALT": 0, "ADD": 1, "SUB": 2, "MUL": 3, "SET": 11, "CPY": 12,
    "JMP": 20, "BRN": 21, "BRP": 22, "TRI": 23, "RECT": 30, 
    "WAK": 31, "KEY": 32, "SLP": 45
};

// --- 2. PNG TO VASM COMPILER ---
// Converts apps/paint/app.png into a series of RECT commands
async function compileIconToVasm(pngPath, startX, startY) {
    process.stdout.write("[BOOT] Compiling PNG to High-Density VASM...\n");
    return new Promise((resolve) => {
        if (!fs.existsSync(pngPath)) {
            process.stdout.write(`[-] Error: ${pngPath} not found! Rendering blank UI.\n`);
            resolve(); return;
        }
        fs.createReadStream(pngPath).pipe(new PNG()).on('parsed', function() {
            let v = ["SET 0 0\nSET 1 0\nSET 2 0\nSET 3 0\nSET 4 0\nSET 5 243\nSET 6 243\nRECT"];
            for (let y = 0; y < 50; y++) {
                for (let x = 0; x < 50; x++) {
                    let idx = (this.width * y + x) << 2;
                    let r = Math.round((this.data[idx] / 9.807) - 13);
                    let g = Math.round((this.data[idx+1] / 9.807) - 13);
                    let b = Math.round((this.data[idx+2] / 9.807) - 13);
                    if (r !== -13 || g !== -13 || b !== -13) {
                        v.push(`SET 0 ${r}\nSET 1 ${g}\nSET 2 ${b}\nSET 3 ${startX + x}\nSET 4 ${startY + y}\nSET 5 1\nSET 6 1\nRECT`);
                    }
                }
            }
            v.push("SET 20 531441\nJMP 20");
            fs.writeFileSync('main.vasm', v.join('\n'));
            resolve();
        });
    });
}

// --- 3. SYSTEM UTILS ---
function assemble(filename, startAddr) {
    const code = fs.readFileSync(filename, 'utf8');
    let ptr = startAddr;
    const encode = (p, l, val) => {
        let v = BigInt(val);
        for (let i = 0; i < l; i++) {
            let rem = Number(v % 3n);
            if (rem > 1) rem -= 3; if (rem < -1) rem += 3;
            memory[p + i] = rem;
            v = (v - BigInt(rem)) / 3n;
        }
    };
    code.split('\n').forEach(line => {
        let clean = line.split('//')[0].trim();
        if (!clean) return;
        let parts = clean.split(/\s+/);
        let op = OPMAP[parts[0].toUpperCase()];
        if (op === undefined) return;
        encode(ptr, 4, op); 
        encode(ptr + 4, 5, parseInt(parts[1]) || 0); 
        encode(ptr + 9, 6, parseInt(parts[2]) || 0);
        ptr += 15;
    });
}

// --- 4. KILL SWITCH (Context Switcher) ---
function killAndLaunchPaint() {
    process.stdout.write("\n[!!!] KERNEL INTERRUPT: KILLING MAIN.VASM...\n");
    cpu.halted = true;

    // Clear UI memory to prevent ghost pixels
    for (let i = 0; i < 2000000; i++) memory[i] = 0;

    const paintFile = 'apps/paint/paint.vasm';
    if (fs.existsSync(paintFile)) {
        assemble(paintFile, 531441);
        cpu.regs.fill(0n);
        cpu.pc = 531441;
        cpu.halted = false;
        process.stdout.write("[SYSTEM] PAINT.VASM IS NOW RUNNING\n");
    } else {
        process.stdout.write("[-] FAILED: paint.vasm not found. Resuming launcher.\n");
        cpu.halted = false;
    }
}

// --- 5. FLUXBOX-COMPATIBLE MOUSE LISTENER ---
x11.createClient({ display: ':1' }, (err, display) => {
    if (err) return console.error("X11 Connect Error");
    const X = display.client;
    const root = display.screen[0].root;

    X.on('error', (e) => { 
        if (e.error !== 10) console.log(`[X11 Error] Code: ${e.error}`); 
    });

    // GrabButton params to avoid "Bad Param":
    // (wid, owner_events, mask, pointer_mode, key_mode, confine_to, cursor, button, modifiers)
    const mask = x11.eventMask.ButtonPress | x11.eventMask.PointerMotion;
    X.GrabButton(root, 0, mask, 1, 1, 0, 0, 1, 0x8000); 

    X.on('event', (ev) => {
        if (ev.name === 'ButtonPress') {
            // Mapping 800x800 window to 243x243 trinary space
            let mx = Math.floor((ev.x / 800) * 243);
            let my = Math.floor((ev.y / 800) * 243);
            
            process.stdout.write(`[MOUSE RECORD] VOID-3 X: ${mx} Y: ${my}\n`);

            // Hitbox check: 50x50 icon starting at 30,40
            if (mx >= 30 && mx <= 80 && my >= 40 && my <= 90) {
                killAndLaunchPaint();
            }
        }
    });
});

// --- 6. EXECUTION LOOP ---
async function boot() {
    // 1. Generate the UI from PNG
    await compileIconToVasm('apps/paint/app.png', 30, 40);
    
    // 2. Load generated assembly
    assemble('main.vasm', 531441);
    cpu.pc = 531441;
    process.stdout.write("[SYSTEM] VOID-3 Online. Constantly Recording Mouse...\n");

    // 3. Chunked loop to prevent UI blocking
    function run() {
        if (!cpu.halted) {
            // Check for mouse events every 15k instructions
            for(let i=0; i<15000; i++) cpu.step();
            gpu.render(cpu.memory);
        }
        setImmediate(run);
    }
    run();
}

boot();