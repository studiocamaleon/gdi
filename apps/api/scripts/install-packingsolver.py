#!/usr/bin/env python3
"""Compila e instala la versión evaluada sin habilitarla en el cotizador.

Requiere Git, CMake >= 3.28 y un compilador C++14. La primera compilación descarga
dependencias. --source y --build permiten reutilizar una compilación verificada.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile

COMMIT = 'a7e533033d9c6ee3ff286513720afe6660b5989f'
URL = 'https://github.com/fontanf/packingsolver.git'
API = Path(__file__).resolve().parents[1]


def run(*args):
    subprocess.run([str(x) for x in args], check=True)


def read(*args):
    return subprocess.check_output([str(x) for x in args], text=True).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=API / '.native/sources' / COMMIT)
    parser.add_argument('--build', type=Path)
    parser.add_argument('--destination', type=Path, default=API / '.native/packingsolver')
    parser.add_argument('--jobs', type=int, choices=range(1, 9), default=2)
    args = parser.parse_args()
    source = args.source.resolve()
    build = (args.build or API / '.native/builds' / COMMIT).resolve()
    if not source.exists():
        source.parent.mkdir(parents=True, exist_ok=True)
        run('git', 'init', source)
        run('git', '-C', source, 'fetch', '--depth', '1', URL, COMMIT)
        run('git', '-C', source, 'checkout', '--detach', COMMIT)
    if read('git', '-C', source, 'rev-parse', 'HEAD') != COMMIT:
        raise RuntimeError('La fuente no coincide con el commit evaluado.')
    if read('git', '-C', source, 'status', '--porcelain', '--untracked-files=no'):
        raise RuntimeError('La fuente tiene cambios; no se instala como la versión evaluada.')
    run('cmake', '-S', source, '-B', build, '-DCMAKE_BUILD_TYPE=Release',
        '-DPACKINGSOLVER_BUILD_TEST=OFF', '-DPACKINGSOLVER_BUILD_MAIN=ON',
        '-DPACKINGSOLVER_USE_CLP=OFF', '-DPACKINGSOLVER_USE_HIGHS=ON',
        '-DPACKINGSOLVER_USE_KNITRO=OFF')
    run('cmake', '--build', build, '--target', 'PackingSolver_irregular_main', '--parallel', args.jobs)
    binary = build / 'src/irregular/packingsolver_irregular'
    digest = hashlib.sha256(binary.read_bytes()).hexdigest()
    destination = args.destination.resolve() / COMMIT / digest
    destination.mkdir(parents=True, exist_ok=True)
    # Instala sólo el ejecutable y sus avisos, nunca el árbol de compilación.
    with tempfile.NamedTemporaryFile(dir=destination, delete=False) as temp:
        temporary = Path(temp.name)
    try:
        shutil.copy2(binary, temporary)
        temporary.chmod(0o755)
        os.replace(temporary, destination / binary.name)
    finally:
        temporary.unlink(missing_ok=True)
    dependencies = {}
    notices = []
    for name, folder in [('PackingSolver', source), *[(p.name, p) for p in sorted((build / '_deps').glob('*-src'))]]:
        if (folder / '.git').exists():
            dependencies[name] = read('git', '-C', folder, 'rev-parse', 'HEAD')
        licenses = sorted(set(folder.glob('LICENSE*')) | set(folder.glob('COPYING*')))
        # HiGHS distribuye además estos avisos con sus fuentes incluidas.
        if name == 'highs-src':
            licenses += sorted((folder / 'extern').glob('*/LICENSE*'))
            licenses += sorted((folder / 'highs/io').glob('*/LICENSE*'))
        for file in licenses:
            if file.is_file():
                notices.append(f'## {name}: {file.relative_to(folder)}\n\n{file.read_text()}\n')
    (destination / 'THIRD_PARTY_NOTICES.txt').write_text('\n'.join(notices))
    manifest = {'source': URL, 'commit': COMMIT, 'binarySha256': digest,
        'platform': platform.platform(), 'machine': platform.machine(),
        'cmake': read('cmake', '--version').splitlines()[0],
        'build': 'Release; HiGHS; sin CLP ni Knitro', 'gitDependencies': dependencies,
        'licencias': 'THIRD_PARTY_NOTICES.txt'}
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'PACKINGSOLVER_BIN': str(destination / binary.name),
        'version': f'packingsolver:sha256:{digest}', 'activado': False}, indent=2))


if __name__ == '__main__':
    main()
