// Grupos de escolha: Tab entra pela opção selecionada; setas percorrem e selecionam.
// Usa o clique existente para manter o salvamento e o destaque no mesmo caminho.
export function bindSelectionKeys(buttons: readonly HTMLButtonElement[]) {
  for (const [index, button] of buttons.entries()) {
    button.addEventListener('keydown', (e) => {
      let next: number;
      switch (e.key) {
        case 'ArrowLeft': case 'ArrowUp': next = (index + buttons.length - 1) % buttons.length; break;
        case 'ArrowRight': case 'ArrowDown': next = (index + 1) % buttons.length; break;
        case 'Home': next = 0; break;
        case 'End': next = buttons.length - 1; break;
        default: return;
      }
      e.preventDefault();
      e.stopPropagation();
      buttons[next].focus();
      buttons[next].click();
    });
  }
}
