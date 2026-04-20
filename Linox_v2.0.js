'use strict';

/* 
    LINOX v2.0 — Main JavaScript
    Features:
    - Virtual File System (VFS)
    - Multi-tab terminal
    - Tab autocomplete + Command history
    - vim editor
    - Pyodide (Python WASM)
    - SSH simulation
    - sys-stats, clock, uptime
    - man pages, tooltips
    - pipe | redirection > support
 */

/*  1. VIRTUAL FILE SYSTEM  */
class VFS {
    constructor() {
        this.root = {
            type: 'dir', name: '/', children: {
                home: {
                    type: 'dir', name: 'home', children: {
                        guest: {
                            type: 'dir', name: 'guest', children: {
                                'hello.cpp': { type: 'file', name: 'hello.cpp', content: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n', perms: '-rw-r--r--', size: 98 },
                                'readme.txt': { type: 'file', name: 'readme.txt', content: 'Welcome to Linox v2.0!\n\nThis is a browser-based Linux terminal simulator.\nTry: ls, cd, vim, python3, man, ps, ping, ssh\n\nType "help" for all commands.\n', perms: '-rw-r--r--', size: 160 },
                                projects: { type: 'dir', name: 'projects', children: {
                                'main.py': { type: 'file', name: 'main.py', content: 'print("Hello from Python!")\n\nfor i in range(5):\n    print(f"  [{i}] Linox is awesome")\n', perms: '-rw-r--r--', size: 82 },
                                }, perms: 'drwxr-xr-x' },
                                '.bashrc': { type: 'file', name: '.bashrc', content: '# Linox shell config\nexport PS1="\\u@\\h:\\w$ "\nexport PATH="$PATH:/usr/local/bin"\nalias ll="ls -la"\nalias py="python3"\n', perms: '-rw-r--r--', size: 112 },
                            }, perms: 'drwxr-xr-x'
                        }
                    }, perms: 'drwxr-xr-x'
                },
                etc: {
                    type: 'dir', name: 'etc', children: {
                        'hostname': { type: 'file', name: 'hostname', content: 'linox-machine\n', perms: '-rw-r--r--', size: 14 },
                        'passwd': { type: 'file', name: 'passwd', content: 'root:x:0:0:root:/root:/bin/bash\nguest:x:1000:1000::/home/guest:/bin/bash\n', perms: '-rw-r--r--', size: 72 },
                        'os-release': { type: 'file', name: 'os-release', content: 'NAME="Linox"\nVERSION="2.0.0 LTS"\nID=linox\nHOME_URL="https://linox.dev"\n', perms: '-rw-r--r--', size: 72 },
                    }, perms: 'drwxr-xr-x'
                },
                tmp: { type: 'dir', name: 'tmp', children: {}, perms: 'drwxrwxrwx' },
                var: {
                    type: 'dir', name: 'var', children: {
                        log: {
                            type: 'dir', name: 'log', children: {
                                'auth.log': { type: 'file', name: 'auth.log', content: generateFakeLog(), perms: '-rw-r-----', size: 2048 },
                                'syslog': { type: 'file', name: 'syslog', content: generateSyslog(), perms: '-rw-r-----', size: 4096 },
                            }, perms: 'drwxr-xr-x'
                        }
                    }, perms: 'drwxr-xr-x'
                },
                usr: {
                    type: 'dir', name: 'usr', children: {
                        bin: { type: 'dir', name: 'bin', children: {}, perms: 'drwxr-xr-x' },
                        local: { type: 'dir', name: 'local', children: {
                            bin: { type: 'dir', name: 'bin', children: {}, perms: 'drwxr-xr-x' },
                        }, perms: 'drwxr-xr-x' },
                    }, perms: 'drwxr-xr-x'
                },
            }, perms: 'drwxr-xr-x'
        };
        this.cwd = ['home', 'guest'];
    }

    resolvePath(pathStr, basePath) {
        const base = basePath || [...this.cwd];
        if (!pathStr) return base;
        let parts;
        if (pathStr.startsWith('/')) { parts = pathStr.split('/').filter(Boolean); return parts; }
        parts = [...base];
        for (const seg of pathStr.split('/')) {
            if (seg === '' || seg === '.') continue;
            if (seg === '..') { if (parts.length > 0) parts.pop(); }
            else parts.push(seg);
        }
        return parts;
    }

    getNode(pathArr) {
        let node = this.root;
        for (const seg of pathArr) {
            if (!node.children || !node.children[seg]) return null;
            node = node.children[seg];
        }
        return node;
    }

    getCwd() { return this.getNode(this.cwd); }
    pwdStr() { return '/' + this.cwd.join('/'); }
    homeStr() { return '~' + (this.cwd.length > 2 ? '/' + this.cwd.slice(2).join('/') : ''); }

    cd(pathStr) {
        if (!pathStr || pathStr === '~') { this.cwd = ['home', 'guest']; return { ok: true }; }
        const resolved = this.resolvePath(pathStr);
        const node = this.getNode(resolved);
        if (!node) return { ok: false, err: `cd: no such file or directory: ${pathStr}` };
        if (node.type !== 'dir') return { ok: false, err: `cd: not a directory: ${pathStr}` };
        this.cwd = resolved;
        return { ok: true };
    }

    ls(pathStr, flags = '') {
        const target = pathStr ? this.resolvePath(pathStr) : [...this.cwd];
        const node = this.getNode(target);
        if (!node) return { ok: false, err: `ls: cannot access '${pathStr}': No such file or directory` };
        const showAll = flags.includes('a');
        const showLong = flags.includes('l');
        let items = [];
        if (node.type === 'dir') {
            if (showAll) {
                items.push({ name: '.', type: 'dir', perms: node.perms || 'drwxr-xr-x', size: 4096, mtime: 'Jan 15 10:30' });
                items.push({ name: '..', type: 'dir', perms: 'drwxr-xr-x', size: 4096, mtime: 'Jan 15 10:30' });
            }
            for (const [n, child] of Object.entries(node.children)) {
                if (!showAll && n.startsWith('.')) continue;
                items.push({ name: n, type: child.type, perms: child.perms || (child.type==='dir'?'drwxr-xr-x':'-rw-r--r--'), size: child.size || 4096, mtime: child.mtime || 'Jan 15 10:30', exec: child.exec });
            }
        } else {
            items.push({ name: target[target.length-1], type: 'file', perms: node.perms || '-rw-r--r--', size: node.size || 0, mtime: node.mtime || 'Jan 15 10:30' });
        }
        return { ok: true, items, showLong };
    }

    cat(pathStr) {
        if (!pathStr) return { ok: false, err: 'cat: missing operand' };
        const node = this.getNode(this.resolvePath(pathStr));
        if (!node) return { ok: false, err: `cat: ${pathStr}: No such file or directory` };
        if (node.type === 'dir') return { ok: false, err: `cat: ${pathStr}: Is a directory` };
        return { ok: true, content: node.content || '' };
    }

    mkdir(pathStr, parents = false) {
        if (!pathStr) return { ok: false, err: 'mkdir: missing operand' };
        const resolved = this.resolvePath(pathStr);
        const name = resolved[resolved.length - 1];
        const parentPath = resolved.slice(0, -1);
        const parentNode = this.getNode(parentPath);
        if (!parentNode) {
            if (parents) {
                let cur = this.root;
                for (const seg of resolved) {
                    if (!cur.children) cur.children = {};
                    if (!cur.children[seg]) cur.children[seg] = { type: 'dir', name: seg, children: {}, perms: 'drwxr-xr-x' };
                    cur = cur.children[seg];
                }
                return { ok: true };
            }
            return { ok: false, err: `mkdir: cannot create directory '${pathStr}': No such file or directory` };
        }
        if (!parentNode.children) return { ok: false, err: `mkdir: cannot create directory '${pathStr}': Not a directory` };
        if (parentNode.children[name]) return { ok: false, err: `mkdir: cannot create directory '${pathStr}': File exists` };
        parentNode.children[name] = { type: 'dir', name, children: {}, perms: 'drwxr-xr-x' };
        return { ok: true };
    }

    touch(pathStr) {
        if (!pathStr) return { ok: false, err: 'touch: missing file operand' };
        const resolved = this.resolvePath(pathStr);
        const name = resolved[resolved.length - 1];
        const parentPath = resolved.slice(0, -1);
        const parentNode = this.getNode(parentPath);
        if (!parentNode || parentNode.type !== 'dir') return { ok: false, err: `touch: cannot touch '${pathStr}': No such file or directory` };
        if (!parentNode.children[name]) {
        parentNode.children[name] = { type: 'file', name, content: '', perms: '-rw-r--r--', size: 0, mtime: new Date().toLocaleDateString('en',{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}) };
        }
        return { ok: true };
    }

    rm(pathStr, flags = '') {
        if (!pathStr) return { ok: false, err: 'rm: missing operand' };
        const recursive = flags.includes('r') || flags.includes('R');
        const resolved = this.resolvePath(pathStr);
        const name = resolved[resolved.length - 1];
        const parentPath = resolved.slice(0, -1);
        const parentNode = this.getNode(parentPath);
        if (!parentNode || !parentNode.children || !parentNode.children[name]) return { ok: false, err: `rm: cannot remove '${pathStr}': No such file or directory` };
        const target = parentNode.children[name];
        if (target.type === 'dir' && !recursive) return { ok: false, err: `rm: cannot remove '${pathStr}': Is a directory (use -r)` };
        delete parentNode.children[name];
        return { ok: true };
    }

    mv(src, dest) {
        if (!src || !dest) return { ok: false, err: 'mv: missing operand' };
        const srcResolved = this.resolvePath(src);
        const srcName = srcResolved[srcResolved.length - 1];
        const srcParent = this.getNode(srcResolved.slice(0, -1));
        if (!srcParent || !srcParent.children || !srcParent.children[srcName]) return { ok: false, err: `mv: cannot stat '${src}': No such file or directory` };
        const node = srcParent.children[srcName];
        const destResolved = this.resolvePath(dest);
        let destParent, destName;
        const maybeDir = this.getNode(destResolved);
        if (maybeDir && maybeDir.type === 'dir') { destParent = maybeDir; destName = srcName; }
        else { destParent = this.getNode(destResolved.slice(0, -1)); destName = destResolved[destResolved.length - 1]; }
        if (!destParent || destParent.type !== 'dir') return { ok: false, err: `mv: cannot move '${src}' to '${dest}': No such file or directory` };
        destParent.children[destName] = { ...node, name: destName };
        delete srcParent.children[srcName];
        return { ok: true };
    }

    cp(src, dest) {
        if (!src || !dest) return { ok: false, err: 'cp: missing operand' };
        const srcNode = this.getNode(this.resolvePath(src));
        if (!srcNode) return { ok: false, err: `cp: cannot stat '${src}': No such file or directory` };
        const destResolved = this.resolvePath(dest);
        const destName = destResolved[destResolved.length - 1];
        const destParent = this.getNode(destResolved.slice(0, -1));
        if (!destParent) return { ok: false, err: `cp: cannot create '${dest}': No such file or directory` };
        destParent.children[destName] = JSON.parse(JSON.stringify({ ...srcNode, name: destName }));
        return { ok: true };
    }

    write(pathStr, content) {
        const resolved = this.resolvePath(pathStr);
        const name = resolved[resolved.length - 1];
        const parentNode = this.getNode(resolved.slice(0, -1));
        if (!parentNode || parentNode.type !== 'dir') return false;
        if (!parentNode.children[name]) parentNode.children[name] = { type: 'file', name, perms: '-rw-r--r--' };
        parentNode.children[name].content = content;
        parentNode.children[name].size = content.length;
        return true;
    }

    grep(pattern, pathStr, flags = '') {
        const ignoreCase = flags.includes('i');
        const showLine = flags.includes('n');
        const node = this.getNode(this.resolvePath(pathStr));
        if (!node) return { ok: false, err: `grep: ${pathStr}: No such file or directory` };
        if (node.type === 'dir') return { ok: false, err: `grep: ${pathStr}: Is a directory` };
        const regex = new RegExp(pattern, ignoreCase ? 'gi' : 'g');
        const lines = (node.content || '').split('\n');
        const matches = [];
        lines.forEach((line, i) => { if (regex.test(line)) matches.push(showLine ? `${i+1}:${line}` : line); });
        return { ok: true, matches };
    }

    find(pathStr, name) {
        const startNode = this.getNode(this.resolvePath(pathStr || '.'));
        if (!startNode) return { ok: false, err: `find: '${pathStr}': No such file or directory` };
        const results = [];
        const walk = (node, path) => {
        if (!node.children) return;
        for (const [n, child] of Object.entries(node.children)) {
            const fullPath = path + '/' + n;
            if (!name || n.includes(name)) results.push(fullPath);
            if (child.type === 'dir') walk(child, fullPath);
        }
        };
        walk(startNode, pathStr || '.');
        return { ok: true, results };
    }

    chmod(mode, pathStr) {
        const node = this.getNode(this.resolvePath(pathStr));
        if (!node) return { ok: false, err: `chmod: cannot access '${pathStr}': No such file or directory` };
        const octal = parseInt(mode, 8);
        if (isNaN(octal)) return { ok: false, err: `chmod: invalid mode: '${mode}'` };
        const permStr = (node.type === 'dir' ? 'd' : '-') + octalToPerm(octal);
        node.perms = permStr;
        if (mode === '755' || mode === '111') node.exec = true;
        return { ok: true };
    }

    getCompletions(partial, isCommand) {
        if (isCommand) {
            return COMMANDS.filter(c => c.startsWith(partial)).map(c => ({ name: c, type: 'cmd' }));
        }
        const slashIdx = partial.lastIndexOf('/');
        let dir, prefix;
        if (slashIdx === -1) { dir = [...this.cwd]; prefix = partial; }
        else { dir = this.resolvePath(partial.slice(0, slashIdx)); prefix = partial.slice(slashIdx + 1); }
        const node = this.getNode(dir);
        if (!node || !node.children) return [];
        return Object.entries(node.children)
        .filter(([n]) => n.startsWith(prefix))
        .map(([n, child]) => ({ name: (slashIdx === -1 ? '' : partial.slice(0, slashIdx + 1)) + n + (child.type === 'dir' ? '/' : ''), type: child.type }));
    }
}

function octalToPerm(octal) {
    const bits = [Math.floor(octal/64)%8, Math.floor(octal/8)%8, octal%8];
    return bits.map(b => (b&4?'r':'-')+(b&2?'w':'-')+(b&1?'x':'-')).join('');
}

function generateFakeLog() {
    const ips = ['192.168.1.105','10.0.0.23','172.16.0.44','203.0.113.7','45.33.32.156'];
    const users = ['root','admin','ubuntu','deploy','guest'];
    const lines = [];
    const now = new Date();
    for (let i = 20; i >= 0; i--) {
        const t = new Date(now - i * 180000);
        const ts = t.toLocaleString('en',{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
        const ip = ips[Math.floor(Math.random()*ips.length)];
        const user = users[Math.floor(Math.random()*users.length)];
        const ok = Math.random() > 0.3;
        lines.push(`${ts} linox-machine sshd[${1000+i*13}]: ${ok?'Accepted':'Failed'} password for ${user} from ${ip} port ${20000+Math.floor(Math.random()*10000)} ssh2`);
    }
    return lines.join('\n') + '\n';
}

function generateSyslog() {
    const lines = [];
    const events = [
        'kernel: EXT4-fs (sda1): mounted filesystem with ordered data mode',
        'systemd[1]: Started Network Service',
        'kernel: NET: Registered PF_INET6 protocol family',
        'systemd-resolved[412]: Server returned error NXDOMAIN',
        'kernel: audit: type=1400 audit(0.0:1): apparmor="STATUS"',
        'cron[823]: (root) CMD (/usr/sbin/logrotate /etc/logrotate.conf)',
    ];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
        const t = new Date(now - i * 60000);
        const ts = t.toLocaleString('en',{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
        lines.push(`${ts} linox-machine ${events[i % events.length]}`);
    }
    return lines.join('\n') + '\n';
}

/*  2. COMMAND DEFINITIONS  */
const COMMANDS = [
    'help','ls','cd','pwd','cat','mkdir','touch','rm','mv','cp','chmod',
    'clear','echo','whoami','hostname','uname','date','uptime','id',
    'grep','find','head','tail','wc','sort','uniq','cut',
    'g++','gcc','python3','node','make',
    'vim','nano',
    'ps','top','kill','jobs','bg','fg',
    'ping','ssh','curl','wget','netstat','ifconfig','ip',
    'tar','zip','unzip','gzip',
    'man','which','history','alias','export','env',
    'df','du','free','lscpu','lsblk',
    'sudo','su','exit','logout'
];

const MAN_PAGES = {
    ls: { name: 'ls', section: 1, desc: 'list directory contents', synopsis: 'ls [OPTION]... [FILE]...', options: ['-a  include hidden files (dotfiles)','-l  long listing format','-la  combine long + all','-lh  human readable sizes','-R  recursive'] },
    cd: { name: 'cd', section: 1, desc: 'change directory', synopsis: 'cd [DIR]', options: ['~   go to home directory','..  go up one level','-   go to previous directory'] },
    grep: { name: 'grep', section: 1, desc: 'print lines matching a pattern', synopsis: 'grep [OPTIONS] PATTERN [FILE]...', options: ['-i  ignore case','-n  show line numbers','-r  recursive','-v  invert match','-c  count matches'] },
    find: { name: 'find', section: 1, desc: 'search for files', synopsis: 'find [PATH] [EXPRESSION]', options: ['-name  match filename','-type f  regular files only','-type d  directories only','-size +N  larger than N blocks'] },
    cat: { name: 'cat', section: 1, desc: 'concatenate and print files', synopsis: 'cat [OPTION]... [FILE]...', options: ['-n  number lines','-A  show all characters','-s  squeeze blank lines'] },
    chmod: { name: 'chmod', section: 1, desc: 'change file permissions', synopsis: 'chmod MODE FILE', options: ['755  rwxr-xr-x (executable)','644  rw-r--r-- (default file)','777  rwxrwxrwx (full)','u/g/o  user/group/other','+ add, - remove, = set'] },
    ssh: { name: 'ssh', section: 1, desc: 'OpenSSH remote login client', synopsis: 'ssh [USER@]HOST', options: ['-p PORT  specify port','-i KEY   identity file','-L  local port forwarding','-R  remote port forwarding','-v  verbose'] },
    vim: { name: 'vim', section: 1, desc: 'Vi IMproved text editor', synopsis: 'vim [FILE]', options: ['i    insert mode','Esc  normal mode',':w   write/save',':q   quit',':wq  save and quit',':q!  force quit'] },
    ping: { name: 'ping', section: 8, desc: 'send ICMP ECHO_REQUEST to network hosts', synopsis: 'ping [OPTIONS] HOST', options: ['-c N  send N packets','-i N  interval N seconds','-t N  TTL value'] },
    ps: { name: 'ps', section: 1, desc: 'report process status', synopsis: 'ps [OPTIONS]', options: ['aux  all processes (BSD style)','ef   all processes (Unix style)','-p PID  specific process'] },
    tar: { name: 'tar', section: 1, desc: 'archive utility', synopsis: 'tar [OPTIONS] [FILE]...', options: ['-c  create archive','-x  extract archive','-v  verbose','-f  specify filename','-z  gzip compression'] },
    man: { name: 'man', section: 1, desc: 'manual page viewer', synopsis: 'man [SECTION] PAGE', options: ['man ls    view ls manual','man 5 passwd  section 5'] },
};

const CMD_TOOLTIPS = {
    ls:    { desc: 'List directory contents', flags: '-a (all) -l (long) -h (human) -R (recursive)' },
    cd:    { desc: 'Change directory', flags: '~ (home) .. (up) - (prev)' },
    grep:  { desc: 'Search for pattern in file', flags: '-i (case) -n (lines) -r (recursive) -v (invert)' },
    find:  { desc: 'Search for files in directory', flags: '-name -type -size' },
    chmod: { desc: 'Change file permissions', flags: '755 (exec) 644 (file) 777 (all)' },
    ssh:   { desc: 'Secure Shell remote login', flags: '-p (port) -i (key) -L (local fwd)' },
    tar:   { desc: 'Archive utility', flags: '-czf (create) -xzf (extract) -tzf (list)' },
    ps:    { desc: 'Show running processes', flags: 'aux (all) -f (forest)' },
    ping:  { desc: 'Test network connectivity', flags: '-c (count) -i (interval)' },
};

/*  3. TERMINAL STATE  */
const vfs = new VFS();
let tabs = [];
let activeTabId = null;
let tabCounter = 0;
let compiledFiles = {};
let pyodideInstance = null;
let pyodideReady = false;
let startTime = Date.now();

/*  4. PYODIDE INIT  */
async function initPyodide() {
    const statusEl = document.getElementById('status-pyodide');
    try {
        statusEl.textContent = 'Python: Loading...';
        statusEl.className = '';
        pyodideInstance = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/' });
        pyodideReady = true;
        statusEl.textContent = 'Python: Ready ✓';
        statusEl.className = 'ready';
    } catch(e) {
        statusEl.textContent = 'Python: Offline';
        pyodideReady = false;
    }
}

/*  5. TAB MANAGEMENT  */
function createTab(name) {
    const id = ++tabCounter;
    const tab = {
        id, name: name || `terminal ${id}`,
        history: [], historyIdx: -1,
        vfsCwd: [...vfs.cwd],
        autocompleteItems: [], autocompleteIdx: -1,
        vimOpen: false,
    };
    tabs.push(tab);
    renderTabBar();
    renderTerminalPane(tab);
    switchTab(id);
    return tab;
}

function renderTabBar() {
    const container = document.getElementById('tabs-container');
    container.innerHTML = '';
    tabs.forEach(tab => {
        const el = document.createElement('div');
        el.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
        el.dataset.id = tab.id;
        el.innerHTML = `<span class="tab-icon">⬡</span><span>${escHtml(tab.name)}</span>${tabs.length > 1 ? `<span class="tab-close" data-id="${tab.id}">✕</span>` : ''}`;
        el.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-close')) { closeTab(tab.id); return; }
        switchTab(tab.id);
        });
        container.appendChild(el);
    });
}

function switchTab(id) {
    activeTabId = id;
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    vfs.cwd = [...tab.vfsCwd];
    document.querySelectorAll('.terminal-pane').forEach(p => p.classList.remove('active'));
    const pane = document.getElementById(`pane-${id}`);
    if (pane) { pane.classList.add('active'); setTimeout(() => pane.querySelector('.terminal-input').focus(), 50); }
    renderTabBar();
    updateStatusBar();
    renderFileTree();
}

function closeTab(id) {
    if (tabs.length === 1) return;
    tabs = tabs.filter(t => t.id !== id);
    const pane = document.getElementById(`pane-${id}`);
    if (pane) pane.remove();
    if (activeTabId === id) switchTab(tabs[tabs.length - 1].id);
    else renderTabBar();
}

function renderTerminalPane(tab) {
    const wrapper = document.getElementById('terminals-wrapper');
    const pane = document.createElement('div');
    pane.className = 'terminal-pane';
    pane.id = `pane-${tab.id}`;
    pane.innerHTML = `
        <div class="terminal-output" id="output-${tab.id}"></div>
        <div class="autocomplete-box" id="ac-${tab.id}" style="display:none;"></div>
        <div class="terminal-input-line">
        <span class="input-prompt" id="prompt-${tab.id}">${getPromptHTML()}</span>
        <input class="terminal-input" id="input-${tab.id}" spellcheck="false" autocomplete="off">
        </div>`;
    wrapper.appendChild(pane);
    const input = pane.querySelector('.terminal-input');
    input.addEventListener('keydown', (e) => handleKeydown(e, tab));
    input.addEventListener('input', (e) => handleInput(e, tab));
    if (tab.id === 1) {
        printBoot(tab);
    }
}

function getPromptHTML() {
    const path = vfs.homeStr();
    return `<span class="prompt-span">guest@linox</span><span style="color:var(--text-mute)">:</span><span class="path-span">${escHtml(path)}</span><span class="dollar-span"> $ </span>`;
}

function updatePrompt(tab) {
    vfs.cwd = [...tab.vfsCwd];
    const el = document.getElementById(`prompt-${tab.id}`);
    if (el) el.innerHTML = getPromptHTML();
    updateStatusBar();
}

function updateStatusBar() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    vfs.cwd = [...tab.vfsCwd];
    document.getElementById('status-path').textContent = vfs.pwdStr();
    document.getElementById('status-mode').textContent = 'NORMAL';
}

/*  6. PRINT FUNCTIONS  */
function print(tabOrId, text, cls = 'output') {
    const tab = typeof tabOrId === 'object' ? tabOrId : tabs.find(t => t.id === tabOrId);
    if (!tab) return;
    const output = document.getElementById(`output-${tab.id}`);
    if (!output) return;
    const lines = String(text).split('\n');
    lines.forEach(line => {
        const p = document.createElement('div');
        p.className = `out-line ${cls}`;
        p.innerHTML = line;
        output.appendChild(p);
    });
    output.scrollTop = output.scrollHeight;
}

function printBoot(tab) {
    const lines = [
        `<span style="color:var(--green);font-weight:700">  _      _                   </span>`,
        `<span style="color:var(--green);font-weight:700"> | |    (_)                  </span>`,
        `<span style="color:var(--green);font-weight:700"> | |     _ _ __   _____  __  </span>`,
        `<span style="color:var(--green);font-weight:700"> | |    | | '_ \\ / _ \\ \\/ /  </span>`,
        `<span style="color:var(--green);font-weight:700"> | |____| | | | | (_) >  <   </span>`,
        `<span style="color:var(--green);font-weight:700"> |______|_|_| |_|\\___/_/\\_\\  </span>`,
        '',
        `<span style="color:var(--amber)">Linox v2.0.0 LTS</span> — Browser Terminal Simulator`,
        `Kernel: <span style="color:var(--cyan)">linox-5.15.0-generic</span>  Arch: <span style="color:var(--cyan)">x86_64</span>`,
        `Python runtime: <span id="boot-py-status" style="color:var(--amber)">loading...</span>`,
        '',
        `Type <span style="color:var(--amber)">'help'</span> for available commands. Tab for autocomplete.`,
        '',
    ];
    lines.forEach((l, i) => {
        setTimeout(() => print(tab, l, 'output'), i * 30);
    });
    setTimeout(() => {
        const el = document.getElementById('boot-py-status');
        if (el) el.innerHTML = pyodideReady ? `<span style="color:var(--green)">ready ✓</span>` : `<span style="color:var(--amber)">loading (check status bar)</span>`;
    }, 2000);
}

/*  7. KEYDOWN HANDLER  */
function handleKeydown(e, tab) {
    const input = document.getElementById(`input-${tab.id}`);
    const acBox = document.getElementById(`ac-${tab.id}`);

    // Autocomplete nav
    if (tab.autocompleteItems.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); tab.autocompleteIdx = Math.min(tab.autocompleteIdx + 1, tab.autocompleteItems.length - 1); renderAC(tab); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); tab.autocompleteIdx = Math.max(tab.autocompleteIdx - 1, 0); renderAC(tab); return; }
        if (e.key === 'Tab' || e.key === 'Enter') {
        if (tab.autocompleteIdx >= 0) {
            e.preventDefault();
            applyAutocomplete(tab);
            return;
        }
        hideAC(tab);
        }
        if (e.key === 'Escape') { hideAC(tab); return; }
    }

    // History
    if (e.key === 'ArrowUp' && tab.autocompleteItems.length === 0) {
        e.preventDefault();
        if (tab.historyIdx < tab.history.length - 1) { tab.historyIdx++; input.value = tab.history[tab.history.length - 1 - tab.historyIdx]; }
        return;
    }
    if (e.key === 'ArrowDown' && tab.autocompleteItems.length === 0) {
        e.preventDefault();
        if (tab.historyIdx > 0) { tab.historyIdx--; input.value = tab.history[tab.history.length - 1 - tab.historyIdx]; }
        else { tab.historyIdx = -1; input.value = ''; }
        return;
    }

    // Tab autocomplete trigger
    if (e.key === 'Tab') {
        e.preventDefault();
        triggerAC(tab);
        return;
    }

    // Ctrl shortcuts
    if (e.ctrlKey) {
        if (e.key === 'c') { e.preventDefault(); print(tab, getPromptHTML() + (input.value ? escHtml(input.value) : '') + '<span style="color:var(--red)">^C</span>', 'output'); input.value = ''; hideAC(tab); return; }
        if (e.key === 'l') { e.preventDefault(); document.getElementById(`output-${tab.id}`).innerHTML = ''; return; }
        if (e.key === 't') { e.preventDefault(); createTab(); return; }
        if (e.key === 'w') { e.preventDefault(); closeTab(tab.id); return; }
        if (e.key === 'a') { e.preventDefault(); input.setSelectionRange(0, 0); return; }
        if (e.key === 'e') { e.preventDefault(); input.setSelectionRange(input.value.length, input.value.length); return; }
    }

    if (e.key === 'Enter') {
        const cmd = input.value.trim();
        input.value = '';
        tab.historyIdx = -1;
        hideAC(tab);
        vfs.cwd = [...tab.vfsCwd];
        if (cmd) {
            tab.history.push(cmd);
            print(tab, getPromptHTML() + escHtml(cmd), 'cmd-echo');
            processCommand(cmd, tab);
        } else {
            print(tab, getPromptHTML(), 'cmd-echo');
        }
        updateStatusBar();
    }
}

function handleInput(e, tab) {
    // Show tooltip for known commands
    const input = document.getElementById(`input-${tab.id}`);
    const val = input.value.trim();
    const mainCmd = val.split(/\s+/)[0];
    if (val.includes(' ') && CMD_TOOLTIPS[mainCmd]) {
        showTooltip(mainCmd, input);
    } else {
        hideTooltip();
    }
}

/*  8. AUTOCOMPLETE  */
function triggerAC(tab) {
    const input = document.getElementById(`input-${tab.id}`);
    const val = input.value;
    const parts = val.split(/\s+/);
    const isCmd = parts.length === 1;
    const partial = parts[parts.length - 1];
    vfs.cwd = [...tab.vfsCwd];
    const items = vfs.getCompletions(partial, isCmd);
    if (items.length === 1) {
        const prefix = parts.slice(0, -1).join(' ');
        input.value = (prefix ? prefix + ' ' : '') + items[0].name;
        hideAC(tab);
    } else if (items.length > 1) {
        tab.autocompleteItems = items;
        tab.autocompleteIdx = 0;
        renderAC(tab);
    }
}

function renderAC(tab) {
    const acBox = document.getElementById(`ac-${tab.id}`);
    const input = document.getElementById(`input-${tab.id}`);
    acBox.innerHTML = '';
    tab.autocompleteItems.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'autocomplete-item' + (i === tab.autocompleteIdx ? ' selected' : '');
        el.innerHTML = escHtml(item.name) + `<span class="ac-type">${item.type}</span>`;
        el.addEventListener('mousedown', () => { tab.autocompleteIdx = i; applyAutocomplete(tab); });
        acBox.appendChild(el);
    });
    const rect = input.getBoundingClientRect();
    const pane = document.getElementById(`pane-${tab.id}`);
    const paneRect = pane.getBoundingClientRect();
    acBox.style.display = 'block';
    acBox.style.bottom = (paneRect.bottom - rect.top) + 'px';
    acBox.style.left = '16px';
}

function applyAutocomplete(tab) {
    const input = document.getElementById(`input-${tab.id}`);
    const item = tab.autocompleteItems[tab.autocompleteIdx];
    if (!item) return;
    const parts = input.value.split(/\s+/);
    parts[parts.length - 1] = item.name;
    input.value = parts.join(' ');
    hideAC(tab);
    input.focus();
}

function hideAC(tab) {
    tab.autocompleteItems = [];
    tab.autocompleteIdx = -1;
    const acBox = document.getElementById(`ac-${tab.id}`);
    if (acBox) acBox.style.display = 'none';
}

/*  9. TOOLTIP  */
function showTooltip(cmd, input) {
    const t = CMD_TOOLTIPS[cmd];
    if (!t) return;
    const tip = document.getElementById('cmd-tooltip');
    tip.innerHTML = `<div class="tooltip-cmd">${escHtml(cmd)}</div><div class="tooltip-desc">${escHtml(t.desc)}</div><div class="tooltip-flag">${escHtml(t.flags)}</div>`;
    const rect = input.getBoundingClientRect();
    tip.style.left = rect.left + 'px';
    tip.style.top = (rect.top - 80) + 'px';
    tip.style.display = 'block';
}

function hideTooltip() {
    document.getElementById('cmd-tooltip').style.display = 'none';
}

/*  10. COMMAND PROCESSOR  */
function processCommand(rawCmd, tab) {
    vfs.cwd = [...tab.vfsCwd];

    // Handle pipes
    if (rawCmd.includes('|')) {
        const segments = rawCmd.split('|').map(s => s.trim());
        let lastOutput = null;
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (i === 0) {
                lastOutput = evalCommandForPipe(seg, tab);
            } else {
                const pipeArgs = seg.split(/\s+/);
                const pipeCmd = pipeArgs[0];
                if (pipeCmd === 'grep') {
                    const pattern = pipeArgs[1] || '';
                    const flags = pipeArgs.find(a=>a.startsWith('-')) || '';
                    const regex = new RegExp(pattern, flags.includes('i') ? 'gi' : 'g');
                    lastOutput = (lastOutput || '').split('\n').filter(l => regex.test(l)).join('\n');
                } else if (pipeCmd === 'wc') {
                    const lines = (lastOutput || '').split('\n').filter(Boolean);
                    lastOutput = `${lines.length}`;
                } else if (pipeCmd === 'sort') {
                    lastOutput = (lastOutput || '').split('\n').filter(Boolean).sort().join('\n');
                } else if (pipeCmd === 'head') {
                    const n = parseInt(pipeArgs[2]) || 10;
                    lastOutput = (lastOutput || '').split('\n').slice(0, n).join('\n');
                } else if (pipeCmd === 'tail') {
                    const n = parseInt(pipeArgs[2]) || 10;
                    const lines = (lastOutput || '').split('\n');
                    lastOutput = lines.slice(-n).join('\n');
                } else if (pipeCmd === 'uniq') {
                    const lines = (lastOutput || '').split('\n');
                    lastOutput = lines.filter((l,i) => i === 0 || l !== lines[i-1]).join('\n');
                } else {
                    print(tab, `pipe: ${pipeCmd}: not supported in pipe`, 'error');
                }
            }
        }
        if (lastOutput !== null) print(tab, escHtml(lastOutput), 'output');
        tab.vfsCwd = [...vfs.cwd];
        updatePrompt(tab);
        return;
    }

    // Handle redirection
    let actualCmd = rawCmd, redirectFile = null, appendMode = false;
    const appendMatch = rawCmd.match(/^(.+)\s*>>\s*(.+)$/);
    const redirectMatch = rawCmd.match(/^(.+)\s*>\s*(.+)$/);
    if (appendMatch) { actualCmd = appendMatch[1].trim(); redirectFile = appendMatch[2].trim(); appendMode = true; }
    else if (redirectMatch) { actualCmd = redirectMatch[1].trim(); redirectFile = redirectMatch[2].trim(); }

    if (redirectFile) {
    const output = evalCommandForPipe(actualCmd, tab);
    if (output !== null) {
        let content = output;
        if (appendMode) {
            const existing = vfs.cat(redirectFile);
            content = (existing.ok ? existing.content : '') + output;
        }
        vfs.write(redirectFile, content + '\n');
        // silence
        }
        tab.vfsCwd = [...vfs.cwd];
        updatePrompt(tab);
        return;
    }

    execCommand(actualCmd, tab);
    tab.vfsCwd = [...vfs.cwd];
    updatePrompt(tab);
}

function evalCommandForPipe(cmd, tab) {
    const args = parseArgs(cmd);
    const main = args[0];
    vfs.cwd = [...tab.vfsCwd];
    switch(main) {
        case 'echo': return args.slice(1).join(' ').replace(/['"]/g,'');
        case 'cat': { const r = vfs.cat(args[1]); return r.ok ? r.content : null; }
        case 'ls': {
            const f = args.find(a=>a.startsWith('-'))||''; const path = args.find((a,i)=>i>0&&!a.startsWith('-'));
            const r = vfs.ls(path, f); if (!r.ok) return null;
            return r.items.map(i=>i.name).join('\n');
        }
        case 'ps': return getFakeProcesses().map(p=>`${p.pid}  ${p.name}  ${p.cpu}%`).join('\n');
        case 'grep': {
            const flags = args.filter(a=>a.startsWith('-')).join('');
            const pat = args.find((a,i)=>i>0&&!a.startsWith('-'));
            const file = args.find((a,i)=>i>1&&!a.startsWith('-'));
            if (!file) return null;
            const r = vfs.grep(pat, file, flags); return r.ok ? r.matches.join('\n') : null;
        }
        default: return null;
    }
}

function parseArgs(cmd) {
    const parts = [];
    let cur = '', inQ = false, qChar = '';
    for (const ch of cmd) {
        if (inQ) { if (ch === qChar) inQ = false; else cur += ch; }
        else if (ch === '"' || ch === "'") { inQ = true; qChar = ch; }
        else if (ch === ' ') { if (cur) parts.push(cur); cur = ''; }
        else cur += ch;
    }
    if (cur) parts.push(cur);
    return parts;
}

/*  11. COMMAND EXECUTION  */
function execCommand(cmd, tab) {
    const args = parseArgs(cmd);
    const main = args[0].toLowerCase();
    const flags = args.filter(a => a.startsWith('-')).join('');

    switch (main) {
        /* ── Navigation ── */
        case 'pwd':
            print(tab, escHtml(vfs.pwdStr()), 'output');
            break;

        case 'cd': {
            const r = vfs.cd(args[1]);
            if (!r.ok) print(tab, r.err, 'error');
            break;
        }

        /* ── File Listing ── */
        case 'ls': {
            const path = args.find((a,i) => i>0 && !a.startsWith('-'));
            const r = vfs.ls(path, flags);
            if (!r.ok) { print(tab, r.err, 'error'); break; }
            if (r.showLong) {
                const output = document.getElementById(`output-${tab.id}`);
                const table = document.createElement('table');
                table.className = 'ls-table out-line';
                r.items.forEach(item => {
                const cls = item.type === 'dir' ? 'ls-name-dir' : (item.exec ? 'ls-name-exec' : 'ls-name-file');
                const tr = document.createElement('tr');
                tr.innerHTML = `<td class="ls-perm">${item.perms}</td><td style="color:var(--text-mute)">1 guest guest</td><td class="ls-size">${item.size}</td><td class="ls-date">${item.mtime}</td><td class="${cls}">${escHtml(item.name)}</td>`;
                table.appendChild(tr);
                });
                output.appendChild(table);
                output.scrollTop = output.scrollHeight;
            } else {
                const output = document.getElementById(`output-${tab.id}`);
                const grid = document.createElement('div');
                grid.className = 'ls-grid out-line';
                r.items.forEach(item => {
                const span = document.createElement('span');
                span.className = 'ls-item ' + (item.type==='dir'?'ls-dir':item.exec?'ls-exec':'ls-file');
                span.textContent = item.name + (item.type==='dir' ? '/' : '');
                grid.appendChild(span);
                });
                output.appendChild(grid);
                output.scrollTop = output.scrollHeight;
            }
            break;
        }

        /* ── File Ops ── */
        case 'cat': {
            if (args.slice(1).filter(a=>!a.startsWith('-')).length === 0) { print(tab, 'cat: missing operand', 'error'); break; }
            const files = args.slice(1).filter(a=>!a.startsWith('-'));
            const showLines = flags.includes('n');
            files.forEach(f => {
                const r = vfs.cat(f);
                if (!r.ok) { print(tab, r.err, 'error'); return; }
                let content = r.content;
                if (showLines) content = content.split('\n').map((l,i) => `${String(i+1).padStart(4,' ')}  ${l}`).join('\n');
                print(tab, escHtml(content.replace(/\n$/,'')), 'output');
            });
            break;
        }

        case 'mkdir': {
            const dirs = args.slice(1).filter(a=>!a.startsWith('-'));
            const parents = flags.includes('p');
            dirs.forEach(d => { const r = vfs.mkdir(d, parents); if (!r.ok) print(tab, r.err, 'error'); });
            renderFileTree();
            break;
        }

        case 'touch': {
            args.slice(1).forEach(f => { const r = vfs.touch(f); if (!r.ok) print(tab, r.err, 'error'); });
            renderFileTree();
            break;
        }

        case 'rm': {
            const paths = args.slice(1).filter(a=>!a.startsWith('-'));
            paths.forEach(p => { const r = vfs.rm(p, flags); if (!r.ok) print(tab, r.err, 'error'); });
            renderFileTree();
            break;
        }

        case 'mv': {
            const paths = args.slice(1).filter(a=>!a.startsWith('-'));
            const r = vfs.mv(paths[0], paths[1]);
            if (!r.ok) print(tab, r.err, 'error');
            renderFileTree();
            break;
        }

        case 'cp': {
            const paths = args.slice(1).filter(a=>!a.startsWith('-'));
            const r = vfs.cp(paths[0], paths[1]);
            if (!r.ok) print(tab, r.err, 'error');
            renderFileTree();
            break;
        }

        case 'chmod': {
            const mode = args.find((a,i)=>i>0&&!a.startsWith('-'));
            const file = args.find((a,i)=>i>1&&!a.startsWith('-'));
            const r = vfs.chmod(mode, file);
            if (!r.ok) print(tab, r.err, 'error');
            break;
        }

        case 'grep': {
            const pattern = args.find((a,i)=>i>0&&!a.startsWith('-'));
            const file = args.filter((a,i)=>i>0&&!a.startsWith('-'))[1];
            if (!pattern) { print(tab, 'grep: missing pattern', 'error'); break; }
            if (!file) { print(tab, 'grep: missing file (piping: use | grep)', 'error'); break; }
            const r = vfs.grep(pattern, file, flags);
            if (!r.ok) { print(tab, r.err, 'error'); break; }
            if (r.matches.length === 0) { print(tab, '', 'dim'); }
            else r.matches.forEach(m => print(tab, escHtml(m).replace(new RegExp(escRegex(pattern),'gi'), s=>`<span style="color:var(--red);font-weight:700">${s}</span>`), 'output'));
            break;
        }

        case 'find': {
            const path = args.find((a,i)=>i>0&&!a.startsWith('-')&&a!=='-name'&&a!==args[args.indexOf('-name')+1]) || '.';
            const nameIdx = args.indexOf('-name');
            const name = nameIdx >= 0 ? args[nameIdx+1] : null;
            const r = vfs.find(path, name);
            if (!r.ok) { print(tab, r.err, 'error'); break; }
            r.results.forEach(p => print(tab, escHtml(p), 'output'));
            break;
        }

        case 'head': case 'tail': {
            const file = args.find((a,i)=>i>0&&!a.startsWith('-'));
            if (!file) { print(tab, `${main}: missing file`, 'error'); break; }
            const r = vfs.cat(file);
            if (!r.ok) { print(tab, r.err, 'error'); break; }
            const n = parseInt(flags.replace(/[^0-9]/g,'')) || 10;
            const lines = r.content.split('\n');
            const slice = main === 'head' ? lines.slice(0,n) : lines.slice(-n);
            print(tab, escHtml(slice.join('\n')), 'output');
            break;
        }

        case 'wc': {
            const file = args.find((a,i)=>i>0&&!a.startsWith('-'));
            if (!file) { print(tab, 'wc: missing file', 'error'); break; }
            const r = vfs.cat(file);
            if (!r.ok) { print(tab, r.err, 'error'); break; }
            const lines = r.content.split('\n').length;
            const words = r.content.split(/\s+/).filter(Boolean).length;
            const bytes = r.content.length;
            print(tab, `${String(lines).padStart(6)}${String(words).padStart(8)}${String(bytes).padStart(8)} ${escHtml(file)}`, 'output');
            break;
        }

        case 'echo': {
            let text = args.slice(1).join(' ').replace(/^['"]|['"]$/g,'');
            // env var expansion
            text = text.replace(/\$(\w+)/g, (_, v) => ({HOME:'/home/guest',USER:'guest',PATH:'/usr/local/bin:/usr/bin:/bin',SHELL:'/bin/bash',TERM:'xterm-256color'}[v] || ''));
            print(tab, escHtml(text), 'output');
            break;
        }

        /* ── Compiler ── */
        case 'g++': case 'gcc': {
            const srcIdx = args.findIndex((a,i) => i>0 && !a.startsWith('-') && (a.endsWith('.cpp')||a.endsWith('.c')));
            const oIdx = args.indexOf('-o');
            const src = args[srcIdx];
            const out = oIdx >= 0 ? args[oIdx+1] : 'a.out';
            if (!src) { print(tab, `${main}: error: no input files`, 'error'); break; }
            const r = vfs.cat(src);
            if (!r.ok) { print(tab, `${main}: error: ${src}: No such file or directory`, 'error'); break; }
            print(tab, `<span style="color:var(--text-dim)">${main}: compiling ${escHtml(src)}...</span>`, 'output');
            setTimeout(() => {
                vfs.touch(out);
                const node = vfs.getNode(vfs.resolvePath(out));
                if (node) { node.exec = true; node.perms = '-rwxr-xr-x'; node.content = `__BINARY__:${out}`; node.size = r.content.length * 2; }
                compiledFiles[out] = r.content;
                print(tab, `<span style="color:var(--green)">[100%] Linking CXX executable '${escHtml(out)}'</span>`, 'output');
                print(tab, `<span style="color:var(--green)">✓ Build finished: '${escHtml(out)}'</span>`, 'success');
                renderFileTree();
            }, 600);
            break;
        }

        /* ── Execute ── */
        default: {
            if (main.startsWith('./') || (compiledFiles[main])) {
                const exeName = main.startsWith('./') ? main.slice(2) : main;
                if (compiledFiles[exeName]) {
                const src = compiledFiles[exeName];
                // Simple C++ output simulation
                const coutMatch = src.match(/cout\s*<<\s*["']([^"']+)["']/g);
                if (coutMatch) {
                    coutMatch.forEach(m => {
                    const content = m.match(/["']([^"']+)["']/)[1];
                    print(tab, escHtml(content), 'output');
                    });
                } else {
                    print(tab, `[Process exited 0]`, 'dim');
                }
                } else {
                print(tab, `bash: ${escHtml(main)}: No such file or directory`, 'error');
                }
                break;
            }
            // Falls through to handleSpecialCommands
            handleSpecialCommands(main, args, flags, cmd, tab);
        }
    }
}

/*  12. SPECIAL COMMANDS  */
function handleSpecialCommands(main, args, flags, cmd, tab) {
    switch (main) {
        case 'python3': case 'python': {
            const file = args.find((a,i)=>i>0&&!a.startsWith('-'));
            if (file) {
                const r = vfs.cat(file);
                if (!r.ok) { print(tab, r.err, 'error'); break; }
                runPython(r.content, tab);
            } else if (!file && args.length === 1) {
                print(tab, 'Python 3.11.0 (Pyodide/WASM)', 'dim');
                print(tab, 'Type code directly: python3 -c "print(\'hello\')"', 'dim');
            }
            const cFlag = args.indexOf('-c');
            if (cFlag >= 0 && args[cFlag+1]) runPython(args.slice(cFlag+1).join(' ').replace(/^['"]|['"]$/g,''), tab);
            break;
        }

        case 'vim': case 'nano': {
            const file = args[1] || 'untitled';
            openVim(file, tab);
            break;
        }

        case 'clear':
            document.getElementById(`output-${tab.id}`).innerHTML = '';
            break;

        case 'whoami':
            print(tab, 'guest', 'output');
            break;

        case 'id':
            print(tab, 'uid=1000(guest) gid=1000(guest) groups=1000(guest),27(sudo),4(adm)', 'output');
            break;

        case 'hostname':
            print(tab, 'linox-machine', 'output');
            break;

        case 'uname': {
            const all = flags.includes('a');
            if (all) print(tab, 'Linux linox-machine 5.15.0-linox-generic #1 SMP x86_64 GNU/Linux', 'output');
            else if (flags.includes('r')) print(tab, '5.15.0-linox-generic', 'output');
            else if (flags.includes('m')) print(tab, 'x86_64', 'output');
            else print(tab, 'Linux', 'output');
            break;
        }

        case 'date':
            print(tab, new Date().toString(), 'output');
            break;

        case 'uptime': {
            const secs = Math.floor((Date.now() - startTime) / 1000);
            const m = Math.floor(secs/60), s = secs%60;
            print(tab, ` ${new Date().toLocaleTimeString()} up ${m}m ${s}s,  1 user,  load average: 0.42, 0.38, 0.35`, 'output');
            break;
        }

        case 'ps': {
            const procs = getFakeProcesses();
            if (flags.includes('a') || cmd.includes('aux')) {
                const output = document.getElementById(`output-${tab.id}`);
                const table = document.createElement('table');
                table.className = 'proc-table out-line';
                table.innerHTML = '<tr><td class="proc-pid" style="color:var(--amber)">PID</td><td style="color:var(--amber)">TTY</td><td style="color:var(--amber)">%CPU</td><td style="color:var(--amber)">%MEM</td><td style="color:var(--amber)">COMMAND</td></tr>';
                procs.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td class="proc-pid">${p.pid}</td><td style="color:var(--text-mute)">pts/0</td><td class="proc-cpu">${p.cpu}</td><td style="color:var(--green-dim)">${p.mem}</td><td class="proc-name">${p.name}</td>`;
                table.appendChild(tr);
                });
                output.appendChild(table);
                output.scrollTop = output.scrollHeight;
            } else {
                print(tab, '  PID TTY          TIME CMD', 'dim');
                procs.slice(0,5).forEach(p => print(tab, `${String(p.pid).padStart(5)} pts/0    00:00:0${p.pid%5} ${p.name}`, 'output'));
            }
            break;
        }

        case 'kill': {
            const pid = parseInt(args.find((a,i)=>i>0&&!a.startsWith('-')));
            if (isNaN(pid)) { print(tab, 'kill: missing PID', 'error'); break; }
            print(tab, `[${pid}] Terminated`, 'warning');
            break;
        }

        case 'top': {
            print(tab, `top - ${new Date().toLocaleTimeString()} up 0:${String(Math.floor((Date.now()-startTime)/60000)).padStart(2,'0')}, 1 user`, 'output');
            print(tab, 'Tasks:  12 total,   1 running,  11 sleeping', 'output');
            print(tab, '%Cpu(s): 3.2 us, 1.1 sy, 0.0 ni, 95.3 id', 'output');
            print(tab, 'MiB Mem :   8192.0 total,   6234.5 free,   1203.3 used', 'output');
            print(tab, '', 'output');
            print(tab, '  PID USER    %CPU %MEM COMMAND', 'dim');
            getFakeProcesses().slice(0,8).forEach(p => print(tab, `${String(p.pid).padStart(5)} guest  ${p.cpu.padStart(4)} ${p.mem.padStart(4)} ${p.name}`, 'output'));
            break;
        }

        case 'ping': {
            const host = args.find((a,i)=>i>0&&!a.startsWith('-'));
            const count = parseInt(args[args.indexOf('-c')+1]) || 4;
            if (!host) { print(tab, 'ping: missing host', 'error'); break; }
            print(tab, `PING ${escHtml(host)} (${fakeIP(host)}): 56 data bytes`, 'info');
            let sent = 0;
            const iv = setInterval(() => {
                if (sent >= count) {
                clearInterval(iv);
                const loss = Math.random() > 0.9 ? '25%' : '0%';
                print(tab, `--- ${escHtml(host)} ping statistics ---`, 'dim');
                print(tab, `${count} packets transmitted, ${count} received, ${loss} packet loss`, 'output');
                print(tab, `rtt min/avg/max = ${(8+Math.random()*5).toFixed(3)}/${(10+Math.random()*5).toFixed(3)}/${(15+Math.random()*5).toFixed(3)} ms`, 'output');
                return;
                }
                const ttl = 52 + Math.floor(Math.random()*8);
                const ms = (8+Math.random()*12).toFixed(3);
                const p = document.createElement('div');
                p.className = 'out-line output ping-line';
                p.innerHTML = `64 bytes from ${escHtml(fakeIP(host))}: icmp_seq=${sent+1} ttl=${ttl} time=<span style="color:var(--green)">${ms} ms</span>`;
                document.getElementById(`output-${tab.id}`).appendChild(p);
                document.getElementById(`output-${tab.id}`).scrollTop = 99999;
                sent++;
            }, 600);
            break;
        }

        case 'ssh': {
            const host = args.find((a,i)=>i>0&&!a.startsWith('-')&&!a.includes('@')||a.includes('@')) || '';
            simulateSSH(host, tab);
            break;
        }

        case 'curl': case 'wget': {
            const url = args.find((a,i)=>i>0&&!a.startsWith('-'));
            if (!url) { print(tab, `${main}: missing URL`, 'error'); break; }
            print(tab, `<span style="color:var(--text-dim)">${main}: connecting to ${escHtml(url)}...</span>`, 'output');
            setTimeout(() => print(tab, `<span style="color:var(--green)">HTTP/1.1 200 OK</span>\nContent-Type: text/html\nContent-Length: 1234\n\n[Response body: ${escHtml(url)}]`, 'output'), 800);
            break;
        }

        case 'ifconfig': case 'ip': {
            print(tab, `eth0: flags=4163&lt;UP,BROADCAST,RUNNING,MULTICAST&gt;  mtu 1500\n      inet 192.168.1.100  netmask 255.255.255.0  broadcast 192.168.1.255\n      inet6 fe80::1  prefixlen 64  scopeid 0x20&lt;link&gt;\n      ether 02:42:ac:11:00:02  txqueuelen 0  (Ethernet)\n      RX packets 1234  bytes 98765 (96.3 KiB)\n      TX packets 567   bytes 45678 (44.6 KiB)\n\nlo: flags=73&lt;UP,LOOPBACK,RUNNING&gt;  mtu 65536\n    inet 127.0.0.1  netmask 255.0.0.0`, 'output');
            break;
        }

        case 'df': {
            print(tab, 'Filesystem     1K-blocks    Used Available Use% Mounted on', 'dim');
            print(tab, '/dev/sda1       41251136 8234567  30924521  21% /', 'output');
            print(tab, 'tmpfs            4096000       0   4096000   0% /tmp', 'output');
            break;
        }

        case 'free': {
            print(tab, '              total        used        free      shared  buff/cache   available', 'dim');
            print(tab, 'Mem:        8192000     1203456     6234544      12345      754000     6748765', 'output');
            print(tab, 'Swap:       2097152           0     2097152', 'output');
            break;
        }

        case 'lscpu':
            print(tab, 'Architecture:            x86_64\nCPU(s):                  4\nModel name:              LINOX Virtual CPU @ 2.40GHz\nCache L3:                8 MiB\nNUMA node(s):            1', 'output');
            break;

        case 'env': case 'export':
            if (main === 'env' || args.length === 1) {
                print(tab, 'HOME=/home/guest\nUSER=guest\nSHELL=/bin/bash\nTERM=xterm-256color\nPATH=/usr/local/bin:/usr/bin:/bin\nLANG=en_US.UTF-8\nLS_COLORS=di=34:fi=0:ex=32', 'output');
            } else {
                print(tab, '', 'output'); // simulate export
            }
            break;

        case 'alias':
            print(tab, `alias ll='ls -la'\nalias py='python3'\nalias cls='clear'\nalias ..='cd ..'`, 'output');
            break;

        case 'which': {
            const prog = args[1];
            if (!prog) { print(tab, 'which: missing argument', 'error'); break; }
            const paths = { python3:'/usr/bin/python3', bash:'/bin/bash', 'g++':'/usr/bin/g++', vim:'/usr/bin/vim', grep:'/usr/bin/grep', find:'/usr/bin/find' };
            print(tab, paths[prog] ? `/usr/bin/${prog}` : `which: no ${escHtml(prog)} in PATH`, paths[prog] ? 'output' : 'error');
            break;
        }

        case 'history': {
            const hist = tab.history.slice(-20);
            hist.forEach((h, i) => print(tab, `${String(i+1).padStart(4,'  ')}  ${escHtml(h)}`, 'output'));
            break;
        }

        case 'man': {
            const page = args.find((a,i)=>i>0&&!a.startsWith('-')&&isNaN(parseInt(a)));
            if (!page) { print(tab, 'What manual page do you want?', 'error'); break; }
            const m = MAN_PAGES[page.toLowerCase()];
            if (!m) { print(tab, `No manual entry for ${escHtml(page)}`, 'error'); break; }
            const output = document.getElementById(`output-${tab.id}`);
            const div = document.createElement('div');
            div.className = 'man-page out-line';
            div.innerHTML = `<div class="man-section">${m.name.toUpperCase()}(${m.section}) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; User Commands</div>
                <div class="man-section">NAME</div><div class="man-body">${escHtml(m.name)} - ${escHtml(m.desc)}</div>
                <div class="man-section">SYNOPSIS</div><div class="man-body">${escHtml(m.synopsis)}</div>
                <div class="man-section">OPTIONS</div><div class="man-body">${m.options.map(o=>`<span class="man-option">${escHtml(o.split('  ')[0])}</span>  ${escHtml(o.split('  ').slice(1).join('  '))}`).join('<br>')}</div>`;
            output.appendChild(div);
            output.scrollTop = output.scrollHeight;
            break;
        }

        case 'tar': {
            const create = flags.includes('c'), extract = flags.includes('x'), list = flags.includes('t');
            const file = args.find((a,i)=>i>0&&!a.startsWith('-'));
            if (create) { print(tab, `<span style="color:var(--green)">✓ Created archive: ${escHtml(file||'archive.tar.gz')}</span>`, 'success'); }
            else if (extract) { print(tab, `<span style="color:var(--green)">✓ Extracted: ${escHtml(file||'archive.tar.gz')}</span>`, 'success'); }
            else if (list) { print(tab, `[contents of ${escHtml(file||'archive.tar.gz')}]`, 'output'); }
            else print(tab, 'tar: You must specify one of: -c -x -t', 'error');
            break;
        }

        case 'sudo': {
            if (args[1] === 'su' || args[1] === '-i') { print(tab, '[sudo] password for guest: ', 'warning'); setTimeout(() => print(tab, 'Sorry, user guest is not in the sudoers file. This incident will be reported.', 'error'), 800); }
            else { print(tab, `[sudo] password for guest: `, 'warning'); setTimeout(() => print(tab, `<span style="color:var(--green)">✓ sudo: ${escHtml(args.slice(1).join(' '))}</span>`, 'success'), 800); }
            break;
        }

        case 'exit': case 'logout':
            print(tab, 'logout', 'dim');
            setTimeout(() => { if (tabs.length > 1) closeTab(tab.id); else print(tab, 'Cannot exit the last session.', 'warning'); }, 300);
            break;

        case 'make':
            print(tab, 'make: *** No targets specified and no makefile found.  Stop.', 'error');
            break;

        case 'node':
            print(tab, 'Node.js runtime not available in this environment.', 'warning');
            break;

        case 'help':
            printHelp(tab);
            break;

        default:
            print(tab, `bash: ${escHtml(args[0])}: command not found`, 'error');
            print(tab, `<span style="color:var(--text-mute)">hint: try 'help' to see available commands</span>`, 'dim');
    }
}

function printHelp(tab) {
    const output = document.getElementById(`output-${tab.id}`);
    const div = document.createElement('div');
    div.className = 'out-line';
    div.innerHTML = `
<span style="color:var(--amber);font-weight:700">LINOX v2.0 — Available Commands</span>

<span style="color:var(--green)">File System</span>
    ls [-la]    cat    mkdir [-p]  touch   rm [-r]   mv   cp
    chmod       find   grep [-in]  head    tail       wc   sort

<span style="color:var(--green)">Navigation</span>
    cd [dir]    pwd    ~  (home)   ..  (up)

<span style="color:var(--green)">Editors</span>
    vim [file]  nano [file]

<span style="color:var(--green)">Compilers & Runtime</span>
    g++ src.cpp -o out    gcc src.c -o out    python3 [file|-c]

<span style="color:var(--green)">System</span>
    ps [aux]    top     kill [pid]  free    df      lscpu   uname [-a]
    whoami      id      hostname    date    uptime  env     history

<span style="color:var(--green)">Network</span>
    ping [-c N] host    ssh [user@]host    ifconfig    curl [url]

<span style="color:var(--green)">Utilities</span>
    man [cmd]   which   alias   tar [-czf/-xzf]   echo   clear   exit

<span style="color:var(--amber)">Shell Features</span>
    Tab          autocomplete (commands & files)
    ↑ / ↓       command history
    Ctrl+C       interrupt
    Ctrl+L       clear screen
    Ctrl+T       new tab
    cmd | grep   pipe commands
    cmd > file   redirect output
    cmd >> file  append output
`;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
}

/*  13. PYTHON (PYODIDE)  */
async function runPython(code, tab) {
    if (!pyodideReady || !pyodideInstance) {
        print(tab, 'Python runtime not ready yet. Please wait...', 'warning');
        return;
    }
    print(tab, '<span style="color:var(--text-mute)">Running Python...</span>', 'dim');
    try {
        // Capture stdout
        let output = '';
        pyodideInstance.setStdout({ batched: (s) => { output += s + '\n'; } });
        pyodideInstance.setStderr({ batched: (s) => { output += s + '\n'; } });
        await pyodideInstance.runPythonAsync(code);
        if (output.trim()) print(tab, escHtml(output.trimEnd()), 'output');
        else print(tab, '[Process exited 0]', 'dim');
    } catch(e) {
        print(tab, escHtml(String(e)), 'error');
    }
}

/*  14. VIM EDITOR  */
let vimState = { file: '', mode: 'normal', tab: null, modified: false };

function openVim(filePath, tab) {
    const r = vfs.cat(filePath);
    const content = r.ok ? r.content : '';
    vimState = { file: filePath, mode: 'normal', tab, modified: false };

    const overlay = document.getElementById('vim-overlay');
    const textarea = document.getElementById('vim-textarea');
    const modeLabel = document.getElementById('vim-mode-label');
    const filename = document.getElementById('vim-filename');

    filename.textContent = filePath;
    textarea.value = content;
    textarea.readOnly = true;
    modeLabel.textContent = 'NORMAL';
    modeLabel.className = 'vim-mode';
    overlay.style.display = 'flex';
    document.getElementById('status-mode').textContent = 'VIM';

    updateVimLineNums();
    document.getElementById('vim-status-msg').textContent = '-- Press i to INSERT, :wq to save & quit, :q! to quit --';

    textarea.addEventListener('input', () => { vimState.modified = true; updateVimLineNums(); });
    textarea.addEventListener('keydown', handleVimKey);
    textarea.addEventListener('scroll', syncVimScroll);
}

function updateVimLineNums() {
    const textarea = document.getElementById('vim-textarea');
    const lineNums = document.getElementById('vim-line-nums');
    const count = (textarea.value.match(/\n/g) || []).length + 1;
    lineNums.textContent = Array.from({length: count}, (_,i) => String(i+1).padStart(3,' ')).join('\n');
}

function syncVimScroll() {
    document.getElementById('vim-line-nums').scrollTop = document.getElementById('vim-textarea').scrollTop;
}

function handleVimKey(e) {
    const textarea = document.getElementById('vim-textarea');
    const modeLabel = document.getElementById('vim-mode-label');
    const cmdLine = document.getElementById('vim-cmd-line');
    const statusMsg = document.getElementById('vim-status-msg');

    if (vimState.mode === 'normal') {
        if (e.key === 'i' || e.key === 'a' || e.key === 'o') {
        e.preventDefault();
        vimState.mode = 'insert';
        textarea.readOnly = false;
        modeLabel.textContent = 'INSERT';
        modeLabel.className = 'vim-mode insert';
        statusMsg.textContent = '-- INSERT --';
        if (e.key === 'o') { const pos = textarea.selectionEnd; const text = textarea.value; textarea.value = text.slice(0,pos) + '\n' + text.slice(pos); textarea.selectionStart = textarea.selectionEnd = pos+1; updateVimLineNums(); }
        textarea.focus();
        } else if (e.key === ':') {
        e.preventDefault();
        cmdLine.style.display = 'flex';
        document.getElementById('vim-cmd-input').value = '';
        document.getElementById('vim-cmd-input').focus();
        } else if (e.key === 'G') {
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
        } else if (e.key === 'g' && e.repeat) {
        textarea.selectionStart = textarea.selectionEnd = 0;
        }
        // Update cursor pos
        updateVimCursor(textarea);
    } else if (vimState.mode === 'insert') {
        if (e.key === 'Escape') {
        e.preventDefault();
        vimState.mode = 'normal';
        textarea.readOnly = true;
        modeLabel.textContent = 'NORMAL';
        modeLabel.className = 'vim-mode';
        statusMsg.textContent = '-- Press :wq to save, :q! to quit --';
        }
        updateVimLineNums();
        updateVimCursor(textarea);
    }
}

function updateVimCursor(textarea) {
    const text = textarea.value.slice(0, textarea.selectionEnd);
    const lines = text.split('\n');
    const row = lines.length;
    const col = lines[lines.length-1].length + 1;
    document.getElementById('vim-cursor-pos').textContent = `${row},${col}`;
}

document.getElementById('vim-cmd-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const cmdVal = this.value.trim();
        const cmdLine = document.getElementById('vim-cmd-line');
        cmdLine.style.display = 'none';
        this.value = '';
        execVimCmd(cmdVal);
    } else if (e.key === 'Escape') {
        document.getElementById('vim-cmd-line').style.display = 'none';
        document.getElementById('vim-textarea').focus();
    }
});

function execVimCmd(cmdVal) {
    const textarea = document.getElementById('vim-textarea');
    const statusMsg = document.getElementById('vim-status-msg');
    if (cmdVal === 'wq' || cmdVal === 'w') {
        const content = textarea.value;
        vfs.write(vimState.file, content);
        print(vimState.tab, `<span style="color:var(--green)">"${escHtml(vimState.file)}" written, ${content.split('\n').length}L, ${content.length}B</span>`, 'success');
        if (cmdVal === 'wq') closeVim();
        else statusMsg.textContent = `"${vimState.file}" written`;
        renderFileTree();
    } else if (cmdVal === 'q!' || cmdVal === 'q') {
        if (vimState.modified && cmdVal === 'q') { statusMsg.textContent = 'E37: No write since last change (use :q! to override)'; document.getElementById('vim-textarea').focus(); }
        else closeVim();
    } else {
        statusMsg.textContent = `E492: Not an editor command: ${cmdVal}`;
        document.getElementById('vim-textarea').focus();
    }
}

function closeVim() {
    document.getElementById('vim-overlay').style.display = 'none';
    vimState.mode = 'normal';
    document.getElementById('status-mode').textContent = 'NORMAL';
    const tab = vimState.tab;
    if (tab) setTimeout(() => document.getElementById(`input-${tab.id}`)?.focus(), 100);
}

/*  15. SSH SIMULATION  */
const SSH_HOSTS = [
    { name: 'web-server-01', ip: '10.0.0.10', status: 'online', desc: 'Production Web', os: 'Ubuntu 22.04 LTS' },
    { name: 'db-server-01',  ip: '10.0.0.20', status: 'online', desc: 'PostgreSQL DB', os: 'Debian 11' },
    { name: 'dev-sandbox',   ip: '10.0.0.30', status: 'online', desc: 'Dev Environment', os: 'Linox 2.0' },
    { name: 'firewall-01',   ip: '10.0.0.1',  status: 'online', desc: 'pfSense Firewall', os: 'FreeBSD' },
    { name: 'backup-srv',    ip: '192.168.99.5',status:'offline',desc: 'Backup Storage', os: 'CentOS 7' },
];

function simulateSSH(host, tab) {
    const target = SSH_HOSTS.find(h => h.ip === host || h.name === host || host.endsWith(h.ip) || host.endsWith(h.name));
    if (!target) {
        print(tab, `ssh: connect to host ${escHtml(host)} port 22: Network unreachable`, 'error');
        return;
    }
    if (target.status === 'offline') {
        print(tab, `ssh: connect to host ${escHtml(target.ip)} port 22: Connection refused`, 'error');
        return;
    }
    print(tab, `<span style="color:var(--text-dim)">Connecting to ${escHtml(target.ip)}... Authenticating...</span>`, 'output');
    setTimeout(() => {
        print(tab, `<span style="color:var(--green)">✓ Connected to ${escHtml(target.name)} (${escHtml(target.ip)})</span>`, 'success');
        print(tab, `<span style="color:var(--cyan)">Welcome to ${escHtml(target.os)}</span>`, 'info');
        print(tab, `<span style="color:var(--amber)">[NOTICE] Authorized access only. Session is being logged.</span>`, 'warning');
        print(tab, `<span style="color:var(--text-dim)">Type 'exit' to disconnect.</span>`, 'dim');
        tab.name = `ssh:${target.name}`;
        renderTabBar();
    }, 1200);
}

function showSSHPanel() {
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('panel-content');
    document.getElementById('panel-title').textContent = 'SSH HOSTS';
    panel.style.display = 'flex';
    content.innerHTML = `<div class="ssh-host-list">` +
    SSH_HOSTS.map(h => `<div class="ssh-host" onclick="sshFromPanel('${h.name}')">
        <div class="ssh-host-name">⌁ ${h.name}</div>
        <div class="ssh-host-ip">${h.ip} · ${h.desc}</div>
        <div class="ssh-host-status ${h.status}">${h.status === 'online' ? '● ONLINE' : '○ OFFLINE'}</div>
    </div>`).join('') +
    `</div><div class="ssh-log"><div style="color:var(--amber);font-size:11px;margin-bottom:6px;">RECENT CONNECTIONS</div>` +
    generateSSHLog() + `</div>`;
}

function sshFromPanel(name) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) { simulateSSH(name, tab); document.getElementById('info-panel').style.display = 'none'; }
}

function generateSSHLog() {
    const entries = ['guest@web-server-01','root@db-server-01','deploy@dev-sandbox'];
    return entries.map((e,i) => `<div class="ssh-log-line"><span style="color:var(--green-dim)">${e}</span> <span style="color:var(--text-mute)">${i*3+2}m ago</span></div>`).join('');
}

/*  16. FILE TREE SIDEBAR  */
function renderFileTree() {
    const tree = document.getElementById('file-tree');
    if (!tree) return;
    tree.innerHTML = '';
    vfs.cwd = [...(tabs.find(t=>t.id===activeTabId)||{vfsCwd:['home','guest']}).vfsCwd];

    const renderNode = (node, depth, path) => {
        const el = document.createElement('div');
        el.className = `tree-item ${node.type === 'dir' ? 'dir' : ''}`;
        el.style.paddingLeft = (12 + depth * 14) + 'px';
        const icon = node.type === 'dir' ? '▸ ' : '  ';
        el.innerHTML = `<span style="color:var(--text-mute)">${icon}</span>${escHtml(node.name)}${node.type==='dir'?'/':''}`;
        el.title = path;
        el.addEventListener('click', () => {
        if (node.type === 'file') {
            const tab = tabs.find(t => t.id === activeTabId);
            if (tab) { vfs.cwd = [...tab.vfsCwd]; openVim(path.slice(1), tab); }
        }
        });
        tree.appendChild(el);
        if (node.type === 'dir' && node.children && depth < 3) {
        Object.values(node.children).forEach(child => renderNode(child, depth + 1, path + '/' + child.name));
        }
    };

    const homeNode = vfs.root.children.home.children.guest;
    renderNode({ ...homeNode, name: '~' }, 0, '/home/guest');
}

/*  17. SYS STATS  */
function updateSysStats() {
    const cpu = Math.round(2 + Math.random() * 15);
    const mem = Math.round(14 + Math.random() * 5);
    document.getElementById('cpu-fill').style.width = cpu + '%';
    document.getElementById('cpu-val').textContent = cpu + '%';
    document.getElementById('mem-fill').style.width = mem + '%';
    document.getElementById('mem-val').textContent = mem + '%';
    const up = Math.floor(Math.random()*5), down = Math.floor(Math.random()*10);
    document.getElementById('net-val').textContent = `↑${up} ↓${down}`;
}

function updateClock() {
    document.getElementById('clock').textContent = new Date().toLocaleTimeString('en',{hour12:false});
    const secs = Math.floor((Date.now()-startTime)/1000);
    const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;
    document.getElementById('uptime').textContent = h>0?`${h}h${m}m`:(m>0?`${m}m${s}s`:`${s}s`);
    }

    /*  18. MATRIX CANVAS  */
    const canvas = document.getElementById('matrix-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const chars = '01アイウエオカキクケコサシスセソタチツテト'.split('');
    const fontSize = 14;
    let columns = Math.floor(canvas.width / fontSize);
    let drops = Array(columns).fill(1);

    function drawMatrix() {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#00ff88';
    ctx.font = `${fontSize}px monospace`;
    drops.forEach((y, i) => {
        const ch = chars[Math.floor(Math.random()*chars.length)];
        ctx.globalAlpha = 0.3 + Math.random()*0.3;
        ctx.fillText(ch, i*fontSize, y*fontSize);
        if (y*fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
    });
    ctx.globalAlpha = 1;
    }

    /*  19. UTILITIES  */
    function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function escRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
    function fakeIP(host) {
    let h = 0; for (const c of host) h = (h*31+c.charCodeAt(0))&0xffff;
    return `${(h>>8)&0xfe|1}.${h&0xff}.${(h*7)&0xff}.${(h*13)&0xff}`;
    }
    function getFakeProcesses() {
    return [
        {pid:1,name:'systemd',cpu:'0.0',mem:'0.1'},
        {pid:412,name:'sshd',cpu:'0.0',mem:'0.2'},
        {pid:823,name:'cron',cpu:'0.0',mem:'0.1'},
        {pid:1024,name:'bash',cpu:'0.1',mem:'0.3'},
        {pid:1337,name:'python3',cpu:`${(Math.random()*5).toFixed(1)}`,mem:'1.2'},
        {pid:2048,name:'node',cpu:`${(Math.random()*3).toFixed(1)}`,mem:'2.1'},
        {pid:3000,name:'nginx',cpu:'0.2',mem:'0.4'},
        {pid:4096,name:'linox-shell',cpu:`${(Math.random()*2).toFixed(1)}`,mem:'0.5'},
    ];
}

/*  20. INIT  */
document.addEventListener('DOMContentLoaded', () => {
    createTab('terminal 1');
    renderFileTree();
    updateSysStats();
    updateClock();

    setInterval(drawMatrix, 40);
    setInterval(updateSysStats, 2000);
    setInterval(updateClock, 1000);

  // UI Events
    document.getElementById('new-tab-btn').addEventListener('click', () => createTab());
    document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('hidden');
    });
    document.getElementById('toggle-ssh-btn').addEventListener('click', () => {
        const panel = document.getElementById('info-panel');
        if (panel.style.display === 'none') showSSHPanel();
        else panel.style.display = 'none';
    });
    document.getElementById('sidebar-close').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('hidden');
    });
    document.getElementById('panel-close').addEventListener('click', () => {
        document.getElementById('info-panel').style.display = 'none';
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.terminal-input-line') && !e.target.closest('.vim-overlay')) {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab) document.getElementById(`input-${tab.id}`)?.focus();
        }
        hideTooltip();
    });

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        columns = Math.floor(canvas.width / fontSize);
        drops = Array(columns).fill(1);
    });

  // Prevent default tab behavior
    document.addEventListener('keydown', e => {
        if (e.key === 'Tab' && !e.target.closest('.vim-overlay')) e.preventDefault();
    }, true);

    initPyodide();
});

window.sshFromPanel = sshFromPanel;