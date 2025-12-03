const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');

const srcDir = path.join(__dirname, '..');
const backupDir = path.join(process.cwd(), 'backup_js');

function getAllJsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            getAllJsFiles(filePath, fileList);
        } else if (file.endsWith('.js')) {
            fileList.push(filePath);
        }
    });
    return fileList;
}

function backupJsFiles() {
    console.log('开始备份JS文件...');
    if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
    }
    fs.mkdirSync(backupDir, { recursive: true });

    const jsFiles = getAllJsFiles(srcDir);
    jsFiles.forEach(file => {
        const relativePath = path.relative(srcDir, file);
        const backupPath = path.join(backupDir, relativePath);
        const backupDirPath = path.dirname(backupPath);

        if (!fs.existsSync(backupDirPath)) {
            fs.mkdirSync(backupDirPath, { recursive: true });
        }

        fs.copyFileSync(file, backupPath);
    });
    console.log('备份完成');
}

function obfuscateJsFiles() {
    console.log('开始混淆JS文件...');
    const jsFiles = getAllJsFiles(srcDir);

    jsFiles.forEach(file => {
        try {
            const code = fs.readFileSync(file, 'utf-8');
            const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 0.75,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 0.4,
                debugProtection: false,
                debugProtectionInterval: 0,
                disableConsoleOutput: false,
                identifierNamesGenerator: 'hexadecimal',
                log: false,
                numbersToExpressions: true,
                renameGlobals: false,
                selfDefending: true,
                simplify: true,
                splitStrings: true,
                splitStringsChunkLength: 10,
                stringArray: true,
                stringArrayCallsTransform: true,
                stringArrayEncoding: ['base64'],
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayWrappersCount: 2,
                stringArrayWrappersChainedCalls: true,
                stringArrayWrappersParametersMaxCount: 4,
                stringArrayWrappersType: 'function',
                stringArrayThreshold: 0.75,
                transformObjectKeys: true,
                unicodeEscapeSequence: false
            }).getObfuscatedCode();

            fs.writeFileSync(file, obfuscatedCode, 'utf-8');
            console.log(`混淆完成: ${path.relative(srcDir, file)}`);
        } catch (error) {
            console.error(`混淆失败: ${file}`, error);
        }
    });
    console.log('混淆完成');
}

function restoreJsFiles() {
    console.log('开始恢复JS文件...');
    const jsFiles = getAllJsFiles(backupDir);

    jsFiles.forEach(file => {
        const relativePath = path.relative(backupDir, file);
        const originalPath = path.join(srcDir, relativePath);
        fs.copyFileSync(file, originalPath);
    });
    console.log('恢复完成');
}

function cleanupBackup() {
    console.log('清理备份目录...');
    if (fs.existsSync(backupDir)) {
        execSync(`rmdir /s /q "${backupDir}"`, { stdio: 'inherit' });
    }
    console.log('清理完成');
}

function build() {
    try {
        backupJsFiles();
        obfuscateJsFiles();

        console.log('开始打包...');
        execSync('npx electron-builder --win --x64', { stdio: 'inherit' });
        console.log('打包完成');

        restoreJsFiles();
        cleanupBackup();

        console.log('构建流程全部完成');
    } catch (error) {
        console.error('构建失败:', error);
        restoreJsFiles();
        cleanupBackup();
        process.exit(1);
    }
}

build();

