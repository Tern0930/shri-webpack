import { Compiler } from 'webpack';
import * as fs from 'fs';
import * as Path from 'path';

type ExcludedFilesPluginOptions = {
    blacklistDir?: string[],
    whitelist?: string[],
    blacklist?: string[],
}

class ExcludedFilesPlugin {
    blacklistDir: string[];
    whitelist: string[];
    blacklist: string[];
    patterns: RegExp[];
    includedFiles: Set<string>;

    constructor(options: ExcludedFilesPluginOptions = {
        blacklistDir: ['node_modules', 'dist', '.git', 'plugins'],
        blacklist: ['package.json', 'package.json', 'package-lock.json', '.gitignore', '.nvmrc', '.prettierrc.yaml', 'README.md', 'statoscope.config.js', 'stats.json', 'tsconfig.json', 'usedFiles', 'webpack.config.ts', 'unused.json'],
        whitelist: ['.js', '.ts', '.tsx', '.jsx', '.css'],
    }) {
        const optDef = {
            blacklistDir: ['node_modules', 'dist', '.git', 'plugins'],
            blacklist: ['package.json', 'package.json', 'package-lock.json', '.gitignore', '.nvmrc', '.prettierrc.yaml', 'README.md', 'statoscope.config.js', 'stats.json', 'tsconfig.json', 'usedFiles', 'webpack.config.ts', 'unused.json'],
            whitelist: ['.js', '.ts', '.tsx', '.jsx', '.css'],
        };
        const opt = {...optDef, ...options};
        this.blacklistDir = opt.blacklistDir;
        this.whitelist = opt.whitelist;
        this.blacklist = opt.blacklist;
        this.patterns = this.whitelist.map(value => {
            return new RegExp('\\' + value + '$')
        });
        this.includedFiles = new Set();
    };

    async getAllFiles(path: string) {
        const blacklistDir = this.blacklistDir;
        const blacklist = this.blacklist;
        const patterns = this.patterns;

        // @ts-ignore
        async function handleDir(path: string) {
            const files = fs.readdirSync(path);
            const promises = [];
            for (let file of files) {
                const name = Path.resolve(path, file);
                if (fs.statSync(name).isDirectory()) {
                    const flagDir: boolean = blacklistDir.reduce((acc: boolean, item: string) => acc && !name.includes(item), true);
                    if (flagDir)
                        promises.push(handleDir(name));
                } else if (fs.statSync(name).isFile()){
                    const whiteFlag: boolean = patterns.reduce((acc: boolean, pattern: RegExp) => acc || Boolean(pattern.test(name)), false);
                    const blackFlag: boolean = blacklist.reduce((acc: boolean, item: string) => acc && !name.includes(item), true);
                    if (whiteFlag && blackFlag)
                        res.push(name);
                }
            }
            return Promise.all(promises);
        }
        const res: string[] = [];
        await handleDir(path);
        return res;
    }
    
    async getExcludedFiles() {
        await this.getAllFiles('./')
        .then(data => {
            const excludedFiles: string[] = data.filter(item => !this.includedFiles.has(item));
            fs.writeFile(Path.resolve('unused.json'), JSON.stringify(excludedFiles), err => {if (err) console.error(err)})
        })
        .catch(err => console.error(err));
    }

    apply (compiler: Compiler): void {

        compiler.hooks.normalModuleFactory.tap(
            'used-modules',
            (normalModuleFactory) => {
                normalModuleFactory.hooks.module.tap('used-modules', (_module, _createData) => {
                    const resource = _createData.resource;
                    let name = resource;
                    let flag1 = this.patterns.reduce((acc: boolean, pattern) => acc || Boolean(pattern.test(name)), false);
                    let flag2 = this.blacklistDir.reduce((acc: boolean, value) => acc && Boolean(name?.includes(value)), true);
                    if (flag1 && !flag2)
                        this.includedFiles.add(name);
                    return _module;
                });
            }
        );

        compiler.hooks.done.tap('modules-excluded', (): void => {
            this.getExcludedFiles();
        })
    }
}

export default ExcludedFilesPlugin;