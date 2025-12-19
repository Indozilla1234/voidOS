#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <ctype.h>

// Register Definitions
#define R_GP_START 7
#define R_SP 25
#define R_STATUS 26

typedef struct {
    char name[50];
    int reg;
} Symbol;

Symbol table[27];
int var_count = 0;
int label_count = 0;

int get_reg(char *name) {
    for (int i = 0; i < var_count; i++) {
        if (strcmp(table[i].name, name) == 0) return table[i].reg;
    }
    if (var_count >= 18) { // T7 through T24 are available for vars
        printf("Error: Register pressure too high. Out of trits!\n");
        exit(1);
    }
    int new_reg = R_GP_START + var_count;
    strcpy(table[var_count].name, name);
    table[var_count].reg = new_reg;
    var_count++;
    return new_reg;
}

void load_to_hardware(FILE *out, char *val, int target_reg) {
    if (isdigit(val[0]) || val[0] == '-') {
        fprintf(out, "SET %d %s\n", target_reg, val);
    } else {
        fprintf(out, "CPY %d %d\n", target_reg, get_reg(val));
    }
}

int main() {
    FILE *in = fopen("main.tc", "r");
    FILE *out = fopen("main.vasm", "w");
    char line[256];

    if (!in || !out) return 1;

    fprintf(out, "// VOID-3 TRANSCENDENT TERNARY ASM\n");
    fprintf(out, "// Word Size: 200 Trits\n\n");

    while (fgets(line, sizeof(line), in)) {
        char v1[50], v2[50], v3[50], p1[50], p2[50], p3[50];
        int num;

        // 1. Balanced Ternary Integer Declaration: int x = 10
        if (sscanf(line, " int %s = %d", v1, &num) == 2) {
            fprintf(out, "SET %d %d // %s\n", get_reg(v1), num, v1);
            continue;
        }

        // 2. Addition / Subtraction / Multiplication
        if (sscanf(line, " %s = %s + %s", v1, v2, v3) == 3) {
            fprintf(out, "CPY %d %d\n", get_reg(v1), get_reg(v2));
            fprintf(out, "ADD %d %d\n", get_reg(v1), get_reg(v3));
            continue;
        }
        if (sscanf(line, " %s = %s * %s", v1, v2, v3) == 3) {
            fprintf(out, "CPY %d %d\n", get_reg(v1), get_reg(v2));
            fprintf(out, "MUL %d %d\n", get_reg(v1), get_reg(v3));
            continue;
        }

        // 3. Conditional Logic: if (var1 == var2) { ... }
        // Generates TRI comparison and a Branch-if-Not-Zero
        if (sscanf(line, " if ( %[^ ] == %[^ ] )", v1, v2) == 2) {
            int L = label_count++;
            fprintf(out, "TRI %d %d\n", get_reg(v1), get_reg(v2));
            fprintf(out, "BRN L%d\n", L); // Jump if result is -1 (less)
            fprintf(out, "BRP L%d\n", L); // Jump if result is 1 (greater)
            // Code inside the if goes here in the source...
            continue;
        }

        // 4. Function Support
        if (sscanf(line, " call %s", v1) == 1) {
            fprintf(out, "CAL %s\n", v1);
            continue;
        }
        if (strstr(line, "return")) {
            fprintf(out, "RET\n");
            continue;
        }

        // 5. Hardware Call: color(r, g, b)
        if (sscanf(line, " color ( %[^ ,] , %[^ ,] , %[^ )] )", p1, p2, p3) == 3) {
            load_to_hardware(out, p1, 0);
            load_to_hardware(out, p2, 1);
            load_to_hardware(out, p3, 2);
            continue;
        }

        // 6. Hardware Call: pos(x, y) / size(w, h)
        if (sscanf(line, " pos ( %[^ ,] , %[^ )] )", p1, p2) == 2) {
            load_to_hardware(out, p1, 3); load_to_hardware(out, p2, 4);
            continue;
        }
        if (sscanf(line, " size ( %[^ ,] , %[^ )] )", p1, p2) == 2) {
            load_to_hardware(out, p1, 5); load_to_hardware(out, p2, 6);
            continue;
        }

        // 7. Graphics & System
        if (strstr(line, "draw()"))   fprintf(out, "RECT\n");
        if (strstr(line, "clear()"))  fprintf(out, "CLS\n");
        if (strstr(line, "halt()"))   fprintf(out, "SLP\n");
    }

    fclose(in); fclose(out);
    return 0;
}