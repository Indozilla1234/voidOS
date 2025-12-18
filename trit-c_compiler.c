#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define R_T0 0 // RED
#define R_T3 3 // X
#define R_T7 7 // First General Purpose Register
#define R_T25 25 // Stack Pointer
#define R_T26 26 // Status/Logic Register

typedef struct {
    char name[50];
    int reg;   // Which Trit-Register it lives in
    int is_ptr; 
} Symbol;

Symbol table[27]; // Mapping variables to our 27 registers
int var_count = 0;

int get_reg(char *name) {
    for (int i = 0; i < var_count; i++) {
        if (strcmp(table[i].name, name) == 0) return table[i].reg;
    }
    // Auto-allocate next register starting from T7
    int new_reg = R_T7 + var_count;
    strcpy(table[var_count].name, name);
    table[var_count].reg = new_reg;
    var_count++;
    return new_reg;
}

int main() {
    FILE *in = fopen("main.tc", "r");
    FILE *out = fopen("main.vasm", "w");
    char line[256];
    if (!in || !out) return 1;

    fprintf(out, "// TRIT-C UNIVERSAL COMPILER OUTPUT\n");

    while (fgets(line, sizeof(line), in)) {
        char v1[50], v2[50], v3[50];
        int val;

        // 1. Pointer Store: *ptr = val
        if (sscanf(line, " *%s = %d", v1, &val) == 2) {
            fprintf(out, "WAK %d %d\n", R_T26, val); // Temp value in T26
            fprintf(out, "STR %d %d\n", R_T26, get_reg(v1));
            continue;
        }

        // 2. Logic: if (var == true)
        if (sscanf(line, " if ( %s == true )", v1) == 1) {
            fprintf(out, "WAK %d 1\n", R_T26);
            fprintf(out, "TRI %d %d\n", get_reg(v1), R_T26);
            fprintf(out, "BRP "); // Next part of logic would handle the address
            continue;
        }

        // 3. Balanced Assignment: var = false / true / null
        if (sscanf(line, " %s = false", v1) == 1) {
            fprintf(out, "WAK %d -1\n", get_reg(v1)); continue;
        }
        if (sscanf(line, " %s = true", v1) == 1) {
            fprintf(out, "WAK %d 1\n", get_reg(v1)); continue;
        }
        if (sscanf(line, " %s = null", v1) == 1) {
            fprintf(out, "WAK %d 0\n", get_reg(v1)); continue;
        }

        // 4. Arithmetic: var = var + var
        if (sscanf(line, " %s = %s + %s", v1, v2, v3) == 3) {
            fprintf(out, "CPY %d %d\n", get_reg(v1), get_reg(v2));
            fprintf(out, "ADD %d %d\n", get_reg(v1), get_reg(v3));
            continue;
        }

        // 5. Hardware Commands
        if (strstr(line, "RECT")) fprintf(out, "RECT\n");
        if (strstr(line, "pos(")) {
            int x, y; sscanf(line, " pos(%d,%d)", &x, &y);
            fprintf(out, "WAK 3 %d\nWAK 4 %d\n", x, y);
        }
        // ... color and size logic here ...
    }

    fclose(in); fclose(out);
    return 0;
}