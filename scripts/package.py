"""Build a clean Foundry module ZIP for the current manifest version."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "module.json").read_text(encoding="utf-8"))
output = ROOT / "dist"
output.mkdir(exist_ok=True)
archive_path = output / f"token-flip-v{manifest['version']}.zip"
include = [
    "module.json",
    "README.md",
    "lang/en.json",
    "scripts/module.js",
    "styles/module.css",
    "templates/art-choices.hbs",
    "templates/permissions.hbs",
]
with ZipFile(archive_path, "w", ZIP_DEFLATED) as archive:
    for relative in include:
        path = ROOT / relative
        if not path.is_file():
            raise FileNotFoundError(path)
        archive.write(path, f"{manifest['id']}/{relative}")
with ZipFile(archive_path) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert f"{manifest['id']}/module.json" in names
    assert not any("PROJECT_NOTES" in name or "/dist/" in name for name in names)
checksum = hashlib.sha256(archive_path.read_bytes()).hexdigest()
archive_path.with_suffix(".zip.sha256").write_text(
    f"{checksum}  {archive_path.name}\n", encoding="utf-8"
)
print(f"{archive_path}\n{len(include)} files; ZIP verified; SHA-256 {checksum}")
