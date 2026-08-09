import fs from "node:fs";
import path from "node:path";

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeRelativePath(relativePath, label = "Filesystem path") {
  if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error(`${label} must be a non-empty relative path.`);
  const normalized = path.posix.normalize(relativePath.replace(/\\/gu, "/"));
  if (path.isAbsolute(relativePath) || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
    throw new Error(`${label} must stay inside the anchored root: ${relativePath}`);
  }
  return normalized;
}

function requiredFunction(fsOps, name) {
  if (typeof fsOps?.[name] !== "function") throw new Error(`Anchored filesystem requires fsOps.${name}().`);
  return fsOps[name].bind(fsOps);
}

function realpathNative(fsOps, targetPath) {
  const realpath = requiredFunction(fsOps, "realpathSync");
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(targetPath) : realpath(targetPath);
}

export function anchoredFilesystemCapability(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const platform = options.platform ?? process.platform;
  const procFdRoot = options.procFdRoot ?? "/proc/self/fd";
  if (platform !== "linux") return { supported: false, reason: "anchored writes require Linux" };
  const constants = fsOps.constants ?? fs.constants;
  if (!Number.isInteger(constants?.O_DIRECTORY) || !Number.isInteger(constants?.O_NOFOLLOW)) {
    return { supported: false, reason: "anchored writes require O_DIRECTORY and O_NOFOLLOW" };
  }
  try {
    const stat = requiredFunction(fsOps, "statSync")(procFdRoot);
    if (!stat.isDirectory()) return { supported: false, reason: `${procFdRoot} is not a directory` };
  } catch (error) {
    return { supported: false, reason: `anchored writes require readable ${procFdRoot}: ${errorMessage(error)}` };
  }
  return { supported: true, reason: null, procFdRoot };
}

export function requireAnchoredFilesystemCapability(options = {}) {
  const capability = anchoredFilesystemCapability(options);
  if (!capability.supported) throw new Error(`Anchored writes are unavailable: ${capability.reason}. Use a read-only operation on this platform.`);
  return capability;
}

function pathType(stat) {
  if (stat.isFile()) return "file";
  if (stat.isDirectory()) return "directory";
  if (stat.isSymbolicLink()) return "symlink";
  return "other";
}

export class AnchoredFilesystem {
  constructor(root, options = {}) {
    this.fsOps = options.fsOps ?? fs;
    this.constants = this.fsOps.constants ?? fs.constants;
    this.procFdRoot = options.procFdRoot ?? "/proc/self/fd";
    requireAnchoredFilesystemCapability({ ...options, fsOps: this.fsOps, procFdRoot: this.procFdRoot });
    const openSync = requiredFunction(this.fsOps, "openSync");
    const resolvedRoot = path.resolve(root);
    try {
      this.rootFd = openSync(resolvedRoot, this.constants.O_RDONLY | this.constants.O_DIRECTORY | this.constants.O_NOFOLLOW);
    } catch (error) {
      throw new Error(`Unable to anchor workspace root without following links: ${resolvedRoot}: ${errorMessage(error)}`, { cause: error });
    }
    this.rootHandlePath = path.posix.join(this.procFdRoot, String(this.rootFd));
    try {
      this.root = realpathNative(this.fsOps, this.rootHandlePath);
    } catch (error) {
      this.close();
      throw new Error(`Unable to resolve anchored workspace root: ${errorMessage(error)}`, { cause: error });
    }
    this.closed = false;
  }

  assertOpen() {
    if (this.closed) throw new Error("Anchored filesystem is closed.");
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.rootFd !== undefined) requiredFunction(this.fsOps, "closeSync")(this.rootFd);
  }

  normalize(relativePath, label) {
    return normalizeRelativePath(relativePath, label);
  }

  displayPath(relativePath) {
    return path.join(this.root, this.normalize(relativePath));
  }

  openDirectory(relativePath = null) {
    this.assertOpen();
    if (relativePath === null || relativePath === "" || relativePath === ".") {
      return { fd: this.rootFd, handlePath: this.rootHandlePath, relativePath: "", owned: false };
    }
    const normalized = this.normalize(relativePath, "Directory path");
    let currentFd = this.rootFd;
    let owned = false;
    let currentRelative = "";
    try {
      for (const component of normalized.split("/")) {
        const currentHandle = path.posix.join(this.procFdRoot, String(currentFd));
        const candidate = path.posix.join(currentHandle, component);
        const nextFd = requiredFunction(this.fsOps, "openSync")(candidate, this.constants.O_RDONLY | this.constants.O_DIRECTORY | this.constants.O_NOFOLLOW);
        if (owned) requiredFunction(this.fsOps, "closeSync")(currentFd);
        currentFd = nextFd;
        owned = true;
        currentRelative = currentRelative ? `${currentRelative}/${component}` : component;
      }
      return { fd: currentFd, handlePath: path.posix.join(this.procFdRoot, String(currentFd)), relativePath: currentRelative, owned };
    } catch (error) {
      if (owned) requiredFunction(this.fsOps, "closeSync")(currentFd);
      throw error;
    }
  }

  closeDirectory(directory) {
    if (directory?.owned === true && directory.fd !== undefined) requiredFunction(this.fsOps, "closeSync")(directory.fd);
  }

  withParent(relativePath, callback) {
    const normalized = this.normalize(relativePath);
    const parentRelative = path.posix.dirname(normalized);
    const parent = this.openDirectory(parentRelative === "." ? null : parentRelative);
    const name = path.posix.basename(normalized);
    try {
      return callback({ normalized, parent, name, handlePath: path.posix.join(parent.handlePath, name) });
    } finally {
      this.closeDirectory(parent);
    }
  }

  lstat(relativePath) {
    return this.withParent(relativePath, ({ handlePath }) => requiredFunction(this.fsOps, "lstatSync")(handlePath));
  }

  tryLstat(relativePath) {
    try {
      return this.lstat(relativePath);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  exists(relativePath) {
    return this.tryLstat(relativePath) !== null;
  }

  openFile(relativePath, flags, mode) {
    return this.withParent(relativePath, ({ handlePath }) => requiredFunction(this.fsOps, "openSync")(handlePath, flags | this.constants.O_NOFOLLOW, mode));
  }

  inspectRegularFile(relativePath) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY | (this.constants.O_NONBLOCK ?? 0));
    try {
      const stat = requiredFunction(this.fsOps, "fstatSync")(fd);
      if (!stat.isFile()) throw new Error(`Anchored read target must be a regular file: ${relativePath}`);
      return stat;
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }

  readFile(relativePath) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY);
    try {
      const stat = requiredFunction(this.fsOps, "fstatSync")(fd);
      if (!stat.isFile()) throw new Error(`Anchored read target must be a regular file: ${relativePath}`);
      return Buffer.from(requiredFunction(this.fsOps, "readFileSync")(fd));
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }

  writeNewFile(relativePath, content, options = {}) {
    const mode = options.mode ?? 0o600;
    const fd = this.openFile(relativePath, this.constants.O_WRONLY | this.constants.O_CREAT | this.constants.O_EXCL, mode);
    try {
      requiredFunction(this.fsOps, "writeFileSync")(fd, content, options.encoding);
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }

  chmod(relativePath, mode) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY);
    try {
      requiredFunction(this.fsOps, "fchmodSync")(fd, mode);
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }

  mkdir(relativePath, options = {}) {
    const normalized = this.normalize(relativePath, "Directory path");
    if (options.recursive === true) {
      let current = "";
      for (const component of normalized.split("/")) {
        current = current ? `${current}/${component}` : component;
        const stat = this.tryLstat(current);
        if (stat) {
          if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Anchored directory component is not a real directory: ${current}`);
          continue;
        }
        this.mkdir(current, { mode: options.mode });
      }
      return;
    }
    this.withParent(normalized, ({ handlePath }) => requiredFunction(this.fsOps, "mkdirSync")(handlePath, { recursive: false, ...(options.mode === undefined ? {} : { mode: options.mode }), anchoredPath: normalized, displayPath: this.displayPath(normalized) }));
  }

  readdir(relativePath = null, options = {}) {
    const directory = this.openDirectory(relativePath);
    try {
      return requiredFunction(this.fsOps, "readdirSync")(directory.handlePath, options);
    } finally {
      this.closeDirectory(directory);
    }
  }

  rename(fromRelativePath, toRelativePath) {
    const from = this.normalize(fromRelativePath, "Rename source");
    const to = this.normalize(toRelativePath, "Rename destination");
    const fromParent = this.openDirectory(path.posix.dirname(from) === "." ? null : path.posix.dirname(from));
    const toParent = this.openDirectory(path.posix.dirname(to) === "." ? null : path.posix.dirname(to));
    try {
      const sourcePath = path.posix.join(fromParent.handlePath, path.posix.basename(from));
      const sourceStat = requiredFunction(this.fsOps, "lstatSync")(sourcePath);
      if (sourceStat.isSymbolicLink()) throw new Error(`Anchored rename source must not be a symbolic link: ${from}`);
      const destinationPath = path.posix.join(toParent.handlePath, path.posix.basename(to));
      try {
        const destinationStat = requiredFunction(this.fsOps, "lstatSync")(destinationPath);
        if (destinationStat.isSymbolicLink()) throw new Error(`Anchored rename destination must not be a symbolic link: ${to}`);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      requiredFunction(this.fsOps, "renameSync")(sourcePath, destinationPath, { anchoredFrom: from, anchoredTo: to, displayFrom: this.displayPath(from), displayTo: this.displayPath(to) });
    } finally {
      this.closeDirectory(toParent);
      this.closeDirectory(fromParent);
    }
  }

  unlink(relativePath, options = {}) {
    try {
      this.withParent(relativePath, ({ handlePath }) => {
        const stat = requiredFunction(this.fsOps, "lstatSync")(handlePath);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Anchored unlink target must be a regular file: ${relativePath}`);
        requiredFunction(this.fsOps, "unlinkSync")(handlePath, { anchoredPath: this.normalize(relativePath), displayPath: this.displayPath(relativePath) });
      });
    } catch (error) {
      if (options.force === true && error?.code === "ENOENT") return;
      throw error;
    }
  }

  rmdir(relativePath, options = {}) {
    try {
      const normalized = this.normalize(relativePath);
      this.withParent(normalized, ({ handlePath }) => requiredFunction(this.fsOps, "rmdirSync")(handlePath, { anchoredPath: normalized, displayPath: this.displayPath(normalized), recursiveCleanup: options.recursiveCleanup === true }));
    } catch (error) {
      if (options.force === true && error?.code === "ENOENT") return;
      throw error;
    }
  }

  remove(relativePath, options = {}) {
    const normalized = this.normalize(relativePath, "Removal path");
    const stat = this.tryLstat(normalized);
    if (!stat) {
      if (options.force === true) return;
      const error = new Error(`Anchored removal target does not exist: ${normalized}`);
      error.code = "ENOENT";
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Anchored removal target must not be a symbolic link: ${normalized}`);
    if (stat.isDirectory()) {
      if (options.recursive !== true) return this.rmdir(normalized);
      const directory = this.openDirectory(normalized);
      try {
        const entries = requiredFunction(this.fsOps, "readdirSync")(directory.handlePath, { withFileTypes: true });
        for (const entry of entries) {
          const childPath = `${normalized}/${entry.name}`;
          const childHandlePath = path.posix.join(directory.handlePath, entry.name);
          const childStat = requiredFunction(this.fsOps, "lstatSync")(childHandlePath);
          if (childStat.isSymbolicLink()) throw new Error(`Anchored cleanup encountered a symbolic link: ${childPath}`);
          if (childStat.isDirectory()) this.remove(childPath, { recursive: true, force: false });
          else if (childStat.isFile()) this.unlink(childPath);
          else throw new Error(`Anchored cleanup encountered an unsupported path type: ${childPath}`);
        }
      } finally {
        this.closeDirectory(directory);
      }
      return this.rmdir(normalized, { force: options.force, recursiveCleanup: true });
    }
    if (stat.isFile()) return this.unlink(normalized, { force: options.force });
    throw new Error(`Anchored removal target has an unsupported path type: ${normalized}`);
  }
}

export function openAnchoredFilesystem(root, options = {}) {
  return new AnchoredFilesystem(root, options);
}
