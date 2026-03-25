"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCollection = readCollection;
exports.writeCollection = writeCollection;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DEFAULT_DATA_DIR = path_1.default.join(process.cwd(), '.data');
function resolveDataDir() {
    return process.env.POLKASEND_DATA_DIR || DEFAULT_DATA_DIR;
}
function readCollection(filename) {
    const dataDir = resolveDataDir();
    const filePath = path_1.default.join(dataDir, filename);
    fs_1.default.mkdirSync(dataDir, { recursive: true });
    if (!fs_1.default.existsSync(filePath)) {
        return [];
    }
    const raw = fs_1.default.readFileSync(filePath, 'utf8').trim();
    if (!raw) {
        return [];
    }
    return JSON.parse(raw);
}
function writeCollection(filename, rows) {
    const dataDir = resolveDataDir();
    const filePath = path_1.default.join(dataDir, filename);
    const tempPath = `${filePath}.tmp`;
    fs_1.default.mkdirSync(dataDir, { recursive: true });
    fs_1.default.writeFileSync(tempPath, JSON.stringify(rows, null, 2), 'utf8');
    fs_1.default.renameSync(tempPath, filePath);
}
