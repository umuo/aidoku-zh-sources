"""将已编译的图源打包到 public，并同步两份索引；不会替代实站验证。"""

import json
import shutil
import sys
import tomllib
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 tools/source-check/package.py zh.source")
    name = sys.argv[1]
    if not name.startswith("zh.") or "/" in name or "\\" in name:
        raise ValueError("Invalid source directory")
    source = Path("src/rust") / name
    metadata = json.loads((source / "res/source.json").read_text())
    if metadata.get("deprecated"):
        raise ValueError("Deprecated source must be explicitly restored before publishing")
    info = metadata["info"]
    manifest = tomllib.loads((source / "Cargo.toml").read_text())
    crate = manifest["package"]["name"].replace("-", "_")
    wasm = source / f"target/wasm32-unknown-unknown/release/{crate}.wasm"
    if not wasm.read_bytes().startswith(b"\x00asm\x01\x00\x00\x00"):
        raise ValueError("Invalid compiled WASM")
    public = Path("public")
    index = json.loads((public / "index.min.json").read_text())
    entries = [entry for entry in index if entry["id"] == info["id"]]
    if entries and entries[0]["version"] >= info["version"]:
        raise ValueError("Increment source.json version before replacing a published package")
    filename = f"{info['id']}-v{info['version']}"
    output = public / "sources" / f"{filename}.aix"
    with ZipFile(output, "w", ZIP_DEFLATED) as package:
        for resource in sorted((source / "res").iterdir()):
            if resource.is_file():
                package.write(resource, f"Payload/{resource.name}")
        package.write(wasm, "Payload/main.wasm")
    with ZipFile(output) as package:
        if package.testzip() is not None:
            raise ValueError("Invalid package archive")
    shutil.copyfile(source / "res/Icon.png", public / "icons" / f"{filename}.png")
    entry = {key: info[key] for key in ("id", "name", "lang", "version", "nsfw")}
    entry.update(file=f"{filename}.aix", icon=f"{filename}.png")
    if entries:
        index[index.index(entries[0])] = entry
    else:
        index.append(entry)
        index.sort(key=lambda item: item["id"])
    (public / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n")
    (public / "index.min.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    print(f"Packaged {info['id']} v{info['version']}: {output}")


if __name__ == "__main__":
    main()
