// Campos legados do protocolo; o movimento não inicia mais slides.
export interface SlideState {
  sliding: boolean;
  slideTime: number;
  slideCooldown: number;
  slideHeld: boolean;
}

export function createSlide(): SlideState {
  return { sliding: false, slideTime: 0, slideCooldown: 0, slideHeld: false };
}
