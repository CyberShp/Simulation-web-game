from pathlib import Path
root=Path(__file__).resolve().parent
html=(root/'game-ui.template.html').read_text()
css=(root/'game-ui.css').read_text()
js='\n'.join((root/name).read_text() for name in ['game-ui-core.js','game-ui-people.js','game-ui-arts.js','game-ui.js'])
(root/'game-ui.html').write_text(html.replace('/* STYLES */',css).replace('/* SCRIPTS */',js))
print('Built game-ui.html')
