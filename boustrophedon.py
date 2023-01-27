
# python that follows the path of the serpent
def boustrophedon(text:str):
    lines = text.split('<br/>')
    for i in range(0, len(lines), 2):
        lines[i] = f"<span style='text-transform:(-1);'>{lines[i]}</span>"
    return lines.join('<br/>')
