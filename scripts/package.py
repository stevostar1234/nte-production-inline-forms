"""Package the client handover files; exclude supplier code and test evidence."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
with ZipFile(root / 'nte-squarespace-code-blocks.zip', 'w', ZIP_DEFLATED) as archive:
    archive.write(root / 'INSTALL.txt', 'INSTALL.txt')
    for file in sorted((root / 'code-blocks').glob('*.txt')):
        archive.write(file, 'code-blocks/' + file.name)
print('Packaged 12 code blocks and the installation guide.')
