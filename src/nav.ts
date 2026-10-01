// Cronologia interna: il tasto indietro torna alla pagina precedente (e alla stessa posizione di scorrimento),
// non alla pagina principale. Se si arriva da un link diretto non c'è cronologia e si usa la pagina "padre".

const stack: string[] = [location.hash || '#/']
const scrolls = new Map<string, number>()

/** Da chiamare a ogni cambio di hash. Restituisce la posizione di scorrimento da ripristinare (se è un "indietro"). */
export function onNavigate(prev: string, next: string): number {
  scrolls.set(prev, window.scrollY)
  if (stack.length > 1 && stack[stack.length - 2] === next) {
    stack.pop()
    return scrolls.get(next) ?? 0
  }
  stack.push(next)
  return 0
}

export function goBack(fallback: string) {
  if (stack.length > 1) history.back()
  else location.hash = fallback
}
