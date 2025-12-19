#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <ctype.h>

// Register Definitions
#define R_GP_START 7
#define R_SP 25

typedef struct {
    char name[50];
    int reg;
} Symbol;

Symbol table[50]; // Expanded for more trits
int var_count = 0;
int label_count = 0;

int get_reg(char *name) {
    for (int i = 0; i < var_count; i++) {
        if (strcmp(table[i].name, name) == 0) return table[i].reg;
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

    fprintf(out, "// Compiled from Trit-C\n");
    fprintf(out, "// Target: VOID-3 50-Trit Architecture\n\n");

    while (fgets(line, sizeof(line), in)) {
        char v1[50], v2[50], v3[50], p1[50], p2[50], p3[50];
        int num;

        // 1. Basic Variable & Arithmetic
        if (sscanf(line, " int %s = %d", v1, &num) == 2) {
            fprintf(out, "SET %d %d\n", get_reg(v1), num); continue;
        }
        if (sscanf(line, " %s = %s + %s", v1, v2, v3) == 3) {
            fprintf(out, "CPY %d %d\nADD %d %d\n", get_reg(v1), get_reg(v2), get_reg(v1), get_reg(v3)); continue;
        }

        // 2. Hardware Input Mapping
        if (sscanf(line, " %s = get_mouse_x()", v1) == 1) {
            fprintf(out, "WAK %d 50\n", get_reg(v1)); continue;
        }
        if (sscanf(line, " %s = get_mouse_y()", v1) == 1) {
            fprintf(out, "WAK %d 51\n", get_reg(v1)); continue;
        }
        if (sscanf(line, " %s = is_pressed ( %d )", v1, &num) == 2) {
            fprintf(out, "KEY %d %d\n", get_reg(v1), num); continue;
        }

        // 3. Ternary Logic (If/Else)
        if (sscanf(line, " if ( %[^ ] == %[^ ] )", v1, v2) == 2) {
            int L = label_count++;
            fprintf(out, "TRI %d %d\n", get_reg(v1), get_reg(v2));
            fprintf(out, "BRN L%d\n", L); // Skip if Less
            fprintf(out, "BRP L%d\n", L); // Skip if Greater
            continue;
        }
        if (strstr(line, "label")) {
            char label_name[50];
            sscanf(line, " label %s", label_name);
            fprintf(out, "L%s:\n", label_name); continue;
        }

        // 4. Graphics (SET Registers 0-6)
        if (sscanf(line, " color ( %[^ ,] , %[^ ,] , %[^ )] )", p1, p2, p3) == 3) {
            load_to_hardware(out, p1, 0); load_to_hardware(out, p2, 1); load_to_hardware(out, p3, 2); continue;
        }
        if (sscanf(line, " pos ( %[^ ,] , %[^ )] )", p1, p2) == 2) {
            load_to_hardware(out, p1, 3); load_to_hardware(out, p2, 4); continue;
        }
        if (sscanf(line, " size ( %[^ ,] , %[^ )] )", p1, p2) == 2) {
            load_to_hardware(out, p1, 5); load_to_hardware(out, p2, 6); continue;
        }
        if (strstr(line, "draw()"))  fprintf(out, "RECT\n");
        if (strstr(line, "halt()"))  fprintf(out, "SLP\n");
    }

    fclose(in); fclose(out);
    return 0;
}