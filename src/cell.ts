// Shared board-cell painting for the main game and the help-dialog demo.
// A cell shows at most two yellow hint letters: the row word's hint on top,
// the column word's below (stateAt pushes them in that order).

export function paintCell(
  cell: HTMLElement,
  opts: { green: boolean; hints: string[]; letter: string; star?: boolean }
): void {
  if (!opts.letter) {
    if (opts.star) {
      cell.className = "cell gap star";
      cell.textContent = "⭐";
    } else {
      cell.className = "cell gap";
      cell.textContent = "";
    }
    return;
  }
  if (opts.green) {
    cell.className = "cell revealed";
    cell.textContent = opts.letter;
  } else if (opts.hints.length > 1) {
    cell.className = "cell hint hint2";
    cell.replaceChildren(
      ...opts.hints.map(h => {
        const s = document.createElement("span");
        s.textContent = h;
        return s;
      })
    );
  } else if (opts.hints.length === 1) {
    cell.className = "cell hint";
    cell.textContent = opts.hints[0];
  } else {
    cell.className = "cell";
    cell.textContent = "";
  }
}
